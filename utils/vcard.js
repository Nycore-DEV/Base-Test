/**
 * utils/vcard.js — Membuat payload Contact Card (vCard) WhatsApp
 */
const config = require("../config");

/**
 * Buat objek pesan `contacts` siap kirim via sock.sendMessage()
 * berisi Nama Owner, Nomor WhatsApp Owner, dan Nama Store.
 */
function buildOwnerVCard() {
  const number = config.ownerNumber.replace(/[^0-9]/g, "");
  const waid = number;
  const vcard =
    "BEGIN:VCARD\n" +
    "VERSION:3.0\n" +
    `FN:${config.ownerName} - ${config.storeName}\n` +
    `ORG:${config.storeName};\n` +
    `TEL;type=CELL;type=VOICE;waid=${waid}:+${number}\n` +
    "END:VCARD";

  return {
    contacts: {
      displayName: `${config.ownerName} (${config.storeName})`,
      contacts: [{ vcard }],
    },
  };
}

module.exports = { buildOwnerVCard };
