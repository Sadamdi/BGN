"use strict";

require("dotenv").config();

const crypto = require("crypto");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const { prisma } = require("../../config/database");

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "Asia/Jakarta";
const METRICS = [
  "PENERIMA_MANFAAT",
  "DISTRIBUSI_MBG",
  "STATUS_GIZI",
  "LAPORAN",
  "SPPG",
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function generateDailyRealtimeBatch() {
  const nowJakarta = dayjs().tz(TZ);
  const dateJakarta = nowJakarta.startOf("day").toDate();
  const generatedAt = nowJakarta.toDate();

  const inserted = [];
  for (const metricKey of METRICS) {
    const delta = randomInt(100, 10000);
    const row = await prisma.realtimeMetric.create({
      data: {
        dateJakarta,
        generatedAt,
        timezone: TZ,
        metricKey,
        delta,
        source: "generated",
        isFallback: false,
        metadata: {
          generatedBy: "daily-generator",
          generatedAtIso: nowJakarta.toISOString(),
        },
      },
    });
    inserted.push(row);
  }

  await prisma.realtimeEventStream.create({
    data: {
      eventType: "DAILY_METRIC_BATCH_CREATED",
      payload: {
        timezone: TZ,
        generatedAt: nowJakarta.toISOString(),
        values: inserted.map((x) => ({
          metricKey: x.metricKey,
          delta: x.delta,
        })),
      },
    },
  });

  await prisma.ingestBatch.create({
    data: {
      source: "realtime_generator",
      fetchedAt: generatedAt,
      generatedAt,
      timezone: TZ,
      qualityFlag: "OK",
      isFallback: false,
      totalRecords: inserted.length,
      notes: "Generator harian realtime metrik MBG (100-10000 per domain).",
    },
  });

  return inserted;
}

async function main() {
  const rows = await generateDailyRealtimeBatch();
  console.log("[realtime-generator] rows:", rows.length);
  rows.forEach((r) => {
    console.log(" -", r.metricKey, "=", r.delta);
  });
}

main()
  .catch((err) => {
    console.error("[realtime-generator] gagal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
