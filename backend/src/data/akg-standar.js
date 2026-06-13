"use strict";

/**
 * Standar Angka Kecukupan Gizi (AKG) untuk Program Makan Bergizi Gratis (MBG).
 *
 * Sumber: Pedoman Distribusi Makanan dan Edukasi Gizi pada Program MBG — Badan Gizi Nasional.
 * Nilai per orang per hari: energi (kkal), protein (gram), lemak (gram), karbohidrat (gram).
 *
 * Catatan: pada PDF pedoman, tabel terakhir (Anak Balita Non-PAUD) sempat salah label
 * menjadi "Ibu Menyusui". Nilai yang dipakai di sini adalah nilai untuk BALITA non-PAUD
 * (1-3 tahun & 4-6 tahun) sesuai konteks tabel tersebut.
 */

// Tabel detail per sub-kelompok (untuk halaman referensi).
const AKG_TABEL = Object.freeze({
  BALITA: {
    label: "Anak Balita Non-PAUD",
    satuanKelompok: "usia",
    kelompok: [
      { kunci: "1-3", label: "1 - 3 tahun", energiKkal: 1350, proteinG: 20, lemakG: 45, karbohidratG: 215 },
      { kunci: "4-6", label: "4 - 6 tahun", energiKkal: 1400, proteinG: 25, lemakG: 50, karbohidratG: 220 },
    ],
  },
  IBU_HAMIL: {
    label: "Ibu Hamil",
    satuanKelompok: "trimester",
    kelompok: [
      { kunci: "TM1", label: "Trimester I", energiKkal: 2330, proteinG: 61, lemakG: 62.3, karbohidratG: 365 },
      { kunci: "TM2", label: "Trimester II", energiKkal: 2450, proteinG: 70, lemakG: 62.3, karbohidratG: 380 },
      { kunci: "TM3", label: "Trimester III", energiKkal: 2450, proteinG: 90, lemakG: 62.3, karbohidratG: 380 },
    ],
  },
  IBU_MENYUSUI: {
    label: "Ibu Menyusui",
    satuanKelompok: "periode",
    kelompok: [
      { kunci: "6BLN_1", label: "6 bulan pertama", energiKkal: 2580, proteinG: 80, lemakG: 67.2, karbohidratG: 405 },
      { kunci: "6BLN_2", label: "6 bulan kedua", energiKkal: 2650, proteinG: 75, lemakG: 67.2, karbohidratG: 415 },
    ],
  },
  // Peserta didik (sekolah): AKG umum per kelompok umur (AKG 2019 Permenkes 28/2019).
  PESERTA_DIDIK: {
    label: "Peserta Didik (Sekolah)",
    satuanKelompok: "usia",
    kelompok: [
      { kunci: "7-9", label: "7 - 9 tahun", energiKkal: 1650, proteinG: 40, lemakG: 55, karbohidratG: 250 },
      { kunci: "10-12", label: "10 - 12 tahun", energiKkal: 2000, proteinG: 50, lemakG: 65, karbohidratG: 300 },
      { kunci: "13-15", label: "13 - 15 tahun", energiKkal: 2400, proteinG: 70, lemakG: 80, karbohidratG: 350 },
      { kunci: "16-18", label: "16 - 18 tahun", energiKkal: 2650, proteinG: 75, lemakG: 85, karbohidratG: 400 },
    ],
  },
});

/**
 * Program MBG memberi 1 kali makan yang menyumbang sebagian AKG harian.
 * Pedoman: porsi MBG menargetkan ~30-35% AKG harian (memakai 30% sebagai dasar).
 */
const PORSI_AKG_MBG = 0.3;

function clampUsiaBulan(usiaBulan) {
  const n = Number(usiaBulan);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Pilih baris standar AKG yang relevan untuk seorang penerima.
 * @param {string} kategori - PESERTA_DIDIK | BALITA | IBU_HAMIL | IBU_MENYUSUI
 * @param {object} opts - { usiaBulan, trimester, periodeMenyusui }
 * @returns baris kelompok AKG atau null bila tidak ada.
 */
function pilihStandarAKG(kategori, opts = {}) {
  const tabel = AKG_TABEL[kategori];
  if (!tabel) return null;
  const kelompok = tabel.kelompok;

  if (kategori === "BALITA") {
    const bln = clampUsiaBulan(opts.usiaBulan);
    if (bln === null) return kelompok[0];
    return bln < 48 ? kelompok[0] : kelompok[1]; // <4 thn -> 1-3, >=4 thn -> 4-6
  }

  if (kategori === "PESERTA_DIDIK") {
    const bln = clampUsiaBulan(opts.usiaBulan);
    const tahun = bln === null ? null : bln / 12;
    if (tahun === null) return kelompok[1];
    if (tahun < 10) return kelompok[0];
    if (tahun < 13) return kelompok[1];
    if (tahun < 16) return kelompok[2];
    return kelompok[3];
  }

  if (kategori === "IBU_HAMIL") {
    const t = Number(opts.trimester);
    if (t === 1) return kelompok[0];
    if (t === 3) return kelompok[2];
    return kelompok[1]; // default Trimester II
  }

  if (kategori === "IBU_MENYUSUI") {
    return opts.periodeMenyusui === "6BLN_2" ? kelompok[1] : kelompok[0];
  }

  return kelompok[0];
}

function pct(nilai, target) {
  if (!Number.isFinite(target) || target <= 0) return null;
  return Math.round((Number(nilai || 0) / target) * 1000) / 10; // 1 desimal
}

/**
 * Hitung persentase pemenuhan AKG dari asupan satu porsi MBG terhadap target porsi MBG.
 * @param {object} p - { kategori, usiaBulan, trimester, periodeMenyusui, energiKkal, proteinG, lemakG, karbohidratG }
 * @returns { standar, targetPorsi, pemenuhan:{energi,protein,lemak,karbohidrat}, rataRata }
 */
function hitungPemenuhanAKG(p = {}) {
  const standar = pilihStandarAKG(p.kategori, p);
  if (!standar) return null;

  const targetPorsi = {
    energiKkal: Math.round(standar.energiKkal * PORSI_AKG_MBG),
    proteinG: Math.round(standar.proteinG * PORSI_AKG_MBG * 10) / 10,
    lemakG: Math.round(standar.lemakG * PORSI_AKG_MBG * 10) / 10,
    karbohidratG: Math.round(standar.karbohidratG * PORSI_AKG_MBG * 10) / 10,
  };

  const pemenuhan = {
    energi: pct(p.energiKkal, targetPorsi.energiKkal),
    protein: pct(p.proteinG, targetPorsi.proteinG),
    lemak: pct(p.lemakG, targetPorsi.lemakG),
    karbohidrat: pct(p.karbohidratG, targetPorsi.karbohidratG),
  };

  const vals = [pemenuhan.energi, pemenuhan.protein, pemenuhan.lemak, pemenuhan.karbohidrat].filter(
    (v) => Number.isFinite(v)
  );
  const rataRata = vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;

  return { standar, targetPorsi, pemenuhan, rataRata, porsiAkg: PORSI_AKG_MBG };
}

module.exports = {
  AKG_TABEL,
  PORSI_AKG_MBG,
  pilihStandarAKG,
  hitungPemenuhanAKG,
};
