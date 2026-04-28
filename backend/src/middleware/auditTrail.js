"use strict";

const { prisma } = require("../config/database");

async function catatAudit({ tabel, recordId, aksi, dataLama, dataBaru, req }) {
  try {
    await prisma.auditTrail.create({
      data: {
        tabel,
        recordId: String(recordId),
        aksi,
        dataLama: dataLama ?? undefined,
        dataBaru: dataBaru ?? undefined,
        penggunaId: (req && req.user && req.user.userId) || null,
        ipAddress: req ? (req.headers["x-forwarded-for"] || req.ip || null) : null,
        userAgent: req ? (req.headers["user-agent"] || null) : null,
      },
    });
  } catch (err) {
    console.error("[audit] gagal mencatat:", err.message);
  }
}

module.exports = { catatAudit };
