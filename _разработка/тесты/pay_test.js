const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const ord = (id, no, cid, total, date) => ({ id, no, date, shipDate: date, shippedAt: no * 10, status: 'shipped', clientId: cid, groups: [{ t: 'Шкаф', items: [{ n: 'Шкаф А', q: 1, p: total }] }], total, createdAt: no });
// Шамиль: 3 отгрузки по 300 000, долг. Рашид: аванс 100 000, отгрузка 60 000 (должна быть «оплачена из аванса»), отгрузка 70 000 (частично 40 000).
const db0 = { v: 1, cat: [{ n: 'Шкафы', ch: [], it: [['Шкаф А', 1000]] }], templates: [],
  clients: [{ id: 'sh', name: 'Шамиль BUGLAN', opening: 0 }, { id: 'ra', name: 'Рашид ДАЧА', opening: 100000 }],
  orders: [ord('a', 1, 'sh', 300000, '2026-10-20'), ord('b', 2, 'sh', 300000, '2026-10-21'), ord('c', 3, 'sh', 300000, '2026-10-22'), ord('d', 4, 'ra', 60000, '2026-10-21'), ord('e', 5, 'ra', 70000, '2026-10-22')],
  payments: [], cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 6, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/sales', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const check = el => { el.click(); }; // как настоящий щелчок: переключает галочку и вызывает change
const input = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const sync = () => w.dispatchEvent(new w.HashChangeEvent('hashchange'));
const rows = () => [...d.querySelectorAll('tbody tr')].map(r => r.children[1].textContent + ' ' + r.children[3].textContent + ': ' + r.children[5].textContent).join('\n   ');
try {
  console.log('1 начало:\n   ' + rows());
  // выделить все накладные Шамиля (галочка не должна открыть накладную)
  ['a', 'b', 'c'].forEach(id => check(d.querySelector('[data-ch="ssel"][data-id="' + id + '"]')));
  console.log('2 hash после галочек:', w.location.hash, '| панель:', d.querySelector('.bulkbar').textContent.replace(/\s+/g, ' '));
  click(d.querySelector('[data-act="bulk-open"]'));
  click(d.querySelector('[data-act="bulk-method"][data-v="cash"]'));
  input(d.getElementById('b-amount'), '1 000 000');
  console.log('3 подсказка:', d.getElementById('b-hint').textContent);
  click(d.querySelector('[data-act="bulk-save"]'));
  console.log('4 после оплаты 1 000 000:\n   ' + rows());
  w.location.hash = '#/clients'; sync();
  console.log('5 балансы:', [...d.querySelectorAll('tbody tr')].map(r => r.children[0].textContent + ' ' + r.children[2].textContent).join(' | '));
  // одна накладная Рашида, частичная оплата через страницу накладной
  w.location.hash = '#/sale/e'; sync();
  console.log('6 накладная 5:', d.querySelector('.card h2 + div') ? [...d.querySelectorAll('.aside .card')].pop().textContent.replace(/\s+/g, ' ') : '');
  click(d.querySelector('[data-act="order-pay"]')); input(d.getElementById('b-amount'), '30000'); click(d.querySelector('[data-act="bulk-save"]'));
  console.log('7 после 30 000:', [...d.querySelectorAll('.aside .card')].pop().textContent.replace(/\s+/g, ' '));
  w.location.hash = '#/sales'; sync();
  click(d.querySelector('[data-act="sales-pay"][data-v="unpaid"]'));
  console.log('8 фильтр «Не оплачены»:', d.querySelectorAll('tbody tr').length, 'строк');
  w.location.hash = '#/payments'; sync();
  console.log('9 журнал оплат:', [...d.querySelectorAll('tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ')).join(' || '));
  for (const v of ['home', 'client/sh', 'print/c/a', 'reports']) { w.location.hash = '#/' + v; sync(); }
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);


