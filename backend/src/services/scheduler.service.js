"use strict";

const cron = require("node-cron");
const notifikasi = require("./notifikasi.service");
const laporan = require("./laporan.service");

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

  console.log("[sipgn-bgn] scheduler started (Asia/Jakarta)");
}

module.exports = { startSchedulers };
