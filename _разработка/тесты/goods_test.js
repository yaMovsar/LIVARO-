const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const T = (d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(new Date());
const o = (id, no, total) => ({ id, no, date: T, shipDate: T, shippedAt: no, status: 'shipped', clientId: 'r', groups: [{ t: 'Ш', items: [{ n: 'Шкаф', q: 1, p: total }] }], total, createdAt: no });
const db0 = { v: 1, templates: [], trash: [], installments: [], instNo: 1, stockMoves: [], payments: [],
  cat: [{ n: 'Кровати', ch: [], it: [['Подъемный механизм 160', 4000]] }], clients: [{ id: 'r', name: 'Рашид', opening: 0 }],
  orders: [o('a', 1, 100000), o('b', 2, 50000)], cart: { groups: [], cur: 0 }, nextNo: 3, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/client/r', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const input = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const change = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const db = () => JSON.parse(w.localStorage.getItem('livaro_db_v1'));
const sync = () => w.dispatchEvent(new w.HashChangeEvent('hashchange'));
try {
  // 1) ткань: клиент написал «120 м по 165, сумма 28 000»
  click(d.querySelector('[data-act="pay-new"]'));
  change(d.getElementById('p-method'), 'goods');
  console.log('1 блок «товаром» показан:', d.getElementById('p-goods').style.display);
  input(d.getElementById('p-what'), 'Ткань'); change(d.getElementById('p-unit'), 'м'); input(d.getElementById('p-qty'), '120'); input(d.getElementById('p-price'), '165');
  console.log('  сумма подставилась:', d.getElementById('p-amount').value, '|', d.getElementById('p-check').textContent);
  input(d.getElementById('p-amount'), '28 000');
  console.log('2 клиент написал 28 000:', d.getElementById('p-check').textContent.replace(/\s+/g, ' '));
  click(d.querySelector('[data-act="goods-fix"]')); console.log('  «Поставить» →', d.getElementById('p-amount').value);
  click(d.querySelector('[data-act="pay-save"]'));
  // 2) механизмы из каталога — с оприходованием
  click(d.querySelector('[data-act="pay-new"]')); change(d.getElementById('p-method'), 'goods');
  input(d.getElementById('p-what'), 'Подъемный механизм 160'); input(d.getElementById('p-qty'), '5'); input(d.getElementById('p-price'), '4 000');
  console.log('3 галочка «на склад» видна:', d.getElementById('p-stockrow').style.display);
  click(d.querySelector('[data-act="pay-save"]'));
  const p = db().payments; console.log('4 оплаты:', p.map(x => x.method + ' ' + x.amount + ' «' + x.note + '»').join(' | '));
  console.log('  склад:', JSON.stringify(db().stockMoves.map(m => m.name + ' +' + m.q + ' (' + m.note + ')')));
  console.log('  баланс Рашида:', d.querySelector('.tile .v').textContent, '(150 000 − 19 800 − 20 000 = долг 110 200)');
  // 3) журнал оплат и главная
  w.location.hash = '#/payments'; sync();
  console.log('5 оплаты:', [...d.querySelectorAll('.line')].map(l => l.textContent).join(' | '));
  click(d.querySelector('[data-act="pay-kind"][data-v="goods"]')); console.log('  фильтр «товаром»:', d.querySelectorAll('tbody tr').length, 'строк');
  w.location.hash = '#/home'; sync(); console.log('6 главная:', [...d.querySelectorAll('.tile')].find(t => t.textContent.includes('Получено')).textContent);
  // 4) отметить накладную оплаченной товаром
  w.location.hash = '#/sales'; sync(); click(d.querySelector('[data-act="range-open"]')); click(d.querySelector('[data-act="rp-clear"]')); click(d.querySelector('[data-act="rp-apply"]'));
  d.querySelector('[data-ch="ssel"]').click(); click(d.querySelector('[data-act="bulk-open"]')); click(d.querySelector('[data-act="bulk-method"][data-v="goods"]'));
  input(d.getElementById('b-what'), 'Скотч'); change(d.getElementById('b-unit'), 'рул.'); input(d.getElementById('b-qty'), '50'); input(d.getElementById('b-price'), '300');
  console.log('7 оплата накладных товаром, сумма:', d.getElementById('b-amount').value);
  click(d.querySelector('[data-act="bulk-save"]'));
  console.log('  последняя оплата:', db().payments.slice(-1)[0].note, db().payments.slice(-1)[0].amount);
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
