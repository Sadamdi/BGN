"use strict";

require("dotenv").config();

const { prisma } = require("../../config/database");
const { runBgnScrapeSync } = require("../../services/bgnScrapeSync.service");

async function main() {
  const result = await runBgnScrapeSync({ trigger: "cron" });
  if (result && result.skipped) {
    console.log("[ingest:bgn-scrape] skipped:", result.reason);
    return;
  }
  console.log("[ingest:bgn-scrape] done:", JSON.stringify(result));
}

main()
  .catch((err) => {
    console.error("[ingest:bgn-scrape] gagal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

