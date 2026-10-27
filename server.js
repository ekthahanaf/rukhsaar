'use strict';
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UP_DIR = path.join(ROOT, 'public', 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UP_DIR, { recursive: true });

/* ---------- password hashing ---------- */
function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(String(pw), salt, 32).toString('hex');
}
function checkPw(pw, stored) {
  const [salt, h] = String(stored).split(':');
  if (!salt || !h) return false;
  const a = Buffer.from(crypto.scryptSync(String(pw), salt, 32).toString('hex'));
  const b = Buffer.from(h);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- database (JSON file, kept in memory) ---------- */
let db;
if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} else {
  db = require('./seed')(hashPw(process.env.ADMIN_PASSWORD || 'admin123'));
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  }, 100);
}
const uid = (p) => p + crypto.randomBytes(5).toString('hex');

/* ---------- live updates (Server-Sent Events) ---------- */
const siteClients = new Set();
const adminClients = new Set();
function sseOpen(req, res, set) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
    Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
  });
  res.write('retry: 2000\n\n');
  set.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); set.delete(res); });
}
function broadcast(set, event) {
  for (const r of set) r.write(`event: ${event}\ndata: ${Date.now()}\n\n`);
}
const siteChanged = () => { broadcast(siteClients, 'update'); broadcast(adminClients, 'update'); };

/* ---------- app ---------- */
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

/* ---------- sessions ---------- */
const sessions = new Map(); // token -> expiry
const attempts = new Map(); // ip -> {n, t}
function getCookie(req, name) {
  const m = (req.headers.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
}
function auth(req, res, next) {
  const t = getCookie(req, 'rk_admin');
  const exp = sessions.get(t);
  if (t && exp && exp > Date.now()) return next();
  res.status(401).json({ error: 'Not logged in' });
}

/* ---------- public API ---------- */
function publicSettings() { return db.settings; }
function sitePayload() {
  return {
    settings: publicSettings(),
    collections: db.collections,
    products: db.products.filter((p) => !p.hidden),
    testimonials: db.testimonials,
  };
}
app.get('/api/site', (req, res) => { res.set('Cache-Control', 'no-store'); res.json(sitePayload()); });
app.get('/api/events', (req, res) => sseOpen(req, res, siteClients));

const clean = (s, n = 300) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);
const money = (n) => Number(n).toLocaleString('en-PK');

app.post('/api/orders', (req, res) => {
  const b = req.body || {};
  const c = b.customer || {};
  const customer = {
    name: clean(c.name, 80), phone: clean(c.phone, 25), email: clean(c.email, 100),
    address: clean(c.address, 250), city: clean(c.city, 60), notes: clean(c.notes, 400),
  };
  if (!customer.name || !customer.phone || !customer.address || !customer.city)
    return res.status(400).json({ error: 'Please fill name, phone, address and city.' });
  if (!/^[0-9+\-\s()]{7,25}$/.test(customer.phone))
    return res.status(400).json({ error: 'Please enter a valid phone number.' });
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 40)
    return res.status(400).json({ error: 'Your cart is empty.' });
  const items = [];
  for (const it of b.items) {
    const p = db.products.find((x) => x.id === it.id && !x.hidden);
    if (!p) return res.status(400).json({ error: 'A product in your cart is no longer available.' });
    const qty = Math.max(1, Math.min(20, parseInt(it.qty, 10) || 1));
    const size = clean(it.size, 30);
    items.push({ productId: p.id, name: p.name, price: p.price, size, qty, image: p.images[0] || '' });
  }
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const st = db.settings;
  const shipping = st.freeShippingOver > 0 && subtotal >= st.freeShippingOver ? 0 : Number(st.shipping) || 0;
  const order = {
    id: uid('o'), number: db.nextOrder++, items, customer, subtotal, shipping,
    total: subtotal + shipping, status: 'new', createdAt: Date.now(),
  };
  db.orders.unshift(order);
  save();
  broadcast(adminClients, 'order');
  res.json({ order: { number: order.number, total: order.total }, whatsappUrl: waLink(st.whatsapp, orderText(order)) });
});

