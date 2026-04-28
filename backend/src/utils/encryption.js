"use strict";

const crypto = require("crypto");

const RAW = process.env.DATA_ENCRYPTION_KEY || "please-change-this-32-byte-aes-key!!";
const KEY = crypto.createHash("sha256").update(RAW).digest();

function encryptText(plain) {
  if (plain === null || plain === undefined) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decryptText(packed) {
  if (!packed) return null;
  try {
    const buf = Buffer.from(packed, "base64");
    const iv = buf.slice(0, 12);
    const tag = buf.slice(12, 28);
    const data = buf.slice(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString("utf8");
  } catch (err) {
    return null;
  }
}

function hashIndex(value) {
  if (value === null || value === undefined) return null;
  return crypto.createHmac("sha256", KEY).update(String(value)).digest("hex");
}

function maskNik(nik) {
  if (!nik) return null;
  const s = String(nik);
  if (s.length < 8) return s;
  return s.slice(0, 4) + "********" + s.slice(-4);
}

module.exports = { encryptText, decryptText, hashIndex, maskNik };
