/**
 * handlers/messageHandler.js — Titik masuk semua pesan WhatsApp
 * Bertanggung jawab: serialize pesan mentah Baileys -> objek `m` yang mudah
 * dipakai, cek prefix/command, cek sesi interaktif aktif (restock), lalu
 * merutekan ke command yang sesuai.
 */
const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const config = require("../config");
const logger = require("../utils/logger");
const session = require("../utils/session");

const menu = require("../commands/menu");
const panduan = require("../commands/panduan");
const owner = require("../commands/owner");
const store = require("../commands/store");
const produk = require("../commands/produk");
const order = require("../commands/order");
const restock = require("../commands/restock");
const manageProduk = require("../commands/manageProduk");

function getMessageText(msg) {
  const m = msg.message;
  if (!m) return "";
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ""
  );
}

function getQuotedRawMessage(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  if (!ctx || !ctx.quotedMessage) return null;
  return {
    key: {
      remoteJid: msg.key.remoteJid,
      id: ctx.stanzaId,
      participant: ctx.participant,
      fromMe: ctx.participant === msg.key.remoteJid,
    },
    message: ctx.quotedMessage,
  };
}

/** Bungkus pesan mentah Baileys jadi objek `m` yang lebih mudah dipakai command */
async function serialize(sock, msg) {
  const prefix = config.prefix;
  const bodyRaw = getMessageText(msg);
  const isCmd = bodyRaw.startsWith(prefix);
  const withoutPrefix = isCmd ? bodyRaw.slice(prefix.length).trim() : "";
  const args = withoutPrefix.split(/\s+/).filter(Boolean);
  const command = isCmd ? (args.shift() || "").toLowerCase() : "";

  const sender = msg.key.participant || msg.key.remoteJid;
  const senderNumber = (sender || "").split("@")[0];
  const ownerNumberClean = config.ownerNumber.replace(/[^0-9]/g, "");

  const quotedRaw = getQuotedRawMessage(msg);

  const m = {
    raw: msg,
    chat: msg.key.remoteJid,
    sender,
    pushName: msg.pushName || "Kak",
    isCmd,
    command,
    args,
    text: args.join(" "),
    body: bodyRaw,
    isOwner: senderNumber === ownerNumberClean,
    quoted: quotedRaw,

    react: async (emoji) => {
      try {
        await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } });
      } catch {}
    },

    /** Download buffer media dari pesan yang di-reply (dipakai /restock, /gantifile) */
    getQuotedMediaBuffer: async () => {
      if (!quotedRaw) return null;
      const mediaMsg =
        quotedRaw.message.documentMessage ||
        quotedRaw.message.imageMessage ||
        quotedRaw.message.videoMessage ||
        quotedRaw.message.audioMessage;
      if (!mediaMsg) return null;
      try {
        const buffer = await downloadMediaMessage(
          quotedRaw,
          "buffer",
          {},
          { reuploadRequest: sock.updateMediaMessage, logger: undefined }
        );
        const fileName =
          quotedRaw.message.documentMessage?.fileName ||
          `file_${Date.now()}${guessExt(mediaMsg.mimetype)}`;
        return { buffer, fileName, mimetype: mediaMsg.mimetype };
      } catch (e) {
        logger.error("MEDIA", `Gagal download media quoted: ${e.message}`);
        return null;
      }
    },
  };

  return m;
}

function guessExt(mimetype = "") {
  const map = {
    "application/pdf": ".pdf",
    "application/zip": ".zip",
    "application/vnd.rar": ".rar",
    "application/x-rar-compressed": ".rar",
    "application/vnd.android.package-archive": ".apk",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "text/plain": ".txt",
    "image/jpeg": ".jpg",
    "image/png": ".png",
  };
  return map[mimetype] || "";
}

/** Router command -> handler */
async function routeCommand(sock, m) {
  switch (m.command) {
    case "menu":
    case "help":
    case "start":
      return menu.sendMenu(sock, m);

    case "owner":
      return owner.sendOwner(sock, m);

    case "caranya":
    case "panduan":
    case "cara":
    case "alur":
      return panduan.sendPanduan(sock, m);

    case "store":
    case "info":
      return store.sendStoreProfile(sock, m);

    case "produk":
    case "list":
    case "katalog":
      return produk.listProducts(sock, m, m.args);

    case "detail":
      return produk.detailProduct(sock, m, m.args);

    case "beli":
    case "order":
      return order.buyProduct(sock, m, m.args);

    case "cek":
    case "check":
      return order.checkOrder(sock, m, m.args);

    case "restock":
      return restock.startRestock(sock, m);

    case "produklist":
      return manageProduk.listAllProducts(sock, m);

    case "editproduk":
      return manageProduk.editProduct(sock, m, m.args);

    case "hapusproduk":
      return manageProduk.deleteProduct(sock, m, m.args);

    case "gantifile":
      return manageProduk.replaceFile(sock, m, m.args);

    default:
      return sock.sendMessage(
        m.chat,
        { text: `❓ Perintah tidak dikenali. Ketik *${config.prefix}menu* untuk melihat daftar perintah.` },
        { quoted: m.raw }
      );
  }
}

/** Entry point dipanggil dari index.js untuk setiap pesan masuk */
async function handleMessage(sock, msg) {
  try {
    if (!msg.message) return;
    if (msg.key.fromMe) return; // abaikan pesan dari bot sendiri

    const m = await serialize(sock, msg);

    // ── Sesi interaktif aktif (mis. sedang restock)? ─────────────
    const activeSession = session.get(m.sender);
    if (activeSession && !m.isCmd) {
      if (activeSession.type === "restock") {
        return restock.handleRestockAnswer(sock, m, activeSession);
      }
    }

    if (!m.isCmd) return; // bukan command & tidak ada sesi aktif -> abaikan

    logger.info("MESSAGE", `${m.sender} -> ${config.prefix}${m.command} ${m.text}`);
    await routeCommand(sock, m);
  } catch (err) {
    logger.error("HANDLER", err.stack || err.message);
  }
}

module.exports = { handleMessage };
