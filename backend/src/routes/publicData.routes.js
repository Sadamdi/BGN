"use strict";

const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/publicData.controller");
const { verifyToken } = require("../middleware/auth");

router.get("/ringkasan", verifyToken, ctrl.getRingkasanPublik);

module.exports = router;
