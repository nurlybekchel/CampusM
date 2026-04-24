const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DB_DIR = path.join(ROOT_DIR, "db");
const DB_PATH = path.join(DB_DIR, "marketplace.sqlite");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price REAL NOT NULL CHECK(price >= 0),
  seller_card TEXT,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'Р”СЂСѓРіРѕРµ',
  dorm_location TEXT NOT NULL DEFAULT 'РќРµ СѓРєР°Р·Р°РЅРѕ',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'sold')),
  seller_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  buyer_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL UNIQUE,
  sold_price REAL NOT NULL CHECK(sold_price >= 0),
  transfer_status TEXT NOT NULL DEFAULT 'pending_seller_confirmation',
  seller_payment_confirmed INTEGER NOT NULL DEFAULT 0,
  buyer_item_confirmed INTEGER NOT NULL DEFAULT 0,
  dispute_note TEXT,
  dispute_by INTEGER,
  dispute_opened_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL UNIQUE,
  amount REAL NOT NULL CHECK(amount >= 0),
  status TEXT NOT NULL DEFAULT 'paid' CHECK(status IN ('paid', 'failed')),
  provider TEXT NOT NULL DEFAULT 'internal',
  provider_session_id TEXT,
  method TEXT NOT NULL DEFAULT 'card',
  payer_name TEXT NOT NULL,
  payer_email TEXT NOT NULL,
  card_last4 TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
);
`);

function ensureColumn(table, column, sqlDefinition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const hasColumn = columns.some((col) => col.name === column);
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlDefinition}`);
  }
}

ensureColumn("users", "is_active", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("users", "phone", "TEXT");
ensureColumn("items", "category", "TEXT NOT NULL DEFAULT 'Р”СЂСѓРіРѕРµ'");
ensureColumn("items", "seller_card", "TEXT");
ensureColumn("items", "dorm_location", "TEXT NOT NULL DEFAULT 'РќРµ СѓРєР°Р·Р°РЅРѕ'");
ensureColumn("items", "status", "TEXT NOT NULL DEFAULT 'active'");
ensureColumn("items", "updated_at", "TEXT NOT NULL DEFAULT (datetime('now'))");
ensureColumn("purchases", "transfer_status", "TEXT NOT NULL DEFAULT 'pending_seller_confirmation'");
ensureColumn("purchases", "seller_payment_confirmed", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("purchases", "buyer_item_confirmed", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("purchases", "dispute_note", "TEXT");
ensureColumn("purchases", "dispute_by", "INTEGER");
ensureColumn("purchases", "dispute_opened_at", "TEXT");
ensureColumn("payments", "provider", "TEXT NOT NULL DEFAULT 'internal'");
ensureColumn("payments", "provider_session_id", "TEXT");

const adminEmail = "admin@dorm.local";
const adminPassword = "Admin12345";
let adminUser = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
if (!adminUser) {
  const hash = bcrypt.hashSync(adminPassword, 10);
  db.prepare(
    "INSERT INTO users (full_name, email, password_hash, role, is_active) VALUES (?, ?, ?, 'admin', 1)"
  ).run("Главный администратор", adminEmail, hash);
  adminUser = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
}

function ensureDemoItems(adminId) {
  const demoItems = [
    {
      title: "Ноутбук Lenovo IdeaPad 3",
      description: "Рабочий ноутбук для учебы и удаленной работы. Батарея держит около 4 часов.",
      price: 28000,
      imageUrl:
        "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=80",
      category: "Электроника",
      dormLocation: "Корпус А, 5 этаж, комната 514"
    },
    {
      title: "Офисное кресло IKEA",
      description: "Удобное кресло в хорошем состоянии, регулируемая высота и наклон.",
      price: 4900,
      imageUrl:
        "https://images.unsplash.com/photo-1505843513577-22bb7d21e455?auto=format&fit=crop&w=1200&q=80",
      category: "Мебель",
      dormLocation: "Корпус Б, 3 этаж, комната 309"
    },
    {
      title: "Сборник задач по высшей математике",
      description: "Актуальное издание, есть пометки карандашом. Отлично подойдет для 1-2 курса.",
      price: 700,
      imageUrl:
        "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=80",
      category: "Учеба",
      dormLocation: "Корпус В, 2 этаж, комната 211"
    }
  ];

  for (const item of demoItems) {
    const exists = db.prepare("SELECT id FROM items WHERE title = ?").get(item.title);
    if (exists) continue;

    db.prepare(
      `
      INSERT INTO items (title, description, price, image_url, category, dorm_location, status, seller_id)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
      `
    ).run(item.title, item.description, item.price, item.imageUrl, item.category, item.dormLocation, adminId);
  }
}

if (adminUser?.id) {
  ensureDemoItems(adminUser.id);
}

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dorm-marketplace-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      httpOnly: true
    }
  })
);

