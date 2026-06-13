"use strict";

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { prisma } = require("../config/database");
const { getRedis } = require("../config/redis");
const { ACCESS_SECRET, REFRESH_SECRET, ACCESS_EXPIRES, REFRESH_EXPIRES } = require("../config/jwt");
const { HttpError } = require("../middleware/errorHandler");
const { emailResetPassword } = require("./email.service");
const { sanitizeString } = require("../utils/sanitize");

const FAIL_TTL = 15 * 60;
const LOCKOUT_TTL = 15 * 60;
const MAX_FAIL = 5;
const RESET_TTL = 30 * 60;
const RESET_MAX_OTP_ATTEMPTS = 5;
const THEME_MODES = ["LIGHT", "DARK", "SYSTEM"];

function getThemeKey(userId) {
  return `pref:theme:${userId}`;
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    namaLengkap: u.namaLengkap,
    peran: u.peran,
    sppgId: u.sppgId,
    wilayahZona: u.wilayahZona,
    themePreference: THEME_MODES.includes(u.themePreference) ? u.themePreference : "SYSTEM",
  };
}

function mapDatabaseAvailabilityError(err) {
  const msg = String((err && err.message) || "");
  if (msg.includes("Can't reach database server")) {
    throw new HttpError(
      503,
      "Layanan database sedang tidak tersedia. Coba beberapa saat lagi.",
      "DATABASE_UNAVAILABLE"
    );
  }
  throw err;
}

async function getThemePreference(userId) {
  if (!userId) return "SYSTEM";
  try {
    const pref = await getRedis().get(getThemeKey(userId));
    return THEME_MODES.includes(pref) ? pref : "SYSTEM";
  } catch (_) {
    return "SYSTEM";
  }
}

async function setThemePreference(userId, themePreference) {
  const next = String(themePreference || "").toUpperCase();
  if (!THEME_MODES.includes(next)) {
    throw new HttpError(422, "themePreference harus LIGHT, DARK, atau SYSTEM", "VALIDATION_ERROR");
  }
  try {
    await getRedis().set(getThemeKey(userId), next);
  } catch (_) {}
  return next;
}

