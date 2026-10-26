'use strict';
/* База данных LIVARO (PostgreSQL).
   Каждая запись программы (клиент, заказ, оплата…) — отдельная строка docs(coll, id) с JSON и номером версии.
   Каталог, настройки и счётчики номеров — строки coll='meta' (id: cat, settings, counters).
   rev — сквозной номер изменения: по нему другие сотрудники забирают свежие правки.
   Удалённая запись остаётся строкой с data = NULL, чтобы удаление тоже дошло до всех. */
const crypto = require('crypto');

const COLLS = ['clients', 'orders', 'payments', 'templates', 'trash', 'installments', 'stockMoves', 'meta'];
const META_IDS = ['cat', 'settings', 'counters'];
const ROLES = { admin: 'Руководитель (все права)', accountant: 'Бухгалтер', manager: 'Менеджер продаж', storekeeper: 'Склад' };

const SCHEMA = `
create table if not exists users(
  id serial primary key, login text unique not null, name text not null default '', role text not null default 'manager',
  pass text not null, active boolean not null default true, created_at timestamptz not null default now());
create table if not exists sessions(
  token text primary key, user_id int not null references users(id), expires_at timestamptz not null);
create sequence if not exists docs_rev;
create table if not exists docs(
  coll text not null, id text not null, data jsonb, version int not null default 1, rev bigint not null,
  updated_at timestamptz not null default now(), updated_by int, primary key(coll, id));
create index if not exists docs_rev_i on docs(rev);
create table if not exists audit(
  id bigserial primary key, at timestamptz not null default now(), user_id int, coll text, doc_id text, action text, before jsonb, after jsonb);
create index if not exists audit_at_i on audit(at desc);
`;

/* подключение: на сервере — PostgreSQL по DATABASE_URL; в тестах — PGlite (тот же PostgreSQL прямо в процессе) */
function connectPg(url) {
  const { Pool } = require('pg');
  const internal = /\.railway\.internal|localhost|127\.0\.0\.1/.test(url) || /sslmode=disable/.test(url);
  const pool = new Pool({ connectionString: url, ssl: internal ? false : { rejectUnauthorized: false }, max: 5 });
  return {
    query: (text, params) => pool.query(text, params),
    exec: text => pool.query(text), // несколько команд одним текстом (создание таблиц)
    async tx(fn) {
      const c = await pool.connect();
      try { await c.query('begin'); const r = await fn(c); await c.query('commit'); return r; }
      catch (e) { await c.query('rollback').catch(() => {}); throw e; }
      finally { c.release(); }
    },
    end: () => pool.end()
  };
}
function connectLite(pg) {
  return { query: (text, params) => pg.query(text, params), exec: text => pg.exec(text), tx: fn => pg.transaction(t => fn(t)), end: () => pg.close() };
}

/* одинаковая запись JSON независимо от порядка полей (PostgreSQL переставляет поля внутри jsonb) */
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
const js = v => (v === null || v === undefined ? null : JSON.stringify(v)); // SQL NULL, а не JSON null