app.use(express.static(PUBLIC_DIR));

app.get("/", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));
app.get("/auth", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "auth.html")));
app.get("/about", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "about.html")));
app.get("/support", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "support.html")));
app.get("/dashboard", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "dashboard.html")));
app.get("/profile", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "profile.html")));
app.get("/purchases", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "purchases.html")));
app.get("/checkout", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "checkout.html")));
app.get("/item/:id", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "item.html")));
app.get("/admin", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "admin.html")));

function toUserDTO(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone || "",
    email: row.email,
    role: row.role,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at
  };
}

function toItemDTO(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.price,
    imageUrl: row.image_url,
    sellerCard: row.seller_card || "",
    category: row.category,
    dormLocation: row.dorm_location,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    seller: {
      id: row.seller_id,
      name: row.seller_name
    }
  };
}

function toPurchaseDTO(row) {
  return {
    id: row.purchase_id || row.id,
    purchasedAt: row.purchased_at || row.created_at,
    soldPrice: row.sold_price,
    transferStatus: row.transfer_status || "pending_seller_confirmation",
    sellerPaymentConfirmed: Boolean(row.seller_payment_confirmed),
    buyerItemConfirmed: Boolean(row.buyer_item_confirmed),
    disputeNote: row.dispute_note || "",
    disputeBy: row.dispute_by || null,
    disputeOpenedAt: row.dispute_opened_at || null,
    item: toItemDTO(row),
    buyer: row.buyer_id
      ? {
          id: row.buyer_id,
          name: row.buyer_name
        }
      : undefined
  };
}

function getItemWithSeller(itemId) {
  return db
    .prepare(
      `
      SELECT
        items.id, items.title, items.description, items.price, items.image_url, items.seller_card,
        items.category, items.dorm_location, items.status, items.created_at, items.updated_at,
        users.id AS seller_id, users.full_name AS seller_name
      FROM items
      JOIN users ON users.id = items.seller_id
      WHERE items.id = ?
      `
    )
    .get(itemId);
}

function validateSessionUser(req) {
  if (!req.session.userId) return null;
  const user = db
    .prepare("SELECT id, full_name, phone, email, role, is_active, created_at FROM users WHERE id = ?")
    .get(req.session.userId);
  if (!user || !user.is_active) {
    req.session.destroy(() => {});
    return null;
  }
  return user;
}

function requireAuth(req, res, next) {
  const user = validateSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "РўСЂРµР±СѓРµС‚СЃСЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ." });
  }
  req.user = user;
  return next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Р”РѕСЃС‚СѓРїРЅРѕ С‚РѕР»СЊРєРѕ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂСѓ." });
  }
  return next();
}

function normalizeCardNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidCardNumber(value) {
  return /^\d{16}$/.test(value);
}

