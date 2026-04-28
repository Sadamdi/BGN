"use strict";

let puppeteer = null;
try {
  puppeteer = require("puppeteer");
} catch (_) {
  puppeteer = null;
}

function htmlEscape(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml({ judul, subjudul, columns, rows }) {
  const head = columns.map((c) => `<th>${htmlEscape(c.label)}</th>`).join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${columns.map((c) => `<td>${htmlEscape(r[c.key])}</td>`).join("")}</tr>`
    )
    .join("");
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"/>
<style>
  body { font-family: 'Inter', Arial, sans-serif; color: #1f2937; padding: 24px; }
  h1 { color: #1B3A6B; font-size: 18px; margin: 0 0 4px 0; }
  .sub { color: #475569; margin-bottom: 16px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #1B3A6B; color: #fff; padding: 6px; text-align: left; }
  td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #F0F4FF; }
</style>
</head><body>
  <h1>${htmlEscape(judul)}</h1>
  <div class="sub">${htmlEscape(subjudul || "")}</div>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;
}

async function generatePdfBuffer({ judul, subjudul, columns, rows }) {
  if (!puppeteer) {
    throw new Error("Puppeteer tidak terpasang. Install dependency atau gunakan export Excel.");
  }
  const html = buildHtml({ judul, subjudul, columns, rows });
  const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buf = await page.pdf({ format: "A4", margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" } });
    return buf;
  } finally {
    await browser.close();
  }
}

module.exports = { generatePdfBuffer };
