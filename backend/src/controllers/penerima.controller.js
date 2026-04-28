"use strict";

const dayjs = require("dayjs");
const ExcelJS = require("exceljs");

const { prisma } = require("../config/database");
const { sukses } = require("../utils/response");
const { buildSppgFilter } = require("../middleware/rbac");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const { encryptText, decryptText, hashIndex, maskNik } = require("../utils/encryption");
const { catatAudit } = require("../middleware/auditTrail");
const { invalidatePrefix } = require("../services/cache.service");
const { HttpError } = require("../middleware/errorHandler");
const { safeNik, sanitizeString } = require("../utils/sanitize");

function hitungUsia(tanggalLahir) {
  const lahir = dayjs(tanggalLahir);
  const now = dayjs();
  const totalBulan = now.diff(lahir, "month");
  const tahun = Math.floor(totalBulan / 12);
  const bulan = totalBulan % 12;
  return { usiaBulan: totalBulan, usiaTahun: tahun, usiaBulanSisa: bulan, label: tahun + " thn " + bulan + " bln" };
}

function validateKategoriUsia(kategori, usiaBulan) {
  if (kategori === "BALITA" && (usiaBulan < 0 || usiaBulan > 60)) {
    return "Kategori BALITA hanya untuk usia 0-60 bulan";
  }
  if (kategori === "PESERTA_DIDIK" && usiaBulan < 5 * 12) {
    return "Kategori PESERTA_DIDIK hanya untuk usia minimal 5 tahun";
  }
  return null;
}

async function listPenerima(req, res, next) {
  try {
    const user = req.user;
    const sppgFilter = buildSppgFilter(user);
    const { page, limit, skip } = parsePagination(req.query);

    const where = {
      ...(sppgFilter.sppgId ? { sppgId: sppgFilter.sppgId } : {}),
      ...(sppgFilter.sppg ? { sppg: sppgFilter.sppg } : {}),
    };

    if (req.query.kategori) where.kategori = req.query.kategori;
    if (req.query.sppgId) where.sppgId = req.query.sppgId;
    if (req.query.statusAktif === "true") where.statusAktif = true;
    if (req.query.statusAktif === "false") where.statusAktif = false;

    const search = req.query.search ? String(req.query.search).trim() : "";
    if (search) {
      const onlyDigits = search.replace(/\D/g, "");
      const ors = [{ namaLengkap: { contains: search, mode: "insensitive" } }];
      if (onlyDigits.length === 16) {
        ors.push({ nikHash: hashIndex(onlyDigits) });
      } else if (onlyDigits.length >= 4) {
        ors.push({ nikMasked: { contains: onlyDigits } });
      }
      where.OR = ors;
    }

    const [data, total] = await Promise.all([
      prisma.penerimaManfaat.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          sppg: { select: { id: true, namaSppg: true, provinsi: true } },
          pemantauanGizi: {
            orderBy: { tanggalPengukuran: "desc" },
            take: 1,
            select: { statusGizi: true, tanggalPengukuran: true },
          },
        },
      }),
      prisma.penerimaManfaat.count({ where }),
    ]);

    const items = data.map((p) => {
      const usia = hitungUsia(p.tanggalLahir);
      const last = p.pemantauanGizi[0];
      return {
        id: p.id,
        nikMasked: p.nikMasked,
        namaLengkap: p.namaLengkap,
        tanggalLahir: p.tanggalLahir,
        jenisKelamin: p.jenisKelamin,
        kategori: p.kategori,
        satuanPendidikan: p.satuanPendidikan,
        sppgId: p.sppgId,
        sppg: p.sppg,
        statusAktif: p.statusAktif,
        usiaBulan: usia.usiaBulan,
        usiaTahun: usia.usiaTahun,
        usiaLabel: usia.label,
        statusGiziTerakhir: last ? last.statusGizi : null,
        tanggalPengukuranTerakhir: last ? last.tanggalPengukuran : null,
      };
    });

    return sukses(res, items, "OK", 200, { pagination: buildPaginationMeta({ total, page, limit }) });
  } catch (err) {
    next(err);
  }
}

async function detailPenerima(req, res, next) {
  try {
    const id = req.params.id;
    const sppgFilter = buildSppgFilter(req.user);
    const p = await prisma.penerimaManfaat.findFirst({
      where: {
        id,
        ...(sppgFilter.sppgId ? { sppgId: sppgFilter.sppgId } : {}),
        ...(sppgFilter.sppg ? { sppg: sppgFilter.sppg } : {}),
      },
      include: {
        sppg: true,
        pemantauanGizi: {
          orderBy: { tanggalPengukuran: "desc" },
          take: 5,
        },
      },
    });
    if (!p) throw new HttpError(404, "Penerima manfaat tidak ditemukan", "NOT_FOUND");

    const usia = hitungUsia(p.tanggalLahir);
    return sukses(res, {
      id: p.id,
      nikMasked: p.nikMasked,
      namaLengkap: p.namaLengkap,
      tanggalLahir: p.tanggalLahir,
      jenisKelamin: p.jenisKelamin,
      kategori: p.kategori,
      satuanPendidikan: p.satuanPendidikan,
      sppgId: p.sppgId,
      sppg: p.sppg,
      statusAktif: p.statusAktif,
      usia,
      pemantauanGizi: p.pemantauanGizi,
    });
  } catch (err) {
    next(err);
  }
}