app.post("/api/auth/register", (req, res) => {
  const fullName = String(req.body.fullName || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: "Р—Р°РїРѕР»РЅРёС‚Рµ РёРјСЏ, email Рё РїР°СЂРѕР»СЊ." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "РџР°СЂРѕР»СЊ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РЅРµ РєРѕСЂРѕС‡Рµ 6 СЃРёРјРІРѕР»РѕРІ." });
  }

  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (exists) {
    return res.status(409).json({ error: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃ С‚Р°РєРёРј email СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚." });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("INSERT INTO users (full_name, email, password_hash, role, is_active) VALUES (?, ?, ?, 'user', 1)")
    .run(fullName, email, hash);

  req.session.userId = Number(result.lastInsertRowid);
  const user = db
    .prepare("SELECT id, full_name, phone, email, role, is_active, created_at FROM users WHERE id = ?")
    .get(result.lastInsertRowid);
  return res.status(201).json({ user: toUserDTO(user) });
});

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!email || !password) {
    return res.status(400).json({ error: "РЈРєР°Р¶РёС‚Рµ email Рё РїР°СЂРѕР»СЊ." });
  }

  const user = db
    .prepare("SELECT id, full_name, phone, email, password_hash, role, is_active, created_at FROM users WHERE email = ?")
    .get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "РќРµРІРµСЂРЅС‹Р№ email РёР»Рё РїР°СЂРѕР»СЊ." });
  }
  if (!user.is_active) {
    return res.status(403).json({ error: "Р’Р°С€ Р°РєРєР°СѓРЅС‚ РѕС‚РєР»СЋС‡РµРЅ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂРѕРј." });
  }

  req.session.userId = user.id;
  return res.json({ user: toUserDTO(user) });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/auth/me", (req, res) => {
  const user = validateSessionUser(req);
  return res.json({ user: toUserDTO(user) });
});

app.patch("/api/users/me", requireAuth, (req, res) => {
  const fullName = String(req.body.fullName || "").trim();
  const phone = String(req.body.phone || "").trim();

  if (!fullName || fullName.length < 2) {
    return res.status(400).json({ error: "Введите корректное имя." });
  }
  if (phone && !/^[\d+\s()-]{7,20}$/.test(phone)) {
    return res.status(400).json({ error: "Введите корректный номер телефона." });
  }

  db.prepare("UPDATE users SET full_name = ?, phone = ? WHERE id = ?").run(fullName, phone || null, req.user.id);

  const updated = db
    .prepare("SELECT id, full_name, phone, email, role, is_active, created_at FROM users WHERE id = ?")
    .get(req.user.id);
  return res.json({ user: toUserDTO(updated) });
});

app.get("/api/items", (req, res) => {
  const q = String(req.query.q || "").trim();
  const category = String(req.query.category || "").trim();
  const sort = String(req.query.sort || "newest");
  const min = req.query.min ? Number(req.query.min) : null;
  const max = req.query.max ? Number(req.query.max) : null;

  let sql = `
    SELECT
      items.id, items.title, items.description, items.price, items.image_url, items.seller_card,
        items.category, items.dorm_location, items.status, items.created_at, items.updated_at,
      users.id AS seller_id, users.full_name AS seller_name
    FROM items
    JOIN users ON users.id = items.seller_id
    WHERE users.is_active = 1
  `;
  const params = [];

  if (q) {
    sql += " AND (items.title LIKE ? OR items.description LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category && category !== "all") {
    sql += " AND items.category = ?";
    params.push(category);
  }
  if (Number.isFinite(min)) {
    sql += " AND items.price >= ?";
    params.push(min);
  }
  if (Number.isFinite(max)) {
    sql += " AND items.price <= ?";
    params.push(max);
  }

  if (sort === "price_asc") sql += " ORDER BY items.price ASC";
  else if (sort === "price_desc") sql += " ORDER BY items.price DESC";
  else sql += " ORDER BY items.created_at DESC";

  const rows = db.prepare(sql).all(...params);
  return res.json({ items: rows.map(toItemDTO) });
});

