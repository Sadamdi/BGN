"use strict";

const nodemailer = require("nodemailer");

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user) {
    transporter = {
      sendMail: async (msg) => {
        console.log("[email:dev]", JSON.stringify({ to: msg.to, subject: msg.subject }));
        return { messageId: "dev-" + Date.now() };
      },
    };
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: pass ? { user, pass } : undefined,
  });
  return transporter;
}

async function kirimEmail({ to, subject, html, text }) {
  const from = process.env.SMTP_FROM || "SIPGN BGN <noreply@bgn.go.id>";
  return getTransporter().sendMail({ from, to, subject, html, text });
}

async function emailWelcome({ to, namaLengkap, username, password }) {
  const subject = "Akun SIPGN-BGN Anda telah dibuat";
  const html = `
    <p>Halo <b>${namaLengkap}</b>,</p>
    <p>Akun Sistem Informasi Pemenuhan Gizi Nasional (SIPGN-BGN) Anda telah dibuat.</p>
    <ul>
      <li>Username: <b>${username}</b></li>
      <li>Password sementara: <b>${password}</b></li>
    </ul>
    <p>Silakan login dan segera ubah password Anda.</p>
    <p>Salam,<br/>Badan Gizi Nasional</p>
  `;
  return kirimEmail({ to, subject, html, text: html.replace(/<[^>]+>/g, "") });
}

async function emailResetPassword({ to, namaLengkap, link, otpCode, ttlMinutes = 30 }) {
  const subject = "Reset Password SIPGN-BGN";
  const html = `
    <p>Halo <b>${namaLengkap}</b>,</p>
    <p>Kami menerima permintaan reset password untuk akun SIPGN-BGN Anda.</p>
    <p>Masukkan OTP berikut pada halaman reset:</p>
    <p style="font-size:20px;letter-spacing:4px;"><b>${otpCode || "-"}</b></p>
    <p>Silakan klik tautan berikut dalam ${ttlMinutes} menit:</p>
    <p><a href="${link}">${link}</a></p>
    <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>
  `;
  return kirimEmail({ to, subject, html, text: html.replace(/<[^>]+>/g, "") });
}

async function emailNotifikasiUmum({ to, judul, pesan }) {
  return kirimEmail({
    to,
    subject: "[SIPGN-BGN] " + judul,
    html: `<p>${pesan}</p>`,
    text: pesan,
  });
}

module.exports = {
  kirimEmail,
  emailWelcome,
  emailResetPassword,
  emailNotifikasiUmum,
};
