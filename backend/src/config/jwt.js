"use strict";

const ACCESS_SECRET = process.env.JWT_SECRET || "default-jwt-secret-change-me-please-1234";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || ACCESS_SECRET + ":refresh";
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "8h";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "7d";

module.exports = {
  ACCESS_SECRET,
  REFRESH_SECRET,
  ACCESS_EXPIRES,
  REFRESH_EXPIRES,
};