app.get("/api/items/categories", (_req, res) => {
  const rows = db
    .prepare("SELECT DISTINCT category FROM items WHERE category IS NOT NULL ORDER BY category ASC")
    .all();
  return res.json({ categories: rows.map((r) => r.category) });
});

app.get("/api/items/:id", (req, res) => {
  const itemId = Number(req.params.id);
  if (!Number.isInteger(itemId)) {
    return res.status(400).json({ error: "Некорректный ID товара." });
  }

  const row = db
    .prepare(
      `
      SELECT
        items.id, items.title, items.description, items.price, items.image_url, items.seller_card,
        items.category, items.dorm_location, items.status, items.created_at, items.updated_at,
        users.id AS seller_id, users.full_name AS seller_name
      FROM items
      JOIN users ON users.id = items.seller_id
      WHERE items.id = ? AND users.is_active = 1
      `
    )
    .get(itemId);

  if (!row) {
    return res.status(404).json({ error: "Товар не найден." });
  }

  return res.json({ item: toItemDTO(row) });
});

app.post("/api/purchases", requireAuth, (req, res) => {
  const itemId = Number(req.body.itemId);
  if (!Number.isInteger(itemId)) {
    return res.status(400).json({ error: "Некорректный ID товара." });
  }

  const item = db
    .prepare(
      `
      SELECT
        items.id, items.title, items.description, items.price, items.image_url, items.seller_card,
        items.category, items.dorm_location, items.status, items.created_at, items.updated_at,
        users.id AS seller_id, users.full_name AS seller_name
      FROM items
      JOIN users ON users.id = items.seller_id
      WHERE items.id = ?
      `
    )
    .get(itemId);

  if (!item) {
    return res.status(404).json({ error: "Товар не найден." });
  }
  if (item.status === "sold") {
    return res.status(400).json({ error: "Этот товар уже продан." });
  }
  if (item.seller_id === req.user.id) {
    return res.status(400).json({ error: "Нельзя купить собственный товар." });
  }

  const exists = db.prepare("SELECT id FROM purchases WHERE item_id = ?").get(itemId);
  if (exists) {
    return res.status(409).json({ error: "Покупка уже была оформлена." });
  }

  const result = db
    .prepare(
      `
      INSERT INTO purchases (
        buyer_id, item_id, sold_price, transfer_status, seller_payment_confirmed, buyer_item_confirmed
      )
      VALUES (?, ?, ?, 'pending_seller_confirmation', 0, 0)
      `
    )
    .run(req.user.id, itemId, item.price);

  db.prepare("UPDATE items SET status = 'sold', updated_at = datetime('now') WHERE id = ?").run(itemId);

  return res.status(201).json({
    purchase: {
      id: Number(result.lastInsertRowid),
      itemId,
      soldPrice: item.price,
      transferStatus: "pending_seller_confirmation"
    }
  });
});

app.post("/api/purchases/:id/confirm-payment", requireAuth, (req, res) => {
  const purchaseId = Number(req.params.id);
  if (!Number.isInteger(purchaseId)) return res.status(400).json({ error: "Некорректный ID сделки." });

  const purchase = db
    .prepare(
      `
      SELECT purchases.*, items.seller_id
      FROM purchases
      JOIN items ON items.id = purchases.item_id
      WHERE purchases.id = ?
      `
    )
    .get(purchaseId);

  if (!purchase) return res.status(404).json({ error: "Сделка не найдена." });
  if (purchase.seller_id !== req.user.id) return res.status(403).json({ error: "Это может подтвердить только продавец." });
  if (purchase.transfer_status === "disputed") return res.status(400).json({ error: "По сделке уже открыт спор." });
  if (Number(purchase.seller_payment_confirmed) === 1) return res.json({ ok: true, transferStatus: purchase.transfer_status });

  const buyerConfirmed = Number(purchase.buyer_item_confirmed) === 1;
  const nextStatus = buyerConfirmed ? "completed" : "pending_buyer_confirmation";

  db.prepare(
    `
    UPDATE purchases
    SET seller_payment_confirmed = 1, transfer_status = ?
    WHERE id = ?
    `
  ).run(nextStatus, purchaseId);

  return res.json({ ok: true, transferStatus: nextStatus });
});

