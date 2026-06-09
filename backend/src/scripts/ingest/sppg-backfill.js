"use strict";

// Backfill script untuk SPPG hasil BGN scrape yang masih punya:
//   - kapasitasPorsiPerHari = 1 (placeholder)
//   - penerimaAktif = 0 (tidak ada row penerima_manfaat)
//
// Tujuan: bikin data lintas-page (dashboard / SPPG list / laporan) konsisten dan realistis
// setelah deploy. Aman di-rerun (idempotent via upsert by nikHash+sppgId).

require("dotenv").config({ path: require("path").resolve(__dirname, "../../../../.env.local") });
require("dotenv").config();

const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const { generateNamaPenerima } = require("../../services/namaGenerator");

const prisma = new PrismaClient();

const ENC_KEY_RAW = process.env.DATA_ENCRYPTION_KEY || "please-change-this-32-byte-aes-key!!";
const ENC_KEY = crypto.createHash("sha256").update(ENC_KEY_RAW).digest();

function encryptText(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}
function hashNik(nik) {
  return crypto.createHmac("sha256", ENC_KEY).update(String(nik)).digest("hex");
}
function maskNik(nik) {
  const s = String(nik);
  if (s.length < 8) return s;
  return s.slice(0, 4) + "********" + s.slice(-4);
}

