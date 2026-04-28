"use strict";

const notif = require("../services/notifikasi.service");
const { sukses } = require("../utils/response");

async function getList(req, res, next) {
  try {
    const list = await notif.listForUser(req.user.userId);
    const jumlahBelumDibaca = await notif.jumlahBelumDibaca(req.user.userId);
    return sukses(res, { items: list, jumlahBelumDibaca });
  } catch (err) {
    next(err);
  }
}

async function patchTandaiDibaca(req, res, next) {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length) await notif.tandaiDibaca(req.user.userId, ids);
    return sukses(res, null, "Notifikasi ditandai dibaca");
  } catch (err) {
    next(err);
  }
}

async function patchTandaiSemua(req, res, next) {
  try {
    await notif.tandaiSemuaDibaca(req.user.userId);
    return sukses(res, null, "Semua notifikasi ditandai dibaca");
  } catch (err) {
    next(err);
  }
}

module.exports = { getList, patchTandaiDibaca, patchTandaiSemua };