function buildAccessToken(u) {
  return jwt.sign(
    {
      userId: u.id,
      username: u.username,
      namaLengkap: u.namaLengkap,
      peran: u.peran,
      sppgId: u.sppgId,
      wilayahZona: u.wilayahZona,
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

function buildRefreshToken(u) {
  return jwt.sign({ userId: u.id, type: "refresh" }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES,
  });
}

async function login({ identifier, password }) {
  if (!identifier || !password) {
    throw new HttpError(400, "Username/email dan password wajib diisi", "BAD_REQUEST");
  }

  const ident = String(identifier).trim();
  let user;
  try {
    user = await prisma.pengguna.findFirst({
      where: {
        OR: [
          { username: { equals: ident, mode: "insensitive" } },
          { email: { equals: ident, mode: "insensitive" } },
        ],
      },
    });
  } catch (err) {
    mapDatabaseAvailabilityError(err);
  }

  if (!user) {
    throw new HttpError(401, "Username atau password salah", "INVALID_CREDENTIALS");
  }

  if (!user.statusAktif) {
    throw new HttpError(403, "Akun Anda dinonaktifkan. Hubungi administrator.", "ACCOUNT_DISABLED");
  }

  const redis = getRedis();
  const lockoutKey = "lockout:" + user.id;
  let lockoutTtl = -2;
  try {
    lockoutTtl = await redis.ttl(lockoutKey);
  } catch (_) {
    lockoutTtl = -2;
  }
  if (lockoutTtl > 0) {
    const minutes = Math.ceil(lockoutTtl / 60);
    throw new HttpError(
      423,
      "Akun dikunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam " + minutes + " menit.",
      "ACCOUNT_LOCKED"
    );
  }

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) {
    let fail = 0;
    try {
      fail = await redis.incr("fail:" + user.id);
      if (fail === 1) await redis.expire("fail:" + user.id, FAIL_TTL);
      if (fail >= MAX_FAIL) {
        await redis.set(lockoutKey, "1", "EX", LOCKOUT_TTL);
        await redis.del("fail:" + user.id);
      }
    } catch (_) {}
    if (fail >= MAX_FAIL) {
      throw new HttpError(
        423,
        "Akun dikunci 15 menit karena terlalu banyak percobaan gagal.",
        "ACCOUNT_LOCKED"
      );
    }
    throw new HttpError(401, "Username atau password salah", "INVALID_CREDENTIALS");
  }

  try {
    await redis.del("fail:" + user.id);
  } catch (_) {}

  const accessToken = buildAccessToken(user);
  const refreshToken = buildRefreshToken(user);

  try {
    await redis.set("refresh:" + user.id, refreshToken, "EX", 7 * 24 * 60 * 60);
  } catch (_) {}

  try {
    await prisma.pengguna.update({
      where: { id: user.id },
      data: { terakhirLogin: new Date() },
    });
  } catch (err) {
    mapDatabaseAvailabilityError(err);
  }

  const themePreference = await getThemePreference(user.id);
  return {
    accessToken,
    refreshToken,
    user: publicUser({ ...user, themePreference }),
  };
}

function validateRegisterPassword(p) {
  if (!p || p.length < 8) return "Password minimal 8 karakter";
  if (!/[A-Z]/.test(p)) return "Password harus mengandung huruf besar";
  if (!/[a-z]/.test(p)) return "Password harus mengandung huruf kecil";
  if (!/[0-9]/.test(p)) return "Password harus mengandung angka";
  if (!/[^A-Za-z0-9]/.test(p)) return "Password harus mengandung simbol";
  return null;
}

/**
 * Registrasi SPPG mandiri: membuat SPPG baru + akun OPERATOR_SPPG sekaligus,
 * keduanya berstatus nonaktif (statusAktif=false) sampai disetujui admin.
 * Tidak mengembalikan token — user harus menunggu approval lalu login.
 */
async function registerSppg(payload = {}) {
  const fields = {};

  // --- Validasi akun operator ---
  const username = sanitizeString(payload.username, { maxLength: 50 });
  const email = sanitizeString(payload.email, { maxLength: 100 });
  const namaLengkap = sanitizeString(payload.namaLengkap, { maxLength: 150 });
  const password = String(payload.password || "");

  if (!username || username.length < 3 || username.length > 50 || !/^[A-Za-z0-9_]+$/.test(username)) {
    fields.username = "Username 3-50 karakter (huruf, angka, underscore)";
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = "Email tidak valid";
  if (!namaLengkap || namaLengkap.length < 2) fields.namaLengkap = "Nama lengkap wajib (min 2 karakter)";
  const ePass = validateRegisterPassword(password);
  if (ePass) fields.password = ePass;

  // --- Validasi data SPPG ---
  const kodeSppg = sanitizeString(payload.kodeSppg, { maxLength: 20 });
  const namaSppg = sanitizeString(payload.namaSppg, { maxLength: 200 });
  const alamat = sanitizeString(payload.alamat, { maxLength: 500 });
  const provinsi = sanitizeString(payload.provinsi, { maxLength: 100 });
  const kabupatenKota = sanitizeString(payload.kabupatenKota, { maxLength: 100 });
  const kapasitas = Number(payload.kapasitasPorsiPerHari);

  if (!kodeSppg || !/^[A-Za-z0-9-]{5,20}$/.test(kodeSppg)) fields.kodeSppg = "Kode SPPG 5-20 karakter alfanumerik (boleh strip)";
  if (!namaSppg || namaSppg.length < 3) fields.namaSppg = "Nama SPPG minimal 3 karakter";
  if (!alamat) fields.alamat = "Alamat wajib diisi";
  if (!provinsi) fields.provinsi = "Provinsi wajib diisi";
  if (!kabupatenKota) fields.kabupatenKota = "Kabupaten/Kota wajib diisi";
  if (!Number.isFinite(kapasitas) || kapasitas <= 0) fields.kapasitasPorsiPerHari = "Kapasitas harus angka > 0";

  if (Object.keys(fields).length) {
    throw new HttpError(422, "Validasi gagal", "VALIDATION_ERROR", fields);
  }

  // --- Cek duplikasi ---
  let dupUser;
  try {
    dupUser = await prisma.pengguna.findFirst({
      where: {
        OR: [
          { username: { equals: username, mode: "insensitive" } },
          { email: { equals: email.toLowerCase(), mode: "insensitive" } },
        ],
      },
    });
  } catch (err) {
    mapDatabaseAvailabilityError(err);
  }
  if (dupUser) throw new HttpError(409, "Username atau email sudah terdaftar", "DUPLICATE_USER");

  const dupSppg = await prisma.sppg.findUnique({ where: { kodeSppg } }).catch(() => null);
  if (dupSppg) throw new HttpError(409, "Kode SPPG sudah terdaftar", "DUPLICATE_SPPG");

  const passwordHash = await bcrypt.hash(password, 12);

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const sppg = await tx.sppg.create({
        data: {
          kodeSppg,
          namaSppg,
          alamat,
          latitude: payload.latitude !== undefined && payload.latitude !== "" ? Number(payload.latitude) : null,
          longitude: payload.longitude !== undefined && payload.longitude !== "" ? Number(payload.longitude) : null,
          provinsi,
          kabupatenKota,
          kecamatan: sanitizeString(payload.kecamatan, { maxLength: 100 }) || null,
          kapasitasPorsiPerHari: Math.round(kapasitas),
          mitraPengelola: sanitizeString(payload.mitraPengelola, { maxLength: 150 }) || null,
          kontakPenanggungJawab: namaLengkap,
          telepon: sanitizeString(payload.telepon, { maxLength: 20 }) || null,
          statusAktif: false,
        },
      });
      const user = await tx.pengguna.create({
        data: {
          username,
          email: email.toLowerCase(),
          namaLengkap,
          peran: "OPERATOR_SPPG",
          sppgId: sppg.id,
          passwordHash,
          statusAktif: false,
        },
      });
      return { sppg, user };
    });
  } catch (err) {
    mapDatabaseAvailabilityError(err);
  }

  return {
    sppgId: result.sppg.id,
    kodeSppg: result.sppg.kodeSppg,
    namaSppg: result.sppg.namaSppg,
    username: result.user.username,
    status: "PENDING_APPROVAL",
  };
}

