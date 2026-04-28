"use strict";

const { prisma } = require("../config/database");
const { sukses } = require("../utils/response");

async function getRingkasanPublik(req, res, next) {
  try {
    const tahun = parseInt(req.query.tahun, 10) || new Date().getFullYear();
    const data = await prisma.indikatorPublik.findMany({
      where: { tahun },
      include: {
        sumber: {
          select: {
            slug: true,
            nama: true,
          },
        },
      },
      orderBy: [{ kategori: "asc" }, { indikator: "asc" }],
      take: 500,
    });
    return sukses(res, data, "Ringkasan data publik berhasil dimuat");
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getRingkasanPublik,
};
