/**
 * utils/format.js — Helper tampilan & formatting
 * Bertanggung jawab atas "wajah" bot: teks mono-bold unicode,
 * box-drawing border, format Rupiah, format tanggal, dan generator ID.
 */
const crypto = require("crypto");
const moment = require("moment-timezone");
const config = require("../config");

// Peta karakter -> Mathematical Sans-Serif Bold (gaya "Shinobu")
const MONO_BOLD_MAP = {
  A: "𝗔", B: "𝗕", C: "𝗖", D: "𝗗", E: "𝗘", F: "𝗙", G: "𝗚", H: "𝗛", I: "𝗜",
  J: "𝗝", K: "𝗞", L: "𝗟", M: "𝗠", N: "𝗡", O: "𝗢", P: "𝗣", Q: "𝗤", R: "𝗥",
  S: "𝗦", T: "𝗧", U: "𝗨", V: "𝗩", W: "𝗪", X: "𝗫", Y: "𝗬", Z: "𝗭",
  0: "𝟬", 1: "𝟭", 2: "𝟮", 3: "𝟯", 4: "𝟰", 5: "𝟱", 6: "𝟲", 7: "𝟳", 8: "𝟴", 9: "𝟵",
  " ": " ",
};

/** Ubah teks menjadi UPPERCASE mono-bold unicode (dipakai di judul menu) */
function monoBold(text = "") {
  return text
    .toString()
    .toUpperCase()
    .split("")
    .map((c) => MONO_BOLD_MAP[c] || c)
    .join("");
}

/** Format angka menjadi Rupiah, contoh: 15000 -> "Rp 15.000" */
function toRupiah(amount = 0) {
  const n = Number(amount) || 0;
  return "Rp " + n.toLocaleString("id-ID");
}

/** Ambil sapaan sesuai jam saat ini (WIB) */
function getGreeting() {
  const h = parseInt(moment().tz(config.timezone).format("H"), 10);
  if (h >= 0 && h < 5) return "Selamat Malam 🌙";
  if (h >= 5 && h < 11) return "Selamat Pagi ☀️";
  if (h >= 11 && h < 15) return "Selamat Siang 🔆";
  if (h >= 15 && h < 18) return "Selamat Sore 🌤️";
  return "Selamat Malam 🌙";
}

/** Format tanggal/waktu Indonesia lengkap */
function formatDate(date = new Date()) {
  return moment(date).tz(config.timezone).format("DD MMM YYYY, HH:mm:ss") + " WIB";
}

/** Generator Order ID unik, contoh: NYC-20260713-8F3A2C */
function generateOrderId() {
  const date = moment().tz(config.timezone).format("YYYYMMDD");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `NYC-${date}-${rand}`;
}

/** Generator Product ID unik, contoh: PRD-8F3A2C1B */
function generateProductId() {
  return `PRD-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Bungkus konten dalam box-drawing header ala Nycore/Shinobu */
function boxHeader(lines = []) {
  const width = Math.max(...lines.map((l) => stripLen(l)), 20) + 4;
  const top = "╭" + "═".repeat(width) + "╮";
  const bottom = "╰" + "═".repeat(width) + "╯";
  const body = lines.map((l) => `┃  ${l}`).join("\n");
  return `${top}\n${body}\n${bottom}`;
}

/** Bungkus section dengan gaya "┌─「 judul 」" */
function sectionBlock(title, rows = []) {
  const body = rows.map((r) => `│ ${r}`).join("\n");
  return `┌─「 ${title} 」\n${body}\n└─────────────────`;
}

// Estimasi panjang visual string (mengabaikan emoji lebar-ganda secara kasar)
function stripLen(str) {
  return [...str].length;
}

/** Format ukuran file (bytes -> KB/MB) */
function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

module.exports = {
  monoBold,
  toRupiah,
  getGreeting,
  formatDate,
  generateOrderId,
  generateProductId,
  boxHeader,
  sectionBlock,
  formatFileSize,
};
