"use strict";

const express = require("express");
const router = express.Router();

router.use("/auth", require("./auth.routes"));
router.use("/dashboard", require("./dashboard.routes"));
router.use("/penerima", require("./penerima.routes"));
router.use("/sppg", require("./sppg.routes"));
router.use("/distribusi", require("./distribusi.routes"));
router.use("/gizi", require("./gizi.routes"));
router.use("/laporan", require("./laporan.routes"));
router.use("/pengguna", require("./pengguna.routes"));
router.use("/notifikasi", require("./notifikasi.routes"));

module.exports = router;
