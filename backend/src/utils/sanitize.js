"use strict";

function sanitizeString(value, { maxLength = 500 } = {}) {
  if (value === null || value === undefined) return value;
  let s = String(value).trim();
  s = s.replace(/[\u0000-\u001f\u007f]/g, "");
  if (s.length > maxLength) s = s.slice(0, maxLength);
  return s;
}

function safeNik(nik) {
  if (!nik) return null;
  return String(nik).replace(/\D/g, "").slice(0, 16);
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) {
      out[k] = obj[k];
    }
  }
  return out;
}

module.exports = { sanitizeString, safeNik, pick };
