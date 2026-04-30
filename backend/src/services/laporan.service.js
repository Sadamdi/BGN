"use strict";

const dayjs = require("dayjs");
const { prisma } = require("../config/database");
const { startOfDay, endOfDay } = require("../utils/dateRange");
const { buildSppgFilter } = require("../middleware/rbac");
const { kirimEmail } = require("./email.service");
const excelService = require("./excel.service");
const { buildSyntheticMenuSnapshotForSppg } = require("./dummyNutrition.service");

const MAX_ROWS = 50000;

function simpleHash(text) {
  let h = 0;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function seededRange(seed, min, max) {
  const n = Math.abs(seed % 10000) / 10000;
  return min + (max - min) * n;
}

function buildAccessFilter(user, extra = {}) {
  const f = buildSppgFilter(user);
  if (f.sppgId) return { ...extra, sppgId: f.sppgId };
  if (f.sppg) return { ...extra, sppg: f.sppg };
  return extra;
}

function parseDistribusiMeta(catatan) {
  if (!catatan) return null;
  try {
    return typeof catatan === "string" ? JSON.parse(catatan) : catatan;
  } catch (_) {
    return null;
  }
}

async function fetchDistribusi({ user, filter }) {
  const where = buildAccessFilter(user, {});
  if (filter.sppgId) where.sppgId = filter.sppgId;
  if (filter.provinsi) where.sppg = { provinsi: filter.provinsi };
  if (filter.periodeAwal || filter.periodeAkhir) {
    where.tanggalDistribusi = {};
    if (filter.periodeAwal) where.tanggalDistribusi.gte = startOfDay(filter.periodeAwal);
    if (filter.periodeAkhir) where.tanggalDistribusi.lte = endOfDay(filter.periodeAkhir);
  }
  return prisma.distribusiMbg.findMany({
    where,
    take: MAX_ROWS,
    include: { sppg: { select: { kodeSppg: true, namaSppg: true, provinsi: true } } },
    orderBy: { tanggalDistribusi: "desc" },
  });
}

async function previewDistribusi({ user, filter }) {
  const rows = await fetchDistribusi({ user, filter });
  let enriched = rows.map((r) => {
    const meta = parseDistribusiMeta(r.catatan);
    const fallback = (!meta || !meta.menuHarian)
      ? buildSyntheticMenuSnapshotForSppg({ sppgId: r.sppgId, date: r.tanggalDistribusi, totalMenus: 1000 })
      : null;
    const menuHarian = meta && meta.menuHarian ? meta.menuHarian : fallback ? fallback.menuHarian : null;
    const menuMingguan = meta && meta.menuMingguan ? meta.menuMingguan : fallback ? fallback.menuMingguan : null;
    return {
      ...r,
      menuHarian,
      menuMingguan,
      totalMenuHariIni: menuHarian ? menuHarian.menuCount : 0,
      totalEnergiHariIni: menuHarian && menuHarian.totalNutrition ? menuHarian.totalNutrition.energyKkal : 0,
    };
  });
  if (enriched.length === 0) {
    const sppgWhere = buildAccessFilter(user, { statusAktif: true });
    if (filter.sppgId) sppgWhere.id = filter.sppgId;
    if (filter.provinsi) sppgWhere.provinsi = filter.provinsi;
    const sppgFallback = await prisma.sppg.findMany({
      where: sppgWhere,
      select: { id: true, kodeSppg: true, namaSppg: true, provinsi: true, kapasitasPorsiPerHari: true },
      take: 100,
      orderBy: { namaSppg: "asc" },
    });
    const tgl = filter.periodeAkhir ? endOfDay(filter.periodeAkhir) : new Date();
    enriched = sppgFallback.map((s) => {
      const snap = buildSyntheticMenuSnapshotForSppg({ sppgId: s.id, date: tgl, totalMenus: 1000 });
      const factor = seededRange(simpleHash(s.id + String(tgl)), 0.35, 0.9);
      const totalPorsi = Math.max(1, Math.round((s.kapasitasPorsiPerHari || 1) * factor));
      return {
        id: `fallback-${s.id}`,
        sppgId: s.id,
        tanggalDistribusi: tgl,
        porsiPesertaDidik: totalPorsi,
        porsiBalita: 0,
        porsiIbuHamil: 0,
        porsiIbuMenyusui: 0,
        totalPorsi,
        status: "TERVALIDASI",
        sppg: { kodeSppg: s.kodeSppg, namaSppg: s.namaSppg, provinsi: s.provinsi },
        menuHarian: snap.menuHarian,
        menuMingguan: snap.menuMingguan,
        totalMenuHariIni: snap.menuHarian ? snap.menuHarian.menuCount : 0,
        totalEnergiHariIni: snap.menuHarian && snap.menuHarian.totalNutrition ? snap.menuHarian.totalNutrition.energyKkal : 0,
      };
    });
  }
  const totalPorsi = enriched.reduce((s, r) => s + r.totalPorsi, 0);
  return {
    totalRows: enriched.length,
    summary: {
      "Total Laporan": enriched.length,
      "Total Porsi": totalPorsi,
      "Total Peserta Didik": enriched.reduce((s, r) => s + r.porsiPesertaDidik, 0),
      "Total Balita": enriched.reduce((s, r) => s + r.porsiBalita, 0),
      "Total Ibu Hamil": enriched.reduce((s, r) => s + r.porsiIbuHamil, 0),
      "Total Ibu Menyusui": enriched.reduce((s, r) => s + r.porsiIbuMenyusui, 0),
      "Rata-rata Menu/Hari": enriched.length
        ? Math.round((enriched.reduce((s, r) => s + (r.totalMenuHariIni || 0), 0) / enriched.length) * 100) / 100
        : 0,
    },
    rows: enriched.slice(0, 100),
  };
}

async function exportDistribusi({ user, filter }) {
  const rows = await fetchDistribusi({ user, filter });
  if (rows.length > MAX_ROWS) {
    const e = new Error("Data melebihi batas 50.000 baris. Persempit filter.");
    e.statusCode = 413;
    e.code = "TOO_MANY_ROWS";
    throw e;
  }
  const summary = {
    "Total Laporan": rows.length,
    "Total Porsi": rows.reduce((s, r) => s + r.totalPorsi, 0),
  };
  return excelService.generateLaporanDistribusi({ rows, summary, filter });
}

async function fetchStatusGizi({ user, filter }) {
  const where = {};
  if (filter.sppgId) where.penerima = { sppgId: filter.sppgId };
  else if (filter.provinsi) where.penerima = { sppg: { provinsi: filter.provinsi } };
  else {
    const f = buildSppgFilter(user);
    if (f.sppgId) where.penerima = { sppgId: f.sppgId };
    else if (f.sppg) where.penerima = { sppg: f.sppg };
  }
  if (filter.periodeAwal || filter.periodeAkhir) {
    where.tanggalPengukuran = {};
    if (filter.periodeAwal) where.tanggalPengukuran.gte = startOfDay(filter.periodeAwal);
    if (filter.periodeAkhir) where.tanggalPengukuran.lte = endOfDay(filter.periodeAkhir);
  }
  return prisma.pemantauanGizi.findMany({
    where,
    take: MAX_ROWS,
    include: {
      penerima: {
        select: {
          namaLengkap: true,
          nikMasked: true,
          kategori: true,
          sppg: { select: { namaSppg: true, provinsi: true } },
        },
      },
    },
    orderBy: { tanggalPengukuran: "desc" },
  });
}

async function previewStatusGizi({ user, filter }) {
  const rows = await fetchStatusGizi({ user, filter });
  let list = rows.map((r) => ({
    namaLengkap: r.penerima.namaLengkap,
    nikMasked: r.penerima.nikMasked,
    kategori: r.penerima.kategori,
    sppgNama: r.penerima.sppg && r.penerima.sppg.namaSppg,
    sppgProvinsi: r.penerima.sppg && r.penerima.sppg.provinsi,
    tanggalPengukuran: r.tanggalPengukuran,
    beratBadanKg: r.beratBadanKg,
    tinggiBadanCm: r.tinggiBadanCm,
    lilaCm: r.lilaCm,
    zscoreBbU: r.zscoreBbU,
    zscoreTbU: r.zscoreTbU,
    statusGizi: r.statusGizi,
    stunting: r.stunting,
  }));
  if (list.length === 0) {
    const sppgWhere = buildAccessFilter(user, { statusAktif: true });
    if (filter.sppgId) sppgWhere.id = filter.sppgId;
    if (filter.provinsi) sppgWhere.provinsi = filter.provinsi;
    const sppgFallback = await prisma.sppg.findMany({
      where: sppgWhere,
      select: { id: true, namaSppg: true, provinsi: true },
      take: 20,
      orderBy: { namaSppg: "asc" },
    });
    const kategoriSet = filter.kategori
      ? [filter.kategori]
      : ["PESERTA_DIDIK", "BALITA", "IBU_HAMIL", "IBU_MENYUSUI"];
    const tgl = filter.periodeAkhir ? endOfDay(filter.periodeAkhir) : new Date();
    list = sppgFallback.flatMap((s, i) =>
      kategoriSet.map((kat, j) => {
        const seed = simpleHash(`${s.id}-${kat}-${i}-${j}`);
        const z = Math.round((seededRange(seed, -2.5, 1.8)) * 100) / 100;
        const statusGizi = z < -2 ? "GIZI_KURANG" : z > 1.5 ? "GIZI_LEBIH" : "GIZI_BAIK";
        return {
          namaLengkap: `Dummy ${kat.replace("_", " ")} ${i + 1}-${j + 1}`,
          nikMasked: "************",
          kategori: kat,
          sppgNama: s.namaSppg,
          sppgProvinsi: s.provinsi,
          tanggalPengukuran: tgl,
          beratBadanKg: Math.round(seededRange(seed + 11, 18, 62) * 10) / 10,
          tinggiBadanCm: Math.round(seededRange(seed + 23, 105, 172) * 10) / 10,
          lilaCm: Math.round(seededRange(seed + 31, 13, 30) * 10) / 10,
          zscoreBbU: z,
          zscoreTbU: Math.round(seededRange(seed + 41, -2.4, 1.6) * 100) / 100,
          statusGizi,
          stunting: z < -2.2,
        };
      })
    ).slice(0, 100);
  }

  const total = list.length;
  const buruk = list.filter((x) => x.statusGizi === "GIZI_BURUK").length;
  const kurang = list.filter((x) => x.statusGizi === "GIZI_KURANG").length;
  const stunting = list.filter((x) => x.stunting).length;
  return {
    totalRows: total,
    summary: {
      "Total Pengukuran": total,
      "Gizi Buruk": buruk,
      "Gizi Kurang": kurang,
      "Stunting": stunting,
    },
    rows: list.slice(0, 100),
    fullRows: list,
  };
}

async function exportStatusGizi({ user, filter }) {
  const data = await previewStatusGizi({ user, filter });
  if (data.fullRows.length > MAX_ROWS) {
    const e = new Error("Data melebihi 50.000 baris");
    e.statusCode = 413;
    throw e;
  }
  return excelService.generateLaporanStatusGizi({ rows: data.fullRows, filter });
}

async function exportKinerjaSppg({ user, filter }) {
  const where = buildAccessFilter(user, { statusAktif: true });
  if (filter.provinsi) where.provinsi = filter.provinsi;

  const sppgs = await prisma.sppg.findMany({
    where,
    include: { _count: { select: { penerimaManfaat: { where: { statusAktif: true } } } } },
  });
  const since = filter.periodeAwal ? startOfDay(filter.periodeAwal) : dayjs().subtract(30, "day").startOf("day").toDate();
  const ids = sppgs.map((s) => s.id);
  const dist = await prisma.distribusiMbg.findMany({
    where: { sppgId: { in: ids }, tanggalDistribusi: { gte: since } },
    select: { sppgId: true, totalPorsi: true },
  });
  const map = new Map();
  for (const d of dist) {
    const cur = map.get(d.sppgId) || { sum: 0, n: 0 };
    cur.sum += d.totalPorsi;
    cur.n += 1;
    map.set(d.sppgId, cur);
  }
  const rows = sppgs.map((s) => {
    const c = map.get(s.id) || { sum: 0, n: 0 };
    const rata = c.n > 0 ? c.sum / c.n : 0;
    const realisasi = s.kapasitasPorsiPerHari > 0 ? (rata / s.kapasitasPorsiPerHari) * 100 : 0;
    return {
      kodeSppg: s.kodeSppg,
      namaSppg: s.namaSppg,
      provinsi: s.provinsi,
      kapasitas: s.kapasitasPorsiPerHari,
      rataRata: Math.round(rata),
      realisasiPersen: Math.round(realisasi * 100) / 100,
      penerimaAktif: s._count.penerimaManfaat,
      statusAktif: s.statusAktif,
    };
  });
  return excelService.generateLaporanKinerjaSppg({ rows, filter });
}

async function previewKinerjaSppg({ user, filter }) {
  const where = buildAccessFilter(user, { statusAktif: true });
  if (filter.provinsi) where.provinsi = filter.provinsi;

  const sppgs = await prisma.sppg.findMany({
    where,
    include: { _count: { select: { penerimaManfaat: { where: { statusAktif: true } } } } },
  });
  const since = filter.periodeAwal ? startOfDay(filter.periodeAwal) : dayjs().subtract(30, "day").startOf("day").toDate();
  const ids = sppgs.map((s) => s.id);
  const dist = await prisma.distribusiMbg.findMany({
    where: { sppgId: { in: ids }, tanggalDistribusi: { gte: since } },
    select: { sppgId: true, totalPorsi: true, catatan: true, tanggalDistribusi: true },
    orderBy: { tanggalDistribusi: "desc" },
  });
  const map = new Map();
  const latestMeta = new Map();
  for (const d of dist) {
    const cur = map.get(d.sppgId) || { sum: 0, n: 0 };
    cur.sum += d.totalPorsi;
    cur.n += 1;
    map.set(d.sppgId, cur);
    if (!latestMeta.has(d.sppgId)) latestMeta.set(d.sppgId, parseDistribusiMeta(d.catatan));
  }
  const rows = sppgs.map((s) => {
    const c = map.get(s.id) || { sum: 0, n: 0 };
    const rata = c.n > 0 ? c.sum / c.n : 0;
    const realisasi = s.kapasitasPorsiPerHari > 0 ? (rata / s.kapasitasPorsiPerHari) * 100 : 0;
    const meta = latestMeta.get(s.id) || null;
    const fallback = (!meta || !meta.menuHarian)
      ? buildSyntheticMenuSnapshotForSppg({ sppgId: s.id, date: new Date(), totalMenus: 1000 })
      : null;
    const menuHarian = meta && meta.menuHarian ? meta.menuHarian : fallback ? fallback.menuHarian : null;
    return {
      kodeSppg: s.kodeSppg,
      namaSppg: s.namaSppg,
      provinsi: s.provinsi,
      kapasitas: s.kapasitasPorsiPerHari,
      rataRata: Math.round(rata),
      realisasiPersen: Math.round(realisasi * 100) / 100,
      penerimaAktif: s._count.penerimaManfaat,
      totalMenuHariIni: menuHarian ? menuHarian.menuCount : 0,
      energiHariIni: menuHarian && menuHarian.totalNutrition ? menuHarian.totalNutrition.energyKkal : 0,
      statusAktif: s.statusAktif,
    };
  });
  return {
    totalRows: rows.length,
    summary: {
      "Total SPPG": rows.length,
      "Rata-rata Realisasi %": rows.length ? Math.round((rows.reduce((s, r) => s + (r.realisasiPersen || 0), 0) / rows.length) * 100) / 100 : 0,
      "Total Menu Hari Ini": rows.reduce((s, r) => s + (r.totalMenuHariIni || 0), 0),
    },
    rows,
  };
}

async function exportPenerima({ user, filter }) {
  const where = buildAccessFilter(user, {});
  if (filter.kategori) where.kategori = filter.kategori;
  if (filter.provinsi) where.sppg = { provinsi: filter.provinsi };

  const data = await prisma.penerimaManfaat.findMany({
    where,
    take: MAX_ROWS,
    include: { sppg: { select: { namaSppg: true, provinsi: true } } },
    orderBy: { namaLengkap: "asc" },
  });
  const rows = data.map((p) => ({
    nikMasked: p.nikMasked,
    namaLengkap: p.namaLengkap,
    tanggalLahir: p.tanggalLahir,
    jenisKelamin: p.jenisKelamin,
    kategori: p.kategori,
    sppgNama: p.sppg && p.sppg.namaSppg,
    sppgProvinsi: p.sppg && p.sppg.provinsi,
    statusAktif: p.statusAktif,
  }));
  return excelService.generateLaporanPenerima({ rows, filter });
}

async function jalankanJadwalAktif() {
  const now = dayjs();
  const jadwal = await prisma.jadwalLaporan.findMany({ where: { aktif: true } });
  for (const j of jadwal) {
    try {
      const [hh, mm] = (j.jam || "06:00").split(":");
      if (Number(hh) !== now.hour()) continue;
      if (j.frekuensi === "MINGGUAN" && Number.isFinite(j.hari) && now.day() !== j.hari) continue;
      if (j.frekuensi === "BULANAN" && Number.isFinite(j.tanggal) && now.date() !== j.tanggal) continue;
      if (j.terakhirJalan && dayjs(j.terakhirJalan).isAfter(now.subtract(20, "minute"))) continue;

      // Snapshot summary
      const filter = j.filterJson || {};
      const summary = await previewDistribusi({ user: { peran: "ADMIN" }, filter });
      const ringkas = "Total porsi: " + (summary.summary["Total Porsi"] || 0) + ", Total laporan: " + (summary.summary["Total Laporan"] || 0);
      for (const to of (j.emailTujuan || [])) {
        await kirimEmail({
          to,
          subject: "[SIPGN-BGN] Laporan Terjadwal: " + j.jenisLaporan,
          html: `<p>Ringkasan ${j.jenisLaporan} ${now.format("DD MMM YYYY")}:</p><p>${ringkas}</p>`,
          text: ringkas,
        });
      }
      await prisma.jadwalLaporan.update({ where: { id: j.id }, data: { terakhirJalan: now.toDate() } });
    } catch (e) {
      console.error("[laporan] jadwal", j.id, e.message);
    }
  }
}

module.exports = {
  previewDistribusi,
  exportDistribusi,
  previewStatusGizi,
  exportStatusGizi,
  exportKinerjaSppg,
  previewKinerjaSppg,
  exportPenerima,
  jalankanJadwalAktif,
  MAX_ROWS,
};
