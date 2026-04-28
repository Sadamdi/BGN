"use strict";

const dayjs = require("dayjs");
const { prisma } = require("../config/database");
const { sukses } = require("../utils/response");
const { buildSppgFilter } = require("../middleware/rbac");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const { catatAudit } = require("../middleware/auditTrail");
const { invalidatePrefix } = require("../services/cache.service");
const { HttpError } = require("../middleware/errorHandler");
const { sanitizeString } = require("../utils/sanitize");
const { startOfDay } = require("../utils/dateRange");

function applyAccessFilter(where, user) {
  const f = buildSppgFilter(user);
  if (f.sppgId) return { ...where, id: f.sppgId };
  if (f.sppg) return { ...where, ...f.sppg };
  return where;
}

async function listSppg(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const where = {};
    if (req.query.search) {
      where.OR = [
        { namaSppg: { contains: req.query.search, mode: "insensitive" } },
        { kodeSppg: { contains: req.query.search, mode: "insensitive" } },
        { kabupatenKota: { contains: req.query.search, mode: "insensitive" } },
      ];
    }
    if (req.query.provinsi) where.provinsi = req.query.provinsi;
    if (req.query.statusAktif === "true") where.statusAktif = true;
    if (req.query.statusAktif === "false") where.statusAktif = false;

    const finalWhere = applyAccessFilter(where, req.user);

    const [sppgs, total] = await Promise.all([
      prisma.sppg.findMany({
        where: finalWhere,
        skip,
        take: limit,
        orderBy: { namaSppg: "asc" },
        include: {
          _count: { select: { penerimaManfaat: { where: { statusAktif: true } } } },
        },
      }),
      prisma.sppg.count({ where: finalWhere }),
    ]);

    const yest = startOfDay(dayjs().subtract(1, "day").toDate());
    const ids = sppgs.map((s) => s.id);
    const dist = await prisma.distribusiMbg.findMany({
      where: { sppgId: { in: ids }, tanggalDistribusi: yest },
      select: { sppgId: true, totalPorsi: true },
    });
    const distMap = new Map(dist.map((d) => [d.sppgId, d.totalPorsi]));

    const items = sppgs.map((s) => ({
      ...s,
      latitude: s.latitude ? Number(s.latitude) : null,
      longitude: s.longitude ? Number(s.longitude) : null,
      jumlahPenerima: s._count.penerimaManfaat,
      distribusiTerkini: distMap.get(s.id) || 0,
      _count: undefined,
    }));

    return sukses(res, items, "OK", 200, { pagination: buildPaginationMeta({ total, page, limit }) });
  } catch (err) {
    next(err);
  }
}

async function detailSppg(req, res, next) {
  try {
    const id = req.params.id;
    const sppg = await prisma.sppg.findUnique({
      where: { id },
      include: {
        pengguna: {
          where: { peran: { in: ["OPERATOR_SPPG", "ASISTEN_LAPANGAN"] } },
          select: { id: true, namaLengkap: true, peran: true, statusAktif: true },
        },
      },
    });
    if (!sppg) throw new HttpError(404, "SPPG tidak ditemukan", "NOT_FOUND");

    const since = dayjs().subtract(30, "day").startOf("day").toDate();
    const dist30 = await prisma.distribusiMbg.findMany({
      where: { sppgId: id, tanggalDistribusi: { gte: since } },
      select: { tanggalDistribusi: true, totalPorsi: true },
      orderBy: { tanggalDistribusi: "asc" },
    });

    const totalPorsi = dist30.reduce((s, d) => s + d.totalPorsi, 0);
    const rataRata = dist30.length ? totalPorsi / dist30.length : 0;
    const persentaseRealisasi = sppg.kapasitasPorsiPerHari > 0
      ? (rataRata / sppg.kapasitasPorsiPerHari) * 100
      : 0;

    const dist7 = dist30.slice(-7).map((d) => ({
      tanggal: dayjs(d.tanggalDistribusi).format("YYYY-MM-DD"),
      totalPorsi: d.totalPorsi,
    }));

    const jumlahPenerima = await prisma.penerimaManfaat.count({
      where: { sppgId: id, statusAktif: true },
    });

    return sukses(res, {
      ...sppg,
      latitude: sppg.latitude ? Number(sppg.latitude) : null,
      longitude: sppg.longitude ? Number(sppg.longitude) : null,
      statistik: {
        rataRataDistribusi30Hari: Math.round(rataRata),
        persentaseRealisasi30Hari: Math.round(persentaseRealisasi * 100) / 100,
        jumlahPenerimaAktif: jumlahPenerima,
        distribusi7HariTerakhir: dist7,
      },
      operator: sppg.pengguna,
      pengguna: undefined,
    });
  } catch (err) {
    next(err);
  }
}

