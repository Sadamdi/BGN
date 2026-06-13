"use strict";

const bcrypt = require("bcrypt");
const crypto = require("crypto");

const { prisma } = require("../config/database");
const { sukses } = require("../utils/response");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const { HttpError } = require("../middleware/errorHandler");
const { catatAudit } = require("../middleware/auditTrail");
const { sanitizeString } = require("../utils/sanitize");
const { emailWelcome } = require("../services/email.service");

const ALLOWED_PERAN = ["ADMIN", "PENGAWAS_GIZI", "OPERATOR_SPPG", "ASISTEN_LAPANGAN", "PEJABAT_BGN"];

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    namaLengkap: u.namaLengkap,
    peran: u.peran,
    sppgId: u.sppgId,
    wilayahZona: u.wilayahZona,
    statusAktif: u.statusAktif,
    terakhirLogin: u.terakhirLogin,
    createdAt: u.createdAt,
  };
}

function validatePassword(p) {
  if (!p || p.length < 8) return "Password minimal 8 karakter";
  if (!/[A-Z]/.test(p)) return "Password harus mengandung huruf besar";
  if (!/[a-z]/.test(p)) return "Password harus mengandung huruf kecil";
  if (!/[0-9]/.test(p)) return "Password harus mengandung angka";
  if (!/[^A-Za-z0-9]/.test(p)) return "Password harus mengandung simbol";
  return null;
}

function validateUsername(u) {
  if (!u || u.length < 3 || u.length > 50) return "Username 3-50 karakter";
  if (!/^[A-Za-z0-9_]+$/.test(u)) return "Username hanya boleh huruf, angka, dan underscore";
  return null;
}

async function listPengguna(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 25 });
    const where = {};
    if (req.query.peran) where.peran = req.query.peran;
    if (req.query.statusAktif === "true") where.statusAktif = true;
    if (req.query.statusAktif === "false") where.statusAktif = false;
    if (req.query.search) {
      where.OR = [
        { namaLengkap: { contains: req.query.search, mode: "insensitive" } },
        { username: { contains: req.query.search, mode: "insensitive" } },
        { email: { contains: req.query.search, mode: "insensitive" } },
      ];
    }
    const [data, total] = await Promise.all([
      prisma.pengguna.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { sppg: { select: { id: true, namaSppg: true } } },
      }),
      prisma.pengguna.count({ where }),
    ]);
    return sukses(res, data.map(publicUser), "OK", 200, { pagination: buildPaginationMeta({ total, page, limit }) });
  } catch (err) {
    next(err);
  }
}

async function buatPengguna(req, res, next) {
  try {
    const username = sanitizeString(req.body.username, { maxLength: 50 });
    const email = sanitizeString(req.body.email, { maxLength: 100 });
    const namaLengkap = sanitizeString(req.body.namaLengkap, { maxLength: 150 });
    const peran = req.body.peran;
    const password = req.body.password || crypto.randomBytes(6).toString("base64") + "Aa1!";

    const fields = {};
    const eUsername = validateUsername(username);
    if (eUsername) fields.username = eUsername;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = "Email tidak valid";
    if (!namaLengkap || namaLengkap.length < 2) fields.namaLengkap = "Nama lengkap wajib (min 2 karakter)";
    if (!ALLOWED_PERAN.includes(peran)) fields.peran = "Peran tidak valid";
    if ((peran === "OPERATOR_SPPG" || peran === "ASISTEN_LAPANGAN") && !req.body.sppgId) {
      fields.sppgId = "sppgId wajib untuk peran Operator/Asisten Lapangan";
    }
    if (peran === "PENGAWAS_GIZI" && !req.body.wilayahZona) {
      fields.wilayahZona = "wilayahZona wajib untuk peran Pengawas Gizi";
    }
    const ePass = validatePassword(password);
    if (ePass) fields.password = ePass;

    if (Object.keys(fields).length) {
      return res.status(422).json({ success: false, message: "Validasi gagal", code: "VALIDATION_ERROR", fields });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const created = await prisma.pengguna.create({
      data: {
        username,
        email,
        namaLengkap,
        peran,
        sppgId: req.body.sppgId || null,
        wilayahZona: req.body.wilayahZona || null,
        passwordHash,
      },
    });

    await catatAudit({ tabel: "pengguna", recordId: created.id, aksi: "CREATE", dataBaru: publicUser(created), req });

    emailWelcome({ to: email, namaLengkap, username, password }).catch(() => {});

    return sukses(res, publicUser(created), "Pengguna ditambahkan", 201);
  } catch (err) {
    next(err);
  }
}

async function updatePengguna(req, res, next) {
  try {
    const id = req.params.id;
    const existing = await prisma.pengguna.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Pengguna tidak ditemukan", "NOT_FOUND");

    const data = {};
    if (req.body.namaLengkap) data.namaLengkap = sanitizeString(req.body.namaLengkap, { maxLength: 150 });
    if (req.body.email) data.email = String(req.body.email).toLowerCase().trim();
    if (req.body.peran && ALLOWED_PERAN.includes(req.body.peran)) data.peran = req.body.peran;
    if (req.body.sppgId !== undefined) data.sppgId = req.body.sppgId || null;
    if (req.body.wilayahZona !== undefined) data.wilayahZona = req.body.wilayahZona || null;

    const updated = await prisma.pengguna.update({ where: { id }, data });
    await catatAudit({ tabel: "pengguna", recordId: id, aksi: "UPDATE", dataLama: publicUser(existing), dataBaru: publicUser(updated), req });
    return sukses(res, publicUser(updated), "Pengguna diperbarui");
  } catch (err) {
    next(err);
  }
}

async function resetPasswordOleh(req, res, next) {
  try {
    const id = req.params.id;
    const password = req.body.password || crypto.randomBytes(6).toString("base64") + "Aa1!";
    const ePass = validatePassword(password);
    if (ePass) return res.status(422).json({ success: false, message: ePass, code: "WEAK_PASSWORD" });
    const passwordHash = await bcrypt.hash(password, 12);
    const u = await prisma.pengguna.update({ where: { id }, data: { passwordHash } });
    await catatAudit({ tabel: "pengguna", recordId: id, aksi: "UPDATE", dataBaru: { passwordReset: true }, req });
    return sukses(res, { id, passwordSementara: password }, "Password direset. Sampaikan via kanal aman.");
  } catch (err) {
    next(err);
  }
}

async function toggleStatus(req, res, next) {
  try {
    const id = req.params.id;
    const u = await prisma.pengguna.findUnique({ where: { id } });
    if (!u) throw new HttpError(404, "Pengguna tidak ditemukan", "NOT_FOUND");
    const updated = await prisma.pengguna.update({ where: { id }, data: { statusAktif: !u.statusAktif } });
    await catatAudit({ tabel: "pengguna", recordId: id, aksi: "UPDATE", dataLama: { statusAktif: u.statusAktif }, dataBaru: { statusAktif: updated.statusAktif }, req });
    return sukses(res, publicUser(updated));
  } catch (err) {
    next(err);
  }
}

async function approvePendaftaran(req, res, next) {
  try {
    const id = req.params.id;
    const u = await prisma.pengguna.findUnique({ where: { id } });
    if (!u) throw new HttpError(404, "Pengguna tidak ditemukan", "NOT_FOUND");

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.pengguna.update({ where: { id }, data: { statusAktif: true } });
      if (user.sppgId) {
        await tx.sppg.update({ where: { id: user.sppgId }, data: { statusAktif: true } });
      }
      return user;
    });

    await catatAudit({ tabel: "pengguna", recordId: id, aksi: "UPDATE", dataLama: { statusAktif: false }, dataBaru: { statusAktif: true, approved: true }, req });
    emailWelcome({ to: updated.email, namaLengkap: updated.namaLengkap, username: updated.username, password: "(gunakan password saat registrasi)" }).catch(() => {});
    return sukses(res, publicUser(updated), "Pendaftaran SPPG disetujui");
  } catch (err) {
    next(err);
  }
}