/* пароли: scrypt с солью */
function hashPass(p) {
  const salt = crypto.randomBytes(16);
  return 'scrypt$' + salt.toString('hex') + '$' + crypto.scryptSync(String(p), salt, 64).toString('hex');
}
function checkPass(p, stored) {
  const [kind, salt, hash] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const a = crypto.scryptSync(String(p), Buffer.from(salt, 'hex'), 64), b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const tokenHash = t => crypto.createHash('sha256').update(t).digest('hex');

function store(db) {
  return {
    db,
    async init(log) {
      await db.exec(SCHEMA);
      const n = Number((await db.query('select count(*) as n from users')).rows[0].n);
      if (!n) { // первый запуск: создаём руководителя
        const login = process.env.ADMIN_LOGIN || 'admin', pass = process.env.ADMIN_PASSWORD || crypto.randomBytes(6).toString('base64url');
        await db.query('insert into users(login, name, role, pass) values ($1, $2, $3, $4)', [login, 'Руководитель', 'admin', hashPass(pass)]);
        if (log) log('Создан первый пользователь: логин «' + login + '»' + (process.env.ADMIN_PASSWORD ? ' (пароль из ADMIN_PASSWORD)' : ', пароль: ' + pass + ' — смените после входа'));
      }
    },

    /* ---------- вход ---------- */
    async login(login, pass) {
      const u = (await db.query('select * from users where lower(login) = lower($1)', [String(login || '').trim()])).rows[0];
      if (!u || !u.active || !checkPass(pass, u.pass)) return null;
      const token = crypto.randomBytes(32).toString('base64url');
      await db.query("insert into sessions(token, user_id, expires_at) values ($1, $2, now() + interval '30 days')", [tokenHash(token), u.id]);
      await db.query('delete from sessions where expires_at < now()');
      return { token, user: pub(u) };
    },
    async session(token) {
      if (!token) return null;
      const u = (await db.query('select u.* from sessions s join users u on u.id = s.user_id where s.token = $1 and s.expires_at > now() and u.active', [tokenHash(token)])).rows[0];
      return u ? pub(u) : null;
    },
    logout: token => db.query('delete from sessions where token = $1', [tokenHash(token || '')]),

    /* ---------- сотрудники ---------- */
    users: async () => (await db.query('select * from users order by id')).rows.map(pub),
    async addUser(x) {
      const login = String(x.login || '').trim();
      if (!/^[\wа-яё.\-]{2,40}$/i.test(login)) throw httpErr(400, 'Логин: 2–40 букв, цифр, точек или дефисов, без пробелов');
      if (String(x.password || '').length < 6) throw httpErr(400, 'Пароль — не короче 6 символов');
      if (!ROLES[x.role]) throw httpErr(400, 'Неизвестная роль');
      if ((await db.query('select 1 from users where lower(login) = lower($1)', [login])).rows.length) throw httpErr(400, 'Такой логин уже есть');
      const r = await db.query('insert into users(login, name, role, pass) values ($1, $2, $3, $4) returning *', [login, String(x.name || '').trim(), x.role, hashPass(x.password)]);
      return pub(r.rows[0]);
    },
    async updUser(me, id, x) {
      const u = (await db.query('select * from users where id = $1', [id])).rows[0];
      if (!u) throw httpErr(404, 'Сотрудник не найден');
      if (u.id === me.id && (x.active === false || (x.role && x.role !== 'admin'))) throw httpErr(400, 'Нельзя отключить себя или снять у себя права руководителя');
      if (x.role !== undefined && !ROLES[x.role]) throw httpErr(400, 'Неизвестная роль');
      if (x.password !== undefined && String(x.password).length < 6) throw httpErr(400, 'Пароль — не короче 6 символов');
      await db.query('update users set name = coalesce($2, name), role = coalesce($3, role), active = coalesce($4, active), pass = coalesce($5, pass) where id = $1',
        [id, x.name === undefined ? null : String(x.name).trim(), x.role || null, typeof x.active === 'boolean' ? x.active : null, x.password !== undefined ? hashPass(x.password) : null]);
      if (x.active === false || x.password !== undefined) await db.query('delete from sessions where user_id = $1', [id]); // выкинуть из программы
      return pub((await db.query('select * from users where id = $1', [id])).rows[0]);
    },

    /* ---------- данные ---------- */
    async boot() {
      const rev = Number((await db.query('select coalesce(max(rev), 0) as r from docs')).rows[0].r);
      const docs = (await db.query('select coll, id, data, version from docs where data is not null order by rev')).rows;
      return { rev, docs };
    },
    async changes(since) {
      const rows = (await db.query('select coll, id, data, version, rev from docs where rev > $1 order by rev limit 2000', [since])).rows;
      return { rev: rows.length ? Number(rows[rows.length - 1].rev) : since, more: rows.length === 2000, changes: rows.map(r => ({ coll: r.coll, id: r.id, data: r.data, version: r.version })) };
    },
    /* изменения от программы: [{coll, id, data|null, base}] — base = версия, которую сотрудник видел.
       Если запись успел изменить кто-то другой — не затираем, а возвращаем её как конфликт. */
    sync(user, changes) {
      return db.tx(async c => {
        await c.query('select pg_advisory_xact_lock(4242)'); // правки идут по очереди: номера rev не перепутаются
        const applied = [], conflicts = [];
        for (const ch of changes) {
          const row = (await c.query('select data, version from docs where coll = $1 and id = $2 for update', [ch.coll, ch.id])).rows[0];
          const curV = row ? row.version : 0, curData = row ? row.data : null;
          if (curV !== ch.base) {
            if (stable(curData) === stable(ch.data)) { applied.push({ coll: ch.coll, id: ch.id, version: curV }); continue; } // уже то же самое
            conflicts.push({ coll: ch.coll, id: ch.id, data: curData, version: curV }); continue;
          }
          if (!row && ch.data === null) continue;
          const v = curV + 1, rv = Number((await c.query("select nextval('docs_rev') as r")).rows[0].r);
          if (row) await c.query('update docs set data = $3::jsonb, version = $4, rev = $5, updated_at = now(), updated_by = $6 where coll = $1 and id = $2', [ch.coll, ch.id, js(ch.data), v, rv, user.id]);
          else await c.query('insert into docs(coll, id, data, version, rev, updated_by) values ($1, $2, $3::jsonb, $4, $5, $6)', [ch.coll, ch.id, js(ch.data), v, rv, user.id]);
          const action = curData === null ? 'create' : ch.data === null ? 'delete' : 'update';
          await c.query('insert into audit(user_id, coll, doc_id, action, before, after) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)', [user.id, ch.coll, ch.id, action, js(curData), js(ch.data)]);
          applied.push({ coll: ch.coll, id: ch.id, version: v });
        }
        return { applied, conflicts };
      });
    },
    async audit(limit, before) {
      return (await db.query(`select a.id, a.at, a.coll, a.doc_id, a.action, a.before, a.after, u.login, u.name from audit a left join users u on u.id = a.user_id
        where ($2::bigint is null or a.id < $2) order by a.id desc limit $1`, [limit, before || null])).rows.map(r => Object.assign(r, { id: Number(r.id) }));
    }
  };
}
const pub = u => ({ id: u.id, login: u.login, name: u.name, role: u.role, roleName: ROLES[u.role] || u.role, active: u.active });
function httpErr(code, msg) { const e = new Error(msg); e.code = code; return e; }

module.exports = { connectPg, connectLite, store, stable, httpErr, COLLS, META_IDS, ROLES };
