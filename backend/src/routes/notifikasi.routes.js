"use strict";

const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const ctrl = require("../controllers/notifikasi.controller");

router.use(verifyToken);

router.get("/", ctrl.getList);
router.patch("/tandai-dibaca", ctrl.patchTandaiDibaca);
router.patch("/tandai-semua", ctrl.patchTandaiSemua);

module.exports = router;
