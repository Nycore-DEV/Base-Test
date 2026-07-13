/**
 * database/models/productModel.js — Query CRUD tabel `products`
 */
const db = require("../db");

const insertStmt = db.prepare(`
  INSERT INTO products
    (product_id, name, price, description, category, file_path, file_name, file_size, file_format, status, uploaded_at)
  VALUES
    (@product_id, @name, @price, @description, @category, @file_path, @file_name, @file_size, @file_format, @status, @uploaded_at)
`);

const findByIdStmt = db.prepare(`SELECT * FROM products WHERE product_id = ?`);
const findAllActiveStmt = db.prepare(`SELECT * FROM products WHERE status = 'active' ORDER BY category, name`);
const findAllStmt = db.prepare(`SELECT * FROM products ORDER BY uploaded_at DESC`);
const findByCategoryStmt = db.prepare(`SELECT * FROM products WHERE category = ? AND status = 'active' ORDER BY name`);
const listCategoriesStmt = db.prepare(`SELECT DISTINCT category FROM products WHERE status = 'active'`);

const updateStmt = db.prepare(`
  UPDATE products SET
    name = @name, price = @price, description = @description,
    category = @category, status = @status
  WHERE product_id = @product_id
`);

const updateFileStmt = db.prepare(`
  UPDATE products SET file_path = ?, file_name = ?, file_size = ?, file_format = ?
  WHERE product_id = ?
`);

const deleteStmt = db.prepare(`DELETE FROM products WHERE product_id = ?`);
const incrementSoldStmt = db.prepare(`UPDATE products SET sold_count = sold_count + 1 WHERE product_id = ?`);

module.exports = {
  create(product) {
    insertStmt.run(product);
    return this.findById(product.product_id);
  },
  findById(id) {
    return findByIdStmt.get(id);
  },
  findAllActive() {
    return findAllActiveStmt.all();
  },
  findAll() {
    return findAllStmt.all();
  },
  findByCategory(category) {
    return findByCategoryStmt.all(category);
  },
  listCategories() {
    return listCategoriesStmt.all().map((r) => r.category);
  },
  update(product) {
    updateStmt.run(product);
    return this.findById(product.product_id);
  },
  updateFile(productId, filePath, fileName, fileSize, fileFormat) {
    updateFileStmt.run(filePath, fileName, fileSize, fileFormat, productId);
    return this.findById(productId);
  },
  remove(id) {
    return deleteStmt.run(id);
  },
  incrementSold(id) {
    return incrementSoldStmt.run(id);
  },
};
