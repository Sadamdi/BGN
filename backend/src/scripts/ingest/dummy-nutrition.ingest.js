"use strict";

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../../.env.local") });
require("dotenv").config();

const { runDailyDummyNutrition } = require("../../services/dummyNutrition.service");
const { prisma } = require("../../config/database");

async function main() {
  const result = await runDailyDummyNutrition({ trigger: "cron", totalMenus: 1000 });
  console.log("[dummy-nutrition] result:", JSON.stringify(result));
}

main()
  .catch((err) => {
    console.error("[dummy-nutrition] gagal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
