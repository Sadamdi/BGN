"use strict";

// Reset data dummy yang di-generate oleh generator (cron, backfill-sppg, dll).
// Aman di-rerun. Tujuannya supaya re-trigger backfill realistic menghasilkan data
// fresh dengan proporsi & skala baru.
//
// Yang di-reset:
//   - distribusi_mbg: semua row (kecuali yang ber-attachment ke SPPG/operator real)
//   - pemantauan_gizi: semua row (dummy) -- atau hanya yang bukan real?
//   - realtime_metric: semua row
//   - realtime_event_stream: semua row
// Yang TIDAK di-reset:
//   - pengguna (akun admin, operator, dll)
//   - sppg (master data SPPG, hasil BGN scrape)
//   - penerima_manfaat (master data, dari seed/backfill)
//   - sumber_data_publik, indikator_publik (master data publik)

require("dotenv").config({ path: require("path").resolve(__dirname, "../../../../.env.local") });
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const mode = (process.argv[2] || "all").toLowerCase();
  console.log(`[reset-distribusi] mulai (mode=${mode})...`);

  if (mode === "all" || mode === "distribusi") {
    const deletedDist = await prisma.distribusiMbg.deleteMany({});
    console.log(`[reset-distribusi] distribusi_mbg: ${deletedDist.count} baris dihapus`);
  }

  if (mode === "all" || mode === "pemantauan") {
    const deletedP = await prisma.pemantauanGizi.deleteMany({});
    console.log(`[reset-distribusi] pemantauan_gizi: ${deletedP.count} baris dihapus`);
  }

  if (mode === "all" || mode === "realtime") {
    const deletedR = await prisma.realtimeMetric.deleteMany({});
    console.log(`[reset-distribusi] realtime_metric: ${deletedR.count} baris dihapus`);
    const deletedE = await prisma.realtimeEventStream.deleteMany({});
    console.log(`[reset-distribusi] realtime_event_stream: ${deletedE.count} baris dihapus`);
  }

  if (mode === "all" || mode === "audit") {
    const deletedA = await prisma.ingestBatch.deleteMany({});
    console.log(`[reset-distribusi] ingest_batch: ${deletedA.count} baris dihapus`);
  }

  console.log("[reset-distribusi] selesai.");
}

main()
  .catch((err) => {
    console.error("[reset-distribusi] gagal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
