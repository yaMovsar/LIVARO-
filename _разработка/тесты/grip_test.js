const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const db0 = { v: 1, templates: [{ id: 't1', t: 'Айша 4х', items: [{ n: 'Корпус', q: 1, p: 24000 }] }], trash: [], clients: [], orders: [], payments: [], installments: [], instNo: 1,
  cat: [{ n: 'Шкафы', ch: [], it: [['Корпус', 24000], ['Дверь', 0]] }],
  cart: { groups: [{ t: 'Шкаф 1', items: [{ n: 'Корпус', q: 1, p: 24000 }, { n: 'Дверь', q: 4, p: 0 }] }, { t: 'Шкаф 2', items: [] }], cur: 0 }, nextNo: 1, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/order', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const ev = (type, el) => { const e = new w.Event(type, { bubbles: true, cancelable: true }); e.dataTransfer = { setData() {}, setDragImage() {} }; e.clientY = 0; el.dispatchEvent(e); };
const mouse = (type, el) => el.dispatchEvent(new w.MouseEvent(type, { bubbles: true }));
const db = () => JSON.parse(w.localStorage.getItem('livaro_db_v1'));
try {
  const row = () => d.querySelector('tr[data-drag="0|0"]');
  console.log('1 строка без ручки не перетаскивается:', row().getAttribute('draggable'), '| шаблоны над корзиной:', !!d.querySelector('.grow .tpl-strip'), '| каталог .picker:', !!d.querySelector('.aside .picker'));
  mouse('mousedown', row().querySelector('input.pin'));
  console.log('2 нажали в поле цены → draggable:', row().getAttribute('draggable'));
  mouse('mouseup', d.body);
  mouse('mousedown', row().querySelector('[data-grip]'));
  console.log('3 нажали ручку → draggable:', row().getAttribute('draggable'));
  ev('dragstart', row()); const box2 = d.querySelectorAll('.gbox')[1]; ev('dragover', box2); ev('drop', box2); ev('dragend', d.body);
  console.log('4 перенесли за ручку во 2-й шкаф:', db().cart.groups.map(g => g.t + ':' + g.items.map(i => i.n).join(',')).join(' | '));
  console.log('  после — строки снова не перетаскиваемые:', [...d.querySelectorAll('tr[data-drag]')].every(r => !r.hasAttribute('draggable')));
  // в «Товарах»: поле цены не запускает перетаскивание строки
  w.location.hash = '#/catalog'; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  [...d.querySelectorAll('.tn')].find(x => x.textContent.includes('Шкафы')).click();
  const cr = d.querySelector('tr.crow'); mouse('mousedown', cr.querySelector('input.pin'));
  console.log('5 товары: нажали в цене → draggable:', cr.getAttribute('draggable')); mouse('mouseup', d.body); console.log('  отпустили → draggable:', cr.getAttribute('draggable'));
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