function orderText(o) {
  const st = db.settings;
  const lines = [`*New order #${o.number} - ${st.brandName} ${st.brandSub || ''}*`, ''];
  o.items.forEach((i) => lines.push(`- ${i.name}${i.size ? ' (' + i.size + ')' : ''} x${i.qty} = ${st.currency} ${money(i.price * i.qty)}`));
  lines.push('', `Subtotal: ${st.currency} ${money(o.subtotal)}`, `Delivery: ${st.currency} ${money(o.shipping)}`, `*Total: ${st.currency} ${money(o.total)} (Cash on delivery)*`, '');
  lines.push(`Name: ${o.customer.name}`, `Phone: ${o.customer.phone}`);
  if (o.customer.email) lines.push(`Email: ${o.customer.email}`);
  lines.push(`Address: ${o.customer.address}, ${o.customer.city}`);
  if (o.customer.notes) lines.push(`Notes: ${o.customer.notes}`);
  return lines.join('\n');
}
function waLink(number, text) {
  return `https://wa.me/${String(number).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

/* ---------- admin API ---------- */
app.post('/api/admin/login', (req, res) => {
  const ip = req.ip;
  const a = attempts.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60 * 1000) { a.n = 0; a.t = Date.now(); }
  if (a.n >= 10) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  if (!checkPw((req.body || {}).password || '', db.adminPassword)) {
    a.n++; attempts.set(ip, a);
    return res.status(401).json({ error: 'Wrong password' });
  }
  attempts.delete(ip);
  const t = crypto.randomBytes(32).toString('hex');
  sessions.set(t, Date.now() + 14 * 24 * 3600 * 1000);
  res.setHeader('Set-Cookie', `rk_admin=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${14 * 24 * 3600}`);
  res.json({ ok: true, defaultPassword: checkPw('admin123', db.adminPassword) });
});
app.post('/api/admin/logout', (req, res) => {
  sessions.delete(getCookie(req, 'rk_admin'));
  res.setHeader('Set-Cookie', 'rk_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});
app.get('/api/admin/me', auth, (req, res) => res.json({ ok: true, defaultPassword: checkPw('admin123', db.adminPassword) }));
app.get('/api/admin/events', auth, (req, res) => sseOpen(req, res, adminClients));
app.get('/api/admin/data', auth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ settings: db.settings, collections: db.collections, products: db.products, testimonials: db.testimonials, orders: db.orders });
});
app.post('/api/admin/password', auth, (req, res) => {
  const { current, next } = req.body || {};
  if (!checkPw(current || '', db.adminPassword)) return res.status(400).json({ error: 'Current password is wrong' });
  if (!next || String(next).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  db.adminPassword = hashPw(next); save(); res.json({ ok: true });
});

app.put('/api/admin/settings', auth, (req, res) => {
  const b = req.body;
  if (!b || typeof b !== 'object' || Array.isArray(b)) return res.status(400).json({ error: 'Bad data' });
  db.settings = Object.assign({}, db.settings, b);
  save(); siteChanged(); res.json(db.settings);
});

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uid('c');

function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : d; }
function cleanProduct(b, old = {}) {
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    id: old.id || uid('p'),
    name: clean(b.name, 120) || old.name || 'Untitled',
    price: num(b.price, old.price || 0),
    comparePrice: num(b.comparePrice, 0),
    collections: arr(b.collections).map((x) => clean(x, 60)).filter(Boolean),
    images: arr(b.images).map((x) => clean(x, 400)).filter(Boolean),
    description: clean(b.description, 3000),
    sizes: arr(b.sizes).map((x) => clean(x, 30)).filter(Boolean),
    stock: Math.floor(num(b.stock, 0)),
    isNew: !!b.isNew,
    hidden: !!b.hidden,
    createdAt: old.createdAt || Date.now(),
  };
}
app.post('/api/admin/products', auth, (req, res) => {
  const p = cleanProduct(req.body || {});
  db.products.unshift(p); save(); siteChanged(); res.json(p);
});
app.put('/api/admin/products/:id', auth, (req, res) => {
  const i = db.products.findIndex((p) => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  db.products[i] = cleanProduct(req.body || {}, db.products[i]);
  save(); siteChanged(); res.json(db.products[i]);
});
app.delete('/api/admin/products/:id', auth, (req, res) => {
  db.products = db.products.filter((p) => p.id !== req.params.id);
  save(); siteChanged(); res.json({ ok: true });
});

function cleanCollection(b, old = {}) {
  return {
    id: old.id || uid('c'),
    slug: old.slug || slugify(b.name),
    name: clean(b.name, 80) || old.name || 'Collection',
    image: clean(b.image, 400),
    tileLabel: clean(b.tileLabel, 40) || clean(b.name, 40),
    showOnHome: !!b.showOnHome,
    showInTiles: !!b.showInTiles,
  };
}
app.post('/api/admin/collections', auth, (req, res) => {
  const c = cleanCollection(req.body || {});
  while (db.collections.some((x) => x.slug === c.slug)) c.slug += '-' + Math.floor(Math.random() * 90 + 10);
  db.collections.push(c); save(); siteChanged(); res.json(c);
});
app.put('/api/admin/collections/:id', auth, (req, res) => {
  const i = db.collections.findIndex((c) => c.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  db.collections[i] = cleanCollection(req.body || {}, db.collections[i]);
  save(); siteChanged(); res.json(db.collections[i]);
});
app.delete('/api/admin/collections/:id', auth, (req, res) => {
  db.collections = db.collections.filter((c) => c.id !== req.params.id);
  save(); siteChanged(); res.json({ ok: true });
});
app.post('/api/admin/collections-order', auth, (req, res) => {
  const ids = (req.body || {}).ids;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'Bad data' });
  db.collections.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  save(); siteChanged(); res.json({ ok: true });
});

function cleanTesti(b, old = {}) {
  return { id: old.id || uid('t'), text: clean(b.text, 600), author: clean(b.author, 80) };
}
app.post('/api/admin/testimonials', auth, (req, res) => {
  const t = cleanTesti(req.body || {}); db.testimonials.push(t); save(); siteChanged(); res.json(t);
});
app.put('/api/admin/testimonials/:id', auth, (req, res) => {
  const i = db.testimonials.findIndex((t) => t.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  db.testimonials[i] = cleanTesti(req.body || {}, db.testimonials[i]); save(); siteChanged(); res.json(db.testimonials[i]);
});
app.delete('/api/admin/testimonials/:id', auth, (req, res) => {
  db.testimonials = db.testimonials.filter((t) => t.id !== req.params.id); save(); siteChanged(); res.json({ ok: true });
});

app.put('/api/admin/orders/:id', auth, (req, res) => {
  const o = db.orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  const st = clean((req.body || {}).status, 20);
  if (['new', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(st)) o.status = st;
  save(); broadcast(adminClients, 'update'); res.json(o);
});
app.delete('/api/admin/orders/:id', auth, (req, res) => {
  db.orders = db.orders.filter((o) => o.id !== req.params.id); save(); broadcast(adminClients, 'update'); res.json({ ok: true });
});

/* ---------- uploads ---------- */
const MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'video/mp4': '.mp4', 'video/webm': '.webm' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UP_DIR,
    filename: (req, file, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + MIME[file.mimetype]),
  }),
  limits: { fileSize: 80 * 1024 * 1024, files: 12 },
  fileFilter: (req, file, cb) => cb(MIME[file.mimetype] ? null : new Error('Only JPG, PNG, WEBP, GIF, MP4 or WEBM files are allowed'), !!MIME[file.mimetype]),
});
app.post('/api/admin/upload', auth, (req, res) => {
  upload.array('files', 12)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ urls: (req.files || []).map((f) => '/uploads/' + f.filename) });
  });
});

/* ---------- static ---------- */
app.use('/uploads', express.static(UP_DIR, { maxAge: '7d', fallthrough: true }));
app.use('/admin', express.static(path.join(ROOT, 'public', 'admin'), { index: 'index.html' }));
app.use(express.static(path.join(ROOT, 'public'), { index: 'index.html', maxAge: 0 }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server error' }); });

app.listen(PORT, () => {
  console.log(`\n  Rukhsaar Clothes is running`);
  console.log(`  Website : http://localhost:${PORT}`);
  console.log(`  Admin   : http://localhost:${PORT}/admin   (first password: ${process.env.ADMIN_PASSWORD ? '[ADMIN_PASSWORD env]' : 'admin123 - change it after login'})\n`);
});
