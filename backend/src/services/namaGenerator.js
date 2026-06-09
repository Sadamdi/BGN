"use strict";

// Daftar nama Indonesia yang umum dipakai untuk SPPG/sekolah/posyandu.
// Dipakai saat generator butuh nama penerima fallback (saat tabel pemantauan_gizi
// masih kosong). Bukan sumber resmi, tetapi cukup realistis untuk demo data.
const NAMA_DEPAN_LAKI = [
  "Adi", "Agus", "Ahmad", "Andi", "Ari", "Bambang", "Bayu", "Budi", "Dedi",
  "Dian", "Eko", "Fajar", "Fandi", "Hadi", "Hendra", "Indra", "Jaka", "Joko",
  "Kurniawan", "Lutfi", "Made", "Nanda", "Oki", "Putra", "Rangga", "Reza",
  "Rizky", "Rudi", "Setiawan", "Surya", "Toni", "Tri", "Wahyu", "Wahid",
  "Wawan", "Yanto", "Yusuf", "Zaki", "Aditya", "Bagus", "Dimas",
  "Fikri", "Galih", "Iqbal", "Rifqi", "Satria", "Tegar", "Yudha", "Rizki",
  "Fadhil", "Ilham", "Naufal", "Raihan", "Salman", "Ridwan"
];

const NAMA_DEPAN_PEREMPUAN = [
  "Ani", "Anisa", "Ayu", "Citra", "Dewi", "Diah", "Fitri", "Indah", "Intan",
  "Lestari", "Maya", "Mega", "Mila", "Nadia", "Nita", "Novi", "Putri", "Rani",
  "Ratna", "Rina", "Rini", "Risa", "Rita", "Sari", "Sinta", "Siti", "Sri",
  "Tari", "Tika", "Wati", "Wulan", "Yanti", "Yuli", "Yuni", "Aisyah",
  "Khansa", "Salwa", "Nayla", "Zahra", "Aulia", "Hana", "Kayla", "Nazwa",
  "Aqila", "Raisa", "Sasha", "Nadine", "Keisya", "Aura"
];

const NAMA_BELAKANG = [
  "Wijaya", "Pratama", "Saputra", "Putri", "Lestari", "Wulandari", "Anggraini",
  "Setiawan", "Maulana", "Hidayat", "Sukma", "Pratiwi", "Ananda", "Permata",
  "Ramadhan", "Syahputra", "Lubis", "Halim", "Wijoyo", "Hadi", "Nugroho",
  "Susanto", "Hartono", "Wibowo", "Saputri", "Maharani", "Salim", "Tanuwijaya",
  "Kurniawan", "Firmansyah", "Pangestu", "Cahyani", "Pertiwi", "Handayani",
  "Hutapea", "Manurung", "Siahaan", "Sinaga", "Sihombing", "Pakpahan",
  "Lumbantobing", "Simanjuntak", "Siregar", "Nasution",
  "Harahap", "Pohan", "Sitinjak", "Damanik", "Purba", "Hulu", "Mendrofa",
  "Zebua", "Bachrie", "Tuasela", "Lopulalan", "Kaya",
  "Mamesah", "Kawalo", "Kaunang", "Pangemanan"
];

const AWALAN = ["Muhammad", "Muh.", "M.", "Siti", "Hj.", "Hj"];

function pickRandom(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

function seededRandom(seedText) {
  let h = 0;
  const s = String(seedText || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return () => {
    // Pakai unsigned right shift `>>> 0` di akhir agar hasil selalu 0..1 (non-negatif).
    h = (h * 1664525 + 1013904223) >>> 0;
    return (h >>> 0) / 0x100000000;
  };
}

/**
 * Generate a realistic Indonesian-style name, deterministic by seed.
 * @param {string} seedText - Unique seed (e.g. "sppg-1-2026-06-09-3" )
 * @param {"LAKI_LAKI"|"PEREMPUAN"} [jenisKelamin]
 * @returns {string}
 */
function generateNamaPenerima(seedText, jenisKelamin) {
  const rng = seededRandom(seedText);
  const isLaki = jenisKelamin
    ? jenisKelamin === "LAKI_LAKI"
    : rng() < 0.5;
  const poolDepan = isLaki ? NAMA_DEPAN_LAKI : NAMA_DEPAN_PEREMPUAN;
  let nama = pickRandom(poolDepan, rng);
  if (rng() < 0.4) {
    nama = pickRandom(AWALAN, rng) + " " + nama;
  }
  const belakangCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < belakangCount; i++) {
    nama += " " + pickRandom(NAMA_BELAKANG, rng);
  }
  return nama;
}

module.exports = { generateNamaPenerima, seededRandom };
