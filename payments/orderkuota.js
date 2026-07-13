/**
 * payments/orderkuota.js — Integrasi API Order Kuota (QRIS via H2H OkeConnect)
 * ------------------------------------------------------------------------
 * PENTING:
 * Order Kuota tidak memiliki dokumentasi resmi publik yang baku — endpoint,
 * nama parameter, dan format response dapat berbeda tergantung paket/akses
 * yang kamu daftarkan di akun Order Kuota kamu. File ini dibuat sebagai
 * ADAPTER TERPUSAT: seluruh bagian bot lain (payments/order flow) hanya
 * memanggil `createQris()` dan `checkStatus()` dari sini, sehingga jika
 * suatu saat detail endpoint/parameter Order Kuota kamu berbeda, kamu
 * HANYA perlu menyesuaikan isi 2 fungsi ini tanpa menyentuh kode lain.
 *
 * Sesuaikan `buildAuthHeaders()`, path endpoint, dan mapping response
 * dengan dokumentasi/akses API yang diberikan pihak Order Kuota ke akunmu.
 * ------------------------------------------------------------------------
 */
const axios = require("axios");
const crypto = require("crypto");
const config = require("../config");
const logger = require("../utils/logger");

const http = axios.create({
  baseURL: config.orderkuota.baseUrl,
  timeout: 15_000,
});

/** Signature HMAC-SHA256 sederhana (umum dipakai skema H2H) */
function buildSignature(payloadString) {
  if (!config.orderkuota.secretKey) return undefined;
  return crypto
    .createHmac("sha256", config.orderkuota.secretKey)
    .update(payloadString)
    .digest("hex");
}

function buildAuthHeaders(payloadString = "") {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.orderkuota.apiKey}`,
  };
  const sig = buildSignature(payloadString);
  if (sig) headers["X-Signature"] = sig;
  return headers;
}

/**
 * Membuat QRIS dinamis untuk sebuah order.
 * @param {{orderId: string, amount: number, productName: string}} params
 * @returns {Promise<{transactionId, qrisString, qrisImageUrl, expiredAt, status, raw}>}
 */
/** Bangun URL publik lengkap webhook, prioritas: CALLBACK_URL manual > domain publik Railway > kosong */
function buildCallbackUrl() {
  if (process.env.CALLBACK_URL) return process.env.CALLBACK_URL;
  // Railway otomatis menyediakan RAILWAY_PUBLIC_DOMAIN saat domain publik diaktifkan
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (railwayDomain) return `https://${railwayDomain}${config.webhook.path}`;
  return undefined;
}

async function createQris({ orderId, amount, productName }) {
  const payload = {
    merchant_id: config.orderkuota.merchantId,
    order_id: orderId,
    amount,
    product_name: productName,
    callback_url: buildCallbackUrl(),
  };
  const payloadString = JSON.stringify(payload);

  try {
    const { data } = await http.post("/qris/create", payload, {
      headers: buildAuthHeaders(payloadString),
    });

    if (!data || data.success === false) {
      throw new Error(data?.message || "Order Kuota menolak permintaan pembuatan QRIS.");
    }

    const result = data.data || data;
    const expiredAt =
      result.expired_time ||
      result.expired_at ||
      new Date(Date.now() + config.orderkuota.defaultExpiryMinutes * 60_000).toISOString();

    return {
      transactionId: result.transaction_id || result.trx_id || result.reff_id,
      qrisString: result.qris_string || result.qr_string || result.qris,
      qrisImageUrl: result.qris_image || result.qr_image_url || null,
      expiredAt,
      status: (result.status || "UNPAID").toUpperCase(),
      raw: result,
    };
  } catch (err) {
    logger.error("ORDERKUOTA", `Gagal membuat QRIS untuk order ${orderId}: ${err.message}`);
    throw err;
  }
}