async function tolakPendaftaran(req, res, next) {
  try {
    const id = req.params.id;
    const u = await prisma.pengguna.findUnique({ where: { id } });
    if (!u) throw new HttpError(404, "Pengguna tidak ditemukan", "NOT_FOUND");
    if (u.statusAktif) throw new HttpError(422, "Hanya pendaftaran yang belum aktif dapat ditolak", "ALREADY_ACTIVE");

    const sppgId = u.sppgId;
    await prisma.$transaction(async (tx) => {
      await tx.pengguna.delete({ where: { id } });
      if (sppgId) {
        // Hapus SPPG hasil registrasi hanya bila tidak punya penerima/distribusi & masih nonaktif.
        const sppg = await tx.sppg.findUnique({
          where: { id: sppgId },
          include: { _count: { select: { penerimaManfaat: true, distribusiMbg: true, pengguna: true } } },
        });
        if (sppg && !sppg.statusAktif && sppg._count.penerimaManfaat === 0 && sppg._count.distribusiMbg === 0 && sppg._count.pengguna === 0) {
          await tx.sppg.delete({ where: { id: sppgId } });
        }
      }
    });

    await catatAudit({ tabel: "pengguna", recordId: id, aksi: "DELETE", dataLama: publicUser(u), dataBaru: { ditolak: true }, req });
    return sukses(res, null, "Pendaftaran SPPG ditolak");
  } catch (err) {
    next(err);
  }
}

async function hapusPengguna(req, res, next) {
  try {
    const id = req.params.id;
    const u = await prisma.pengguna.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            distribusiSebagaiOperator: true,
            distribusiSebagaiValidator: true,
            pemantauanGizi: true,
          },
        },
      },
    });
    if (!u) throw new HttpError(404, "Pengguna tidak ditemukan", "NOT_FOUND");
    const punyaTransaksi =
      (u._count.distribusiSebagaiOperator || 0) +
      (u._count.distribusiSebagaiValidator || 0) +
      (u._count.pemantauanGizi || 0);
    if (punyaTransaksi > 0) {
      const updated = await prisma.pengguna.update({ where: { id }, data: { statusAktif: false } });
      await catatAudit({ tabel: "pengguna", recordId: id, aksi: "DELETE", dataLama: publicUser(u), dataBaru: { statusAktif: false }, req });
      return sukses(res, publicUser(updated), "Pengguna memiliki riwayat transaksi -> dinonaktifkan (soft delete)");
    }
    await prisma.pengguna.delete({ where: { id } });
    await catatAudit({ tabel: "pengguna", recordId: id, aksi: "DELETE", dataLama: publicUser(u), req });
    return sukses(res, null, "Pengguna dihapus");
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPengguna,
  buatPengguna,
  updatePengguna,
  resetPasswordOleh,
  toggleStatus,
  approvePendaftaran,
  tolakPendaftaran,
  hapusPengguna,
};
