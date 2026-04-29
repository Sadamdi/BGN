"use strict";

const crypto = require("crypto");
const { prisma } = require("../config/database");
const { getRedis } = require("../config/redis");

const SOURCE_SPPG_SLUG = "bgn_operasional_sppg_scrape";
const SOURCE_DOMAIN_SLUG = "merahputih_domains_mbg_scrape";
const LOCK_KEY = "job:sync:bgn-scrape";
const LOCK_TTL_SEC = 55 * 60;

function stripTags(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function cleanText(text) {
  return decodeHtmlEntities(stripTags(text)).replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function makeHash(input, size = 8) {
  return crypto.createHash("sha1").update(String(input || "")).digest("hex").slice(0, size).toUpperCase();
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      // Beberapa situs memblokir request tanpa user-agent yang "wajar".
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SIPGN-BGN Bot/1.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseSppgOperasional(html) {
  const rows = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html))) {
    const rawRow = rowMatch[1];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells = [];
    let c;
    while ((c = cellRegex.exec(rawRow))) {
      cells.push(cleanText(c[1]));
    }
    if (cells.length < 7) continue;
    if (normalizeKey(cells[0]) === "no") continue;
    const entry = {
      no: Number(String(cells[0]).replace(/[^\d]/g, "")) || null,
      provinsi: cells[1] || "",
      kabupatenKota: cells[2] || "",
      kecamatan: cells[3] || "",
      kelurahanDesa: cells[4] || "",
      alamat: cells[5] || "",
      namaSppg: cells[6] || "",
    };
    if (!entry.namaSppg || !entry.provinsi || !entry.kabupatenKota) continue;
    rows.push(entry);
  }

  const totalMatch = html.match(/id="total-sppg-count"[^>]*>([^<]+)/i);
  const totalSppg = totalMatch ? Number(String(totalMatch[1]).replace(/[^\d]/g, "")) || rows.length : rows.length;

  const updatedMatch = html.match(/berdasarkan data per\s*<b>\s*([^<]+?)\s*<\/b>/i);
  const updatedLabel = updatedMatch ? cleanText(updatedMatch[1]) : null;

  return {
    totalSppg,
    updatedLabel,
    rows,
  };
}

