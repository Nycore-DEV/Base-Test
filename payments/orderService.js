/**
 * payments/orderService.js — Orkestrasi alur Order -> QRIS -> Verifikasi -> Kirim Produk
 * Ini adalah "jantung" transaksi otomatis. Semua command (/beli, /cek, poller
 * otomatis) memanggil fungsi-fungsi di sini agar logikanya konsisten &
 * tidak terduplikasi.
 */
const fs = require("fs");
const moment = require("moment-timezone");
const config = require("../config");
const productModel = require("../database/models/productModel");
const orderModel = require("../database/models/orderModel");
const paymentModel = require("../database/models/paymentModel");
const logModel = require("../database/models/logModel");
const orderkuota = require("./orderkuota");
const { generateOrderId, toRupiah, formatDate } = require("../utils/format");
const logger = require("../utils/logger");

function now() {
  return moment().tz(config.timezone).format("YYYY-MM-DD HH:mm:ss");
}

// Lock in-process sederhana agar satu Order ID tidak diverifikasi/dikirim
// dua kali secara bersamaan (mis. poller otomatis & /cek manual berjalan
// bertepatan). Ini pelengkap dari flag `delivered` di database.
const processingLocks = new Set();

/**
 * Membuat order baru untuk sebuah produk + request QRIS ke Order Kuota.
 * Order ID unik dijamin oleh format generateOrderId() (timestamp + random).
 */
async function createOrder({ buyerJid, productId }) {
  const product = productModel.findById(productId);
  if (!product) throw new Error("Produk tidak ditemukan atau sudah tidak tersedia.");
  if (product.status !== "active") throw new Error("Produk sedang tidak aktif / tidak dijual.");

  const orderId = generateOrderId();

  const order = orderModel.create({
    order_id: orderId,
    transaction_id: null,
    buyer_jid: buyerJid,
    product_id: productId,
    order_status: "WAITING_PAYMENT",
    payment_status: "UNPAID",
    amount: product.price,
    created_at: now(),
  });
  logModel.add("ORDER", `Order dibuat: ${orderId} (${product.name}) oleh ${buyerJid}`, buyerJid);

  // Request QRIS ke Order Kuota
  const qris = await orderkuota.createQris({
    orderId,
    amount: product.price,
    productName: product.name,
  });

  orderModel.setTransactionId(orderId, qris.transactionId);
  paymentModel.create({
    transaction_id: qris.transactionId,
    order_id: orderId,
    provider: "OrderKuota",
    qris_string: qris.qrisString,
    qris_image_url: qris.qrisImageUrl,
    status: "UNPAID",
    amount: product.price,
    expired_at: qris.expiredAt,
    raw_response: JSON.stringify(qris.raw || {}),
  });
  logModel.add("PAYMENT", `QRIS dibuat untuk order ${orderId} (trx: ${qris.transactionId})`, "system");

  return {
    order: orderModel.findById(orderId),
    product,
    qris,
  };
}

/**
 * Verifikasi status pembayaran ke Order Kuota (BUKAN dari klaim user).
 * Jika PAID dan belum pernah diproses -> lanjut proses pengiriman.
 * Mengembalikan { status, order, deliveredNow, filePath, fileName }
 */
async function verifyAndDeliver(orderId) {
  const order = orderModel.findById(orderId);
  if (!order) throw new Error("Order tidak ditemukan.");

  // Anti-duplikasi: jika sudah COMPLETED, jangan proses / kirim ulang.
  if (order.order_status === "COMPLETED" && order.delivered) {
    return { status: "ALREADY_COMPLETED", order, deliveredNow: false };
  }

  if (order.order_status === "EXPIRED") {
    return { status: "EXPIRED", order, deliveredNow: false };
  }

  // Cegah dua proses verifikasi berjalan bersamaan untuk Order ID yang sama
  // (mis. poller otomatis & /cek manual bertepatan).
  if (processingLocks.has(orderId)) {
    return { status: "UNPAID", order, deliveredNow: false, locked: true };
  }
  processingLocks.add(orderId);

  try {
    return await performVerification(order, orderId);
  } finally {
    processingLocks.delete(orderId);
  }
}

async function performVerification(order, orderId) {
  const payment = paymentModel.findByOrderId(orderId);
  if (!payment) throw new Error("Data pembayaran untuk order ini tidak ditemukan.");

  // Cek kedaluwarsa lokal dulu (hemat 1 API call jika sudah jelas expired)
  if (payment.expired_at && new Date(payment.expired_at).getTime() < Date.now() && order.payment_status === "UNPAID") {
    orderModel.markExpired(orderId);
    paymentModel.updateStatus(payment.transaction_id, "EXPIRED");
    logModel.add("PAYMENT", `Order ${orderId} kedaluwarsa (belum dibayar).`, "system");
    return { status: "EXPIRED", order: orderModel.findById(orderId), deliveredNow: false };
  }

  const result = await orderkuota.checkStatus({
    transactionId: order.transaction_id,
    orderId: order.order_id,
  });

  if (result.status === "EXPIRED") {
    orderModel.markExpired(orderId);
    paymentModel.updateStatus(payment.transaction_id, "EXPIRED");
    logModel.add("PAYMENT", `Order ${orderId} kedaluwarsa (dikonfirmasi API Order Kuota).`, "system");
    return { status: "EXPIRED", order: orderModel.findById(orderId), deliveredNow: false };
  }

  if (result.status !== "PAID") {
    logModel.add("PAYMENT", `Order ${orderId} masih UNPAID (cek status).`, "system");
    return { status: "UNPAID", order, deliveredNow: false };
  }

  // ── Status PAID dikonfirmasi API Order Kuota ──────────────────────
  const paidAt = result.paidAt || now();

  // Pastikan belum pernah diproses (Pencegahan Pengiriman Ganda)
  const freshOrder = orderModel.findById(orderId);
  if (freshOrder.order_status === "COMPLETED" && freshOrder.delivered) {
    return { status: "ALREADY_COMPLETED", order: freshOrder, deliveredNow: false };
  }

  if (freshOrder.payment_status !== "PAID") {
    orderModel.markPaid(orderId, paidAt);
    paymentModel.markPaid(order.transaction_id, paidAt);
    logModel.add("PAYMENT", `Pembayaran order ${orderId} berhasil dikonfirmasi PAID.`, "system");
  }

  const product = productModel.findById(order.product_id);
  if (!product || !fs.existsSync(product.file_path)) {
    logModel.add("ERROR", `Gagal mengirim produk order ${orderId}: file produk tidak ditemukan di disk.`, "system");
    throw new Error("Pembayaran diterima, namun file produk tidak ditemukan di server. Hubungi Owner.");
  }

  orderModel.markCompleted(orderId, now());
  productModel.incrementSold(order.product_id);
  logModel.add("DELIVERY", `Produk ${product.name} dikirim untuk order ${orderId}.`, "system");

  return {
    status: "PAID",
    order: orderModel.findById(orderId),
    product,
    deliveredNow: true,
    filePath: product.file_path,
    fileName: product.file_name,
  };
}

/** Ambil semua order UNPAID yang masih WAITING_PAYMENT (dipakai poller otomatis) */
function getPendingOrders() {
  return orderModel.findPending();
}

module.exports = { createOrder, verifyAndDeliver, getPendingOrders };
