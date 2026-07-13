/**
 * commands/produk.js — /produk, /produk <kategori>, /detail <ID>
 */
const config = require("../config");
const productModel = require("../database/models/productModel");
const { toRupiah, monoBold, sectionBlock, boxHeader, formatFileSize } = require("../utils/format");

/** /produk [kategori] — daftar produk */
async function listProducts(sock, m, args) {
  const category = args.join(" ").trim();
  const products = category
    ? productModel.findByCategory(category)
    : productModel.findAllActive();

  if (!products.length) {
    const msg = category
      ? `⚠️ Tidak ada produk pada kategori *"${category}"*.\nKetik *${config.prefix}produk* untuk melihat semua produk.`
      : `⚠️ Belum ada produk yang tersedia saat ini.\nSilakan cek kembali nanti atau hubungi *${config.prefix}owner*.`;
    return sock.sendMessage(m.chat, { text: msg }, { quoted: m.raw });
  }

  const header = boxHeader([
    monoBold(category ? `Produk — ${category}` : "Daftar Produk"),
    config.storeName,
  ]);

  const rows = products.map((p) => {
    return `┌─「 ${p.name} 」\n` +
      `│ 🆔 ${p.product_id}\n` +
      `│ 💰 ${toRupiah(p.price)}\n` +
      `│ 🗂️ ${p.category}  |  📦 ${p.file_format}\n` +
      `│ 🔥 Terjual: ${p.sold_count}\n` +
      `└─────────────────`;
  });

  const text = `${header}\n\n${rows.join("\n\n")}\n\n` +
    `💡 Ketik *${config.prefix}detail <ID>* untuk melihat detail produk.\n` +
    `🛒 Ketik *${config.prefix}beli <ID>* untuk langsung memesan.\n\n${config.footer}`;

  return sock.sendMessage(m.chat, { text }, { quoted: m.raw });
}

/** /detail <productId> — detail produk sebelum transaksi */
async function detailProduct(sock, m, args) {
  const productId = args[0];
  if (!productId) {
    return sock.sendMessage(m.chat, { text: `⚠️ Gunakan format: *${config.prefix}detail <ID_PRODUK>*` }, { quoted: m.raw });
  }
  const p = productModel.findById(productId.toUpperCase());
  if (!p || p.status !== "active") {
    return sock.sendMessage(m.chat, { text: `⚠️ Produk dengan ID *${productId}* tidak ditemukan.` }, { quoted: m.raw });
  }

  const block = sectionBlock(`🧩 ${monoBold(p.name)}`, [
    `✦ ID Produk : *${p.product_id}*`,
    `✦ Harga     : *${toRupiah(p.price)}*`,
    `✦ Kategori  : *${p.category}*`,
    `✦ Format    : *${p.file_format}*`,
    `✦ Ukuran    : *${formatFileSize(p.file_size)}*`,
    `✦ Terjual   : *${p.sold_count}x*`,
  ]);

  const text = `${block}\n\n📝 *Deskripsi:*\n${p.description || "-"}\n\n` +
    `🚀 Estimasi Pengiriman: *Otomatis, ± 1 menit setelah pembayaran berhasil.*\n` +
    `📦 Produk akan dikirim langsung via WhatsApp setelah QRIS dibayar lunas.\n\n` +
    `🛒 Ketik *${config.prefix}beli ${p.product_id}* untuk membuat pesanan sekarang.\n\n${config.footer}`;

  return sock.sendMessage(m.chat, { text }, { quoted: m.raw });
}

module.exports = { listProducts, detailProduct };