function resolveSppgIdForCreate(req) {
  const peran = req.user.peran;
  if (peran === "OPERATOR_SPPG" || peran === "ASISTEN_LAPANGAN") return req.user.sppgId;
  return req.body.sppgId;
}

async function buatPenerima(req, res, next) {
  try {
    const sppgId = resolveSppgIdForCreate(req);
    if (!sppgId) throw new HttpError(422, "sppgId wajib diisi", "VALIDATION_ERROR");

    const nik = safeNik(req.body.nik);
    if (!nik || nik.length !== 16) throw new HttpError(422, "NIK harus 16 digit angka", "VALIDATION_ERROR");

    const namaLengkap = sanitizeString(req.body.namaLengkap, { maxLength: 150 });
    if (!namaLengkap || namaLengkap.length < 2) throw new HttpError(422, "Nama lengkap wajib (min 2 karakter)", "VALIDATION_ERROR");

    const tgl = new Date(req.body.tanggalLahir);
    if (Number.isNaN(tgl.getTime()) || tgl > new Date()) {
      throw new HttpError(422, "Tanggal lahir tidak valid", "VALIDATION_ERROR");
    }

    const kategori = req.body.kategori;
    if (!["PESERTA_DIDIK", "BALITA", "IBU_HAMIL", "IBU_MENYUSUI"].includes(kategori)) {
      throw new HttpError(422, "Kategori tidak valid", "VALIDATION_ERROR");
    }

    const usia = hitungUsia(tgl);
    const errKat = validateKategoriUsia(kategori, usia.usiaBulan);
    if (errKat) throw new HttpError(422, errKat, "VALIDATION_ERROR");

    const jenisKelamin = req.body.jenisKelamin;
    if (!["LAKI_LAKI", "PEREMPUAN"].includes(jenisKelamin)) {
      throw new HttpError(422, "Jenis kelamin tidak valid", "VALIDATION_ERROR");
    }

    const created = await prisma.penerimaManfaat.create({
      data: {
        nikEnc: encryptText(nik),
        nikHash: hashIndex(nik),
        nikMasked: maskNik(nik),
        namaLengkap,
        tanggalLahir: tgl,
        jenisKelamin,
        kategori,
        satuanPendidikan: sanitizeString(req.body.satuanPendidikan, { maxLength: 150 }) || null,
        sppgId,
      },
    });

    await catatAudit({
      tabel: "penerima_manfaat",
      recordId: created.id,
      aksi: "CREATE",
      dataBaru: { id: created.id, namaLengkap, kategori, sppgId },
      req,
    });
    invalidatePrefix("dashboard:");

    return sukses(res, { id: created.id, namaLengkap, nikMasked: created.nikMasked }, "Penerima manfaat ditambahkan", 201);
  } catch (err) {
    next(err);
  }
}

async function updatePenerima(req, res, next) {
  try {
    const id = req.params.id;
    const existing = await prisma.penerimaManfaat.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Penerima manfaat tidak ditemukan", "NOT_FOUND");

    if (req.user.peran === "OPERATOR_SPPG" && existing.sppgId !== req.user.sppgId) {
      throw new HttpError(403, "Anda hanya boleh mengubah data SPPG sendiri", "FORBIDDEN");
    }

    const data = {};
    if (req.body.namaLengkap !== undefined) data.namaLengkap = sanitizeString(req.body.namaLengkap, { maxLength: 150 });
    if (req.body.tanggalLahir) data.tanggalLahir = new Date(req.body.tanggalLahir);
    if (req.body.jenisKelamin) data.jenisKelamin = req.body.jenisKelamin;
    if (req.body.kategori) data.kategori = req.body.kategori;
    if (req.body.satuanPendidikan !== undefined) data.satuanPendidikan = sanitizeString(req.body.satuanPendidikan, { maxLength: 150 });

    if (data.tanggalLahir && data.kategori) {
      const u = hitungUsia(data.tanggalLahir);
      const errKat = validateKategoriUsia(data.kategori, u.usiaBulan);
      if (errKat) throw new HttpError(422, errKat, "VALIDATION_ERROR");
    }

    if (req.body.nik) {
      const nik = safeNik(req.body.nik);
      if (!nik || nik.length !== 16) throw new HttpError(422, "NIK harus 16 digit", "VALIDATION_ERROR");
      data.nikEnc = encryptText(nik);
      data.nikHash = hashIndex(nik);
      data.nikMasked = maskNik(nik);
    }

    const updated = await prisma.penerimaManfaat.update({ where: { id }, data });

    await catatAudit({
      tabel: "penerima_manfaat",
      recordId: id,
      aksi: "UPDATE",
      dataLama: { namaLengkap: existing.namaLengkap, kategori: existing.kategori },
      dataBaru: data,
      req,
    });
    invalidatePrefix("dashboard:");

    return sukses(res, { id: updated.id }, "Data penerima diperbarui");
  } catch (err) {
    next(err);
  }
}

