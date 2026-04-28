"use strict";

const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const ctrl = require("../controllers/dashboard.controller");

router.use(verifyToken);

router.get("/statistik", ctrl.getStatistik);
router.get("/tren-distribusi", ctrl.getTrenDistribusi);
router.get("/sebaran-sppg", ctrl.getSebaranSppg);
router.get("/distribusi-kategori", ctrl.getDistribusiKategori);
router.get("/alert", ctrl.getAlert);

module.exports = router;
