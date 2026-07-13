/**
 * utils/logger.js — Logger sederhana (console + file harian)
 * Semua aktivitas penting (restock, order, pembayaran, error) tercatat
 * di sini DAN di tabel `logs` pada database (lihat database/models/logModel.js).
 */
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const config = require("../config");

const LOG_DIR = path.join(__dirname, "..", "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const COLORS = {
  info: "\x1b[36m",
  success: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  reset: "\x1b[0m",
};

function timestamp() {
  return moment().tz(config.timezone).format("YYYY-MM-DD HH:mm:ss");
}

function writeToFile(line) {
  const fileName = moment().tz(config.timezone).format("YYYY-MM-DD") + ".log";
  fs.appendFile(path.join(LOG_DIR, fileName), line + "\n", () => {});
}

function log(level, scope, message) {
  const line = `[${timestamp()}] [${level.toUpperCase()}] [${scope}] ${message}`;
  const color = COLORS[level] || "";
  console.log(`${color}${line}${COLORS.reset}`);
  writeToFile(line);
}

module.exports = {
  info: (scope, msg) => log("info", scope, msg),
  success: (scope, msg) => log("success", scope, msg),
  warn: (scope, msg) => log("warn", scope, msg),
  error: (scope, msg) => log("error", scope, msg),
};
