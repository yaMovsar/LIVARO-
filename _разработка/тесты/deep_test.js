const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const db0 = { v: 1, templates: [], trash: [], clients: [], orders: [], payments: [],
  cat: [{ n: '1. Шкафы', ch: [{ n: 'Милан', ch: [{ n: '4-х', ch: [], it: [['Корпус 4-х Милан БЕЛЫЙ', 24000]] }], it: [['Корпус 2-х Милан', 11000]] }, { n: 'Техно', ch: [], it: [['Шкаф Техно 3', 19000]] }], it: [] },
        { n: 'Прочее', ch: [], it: [['Ручка', null]] }],
  cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 1, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/catalog', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const sync = () => w.dispatchEvent(new w.HashChangeEvent('hashchange'));
const db = () => JSON.parse(w.localStorage.getItem('livaro_db_v1'));
const tn = t => [...d.querySelectorAll('.tn')].find(x => x.textContent.includes(t));
try {
  click(tn('1. Шкафы'));
  console.log('1 главная папка:', d.querySelector('.card h2').textContent, '|', [...d.querySelectorAll('tr.crow td.nm-cell')].map(x => x.textContent).join(' || '));
  // редактирование: имя, цена, перенос в «Прочее»
  click([...d.querySelectorAll('[data-act="citem-edit"]')].find(b => b.closest('tr').textContent.includes('Техно 3')));
  d.getElementById('e-name').value = 'Шкаф 3 дверный ТЕХНО СЕРЫЙ'; d.getElementById('e-price').value = '19 500';
  const f = d.getElementById('e-folder'); f.value = [...f.options].find(o => o.textContent.includes('Прочее')).value;
  click(d.querySelector('[data-act="citem-save"]'));
  console.log('2 после правки: Прочее =', JSON.stringify(db().cat[1].it), '| Техно =', JSON.stringify(db().cat[0].ch[1].it));
  // каталог при оформлении заказа
  w.location.hash = '#/order'; sync();
  click([...d.querySelectorAll('.tn[data-view="o"]')].find(x => x.textContent.includes('1. Шкафы')));
  console.log('3 заказ, главная папка:', [...d.querySelectorAll('#cat-list .it')].map(x => x.textContent).join(' || '));
  click(d.querySelector('#cat-list .it:last-child'));
  console.log('  добавлен в корзину:', db().cart.groups[0].items.map(i => i.n + ' ' + i.p).join(', '));
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
