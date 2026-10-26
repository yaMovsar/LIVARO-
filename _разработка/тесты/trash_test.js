const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const ord = (id, no, cid, total, date, status) => ({ id, no, date, shipDate: status === 'ordered' ? null : date, shippedAt: no * 10, status: status || 'shipped', clientId: cid, groups: [{ t: 'Шкаф', items: [{ n: 'Шкаф А', q: 1, p: total }] }], total, createdAt: no });
const db0 = { v: 1, cat: [{ n: 'Шкафы', ch: [], it: [['Шкаф А', 1000]] }], templates: [],
  clients: [{ id: 'sh', name: 'Шамиль BUGLAN', opening: 0 }, { id: 'ra', name: 'Рашид ДАЧА', opening: 0 }],
  orders: [ord('a', 1, 'sh', 64000, todayISO()), ord('b', 2, 'ra', 30000, todayISO()), ord('c', 3, 'sh', 30000, todayISO()), ord('d', 4, 'ra', 10000, todayISO(), 'ordered')],
  payments: [], cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 5, lastBackup: Date.now(), notice: '' };
function todayISO() { const d = new Date(), p = x => (x < 10 ? '0' : '') + x; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/sales', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const sync = () => w.dispatchEvent(new w.HashChangeEvent('hashchange'));
const db = () => JSON.parse(w.localStorage.getItem('livaro_db_v1'));
const bal = id => { w.location.hash = '#/client/' + id; sync(); const v = d.querySelector('.tile .v').textContent; w.location.hash = '#/sales'; sync(); return v; };
try {
  console.log('1 kpi:', [...d.querySelectorAll('.kpi')].map(k => k.querySelector('.l').textContent + ' ' + k.querySelector('.v').textContent).join(' | '));
  console.log('  строк:', d.querySelectorAll('tbody tr').length, '| статусы:', [...d.querySelectorAll('tbody .st')].map(x => x.textContent).join(', '));
  console.log('  баланс Шамиля:', bal('sh'));
  ['a', 'c'].forEach(id => d.querySelector('[data-ch="ssel"][data-id="' + id + '"]').click());
  console.log('2 панель:', d.querySelector('.bulkbar').textContent.replace(/\s+/g, ' '), '| отступ снизу:', d.getElementById('main').classList.contains('has-bulk'));
  click(d.querySelector('[data-act="bulk-del"]'));
  console.log('3 после удаления: заказов', db().orders.length, '| в удалённых', db().trash.length, '| сообщение:', d.getElementById('toast').textContent, '| баланс Шамиля:', bal('sh'));
  click(d.querySelector('[data-act="toast-undo"]'));
  console.log('4 «Отменить»: заказов', db().orders.length, '| удалённых', db().trash.length, '| баланс Шамиля:', bal('sh'));
  // удалить одну накладную со страницы заказа и восстановить из раздела
  w.location.hash = '#/sale/b'; sync(); click(d.querySelector('[data-act="order-del"]')); sync();
  w.location.hash = '#/trash'; sync();
  console.log('5 раздел «Удалённые»:', [...d.querySelectorAll('tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ')).join(' || '), '| меню:', d.querySelector('a[href="#/trash"]').textContent);
  click(d.querySelector('[data-act="trash-restore"]'));
  console.log('6 восстановлено: заказов', db().orders.length, '| № сохранён:', db().orders.find(o => o.id === 'b').no);
  // оплата + удаление + восстановление сохраняет привязку оплаты
  w.location.hash = '#/sales'; sync();
  d.querySelector('[data-ch="ssel"][data-id="c"]').click(); click(d.querySelector('[data-act="bulk-open"]')); click(d.querySelector('[data-act="bulk-save"]'));
  d.querySelector('[data-ch="ssel"][data-id="c"]').click(); click(d.querySelector('[data-act="bulk-del"]'));
  console.log('7 оплаченная удалена, привязок у оплаты:', db().payments[0].alloc.length);
  click(d.querySelector('[data-act="toast-undo"]'));
  console.log('  восстановлена, привязок:', db().payments[0].alloc.length, '| статус оплаты:', [...d.querySelectorAll('tbody tr')].find(r => r.children[1].textContent === '3').children[5].textContent);
  for (const v of ['home', 'clients', 'payments', 'reports', 'drivers', 'data', 'order', 'catalog']) { w.location.hash = '#/' + v; sync(); }
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);

