# 🤖 Nycore Bot — Bot WhatsApp Auto Order (Nycore Studio)

Bot WhatsApp Auto Order 24 jam untuk penjualan produk digital (jasa **Custom
Minecraft Plugin Developer**). Seluruh alur — pilih produk, buat invoice,
bayar QRIS, verifikasi pembayaran, hingga pengiriman produk — berjalan
otomatis tanpa campur tangan admin.

Dibangun dengan **Node.js + Baileys (WhatsApp Multi Device)** dan
**SQLite**, terstruktur modular (commands, handlers, database, payments,
products, utils). Tampilan menu terinspirasi dari gaya **Shinobu MD**
(box-drawing border, teks mono-bold unicode, sapaan dinamis, tombol
kategori interaktif).

---

## 📁 Struktur Proyek

```
nycore-bot/
├── index.js                    # Entry point, koneksi Baileys, poller pembayaran otomatis
├── config.js                   # Konfigurasi pusat (baca dari .env)
├── handlers/
│   └── messageHandler.js       # Serialize pesan masuk & routing command
├── commands/
│   ├── menu.js                 # /menu — tampilan menu utama bergaya Shinobu
│   ├── owner.js                 # /owner — kirim vCard
│   ├── store.js                 # /store — profil lengkap store
│   ├── produk.js                 # /produk, /detail
│   ├── order.js                  # /beli, /cek, pengiriman produk
│   ├── restock.js                # /restock — wizard tambah produk (owner)
│   └── manageProduk.js           # /produklist, /editproduk, /hapusproduk, /gantifile
├── database/
│   ├── db.js                    # Koneksi & skema SQLite
│   └── models/                  # productModel, orderModel, paymentModel, logModel
├── payments/
│   ├── orderkuota.js             # Adapter API Order Kuota (QRIS / H2H OkeConnect)
│   └── orderService.js           # Orkestrasi order -> QRIS -> verifikasi -> kirim produk
├── products/
│   └── productService.js         # Simpan/hapus/ganti file produk ke disk + DB
├── utils/
│   ├── format.js                  # Mono-bold text, box-drawing, Rupiah, ID generator
│   ├── logger.js                  # Logger console + file harian
│   ├── vcard.js                   # Builder Contact Card owner
│   └── session.js                 # Session in-memory untuk alur interaktif
├── products_files/               # Penyimpanan file produk (auto-terbuat)
├── logs/                          # Log harian (auto-terbuat)
└── assets/logo.jpg               # Logo/thumbnail store (opsional, tambahkan sendiri)
```

---

## ⚙️ Instalasi

```bash
npm install
cp .env.example .env
```

Lalu edit `.env` — minimal isi:

```env
OWNER_NAME=Nama Kamu
OWNER_NUMBER=628xxxxxxxxxx
BOT_NUMBER=628xxxxxxxxxx

ORDERKUOTA_BASE_URL=https://api.orderkuota.com/api/v2
ORDERKUOTA_API_KEY=isi_dari_akun_orderkuota_kamu
ORDERKUOTA_MERCHANT_ID=isi_merchant_id_kamu
ORDERKUOTA_SECRET_KEY=isi_jika_ada
```

Jalankan:

```bash
npm start
```

Masukkan nomor WhatsApp bot saat diminta → bot menampilkan **Pairing
Code** → buka WhatsApp di HP → **Perangkat Tertaut → Tautkan dengan
nomor telepon** → masukkan kode tersebut.

---

## ⚠️ PENTING: Sesuaikan Endpoint Order Kuota

Order Kuota **tidak memiliki dokumentasi API publik yang baku** — detail
endpoint, nama parameter, dan format response bisa berbeda tergantung
akses/paket yang terdaftar di akun Order Kuota kamu.

Semua request ke Order Kuota **disentralkan** di satu file saja:
`payments/orderkuota.js` (fungsi `createQris()` dan `checkStatus()`).
Jika endpoint/parameter di akunmu berbeda dari asumsi default di kode,
**kamu hanya perlu menyesuaikan file ini** — seluruh bot lainnya (order
flow, database, pengiriman produk) tidak perlu diubah karena hanya
memanggil dua fungsi tersebut sebagai kontrak.

Cek dashboard/API key Order Kuota kamu untuk memastikan:
- Path endpoint pembuatan QRIS & cek status
- Nama field pada payload request (`merchant_id`, `order_id`, dst)
- Format response (`transaction_id`, `qris_string`, `status`, dst)

---

## ☁️ Deploy ke Railway

### 1. Push project ke GitHub, lalu buat New Project di Railway dari repo tersebut

### 2. Set Environment Variables
Di tab **Variables** Railway, isi minimal:
```
OWNER_NAME=Nama Kamu
OWNER_NUMBER=628xxxxxxxxxx
BOT_NUMBER=628xxxxxxxxxx
ORDERKUOTA_API_KEY=...
ORDERKUOTA_MERCHANT_ID=...
ORDERKUOTA_SECRET_KEY=...
WEBHOOK_SECRET=isi_dengan_string_acak_yang_kuat
```
**Jangan isi `PORT` manual** — Railway mengisinya otomatis.

### 3. Aktifkan Domain Publik (untuk webhook)
Tab **Settings → Networking → Generate Domain**. Railway akan membuat
domain seperti `nycore-bot-production.up.railway.app` dan otomatis
mengisi environment variable `RAILWAY_PUBLIC_DOMAIN` — dipakai bot untuk
membangun `callback_url` otomatis saat membuat QRIS (lihat
`payments/orderkuota.js → buildCallbackUrl()`).

