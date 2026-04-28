"use strict";

const { validationResult } = require("express-validator");

function runValidation(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const fields = {};
  for (const e of errors.array({ onlyFirstError: true })) {
    fields[e.path] = e.msg;
  }
  return res.status(422).json({
    success: false,
    message: "Validasi gagal. Periksa kembali isian Anda.",
    code: "VALIDATION_ERROR",
    fields,
  });
}

module.exports = { runValidation };
