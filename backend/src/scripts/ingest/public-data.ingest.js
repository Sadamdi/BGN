"use strict";

require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const { prisma } = require("../../config/database");

const SOURCES = [
  {
    slug: "satu_data_stunting",
    nama: "Satu Data - Stunting",
    lisensi: "Open Data Pemerintah",
    urlSumber: process.env.PUBLIC_STUNTING_URL || "https://data.go.id/dataset/kasus-stunting",
    fallbackFile: "mbg_stunting_sample.json",
  },
  {
    slug: "bps_kemiskinan",
    nama: "BPS - Kemiskinan",
    lisensi: "Open Data BPS",
    urlSumber: process.env.PUBLIC_BPS_URL || "https://webapi.bps.go.id/",
    fallbackFile: "mbg_kemiskinan_sample.json",
  },
  {
    slug: "kemdikbud_sekolah",
    nama: "Pusdatin Kemdikbud - Sekolah",
    lisensi: "Open Government Data",
    urlSumber: process.env.PUBLIC_SCHOOL_URL || "https://api.pusdatin.kemdikbudristek.com/referensi/",
    fallbackFile: "mbg_sekolah_sample.json",
  },
  {
    slug: "big_wilayah",
    nama: "BIG/BPS - Wilayah",
    lisensi: "Open Geospatial",
    urlSumber: process.env.PUBLIC_GEO_URL || "https://www.big.go.id/",
    fallbackFile: "mbg_wilayah_sample.json",
  },
  {
    slug: "pihps_harga_pangan",
    nama: "PIHPS - Harga Pangan",
    lisensi: "Open Data BI",
    urlSumber: process.env.PUBLIC_PIHPS_URL || "https://www.bi.go.id/hargapangan/",
    fallbackFile: "mbg_pangan_sample.json",
  },
];

async function readFallback(fileName) {
  const abs = path.join(__dirname, "..", "..", "data", "public", fileName);
  const raw = await fs.readFile(abs, "utf8");
  return JSON.parse(raw);
}

async function fetchRemoteOrFallback(source) {
  const explicitUrl = process.env[(source.slug + "_JSON_URL").toUpperCase()];
  const finalUrl = explicitUrl || null;
  if (finalUrl) {
    try {
      const response = await fetch(finalUrl, { method: "GET" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      if (Array.isArray(data)) return { rows: data, isFallback: false };
      if (Array.isArray(data.data)) return { rows: data.data, isFallback: false };
      throw new Error("Format data tidak valid");
    } catch (err) {
      console.warn("[ingest] fallback " + source.slug + " karena fetch gagal:", err.message);
    }
  }
  return { rows: await readFallback(source.fallbackFile), isFallback: true };
}

async function scrapeBgnValidationBestEffort() {
  const targetUrl = process.env.BGN_VALIDATION_URL || "https://validasidata.bgn.go.id";
  try {
    const response = await fetch(targetUrl, { method: "GET" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const html = await response.text();
    const matches = html.match(/\d{3,}/g) || [];
    const largest = matches
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x))
      .sort((a, b) => b - a)[0];
    if (!largest) throw new Error("angka tidak ditemukan di halaman");
    const tahun = new Date().getFullYear();
    return [
      {
        kodeWilayah: "IDN",
        namaWilayah: "Indonesia",
        levelWilayah: "NASIONAL",
        tahun,
        kategori: "PROGRAM_MBG",
        indikator: "TOTAL_PENERIMA_VALIDASI_BGN",
        nilai: largest,
        satuan: "ORANG",
        metadata: {
          scrapedFrom: targetUrl,
          mode: "best_effort",
        },
      },
    ];
  } catch (err) {
    console.warn("[ingest] scraping bgn gagal:", err.message);
    return [];
  }
}

async function upsertSource(source) {
  return prisma.sumberDataPublik.upsert({
    where: { slug: source.slug },
    update: {
      nama: source.nama,
      lisensi: source.lisensi,
      urlSumber: source.urlSumber,
      terakhirSyncAt: new Date(),
    },
    create: {
      slug: source.slug,
      nama: source.nama,
      lisensi: source.lisensi,
      urlSumber: source.urlSumber,
      terakhirSyncAt: new Date(),
    },
  });
}

async function ingestOne(source) {
  const sourceRecord = await upsertSource(source);
  const now = new Date();
  const fetchResult = await fetchRemoteOrFallback(source);
  const records = fetchResult.rows;
  const normalized = records
    .filter((r) => r && r.kodeWilayah && r.indikator && Number.isFinite(Number(r.nilai)))
    .map((r) => ({
      sumberId: sourceRecord.id,
      kodeWilayah: String(r.kodeWilayah),
      namaWilayah: String(r.namaWilayah || "Unknown"),
      levelWilayah: String(r.levelWilayah || "UNKNOWN"),
      tahun: Number(r.tahun || new Date().getFullYear()),
      kategori: String(r.kategori || "LAINNYA"),
      indikator: String(r.indikator),
      nilai: Number(r.nilai),
      satuan: r.satuan ? String(r.satuan) : null,
      metadata: {
        ...(r.metadata || {}),
        source: source.slug,
        fetchedAt: now.toISOString(),
        generatedAt: now.toISOString(),
        timezone: "Asia/Jakarta",
        qualityFlag: "OK",
        isFallback: fetchResult.isFallback,
      },
    }));

  await prisma.indikatorPublik.deleteMany({
    where: { sumberId: sourceRecord.id },
  });
  if (normalized.length > 0) {
    await prisma.indikatorPublik.createMany({
      data: normalized,
    });
  }
  await prisma.ingestBatch.create({
    data: {
      source: source.slug,
      fetchedAt: new Date(),
      generatedAt: new Date(),
      timezone: "Asia/Jakarta",
      qualityFlag: normalized.length > 0 ? "OK" : "EMPTY",
      isFallback: fetchResult.isFallback,
      totalRecords: normalized.length,
      notes: "Ingest publik per source",
    },
  });
  return { slug: source.slug, count: normalized.length };
}

async function main() {
  const results = [];
  for (const source of SOURCES) {
    const r = await ingestOne(source);
    results.push(r);
    console.log("[ingest]", source.slug, "=", r.count, "baris");
  }
  const bgnRows = await scrapeBgnValidationBestEffort();
  if (bgnRows.length > 0) {
    const source = await upsertSource({
      slug: "bgn_validation_scrape",
      nama: "BGN Validation Scrape",
      lisensi: "Best Effort Public Web",
      urlSumber: process.env.BGN_VALIDATION_URL || "https://validasidata.bgn.go.id",
    });
    await prisma.indikatorPublik.deleteMany({ where: { sumberId: source.id, indikator: "TOTAL_PENERIMA_VALIDASI_BGN" } });
    await prisma.indikatorPublik.createMany({
      data: bgnRows.map((r) => ({
        sumberId: source.id,
        kodeWilayah: r.kodeWilayah,
        namaWilayah: r.namaWilayah,
        levelWilayah: r.levelWilayah,
        tahun: r.tahun,
        kategori: r.kategori,
        indikator: r.indikator,
        nilai: Number(r.nilai),
        satuan: r.satuan,
        metadata: r.metadata,
      })),
    });
    results.push({ slug: "bgn_validation_scrape", count: bgnRows.length });
  }
  const total = results.reduce((sum, r) => sum + r.count, 0);
  console.log("[ingest] total indikator publik:", total);
}

main()
  .catch((err) => {
    console.error("[ingest] gagal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
