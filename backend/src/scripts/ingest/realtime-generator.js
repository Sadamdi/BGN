"use strict";

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../../.env.local") });
require("dotenv").config();

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

async function generateDailyRealtimeBatch(options = {}) {
  const trigger = options.trigger || "generated";
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
          generatedBy: trigger,
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
      notes: "Generator harian realtime metrik MBG (100-10000 per domain), trigger=" + trigger + ".",
    },
  });

  return inserted;
}

async function runRealtimeBatch(options = {}) {
  const trigger = options.trigger || "module_call";
  const rows = await generateDailyRealtimeBatch({ trigger });
  return {
    success: true,
    trigger,
    totalRows: rows.length,
    metrics: rows.map((r) => ({ metricKey: r.metricKey, delta: r.delta })),
  };
}

module.exports = { runRealtimeBatch, generateDailyRealtimeBatch };

if (require.main === module) {
  (async () => {
    try {
      const rows = await generateDailyRealtimeBatch({ trigger: "cli" });
      console.log("[realtime-generator] rows:", rows.length);
      rows.forEach((r) => {
        console.log(" -", r.metricKey, "=", r.delta);
      });
    } catch (err) {
      console.error("[realtime-generator] gagal:", err);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
