"use strict";

const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/cron.controller");

// Vercel Cron Jobs mengirim GET ke path yang dideklarasikan di vercel.json.
router.get("/daily-generate", ctrl.dailyGenerate);
router.post("/daily-generate", ctrl.dailyGenerate);

module.exports = router;