/**
 * index.js — Entry point Nycore Bot
 * Menghubungkan ke WhatsApp via Baileys (Multi Device), memuat handler
 * pesan, dan menjalankan poller otomatis untuk verifikasi pembayaran
 * QRIS yang masih UNPAID (tanpa perlu user mengetik /cek).
 */
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const readline = require("readline");
const chalk = require("chalk");

const config = require("./config");
const logger = require("./utils/logger");
const { handleMessage } = require("./handlers/messageHandler");
const orderService = require("./payments/orderService");
const orderCommand = require("./commands/order");
const webhookServer = require("./webhook/server");

function askQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (ans) => { rl.close(); resolve(ans); }));
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: state,
    printQRInTerminal: false,
    browser: [config.botName, "Chrome", "1.0.0"],
  });

  // ── Pairing Code (tanpa scan QR) ───────────────────────────────
  if (!sock.authState.creds.registered) {
    const number = config.botNumber.replace(/[^0-9]/g, "") ||
      (await askQuestion(chalk.cyan("\nMasukkan nomor WhatsApp Bot (contoh 6281234567890): ")));
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(number.replace(/[^0-9]/g, ""));
        console.log(chalk.green("\n📲 Pairing Code Kamu: ") + chalk.bold.white(code));
        console.log(chalk.gray("Buka WhatsApp -> Perangkat Tertaut -> Tautkan dengan nomor telepon.\n"));
      } catch (e) {
        logger.error("PAIRING", e.message);
      }
    }, 2500);
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      logger.warn("CONNECTION", `Koneksi terputus. Reconnect: ${shouldReconnect}`);
      if (shouldReconnect) startBot();
      else logger.error("CONNECTION", "Sesi logout. Hapus folder ./session lalu jalankan ulang untuk pairing baru.");
    } else if (connection === "open") {
      logger.success("CONNECTION", `${config.botName} berhasil terhubung ke WhatsApp! ✅`);
      webhookServer.setSocket(sock);
      startAutoPaymentChecker(sock);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const msg = messages[0];
    if (!msg) return;
    await handleMessage(sock, msg);
  });

  return sock;
}

/**
 * Poller otomatis: cek berkala semua order UNPAID ke API Order Kuota.
 * Jika ternyata sudah PAID, produk langsung dikirim tanpa menunggu
 * user mengetik /cek — memenuhi syarat "otomatis 24 jam tanpa admin".
 */
function startAutoPaymentChecker(sock) {
  setInterval(async () => {
    const pending = orderService.getPendingOrders();
    for (const order of pending) {
      try {
        const result = await orderService.verifyAndDeliver(order.order_id);
        if (result.status === "PAID" && result.deliveredNow) {
          await orderCommand.deliverProduct(sock, order.buyer_jid, undefined, {
            filePath: result.filePath,
            fileName: result.fileName,
            product: result.product,
            order: result.order,
          });
          logger.success("AUTO-CHECK", `Order ${order.order_id} PAID -> produk terkirim otomatis.`);
        }
      } catch (e) {
        logger.error("AUTO-CHECK", `Order ${order.order_id}: ${e.message}`);
      }
    }
  }, config.orderkuota.autoCheckIntervalMs);

  logger.info("AUTO-CHECK", `Poller pembayaran otomatis aktif setiap ${config.orderkuota.autoCheckIntervalMs / 1000}s.`);
}

webhookServer.startWebhookServer();

startBot().catch((e) => {
  logger.error("BOOT", e.stack || e.message);
  process.exit(1);
});

process.on("uncaughtException", (e) => logger.error("UNCAUGHT", e.stack || e.message));
process.on("unhandledRejection", (e) => logger.error("UNHANDLED", e?.stack || e?.message || String(e)));