function validateSppgInput(body) {
  const errs = {};
  const required = ["kodeSppg", "namaSppg", "alamat", "provinsi", "kabupatenKota", "kapasitasPorsiPerHari"];
  for (const f of required) {
    if (!body[f] && body[f] !== 0) errs[f] = "Wajib diisi";
  }
  if (body.kodeSppg && !/^[A-Za-z0-9-]{5,20}$/.test(body.kodeSppg)) {
    errs.kodeSppg = "Kode SPPG 5-20 karakter alfanumerik (boleh strip)";
  }
  if (body.namaSppg && (body.namaSppg.length < 3 || body.namaSppg.length > 200)) {
    errs.namaSppg = "Nama SPPG 3-200 karakter";
  }
  if (body.kapasitasPorsiPerHari !== undefined) {
    const n = Number(body.kapasitasPorsiPerHari);
    if (!Number.isFinite(n) || n <= 0) errs.kapasitasPorsiPerHari = "Kapasitas harus angka > 0";
  }
  if (body.latitude !== undefined && body.latitude !== null && body.latitude !== "") {
    const n = Number(body.latitude);
    if (!Number.isFinite(n) || n < -11 || n > 6) errs.latitude = "Latitude harus dalam rentang Indonesia (-11 s.d. 6)";
  }
  if (body.longitude !== undefined && body.longitude !== null && body.longitude !== "") {
    const n = Number(body.longitude);
    if (!Number.isFinite(n) || n < 95 || n > 141) errs.longitude = "Longitude harus dalam rentang Indonesia (95 s.d. 141)";
  }
  return Object.keys(errs).length ? errs : null;
}

async function buatSppg(req, res, next) {
  try {
    const errs = validateSppgInput(req.body);
    if (errs) return res.status(422).json({ success: false, message: "Validasi gagal", code: "VALIDATION_ERROR", fields: errs });

    const created = await prisma.sppg.create({
      data: {
        kodeSppg: sanitizeString(req.body.kodeSppg, { maxLength: 20 }),
        namaSppg: sanitizeString(req.body.namaSppg, { maxLength: 200 }),
        alamat: sanitizeString(req.body.alamat, { maxLength: 500 }),
        latitude: req.body.latitude !== undefined && req.body.latitude !== "" ? Number(req.body.latitude) : null,
        longitude: req.body.longitude !== undefined && req.body.longitude !== "" ? Number(req.body.longitude) : null,
        provinsi: sanitizeString(req.body.provinsi, { maxLength: 100 }),
        kabupatenKota: sanitizeString(req.body.kabupatenKota, { maxLength: 100 }),
        kecamatan: sanitizeString(req.body.kecamatan, { maxLength: 100 }) || null,
        kapasitasPorsiPerHari: Math.round(Number(req.body.kapasitasPorsiPerHari)),
        mitraPengelola: sanitizeString(req.body.mitraPengelola, { maxLength: 150 }) || null,
        kontakPenanggungJawab: sanitizeString(req.body.kontakPenanggungJawab, { maxLength: 150 }) || null,
        telepon: sanitizeString(req.body.telepon, { maxLength: 20 }) || null,
      },
    });

    await catatAudit({ tabel: "sppg", recordId: created.id, aksi: "CREATE", dataBaru: created, req });
    invalidatePrefix("dashboard:");
    return sukses(res, created, "SPPG ditambahkan", 201);
  } catch (err) {
    next(err);
  }
}

