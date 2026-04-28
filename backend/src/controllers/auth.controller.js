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
    const { password } = req.body || {};
    await auth.resetPassword({ token, newPassword: password });
    return sukses(res, null, "Password berhasil direset. Silakan login kembali.");
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
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  postLogin,
  postRefresh,
  postLogout,
  postForgotPassword,
  postResetPassword,
  postUbahPassword,
  getMe,
};