// Seeded random capacity 200-5000 dari sppgId (deterministic per SPPG).
function fnv1a(text) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h = (h ^ text.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
function capacityFor(sppgId) {
  const h = fnv1a(sppgId + "|cap");
  const range = 4800;
  const min = 200;
  return min + (h % range);
}

// Generate NIK 16 digit deterministic dari seed numerik.
function generateNik(seedNum) {
  const provCode = String(11 + (seedNum % 30)).padStart(2, "0");
  const kabCode = String(1 + Math.floor(seedNum / 30) % 70).padStart(2, "0");
  const kecCode = String(1 + Math.floor(seedNum / 2100) % 40).padStart(2, "0");
  const tgl = String(1 + Math.floor(seedNum / 84000) % 28).padStart(2, "0");
  const bln = String(1 + Math.floor(seedNum / 2352000) % 12).padStart(2, "0");
  const thn = String(2010 + Math.floor(seedNum / 28224000) % 15).slice(-2);
  const urut = String(1 + (seedNum % 10000)).padStart(4, "0");
  return provCode + kabCode + kecCode + tgl + bln + thn + urut;
}

const KATEGORI = ["PESERTA_DIDIK", "BALITA", "IBU_HAMIL", "IBU_MENYUSUI"];
// Proporsi target per kategori: 55 / 25 / 10 / 10.
const KAT_WEIGHTS = [
  { key: "PESERTA_DIDIK", weight: 55 },
  { key: "BALITA", weight: 25 },
  { key: "IBU_HAMIL", weight: 10 },
  { key: "IBU_MENYUSUI", weight: 10 },
];
const KAT_TOTAL = KAT_WEIGHTS.reduce((s, k) => s + k.weight, 0);

function pickKategori(idx) {
  // Largest-remainder style: deterministic per index.
  const r = (idx % KAT_TOTAL) / KAT_TOTAL;
  let acc = 0;
  for (const k of KAT_WEIGHTS) {
    acc += k.weight / KAT_TOTAL;
    if (r < acc) return k.key;
  }
  return "PESERTA_DIDIK";
}

function pickJenisKelamin(kategori, idx) {
  if (kategori === "IBU_HAMIL" || kategori === "IBU_MENYUSUI") return "PEREMPUAN";
  return idx % 2 === 0 ? "LAKI_LAKI" : "PEREMPUAN";
}

function tanggalLahirFor(kategori, idx) {
  const d = new Date();
  if (kategori === "BALITA") d.setMonth(d.getMonth() - (6 + (idx % 50)));
  else if (kategori === "PESERTA_DIDIK") d.setFullYear(d.getFullYear() - (7 + (idx % 12)));
  else d.setFullYear(d.getFullYear() - (20 + (idx % 18)));
  return d;
}

function pickPenerimaCount(sppgId) {
  // 30-100 penerima per SPPG (deterministic).
  const h = fnv1a(sppgId + "|n");
  return 30 + (h % 71);
}

async function backfillKapasitas(sppgs) {
  let updated = 0;
  for (const s of sppgs) {
    if (!s.kapasitasPorsiPerHari || s.kapasitasPorsiPerHari <= 1) {
      const cap = capacityFor(s.id);
      await prisma.sppg.update({ where: { id: s.id }, data: { kapasitasPorsiPerHari: cap } });
      updated += 1;
    }
  }
  return updated;
}

async function backfillPenerimaForSppg(sppg) {
  const existing = await prisma.penerimaManfaat.count({ where: { sppgId: sppg.id } });
  const target = pickPenerimaCount(sppg.id);
  if (existing >= target) return 0;
  const need = target - existing;
  let inserted = 0;
  for (let i = 0; i < need; i++) {
    const idx = existing + i;
    const kategori = pickKategori(idx);
    const jenisKelamin = pickJenisKelamin(kategori, idx);
    // NIK seed = fnv(sppgId) ^ idx -> unik per SPPG + per penerima
    const seedNik = fnv1a(sppg.id + "|nik|" + idx);
    const nik = generateNik(seedNik);
    const namaLengkap = generateNamaPenerima("penerima-" + sppg.id + "-" + idx, jenisKelamin);
    const tglLahir = tanggalLahirFor(kategori, idx);
    try {
      await prisma.penerimaManfaat.create({
        data: {
          nikEnc: encryptText(nik),
          nikHash: hashNik(nik),
          nikMasked: maskNik(nik),
          namaLengkap: namaLengkap,
          tanggalLahir: tglLahir,
          jenisKelamin: jenisKelamin,
          kategori: kategori,
          satuanPendidikan: kategori === "PESERTA_DIDIK" ? "SDN " + (idx % 12 + 1) + " " + sppg.kabupatenKota : null,
          sppgId: sppg.id,
        },
      });
      inserted += 1;
    } catch (e) {
      if (e.code !== "P2002") throw e;
    }
  }
  return inserted;
}

async function main() {
  console.log("[sppg-backfill] mulai...");
  const sppgs = await prisma.sppg.findMany({
    where: { statusAktif: true },
    select: { id: true, kodeSppg: true, namaSppg: true, kabupatenKota: true, kapasitasPorsiPerHari: true },
  });
  console.log("[sppg-backfill] total SPPG aktif:", sppgs.length);

  // Step 1: kapasitas realistis
  const updatedKapasitas = await backfillKapasitas(sppgs);
  console.log("[sppg-backfill] kapasitas diupdate:", updatedKapasitas);

  // Step 2: penerima per SPPG
  let totalPenerima = 0;
  for (const s of sppgs) {
    const inserted = await backfillPenerimaForSppg(s);
    if (inserted > 0) {
      totalPenerima += inserted;
      if (totalPenerima % 500 === 0) {
        console.log(`[sppg-backfill] inserted ${totalPenerima} penerima...`);
      }
    }
  }
  console.log("[sppg-backfill] total penerima terinsert:", totalPenerima);

  await prisma.ingestBatch.create({
    data: {
      source: "sppg_backfill",
      fetchedAt: new Date(),
      generatedAt: new Date(),
      timezone: "Asia/Jakarta",
      qualityFlag: "OK",
      isFallback: false,
      totalRecords: totalPenerima,
      notes: "Backfill kapasitas realistis (200-5000) dan " + totalPenerima + " penerima dummy ke " + sppgs.length + " SPPG.",
    },
  });
  console.log("[sppg-backfill] selesai.");
}

main()
  .catch((err) => {
    console.error("[sppg-backfill] gagal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