async function refreshAccessToken(refreshToken) {
  if (!refreshToken) throw new HttpError(401, "Refresh token tidak diberikan", "NO_REFRESH");
  let payload;
  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET);
  } catch (_) {
    throw new HttpError(401, "Refresh token tidak valid atau kedaluwarsa", "INVALID_REFRESH");
  }
  const stored = await getRedis().get("refresh:" + payload.userId).catch(() => null);
  if (stored && stored !== refreshToken) {
    throw new HttpError(401, "Sesi tidak dikenal. Silakan login kembali.", "REFRESH_MISMATCH");
  }
  let user;
  try {
    user = await prisma.pengguna.findUnique({ where: { id: payload.userId } });
  } catch (err) {
    mapDatabaseAvailabilityError(err);
  }
  if (!user || !user.statusAktif) {
    throw new HttpError(401, "Akun tidak aktif", "ACCOUNT_DISABLED");
  }
  const accessToken = buildAccessToken(user);
  const themePreference = await getThemePreference(user.id);
  return { accessToken, user: publicUser({ ...user, themePreference }) };
}

async function logout({ userId, accessToken, accessTokenExp }) {
  try {
    if (userId) await getRedis().del("refresh:" + userId);
    if (accessToken) {
      const ttl = Math.max(60, (accessTokenExp || 0) - Math.floor(Date.now() / 1000));
      await getRedis().set("blacklist:" + accessToken, "1", "EX", ttl);
    }
  } catch (_) {}
}

async function forgotPassword(email) {
  const user = await prisma.pengguna.findUnique({
    where: { email: String(email).toLowerCase().trim() },
  });
  if (!user) return { delivered: true };

  const token = crypto.randomBytes(32).toString("hex");
  const otpCode = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = crypto.createHash("sha256").update(otpCode).digest("hex");
  const resetPayload = JSON.stringify({
    userId: user.id,
    otpHash,
    attempts: 0,
    maxAttempts: RESET_MAX_OTP_ATTEMPTS,
    createdAt: Date.now(),
  });
  await getRedis().set("reset:" + token, resetPayload, "EX", RESET_TTL);

  const link = (process.env.FRONTEND_URL || "http://localhost:5173") + "/reset-password/" + token;
  await emailResetPassword({
    to: user.email,
    namaLengkap: user.namaLengkap,
    link,
    otpCode,
    ttlMinutes: Math.floor(RESET_TTL / 60),
  });

  return { delivered: true };
}

