/**
 * database/models/logModel.js — Mencatat aktivitas penting ke tabel `logs`
 * Tipe: PRODUCT | ORDER | PAYMENT | DELIVERY | ERROR | OWNER
 */
const db = require("../db");
const moment = require("moment-timezone");
const config = require("../../config");

const insertStmt = db.prepare(`
  INSERT INTO logs (type, message, actor, created_at) VALUES (?, ?, ?, ?)
`);
const recentStmt = db.prepare(`SELECT * FROM logs ORDER BY id DESC LIMIT ?`);

function now() {
  return moment().tz(config.timezone).format("YYYY-MM-DD HH:mm:ss");
}

module.exports = {
  add(type, message, actor = "system") {
    return insertStmt.run(type, message, actor, now());
  },
  recent(limit = 20) {
    return recentStmt.all(limit);
  },
};