app.post("/api/purchases/:id/confirm-receipt", requireAuth, (req, res) => {
  const purchaseId = Number(req.params.id);
  if (!Number.isInteger(purchaseId)) return res.status(400).json({ error: "Некорректный ID сделки." });

  const purchase = db.prepare("SELECT * FROM purchases WHERE id = ?").get(purchaseId);
  if (!purchase) return res.status(404).json({ error: "Сделка не найдена." });
  if (purchase.buyer_id !== req.user.id) return res.status(403).json({ error: "Это может подтвердить только покупатель." });
  if (purchase.transfer_status === "disputed") return res.status(400).json({ error: "По сделке уже открыт спор." });
  if (Number(purchase.buyer_item_confirmed) === 1) return res.json({ ok: true, transferStatus: purchase.transfer_status });

  const sellerConfirmed = Number(purchase.seller_payment_confirmed) === 1;
  const nextStatus = sellerConfirmed ? "completed" : "pending_seller_confirmation";

  db.prepare(
    `
    UPDATE purchases
    SET buyer_item_confirmed = 1, transfer_status = ?
    WHERE id = ?
    `
  ).run(nextStatus, purchaseId);

  return res.json({ ok: true, transferStatus: nextStatus });
});

app.post("/api/purchases/:id/dispute", requireAuth, (req, res) => {
  const purchaseId = Number(req.params.id);
  const note = String(req.body.note || "").trim();
  if (!Number.isInteger(purchaseId)) return res.status(400).json({ error: "Некорректный ID сделки." });
  if (note.length < 5) return res.status(400).json({ error: "Опишите проблему подробнее (минимум 5 символов)." });

  const purchase = db
    .prepare(
      `
      SELECT purchases.*, items.seller_id
      FROM purchases
      JOIN items ON items.id = purchases.item_id
      WHERE purchases.id = ?
      `
    )
    .get(purchaseId);

  if (!purchase) return res.status(404).json({ error: "Сделка не найдена." });
  if (purchase.buyer_id !== req.user.id && purchase.seller_id !== req.user.id) {
    return res.status(403).json({ error: "Вы не участник этой сделки." });
  }

  db.prepare(
    `
    UPDATE purchases
    SET transfer_status = 'disputed', dispute_note = ?, dispute_by = ?, dispute_opened_at = datetime('now')
    WHERE id = ?
    `
  ).run(note, req.user.id, purchaseId);

  return res.json({ ok: true });
});

app.get("/api/users/me/purchases", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        purchases.id AS purchase_id,
        purchases.created_at AS purchased_at,
        purchases.sold_price, purchases.transfer_status, purchases.seller_payment_confirmed, purchases.buyer_item_confirmed,
        purchases.dispute_note, purchases.dispute_by, purchases.dispute_opened_at,
        items.id, items.title, items.description, items.price, items.image_url, items.seller_card,
        items.category, items.dorm_location, items.status, items.created_at, items.updated_at,
        seller.id AS seller_id, seller.full_name AS seller_name
      FROM purchases
      JOIN items ON items.id = purchases.item_id
      JOIN users AS seller ON seller.id = items.seller_id
      WHERE purchases.buyer_id = ?
      ORDER BY purchases.created_at DESC
      `
    )
    .all(req.user.id);

  const purchases = rows.map(toPurchaseDTO);

  return res.json({ purchases });
});

app.get("/api/users/me/sales", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        purchases.id AS purchase_id,
        purchases.created_at AS purchased_at,
        purchases.sold_price, purchases.transfer_status, purchases.seller_payment_confirmed, purchases.buyer_item_confirmed,
        purchases.dispute_note, purchases.dispute_by, purchases.dispute_opened_at,
        buyer.id AS buyer_id, buyer.full_name AS buyer_name,
        items.id, items.title, items.description, items.price, items.image_url, items.seller_card,
        items.category, items.dorm_location, items.status, items.created_at, items.updated_at,
        seller.id AS seller_id, seller.full_name AS seller_name
      FROM purchases
      JOIN items ON items.id = purchases.item_id
      JOIN users AS seller ON seller.id = items.seller_id
      JOIN users AS buyer ON buyer.id = purchases.buyer_id
      WHERE items.seller_id = ?
      ORDER BY purchases.created_at DESC
      `
    )
    .all(req.user.id);

  return res.json({ sales: rows.map(toPurchaseDTO) });
});

