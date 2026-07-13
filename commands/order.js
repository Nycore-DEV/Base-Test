/**
 * commands/order.js — /beli <ID>, /cek <ORDER_ID>
 * Alur: buat order -> generate QRIS -> kirim ke pembeli -> verifikasi ->
 * kirim produk otomatis begitu PAID (dengan anti-duplikasi).
 */
const fs = require("fs");
const QRCode = require("qrcode");
const config = require("../config");
const orderService = require("../payments/orderService");
const orderModel = require("../database/models/orderModel");
const { toRupiah, formatDate, sectionBlock, monoBold } = require("../utils/format");
const logger = require("../utils/logger");

/** Render QRIS string menjadi buffer PNG bila API tidak memberi URL gambar */
async function renderQrisBuffer(qrisString) {
  return QRCode.toBuffer(qrisString, { type: "png", width: 500, margin: 1 });
}

/** /beli <productId> */
async function buyProduct(sock, m, args) {
  const productId = (args[0] || "").toUpperCase();
  if (!productId) {
    return sock.sendMessage(m.chat, { text: `⚠️ Gunakan format: *${config.prefix}beli <ID_PRODUK>*` }, { quoted: m.raw });
  }

  await m.react?.("⏳");

  try {
    const { order, product, qris } = await orderService.createOrder({
      buyerJid: m.sender,
      productId,
    });

    const invoiceText =
      `${sectionBlock("🧾 INVOICE PEMBAYARAN", [
        `✦ Produk       : *${product.name}*`,
        `✦ Order ID     : *${order.order_id}*`,
        `✦ Transaksi ID : *${order.transaction_id || "-"}*`,
        `✦ Nominal      : *${toRupiah(order.amount)}*`,
        `✦ Status       : *⏳ UNPAID*`,
        `✦ Kedaluwarsa  : *${qris.expiredAt ? formatDate(qris.expiredAt) : "-"}*`,
      ])}\n\n` +
      `📌 Silakan scan QRIS di atas menggunakan aplikasi e-wallet / m-banking apa pun.\n` +
      `🔁 Setelah membayar, ketik *${config.prefix}cek* (atau *${config.prefix}cek ${order.order_id}*) — atau tunggu, bot mengecek otomatis tiap 30 detik.\n\n` +
      `${config.footer}`;

    let imageBuffer = null;
    if (qris.qrisImageUrl) {
      // biarkan WhatsApp fetch dari URL langsung
      await sock.sendMessage(
        m.chat,
        { image: { url: qris.qrisImageUrl }, caption: invoiceText },
        { quoted: m.raw }
      );
    } else if (qris.qrisString) {
      imageBuffer = await renderQrisBuffer(qris.qrisString);
      await sock.sendMessage(m.chat, { image: imageBuffer, caption: invoiceText }, { quoted: m.raw });
    } else {
      await sock.sendMessage(m.chat, { text: invoiceText }, { quoted: m.raw });
    }

    await m.react?.("✅");
  } catch (err) {
    logger.error("ORDER", `Gagal membuat order produk ${productId} oleh ${m.sender}: ${err.message}`);
    await m.react?.("❌");
    await sock.sendMessage(
      m.chat,
      { text: `❌ Gagal membuat pesanan.\n${err.message}\n\nSilakan coba lagi atau hubungi *${config.prefix}owner*.` },
      { quoted: m.raw }
    );
  }
}

/** Kirim file produk ke pembeli */
async function deliverProduct(sock, chatId, quoted, { filePath, fileName, product, order }) {
  const caption =
    `${sectionBlock("✅ PEMBAYARAN BERHASIL", [
      `✦ Produk   : *${product.name}*`,
      `✦ Order ID : *${order.order_id}*`,
      `✦ Status   : *PAID & COMPLETED*`,
    ])}\n\n` +
    `📦 Berikut file produk kamu. Terima kasih telah berbelanja di *${config.storeName}*! 🙏\n\n` +
    `${config.footer}`;

  await sock.sendMessage(
    chatId,
    {
      document: fs.readFileSync(filePath),
      fileName: fileName,
      mimetype: "application/octet-stream",
      caption,
    },
    { quoted }
  );
}

/** /cek <orderId> — verifikasi manual status pembayaran.
 *  Jika orderId tidak diisi, otomatis pakai order aktif (WAITING_PAYMENT)
 *  terakhir milik pembeli tersebut agar tidak perlu mengetik ulang ID. */
async function checkOrder(sock, m, args) {
  let orderId = (args[0] || "").toUpperCase();

  if (!orderId) {
    const lastOrder = orderModel.findLastActiveByBuyer(m.sender);
    if (!lastOrder) {
      return sock.sendMessage(
        m.chat,
        { text: `⚠️ Tidak ada order aktif yang menunggu pembayaran.\nGunakan format: *${config.prefix}cek <ORDER_ID>* atau buat pesanan baru dengan *${config.prefix}beli <ID_PRODUK>*.` },
        { quoted: m.raw }
      );
    }
    orderId = lastOrder.order_id;
  }

  await m.react?.("⏳");

  try {
    const result = await orderService.verifyAndDeliver(orderId);

    if (result.status === "ALREADY_COMPLETED") {
      await m.react?.("ℹ️");
      return sock.sendMessage(
        m.chat,
        { text: `ℹ️ Order *${orderId}* sudah *COMPLETED* dan produk telah dikirim sebelumnya. Tidak ada pengiriman ulang.` },
        { quoted: m.raw }
      );
    }

    if (result.status === "EXPIRED") {
      await m.react?.("⌛");
      return sock.sendMessage(
        m.chat,
        { text: `⌛ Order *${orderId}* sudah *EXPIRED* (kedaluwarsa). Silakan buat pesanan baru dengan *${config.prefix}beli*.` },
        { quoted: m.raw }
      );
    }

    if (result.status === "UNPAID") {
      await m.react?.("❌");
      return sock.sendMessage(
        m.chat,
        { text: `❌ Order *${orderId}* masih *UNPAID*. Silakan selesaikan pembayaran QRIS terlebih dahulu.` },
        { quoted: m.raw }
      );
    }

    if (result.status === "PAID" && result.deliveredNow) {
      await m.react?.("✅");
      await deliverProduct(sock, m.chat, m.raw, {
        filePath: result.filePath,
        fileName: result.fileName,
        product: result.product,
        order: result.order,
      });
    }
  } catch (err) {
    logger.error("ORDER", `Gagal cek order ${orderId}: ${err.message}`);
    await m.react?.("❌");
    await sock.sendMessage(m.chat, { text: `❌ Terjadi kesalahan saat mengecek order.\n${err.message}` }, { quoted: m.raw });
  }
}

module.exports = { buyProduct, checkOrder, deliverProduct };
