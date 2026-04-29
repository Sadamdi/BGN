"use strict";

const cron = require("node-cron");
const { spawn } = require("child_process");
const notifikasi = require("./notifikasi.service");
const laporan = require("./laporan.service");

function runScript(label, relativeScript) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [relativeScript], {
      cwd: process.cwd(),
      stdio: "pipe",
      env: process.env,
    });
    let stderr = "";
    child.stdout.on("data", (d) => console.log(`[cron:${label}]`, d.toString().trim()));
    child.stderr.on("data", (d) => {
      stderr += d.toString();
      console.error(`[cron:${label}]`, d.toString().trim());
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Script ${label} gagal (exit ${code}): ${stderr}`));
    });
  });
}

function startSchedulers() {
  // 18:00 WIB (UTC+7) -> 11:00 UTC
  cron.schedule(
    "0 18 * * *",
    () => {
      notifikasi.kirimNotifikasiSppgBelumLapor().catch((e) => console.error("[cron] sppg belum lapor:", e.message));
    },
    { timezone: "Asia/Jakarta" }
  );

  // setiap malam
  cron.schedule(
    "0 22 * * *",
    () => {
      notifikasi.kirimNotifikasiDistribusiRendah().catch((e) => console.error("[cron] distribusi rendah:", e.message));
    },
    { timezone: "Asia/Jakarta" }
  );

  // jadwal laporan: cek tiap jam
  cron.schedule("0 * * * *", () => {
    laporan.jalankanJadwalAktif().catch((e) => console.error("[cron] laporan terjadwal:", e.message));
  });

  // sinkron scraping BGN + domain MBG tiap jam
  cron.schedule(
    "10 * * * *",
    async () => {
      try {
        await runScript("bgn-scrape-sync", "src/scripts/ingest/bgn-scrape.ingest.js");
      } catch (e) {
        console.error("[cron] bgn scrape sync:", e.message);
      }
    },
    { timezone: "Asia/Jakarta" }
  );

  // Ingest hybrid + generator realtime tiap hari jam 00:05 WIB
  cron.schedule(
    "5 0 * * *",
    async () => {
      try {
        await runScript("ingest-public", "src/scripts/ingest/public-data.ingest.js");
        await runScript("realtime-generator", "src/scripts/ingest/realtime-generator.js");
      } catch (e) {
        console.error("[cron] ingest realtime:", e.message);
      }
    },
    { timezone: "Asia/Jakarta" }
  );

  console.log("[sipgn-bgn] scheduler started (Asia/Jakarta)");
}

module.exports = { startSchedulers };