app.get("/api/users/me/items", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        items.id, items.title, items.description, items.price, items.image_url, items.seller_card,
        items.category, items.dorm_location, items.status, items.created_at, items.updated_at,
        users.id AS seller_id, users.full_name AS seller_name
      FROM items
      JOIN users ON users.id = items.seller_id
      WHERE items.seller_id = ?
      ORDER BY items.created_at DESC
      `
    )
    .all(req.user.id);
  return res.json({ items: rows.map(toItemDTO) });
});

app.post("/api/items", requireAuth, (req, res) => {
  const title = String(req.body.title || "").trim();
  const description = String(req.body.description || "").trim();
  const category = String(req.body.category || "").trim() || "Р”СЂСѓРіРѕРµ";
  const dormLocation = String(req.body.dormLocation || "").trim() || "РќРµ СѓРєР°Р·Р°РЅРѕ";
  const sellerCard = normalizeCardNumber(req.body.sellerCard || "");
  const imageUrl = String(req.body.imageUrl || "").trim() || null;
  const price = Number(req.body.price);

  if (!title || !description || !Number.isFinite(price) || price < 0) {
    return res
      .status(400)
      .json({ error: "РџСЂРѕРІРµСЂСЊС‚Рµ РєРѕСЂСЂРµРєС‚РЅРѕСЃС‚СЊ РЅР°Р·РІР°РЅРёСЏ, РѕРїРёСЃР°РЅРёСЏ Рё С†РµРЅС‹." });
  }
  if (!isValidCardNumber(sellerCard)) {
    return res.status(400).json({ error: "Укажите корректный номер карты продавца (16 цифр)." });
  }

  const result = db
    .prepare(
      `
      INSERT INTO items (title, description, price, image_url, seller_card, category, dorm_location, status, seller_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `
    )
    .run(title, description, price, imageUrl, sellerCard, category, dormLocation, req.user.id);

  const row = db
    .prepare(
      `
      SELECT
        items.id, items.title, items.description, items.price, items.image_url, items.seller_card,
        items.category, items.dorm_location, items.status, items.created_at, items.updated_at,
        users.id AS seller_id, users.full_name AS seller_name
      FROM items
      JOIN users ON users.id = items.seller_id
      WHERE items.id = ?
      `
    )
    .get(result.lastInsertRowid);
  return res.status(201).json({ item: toItemDTO(row) });
});

app.put("/api/items/:id", requireAuth, (req, res) => {
  const itemId = Number(req.params.id);
  if (!Number.isInteger(itemId)) {
    return res.status(400).json({ error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ ID РѕР±СЉСЏРІР»РµРЅРёСЏ." });
  }

  const existing = db.prepare("SELECT id, seller_id FROM items WHERE id = ?").get(itemId);
  if (!existing) return res.status(404).json({ error: "РћР±СЉСЏРІР»РµРЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ." });
  if (req.user.role !== "admin" && existing.seller_id !== req.user.id) {
    return res.status(403).json({ error: "РњРѕР¶РЅРѕ СЂРµРґР°РєС‚РёСЂРѕРІР°С‚СЊ С‚РѕР»СЊРєРѕ СЃРІРѕРё РѕР±СЉСЏРІР»РµРЅРёСЏ." });
  }

  const title = String(req.body.title || "").trim();
  const description = String(req.body.description || "").trim();
  const category = String(req.body.category || "").trim() || "Р”СЂСѓРіРѕРµ";
  const dormLocation = String(req.body.dormLocation || "").trim() || "РќРµ СѓРєР°Р·Р°РЅРѕ";
  const sellerCard = normalizeCardNumber(req.body.sellerCard || "");
  const imageUrl = String(req.body.imageUrl || "").trim() || null;
  const status = req.body.status === "sold" ? "sold" : "active";
  const price = Number(req.body.price);

  if (!title || !description || !Number.isFinite(price) || price < 0) {
    return res
      .status(400)
      .json({ error: "РџСЂРѕРІРµСЂСЊС‚Рµ РєРѕСЂСЂРµРєС‚РЅРѕСЃС‚СЊ РЅР°Р·РІР°РЅРёСЏ, РѕРїРёСЃР°РЅРёСЏ Рё С†РµРЅС‹." });
  }
  if (!isValidCardNumber(sellerCard)) {
    return res.status(400).json({ error: "Укажите корректный номер карты продавца (16 цифр)." });
  }

  db.prepare(
    `
    UPDATE items
    SET title = ?, description = ?, price = ?, image_url = ?, seller_card = ?, category = ?, dorm_location = ?,
        status = ?, updated_at = datetime('now')
    WHERE id = ?
    `
  ).run(title, description, price, imageUrl, sellerCard, category, dormLocation, status, itemId);

  const row = db
    .prepare(
      `
      SELECT
        items.id, items.title, items.description, items.price, items.image_url, items.seller_card,
        items.category, items.dorm_location, items.status, items.created_at, items.updated_at,
        users.id AS seller_id, users.full_name AS seller_name
      FROM items
      JOIN users ON users.id = items.seller_id
      WHERE items.id = ?
      `
    )
    .get(itemId);
  return res.json({ item: toItemDTO(row) });
});

app.delete("/api/items/:id", requireAuth, (req, res) => {
  const itemId = Number(req.params.id);
  if (!Number.isInteger(itemId)) {
    return res.status(400).json({ error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ ID РѕР±СЉСЏРІР»РµРЅРёСЏ." });
  }
  const existing = db.prepare("SELECT id, seller_id FROM items WHERE id = ?").get(itemId);
  if (!existing) return res.status(404).json({ error: "РћР±СЉСЏРІР»РµРЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ." });
  if (req.user.role !== "admin" && existing.seller_id !== req.user.id) {
    return res.status(403).json({ error: "РњРѕР¶РЅРѕ СѓРґР°Р»СЏС‚СЊ С‚РѕР»СЊРєРѕ СЃРІРѕРё РѕР±СЉСЏРІР»РµРЅРёСЏ." });
  }

  db.prepare("DELETE FROM items WHERE id = ?").run(itemId);
  return res.json({ ok: true });
});

app.get("/api/admin/stats", requireAuth, requireAdmin, (_req, res) => {
  const usersCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  const activeUsersCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE is_active = 1").get().c;
  const itemsCount = db.prepare("SELECT COUNT(*) AS c FROM items").get().c;
  const soldItemsCount = db.prepare("SELECT COUNT(*) AS c FROM items WHERE status = 'sold'").get().c;
  const disputesCount = db.prepare("SELECT COUNT(*) AS c FROM purchases WHERE transfer_status = 'disputed'").get().c;
  return res.json({ usersCount, activeUsersCount, itemsCount, soldItemsCount, disputesCount });
});

app.get("/api/admin/users", requireAuth, requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        users.id, users.full_name, users.phone, users.email, users.role, users.is_active, users.created_at,
        COUNT(items.id) AS listings_count
      FROM users
      LEFT JOIN items ON items.seller_id = users.id
      GROUP BY users.id
      ORDER BY users.created_at DESC
      `
    )
    .all();
  const users = rows.map((row) => ({
    ...toUserDTO(row),
    listingsCount: row.listings_count
  }));
  return res.json({ users });
});

