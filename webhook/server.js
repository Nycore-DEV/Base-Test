/**
 * webhook/server.js — Server HTTP untuk menerima callback/webhook
 * notifikasi pembayaran dari Order Kuota secara real-time.
 *
 * Ini PELENGKAP dari sistem polling yang sudah berjalan di index.js
 * (poller tetap dibiarkan aktif sebagai jaring pengaman/fallback jika
 * webhook telat atau gagal terkirim) — bukan pengganti.
 *
 * Endpoint:
 *   GET  /               -> status check sederhana
 *   GET  /health          -> health check (dipakai Railway/monitoring)
 *   POST /webhook/orderkuota (path bisa diubah lewat config.webhook.path)
 */
const express = require("express");
const config = require("../config");
const logger = require("../utils/logger");
const orderkuota = require("../payments/orderkuota");
const orderService = require("../payments/orderService");
const orderModel = require("../database/models/orderModel");

const app = express();

// Simpan raw body (dibutuhkan untuk verifikasi HMAC signature)
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

let activeSocket = null;
/** Dipanggil dari index.js setelah koneksi WhatsApp berhasil (connection === "open") */
function setSocket(sock) {
  activeSocket = sock;
}

app.get("/", (_req, res) => {
  res.status(200).json({
    bot: config.botName,
    status: "running",
    whatsapp_connected: !!activeSocket,
    time: new Date().toISOString(),
  });
});

app.get("/health", (_req, res) => res.status(200).send("OK"));

app.post(config.webhook.path, async (req, res) => {
  // ── 1. Verifikasi signature ──────────────────────────────────
  const isValid = orderkuota.verifyWebhookSignature(req.rawBody, req.headers);
  if (!isValid) {
    logger.warn("WEBHOOK", `Signature tidak valid dari ${req.ip}. Request ditolak.`);
    return res.status(401).json({ success: false, message: "Invalid signature" });
  }

  // ── 2. Parse payload jadi bentuk baku ─────────────────────────
  const { orderId, status } = orderkuota.parseWebhookPayload(req.body);
  logger.info("WEBHOOK", `Notifikasi diterima: order=${orderId} status=${status}`);

  if (!orderId) {
    return res.status(400).json({ success: false, message: "order_id tidak ditemukan pada payload" });
  }

  const order = orderModel.findById(orderId);
  if (!order) {
    logger.warn("WEBHOOK", `Order ${orderId} tidak ditemukan di database. Diabaikan.`);
    return res.status(404).json({ success: false, message: "Order tidak ditemukan" });
  }

  // ── 3. Bila status bukan PAID, cukup catat & selesai ──────────
  if (status !== "PAID") {
    return res.status(200).json({ success: true, message: `Status ${status} dicatat, tidak ada aksi.` });
  }

  // ── 4. Socket WhatsApp belum siap? Biarkan poller yang menangani ─
  // Order TIDAK diubah statusnya di sini supaya poller (yang berjalan
  // tiap config.orderkuota.autoCheckIntervalMs) tetap bisa memproses &
  // mengirim produk begitu koneksi WhatsApp kembali tersedia.
  if (!activeSocket) {
    logger.warn("WEBHOOK", `Socket WhatsApp belum siap, order ${orderId} akan diproses oleh poller otomatis.`);
    return res.status(503).json({ success: false, message: "Bot belum siap, akan diproses via polling." });
  }

  // ── 5. Verifikasi ulang ke API Order Kuota (jangan percaya body webhook
  //      begitu saja) lalu kirim produk bila memang PAID & belum terkirim ─
  try {
    const result = await orderService.verifyAndDeliver(orderId);

    if (result.status === "PAID" && result.deliveredNow) {
      const orderCommand = require("../commands/order"); // lazy-require, hindari circular import
      await orderCommand.deliverProduct(activeSocket, result.order.buyer_jid, undefined, {
        filePath: result.filePath,
        fileName: result.fileName,
        product: result.product,
        order: result.order,
      });
      logger.success("WEBHOOK", `Order ${orderId} PAID -> produk terkirim via webhook.`);
    }

    return res.status(200).json({ success: true, status: result.status });
  } catch (err) {
    logger.error("WEBHOOK", `Gagal memproses order ${orderId}: ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
});

function startWebhookServer() {
  const port = config.webhook.port;
  app.listen(port, () => {
    logger.success("WEBHOOK", `Server webhook aktif di port ${port} (path: ${config.webhook.path})`);
  });
}

module.exports = { startWebhookServer, setSocket };
