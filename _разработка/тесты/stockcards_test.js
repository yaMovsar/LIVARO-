// Склад карточками (01.11.2026): сводка, «скоро закончится», минимум модели и папки, метки в каталоге заказа, корзина, «Товары», вход управляющего
const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const T = (d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(new Date());
const NOW = Date.now(), OLD = NOW - 40 * 864e5;
const K = c => 'Корпус Милан 4х ' + c + ' 220х180х52';
const mv = (name, q, t) => ({ id: 'm' + name.length + q + t, date: T, name, q, kind: 'adj', note: '', createdAt: t });
const db0 = { v: 1, templates: [], trash: [], payments: [], installments: [], instNo: 1, settings: {},
  cat: [{ n: '1. Шкафы', ch: [{ n: 'Милан 4х', ch: [], it: [[K('БЕЛЫЙ'), 21000], [K('СЕРЫЙ'), 21000], [K('ВАНИЛЬ'), 21000], [K('ЛИНО'), 21000]] },
    { n: 'Техно', ch: [], it: [['Шкаф Техно 2х БЕЛЫЙ', 14000], ['Шкаф Техно 2х СЕРЫЙ', 14000]] }], it: [] }, { n: '2. Ручки', ch: [], it: [['Ручка 60', 700]] }],
  clients: [{ id: 'c', name: 'Рашид', opening: 0 }],
  // белых 10, серых 2 (мало), ванили 6 но за месяц продали 20 (скоро), лино не вносили (= 0, нет); Техно не на учёте
  stockMoves: [mv(K('БЕЛЫЙ'), 10, OLD), mv(K('СЕРЫЙ'), 2, OLD), mv(K('ВАНИЛЬ'), 26, OLD)],
  orders: [{ id: 's', no: 1, date: T, shipDate: T, shippedAt: NOW - 5 * 864e5, createdAt: NOW - 5 * 864e5, status: 'shipped', clientId: 'c', groups: [{ t: 'Ш', items: [{ n: K('ВАНИЛЬ'), q: 20, p: 21000 }] }], total: 420000 },
    { id: 'r', no: 2, date: T, createdAt: NOW, status: 'ordered', clientId: 'c', groups: [{ t: 'Ш', items: [{ n: K('БЕЛЫЙ'), q: 3, p: 21000 }] }], total: 63000 }],
  cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 3, lastBackup: NOW, notice: '' };
let fails = 0;
const R = (k, ok, info) => { console.log((ok ? 'OK   ' : 'FAIL ') + k + (info !== undefined ? ' — ' + info : '')); if (!ok) fails++; };
function open(hash, viewer) {
  const errors = [];
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' + hash, beforeParse(w) {
    w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
    if (viewer) w.LIVARO_BOOT = { user: { role: 'viewer', login: 'upr' } };
    w.addEventListener('error', e => errors.push(e.message));
  } });
  return { w: dom.window, d: dom.window.document, errors };
}
try {
  let { w, d, errors } = open('#/stock');
  const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
  const nav = h => { w.location.hash = h; w.dispatchEvent(new w.HashChangeEvent('hashchange')); };
  const tiles = () => [...d.querySelectorAll('.stile .v')].map(x => x.textContent).join(' / ');
  R('1 сводка: всего 18 шт (10+2+6), мало 1, скоро 1, нет 1', tiles() === '18 шт / 1 / 1 / 1', tiles());
  R('2 на учёте одна карточка (Техно не вносили)', d.querySelectorAll('.scard').length === 1 && d.querySelector('.stt b').textContent === 'Милан 4х', d.querySelectorAll('.scard').length);
  const row = c => [...d.querySelectorAll('.srow')].find(r => r.textContent.includes(c));
  R('3 цвета: белый ok, серый мало, ваниль скоро, лино нет', row('Белый').querySelector('b').className === 'ok' && row('Серый').querySelector('b').className === 'low' && row('Ваниль').querySelector('b').className === 'soon' && row('Лино').querySelector('b').className === 'no');
  R('4 в заказах 3', d.querySelector('.sfoot').textContent.includes('в заказах: 3'));
  click(d.querySelector('[data-act="st-scope"][data-v="all"]')); R('5 «Весь каталог» — видно и Техно, и ручки', d.querySelectorAll('.scard').length === 3, d.querySelectorAll('.scard').length);
  click(d.querySelector('[data-act="st-scope"][data-v="have"]'));
  click(d.querySelector('[data-act="st-f"][data-v="soon"]')); R('6 плитка «Скоро закончится» фильтрует', d.querySelectorAll('.scard').length === 1);
  click(d.querySelector('[data-act="st-f"][data-v=""]'));
  // окно цвета
  click(row('Белый')); R('7 окно цвета: 10 / 3 / 7 и история', d.querySelector('#modal .snums').textContent.replace(/\D+/g, ' ').trim() === '10 3 7' && d.querySelectorAll('#modal .box .line').length === 1);
  w.eval('modal("")');
  // минимум модели
  click(d.querySelector('[data-act="sk-min"]')); d.getElementById('smin-n').value = '12'; click(d.querySelector('[data-act="sk-min-save"]'));
  R('8 минимум 12 → белый 10 стал «мало»', row('Белый').querySelector('b').className === 'low' && d.querySelector('.smin').textContent === 'мин. 12');
  // минимум на папку
  click(d.querySelector('[data-act="sk-min"]')); d.getElementById('smin-n').value = '1'; d.getElementById('smin-all').checked = true; click(d.querySelector('[data-act="sk-min-save"]'));
  const S = w.eval('DB.settings');
  R('9 минимум на папку: личный убран, у папки 1', !Object.keys(S.stockMin || {}).length && Object.values(S.stockMinF || {})[0] === 1 && row('Серый').querySelector('b').className === 'ok', JSON.stringify(S.stockMinF));
  // каталог заказа
  nav('#/order'); w.eval('UI.q = "Корпус Милан 4х"; render()');
  const it = c => [...d.querySelectorAll('#cat-list .it')].find(x => x.textContent.includes(c)).querySelector('.sb');
  R('10 метки в каталоге: белый свободно 7, ваниль 6, лино нет', it('БЕЛЫЙ').textContent === '7 шт' && it('ВАНИЛЬ').textContent === '6 шт' && it('ЛИНО').textContent === 'нет');
  R('10б у товара не на учёте метки нет', w.eval('UI.q = "Техно"; render()') === undefined && !d.querySelector('#cat-list .sb'));
  // корзина
  w.eval('DB.cart = { groups: [{ t: "Шкаф 1", items: [{ n: ' + JSON.stringify(K('БЕЛЫЙ')) + ', q: 9, p: 21000 }] }], cur: 0 }; render()');
  R('11 корзина: 9 белых при свободных 7 — предупреждение', (d.querySelector('.cshort') || {}).textContent === 'на складе свободно 7 шт — не хватает 2');
  w.eval('DB.cart = { groups: [{ t: "Шкаф 1", items: [{ n: ' + JSON.stringify(K('БЕЛЫЙ')) + ', q: 9, p: 21000 }] }], cur: 0, editId: "r" }; render()');
  R('12 изменение заказа: его резерв 3 не считается — 9 ≤ 10, без предупреждения', !d.querySelector('.cshort'));
  // «Товары»
  nav('#/catalog'); w.eval('UI.selCat = DB.cat[0]; render()');
  const col = [...d.querySelectorAll('tbody tr')].map(r => r.children[2].textContent).join(',');
  R('13 «Товары»: колонка «На складе»', [...d.querySelectorAll('thead th')].some(t => t.textContent === 'На складе') && col === '10,2,6,0,—,—', col);
  R('14 ошибок JS нет', !errors.length, errors.join(' | '));

  // управляющий
  ({ w, d, errors } = open('#/home', true));
  R('15 управляющий: сразу склад, в меню только «Склад»', d.querySelector('h1').textContent === 'Склад' && d.querySelectorAll('#side a').length === 1);
  R('16 у управляющего нет кнопок прихода/пересчёта/минимума и движений', !d.querySelector('[data-act="sk-open"]') && !d.querySelector('[data-act="sk-min"]') && !d.querySelector('[data-act="sk-del"]') && !d.querySelector('a[href="#/inv"]'));
  w.location.hash = '#/clients'; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  R('17 другие разделы управляющему не открываются', d.querySelector('h1').textContent === 'Склад');
  d.querySelector('.srow').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  R('18 окно цвета у управляющего без кнопок изменения', !!d.querySelector('#modal .snums') && !d.querySelector('#modal [data-act="sk-open"]'));
  R('19 ошибок JS нет', !errors.length, errors.join(' | '));
} catch (e) { console.log('FAIL', e.stack); fails++; }
console.log(fails ? 'ОШИБОК: ' + fails : 'Все проверки пройдены');