function parseResetPayload(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

async function verifyResetOtp({ token, otp }) {
  if (!token || !otp) {
    throw new HttpError(400, "Token atau OTP tidak lengkap", "BAD_REQUEST");
  }
  const key = "reset:" + token;
  const raw = await getRedis().get(key);
  const payload = parseResetPayload(raw);
  if (!payload || !payload.userId || !payload.otpHash) {
    throw new HttpError(400, "Token reset password tidak valid atau kedaluwarsa", "INVALID_TOKEN");
  }
  if ((payload.attempts || 0) >= (payload.maxAttempts || RESET_MAX_OTP_ATTEMPTS)) {
    throw new HttpError(423, "OTP diblokir karena terlalu banyak percobaan", "OTP_LOCKED");
  }
  const incomingHash = crypto.createHash("sha256").update(String(otp)).digest("hex");
  if (incomingHash !== payload.otpHash) {
    payload.attempts = (payload.attempts || 0) + 1;
    const ttl = await getRedis().ttl(key);
    if (ttl > 0) await getRedis().set(key, JSON.stringify(payload), "EX", ttl);
    if ((payload.attempts || 0) >= (payload.maxAttempts || RESET_MAX_OTP_ATTEMPTS)) {
      throw new HttpError(423, "OTP diblokir karena terlalu banyak percobaan", "OTP_LOCKED");
    }
    throw new HttpError(400, "OTP tidak valid", "INVALID_OTP");
  }
  return { ok: true };
}

async function resetPassword({ token, otp, newPassword }) {
  if (!token || !otp || !newPassword) {
    throw new HttpError(400, "Token, OTP, atau password baru tidak lengkap", "BAD_REQUEST");
  }
  if (String(newPassword).length < 8) {
    throw new HttpError(422, "Password minimal 8 karakter", "WEAK_PASSWORD");
  }
  const key = "reset:" + token;
  const raw = await getRedis().get(key);
  const payload = parseResetPayload(raw);
  if (!payload || !payload.userId || !payload.otpHash) {
    throw new HttpError(400, "Token reset password tidak valid atau kedaluwarsa", "INVALID_TOKEN");
  }
  await verifyResetOtp({ token, otp });
  const passwordHash = await bcrypt.hash(String(newPassword), 12);
  try {
    await prisma.pengguna.update({ where: { id: payload.userId }, data: { passwordHash } });
  } catch (err) {
    mapDatabaseAvailabilityError(err);
  }
  await getRedis().del(key);
  return { ok: true };
}

async function ubahPassword({ userId, passwordLama, passwordBaru }) {
  if (!passwordBaru || String(passwordBaru).length < 8) {
    throw new HttpError(422, "Password baru minimal 8 karakter", "WEAK_PASSWORD");
  }
  let user;
  try {
    user = await prisma.pengguna.findUnique({ where: { id: userId } });
  } catch (err) {
    mapDatabaseAvailabilityError(err);
  }
  if (!user) throw new HttpError(404, "Pengguna tidak ditemukan", "NOT_FOUND");
  const ok = await bcrypt.compare(String(passwordLama || ""), user.passwordHash);
  if (!ok) throw new HttpError(401, "Password lama salah", "INVALID_OLD_PASSWORD");
  const passwordHash = await bcrypt.hash(String(passwordBaru), 12);
  try {
    await prisma.pengguna.update({ where: { id: userId }, data: { passwordHash } });
  } catch (err) {
    mapDatabaseAvailabilityError(err);
  }
  return { ok: true };
}

module.exports = {
  login,
  registerSppg,
  refreshAccessToken,
  logout,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  ubahPassword,
  getThemePreference,
  setThemePreference,
  THEME_MODES,
  publicUser,
  buildAccessToken,
  buildRefreshToken,
};
