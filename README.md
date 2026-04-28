# SIPGN-BGN — Sistem Informasi Pemenuhan Gizi Nasional

Sistem terpadu Badan Gizi Nasional untuk mengelola dan memantau program **Makan Bergizi Gratis (MBG)** di seluruh Satuan Pelayanan Pemenuhan Gizi (SPPG) Indonesia.

> Repo ini adalah monorepo dengan tiga workspace: `frontend/`, `backend/`, dan `shared/`. Semua antarmuka, pesan error, dan komentar bisnis menggunakan Bahasa Indonesia.

## Fitur utama

- **Dashboard Real-Time** — statistik penerima, tren distribusi 30 hari, peta sebaran SPPG (Leaflet), pie kategori, panel alert (auto-refresh 5 menit), unduh snapshot PNG.
- **Manajemen Penerima Manfaat** — CRUD, soft delete, validasi NIK/usia/kategori, import Excel + template, pencarian aman dengan hash terindeks.
- **SPPG** — CRUD, statistik 30 hari, export GeoJSON, validasi koordinat Indonesia, daftar provinsi.
- **Distribusi MBG** — input step-by-step, validasi kapasitas (max 120%), aturan H-3, foto bukti, alur status DRAFT → TERKONFIRMASI → TERVALIDASI, kalkulasi anggaran (Rp 10.000/porsi), alert SPPG belum lapor.
- **Pemantauan Gizi (Z-Score WHO)** — formula LMS resmi, klasifikasi gizi (BURUK/KURANG/BAIK/LEBIH) + flag stunting, grafik kurva pertumbuhan dengan band -3SD..+3SD, prevalensi periodik.
- **Laporan & Export** — preview, export Excel berformat (warna BGN, freeze pane, alternating rows), export PDF (Puppeteer), batas 50.000 baris, jadwal otomatis (mingguan/bulanan via cron + email).
- **Notifikasi Realtime** — Socket.IO end-to-end (room per user/peran/SPPG/zona), drawer notifikasi, badge counter, email backup, cron jobs (18:00 WIB SPPG belum lapor, distribusi rendah 3 hari).
- **Autentikasi & Otorisasi** — JWT (access + refresh) + bcrypt (12 rounds), lockout 15 menit setelah 5 gagal (Redis), token blacklist, refresh token store, RBAC 5 peran (`ADMIN`, `PENGAWAS_GIZI`, `OPERATOR_SPPG`, `ASISTEN_LAPANGAN`, `PEJABAT_BGN`), forgot/reset password via email.
- **PDP Compliance** — NIK terenkripsi AES-256-GCM, hash HMAC-SHA256 untuk lookup, masking `1234********9012`, audit trail otomatis untuk semua operasi data pribadi.
- **DevOps** — Vercel-first deployment (frontend), backend stateful terpisah, CI GitHub Actions, backup script `pg_dump` dengan retensi.

## Tech stack sesuai `prompt_master.md`

**Frontend**: React 18 (Vite 5), Ant Design 5, Recharts 2, React-Leaflet 4, Zustand 5, Axios, dayjs, html2canvas, socket.io-client.

**Backend**: Node.js 20+, Express 4, Prisma 5 (PostgreSQL 15), ioredis (Redis 7), bcrypt, jsonwebtoken, helmet, express-rate-limit, express-validator, multer, exceljs, puppeteer, nodemailer, node-cron, socket.io.

**Testing**: Jest, supertest (backend), React Testing Library (frontend).

## Struktur monorepo

```
.
├── backend/          # Express + Prisma + service/controller/routes + tests
├── frontend/         # Vite + React + AntD + Zustand + tests
├── shared/           # konstanta enum bersama (PERAN, KATEGORI, dst.)
├── .env.example
└── README.md
```

## Prasyarat

- Node.js **20+ LTS** dan npm 10+
- PostgreSQL 15+ dan Redis 7+ (local atau managed service)
- Untuk export PDF: koneksi internet pertama kali (Puppeteer mengunduh Chromium)

## Cara menjalankan mode lokal

1. **Salin env**

   ```powershell
   Copy-Item .env.example .env
   Copy-Item backend/.env.example backend/.env
   Copy-Item frontend/.env.example frontend/.env
   ```

   Sesuaikan `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, dan `DATA_ENCRYPTION_KEY` (≥ 32 byte).

2. **Install dependencies**

   ```powershell
   npm install
   npm --workspace backend install
   npm --workspace frontend install
   ```

3. **Migrasi & seed database**

   ```powershell
   npm --workspace backend run prisma:migrate
   npm --workspace backend run prisma:seed
   ```

4. **Jalankan backend & frontend** (dua terminal)

   ```powershell
   # Terminal 1
   npm run dev:backend

   # Terminal 2
   npm run dev:frontend
   ```

   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000/api
   - Health check: http://localhost:3000/api/health

## Akun default hasil seed

| Peran            | Username        | Password         |
| ---------------- | --------------- | ---------------- |
| Administrator    | `admin`         | `Admin@123!`     |
| Pejabat BGN      | `pejabat`       | `Admin@123!`     |
| Pengawas Gizi    | `pengawas_jkt`  | `Pengawas@123!`  |
| Operator SPPG    | `op_sppg-jkt-001` | `Operator@123!` |

> Ganti seluruh password ini sebelum deploy ke staging/production.

## Testing

```powershell
# Backend (Jest + supertest, mock Prisma & Redis)
npm --workspace backend test

