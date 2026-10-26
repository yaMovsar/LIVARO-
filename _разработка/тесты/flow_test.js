const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
// старая база: клиент с авансом 100 000 и накладная без статуса (как было до изменения)
const old = { v: 1, cat: [{ n: 'Шкафы', ch: [], it: [['Шкаф А', 20000], ['Ручка', 0]] }], clients: [{ id: 'c1', name: 'Рашид', phone: '', opening: 100000 }],
  orders: [{ id: 'o1', no: 1, date: '2026-10-22', clientId: 'c1', groups: [{ t: 'Шкаф 1', items: [{ n: 'Шкаф А', q: 1, p: 20000 }] }], total: 20000, createdAt: 1 }],
  payments: [], templates: [], cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 2, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/home', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(old));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const change = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const input = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const sync = () => w.dispatchEvent(new w.HashChangeEvent('hashchange'));
const nav = h => { w.location.hash = h; sync(); };
const db = () => JSON.parse(w.localStorage.getItem('livaro_db_v1'));
const bal = () => { nav('#/clients'); return d.querySelector('tbody .tag').textContent; };
const add = s => { input(d.getElementById('cat-q'), s); click(d.querySelector('#cat-list .it')); };
try {
  console.log('1 миграция: статус старой накладной =', db().orders[0].status, '| баланс', bal(), '(ожидаем аванс 80 000)');
  nav('#/order'); add('Шкаф А'); add('Шкаф А');
  click(d.querySelector('[data-act="to-checkout"]')); sync();
  click(d.querySelector('.chip[data-act="ck-pick"]'));
  click(d.querySelector('[data-act="ck-pay"][data-v="transfer"]')); change(d.querySelector('[data-ch="ck-amount"]'), '5000');
  console.log('2 кнопка:', d.querySelector('[data-act="post"]').textContent, '| после отгрузки:', [...d.querySelectorAll('.line.tot')].pop().textContent);
  click(d.querySelector('[data-act="post"]')); sync();
  const id = db().orders[1].id;
  console.log('3 оформлен:', d.querySelector('h1').textContent, '| сообщение:', !!d.querySelector('.warn'), '| баланс', bal(), '(80 000 + 5 000 предоплата = аванс 85 000)');
  nav('#/home'); console.log('4 главная ждут отгрузки:', d.querySelectorAll('[data-act="ship-open"]').length, '| меню продажи бейдж:', d.querySelector('a[href="#/sales"] .cnt').textContent);
  nav('#/print/c/' + id); console.log('5 печать до отгрузки:', d.querySelector('.p-head').textContent, '|', [...d.querySelectorAll('.bal .line')].map(x => x.textContent).join(' ; '));
  nav('#/sale/' + id); click(d.querySelector('[data-act="order-edit"]')); sync();
  console.log('6 изменение:', !!d.querySelector('[data-act="edit-cancel"]'));
  click(d.querySelector('[data-act="qty"][data-d="-1"]'));
  click(d.querySelector('[data-act="to-checkout"]')); sync();
  console.log('   заголовок:', d.querySelector('h1').textContent, '| кнопка:', d.querySelector('[data-act="post"]').textContent);
  click(d.querySelector('[data-act="post"]')); sync();
  console.log('   после сохранения: заказов', db().orders.length, '| сумма', db().orders[1].total, '| №', db().orders[1].no, '| nextNo', db().nextNo);
  click(d.querySelector('[data-act="ship-open"]'));
  click(d.querySelector('[data-act="ship-pay"][data-v="driver"]')); input(d.getElementById('s-amount'), '10000');
  console.log('7 окно отгрузки, после:', d.getElementById('s-after').textContent);
  click(d.querySelector('[data-act="ship-do"]'));
  console.log('   отгружен:', d.querySelector('h1').textContent, '| баланс', bal(), '(85 000 − 20 000 = аванс 65 000, водитель ещё не привёз)');
  nav('#/drivers'); click(d.querySelector('[data-act="recv"]'));
  console.log('8 водитель привёз: баланс', bal(), '(аванс 75 000)');
  nav('#/print/c/' + id); console.log('9 печать после отгрузки:', d.querySelector('.p-head').textContent, '|', [...d.querySelectorAll('.bal .line')].map(x => x.textContent).join(' ; '));
  nav('#/sale/' + id); click(d.querySelector('[data-act="unship"]'));
  console.log('10 отмена отгрузки: статус', db().orders[1].status, '| оплат по заказу', db().payments.filter(p => p.orderId === id).length, '| баланс', bal(), '(85 000)');
  nav('#/sale/' + id); click(d.querySelector('[data-act="order-cancel"]'));
  console.log('11 отмена заказа:', db().orders[1].status, '| баланс', bal(), '(предоплата осталась: 85 000)');
  nav('#/sales'); console.log('   журнал:', [...d.querySelectorAll('tbody tr')].map(r => r.textContent).join(' || '));
  nav('#/sale/' + id); click(d.querySelector('[data-act="order-restore"]')); console.log('12 вернуть в работу:', db().orders[1].status);
  for (const v of ['home', 'clients', 'client/c1', 'reports', 'payments']) nav('#/' + v);
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
