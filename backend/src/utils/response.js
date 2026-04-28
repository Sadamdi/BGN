"use strict";

function sukses(res, data, message = "Berhasil", status = 200, extra = {}) {
  return res.status(status).json({ success: true, message, data, ...extra });
}

function gagal(res, message = "Terjadi kesalahan", status = 400, code = "ERROR", extra = {}) {
  return res.status(status).json({ success: false, message, code, ...extra });
}

module.exports = { sukses, gagal };
