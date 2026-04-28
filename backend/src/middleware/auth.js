"use strict";

const jwt = require("jsonwebtoken");
const { ACCESS_SECRET } = require("../config/jwt");
const { getRedis } = require("../config/redis");

async function verifyToken(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        success: false,
        message: "Token autentikasi tidak ditemukan",
        code: "NO_TOKEN",
      });
    }

    let blacklisted = false;
    try {
      blacklisted = (await getRedis().get("blacklist:" + token)) === "1";
    } catch (_) {
      blacklisted = false;
    }
    if (blacklisted) {
      return res.status(401).json({
        success: false,
        message: "Sesi tidak valid. Silakan login kembali.",
        code: "TOKEN_BLACKLISTED",
      });
    }

    let payload;
    try {
      payload = jwt.verify(token, ACCESS_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Sesi berakhir, silakan login kembali",
          code: "TOKEN_EXPIRED",
        });
      }
      return res.status(401).json({
        success: false,
        message: "Token tidak valid",
        code: "TOKEN_INVALID",
      });
    }

    req.user = {
      userId: payload.userId,
      peran: payload.peran,
      sppgId: payload.sppgId || null,
      wilayahZona: payload.wilayahZona || null,
      username: payload.username,
      namaLengkap: payload.namaLengkap,
    };
    req.accessToken = token;
    req.accessTokenExp = payload.exp;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { verifyToken };
