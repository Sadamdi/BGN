"use strict";

const rateLimit = require("express-rate-limit");

// Limit global default: 1000 request per menit per IP.
// Cukup longgar untuk monitoring dashboard (5 menit refresh = 5 req),
// polling realtime SSE (long-lived), admin trigger manual cron, dll.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak permintaan. Silakan coba lagi nanti.",
    code: "RATE_LIMITED",
  },
});

// Limit lebih ketat untuk endpoint login (anti brute-force).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak percobaan login. Silakan coba lagi 15 menit kemudian.",
    code: "LOGIN_RATE_LIMITED",
  },
});

module.exports = { globalLimiter, loginLimiter };
