/**
 * config.js — Konfigurasi Pusat Nycore Bot
 * ------------------------------------------------------------------
 * Seluruh modul WAJIB mengambil konfigurasi dari file ini.
 * Nilai sensitif (API Key, Secret, dsb) diambil dari .env agar tidak
 * ter-hardcode di dalam kode. Salin file .env.example -> .env lalu isi.
 * ------------------------------------------------------------------
 */
require("dotenv").config();

module.exports = {
  // ── Identitas Bot & Store ─────────────────────────────────────
  botName: process.env.BOT_NAME || "Nycore Bot",
  storeName: process.env.STORE_NAME || "Nycore Studio",
  botVersion: "1.0.0",

  ownerName: process.env.OWNER_NAME || "Owner Nycore",
  ownerNumber: process.env.OWNER_NUMBER || "6281234567890", // format 62xxxx tanpa "+"
  // WhatsApp terkadang menyamarkan nomor asli pengirim dengan ID acak
  // berformat "xxxxx@lid" (fitur privasi WhatsApp). Kalau itu terjadi,
  // isi OWNER_LID dengan angka yang muncul di hasil /whoami (bagian
  // sebelum "@lid") supaya bot tetap mengenali kamu sebagai Owner.
  ownerLid: process.env.OWNER_LID || "",
  botNumber: process.env.BOT_NUMBER || "",

  prefix: process.env.PREFIX || "/",
  timezone: process.env.TIMEZONE || "Asia/Jakarta",

  // ── Profil Store (ditampilkan di /menu, /store, footer invoice) ─
  storeProfile: {
    title: "🛠️ Custom Minecraft Plugin Developer",
    tagline: "✨ Jasa pembuatan plugin Minecraft (Spigot, Paper, Purpur)",
    services: [
      "Custom Plugin",
      "Bug Fix",
      "Feature Request",
      "Plugin Optimization",
    ],
  },

  // ── Order Kuota (QRIS / H2H OkeConnect) ──────────────────────
  orderkuota: {
    baseUrl: process.env.ORDERKUOTA_BASE_URL || "https://api.orderkuota.com/api/v2",
    apiKey: process.env.ORDERKUOTA_API_KEY || "",
    merchantId: process.env.ORDERKUOTA_MERCHANT_ID || "",
    secretKey: process.env.ORDERKUOTA_SECRET_KEY || "",
    // Interval (ms) polling otomatis untuk mengecek status order UNPAID
    autoCheckIntervalMs: 30_000,
    // Masa berlaku QRIS jika API tidak mengembalikan expired_time (menit)
    defaultExpiryMinutes: 30,
  },

  // ── Webhook (callback notifikasi pembayaran real-time, opsional) ─
  webhook: {
    // Railway otomatis mengisi process.env.PORT — WAJIB dipakai agar
    // domain publik Railway bisa mengarah ke server ini.
    port: process.env.PORT || 3000,
    path: process.env.WEBHOOK_PATH || "/webhook/orderkuota",
    // Dipakai untuk memverifikasi bahwa notifikasi benar berasal dari
    // Order Kuota (HMAC-SHA256 terhadap raw body). Kosongkan hanya untuk
    // testing lokal — SANGAT disarankan diisi saat production.
    secret: process.env.WEBHOOK_SECRET || "",
  },

  // ── Database ──────────────────────────────────────────────────
  database: {
    type: "sqlite",
    path: process.env.DB_PATH || "./database/database.db",
  },

  // ── Penyimpanan File Produk ───────────────────────────────────
  productPath: "./products_files",

  // ── Branding tampilan ─────────────────────────────────────────
  footer: "© Nycore Studio",
  logo: "./assets/logo.jpg",

  // ── Sesi interaktif (restock, dsb) ────────────────────────────
  sessionTimeoutMs: 5 * 60_000, // 5 menit

  // ── Format mata uang ──────────────────────────────────────────
  currency: "IDR",
};
