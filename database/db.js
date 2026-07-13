/**
 * database/db.js — Koneksi & inisialisasi database SQLite
 * Menggunakan better-sqlite3 (sinkron, cepat, cocok untuk bot single-process).
 * Jika config.database.type diganti "mysql", ganti hanya file ini +
 * sesuaikan query di masing-masing model (interface model tidak berubah).
 */
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const config = require("../config");
const logger = require("../utils/logger");

const dbPath = path.join(__dirname, "..", config.database.path.replace(/^\.\//, ""));
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      product_id      TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      price            INTEGER NOT NULL,
      description      TEXT DEFAULT '',
      category         TEXT DEFAULT 'Umum',
      file_path        TEXT NOT NULL,
      file_name        TEXT NOT NULL,
      file_size        INTEGER DEFAULT 0,
      file_format      TEXT DEFAULT '',
      sold_count       INTEGER DEFAULT 0,
      status           TEXT DEFAULT 'active', -- active | inactive
      uploaded_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      order_id         TEXT PRIMARY KEY,
      transaction_id   TEXT,
      buyer_jid        TEXT NOT NULL,
      product_id       TEXT NOT NULL,
      order_status     TEXT DEFAULT 'WAITING_PAYMENT', -- WAITING_PAYMENT | COMPLETED | EXPIRED | CANCELLED
      payment_status   TEXT DEFAULT 'UNPAID',          -- UNPAID | PAID | EXPIRED
      amount           INTEGER NOT NULL,
      created_at       TEXT NOT NULL,
      paid_at          TEXT,
      completed_at     TEXT,
      delivered        INTEGER DEFAULT 0,               -- 0/1 anti-duplikasi pengiriman
      FOREIGN KEY (product_id) REFERENCES products(product_id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      transaction_id   TEXT PRIMARY KEY,
      order_id         TEXT NOT NULL,
      provider         TEXT DEFAULT 'OrderKuota',
      qris_string      TEXT,
      qris_image_url   TEXT,
      status           TEXT DEFAULT 'UNPAID',
      amount           INTEGER NOT NULL,
      expired_at       TEXT,
      paid_at          TEXT,
      raw_response     TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(order_id)
    );

    CREATE TABLE IF NOT EXISTS logs (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      type             TEXT NOT NULL, -- PRODUCT | ORDER | PAYMENT | DELIVERY | ERROR | OWNER
      message          TEXT NOT NULL,
      actor             TEXT,
      created_at       TEXT NOT NULL
    );
  `);
  logger.success("DATABASE", `SQLite siap digunakan → ${dbPath}`);
}

init();

module.exports = db;
