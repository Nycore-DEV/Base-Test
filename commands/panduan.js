/**
 * commands/panduan.js — /caranya, /panduan, /cara
 * Menjelaskan alur belanja end-to-end ke pembeli, dari mencari produk
 * sampai menerima produk setelah pembayaran sukses. Dibuat sebagai
 * command terpisah agar pembeli baru tidak bingung/salah langkah.
 */
const config = require("../config");
const { monoBold, boxHeader } = require("../utils/format");

function buildPanduanText() {
  const header = boxHeader([monoBold("Cara Belanja"), config.storeName]);

  return `${header}

① 🔍 *Cari Produk*
   Ketik ${config.prefix}produk untuk lihat semua produk yang
   tersedia, atau ${config.prefix}produk <kategori> untuk filter.
   Contoh: ${config.prefix}produk Custom Plugin

② 🧐 *Lihat Detail Produk*
   Setiap produk punya ID unik (contoh: PRD-8F3A2C1B).
   Ketik ${config.prefix}detail <ID> untuk lihat harga, deskripsi,
   format file, dan estimasi pengiriman sebelum membeli.
   Contoh: ${config.prefix}detail PRD-8F3A2C1B

③ 🛒 *Buat Pesanan*
   Sudah yakin? Ketik ${config.prefix}beli <ID>. Bot otomatis
   membuatkan Order ID + kode QRIS pembayaran untukmu.
   Contoh: ${config.prefix}beli PRD-8F3A2C1B

④ 💳 *Bayar via QRIS*
   Scan gambar QRIS yang dikirim bot pakai e-wallet atau
   m-banking apa saja (DANA, OVO, GoPay, ShopeePay, dll).
   ⚠️ Bayar sesuai nominal yang tertera — jangan dibulatkan,
   dan lakukan sebelum QRIS kedaluwarsa.

⑤ ✅ *Verifikasi Pembayaran*
   Tidak perlu kirim bukti transfer secara manual. Bot mengecek
   status pembayaran ke sistem pembayaran secara otomatis setiap
   30 detik. Ingin lebih cepat? Ketik ${config.prefix}cek kapan saja.

⑥ 📦 *Produk Diterima Otomatis*
   Begitu pembayaran dikonfirmasi *LUNAS*, file produk langsung
   dikirim ke chat ini — tanpa perlu menunggu admin. Selesai! 🎉

━━━━━━━━━━━━━━━━━━━━━
💡 *Tips:*
• Satu Order ID hanya bisa dibayar & diproses sekali.
• Jika QRIS kedaluwarsa, cukup ulangi ${config.prefix}beli <ID>.
• Ada kendala? Ketik ${config.prefix}owner untuk hubungi kami langsung.

Ketik ${config.prefix}menu untuk kembali ke menu utama.

${config.footer}`;
}

async function sendPanduan(sock, m) {
  await sock.sendMessage(m.chat, { text: buildPanduanText() }, { quoted: m.raw });
}

module.exports = { sendPanduan, buildPanduanText };
