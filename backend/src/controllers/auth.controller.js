"use strict";

const auth = require("../services/auth.service");
const { sukses } = require("../utils/response");

async function postLogin(req, res, next) {
  try {
    const { username, email, password } = req.body || {};
    const identifier = username || email;
    const result = await auth.login({ identifier, password });
    return sukses(res, result, "Login berhasil");
  } catch (err) {
    next(err);
  }
}

function getLoginInfo(_req, res) {
  return res.status(200).json({
    success: true,
    message: "Endpoint login aktif. Gunakan method POST ke /api/auth/login dengan body username/email dan password.",
    data: {
      method: "POST",
      path: "/api/auth/login",
      body: {
        username: "admin",
        password: "Admin@123!",
      },
    },
  });
}

async function postRefresh(req, res, next) {
  try {
    const { refreshToken } = req.body || {};
    const result = await auth.refreshAccessToken(refreshToken);
    return sukses(res, result, "Token diperbarui");
  } catch (err) {
    next(err);
  }
}

async function postLogout(req, res, next) {
  try {
    await auth.logout({
      userId: req.user.userId,
      accessToken: req.accessToken,
      accessTokenExp: req.accessTokenExp,
    });
    return sukses(res, null, "Logout berhasil");
  } catch (err) {
    next(err);
  }
}

async function postForgotPassword(req, res, next) {
  try {
    const { email } = req.body || {};
    if (!email) return sukses(res, null, "Jika email terdaftar, link reset telah dikirim.");
    await auth.forgotPassword(email);
    return sukses(res, null, "Jika email terdaftar, link reset password telah dikirim.");
  } catch (err) {
    next(err);
  }
}

async function postResetPassword(req, res, next) {
  try {
    const token = req.params.token;
    const { password, otp } = req.body || {};
    await auth.resetPassword({ token, otp, newPassword: password });
    return sukses(res, null, "Password berhasil direset. Silakan login kembali.");
  } catch (err) {
    next(err);
  }
}

async function postVerifyResetOtp(req, res, next) {
  try {
    const token = req.params.token;
    const { otp } = req.body || {};
    await auth.verifyResetOtp({ token, otp });
    return sukses(res, null, "OTP valid");
  } catch (err) {
    next(err);
  }
}

async function postUbahPassword(req, res, next) {
  try {
    const { passwordLama, passwordBaru } = req.body || {};
    await auth.ubahPassword({
      userId: req.user.userId,
      passwordLama,
      passwordBaru,
    });
    return sukses(res, null, "Password berhasil diubah");
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const { prisma } = require("../config/database");
    const user = await prisma.pengguna.findUnique({
      where: { id: req.user.userId },
      include: { sppg: true },
    });
    if (!user) return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan", code: "NOT_FOUND" });
    const themePreference = await auth.getThemePreference(user.id);
    return sukses(res, {
      id: user.id,
      username: user.username,
      email: user.email,
      namaLengkap: user.namaLengkap,
      peran: user.peran,
      sppgId: user.sppgId,
      sppg: user.sppg,
      wilayahZona: user.wilayahZona,
      terakhirLogin: user.terakhirLogin,
      themePreference,
    });
  } catch (err) {
    next(err);
  }
}

async function patchMePreferences(req, res, next) {
  try {
    const { themePreference } = req.body || {};
    const saved = await auth.setThemePreference(req.user.userId, themePreference);
    return sukses(res, { themePreference: saved }, "Preferensi tema disimpan");
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getLoginInfo,
  postLogin,
  postRefresh,
  postLogout,
  postForgotPassword,
  postVerifyResetOtp,
  postResetPassword,
  postUbahPassword,
  getMe,
  patchMePreferences,
};
