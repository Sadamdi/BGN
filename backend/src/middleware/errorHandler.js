"use strict";

const { Prisma } = require("@prisma/client");

function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: "Endpoint tidak ditemukan: " + req.method + " " + req.originalUrl,
    code: "ROUTE_NOT_FOUND",
  });
}

function errorHandler(err, req, res, _next) {
  const isProd = process.env.NODE_ENV === "production";

  if (err && err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Ukuran data melebihi batas yang diizinkan",
      code: "PAYLOAD_TOO_LARGE",
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Data sudah ada (duplikat) untuk kolom unik",
        code: "DUPLICATE",
        fields: err.meta && err.meta.target,
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Data tidak ditemukan",
        code: "NOT_FOUND",
      });
    }
    if (err.code === "P2003") {
      return res.status(409).json({
        success: false,
        message: "Operasi gagal karena ada relasi data terkait",
        code: "FOREIGN_KEY",
      });
    }
  }

  if (err && err.statusCode && err.expose !== false) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message || "Terjadi kesalahan",
      code: err.code || "ERROR",
      ...(err.fields ? { fields: err.fields } : {}),
    });
  }

  console.error("[error]", err && err.stack ? err.stack : err);

  return res.status(500).json({
    success: false,
    message: "Terjadi kesalahan server. Silakan coba beberapa saat lagi.",
    code: "INTERNAL_ERROR",
    ...(isProd ? {} : { detail: err && err.message }),
  });
}

class HttpError extends Error {
  constructor(status, message, code, fields) {
    super(message);
    this.statusCode = status;
    this.code = code || "ERROR";
    this.expose = true;
    if (fields) this.fields = fields;
  }
}

module.exports = { errorHandler, notFoundHandler, HttpError };
