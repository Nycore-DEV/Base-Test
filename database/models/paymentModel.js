/**
 * database/models/paymentModel.js — Query CRUD tabel `payments`
 */
const db = require("../db");

const insertStmt = db.prepare(`
  INSERT INTO payments
    (transaction_id, order_id, provider, qris_string, qris_image_url, status, amount, expired_at, raw_response)
  VALUES
    (@transaction_id, @order_id, @provider, @qris_string, @qris_image_url, @status, @amount, @expired_at, @raw_response)
`);

const findByTrxStmt = db.prepare(`SELECT * FROM payments WHERE transaction_id = ?`);
const findByOrderIdStmt = db.prepare(`SELECT * FROM payments WHERE order_id = ?`);

const markPaidStmt = db.prepare(`
  UPDATE payments SET status = 'PAID', paid_at = ? WHERE transaction_id = ?
`);

const updateStatusStmt = db.prepare(`UPDATE payments SET status = ? WHERE transaction_id = ?`);

module.exports = {
  create(payment) {
    insertStmt.run(payment);
    return this.findByTransactionId(payment.transaction_id);
  },
  findByTransactionId(trx) {
    return findByTrxStmt.get(trx);
  },
  findByOrderId(orderId) {
    return findByOrderIdStmt.get(orderId);
  },
  markPaid(trx, paidAt) {
    return markPaidStmt.run(paidAt, trx);
  },
  updateStatus(trx, status) {
    return updateStatusStmt.run(status, trx);
  },
};