async function updateSppg(req, res, next) {
  try {
    const id = req.params.id;
    const existing = await prisma.sppg.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "SPPG tidak ditemukan", "NOT_FOUND");

    const errs = validateSppgInput({ ...existing, ...req.body });
    if (errs) return res.status(422).json({ success: false, message: "Validasi gagal", code: "VALIDATION_ERROR", fields: errs });

    const updated = await prisma.sppg.update({
      where: { id },
      data: {
        kodeSppg: req.body.kodeSppg ? sanitizeString(req.body.kodeSppg, { maxLength: 20 }) : undefined,
        namaSppg: req.body.namaSppg ? sanitizeString(req.body.namaSppg, { maxLength: 200 }) : undefined,
        alamat: req.body.alamat ? sanitizeString(req.body.alamat, { maxLength: 500 }) : undefined,
        latitude: req.body.latitude !== undefined ? (req.body.latitude === "" ? null : Number(req.body.latitude)) : undefined,
        longitude: req.body.longitude !== undefined ? (req.body.longitude === "" ? null : Number(req.body.longitude)) : undefined,
        provinsi: req.body.provinsi ? sanitizeString(req.body.provinsi, { maxLength: 100 }) : undefined,
        kabupatenKota: req.body.kabupatenKota ? sanitizeString(req.body.kabupatenKota, { maxLength: 100 }) : undefined,
        kecamatan: req.body.kecamatan !== undefined ? sanitizeString(req.body.kecamatan, { maxLength: 100 }) : undefined,
        kapasitasPorsiPerHari: req.body.kapasitasPorsiPerHari !== undefined ? Math.round(Number(req.body.kapasitasPorsiPerHari)) : undefined,
        mitraPengelola: req.body.mitraPengelola !== undefined ? sanitizeString(req.body.mitraPengelola, { maxLength: 150 }) : undefined,
        kontakPenanggungJawab: req.body.kontakPenanggungJawab !== undefined ? sanitizeString(req.body.kontakPenanggungJawab, { maxLength: 150 }) : undefined,
        telepon: req.body.telepon !== undefined ? sanitizeString(req.body.telepon, { maxLength: 20 }) : undefined,
      },
    });

    await catatAudit({ tabel: "sppg", recordId: id, aksi: "UPDATE", dataLama: existing, dataBaru: updated, req });
    invalidatePrefix("dashboard:");
    return sukses(res, updated, "SPPG diperbarui");
  } catch (err) {
    next(err);
  }
}

async function toggleStatusSppg(req, res, next) {
  try {
    const id = req.params.id;
    const existing = await prisma.sppg.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "SPPG tidak ditemukan", "NOT_FOUND");

    const akan = !existing.statusAktif;
    let warning = null;
    if (!akan) {
      const today = startOfDay(new Date());
      const dist = await prisma.distribusiMbg.findFirst({
        where: { sppgId: id, tanggalDistribusi: today },
      });
      if (dist) warning = "SPPG masih memiliki distribusi aktif hari ini.";
    }

    const updated = await prisma.sppg.update({ where: { id }, data: { statusAktif: akan } });
    await catatAudit({ tabel: "sppg", recordId: id, aksi: "UPDATE", dataLama: { statusAktif: existing.statusAktif }, dataBaru: { statusAktif: akan }, req });
    invalidatePrefix("dashboard:");
    return sukses(res, { id: updated.id, statusAktif: updated.statusAktif, warning }, "Status diperbarui");
  } catch (err) {
    next(err);
  }
}

async function exportGeoJSON(req, res, next) {
  try {
    const sppgs = await prisma.sppg.findMany({
      where: applyAccessFilter({ statusAktif: true }, req.user),
      include: { _count: { select: { penerimaManfaat: { where: { statusAktif: true } } } } },
    });
    const features = sppgs
      .filter((s) => s.latitude && s.longitude)
      .map((s) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [Number(s.longitude), Number(s.latitude)] },
        properties: {
          id: s.id,
          kodeSppg: s.kodeSppg,
          nama: s.namaSppg,
          provinsi: s.provinsi,
          kabupatenKota: s.kabupatenKota,
          kapasitas: s.kapasitasPorsiPerHari,
          jumlahPenerima: s._count.penerimaManfaat,
          statusAktif: s.statusAktif,
        },
      }));
    return res.json({ type: "FeatureCollection", features });
  } catch (err) {
    next(err);
  }
}

async function provinsiList(req, res, next) {
  try {
    const grouped = await prisma.sppg.groupBy({
      by: ["provinsi"],
      _count: { id: true },
      where: applyAccessFilter({ statusAktif: true }, req.user),
      orderBy: { provinsi: "asc" },
    });
    return sukses(res, grouped.map((g) => ({ provinsi: g.provinsi, jumlah: g._count.id })));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listSppg,
  detailSppg,
  buatSppg,
  updateSppg,
  toggleStatusSppg,
  exportGeoJSON,
  provinsiList,
};