# Frontend (Jest + RTL)
npm --workspace frontend test
```

Threshold coverage backend: **80% lines/statements** (lihat `[backend/package.json](backend/package.json)`). Test mencakup z-score WHO, encryption PDP, RBAC middleware, response/pagination/sanitize utility, login flow, dan endpoint utama Penerima.

## Backup database

Script `[backend/src/scripts/backup.sh](backend/src/scripts/backup.sh)` melakukan `pg_dump | gzip` dan menjaga retensi 30 hari:

```bash
chmod +x backend/src/scripts/backup.sh
DATABASE_URL=postgresql://... BACKUP_DIR=/var/backups/sipgn ./backend/src/scripts/backup.sh
```

Tambahkan ke crontab: `0 2 * * * /app/backend/src/scripts/backup.sh`.

## Catatan keamanan

- **JWT_SECRET** & **JWT_REFRESH_SECRET** wajib unik, minimal 32 byte.
- **DATA_ENCRYPTION_KEY** dipakai untuk AES-256-GCM (NIK) & HMAC-SHA256 (hash lookup). Jangan rotasi tanpa rencana migrasi.
- Reset password seharusnya menggunakan SMTP credential nyata (`SMTP_USER`/`SMTP_PASS`); di mode dev, email log ke console.
- Semua mutasi pada `pengguna`, `penerima_manfaat`, `sppg`, `distribusi_mbg`, dan `pemantauan_gizi` tercatat di `audit_trail` (siapa, kapan, IP, user-agent, before/after).

## Troubleshooting

- **Prisma: connection refused** — pastikan service PostgreSQL dan Redis aktif, serta `DATABASE_URL` dan `REDIS_URL` benar.
- **Puppeteer download error di Windows** — set `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1` dan pakai Chrome lokal: `PUPPETEER_EXECUTABLE_PATH=...`
- **CORS error di browser** — set `FRONTEND_URL` di backend `.env` ke origin yang dipakai (default `http://localhost:5173`).
- **`P2002` duplicate key** — kombinasi `(sppgId, tanggalDistribusi)` unik per hari; gunakan endpoint update jika sudah ada.
- **Notifikasi tidak masuk** — periksa token Socket.IO valid (lihat tab Network browser → ws → handshake), serta server log `[sipgn-bgn] backend listening`.

## Deploy ke Vercel via MCP — Rekomendasi Arsitektur

Untuk kondisi sekarang (backend Express stateful + Socket.IO + cron), pola yang aman:

- Deploy `frontend/` ke Vercel.
- Deploy backend utama ke service container/VM terpisah (agar Socket.IO + scheduler stabil).
- Set env frontend:
  - `VITE_API_URL=https://<backend-domain>/api`
  - `VITE_SOCKET_URL=https://<backend-domain>`

Jika backend akan full di Vercel, lakukan migrasi bertahap ke fungsi stateless dan gunakan pub/sub eksternal untuk realtime.

## GitHub Secure Setup (Wajib)

Checklist keamanan repo:

- Aktifkan branch protection di branch utama:
  - wajib pull request
  - minimal 1 reviewer
  - required status checks (CI)
  - blok force push
- Aktifkan Dependabot updates.
- Jangan commit secrets (`.env`, token, key, credential).
- Simpan `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATA_ENCRYPTION_KEY`, SMTP password, DB/Redis URL di GitHub/Vercel secrets.

## 👥 Team & Contributors

<div align="center">

### 🏆 **Core Team**

<table>
<tr>
<td align="center">
<img src="https://github.com/Sadamdi.png" width="100px" alt="Sulthan Adam Rahmadi"/>
<br />
<strong>Sulthan Adam Rahmadi</strong>
<br />
<sub>🚀 <strong>Project Manager</strong></sub>
<br />
<sub>
📋 Project Manager<br/>
💻 Frontend Developer<br/>
⚙️ Backend Developer<br/>
</sub>
<br />
<a href="https://github.com/Sadamdi">GitHub</a>
</td>
</tr>
</table>

</div>

## 📄 License

Project ini dilisensikan di bawah **MIT License** dengan pemegang hak cipta:
**Software Engineer Kel 2**.

Lihat detail lisensi pada file `LICENSE`.
