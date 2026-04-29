"use strict";

const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/publicData.controller");
const { verifyToken } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");

router.get("/ringkasan", verifyToken, ctrl.getRingkasanPublik);
router.get("/realtime-summary", verifyToken, ctrl.getRealtimeSummary);
router.get("/realtime-stream", verifyToken, ctrl.realtimeStream);
router.post(
  "/sync-scrape",
  verifyToken,
  requireRole("ADMIN", "PEJABAT_BGN", "PENGAWAS_GIZI"),
  ctrl.syncScrapeData
);

module.exports = router;
