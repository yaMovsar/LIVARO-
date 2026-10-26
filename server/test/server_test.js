// Сервер онлайн-версии: вход, доступ, синхронизация, конфликты, сотрудники, журнал (PostgreSQL в памяти — PGlite)
process.env.ADMIN_LOGIN = 'boss'; process.env.ADMIN_PASSWORD = 'secret123';
const { PGlite } = require('@electric-sql/pglite');
const { connectLite, store } = require('../db');
const { createApp } = require('../index');

let fails = 0;
const check = (name, ok, extra) => { console.log((ok ? 'OK   ' : 'FAIL ') + name + (extra !== undefined ? ' — ' + extra : '')); if (!ok) fails++; };

(async () => {
  const S = store(connectLite(new PGlite())); await S.init();
  const srv = createApp(S).listen(0); await new Promise(r => srv.on('listening', r));
  const B = 'http://127.0.0.1:' + srv.address().port;
  const req = (p, o) => fetch(B + p, Object.assign({ redirect: 'manual' }, o || {}));
  const post = (p, data, cookie, extra) => req(p, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', 'X-LIVARO': '1' }, cookie ? { cookie } : {}, extra || {}), body: JSON.stringify(data) });
  const get = (p, cookie) => req(p, { headers: cookie ? { cookie } : {} });
  const login = async (l, p) => { const r = await post('/api/login', { login: l, password: p }); return r.ok ? r.headers.get('set-cookie').split(';')[0] : null; };

  try {
    // без входа
    let r = await get('/LIVARO.html'); check('без входа программа → страница входа', r.status === 302 && r.headers.get('location') === '/login.html');
    r = await get('/api/changes?since=0'); check('без входа API → 401', r.status === 401);
    r = await get('/login.html'); check('страница входа открывается', r.status === 200 && (await r.text()).includes('Войти'));
    r = await req('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"login":"boss","password":"secret123"}' });
    check('POST без заголовка X-LIVARO отклонён', r.status === 403);

    // вход
    r = await post('/api/login', { login: 'boss', password: 'нет' }); check('неверный пароль → 401', r.status === 401);
    for (let i = 0; i < 8; i++) await post('/api/login', { login: 'robot', password: 'x' + i });
    r = await post('/api/login', { login: 'robot', password: 'x' }); check('после 8 ошибок — пауза (429)', r.status === 429, (await r.json()).error);
    const boss = await login('boss', 'secret123'); check('вход руководителя', !!boss);
    r = await post('/api/login', { login: 'BOSS', password: 'secret123' }); check('логин без учёта регистра', r.ok);
    r = await get('/api/me', boss); check('/api/me', (await r.json()).user.role === 'admin');

    // файлы: только программа
    r = await get('/LIVARO.html', boss); const html = await r.text();
    check('программа с данными и синхронизацией', r.status === 200 && html.includes('window.LIVARO_BOOT=') && html.includes('app/online.js') && html.indexOf('online-boot.js') < html.indexOf('app/app.js'));
    r = await get('/', boss); check('/ → программа', r.status === 302 && r.headers.get('location') === '/LIVARO.html');
    r = await req('/app/app.js', { headers: { cookie: boss, 'accept-encoding': 'gzip' } }); check('app/app.js отдаётся сжатым', r.status === 200 && r.headers.get('content-encoding') === 'gzip');
    const etag = r.headers.get('etag'); r = await req('/app/app.js', { headers: { cookie: boss, 'if-none-match': etag } }); check('повторно — 304 (из кэша)', r.status === 304);
    for (const p of ['/CLAUDE.md', '/server/db.js', '/app/../server/db.js', '/package.json', '/Резервные%20копии/x.json', '/.git/config']) {
      r = await get(p, boss); check('закрыт файл ' + p, r.status === 404);
    }

    // синхронизация
    const c1 = { id: 'c1', name: 'Тест Клиент', opening: 0, createdAt: 1 };
    let d = await (await post('/api/sync', { changes: [{ coll: 'clients', id: 'c1', data: c1, base: 0 }] }, boss)).json();
    check('новая запись сохранена (версия 1)', d.applied.length === 1 && d.applied[0].version === 1 && !d.conflicts.length);
    d = await (await post('/api/sync', { changes: [{ coll: 'clients', id: 'c1', data: Object.assign({}, c1, { name: 'Другое имя' }), base: 0 }] }, boss)).json();
    check('правка по устаревшей версии → конфликт, не затирает', d.conflicts.length === 1 && d.conflicts[0].data.name === 'Тест Клиент' && d.conflicts[0].version === 1);
    d = await (await post('/api/sync', { changes: [{ coll: 'clients', id: 'c1', data: { createdAt: 1, opening: 0, name: 'Тест Клиент', id: 'c1' }, base: 0 }] }, boss)).json();
    check('то же самое содержимое (другой порядок полей) — не конфликт', d.applied.length === 1 && !d.conflicts.length);
    d = await (await post('/api/sync', { changes: [{ coll: 'clients', id: 'c1', data: Object.assign({}, c1, { phone: '8 900 000 00 00' }), base: 1 }] }, boss)).json();
    check('правка по свежей версии → версия 2', d.applied[0].version === 2);
    d = await (await get('/api/changes?since=0', boss)).json();
    check('изменения для коллег', d.changes.length === 1 && d.changes[0].data.phone === '8 900 000 00 00' && d.rev > 0);
    const rev = d.rev;
    d = await (await post('/api/sync', { changes: [{ coll: 'clients', id: 'c1', data: null, base: 2 }] }, boss)).json();
    d = await (await get('/api/changes?since=' + rev, boss)).json();
    check('удаление доходит до коллег', d.changes.length === 1 && d.changes[0].data === null);
    d = await (await post('/api/sync', { changes: [{ coll: 'meta', id: 'cat', data: [{ n: 'Папка', ch: [], it: [['Товар', 100]] }], base: 0 }] }, boss)).json();
    check('каталог (meta/cat) сохраняется', d.applied.length === 1);
    r = await post('/api/sync', { changes: [{ coll: 'hack', id: 'x', data: {}, base: 0 }] }, boss); check('чужой раздел → 400', r.status === 400);
    r = await post('/api/sync', { changes: [{ coll: 'meta', id: 'evil', data: {}, base: 0 }] }, boss); check('неизвестная meta → 400', r.status === 400);
    d = await (await get('/LIVARO.html', boss)).text();
    check('в программе — актуальные данные без удалённых', d.includes('"Папка"') && !d.includes('"c1"'));
    const x = await S.boot(); check('boot: rev и записи', x.rev > 0 && x.docs.length === 1);

    // сотрудники
    r = await post('/api/users', { login: 'magomed', name: 'Магомед', role: 'storekeeper', password: '12345' }, boss); check('короткий пароль не принят', r.status === 400);
    r = await post('/api/users', { login: 'magomed', name: 'Магомед', role: 'storekeeper', password: '123456' }, boss); const mag = (await r.json()).user;
    check('сотрудник добавлен', r.ok && mag.role === 'storekeeper');
    r = await post('/api/users', { login: 'Magomed', name: 'x', role: 'manager', password: '123456' }, boss); check('повтор логина не принят', r.status === 400);
    const mc = await login('magomed', '123456'); check('сотрудник входит', !!mc);
    r = await get('/api/users', mc); check('сотруднику список сотрудников закрыт', r.status === 403);
    r = await get('/admin.html', mc); check('сотруднику страница руководителя закрыта', r.status === 302);
    r = await post('/api/sync', { changes: [{ coll: 'stockMoves', id: 's1', data: { id: 's1', name: 'Товар', q: 5, kind: 'in' }, base: 0 }] }, mc); check('сотрудник сохраняет данные', r.ok);
    r = await post('/api/users/' + mag.id, { active: false }, boss); check('руководитель отключает сотрудника', r.ok);
    r = await get('/api/me', mc); check('отключённого выкидывает из программы', r.status === 401);
    r = await post('/api/users/1', { active: false }, boss); check('нельзя отключить самого себя', r.status === 400);
    r = await get('/admin.html', boss); check('страница руководителя', r.status === 200);

    // журнал
    d = await (await get('/api/audit', boss)).json();
    const acts = d.rows.map(r => r.action + ':' + r.coll + (r.login ? '@' + r.login : ''));
    check('журнал изменений: кто и что', acts.includes('create:clients@boss') && acts.includes('update:clients@boss') && acts.includes('delete:clients@boss') && acts.includes('create:stockMoves@magomed'), acts.slice(0, 6).join(', '));

    // выход
    r = await post('/api/logout', {}, boss); r = await get('/api/me', boss); check('после выхода сессия недействительна', r.status === 401);
  } catch (e) { console.log('FAIL', e.stack); fails++; }
  srv.close(); await S.db.end();
  console.log(fails ? 'ОШИБОК: ' + fails : 'Все проверки пройдены');
  process.exit(fails ? 1 : 0);
})();
