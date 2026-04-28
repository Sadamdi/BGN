"use strict";

const path = require("path");
const fs = require("fs");
const multer = require("multer");

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024;

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function makeStorage(subdir) {
  return multer.diskStorage({
    destination: function (_req, _file, cb) {
      const now = new Date();
      const dir = path.join(
        UPLOAD_DIR,
        subdir,
        String(now.getFullYear()),
        String(now.getMonth() + 1).padStart(2, "0")
      );
      ensureDir(dir);
      cb(null, dir);
    },
    filename: function (_req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      const stamp = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, stamp + ext);
    },
  });
}

const imageFilter = (_req, file, cb) => {
  const ok = ["image/jpeg", "image/png", "image/jpg"].includes(file.mimetype);
  if (!ok) return cb(new Error("Hanya file JPG atau PNG yang diizinkan"));
  cb(null, true);
};

const excelFilter = (_req, file, cb) => {
  const ok = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ].includes(file.mimetype) || file.originalname.toLowerCase().endsWith(".xlsx");
  if (!ok) return cb(new Error("Hanya file Excel (.xlsx) yang diizinkan"));
  cb(null, true);
};

const uploadDistribusi = multer({
  storage: makeStorage("distribusi"),
  fileFilter: imageFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  fileFilter: excelFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

module.exports = { uploadDistribusi, uploadExcel, UPLOAD_DIR };
