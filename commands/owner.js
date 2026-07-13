/**
 * commands/owner.js — /owner
 * Mengirim Contact Card (vCard) owner, BUKAN nomor dalam bentuk teks biasa.
 */
const config = require("../config");
const { buildOwnerVCard } = require("../utils/vcard");

async function sendOwner(sock, m) {
  await sock.sendMessage(m.chat, buildOwnerVCard(), { quoted: m.raw });

  const followUp =
    `📇 Kontak *${config.ownerName}* (${config.storeName}) telah dikirim di atas.\n\n` +
    `Apabila Anda memiliki pertanyaan, mengalami kendala saat transaksi, atau ingin ` +
    `melakukan pemesanan plugin custom, silakan hubungi Owner melalui kontak yang telah dikirimkan di atas.`;

  await sock.sendMessage(m.chat, { text: followUp }, { quoted: m.raw });
}

module.exports = { sendOwner };
