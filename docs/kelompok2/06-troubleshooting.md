# Troubleshooting & FAQ Operasional

FAQ untuk issue yang sering muncul di development/production. Disusun berdasarkan pengalaman tim selama development & deploy SIPGN-BGN.

---

## Deploy

### Vercel tidak auto-deploy setelah git push

**Gejala**: Push commit ke `main` tapi `latestDeployment` di Vercel API masih SHA lama.

**Penyebab umum**:
1. Project Vercel di-pause / tidak aktif (`live: false`).
2. GitHub integration terputus (perlu re-connect di Settings -> Git).
3. Push tidak melalui branch yang dipantau (default `main`).

**Solusi**:
- Buka Vercel dashboard, project `bgn`, pastikan status aktif.
- Settings -> Git -> Reconnect ke `Sadamdi/BGN`.
- Cek commit author email cocok dengan Vercel account email (kalau tidak, deploy ditolak dengan error author verification).
- Manual: klik "Deploy" di Vercel dashboard untuk trigger manual dari commit tertentu.

### Build gagal: `functions` + `builds` conflict

**Gejala**: Deploy error `The functions property cannot be used in conjunction with the builds property`.

**Solusi**: Pindahkan `maxDuration` ke `builds[].config`:
```json
{
  "builds": [
    { "src": "backend/api/index.js", "use": "@vercel/node", "config": { "maxDuration": 300 } }
  ]
}
```

### 401 Unauthorized di endpoint cron

**Gejala**: `POST /api/cron/daily-generate` return 401.

**Solusi**: Set `CRON_SECRET` di Vercel env vars (Settings -> Environment Variables, Production). Vercel Cron mengirim `Authorization: Bearer <CRON_SECRET>`. Generate baru: `openssl rand -base64 48`. Tombol UI "Trigger Cron" di dashboard tidak butuh CRON_SECRET (pakai token admin).

### Vercel Security Checkpoint (403 HTML page)

**Gejala**: Request dari script/curl dapat halaman HTML "Vercel Security Checkpoint" bukan JSON API.

**Solusi**:
- Buka URL di browser biasa (JS challenge lulus otomatis).
- Pakai Vercel MCP `get_access_to_vercel_url` untuk share link 23 jam.
- Pakai MCP `web_fetch_vercel_url` yang sudah terautentikasi.

---

## Database

### 504 Gateway Timeout saat trigger cron

**Gejala**: Trigger `backfill-30d` timeout setelah 5 menit.

**Penyebab**: Vercel Hobby `maxDuration: 300s` (5 menit). Insert 30 hari × 3.354 SPPG = 100k row + 100k pemantauan.

**Solusi**:
- Pakai `createMany` dengan batch 50-100 row (sudah di `dummyNutrition.service.js`).
- `backfillDays` lebih kecil (7 hari dulu, lalu 7 lagi).
- Naikkan plan ke Pro (maxDuration 800s, 8x concurrent).
- Tambah index pada `distribusi_mbg(sppgId, tanggalDistribusi) WHERE tanggalDistribusi >= ?` (partial index).

### Tren 30 hari kosong sebelum tanggal tertentu

**Gejala**: Chart tren distribusi kosong sebelum tanggal X.

**Penyebab**: Generator baru jalan generate 3 slice (kemarin/hari ini/besok). Historis 30 hari sebelumnya belum pernah di-generate.

**Solusi**: Klik **Backfill 30 Hari (Realistis)** di dashboard. Atau klik **Reset Data Dummy** (double-confirm) yang otomatis trigger backfill 30 hari. Tunggu 1-3 menit.

### Nama "Dummy PESERTA DIDIK 1-1" di laporan

**Gejala**: Laporan Status Gizi tampil nama "Dummy X-N" dari fallback.

**Penyebab**: Tabel `pemantauan_gizi` kosong, fallback generator di `laporan.service.js:previewStatusGizi` pakai nama hardcode.

**Solusi**: Sudah fix — fallback sekarang pakai `generateNamaPenerima()` dari [namaGenerator.js](../../backend/src/services/namaGenerator.js) (pool nama Indonesia realistic). Klik Backfill untuk populate nama baru.

---

## Sinkronisasi Data

### Dashboard "Distribusi Hari Ini" 0 padahal tren terisi