app.patch("/api/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) {
    return res.status(400).json({ error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ ID РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ." });
  }

  const target = db
    .prepare("SELECT id, full_name, phone, email, role, is_active, created_at FROM users WHERE id = ?")
    .get(userId);
  if (!target) {
    return res.status(404).json({ error: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ." });
  }
  if (target.id === req.user.id && req.body.isActive === false) {
    return res.status(400).json({ error: "РќРµР»СЊР·СЏ РґРµР°РєС‚РёРІРёСЂРѕРІР°С‚СЊ СЃР°РјРѕРіРѕ СЃРµР±СЏ." });
  }

  const nextRole = req.body.role === "admin" ? "admin" : "user";
  const nextActive = req.body.isActive === false ? 0 : 1;
  db.prepare("UPDATE users SET role = ?, is_active = ? WHERE id = ?").run(nextRole, nextActive, userId);

  const updated = db
    .prepare("SELECT id, full_name, phone, email, role, is_active, created_at FROM users WHERE id = ?")
    .get(userId);
  return res.json({ user: toUserDTO(updated) });
});

app.get("/api/admin/items", requireAuth, requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        items.id, items.title, items.description, items.price, items.image_url, items.seller_card,
        items.category, items.dorm_location, items.status, items.created_at, items.updated_at,
        users.id AS seller_id, users.full_name AS seller_name
      FROM items
      JOIN users ON users.id = items.seller_id
      ORDER BY items.created_at DESC
      `
    )
    .all();
  return res.json({ items: rows.map(toItemDTO) });
});

app.get("/api/admin/disputes", requireAuth, requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        purchases.id AS purchase_id,
        purchases.created_at AS purchased_at,
        purchases.sold_price, purchases.transfer_status, purchases.seller_payment_confirmed, purchases.buyer_item_confirmed,
        purchases.dispute_note, purchases.dispute_by, purchases.dispute_opened_at,
        buyer.id AS buyer_id, buyer.full_name AS buyer_name,
        items.id, items.title, items.description, items.price, items.image_url, items.seller_card,
        items.category, items.dorm_location, items.status, items.created_at, items.updated_at,
        seller.id AS seller_id, seller.full_name AS seller_name
      FROM purchases
      JOIN items ON items.id = purchases.item_id
      JOIN users AS seller ON seller.id = items.seller_id
      JOIN users AS buyer ON buyer.id = purchases.buyer_id
      WHERE purchases.transfer_status = 'disputed'
      ORDER BY purchases.dispute_opened_at DESC
      `
    )
    .all();
  return res.json({ disputes: rows.map(toPurchaseDTO) });
});

app.delete("/api/admin/items/:id", requireAuth, requireAdmin, (req, res) => {
  const itemId = Number(req.params.id);
  if (!Number.isInteger(itemId)) {
    return res.status(400).json({ error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ ID РѕР±СЉСЏРІР»РµРЅРёСЏ." });
  }
  const result = db.prepare("DELETE FROM items WHERE id = ?").run(itemId);
  if (!result.changes) {
    return res.status(404).json({ error: "РћР±СЉСЏРІР»РµРЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ." });
  }
  return res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  return res.status(500).json({ error: "Р’РЅСѓС‚СЂРµРЅРЅСЏСЏ РѕС€РёР±РєР° СЃРµСЂРІРµСЂР°." });
});

app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
  console.log(`Admin login: ${adminEmail}`);
  console.log(`Admin password: ${adminPassword}`);
});



