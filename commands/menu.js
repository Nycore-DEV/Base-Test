/**
 * commands/menu.js — /menu
 * Menu utama dengan tampilan "cantik" ala Shinobu MD: box-drawing border,
 * teks mono-bold unicode, sapaan dinamis sesuai jam, info store, dan
 * tombol kategori produk interaktif (dengan fallback teks biasa jika
 * client WhatsApp tidak mendukung interactive message).
 */
const os = require("os");
const config = require("../config");
const productModel = require("../database/models/productModel");
const { monoBold, getGreeting, toRupiah, boxHeader, sectionBlock } = require("../utils/format");

function fmtUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return d ? `${d}h ${h}j ${m}m` : h ? `${h}j ${m}m ${s}d` : `${m}m ${s}d`;
}

function buildMenuText(pushName) {
  const greeting = getGreeting();
  const products = productModel.findAllActive();
  const totalProduk = products.length;
  const usedMem = ((os.totalmem() - os.freemem()) / 1024 / 1024).toFixed(0);
  const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);

  const header = boxHeader([
    monoBold(config.botName),
    `${greeting}, ${pushName || "Kak"} ✨`,
  ]);

  const infoStore = sectionBlock("🛒 INFO STORE", [
    `✦ Store   : *${config.storeName}*`,
    `✦ Layanan : *${config.storeProfile.title}*`,
    ...config.storeProfile.services.map((s) => `   • ${s}`),
  ]);

  const infoBot = sectionBlock("⚡ INFO BOT", [
    `✦ Nama    : *${config.botName}*`,
    `✦ Prefix  : *${config.prefix}*`,
    `✦ Uptime  : *${fmtUptime(process.uptime())}*`,
    `✦ RAM     : *${usedMem} MB / ${totalMem} GB*`,
    `✦ Produk  : *${totalProduk} tersedia*`,
  ]);

  const perintah = sectionBlock("📖 PERINTAH UTAMA", [
    `▸ ${config.prefix}caranya — panduan alur belanja step-by-step`,
    `▸ ${config.prefix}produk — lihat semua produk`,
    `▸ ${config.prefix}produk <kategori> — filter per kategori`,
    `▸ ${config.prefix}detail <ID> — detail produk`,
    `▸ ${config.prefix}beli <ID> — buat pesanan & QRIS`,
    `▸ ${config.prefix}cek [ORDER_ID] — cek status pembayaran (kosongkan ID = order terakhir)`,
    `▸ ${config.prefix}owner — hubungi owner`,
    `▸ ${config.prefix}store — profil lengkap store`,
  ]);

  return `${header}

${infoStore}

${infoBot}

${perintah}

✨ Seluruh transaksi diproses *otomatis 24 jam*, tanpa perlu menunggu admin online.
🆕 Baru pertama kali belanja di sini? Ketik *${config.prefix}caranya* untuk panduan lengkap agar tidak bingung.
📂 Ketik *${config.prefix}produk* untuk mulai belanja.

${config.footer}`;
}

function buildCategoryRows() {
  const categories = productModel.listCategories();
  if (!categories.length) {
    return [{ title: "Belum ada produk", description: "Nantikan restock produk terbaru", id: `${config.prefix}produk` }];
  }
  return categories.map((cat) => {
    const count = productModel.findByCategory(cat).length;
    return {
      title: `🗂️ ${monoBold(cat)}`,
      description: `${count} produk tersedia`,
      id: `${config.prefix}produk ${cat}`,
    };
  });
}

/** Kirim interactive list message (native flow), fallback ke teks biasa jika gagal. */
async function sendMenu(sock, m) {
  const bodyText = buildMenuText(m.pushName);
  const rows = buildCategoryRows();

  const nativeFlow = {
    buttons: [
      {
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🗂️ Lihat Kategori Produk",
          sections: [{ title: "Pilih kategori produk", rows }],
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "📘 Cara Belanja",
          id: `${config.prefix}caranya`,
        }),
      },
      {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "👑 Chat Owner",
          url: `https://wa.me/${config.ownerNumber}`,
        }),
      },
    ],
  };

  try {
    await sock.relayMessage(
      m.chat,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: {},
            interactiveMessage: {
              header: { title: "", subtitle: "", hasMediaAttachment: false },
              body: { text: bodyText },
              footer: { text: config.footer },
              nativeFlowMessage: nativeFlow,
            },
          },
        },
      },
      {}
    );
  } catch (e) {
    // Fallback: kirim sebagai teks biasa jika interactive message gagal/tidak didukung
    await sock.sendMessage(m.chat, { text: bodyText }, { quoted: m.raw });
  }
}

module.exports = { sendMenu, buildMenuText };