async function nonaktifkanPenerima(req, res, next) {
  try {
    if (req.body.konfirmasi !== true) {
      throw new HttpError(400, "Diperlukan konfirmasi: { konfirmasi: true }", "CONFIRMATION_REQUIRED");
    }
    const id = req.params.id;
    const existing = await prisma.penerimaManfaat.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Penerima manfaat tidak ditemukan", "NOT_FOUND");

    if (req.user.peran === "OPERATOR_SPPG" && existing.sppgId !== req.user.sppgId) {
      throw new HttpError(403, "Anda hanya boleh menonaktifkan data SPPG sendiri", "FORBIDDEN");
    }

    await prisma.penerimaManfaat.update({ where: { id }, data: { statusAktif: false } });
    await catatAudit({ tabel: "penerima_manfaat", recordId: id, aksi: "DELETE", dataLama: existing, req });
    invalidatePrefix("dashboard:");
    return sukses(res, null, "Penerima manfaat dinonaktifkan");
  } catch (err) {
    next(err);
  }
}

const TEMPLATE_HEADER = [
  "NIK",
  "Nama Lengkap",
  "Tanggal Lahir (DD/MM/YYYY)",
  "Jenis Kelamin",
  "Kategori",
  "Satuan Pendidikan",
];

async function templateExcel(req, res, next) {
  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Penerima Manfaat");
    ws.columns = TEMPLATE_HEADER.map((h) => ({ header: h, width: 28 }));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1B3A6B" },
    };
    ws.addRow([
      "1234567890123456",
      "Contoh Nama",
      "01/01/2018",
      "LAKI_LAKI",
      "BALITA",
      "Posyandu Mawar",
    ]);

    ws.getCell("D2").dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"LAKI_LAKI,PEREMPUAN"'],
    };
    ws.getCell("E2").dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"PESERTA_DIDIK,BALITA,IBU_HAMIL,IBU_MENYUSUI"'],
    };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="Template_Penerima_Manfaat.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

async function importExcel(req, res, next) {
  try {
    if (!req.file) throw new HttpError(400, "File Excel wajib diunggah (field 'file')", "FILE_REQUIRED");

    const sppgId = req.user.peran === "ADMIN"
      ? (req.body.sppgId || null)
      : req.user.sppgId;
    if (!sppgId) throw new HttpError(422, "sppgId wajib", "VALIDATION_ERROR");

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new HttpError(400, "File Excel kosong", "EMPTY_FILE");

    let berhasil = 0;
    const errors = [];
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      rows.push({ rowNumber, values: row.values });
    });

    for (const r of rows) {
      try {
        const v = r.values;
        const nik = safeNik(v[1]);
        const namaLengkap = sanitizeString(v[2], { maxLength: 150 });
        let tanggal;
        if (v[3] instanceof Date) tanggal = v[3];
        else {
          const m = String(v[3] || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (!m) throw new Error("Tanggal lahir harus format DD/MM/YYYY");
          tanggal = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        }
        const jk = String(v[4] || "").toUpperCase();
        const kategori = String(v[5] || "").toUpperCase();
        const satuanPendidikan = v[6] ? sanitizeString(v[6], { maxLength: 150 }) : null;

        if (!nik || nik.length !== 16) throw new Error("NIK harus 16 digit");
        if (!namaLengkap) throw new Error("Nama lengkap wajib");
        if (!["LAKI_LAKI", "PEREMPUAN"].includes(jk)) throw new Error("Jenis Kelamin tidak valid");
        if (!["PESERTA_DIDIK", "BALITA", "IBU_HAMIL", "IBU_MENYUSUI"].includes(kategori)) throw new Error("Kategori tidak valid");

        const usia = hitungUsia(tanggal);
        const errKat = validateKategoriUsia(kategori, usia.usiaBulan);
        if (errKat) throw new Error(errKat);

        await prisma.penerimaManfaat.create({
          data: {
            nikEnc: encryptText(nik),
            nikHash: hashIndex(nik),
            nikMasked: maskNik(nik),
            namaLengkap,
            tanggalLahir: tanggal,
            jenisKelamin: jk,
            kategori,
            satuanPendidikan,
            sppgId,
          },
        });
        berhasil++;
      } catch (e) {
        errors.push({ baris: r.rowNumber, pesan: e.message });
      }
    }

    invalidatePrefix("dashboard:");
    return sukses(res, { berhasil, gagal: errors.length, errors }, "Import selesai");
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPenerima,
  detailPenerima,
  buatPenerima,
  updatePenerima,
  nonaktifkanPenerima,
  templateExcel,
  importExcel,
  hitungUsia,
};
