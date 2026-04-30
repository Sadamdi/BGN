"use strict";

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const { prisma } = require("../config/database");
const { getRedis } = require("../config/redis");
const { hitungZScore, klasifikasiStatusGizi } = require("./zscore.service");

const JOB_LOCK_KEY = "job:dummy-nutrition-daily";
const TZ = "Asia/Jakarta";

dayjs.extend(utc);
dayjs.extend(timezone);

const MENU_FOOD_CATALOG = [
  { name: "Nasi Putih", energyKkal: 175, proteinG: 3.4, fatG: 0.4, carbsG: 39.8, fiberG: 0.3, sodiumMg: 2 },
  { name: "Nasi Merah", energyKkal: 170, proteinG: 3.8, fatG: 1.0, carbsG: 35.2, fiberG: 1.8, sodiumMg: 3 },
  { name: "Ubi Rebus", energyKkal: 111, proteinG: 1.6, fatG: 0.1, carbsG: 26.2, fiberG: 3.0, sodiumMg: 55 },
  { name: "Jagung Rebus", energyKkal: 144, proteinG: 4.1, fatG: 1.3, carbsG: 31.0, fiberG: 2.9, sodiumMg: 15 },
  { name: "Roti Gandum", energyKkal: 128, proteinG: 5.1, fatG: 2.0, carbsG: 22.1, fiberG: 3.2, sodiumMg: 215 },
  { name: "Telur Rebus", energyKkal: 78, proteinG: 6.3, fatG: 5.3, carbsG: 0.6, fiberG: 0, sodiumMg: 62 },
  { name: "Ayam Panggang", energyKkal: 165, proteinG: 31.0, fatG: 3.6, carbsG: 0, fiberG: 0, sodiumMg: 74 },
  { name: "Ikan Kembung", energyKkal: 167, proteinG: 21.4, fatG: 8.2, carbsG: 0, fiberG: 0, sodiumMg: 90 },
  { name: "Ikan Tuna", energyKkal: 145, proteinG: 23.5, fatG: 4.9, carbsG: 0, fiberG: 0, sodiumMg: 37 },
  { name: "Daging Sapi Tanpa Lemak", energyKkal: 187, proteinG: 26.0, fatG: 9.0, carbsG: 0, fiberG: 0, sodiumMg: 55 },
  { name: "Tempe Goreng Tipis", energyKkal: 150, proteinG: 12.0, fatG: 7.9, carbsG: 8.7, fiberG: 1.4, sodiumMg: 9 },
  { name: "Tahu Kukus", energyKkal: 80, proteinG: 8.0, fatG: 4.4, carbsG: 1.5, fiberG: 0.3, sodiumMg: 7 },
  { name: "Susu UHT Rendah Lemak", energyKkal: 90, proteinG: 6.0, fatG: 3.0, carbsG: 9.0, fiberG: 0, sodiumMg: 85 },
  { name: "Yogurt Plain", energyKkal: 95, proteinG: 5.2, fatG: 3.3, carbsG: 11.5, fiberG: 0, sodiumMg: 50 },
  { name: "Bayam Bening", energyKkal: 36, proteinG: 2.1, fatG: 0.5, carbsG: 6.5, fiberG: 2.2, sodiumMg: 180 },
  { name: "Sayur Asem", energyKkal: 44, proteinG: 1.5, fatG: 0.8, carbsG: 8.3, fiberG: 2.7, sodiumMg: 220 },
  { name: "Capcay", energyKkal: 71, proteinG: 3.1, fatG: 2.7, carbsG: 9.2, fiberG: 2.6, sodiumMg: 240 },
  { name: "Brokoli Kukus", energyKkal: 43, proteinG: 3.5, fatG: 0.4, carbsG: 8.3, fiberG: 3.1, sodiumMg: 35 },
  { name: "Wortel Rebus", energyKkal: 41, proteinG: 0.9, fatG: 0.2, carbsG: 9.5, fiberG: 2.7, sodiumMg: 69 },
  { name: "Buncis Tumis", energyKkal: 58, proteinG: 2.1, fatG: 2.8, carbsG: 6.9, fiberG: 2.5, sodiumMg: 165 },
  { name: "Pisang", energyKkal: 105, proteinG: 1.3, fatG: 0.4, carbsG: 27.0, fiberG: 3.1, sodiumMg: 1 },
  { name: "Pepaya", energyKkal: 55, proteinG: 0.9, fatG: 0.3, carbsG: 14.0, fiberG: 2.5, sodiumMg: 8 },
  { name: "Jeruk", energyKkal: 62, proteinG: 1.2, fatG: 0.2, carbsG: 15.4, fiberG: 3.1, sodiumMg: 0 },
  { name: "Apel", energyKkal: 80, proteinG: 0.3, fatG: 0.2, carbsG: 21.0, fiberG: 3.8, sodiumMg: 2 },
  { name: "Kacang Hijau Rebus", energyKkal: 105, proteinG: 7.0, fatG: 0.5, carbsG: 19.2, fiberG: 4.7, sodiumMg: 15 },
  { name: "Sup Ayam Kentang", energyKkal: 112, proteinG: 8.2, fatG: 4.8, carbsG: 9.5, fiberG: 1.5, sodiumMg: 320 },
  { name: "Sarden Tomat", energyKkal: 140, proteinG: 17.0, fatG: 7.0, carbsG: 2.2, fiberG: 0.3, sodiumMg: 330 },
  { name: "Perkedel Kentang", energyKkal: 126, proteinG: 2.8, fatG: 6.4, carbsG: 14.8, fiberG: 1.3, sodiumMg: 180 },
  { name: "Bakso Kuah", energyKkal: 110, proteinG: 8.8, fatG: 5.7, carbsG: 5.2, fiberG: 0.4, sodiumMg: 420 },
  { name: "Soto Ayam", energyKkal: 132, proteinG: 9.1, fatG: 6.9, carbsG: 8.1, fiberG: 0.9, sodiumMg: 460 },
  { name: "Nasi Goreng Sayur", energyKkal: 188, proteinG: 4.6, fatG: 6.2, carbsG: 28.4, fiberG: 2.3, sodiumMg: 300 },
  { name: "Bubur Kacang Hijau", energyKkal: 165, proteinG: 5.4, fatG: 3.1, carbsG: 29.0, fiberG: 2.8, sodiumMg: 62 },
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sampleWithoutReplacement(arr, count) {
  const copy = arr.slice();
  const out = [];
  const n = Math.min(count, copy.length);
  for (let i = 0; i < n; i++) {
    const idx = randInt(0, copy.length - 1);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function createMenuTemplate(index) {
  const itemCount = randInt(3, 7);
  const picked = sampleWithoutReplacement(MENU_FOOD_CATALOG, itemCount);
  const items = picked.map((item) => {
    const factor = randFloat(0.8, 1.3);
    return {
      name: item.name,
      energyKkal: round2(item.energyKkal * factor),
      proteinG: round2(item.proteinG * factor),
      fatG: round2(item.fatG * factor),
      carbsG: round2(item.carbsG * factor),
      fiberG: round2(item.fiberG * factor),
      sodiumMg: round2(item.sodiumMg * factor),
    };
  });
  const total = items.reduce(
    (acc, cur) => {
      acc.energyKkal += cur.energyKkal;
      acc.proteinG += cur.proteinG;
      acc.fatG += cur.fatG;
      acc.carbsG += cur.carbsG;
      acc.fiberG += cur.fiberG;
      acc.sodiumMg += cur.sodiumMg;
      return acc;
    },
    { energyKkal: 0, proteinG: 0, fatG: 0, carbsG: 0, fiberG: 0, sodiumMg: 0 }
  );
  return {
    code: "MENU-" + String(index + 1).padStart(4, "0"),
    title: items.map((x) => x.name).slice(0, 3).join(" + "),
    items,
    totalNutrition: {
      energyKkal: round2(total.energyKkal),
      proteinG: round2(total.proteinG),
      fatG: round2(total.fatG),
      carbsG: round2(total.carbsG),
      fiberG: round2(total.fiberG),
      sodiumMg: round2(total.sodiumMg),
    },
  };
}

function buildMenuPool(totalMenus) {
  const pool = [];
  for (let i = 0; i < totalMenus; i++) {
    pool.push(createMenuTemplate(i));
  }
  return pool;
}

function estimateAnthropometry(recipient, menu) {
  const kategori = recipient.kategori;
  if (kategori === "BALITA") {
    const usiaBulan = randInt(8, 59);
    return {
      usiaBulan,
      beratBadanKg: round2(randFloat(7.2, 18.5)),
      tinggiBadanCm: round2(randFloat(67, 112)),
      lilaCm: round2(randFloat(12.5, 17.5)),
      catatan: "Menu " + menu.code + " (" + menu.items.length + " item) diberikan sesuai porsi balita.",
    };
  }
  if (kategori === "PESERTA_DIDIK") {
    const usiaBulan = randInt(72, 216);
    return {
      usiaBulan,
      beratBadanKg: round2(randFloat(17, 60)),
      tinggiBadanCm: round2(randFloat(110, 170)),
      lilaCm: round2(randFloat(16, 27)),
      catatan: "Menu " + menu.code + " disesuaikan kebutuhan energi peserta didik.",
    };
  }
  const usiaBulan = randInt(180, 540);
  return {
    usiaBulan,
    beratBadanKg: round2(randFloat(42, 78)),
    tinggiBadanCm: round2(randFloat(145, 175)),
    lilaCm: round2(randFloat(20.5, 33)),
    catatan: "Menu " + menu.code + " dipakai untuk pemantauan kelompok ibu.",
  };
}

function chooseStatusFromMenu(menu) {
  const energy = menu.totalNutrition.energyKkal;
  if (energy < 400) return "GIZI_KURANG";
  if (energy > 950) return "GIZI_LEBIH";
  return "GIZI_BAIK";
}

async function withJobLock(fn) {
  try {
    const redis = getRedis();
    const lockValue = String(Date.now());
    const ok = await redis.set(JOB_LOCK_KEY, lockValue, "NX", "EX", 60 * 20);
    if (!ok) return { success: true, skipped: true, message: "Generator dummy sedang berjalan." };
    try {
      return await fn();
    } finally {
      try {
        const cur = await redis.get(JOB_LOCK_KEY);
        if (cur === lockValue) await redis.del(JOB_LOCK_KEY);
      } catch (_) {}
    }
  } catch (_) {
    // Fallback local/no-redis: tetap jalankan agar ingest tidak terblokir.
    return fn();
  }
}

async function runDailyDummyNutrition(options = {}) {
  const trigger = options.trigger || "cron";
  const totalRecords = Math.max(50, Math.min(5000, Number(options.totalRecords) || 1000));
  const now = dayjs().tz(TZ);
  const runDate = now.startOf("day").toDate();
  const generatedAt = now.toDate();
  const menuPool = buildMenuPool(totalRecords);

  return withJobLock(async () => {
    const [sppgs, recipients, operators, fallbackPetugas] = await Promise.all([
      prisma.sppg.findMany({
        where: { statusAktif: true },
        select: { id: true, namaSppg: true, kapasitasPorsiPerHari: true },
      }),
      prisma.penerimaManfaat.findMany({
        where: { statusAktif: true, sppg: { statusAktif: true } },
        select: { id: true, sppgId: true, kategori: true, jenisKelamin: true },
      }),
      prisma.pengguna.findMany({
        where: { statusAktif: true, peran: "OPERATOR_SPPG", sppgId: { not: null } },
        select: { id: true, sppgId: true },
      }),
      prisma.pengguna.findFirst({
        where: {
          statusAktif: true,
          peran: { in: ["ADMIN", "PENGAWAS_GIZI", "PEJABAT_BGN"] },
        },
        select: { id: true },
      }),
    ]);

    if (!sppgs.length || !recipients.length) {
      return { success: false, message: "Data SPPG/penerima belum tersedia.", trigger };
    }

    const operatorBySppg = new Map(operators.map((o) => [o.sppgId, o.id]));
    const fallbackPetugasId = fallbackPetugas ? fallbackPetugas.id : null;
    if (!fallbackPetugasId && !operatorBySppg.size) {
      return { success: false, message: "Tidak ada petugas aktif untuk membuat data dummy.", trigger };
    }

    const recipientBySppg = new Map();
    for (const rec of recipients) {
      const arr = recipientBySppg.get(rec.sppgId) || [];
      arr.push(rec);
      recipientBySppg.set(rec.sppgId, arr);
    }

    const sppgPool = sppgs.filter((s) => (recipientBySppg.get(s.id) || []).length > 0);
    const pemantauanRows = [];
    const distribusiAgg = new Map();

    for (let i = 0; i < totalRecords; i++) {
      const sppg = sppgPool[randInt(0, sppgPool.length - 1)];
      const recPool = recipientBySppg.get(sppg.id);
      const recipient = recPool[randInt(0, recPool.length - 1)];
      const menu = menuPool[i];

      const anthropo = estimateAnthropometry(recipient, menu);
      const z = hitungZScore({
        beratBadanKg: anthropo.beratBadanKg,
        tinggiBadanCm: anthropo.tinggiBadanCm,
        usiaBulan: anthropo.usiaBulan,
        jenisKelamin: recipient.jenisKelamin,
      });
      const klas = klasifikasiStatusGizi(z);
      const preferred = chooseStatusFromMenu(menu);
      const statusGizi = klas.statusGizi === "GIZI_BAIK" ? preferred : klas.statusGizi;

      const petugasId = operatorBySppg.get(sppg.id) || fallbackPetugasId;
      pemantauanRows.push({
        penerimaId: recipient.id,
        tanggalPengukuran: runDate,
        beratBadanKg: anthropo.beratBadanKg,
        tinggiBadanCm: anthropo.tinggiBadanCm,
        lilaCm: anthropo.lilaCm,
        usiaBulan: anthropo.usiaBulan,
        zscoreBbU: z.zscoreBbU,
        zscoreTbU: z.zscoreTbU,
        zscoreBbTb: z.zscoreBbTb,
        statusGizi,
        stunting: klas.stunting,
        petugasId,
        catatan:
          anthropo.catatan +
          " Nutrisi total: " +
          JSON.stringify(menu.totalNutrition) +
          ". Menu: " +
          menu.items.map((x) => x.name).join(", "),
      });

      const agg = distribusiAgg.get(sppg.id) || {
        sppg,
        porsiPesertaDidik: 0,
        porsiBalita: 0,
        porsiIbuHamil: 0,
        porsiIbuMenyusui: 0,
        menuSamples: [],
        totalEnergy: 0,
      };
      if (recipient.kategori === "PESERTA_DIDIK") agg.porsiPesertaDidik += 1;
      else if (recipient.kategori === "BALITA") agg.porsiBalita += 1;
      else if (recipient.kategori === "IBU_HAMIL") agg.porsiIbuHamil += 1;
      else agg.porsiIbuMenyusui += 1;
      agg.totalEnergy += menu.totalNutrition.energyKkal;
      if (agg.menuSamples.length < 7) agg.menuSamples.push(menu);
      distribusiAgg.set(sppg.id, agg);
    }

    const upsertDistribusi = [];
    for (const [sppgId, agg] of distribusiAgg.entries()) {
      const totalPorsi =
        agg.porsiPesertaDidik +
        agg.porsiBalita +
        agg.porsiIbuHamil +
        agg.porsiIbuMenyusui;
      const kapasitas = Math.max(1, agg.sppg.kapasitasPorsiPerHari || 1);
      const realisasiPersen = round2((totalPorsi / kapasitas) * 100);
      upsertDistribusi.push(
        prisma.distribusiMbg.upsert({
          where: {
            sppgId_tanggalDistribusi: {
              sppgId,
              tanggalDistribusi: runDate,
            },
          },
          update: {
            porsiPesertaDidik: agg.porsiPesertaDidik,
            porsiBalita: agg.porsiBalita,
            porsiIbuHamil: agg.porsiIbuHamil,
            porsiIbuMenyusui: agg.porsiIbuMenyusui,
            totalPorsi,
            status: "TERVALIDASI",
            catatan: JSON.stringify({
              source: "dummy-nutrition-generator",
              generatedAt: generatedAt.toISOString(),
              realisasiPersen,
              totalMenuGenerated: totalRecords,
              menuHarianSampel: agg.menuSamples.map((m) => ({
                code: m.code,
                title: m.title,
                itemCount: m.items.length,
                totalNutrition: m.totalNutrition,
              })),
              averageEnergyPerPortion: round2(agg.totalEnergy / Math.max(1, totalPorsi)),
            }),
          },
          create: {
            sppgId,
            tanggalDistribusi: runDate,
            porsiPesertaDidik: agg.porsiPesertaDidik,
            porsiBalita: agg.porsiBalita,
            porsiIbuHamil: agg.porsiIbuHamil,
            porsiIbuMenyusui: agg.porsiIbuMenyusui,
            totalPorsi,
            status: "TERVALIDASI",
            operatorId: operatorBySppg.get(sppgId) || fallbackPetugasId,
            validatorId: fallbackPetugasId,
            catatan: JSON.stringify({
              source: "dummy-nutrition-generator",
              generatedAt: generatedAt.toISOString(),
              realisasiPersen,
              totalMenuGenerated: totalRecords,
              menuHarianSampel: agg.menuSamples.map((m) => ({
                code: m.code,
                title: m.title,
                itemCount: m.items.length,
                totalNutrition: m.totalNutrition,
              })),
              averageEnergyPerPortion: round2(agg.totalEnergy / Math.max(1, totalPorsi)),
            }),
          },
        })
      );
    }

    await prisma.$transaction(upsertDistribusi, { timeout: 60_000 });

    for (const part of chunk(pemantauanRows, 200)) {
      await prisma.pemantauanGizi.createMany({ data: part });
    }

    await prisma.ingestBatch.create({
      data: {
        source: "dummy_nutrition_generator",
        fetchedAt: generatedAt,
        generatedAt,
        timezone: TZ,
        qualityFlag: "OK",
        isFallback: false,
        totalRecords: pemantauanRows.length,
        notes:
          "Generator dummy harian: " +
          totalRecords +
          " menu acak (3-7 item) + pemantauan gizi, disebar ke SPPG aktif.",
      },
    });

    return {
      success: true,
      trigger,
      generatedAt: generatedAt.toISOString(),
      totalMenuPool: menuPool.length,
      totalPemantauanInserted: pemantauanRows.length,
      totalSppgUpdated: distribusiAgg.size,
    };
  });
}

module.exports = { runDailyDummyNutrition };
