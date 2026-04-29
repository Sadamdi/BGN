"use strict";

const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/auth.controller");
const { verifyToken } = require("../middleware/auth");
const { loginLimiter } = require("../middleware/rateLimiter");

router.get("/login", ctrl.getLoginInfo);
router.post("/login", loginLimiter, ctrl.postLogin);
router.post("/refresh", ctrl.postRefresh);
router.post("/logout", verifyToken, ctrl.postLogout);
router.post("/forgot-password", ctrl.postForgotPassword);
router.post("/reset-password/:token/verify-otp", ctrl.postVerifyResetOtp);
router.post("/reset-password/:token", ctrl.postResetPassword);
router.post("/ubah-password", verifyToken, ctrl.postUbahPassword);
router.get("/me", verifyToken, ctrl.getMe);
router.patch("/me/preferences", verifyToken, ctrl.patchMePreferences);

module.exports = router;
