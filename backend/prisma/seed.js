"use strict";

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const dayjs = require("dayjs");

const prisma = new PrismaClient();

const ENC_KEY_RAW = process.env.DATA_ENCRYPTION_KEY || "please-change-this-32-byte-aes-key!!";
const ENC_KEY = crypto.createHash("sha256").update(ENC_KEY_RAW).digest();

function encryptText(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function hashNik(nik) {
  return crypto.createHmac("sha256", ENC_KEY).update(String(nik)).digest("hex");
}

function maskNik(nik) {
  const s = String(nik);
  if (s.length < 8) return s;
  return s.slice(0, 4) + "********" + s.slice(-4);
}

const SPPG_SAMPLES = [
  {
    kodeSppg: "SPPG-JKT-001",
    namaSppg: "SPPG Jakarta Pusat 1",
    alamat: "Jl. Medan Merdeka Selatan No. 1, Jakarta Pusat",
    latitude: -6.175392,
    longitude: 106.827153,
    provinsi: "DKI Jakarta",
    kabupatenKota: "Jakarta Pusat",
    kecamatan: "Gambir",
    kapasitasPorsiPerHari: 2500,
    mitraPengelola: "Yayasan Gizi Nusantara",
    kontakPenanggungJawab: "Andi Saputra",
    telepon: "021-12345678",
  },
  {
    kodeSppg: "SPPG-BDG-001",
    namaSppg: "SPPG Bandung Kota 1",
    alamat: "Jl. Asia Afrika No. 100, Bandung",
    latitude: -6.921657,
    longitude: 107.610476,
    provinsi: "Jawa Barat",
    kabupatenKota: "Kota Bandung",
    kecamatan: "Sumur Bandung",
    kapasitasPorsiPerHari: 2200,
    mitraPengelola: "Koperasi Pangan Sehat",
    kontakPenanggungJawab: "Siti Rohmah",
    telepon: "022-87654321",
  },
  {
    kodeSppg: "SPPG-SBY-001",
    namaSppg: "SPPG Surabaya Timur 1",
    alamat: "Jl. Raya Manyar No. 50, Surabaya",
    latitude: -7.290639,
    longitude: 112.738289,
    provinsi: "Jawa Timur",
    kabupatenKota: "Kota Surabaya",
    kecamatan: "Gubeng",
    kapasitasPorsiPerHari: 2400,
    mitraPengelola: "PT Gizi Sejahtera",
    kontakPenanggungJawab: "Bambang Wijaya",
    telepon: "031-1122334",
  },
  {
    kodeSppg: "SPPG-MKS-001",
    namaSppg: "SPPG Makassar 1",
    alamat: "Jl. Pengayoman No. 25, Makassar",
    latitude: -5.144977,
    longitude: 119.422856,
    provinsi: "Sulawesi Selatan",
    kabupatenKota: "Kota Makassar",
    kecamatan: "Panakkukang",
    kapasitasPorsiPerHari: 1800,
    mitraPengelola: "Yayasan Bumi Sulawesi",
    kontakPenanggungJawab: "Hasanuddin",
    telepon: "0411-998877",
  },
  {
    kodeSppg: "SPPG-MDN-001",
    namaSppg: "SPPG Medan Petisah 1",
    alamat: "Jl. Gatot Subroto No. 88, Medan",
    latitude: 3.595196,
    longitude: 98.672226,
    provinsi: "Sumatera Utara",
    kabupatenKota: "Kota Medan",
    kecamatan: "Medan Petisah",
    kapasitasPorsiPerHari: 2000,
    mitraPengelola: "PT Sumatra Pangan",
    kontakPenanggungJawab: "Maria Sitanggang",
    telepon: "061-77665544",
  },
];

function generateNik(seed) {
  const provCode = String(11 + (seed % 30)).padStart(2, "0");
  const kabCode = String(1 + (seed % 70)).padStart(2, "0");
  const kecCode = String(1 + (seed % 40)).padStart(2, "0");
  const tgl = String(1 + (seed % 28)).padStart(2, "0");
  const bln = String(1 + (seed % 12)).padStart(2, "0");
  const thn = String(2010 + (seed % 15)).slice(-2);
  const urut = String(1 + seed).padStart(4, "0");
  return provCode + kabCode + kecCode + tgl + bln + thn + urut;
}

const KATEGORI = ["PESERTA_DIDIK", "BALITA", "IBU_HAMIL", "IBU_MENYUSUI"];
const NAMA_DEPAN = [
  "Adi", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hadi",
  "Indah", "Joko", "Kartika", "Lukman", "Maya", "Nadia", "Oka",
  "Putri", "Rama", "Sari", "Tono", "Umi",
];
const NAMA_BELAKANG = [
  "Saputra", "Pratama", "Wijaya", "Lestari", "Anggraini",
  "Setiawan", "Kusuma", "Permana", "Hidayat", "Maulana",
];

async function main() {
  console.log("Seeding SIPGN-BGN database...");

  const passwordHash = await bcrypt.hash("Admin@123!", 12);
  const operatorHash = await bcrypt.hash("Operator@123!", 12);
  const pengawasHash = await bcrypt.hash("Pengawas@123!", 12);

  // SPPG
  const sppgRecords = [];
  for (const s of SPPG_SAMPLES) {
    const created = await prisma.sppg.upsert({
      where: { kodeSppg: s.kodeSppg },
      update: {},
      create: s,
    });
    sppgRecords.push(created);
  }

  // Admin
  const admin = await prisma.pengguna.upsert({
    where: { username: "admin" },
    update: {
      email: "bgnengineer@gmail.com",
      passwordHash,
      namaLengkap: "Administrator BGN",
      peran: "ADMIN",
      statusAktif: true,
    },
    create: {
      username: "admin",
      email: "bgnengineer@gmail.com",
      passwordHash,
      namaLengkap: "Administrator BGN",
      peran: "ADMIN",
    },
  });

  // Pejabat
  await prisma.pengguna.upsert({
    where: { username: "pejabat" },
    update: {},
    create: {
      username: "pejabat",
      email: "pejabat@bgn.go.id",
      passwordHash,
      namaLengkap: "Pejabat BGN",
      peran: "PEJABAT_BGN",
    },
  });

  // Pengawas (Jakarta)
  await prisma.pengguna.upsert({
    where: { username: "pengawas_jkt" },
    update: {},
    create: {
      username: "pengawas_jkt",
      email: "pengawas.jkt@bgn.go.id",
      passwordHash: pengawasHash,
      namaLengkap: "Pengawas Gizi DKI Jakarta",
      peran: "PENGAWAS_GIZI",
      wilayahZona: "DKI Jakarta",
    },
  });

  // Operator per SPPG
  const operatorMap = {};
  for (const s of sppgRecords) {
    const username = "op_" + s.kodeSppg.toLowerCase().replace(/[^a-z0-9]/g, "");
    const op = await prisma.pengguna.upsert({
      where: { username },
      update: {},
      create: {
        username,
        email: username + "@bgn.go.id",
        passwordHash: operatorHash,
        namaLengkap: "Operator " + s.namaSppg,
        peran: "OPERATOR_SPPG",
        sppgId: s.id,
      },
    });
    operatorMap[s.id] = op;
  }

  // Penerima manfaat (20 di SPPG pertama, 5 di sisanya)
  let counter = 0;
  for (const s of sppgRecords) {
    const target = s.id === sppgRecords[0].id ? 20 : 5;
    for (let i = 0; i < target; i++) {
      counter++;
      const kategori = KATEGORI[counter % KATEGORI.length];
      const jenisKelamin = kategori === "IBU_HAMIL" || kategori === "IBU_MENYUSUI"
        ? "PEREMPUAN"
        : counter % 2 === 0 ? "LAKI_LAKI" : "PEREMPUAN";

      let tanggalLahir;
      if (kategori === "BALITA") {
        tanggalLahir = dayjs().subtract(6 + (counter % 50), "month").toDate();
      } else if (kategori === "PESERTA_DIDIK") {
        tanggalLahir = dayjs().subtract(7 + (counter % 12), "year").toDate();
      } else {
        tanggalLahir = dayjs().subtract(20 + (counter % 18), "year").toDate();
      }

      const nik = generateNik(counter * 17);
      try {
        await prisma.penerimaManfaat.create({
          data: {
            nikEnc: encryptText(nik),
            nikHash: hashNik(nik),
            nikMasked: maskNik(nik),
            namaLengkap: NAMA_DEPAN[counter % NAMA_DEPAN.length] + " " + NAMA_BELAKANG[counter % NAMA_BELAKANG.length],
            tanggalLahir,
            jenisKelamin,
            kategori,
            satuanPendidikan: kategori === "PESERTA_DIDIK" ? "SDN " + (counter % 12 + 1) + " " + s.kabupatenKota : null,
            sppgId: s.id,
          },
        });
      } catch (e) {
        if (e.code !== "P2002") throw e;
      }
    }
  }

  // Distribusi 30 hari terakhir per SPPG
  for (const s of sppgRecords) {
    const op = operatorMap[s.id];
    for (let d = 30; d >= 1; d--) {
      const tanggal = dayjs().subtract(d, "day").startOf("day").toDate();
      const cap = s.kapasitasPorsiPerHari;
      const realisasi = Math.round(cap * (0.7 + Math.random() * 0.25));
      const pd = Math.round(realisasi * 0.55);
      const ba = Math.round(realisasi * 0.2);
      const ih = Math.round(realisasi * 0.12);
      const im = Math.max(0, realisasi - pd - ba - ih);
      try {
        await prisma.distribusiMbg.create({
          data: {
            sppgId: s.id,
            tanggalDistribusi: tanggal,
            porsiPesertaDidik: pd,
            porsiBalita: ba,
            porsiIbuHamil: ih,
            porsiIbuMenyusui: im,
            totalPorsi: pd + ba + ih + im,
            status: d > 5 ? "TERVALIDASI" : d > 2 ? "TERKONFIRMASI" : "DRAFT",
            operatorId: op.id,
          },
        });
      } catch (e) {
        if (e.code !== "P2002") throw e;
      }
    }
  }

  console.log("Seed selesai. Akun default:");
  console.log("  ADMIN     : admin / Admin@123!");
  console.log("  PEJABAT   : pejabat / Admin@123!");
  console.log("  PENGAWAS  : pengawas_jkt / Pengawas@123!");
  console.log("  OPERATOR  : op_sppg-jkt-001 / Operator@123! (dst untuk SPPG lain)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
