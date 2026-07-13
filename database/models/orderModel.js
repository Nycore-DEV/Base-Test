/**
 * database/models/orderModel.js — Query CRUD tabel `orders`
 */
const db = require("../db");

const insertStmt = db.prepare(`
  INSERT INTO orders
    (order_id, transaction_id, buyer_jid, product_id, order_status, payment_status, amount, created_at)
  VALUES
    (@order_id, @transaction_id, @buyer_jid, @product_id, @order_status, @payment_status, @amount, @created_at)
`);

const findByIdStmt = db.prepare(`SELECT * FROM orders WHERE order_id = ?`);
const findByTrxStmt = db.prepare(`SELECT * FROM orders WHERE transaction_id = ?`);
const findPendingStmt = db.prepare(`SELECT * FROM orders WHERE payment_status = 'UNPAID' AND order_status = 'WAITING_PAYMENT'`);
const findByBuyerStmt = db.prepare(`SELECT * FROM orders WHERE buyer_jid = ? ORDER BY created_at DESC LIMIT 20`);
const findLastActiveByBuyerStmt = db.prepare(`
  SELECT * FROM orders
  WHERE buyer_jid = ? AND order_status = 'WAITING_PAYMENT'
  ORDER BY created_at DESC LIMIT 1
`);

const setTransactionIdStmt = db.prepare(`UPDATE orders SET transaction_id = ? WHERE order_id = ?`);

const markPaidStmt = db.prepare(`
  UPDATE orders SET payment_status = 'PAID', paid_at = ? WHERE order_id = ?
`);

const markCompletedStmt = db.prepare(`
  UPDATE orders SET order_status = 'COMPLETED', delivered = 1, completed_at = ? WHERE order_id = ?
`);

const markExpiredStmt = db.prepare(`
  UPDATE orders SET order_status = 'EXPIRED', payment_status = 'EXPIRED' WHERE order_id = ?
`);

module.exports = {
  create(order) {
    insertStmt.run(order);
    return this.findById(order.order_id);
  },
  findById(id) {
    return findByIdStmt.get(id);
  },
  findByTransactionId(trx) {
    return findByTrxStmt.get(trx);
  },
  findPending() {
    return findPendingStmt.all();
  },
  findByBuyer(jid) {
    return findByBuyerStmt.all(jid);
  },
  findLastActiveByBuyer(jid) {
    return findLastActiveByBuyerStmt.get(jid);
  },
  setTransactionId(orderId, trxId) {
    return setTransactionIdStmt.run(trxId, orderId);
  },
  markPaid(orderId, paidAt) {
    return markPaidStmt.run(paidAt, orderId);
  },
  markCompleted(orderId, completedAt) {
    return markCompletedStmt.run(completedAt, orderId);
  },
  markExpired(orderId) {
    return markExpiredStmt.run(orderId);
  },
};
