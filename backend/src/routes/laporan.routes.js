"use strict";

const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const ctrl = require("../controllers/laporan.controller");

router.use(verifyToken);

router.post("/distribusi/preview", ctrl.previewDistribusi);
router.post("/distribusi/excel", ctrl.excelDistribusi);
router.post("/distribusi/pdf", ctrl.pdfDistribusi);

router.post("/status-gizi/preview", requireRole("ADMIN", "PEJABAT_BGN", "PENGAWAS_GIZI"), ctrl.previewStatusGizi);
router.post("/status-gizi/excel", requireRole("ADMIN", "PEJABAT_BGN", "PENGAWAS_GIZI"), ctrl.excelStatusGizi);
router.post("/kinerja-sppg/preview", requireRole("ADMIN", "PEJABAT_BGN", "PENGAWAS_GIZI"), ctrl.previewKinerjaSppg);

router.post("/kinerja-sppg/excel", requireRole("ADMIN", "PEJABAT_BGN", "PENGAWAS_GIZI"), ctrl.excelKinerjaSppg);
router.post("/penerima/preview", requireRole("ADMIN", "PEJABAT_BGN", "PENGAWAS_GIZI", "OPERATOR_SPPG"), ctrl.previewPenerima);
router.post("/penerima/excel", requireRole("ADMIN", "PEJABAT_BGN", "PENGAWAS_GIZI", "OPERATOR_SPPG"), ctrl.excelPenerima);

router.get("/jadwal", requireRole("ADMIN", "PEJABAT_BGN"), ctrl.listJadwal);
router.post("/jadwal", requireRole("ADMIN", "PEJABAT_BGN"), ctrl.buatJadwal);
router.patch("/jadwal/:id/toggle", requireRole("ADMIN", "PEJABAT_BGN"), ctrl.toggleJadwal);
router.delete("/jadwal/:id", requireRole("ADMIN", "PEJABAT_BGN"), ctrl.hapusJadwal);

module.exports = router;
