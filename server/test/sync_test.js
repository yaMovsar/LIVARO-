// Два сотрудника в программе через сервер: обмен правками, конфликт, номера заказов, удаление, «лишние» отправки
process.env.ADMIN_LOGIN = 'boss'; process.env.ADMIN_PASSWORD = 'secret123';
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const { PGlite } = require('@electric-sql/pglite');
const { connectLite, store } = require('../db');
const { createApp } = require('../index');
const ROOT = path.join(__dirname, '..', '..');

let fails = 0;
const check = (name, ok, extra) => { console.log((ok ? 'OK   ' : 'FAIL ') + name + (extra !== undefined ? ' — ' + extra : '')); if (!ok) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const S = store(connectLite(new PGlite())); await S.init();
  const srv = createApp(S).listen(0); await new Promise(r => srv.on('listening', r));
  const BASE = 'http://127.0.0.1:' + srv.address().port;
  const login = async (l, p) => (await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LIVARO': '1' }, body: JSON.stringify({ login: l, password: p }) })).headers.get('set-cookie').split(';')[0];
  const doms = [];

  /* «браузер» сотрудника: страница с сервера, скрипты встраиваем, fetch идёт на сервер с его cookie */
  async function browser(cookie, name) {
    let html = await (await fetch(BASE + '/LIVARO.html', { headers: { cookie } })).text();
    html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(path.join(ROOT, s.split('?')[0]), 'utf8') + '<\/script>');
    const calls = [], errors = [];
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: BASE + '/LIVARO.html', beforeParse(w) {
      w.confirm = () => true; w.scrollTo = () => {}; w.AbortController = AbortController;
      w.fetch = (u, o) => { calls.push(u); return fetch(new URL(u, BASE), Object.assign({}, o, { headers: Object.assign({}, (o || {}).headers, { cookie }) })); };
      w.addEventListener('error', e => errors.push(e.message));
    } });
    doms.push(dom);
    const w = dom.window;
    return { w, calls, errors, name, sync: async () => { await w.LIVARO_SYNC.tick(); }, db: () => w.eval('DB') };
  }

  try {
    const bossC = await login('boss', 'secret123');
    await S.addUser({ login: 'aisha', name: 'Аиша', role: 'manager', password: '123456' });
    const aishaC = await login('aisha', '123456');

    // 1. первый вход: база на сервере пустая → программа создаёт новую и отправляет её
    const A = await browser(bossC, 'A');
    await wait(500); await A.sync();
    let boot = await S.boot();
    check('пустая база: каталог и настройки ушли на сервер', boot.docs.some(d => d.coll === 'meta' && d.id === 'cat' && d.data.length > 5), 'записей ' + boot.docs.length);
    check('у сотрудника показан вход и статус', /Руководитель/.test(A.w.document.getElementById('on-user').textContent) && /сохранено/.test(A.w.document.getElementById('on-user').textContent));

    // 2. без изменений программа ничего не отправляет (порядок полей в базе другой — это не изменение)
    let n = A.calls.filter(u => u.includes('/api/sync')).length; await A.sync(); await A.sync();
    check('нет лишних отправок без изменений', A.calls.filter(u => u.includes('/api/sync')).length === n);

    // 3. второй сотрудник открывает программу — видит ту же базу
    const Bw = await browser(aishaC, 'B'); await wait(400); await Bw.sync();
    check('второй сотрудник получил каталог', Bw.db().cat.length === A.db().cat.length && Bw.db().cat.length > 5);
    n = Bw.calls.filter(u => u.includes('/api/sync')).length; await Bw.sync();
    check('у второго тоже нет лишних отправок', Bw.calls.filter(u => u.includes('/api/sync')).length === n);

    // 4. A добавляет клиента → B видит его
    A.w.eval('DB.clients.push({ id: "cl1", name: "Тест ООО </script> «Мебель»", phone: "", opening: -5000, note: "", createdAt: Date.now() }); commit()');
    await A.sync(); await Bw.sync();
    check('клиент от A появился у B', Bw.db().clients.some(c => c.id === 'cl1' && c.opening === -5000));
    Bw.w.location.hash = '#/clients'; Bw.w.dispatchEvent(new Bw.w.HashChangeEvent('hashchange'));
    check('и на экране «Клиенты» у B', Bw.w.document.querySelector('#main').textContent.includes('Тест ООО'));
    const html = await (await fetch(BASE + '/LIVARO.html', { headers: { cookie: bossC } })).text();
    check('опасный текст в данных не ломает страницу', !html.includes('</script> «Мебель»') && html.includes('u003c/script>'));

    // 5. одновременная правка одного клиента: побеждает первый, у второго — его данные и предупреждение
    A.w.eval('client("cl1").phone = "8 900 111 11 11"; commit()');
    Bw.w.eval('client("cl1").phone = "8 900 222 22 22"; commit()');
    await A.sync(); await Bw.sync();
    check('конфликт: у B показан телефон от A', Bw.db().clients.find(c => c.id === 'cl1').phone === '8 900 111 11 11');
    check('конфликт: B предупреждён', /изменил другой сотрудник/.test(Bw.w.document.getElementById('toast').textContent));
    await A.sync();
    check('конфликт: A свои данные сохранил', A.db().clients.find(c => c.id === 'cl1').phone === '8 900 111 11 11');

    // 6. оба одновременно оформляют заказ — номера не должны совпасть
    const mk = 'const o = { id: uid(), no: DB.nextNo++, date: todayISO(), status: "ordered", clientId: "cl1", groups: [{ t: "Шкаф", items: [{ n: "Тест", q: 1, p: 1000 }] }], total: 1000, createdAt: Date.now() }; DB.orders.push(o); commit(); o.no';
    const noA = A.w.eval(mk), noB = Bw.w.eval(mk);
    await A.sync(); await Bw.sync(); await Bw.sync(); await A.sync();
    const nums = A.db().orders.map(o => o.no).sort(), numsB = Bw.db().orders.map(o => o.no).sort();
    check('одновременные заказы: номера разные', noA === noB && nums.length === 2 && nums[0] !== nums[1], 'взяли оба № ' + noA + ' → стали ' + nums.join(', '));
    check('одновременные заказы: у A и B одинаково', JSON.stringify(nums) === JSON.stringify(numsB));
    check('счётчик номеров дальше общий', A.db().nextNo === Bw.db().nextNo && A.db().nextNo === Math.max(...nums) + 1, 'следующий № ' + A.db().nextNo);
    check('B предупреждён о смене номера', /присвоен новый/.test(Bw.w.document.getElementById('toast').textContent));

    // 7. удаление клиента (в «Удалённые») доходит до коллеги
    A.w.eval('const c = client("cl1"); trashPush("client", c, c.name); DB.clients = DB.clients.filter(x => x !== c); commit()');
    await A.sync(); await Bw.sync();
    check('удалённый клиент исчез у B', !Bw.db().clients.some(c => c.id === 'cl1'));
    check('и лежит у B в «Удалённых»', Bw.db().trash.some(t => t.kind === 'client' && t.data.id === 'cl1'));

    // 8. экран не перерисовывается, пока сотрудник вводит текст; перерисуется после
    Bw.w.location.hash = '#/clients'; Bw.w.dispatchEvent(new Bw.w.HashChangeEvent('hashchange'));
    const inp = Bw.w.document.querySelector('#main input:not([type=file]):not([type=checkbox])'); inp.focus(); inp.value = 'ввожу';
    A.w.eval('DB.clients.push({ id: "cl2", name: "Второй клиент", phone: "", opening: 0, note: "", createdAt: Date.now() }); commit()');
    await A.sync(); await Bw.sync();
    check('во время ввода экран не сброшен', Bw.w.document.activeElement === inp && inp.value === 'ввожу' && /есть обновления/.test(Bw.w.document.getElementById('on-state').textContent));
    inp.blur(); inp.dispatchEvent(new Bw.w.FocusEvent('focusout', { bubbles: true })); await wait(120);
    check('после ввода обновления показаны', Bw.w.document.querySelector('#main').textContent.includes('Второй клиент'));

    // 9. перезагрузка страницы: всё на месте, корзина своя
    Bw.w.eval('DB.cart.groups[0].items.push({ n: "Черновик", q: 1, p: 1 }); save()'); await Bw.sync();
    const B2 = await browser(aishaC, 'B2'); await wait(300);
    check('после перезагрузки данные с сервера', B2.db().orders.length === 2 && B2.db().clients.some(c => c.id === 'cl2'));
    const srvCart = (await S.boot()).docs.some(d => JSON.stringify(d.data || '').includes('Черновик'));
    check('корзина заказа не уходит на сервер (у каждого своя)', !srvCart);

    // 10. журнал
    const acts = (await S.audit(200)).map(r => r.action + ':' + r.coll + '@' + r.login);
    check('журнал: кто что сделал', acts.includes('create:clients@boss') && acts.includes('create:orders@aisha') && acts.includes('delete:clients@boss'));

    [A, Bw, B2].forEach(b => { if (b.errors.length) check('ошибки скриптов у ' + b.name, false, b.errors.join('; ')); });
  } catch (e) { console.log('FAIL', e.stack); fails++; }
  doms.forEach(d => d.window.close()); srv.close(); await S.db.end();
  console.log(fails ? 'ОШИБОК: ' + fails : 'Все проверки пройдены');
  process.exit(fails ? 1 : 0);
})();
