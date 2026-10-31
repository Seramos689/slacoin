/**
 * SLACOIN full-stack server (Render-ready)
 * Serves the user app + admin panel and JSON API with file persistence.
 *
 * Start:  npm start
 * Local:  http://localhost:3000
 * Admin:  http://localhost:3000/admin.html
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'data.json');

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {
      users: {},
      products: [],
      codes: {},
      pending: [],
      contacts: [],
      deposit: { btcAddress: '', qrDataUrl: '' },
      contactCfg: {}
    };
  }
}
function saveDB(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}
let db = loadDB();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function send(res, status, body, type) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': type || 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,DELETE',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(data)
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => {
      data += c;
      if (data.length > 5e6) {
        req.destroy();
        reject(new Error('body too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let filePath = pathname;
  if (pathname === '/' || pathname === '') filePath = '/index.html';
  else if (pathname === '/admin' || pathname === '/admin/') filePath = '/admin.html';
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(PUBLIC, filePath);
  if (!full.startsWith(PUBLIC)) {
    send(res, 403, { error: 'Forbidden' });
    return;
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      send(res, 404, { error: 'Not found' });
      return;
    }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,DELETE',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const p = url.pathname;

  try {
    // --- API ---
    if (p === '/api/health') {
      return send(res, 200, { ok: true, service: 'slacoin' });
    }

    if (p === '/api/products' && req.method === 'GET') {
      return send(res, 200, db.products);
    }

    if (p === '/api/products' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.id || body.price == null) return send(res, 400, { error: 'id and price required' });
      db.products.push({
        id: body.id,
        desc: body.desc || body.id,
        price: Number(body.price),
        qty: Number(body.qty) || 0,
        image: body.image || '',
        earnPercent: Number(body.earnPercent) || 25,
        earnDays: Number(body.earnDays) || 7
      });
      saveDB(db);
      return send(res, 200, { ok: true, products: db.products });
    }

    if (p.startsWith('/api/products/') && req.method === 'DELETE') {
      const id = decodeURIComponent(p.replace('/api/products/', ''));
      db.products = db.products.filter(x => x.id !== id);
      saveDB(db);
      return send(res, 200, { ok: true });
    }

    if (p === '/api/register' && req.method === 'POST') {
      const b = await readBody(req);
      const key = String(b.username || '').toLowerCase();
      if (!key || !b.password) return send(res, 400, { error: 'Required fields missing' });
      if (db.users[key]) return send(res, 409, { error: 'Username taken' });
      const referralCode = ('SLA' + Math.random().toString(36).slice(2, 10)).toUpperCase();
      let invitedBy = null;
      if (b.referralCode) {
        const inv = Object.values(db.users).find(u => u.referralCode === String(b.referralCode).toUpperCase());
        if (inv) invitedBy = inv.username;
      }
      db.users[key] = {
        username: b.username,
        firstName: b.firstName || '',
        lastName: b.lastName || '',
        phone: b.phone || '',
        country: b.country || '',
        email: b.email || (b.username + '@slacoin.io'),
        password: b.password,
        balance: 0,
        referralCode,
        invitedBy
      };
      saveDB(db);
      const { password, ...pub } = db.users[key];
      return send(res, 200, { ok: true, user: pub });
    }

    if (p === '/api/login' && req.method === 'POST') {
      const b = await readBody(req);
      const key = String(b.username || '').toLowerCase();
      let user = db.users[key] || Object.values(db.users).find(u =>
        (u.email && u.email.toLowerCase() === key) || u.username.toLowerCase() === key
      );
      if (!user && b.username === 'demo' && b.password === 'Demo@123') {
        user = { username: 'demo', email: 'demo@slacoin.io', balance: 0, referralCode: 'SLADEMO01', country: 'United States', password: 'Demo@123' };
      }
      if (!user || user.password !== b.password) return send(res, 401, { error: 'Invalid credentials' });
      const { password, ...pub } = user;
      return send(res, 200, { ok: true, user: pub });
    }

    if (p === '/api/purchase' && req.method === 'POST') {
      const b = await readBody(req);
      const user = db.users[String(b.username || '').toLowerCase()];
      if (!user) return send(res, 404, { error: 'User not found' });
      const product = db.products.find(x => x.id === b.productId);
      if (!product) return send(res, 404, { error: 'Product not found' });
      const q = Math.max(1, parseInt(b.qty, 10) || 1);
      const total = product.price * q;
      if (product.qty < q) return send(res, 400, { error: 'Not enough stock' });
      if (user.balance < total) return send(res, 400, { error: 'Insufficient balance' });
      user.balance -= total;
      product.qty -= q;
      saveDB(db);
      return send(res, 200, {
        ok: true,
        balance: user.balance,
        product,
        earnPercent: product.earnPercent || 25,
        earnDays: product.earnDays || 7,
        total
      });
    }

    if (p === '/api/recharge' && req.method === 'POST') {
      const b = await readBody(req);
      const user = db.users[String(b.username || '').toLowerCase()];
      if (!user) return send(res, 404, { error: 'User not found' });
      const code = String(b.code || '').trim().toUpperCase();
      const entry = db.codes[code];
      if (!entry) return send(res, 400, { error: 'Invalid code' });
      if (entry.used) return send(res, 400, { error: 'Code used' });
      entry.used = true;
      user.balance += Number(entry.amount);
      db.pending.unshift({
        id: 'RCH-' + Date.now(), type: 'recharge', username: user.username,
        amount: entry.amount, code, status: 'completed', date: new Date().toISOString()
      });
      saveDB(db);
      return send(res, 200, { ok: true, amount: entry.amount, balance: user.balance });
    }

    if (p === '/api/pending' && req.method === 'GET') {
      return send(res, 200, db.pending || []);
    }

    if (p === '/api/pending' && req.method === 'POST') {
      const b = await readBody(req);
      if (!db.pending) db.pending = [];
      db.pending.unshift({ ...b, id: b.id || ('REQ-' + Date.now()), date: new Date().toISOString() });
      saveDB(db);
      return send(res, 200, { ok: true });
    }

    if (p === '/api/deposit-config' && req.method === 'GET') {
      return send(res, 200, db.deposit || {});
    }

    if (p === '/api/deposit-config' && req.method === 'POST') {
      const b = await readBody(req);
      db.deposit = { btcAddress: b.btcAddress || '', qrDataUrl: b.qrDataUrl || '' };
      saveDB(db);
      return send(res, 200, { ok: true });
    }

    if (p === '/api/codes' && req.method === 'GET') {
      return send(res, 200, db.codes || {});
    }

    if (p === '/api/codes' && req.method === 'POST') {
      const b = await readBody(req);
      const code = String(b.code || '').trim().toUpperCase();
      if (!code || !b.amount) return send(res, 400, { error: 'code and amount required' });
      if (!db.codes) db.codes = {};
      db.codes[code] = { amount: Number(b.amount), used: false };
      saveDB(db);
      return send(res, 200, { ok: true });
    }

    if (p === '/api/contact' && req.method === 'POST') {
      const b = await readBody(req);
      if (!db.contacts) db.contacts = [];
      db.contacts.unshift({ ...b, id: 'MSG-' + Date.now(), date: new Date().toISOString() });
      if (!db.pending) db.pending = [];
      db.pending.unshift({
        id: 'MSG-' + Date.now(), type: 'contact', username: b.username, name: b.name,
        email: b.email, message: b.message, status: 'new', date: new Date().toISOString()
      });
      saveDB(db);
      return send(res, 200, { ok: true });
    }

    if (p === '/api/users' && req.method === 'GET') {
      const list = Object.values(db.users).map(({ password, ...u }) => u);
      return send(res, 200, list);
    }

    // Static files
    return serveStatic(req, res, p);
  } catch (err) {
    send(res, 500, { error: err.message || 'Server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('SLACOIN running on port ' + PORT);
  console.log('App:   http://localhost:' + PORT + '/');
  console.log('Admin: http://localhost:' + PORT + '/admin.html');
});