**Root Cause (paling umum)**: Timezone mismatch. Server Vercel region `iad1` jalan di UTC. Generator `dummyNutrition.service.js` menyimpan `tanggalDistribusi` dalam timezone Asia/Jakarta (WIB). Query dashboard lama pakai `new Date()` (UTC).

Contoh 10 Juni pukul 08:00 WIB:
- Generator insert tanggal distribusi 10 Juni WIB → `2026-06-09T17:00:00.000Z` (UTC)
- Query `startOfDay(new Date())` server UTC → `2026-06-10T00:00:00.000Z`
- **Tidak match** → distribusiHariIni = 0

**Solusi (sudah fix)**: `dateRange.js` menggunakan `dayjs().tz("Asia/Jakarta")` di `startOfDay()`, `endOfDay()`, `rangeArray()`. Lihat [backend/src/utils/dateRange.js](../../backend/src/utils/dateRange.js).

**Solusi tambahan**: Cache TTL 5 menit — tambah `invalidatePrefix("dashboard:")` setelah trigger generator. Setelah tombol Generate/Backfill/Trigger Cron, data langsung konsisten.

### Tren 30 hari kosong sebelum tanggal tertentu

---

## Auth

### Login gagal 401

**Gejala**: POST `/api/auth/login` return 401.

**Solusi**:
- Cek user/password. Default: `admin / Admin@123!`.
- Cek rate limit 10 percobaan/15 menit. Tunggu 15 menit.
- Cek Vercel env: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATA_ENCRYPTION_KEY` ≥ 32 char.
- `bcrypt.compare(password, user.passwordHash)` di `auth.service.js`.

### Token expired / "Token blacklist"

**Gejala**: 401 dengan message "Token telah dinonaktifkan".

**Solusi**: Login ulang. Access token 8 jam, refresh 7 hari. Backend Redis simpan blacklist saat logout. Tunggu atau `POST /api/auth/refresh` dengan refresh token.

---

## Performance

### Laporan Kinerja ngehang

**Gejala**: Buka tab Kinerja SPPG di Laporan, loading >30 detik.

**Penyebab**: 3.354 SPPG × 30 hari distribusi = 100k row tanpa pagination.

**Solusi**: Sudah fix — `previewKinerjaSppg` paginated (default 25, max 200). Summary agregat di luar paginated rows. Total pages tampil di UI.

### Real-time metric `updatedAt` null

**Penyebab**: Filter `dateJakarta >= today` di server UTC skip baris `dateJakarta` 9 Juni WIB (= 8 Juni 17:00 UTC).

**Solusi**: Belum fix prioritas. `realtime_metric` baru terisi kalau generator jalan pada jam server UTC > 17:00 (= 00:00 WIB keesokan). Frontend tidak butuh `updatedAt` untuk render nilai metrik.

### Cron tidak jalan otomatis

**Penyebab**:
- Project Vercel paused.
- `vercel.json` `crons` array kosong.
- `CRON_SECRET` tidak di-set.

**Solusi**: Vercel dashboard -> project `bgn` -> Settings -> Crons. Pastikan 1 cron terdaftar. Cek Vercel logs filter `vercel-cron` user-agent.

---

## Reset & Re-populate

### Cara reset semua data dummy:

1. Login admin
2. Dashboard -> klik **Reset Data Dummy** (merah, double confirm)
3. Sistem otomatis trigger backfill 30 hari realistic
4. Refresh browser, semua page terisi data baru

### Cara generate data incremental:

- **Generate Data Harian** (UI): 3 slice (kemarin/hari ini/besok), mode absurdly_high
- **Trigger Cron (Semua)**: 3 step paralel (dummy + realtime + public), mode absurdly_high
- **Backfill 30 Hari (Realistis)**: 30 hari ke belakang, mode realistic (1rb-1jt/hari)
- **Backfill SPPG**: fix kapasitas realistis + insert 12-20 penerima dummy per SPPG

### Cron harian Vercel:

- Schedule: `0 17 * * *` UTC = 00:00 WIB
- Mode: realistic (default)
- Steps: dummy + realtime + public paralel
- Output: cek `ingest_batch` table dengan `source='vercel_cron_daily'`

---

## Kontak Darurat

- **Vercel dashboard**: https://vercel.com/dashboard
- **Vercel logs**: https://vercel.com/[team]/[project]/logs
- **GitHub repo**: https://github.com/Sadamdi/BGN
- **Dokumentasi lokal**: `docs/kelompok2/`
