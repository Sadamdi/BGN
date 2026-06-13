"use strict";

const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const ctrl = require("../controllers/pengguna.controller");

router.use(verifyToken, requireRole("ADMIN"));

router.get("/", ctrl.listPengguna);
router.post("/", ctrl.buatPengguna);
router.put("/:id", ctrl.updatePengguna);
router.patch("/:id/password", ctrl.resetPasswordOleh);
router.patch("/:id/status", ctrl.toggleStatus);
router.post("/:id/approve", ctrl.approvePendaftaran);
router.post("/:id/tolak", ctrl.tolakPendaftaran);
router.delete("/:id", ctrl.hapusPengguna);

module.exports = router;
