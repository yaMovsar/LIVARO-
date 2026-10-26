const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const m = 'Корпус Милан 133 ( 3х дверный ) (в220 - ш135 - г52 ) ';
const db0 = { v: 1, templates: [], trash: [], clients: [], orders: [], payments: [], installments: [], instNo: 1,
  cat: [{ n: 'Шкафы МИЛАН', open: true, ch: [{ n: 'Корпус Милан 3х', ch: [], it: [[m + 'СЕРЫЙ', 14000], [m + 'ЛИНО', 14000], [m + 'ВАНИЛЬ', 14000], [m + 'БЕЛЫЙ', 14001]] }], it: [] }],
  cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 1, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/order', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const db = () => JSON.parse(w.localStorage.getItem('livaro_db_v1'));
try {
  click([...d.querySelectorAll('.tn')].find(x => x.textContent.includes('Корпус Милан 3х')));
  console.log('1 каталог корзины:', [...d.querySelectorAll('#cat-list .it')].map(x => x.textContent.replace(m, '').replace(/\s*14 00\d ₽/, '')).join(', '));
  click(d.querySelector('#cat-list .it'));
  console.log('2 нажали первый → в корзину:', db().cart.groups[0].items[0].n.replace(m, ''), db().cart.groups[0].items[0].p);
  click([...d.querySelectorAll('.tn')].find(x => x.textContent.includes('Шкафы МИЛАН')));
  console.log('3 главная папка:', [...d.querySelectorAll('#cat-list .it')].map(x => x.textContent.replace(m, '').split(/\s/)[0]).join(', '));
  w.location.hash = '#/catalog'; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  click([...d.querySelectorAll('.tn')].find(x => x.textContent.includes('Корпус Милан 3х')));
  console.log('4 «Товары»:', [...d.querySelectorAll('[data-dbl="cname"]')].map(x => x.textContent.replace(m, '')).join(', '));
  console.log('  хранится как было:', db().cat[0].ch[0].it.map(i => i[0].replace(m, '')).join(', '));
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
