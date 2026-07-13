/**
 * products/productService.js — Logika bisnis manajemen produk
 * Menjembatani file mentah (buffer dari WhatsApp) <-> penyimpanan disk
 * <-> tabel `products` di database.
 */
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const config = require("../config");
const productModel = require("../database/models/productModel");
const logModel = require("../database/models/logModel");
const { generateProductId } = require("../utils/format");

const STORAGE_DIR = path.join(__dirname, "..", config.productPath.replace(/^\.\//, ""));
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

/**
 * Simpan buffer file produk baru ke disk + insert record ke database.
 * @param {{buffer: Buffer, originalName: string, name: string, price: number,
 *          description: string, category: string, actor: string}} params
 */
function restockProduct({ buffer, originalName, name, price, description, category, actor }) {
  const productId = generateProductId();
  const ext = path.extname(originalName) || "";
  const safeFileName = `${productId}${ext}`;
  const filePath = path.join(STORAGE_DIR, safeFileName);

  fs.writeFileSync(filePath, buffer);

  const product = productModel.create({
    product_id: productId,
    name,
    price: Number(price),
    description,
    category: category || "Umum",
    file_path: filePath,
    file_name: originalName,
    file_size: buffer.length,
    file_format: ext.replace(".", "").toUpperCase() || "FILE",
    status: "active",
    uploaded_at: moment().tz(config.timezone).format("YYYY-MM-DD HH:mm:ss"),
  });

  logModel.add("PRODUCT", `Produk baru ditambahkan: ${name} (${productId}) oleh ${actor}`, actor);
  return product;
}

/** Ganti file produk yang sudah ada (tetap 1 productId, 1 record) */
function replaceProductFile({ productId, buffer, originalName, actor }) {
  const product = productModel.findById(productId);
  if (!product) throw new Error("Produk tidak ditemukan.");

  // Hapus file lama jika ada
  if (product.file_path && fs.existsSync(product.file_path)) {
    fs.unlinkSync(product.file_path);
  }

  const ext = path.extname(originalName) || "";
  const safeFileName = `${productId}${ext}`;
  const filePath = path.join(STORAGE_DIR, safeFileName);
  fs.writeFileSync(filePath, buffer);

  const updated = productModel.updateFile(
    productId,
    filePath,
    originalName,
    buffer.length,
    ext.replace(".", "").toUpperCase() || "FILE"
  );

  logModel.add("PRODUCT", `File produk ${product.name} (${productId}) diganti oleh ${actor}`, actor);
  return updated;
}

function updateProduct({ productId, name, price, description, category, status, actor }) {
  const existing = productModel.findById(productId);
  if (!existing) throw new Error("Produk tidak ditemukan.");

  const updated = productModel.update({
    product_id: productId,
    name: name ?? existing.name,
    price: price != null ? Number(price) : existing.price,
    description: description ?? existing.description,
    category: category ?? existing.category,
    status: status ?? existing.status,
  });

  logModel.add("PRODUCT", `Produk ${productId} diperbarui oleh ${actor}`, actor);
  return updated;
}

function deleteProduct(productId, actor) {
  const existing = productModel.findById(productId);
  if (!existing) throw new Error("Produk tidak ditemukan.");

  if (existing.file_path && fs.existsSync(existing.file_path)) {
    fs.unlinkSync(existing.file_path);
  }
  productModel.remove(productId);
  logModel.add("PRODUCT", `Produk ${existing.name} (${productId}) dihapus oleh ${actor}`, actor);
}

module.exports = {
  restockProduct,
  replaceProductFile,
  updateProduct,
  deleteProduct,
};
