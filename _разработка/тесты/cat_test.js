const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const db0 = { v: 1, templates: [{ id: 't1', t: 'Айша 6', items: [{ n: 'Корпус', q: 1, p: 30000 }] }],
  // старый формат корзины удалённых (без kind) — должен показаться как заказ
  trash: [{ id: 'old', order: { id: 'ox', no: 9, date: '2026-10-20', status: 'cancelled', clientId: 'c1', groups: [], total: 5000, createdAt: 1 }, payments: [], allocs: [], deletedAt: Date.now() }],
  cat: [{ n: 'Прочее', ch: [], it: [['Антресоль 2-х на корпус МИЛАН СЕРЫЙ', 3000], ['Антресоль 4-х на корпус МИЛАН СЕРЫЙ', 8000], ['Ручка', 0]] },
        { n: '4. Антресоль и пеналы', ch: [{ n: 'Антресоль 4х', ch: [], it: [] }], it: [['Антресоль 4-х на корпус МИЛАН БЕЛЫЙ', 8000], ['Антресоль 6-х на корпус МИЛАН БЕЛЫЙ', 12000]] }],
  clients: [{ id: 'c1', name: 'Пустой клиент', opening: 0 }, { id: 'c2', name: 'Рашид', opening: 0 }],
  orders: [{ id: 'o1', no: 1, date: '2026-10-21', shipDate: '2026-10-21', shippedAt: 5, status: 'shipped', clientId: 'c2', groups: [{ t: 'Ш', items: [{ n: 'Корпус', q: 1, p: 1000 }] }], total: 1000, createdAt: 1 }],
  payments: [{ id: 'p1', clientId: 'c2', amount: 1000, method: 'cash', status: 'received', date: '2026-10-21', receivedDate: '2026-10-21', orderId: null, createdAt: 9 }],
  cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 2, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/catalog', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.prompt = () => 'Новая папка'; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const input = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const sync = () => w.dispatchEvent(new w.HashChangeEvent('hashchange'));
const db = () => JSON.parse(w.localStorage.getItem('livaro_db_v1'));
const tree = () => db().cat.map(f => f.n + '[' + f.it.map(i => i[0].replace('на корпус МИЛАН ', '')).join(', ') + ']' + (f.ch.length ? '{' + f.ch.map(c => c.n + ':' + c.it.length).join(',') + '}' : '')).join(' ');
try {
  // 1) поиск по всем папкам → отметить все → перенести в «Антресоль 4х»
  input(d.getElementById('cat-q2'), 'Антресоль 4-х');
  console.log('1 найдено:', d.querySelectorAll('[data-ch="ccheck"]').length, '| из папок:', [...d.querySelectorAll('tbody .hint')].map(x => x.textContent).join('; '));
  d.querySelector('[data-ch="ccheck-all"]').click();
  const sel = d.getElementById('move-to'); sel.value = [...sel.options].find(o => o.textContent.includes('Антресоль 4х')).value;
  click(d.querySelector('[data-act="cmove"]'));
  console.log('  после переноса:', tree());
  // 2) модель во всех цветах
  click(d.querySelector('[data-act="catq-clear"]'));
  click([...d.querySelectorAll('.tn')].find(x => x.textContent.includes('4. Антресоль')));
  click(d.querySelector('[data-act="model-new"]'));
  d.getElementById('m-name').value = 'Антресоль 1-х на корпус МИЛАН'; d.getElementById('m-price').value = '1500';
  click(d.querySelector('[data-act="model-save"]'));
  console.log('2 модель:', db().cat[1].it.filter(i => i[0].includes('1-х')).map(i => i[0] + ' ' + i[1]).join(' | '));
  // 3) удаление товаров и папки → удалённые → восстановление по категориям
  input(d.getElementById('cat-q2'), 'Ручка'); d.querySelector('[data-ch="ccheck-all"]').click(); click(d.querySelector('[data-act="cdel-checked"]'));
  click(d.querySelector('[data-act="catq-clear"]'));
  click([...d.querySelectorAll('.tn')].find(x => x.textContent.includes('Прочее'))); click(d.querySelector('[data-act="cat-menu"]')); click(d.querySelector('[data-act="f-del"]'));
  w.location.hash = '#/templates-none'; w.location.hash = '#/order'; sync(); click(d.querySelector('[data-act="tpl-del"]'));
  w.location.hash = '#/payments'; sync();  click(d.querySelector('[data-act="pay-del"]'));
  w.location.hash = '#/client/c1'; sync(); click(d.querySelector('[data-act="client-del"]')); sync();
  w.location.hash = '#/client/c2'; sync(); click(d.querySelector('[data-act="client-del"]'));
  console.log('3 клиент с заказами не удаляется:', db().clients.some(c => c.id === 'c2'), '|', d.getElementById('toast').textContent.slice(0, 40));
  w.location.hash = '#/trash'; sync();
  console.log('4 удалённые, категории:', [...d.querySelectorAll('.seg button')].map(b => b.textContent).join(' / '));
  console.log('  строки:', [...d.querySelectorAll('tbody tr')].map(r => r.children[1].textContent).join(' | '));
  click(d.querySelector('[data-act="trash-kind"][data-v="item"]')); click(d.querySelector('[data-act="trash-restore-all"]'));
  click(d.querySelector('[data-act="trash-kind"][data-v="folder"]')); click(d.querySelector('[data-act="trash-restore-all"]'));
  console.log('5 восстановили товары и папки:', tree());
  click(d.querySelector('[data-act="trash-restore-all"]'));
  console.log('6 восстановили всё: шаблонов', db().templates.length, '| клиентов', db().clients.length, '| оплат', db().payments.length, '| заказов', db().orders.length, '| в удалённых', db().trash.length);
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);

