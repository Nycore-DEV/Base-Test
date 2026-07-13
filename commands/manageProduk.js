/**
 * commands/manageProduk.js — Command khusus Owner untuk kelola produk
 * /produklist        — lihat seluruh produk (termasuk nonaktif)
 * /editproduk <ID> <field>=<value>;<field>=<value>...
 * /hapusproduk <ID>
 * /gantifile <ID>    — reply file baru dengan command ini
 * /statusproduk <ID> <active|inactive>
 */
const config = require("../config");
const productModel = require("../database/models/productModel");
const productService = require("../products/productService");
const { toRupiah, formatFileSize, sectionBlock, boxHeader, monoBold, formatDate } = require("../utils/format");

function ownerOnly(m, sock) {
  if (!m.isOwner) {
    sock.sendMessage(m.chat, { text: "🚫 Perintah ini khusus untuk Owner." }, { quoted: m.raw });
    return false;
  }
  return true;
}

/** /produklist */
async function listAllProducts(sock, m) {
  if (!ownerOnly(m, sock)) return;
  const products = productModel.findAll();
  if (!products.length) {
    return sock.sendMessage(m.chat, { text: "📭 Belum ada produk sama sekali. Gunakan /restock untuk menambah." }, { quoted: m.raw });
  }

  const header = boxHeader([monoBold("Manajemen Produk"), `${products.length} total produk`]);
  const rows = products.map((p) => {
    const statusIcon = p.status === "active" ? "🟢 Aktif" : "🔴 Nonaktif";
    return `┌─「 ${p.name} 」\n` +
      `│ 🆔 ${p.product_id}\n` +
      `│ 💰 ${toRupiah(p.price)}  |  📦 ${formatFileSize(p.file_size)}\n` +
      `│ 🗂️ ${p.category}  |  ${statusIcon}\n` +
      `│ 🔥 Terjual: ${p.sold_count}  |  🗓️ ${p.uploaded_at}\n` +
      `└─────────────────`;
  });

  const text = `${header}\n\n${rows.join("\n\n")}\n\n` +
    `✏️ *${config.prefix}editproduk <ID> nama=..;harga=..;deskripsi=..;kategori=..;status=active/inactive*\n` +
    `🗑️ *${config.prefix}hapusproduk <ID>*\n` +
    `🔁 *${config.prefix}gantifile <ID>* (reply file baru)\n\n${config.footer}`;

  return sock.sendMessage(m.chat, { text }, { quoted: m.raw });
}

/** /editproduk <ID> field=value;field=value */
async function editProduct(sock, m, args) {
  if (!ownerOnly(m, sock)) return;
  const productId = (args[0] || "").toUpperCase();
  const rest = args.slice(1).join(" ");

  if (!productId || !rest) {
    return sock.sendMessage(
      m.chat,
      { text: `⚠️ Format: *${config.prefix}editproduk <ID> nama=..;harga=..;deskripsi=..;kategori=..;status=active/inactive*` },
      { quoted: m.raw }
    );
  }

  const patch = {};
  rest.split(";").forEach((pair) => {
    const [key, ...valParts] = pair.split("=");
    const val = valParts.join("=").trim();
    if (!key || !val) return;
    const k = key.trim().toLowerCase();
    if (k === "nama") patch.name = val;
    if (k === "harga") patch.price = Number(val.replace(/[^0-9]/g, ""));
    if (k === "deskripsi") patch.description = val;
    if (k === "kategori") patch.category = val;
    if (k === "status") patch.status = val.toLowerCase();
  });

  try {
    const updated = productService.updateProduct({ productId, ...patch, actor: m.sender });
    const summary = sectionBlock("✅ PRODUK DIPERBARUI", [
      `✦ ID       : *${updated.product_id}*`,
      `✦ Nama     : *${updated.name}*`,
      `✦ Harga    : *${toRupiah(updated.price)}*`,
      `✦ Kategori : *${updated.category}*`,
      `✦ Status   : *${updated.status}*`,
    ]);
    return sock.sendMessage(m.chat, { text: `${summary}\n\n${config.footer}` }, { quoted: m.raw });
  } catch (err) {
    return sock.sendMessage(m.chat, { text: `❌ Gagal update produk: ${err.message}` }, { quoted: m.raw });
  }
}

/** /hapusproduk <ID> */
async function deleteProduct(sock, m, args) {
  if (!ownerOnly(m, sock)) return;
  const productId = (args[0] || "").toUpperCase();
  if (!productId) {
    return sock.sendMessage(m.chat, { text: `⚠️ Format: *${config.prefix}hapusproduk <ID>*` }, { quoted: m.raw });
  }
  try {
    productService.deleteProduct(productId, m.sender);
    return sock.sendMessage(m.chat, { text: `🗑️ Produk *${productId}* berhasil dihapus.` }, { quoted: m.raw });
  } catch (err) {
    return sock.sendMessage(m.chat, { text: `❌ Gagal menghapus produk: ${err.message}` }, { quoted: m.raw });
  }
}

/** /gantifile <ID> (reply file baru) */
async function replaceFile(sock, m, args) {
  if (!ownerOnly(m, sock)) return;
  const productId = (args[0] || "").toUpperCase();
  if (!productId) {
    return sock.sendMessage(m.chat, { text: `⚠️ Format: *${config.prefix}gantifile <ID>* (reply file baru dengan perintah ini)` }, { quoted: m.raw });
  }

  const quotedMedia = m.getQuotedMediaBuffer ? await m.getQuotedMediaBuffer() : null;
  if (!quotedMedia) {
    return sock.sendMessage(m.chat, { text: "⚠️ Reply (balas) file baru yang ingin dijadikan pengganti dengan perintah ini." }, { quoted: m.raw });
  }

  try {
    const updated = productService.replaceProductFile({
      productId,
      buffer: quotedMedia.buffer,
      originalName: quotedMedia.fileName || "produk_file",
      actor: m.sender,
    });
    return sock.sendMessage(
      m.chat,
      { text: `🔁 File produk *${updated.product_id}* berhasil diganti (${formatFileSize(updated.file_size)}).` },
      { quoted: m.raw }
    );
  } catch (err) {
    return sock.sendMessage(m.chat, { text: `❌ Gagal mengganti file: ${err.message}` }, { quoted: m.raw });
  }
}

module.exports = { listAllProducts, editProduct, deleteProduct, replaceFile };
