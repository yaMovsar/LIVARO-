'use strict';
/* Сервер онлайн-версии LIVARO.
   Отдаёт ту же программу (LIVARO.html + app/), но вставляет в неё данные из базы и модуль синхронизации.
   Расчёты (баланс, оплаты накладных, склад) по-прежнему считает сама программа в браузере. */
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const { connectPg, connectLite, store, httpErr, COLLS, META_IDS } = require('./db');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const MAX_BODY = 30 * 1024 * 1024;

function createApp(S, opts) {
  opts = opts || {};
  const log = opts.log || (() => {});
  const fails = new Map(); // защита от подбора пароля: ip+логин → {n, until}

  /* ---------- помощники ---------- */
  const cookies = req => Object.fromEntries(String(req.headers.cookie || '').split(';').map(s => s.trim().split('=')).filter(x => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
  const https = req => req.headers['x-forwarded-proto'] === 'https';
  const sidCookie = (req, token, age) => 'livaro_sid=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + age + (https(req) ? '; Secure' : '');
  function send(res, code, body, headers) {
    res.writeHead(code, Object.assign({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' }, headers || {}));
    res.end(body);
  }
  const json = (res, code, obj) => send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });
  const redirect = (res, to) => send(res, 302, '', { Location: to });
  function body(req) {
    return new Promise((ok, bad) => {
      const parts = []; let n = 0;
      req.on('data', c => { n += c.length; if (n > MAX_BODY) { bad(httpErr(413, 'Слишком большой объём данных')); req.destroy(); } else parts.push(c); });
      req.on('end', () => { try { ok(n ? JSON.parse(Buffer.concat(parts).toString('utf8')) : {}); } catch (e) { bad(httpErr(400, 'Неверный формат запроса')); } });
      req.on('error', bad);
    });
  }

  /* ---------- статические файлы: только программа, всё остальное в папке не отдаём ---------- */
  const cache = new Map();
  function fileEntry(rel) {
    const abs = path.join(ROOT, rel), st = fs.statSync(abs), key = rel + '|' + st.mtimeMs + '|' + st.size;
    let e = cache.get(rel);
    if (!e || e.key !== key) {
      const raw = fs.readFileSync(abs), ext = path.extname(rel).toLowerCase();
      e = { key, raw, type: MIME[ext] || 'application/octet-stream', etag: '"' + crypto.createHash('sha1').update(key).digest('hex').slice(0, 16) + '"',
        gz: /text|javascript|json|svg/.test(MIME[ext] || '') ? zlib.gzipSync(raw) : null };
      cache.set(rel, e);
    }
    return e;
  }
  function serveFile(req, res, rel) {
    let e; try { e = fileEntry(rel); } catch (err) { return send(res, 404, 'Не найдено'); }
    if (req.headers['if-none-match'] === e.etag) return send(res, 304, '', { ETag: e.etag, 'Cache-Control': 'no-cache' });
    const gz = e.gz && /gzip/.test(req.headers['accept-encoding'] || '');
    send(res, 200, req.method === 'HEAD' ? '' : (gz ? e.gz : e.raw), Object.assign({ 'Content-Type': e.type, ETag: e.etag, 'Cache-Control': 'no-cache' }, gz ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}));
  }
  const appFile = p => { // app/... без выхода за папку
    const rel = path.posix.normalize(p.replace(/^\/+/, ''));
    return rel.startsWith('app/') && !rel.includes('..') && /\.(js|css|png|svg|ico|woff2)$/.test(rel) ? rel : null;
  };

  /* программа с данными: данные вставляются прямо в страницу, чтобы программа стартовала сразу с ними */
  async function serveApp(req, res, user) {
    const B = await S.boot();
    B.user = user;
    const LS = new RegExp(String.fromCharCode(0x2028), 'g'), PS = new RegExp(String.fromCharCode(0x2029), 'g'); // эти символы ломают <script>
    const BS = String.fromCharCode(92); // обратная косая: «<» и разделители строк заменяются кодами вида u003c
    const data = JSON.stringify(B).replace(/</g, BS + 'u003c').replace(LS, BS + 'u2028').replace(PS, BS + 'u2029');
    let html = fs.readFileSync(path.join(ROOT, 'LIVARO.html'), 'utf8');
    html = html.replace(/(<script src="app\/app\.js[^"]*"><\/script>)/,
      '<script>window.LIVARO_BOOT=' + data + ';</script><script src="app/online-boot.js"></script>\n$1\n<script src="app/online.js"></script>');
    const gz = /gzip/.test(req.headers['accept-encoding'] || '');
    send(res, 200, gz ? zlib.gzipSync(html) : html, Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, gz ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}));
  }

  /* проверка изменений от программы */
  function cleanChanges(list) {
    if (!Array.isArray(list) || list.length > 20000) throw httpErr(400, 'Неверный список изменений');
    return list.map(c => {
      const ok = c && COLLS.includes(c.coll) && typeof c.id === 'string' && c.id.length > 0 && c.id.length <= 100 &&
        (c.coll !== 'meta' || META_IDS.includes(c.id)) && (c.data === null || (typeof c.data === 'object' && !Array.isArray(c.data)) || (c.coll === 'meta' && Array.isArray(c.data))) &&
        Number.isInteger(c.base) && c.base >= 0;
      if (!ok) throw httpErr(400, 'Неверная запись: ' + (c && c.coll) + '/' + (c && c.id));
      return { coll: c.coll, id: c.id, data: c.data, base: c.base };
    });
  }

  /* ---------- маршруты ---------- */
  async function handle(req, res) {
    const url = new URL(req.url, 'http://x'), p = url.pathname, m = req.method;
    if (p === '/healthz') return send(res, 200, 'ok');
    if (p === '/login.html' || p === '/login') return serveFile(req, res, 'server/login.html');

    // POST-запросы принимаем только от нашей программы (защита от подделки запросов с чужих сайтов)
    if (m === 'POST' && req.headers['x-livaro'] !== '1') return json(res, 403, { error: 'Запрос отклонён' });

    if (p === '/api/login' && m === 'POST') {
      const b = await body(req), ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const key = ip + '|' + String(b.login || '').toLowerCase(), f = fails.get(key);
      if (f && f.n >= 8 && f.until > Date.now()) return json(res, 429, { error: 'Слишком много попыток. Подождите ' + Math.ceil((f.until - Date.now()) / 60000) + ' мин.' });
      const r = await S.login(b.login, b.password);
      if (!r) {
        const x = f && f.until > Date.now() ? f : { n: 0 }; x.n++; x.until = Date.now() + 15 * 60000; fails.set(key, x);
        return json(res, 401, { error: 'Неверный логин или пароль' });
      }
      fails.delete(key);
      return send(res, 200, JSON.stringify({ user: r.user }), { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': sidCookie(req, r.token, 30 * 86400) });
    }

    const sid = cookies(req).livaro_sid, user = await S.session(sid);
    if (p === '/api/logout' && m === 'POST') { if (sid) await S.logout(sid); return send(res, 200, '{}', { 'Content-Type': 'application/json', 'Set-Cookie': sidCookie(req, '', 0) }); }

    if (!user) {
      if (p.startsWith('/api/')) return json(res, 401, { error: 'Нужно войти' });
      return redirect(res, '/login.html');
    }
    if (p === '/' || p === '/index.html') return redirect(res, '/LIVARO.html');
    if (p === '/LIVARO.html') return serveApp(req, res, user);
    if (p === '/admin.html') return user.role === 'admin' ? serveFile(req, res, 'server/admin.html') : redirect(res, '/LIVARO.html');
    const af = appFile(p); if (af && (m === 'GET' || m === 'HEAD')) return serveFile(req, res, af);

    if (p === '/api/me') return json(res, 200, { user });
    if (p === '/api/changes' && m === 'GET') return json(res, 200, await S.changes(Math.max(0, parseInt(url.searchParams.get('since'), 10) || 0)));
    if (p === '/api/sync' && m === 'POST') { const b = await body(req); return json(res, 200, await S.sync(user, cleanChanges(b.changes))); }

    // только руководитель: сотрудники и журнал изменений
    if (p.startsWith('/api/users') || p === '/api/audit') {
      if (user.role !== 'admin') return json(res, 403, { error: 'Только для руководителя' });
      if (p === '/api/users' && m === 'GET') return json(res, 200, { users: await S.users() });
      if (p === '/api/users' && m === 'POST') return json(res, 200, { user: await S.addUser(await body(req)) });
      const mm = p.match(/^\/api\/users\/(\d+)$/);
      if (mm && m === 'POST') return json(res, 200, { user: await S.updUser(user, +mm[1], await body(req)) });
      if (p === '/api/audit') return json(res, 200, { rows: await S.audit(Math.min(500, parseInt(url.searchParams.get('limit'), 10) || 200), parseInt(url.searchParams.get('before'), 10) || null) });
    }
    return send(res, 404, 'Не найдено');
  }

  return http.createServer((req, res) => {
    handle(req, res).catch(e => {
      if (!e.code || e.code >= 500 || typeof e.code !== 'number') log('Ошибка: ' + (e.stack || e));
      if (!res.headersSent) json(res, typeof e.code === 'number' ? e.code : 500, { error: typeof e.code === 'number' ? e.message : 'Ошибка сервера' });
    });
  });
}

/* запуск на сервере */
if (require.main === module) {
  (async () => {
    const log = m => console.log(new Date().toISOString() + ' ' + m);
    let db;
    if (process.env.DATABASE_URL) db = connectPg(process.env.DATABASE_URL);
    else if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
      log('НЕТ БАЗЫ ДАННЫХ: добавьте в проект Railway сервис PostgreSQL и в переменных этого сервиса задайте DATABASE_URL = ${{Postgres.DATABASE_URL}}');
      process.exit(1);
    } else { // без базы — PGlite в папке (для пробного запуска на своём компьютере)
      const { PGlite } = require('@electric-sql/pglite');
      db = connectLite(new PGlite(path.join(ROOT, '.local-db')));
      log('DATABASE_URL не задан — данные пишутся в папку .local-db (только для проверки на своём компьютере)');
    }
    const S = store(db); await S.init(log);
    const port = +process.env.PORT || 3000;
    createApp(S, { log }).listen(port, () => log('LIVARO онлайн: порт ' + port));
  })().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { createApp };