/**
 * Mengecek status pembayaran suatu transaksi ke Order Kuota.
 * Bot TIDAK BOLEH menganggap lunas hanya dari klaim user — status
 * final harus selalu berasal dari respons endpoint ini.
 * @param {{transactionId: string, orderId: string}} params
 * @returns {Promise<{status: 'PAID'|'UNPAID'|'EXPIRED', paidAt: string|null, raw: object}>}
 */
async function checkStatus({ transactionId, orderId }) {
  try {
    const { data } = await http.get("/qris/status", {
      params: { transaction_id: transactionId, order_id: orderId, merchant_id: config.orderkuota.merchantId },
      headers: buildAuthHeaders(),
    });

    if (!data || data.success === false) {
      throw new Error(data?.message || "Order Kuota gagal mengembalikan status transaksi.");
    }

    const result = data.data || data;
    const status = (result.status || "UNPAID").toUpperCase();

    return {
      status: ["PAID", "SUCCESS", "SETTLED"].includes(status) ? "PAID" : status === "EXPIRED" ? "EXPIRED" : "UNPAID",
      paidAt: result.paid_at || result.payment_time || null,
      raw: result,
    };
  } catch (err) {
    logger.error("ORDERKUOTA", `Gagal cek status transaksi ${transactionId}: ${err.message}`);
    // Jangan pernah menganggap PAID saat API error — fail-safe ke UNPAID.
    return { status: "UNPAID", paidAt: null, raw: null, error: err.message };
  }
}

/**
 * Verifikasi bahwa notifikasi webhook benar berasal dari Order Kuota,
 * bukan pihak tak dikenal yang menembak endpoint publik kita.
 *
 * PENTING: skema signature di bawah ini adalah pola HMAC-SHA256 yang
 * UMUM dipakai banyak payment gateway (header `x-signature` dihitung
 * dari HMAC-SHA256(rawBody, secretKey)). Cek dokumentasi/dashboard akun
 * Order Kuota kamu untuk skema signature yang sebenarnya dipakai, lalu
 * sesuaikan nama header & cara hitungnya di fungsi ini saja — bagian
 * lain bot tidak perlu diubah.
 *
 * @param {Buffer|string} rawBody - raw body request (belum di-parse JSON)
 * @param {object} headers - req.headers dari Express
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, headers = {}) {
  if (!config.webhook.secret) {
    // Tidak ada secret dikonfigurasi -> verifikasi dilewati (HANYA untuk testing).
    return true;
  }
  const receivedSignature =
    headers["x-signature"] || headers["x-callback-signature"] || headers["x-orderkuota-signature"];
  if (!receivedSignature) return false;

  const expected = crypto
    .createHmac("sha256", config.webhook.secret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receivedSignature));
  } catch {
    return false; // panjang buffer beda -> otomatis dianggap tidak valid
  }
}

/**
 * Ubah payload webhook mentah dari Order Kuota menjadi bentuk baku yang
 * dipakai bot ({ orderId, transactionId, status }). Sesuaikan pemetaan
 * field di bawah ini dengan struktur JSON body webhook yang benar-benar
 * dikirim Order Kuota ke endpoint kamu (cek contoh payload di dashboard
 * mereka, atau log `req.body` mentah saat notifikasi pertama masuk).
 *
 * @param {object} body - req.body (sudah ter-parse JSON) dari Express
 */
function parseWebhookPayload(body = {}) {
  const data = body.data || body;
  const rawStatus = (data.status || "").toString().toUpperCase();
  return {
    orderId: data.order_id || data.merchant_ref || null,
    transactionId: data.transaction_id || data.trx_id || data.reff_id || null,
    status: ["PAID", "SUCCESS", "SETTLED"].includes(rawStatus)
      ? "PAID"
      : rawStatus === "EXPIRED"
      ? "EXPIRED"
      : "UNPAID",
  };
}

module.exports = { createQris, checkStatus, verifyWebhookSignature, parseWebhookPayload };
