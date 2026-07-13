/**
 * utils/session.js — Manajemen sesi interaktif per-user (in-memory)
 * Dipakai untuk alur bertahap seperti /restock (tanya nama -> harga ->
 * deskripsi -> kategori) dan /editproduk. Sesi otomatis kedaluwarsa
 * setelah `config.sessionTimeoutMs` tanpa aktivitas.
 */
const config = require("../config");

const sessions = new Map(); // key: sender jid -> { type, step, data, timer }

function start(jid, type, initialData = {}) {
  clear(jid);
  const session = {
    type,
    step: 0,
    data: initialData,
    timer: setTimeout(() => clear(jid), config.sessionTimeoutMs),
  };
  sessions.set(jid, session);
  return session;
}

function get(jid) {
  return sessions.get(jid) || null;
}

function update(jid, patch = {}) {
  const s = sessions.get(jid);
  if (!s) return null;
  Object.assign(s.data, patch);
  resetTimer(jid);
  return s;
}

function nextStep(jid) {
  const s = sessions.get(jid);
  if (!s) return null;
  s.step += 1;
  resetTimer(jid);
  return s;
}

function resetTimer(jid) {
  const s = sessions.get(jid);
  if (!s) return;
  clearTimeout(s.timer);
  s.timer = setTimeout(() => clear(jid), config.sessionTimeoutMs);
}

function clear(jid) {
  const s = sessions.get(jid);
  if (s) clearTimeout(s.timer);
  sessions.delete(jid);
}

function has(jid) {
  return sessions.has(jid);
}

module.exports = { start, get, update, nextStep, clear, has };
