/**
 * commands/store.js — /store
 * Menampilkan profil lengkap store (dipakai juga sebagai referensi footer/invoice).
 */
const config = require("../config");
const { boxHeader, sectionBlock, monoBold } = require("../utils/format");

async function sendStoreProfile(sock, m) {
  const header = boxHeader([monoBold(config.storeName), config.storeProfile.title]);
  const block = sectionBlock("✨ LAYANAN KAMI", [
    config.storeProfile.tagline,
    ...config.storeProfile.services.map((s) => `• ${s}`),
  ]);

  const text =
    `${header}\n\n${block}\n\n` +
    `🛒 Ketik *${config.prefix}produk* untuk melihat katalog produk yang tersedia.\n` +
    `👑 Ketik *${config.prefix}owner* untuk menghubungi kami langsung.\n\n${config.footer}`;

  await sock.sendMessage(m.chat, { text }, { quoted: m.raw });
}

module.exports = { sendStoreProfile };