Daftarkan Callback URL ini ke dashboard Order Kuota kamu:
```
https://<domain-railway-kamu>/webhook/orderkuota
```

### 4. ⚠️ WAJIB: Tambahkan Volume (Persistent Storage)
Tanpa Volume, folder `session/` (login WhatsApp) dan `database/` akan
**terhapus setiap kali redeploy** — bot harus pairing ulang & data
order/produk hilang. Tambahkan di tab **Volumes**:

| Mount Path | Kegunaan |
|---|---|
| `/app/session` | Menyimpan sesi login WhatsApp (Baileys) |
| `/app/database` | Menyimpan database SQLite |
| `/app/products_files` | Menyimpan file produk yang di-restock |

### 5. Deploy & Pairing
Setelah deploy jalan, buka tab **Deployments → View Logs** untuk
melihat **Pairing Code** yang tercetak di log. Buka WhatsApp di HP →
**Perangkat Tertaut → Tautkan dengan nomor telepon** → masukkan kode.

> Karena Railway adalah environment non-interaktif, `BOT_NUMBER` di
> Environment Variables **wajib diisi** (bot tidak bisa menunggu input
> `readline` seperti saat dijalankan lokal).

---

## 🔗 Webhook vs Polling

Bot ini punya **dua lapis** verifikasi pembayaran sekaligus:

1. **Webhook (real-time)** — `webhook/server.js` membuka endpoint
   `POST /webhook/orderkuota`. Begitu Order Kuota mengirim notifikasi,
   bot langsung verifikasi ulang ke API (tidak asal percaya body
   webhook) lalu kirim produk dalam hitungan detik.
2. **Polling (fallback, tetap aktif)** — cek berkala tiap 30 detik ke
   semua order `UNPAID`, sebagai jaring pengaman kalau webhook telat,
   gagal terkirim, atau `callback_url` belum sempat terdaftar.

Endpoint tambahan:
- `GET /` — status singkat bot (JSON)
- `GET /health` — health check sederhana

⚠️ **Sesuaikan `payments/orderkuota.js → parseWebhookPayload()` dan
`verifyWebhookSignature()`** dengan format payload & skema signature
yang benar-benar dikirim akun Order Kuota kamu (nama field JSON dan
header signature bisa berbeda-beda tergantung akses API yang
didaftarkan). Cek dashboard/dokumentasi API Order Kuota kamu untuk
detail pastinya.

---

## 📖 Daftar Command

### Umum (semua user)
| Command | Keterangan |
|---|---|
| `/menu` | Menu utama bergaya interaktif |
| `/store` | Profil lengkap Nycore Studio |
| `/produk [kategori]` | Daftar produk (opsional filter kategori) |
| `/detail <ID>` | Detail produk sebelum membeli |
| `/beli <ID>` | Buat order + invoice QRIS |
| `/cek <ORDER_ID>` | Cek status pembayaran manual |
| `/owner` | Kirim vCard owner |

### Khusus Owner
| Command | Keterangan |
|---|---|
| `/restock` (reply file) | Wizard tambah produk baru |
| `/produklist` | Lihat seluruh produk (termasuk nonaktif) |
| `/editproduk <ID> nama=..;harga=..;deskripsi=..;kategori=..;status=active/inactive` | Edit produk |
| `/hapusproduk <ID>` | Hapus produk |
| `/gantifile <ID>` (reply file baru) | Ganti file produk |

---

## 🔁 Alur Transaksi Otomatis

1. User `/produk` → `/detail <ID>` → `/beli <ID>`
2. Bot generate **Order ID** unik + request QRIS ke Order Kuota → kirim
   invoice + gambar QRIS ke user.
3. Bot **polling otomatis** setiap 30 detik (bisa diubah di `config.js`)
   mengecek semua order berstatus `UNPAID` ke API Order Kuota.
4. Begitu status `PAID` dikonfirmasi **oleh API** (bukan klaim user),
   bot otomatis:
   - Update status order → `COMPLETED`
   - Kirim file produk ke pembeli
   - Tandai `delivered = 1` (anti pengiriman ganda)
5. User juga bisa mempercepat pengecekan manual dengan `/cek <ORDER_ID>`.
6. Jika order sudah `COMPLETED`, permintaan cek ulang **tidak akan**
   mengirim ulang file — bot hanya memberi tahu status selesai.

---

## 🎨 Tentang Tampilan Menu

Gaya visual menu (`commands/menu.js`) mengikuti pendekatan yang sama
seperti Shinobu MD: box-drawing border (`╭═╮`, `┌─「 」`, `└──────┘`),
teks mono-bold unicode untuk judul, sapaan otomatis sesuai jam WIB, info
store & bot yang rapi, serta tombol kategori interaktif (dengan fallback
otomatis ke teks biasa jika client WhatsApp tidak mendukung pesan
interaktif) — namun seluruh isi konten disesuaikan penuh dengan branding
**Nycore Bot / Nycore Studio**.

---

## 🔐 Keamanan

- Seluruh API key & secret disimpan di `.env`, tidak di-hardcode.
- Status pembayaran **selalu** diverifikasi ke API Order Kuota — bot
  tidak pernah menganggap lunas hanya dari klaim user.
- Satu Order ID hanya diproses satu kali (kolom `delivered` di tabel
  `orders` mencegah pengiriman ganda).
- Semua aktivitas penting (restock, order, pembayaran, pengiriman,
  error) tercatat di tabel `logs` dan file `logs/YYYY-MM-DD.log`.