function parseDomainLinks(html, sourceUrl) {
  const links = [];
  const linkRegex = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRegex.exec(html))) {
    const hrefRaw = m[1];
    const label = cleanText(m[2]);
    if (!hrefRaw || !label) continue;
    let href = hrefRaw.trim();
    if (href.startsWith("#")) continue;
    if (!/^https?:\/\//i.test(href)) {
      try {
        href = new URL(href, sourceUrl).toString();
      } catch (_) {
        continue;
      }
    }
    links.push({ label, href });
  }

  const unique = [];
  const seen = new Set();
  for (const item of links) {
    const key = `${normalizeKey(item.label)}|${item.href.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

async function upsertPublicSource({ slug, nama, lisensi, urlSumber }) {
  return prisma.sumberDataPublik.upsert({
    where: { slug },
    update: {
      nama,
      lisensi,
      urlSumber,
      terakhirSyncAt: new Date(),
    },
    create: {
      slug,
      nama,
      lisensi,
      urlSumber,
      terakhirSyncAt: new Date(),
    },
  });
}

async function saveDomainLinksToPublicData({ rows, sourceUrl, generatedAt }) {
  const source = await upsertPublicSource({
    slug: SOURCE_DOMAIN_SLUG,
    nama: "MerahPutih BGN Domain Tree",
    lisensi: "Public Web Scraping",
    urlSumber: sourceUrl,
  });

  const payload = rows.map((item) => {
    const labelUpper = item.label.toUpperCase();
    let level = "LAINNYA";
    if (/^(\d+)\s+[A-Z]/.test(labelUpper)) level = "PROVINSI";
    if (/KAB\.|KOTA/.test(labelUpper)) level = "KABKOTA";
    if (/DOMAINS MBG|MBG PROVINSI|MBG KABUPATEN KOTA/.test(labelUpper)) level = "KATEGORI_DOMAIN";
    return {
      sumberId: source.id,
      kodeWilayah: level === "PROVINSI" ? `PROV-${makeHash(item.label, 6)}` : "IDN",
      namaWilayah: item.label.slice(0, 150),
      levelWilayah: level,
      tahun: new Date().getFullYear(),
      kategori: "DOMAIN_MBG_LINK",
      indikator: "DOMAIN_LINK_ITEM",
      nilai: 1,
      satuan: "LINK",
      metadata: {
        label: item.label,
        url: item.href,
        source: SOURCE_DOMAIN_SLUG,
        scrapedAt: generatedAt.toISOString(),
      },
    };
  });

  await prisma.indikatorPublik.deleteMany({ where: { sumberId: source.id, kategori: "DOMAIN_MBG_LINK" } });
  if (payload.length > 0) {
    await prisma.indikatorPublik.createMany({ data: payload });
  }

  await prisma.ingestBatch.create({
    data: {
      source: SOURCE_DOMAIN_SLUG,
      fetchedAt: generatedAt,
      generatedAt,
      timezone: "Asia/Jakarta",
      qualityFlag: payload.length > 0 ? "OK" : "EMPTY",
      isFallback: false,
      totalRecords: payload.length,
      notes: "Sinkron link tree domain MBG dari merahputihbgn.cloud",
    },
  });

  return { totalRecords: payload.length };
}

async function makeUniqueKodeSppg(prefix, key) {
  const base = `${prefix}-${makeHash(key, 6)}`.slice(0, 20);
  let candidate = base;
  for (let i = 0; i < 20; i += 1) {
    const exists = await prisma.sppg.findUnique({ where: { kodeSppg: candidate }, select: { id: true } });
    if (!exists) return candidate;
    const suffix = String(i + 1);
    candidate = `${base.slice(0, 20 - suffix.length)}${suffix}`;
  }
  return `SPPG-${makeHash(`${key}-${Date.now()}`, 8)}`.slice(0, 20);
}

async function syncSppgRows(rows, generatedAt, sourceUrl, updatedLabel) {
  const existing = await prisma.sppg.findMany({
    select: {
      id: true,
      kodeSppg: true,
      namaSppg: true,
      provinsi: true,
      kabupatenKota: true,
      kecamatan: true,
      alamat: true,
      kapasitasPorsiPerHari: true,
    },
  });

  const existingByIdentity = new Map();
  for (const item of existing) {
    const key = [
      normalizeKey(item.namaSppg),
      normalizeKey(item.provinsi),
      normalizeKey(item.kabupatenKota),
      normalizeKey(item.kecamatan || ""),
      normalizeKey(item.alamat || ""),
    ].join("|");
    existingByIdentity.set(key, item);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const identityKey = [
      normalizeKey(row.namaSppg),
      normalizeKey(row.provinsi),
      normalizeKey(row.kabupatenKota),
      normalizeKey(row.kecamatan || ""),
      normalizeKey(row.alamat || ""),
    ].join("|");

    const existingRow = existingByIdentity.get(identityKey);
    if (existingRow) {
      const patch = {
        namaSppg: row.namaSppg.slice(0, 200),
        provinsi: row.provinsi.slice(0, 100),
        kabupatenKota: row.kabupatenKota.slice(0, 100),
        kecamatan: row.kecamatan ? row.kecamatan.slice(0, 100) : null,
        alamat: row.alamat || `${row.kelurahanDesa || "-"}, ${row.kecamatan || "-"}, ${row.kabupatenKota}, ${row.provinsi}`,
      };
      const isChanged =
        normalizeKey(existingRow.namaSppg) !== normalizeKey(patch.namaSppg) ||
        normalizeKey(existingRow.alamat) !== normalizeKey(patch.alamat);
      if (isChanged) {
        await prisma.sppg.update({
          where: { id: existingRow.id },
          data: patch,
        });
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    const codePrefix = normalizeKey(row.provinsi).replace(/[^a-z0-9]/g, "").slice(0, 4).toUpperCase() || "SPPG";
    const kodeSppg = await makeUniqueKodeSppg(codePrefix, identityKey);
    await prisma.sppg.create({
      data: {
        kodeSppg,
        namaSppg: row.namaSppg.slice(0, 200),
        alamat: (row.alamat || `${row.kelurahanDesa || "-"}, ${row.kecamatan || "-"}, ${row.kabupatenKota}, ${row.provinsi}`).slice(0, 4000),
        provinsi: row.provinsi.slice(0, 100),
        kabupatenKota: row.kabupatenKota.slice(0, 100),
        kecamatan: row.kecamatan ? row.kecamatan.slice(0, 100) : null,
        kapasitasPorsiPerHari: 1,
        statusAktif: true,
        mitraPengelola: "SCRAPE_BGN",
      },
    });
    created += 1;
  }

  const source = await upsertPublicSource({
    slug: SOURCE_SPPG_SLUG,
    nama: "BGN Operasional SPPG",
    lisensi: "Public Web Scraping",
    urlSumber: sourceUrl,
  });

  await prisma.indikatorPublik.deleteMany({ where: { sumberId: source.id, kategori: "SPPG_OPERASIONAL" } });
  await prisma.indikatorPublik.createMany({
    data: [
      {
        sumberId: source.id,
        kodeWilayah: "IDN",
        namaWilayah: "Indonesia",
        levelWilayah: "NASIONAL",
        tahun: generatedAt.getFullYear(),
        kategori: "SPPG_OPERASIONAL",
        indikator: "TOTAL_SPPG_OPERASIONAL",
        nilai: rows.length,
        satuan: "SPPG",
        metadata: {
          source: SOURCE_SPPG_SLUG,
          scrapedAt: generatedAt.toISOString(),
          updatedLabel: updatedLabel || null,
        },
      },
    ],
  });

  await prisma.ingestBatch.create({
    data: {
      source: SOURCE_SPPG_SLUG,
      fetchedAt: generatedAt,
      generatedAt,
      timezone: "Asia/Jakarta",
      qualityFlag: "OK",
      isFallback: false,
      totalRecords: rows.length,
      notes: `Sinkron SPPG operasional. created=${created}, updated=${updated}, skipped=${skipped}`,
    },
  });

  return { created, updated, skipped, totalRecords: rows.length };
}

async function withJobLock(task) {
  const redis = getRedis();
  const lockValue = `${process.pid}:${Date.now()}`;
  let acquired = false;
  try {
    const ok = await redis.set(LOCK_KEY, lockValue, "EX", LOCK_TTL_SEC, "NX");
    acquired = ok === "OK";
    if (!acquired) {
      return { skipped: true, reason: "LOCKED" };
    }
    return await task();
  } finally {
    if (acquired) {
      try {
        const current = await redis.get(LOCK_KEY);
        if (current === lockValue) {
          await redis.del(LOCK_KEY);
        }
      } catch (_) {}
    }
  }
}

async function runBgnScrapeSync(options = {}) {
  const trigger = options.trigger || "manual";
  const run = async () => {
    const generatedAt = new Date();
    const sppgUrl = "https://www.bgn.go.id/operasional-sppg";
    // Pastikan path sesuai link tree dari halaman root.
    // Jika pakai path yang salah, situs akan balas 404 dan sync gagal.
    const domainUrl =
      "https://www.merahputihbgn.cloud/data-utama/bgn-sppg/data-bgn/domains-mbg";
    const rootUrl = "https://www.merahputihbgn.cloud/";

    const sppgHtml = await fetchText(sppgUrl);
    const parsedSppg = parseSppgOperasional(sppgHtml);

    // Domain tree: kalau pun domainUrl gagal, minimal rootUrl tetap dicoba.
    // (Tapi dengan path yang benar, domainUrl harusnya sukses.)
    const [domainHtml, rootHtml] = await Promise.all([
      fetchText(domainUrl).catch((e) => {
        if (String(e && e.message).includes("HTTP 404")) return "";
        throw e;
      }),
      fetchText(rootUrl),
    ]);
    const domainLinks = [
      ...parseDomainLinks(domainHtml, domainUrl),
      ...parseDomainLinks(rootHtml, rootUrl),
    ];

    const sppgResult = await syncSppgRows(parsedSppg.rows, generatedAt, sppgUrl, parsedSppg.updatedLabel);
    const domainResult = await saveDomainLinksToPublicData({
      rows: domainLinks,
      sourceUrl: domainUrl,
      generatedAt,
    });

    return {
      success: true,
      trigger,
      fetchedAt: generatedAt.toISOString(),
      sppg: {
        totalParsed: parsedSppg.rows.length,
        totalWebsite: parsedSppg.totalSppg,
        updatedLabel: parsedSppg.updatedLabel,
        ...sppgResult,
      },
      domains: {
        totalParsed: domainLinks.length,
        ...domainResult,
      },
    };
  };

  return withJobLock(run);
}

module.exports = {
  runBgnScrapeSync,
};

