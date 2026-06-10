"use strict";

const express = require("express");
const router = express.Router();
const path = require("path");
const { spawn } = require("child_process");
const { verifyToken } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { sukses, error } = require("../utils/response");
const { invalidatePrefix } = require("../services/cache.service");
const { runDailyDummyNutrition } = require("../services/dummyNutrition.service");
const { runRealtimeBatch } = require("../scripts/ingest/realtime-generator");
const { runPublicDataIngest } = require("../scripts/ingest/public-data.ingest");

router.use(verifyToken);
router.use(requireRole("ADMIN"));

function runChildScript(label, scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      stdio: "pipe",
      env: process.env,
    });
    let stderr = "";
    child.stdout.on("data", (d) => console.log(`[admin:${label}]`, d.toString().trim()));
    child.stderr.on("data", (d) => { stderr += d.toString(); console.error(`[admin:${label}]`, d.toString().trim()); });
    child.on("close", (code) => {
      if (code === 0) resolve({ ok: true });
      else reject(new Error("Script gagal (exit " + code + "): " + stderr));
    });
  });
}

async function withStep(name, fn) {
  const started = Date.now();
  try {
    const result = await fn();
    return { name, ok: true, durationMs: Date.now() - started, summary: result };
  } catch (err) {
    console.error("[admin] step " + name + " gagal:", err.message);
    return { name, ok: false, durationMs: Date.now() - started, error: err.message };
  }
}

router.post("/reset-distribusi", async (req, res, next) => {
  const startedAt = new Date();
  try {
    const mode = (req.body && req.body.mode) || "all";
    const step = await withStep("reset",
      () => runChildScript("reset-distribusi",
        path.join(__dirname, "..", "scripts", "ingest", "reset-distribusi.js"))
        .then(() => ({ mode }))
    );
    const finishedAt = new Date();
    await invalidatePrefix("dashboard:");
    await invalidatePrefix("laporan:");
    return sukses(res, {
      ok: step.ok,
      trigger: "manual_reset",
      mode,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      totalMs: finishedAt - startedAt,
      steps: { reset: step },
    }, step.ok ? "Reset distribusi selesai" : "Reset distribusi gagal");
  } catch (err) {
    return next(err);
  }
});

router.post("/backfill-30d", async (req, res, next) => {
  const startedAt = new Date();
  try {
    const backfillDays = Math.max(1, Math.min(60, parseInt(req.body && req.body.backfillDays, 10) || 30));
    const [dummyStep, realtimeStep, publicStep] = await Promise.all([
      withStep("dummy", () =>
        runDailyDummyNutrition({ trigger: "manual_backfill_realistic", backfillDays, skipLock: true, mode: "realistic" })
      ),
      withStep("realtime", () => runRealtimeBatch({ trigger: "manual_backfill_realistic" })),
      withStep("public", () => runPublicDataIngest({ trigger: "manual_backfill_realistic" })),
    ]);
    const finishedAt = new Date();
    const allOk = dummyStep.ok && realtimeStep.ok && publicStep.ok;
    await invalidatePrefix("dashboard:");
    await invalidatePrefix("laporan:");
    return sukses(res, {
      ok: allOk,
      trigger: "manual_backfill_realistic",
      backfillDays,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      totalMs: finishedAt - startedAt,
      steps: { dummy: dummyStep, realtime: realtimeStep, public: publicStep },
    }, allOk ? "Backfill 30 hari realistic berhasil" : "Backfill selesai sebagian");
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
