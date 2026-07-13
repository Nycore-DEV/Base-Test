/**
 * commands/restock.js — /restock (khusus Owner)
 * Alur: Owner kirim file ke chat bot -> reply file tsb dengan "/restock"
 * -> bot tanya Nama, Harga, Deskripsi, Kategori secara berurutan ->
 * produk otomatis tersimpan ke database + file ke direktori produk.
 */
const config = require("../config");
const session = require("../utils/session");
const productService = require("../products/productService");
const { toRupiah, sectionBlock } = require("../utils/format");

const STEPS = ["name", "price", "description", "category"];
const PROMPTS = {
  name: "📝 Masukkan *Nama Produk*:",
  price: "💰 Masukkan *Harga Produk* (angka saja, contoh: 25000):",
  description: "🧾 Masukkan *Deskripsi Produk*:",
  category: "🗂️ Masukkan *Kategori Produk* (contoh: Custom Plugin, Bug Fix, Feature Request, Plugin Optimization):",
};

/** Dipanggil ketika owner reply file dengan command /restock */
async function startRestock(sock, m) {
  if (!m.isOwner) {
    return sock.sendMessage(m.chat, { text: "🚫 Hanya Owner yang dapat melakukan restock produk." }, { quoted: m.raw });
  }

  const quotedMedia = m.getQuotedMediaBuffer ? await m.getQuotedMediaBuffer() : null;
  if (!quotedMedia) {
    return sock.sendMessage(
      m.chat,
      { text: `⚠️ Kirim file produk terlebih dahulu, lalu *reply (balas)* file tersebut dengan perintah *${config.prefix}restock*.` },
      { quoted: m.raw }
    );
  }

  session.start(m.sender, "restock", {
    buffer: quotedMedia.buffer,
    originalName: quotedMedia.fileName || "produk_file",
  });

  await sock.sendMessage(
    m.chat,
    { text: `📦 *Mode Restock Produk Dimulai*\n\n${PROMPTS.name}\n\n_Ketik *batal* kapan saja untuk membatalkan._` },
    { quoted: m.raw }
  );
}

/** Dipanggil oleh messageHandler untuk setiap pesan teks lanjutan selama sesi restock aktif */
async function handleRestockAnswer(sock, m, sess) {
  const text = (m.body || "").trim();

  if (/^batal$/i.test(text)) {
    session.clear(m.sender);
    return sock.sendMessage(m.chat, { text: "❎ Proses restock dibatalkan." }, { quoted: m.raw });
  }

  const currentField = STEPS[sess.step];

  if (currentField === "price" && isNaN(Number(text.replace(/[^0-9]/g, "")))) {
    return sock.sendMessage(m.chat, { text: "⚠️ Harga harus berupa angka. Coba lagi:\n" + PROMPTS.price }, { quoted: m.raw });
  }

  const value = currentField === "price" ? Number(text.replace(/[^0-9]/g, "")) : text;
  session.update(m.sender, { [currentField]: value });
  session.nextStep(m.sender);

  const updated = session.get(m.sender);
  if (updated.step < STEPS.length) {
    const nextField = STEPS[updated.step];
    return sock.sendMessage(m.chat, { text: PROMPTS[nextField] }, { quoted: m.raw });
  }

  // Semua data terkumpul -> simpan produk
  try {
    const product = productService.restockProduct({
      buffer: updated.data.buffer,
      originalName: updated.data.originalName,
      name: updated.data.name,
      price: updated.data.price,
      description: updated.data.description,
      category: updated.data.category,
      actor: m.sender,
    });

    session.clear(m.sender);

    const summary = sectionBlock("✅ PRODUK BERHASIL DITAMBAHKAN", [
      `✦ ID Produk : *${product.product_id}*`,
      `✦ Nama      : *${product.name}*`,
      `✦ Harga     : *${toRupiah(product.price)}*`,
      `✦ Kategori  : *${product.category}*`,
      `✦ Format    : *${product.file_format}*`,
    ]);

    await sock.sendMessage(m.chat, { text: `${summary}\n\n${config.footer}` }, { quoted: m.raw });
  } catch (err) {
    session.clear(m.sender);
    await sock.sendMessage(m.chat, { text: `❌ Gagal menyimpan produk: ${err.message}` }, { quoted: m.raw });
  }
}

module.exports = { startRestock, handleRestockAnswer };
