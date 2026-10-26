const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const db0 = { v: 1, templates: [], trash: [], clients: [], orders: [], payments: [],
  cat: [{ n: 'В', ch: [{ n: 'в2', ch: [], it: [] }, { n: 'в1', ch: [], it: [] }], it: [['Шкаф 10', 1], ['Шкаф 2', 2], ['Шкаф 1', 3]], open: true },
        { n: 'А', ch: [], it: [] }, { n: 'Б', ch: [], it: [['Ручка', 0]] }],
  cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 1, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/catalog', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const db = () => JSON.parse(w.localStorage.getItem('livaro_db_v1'));
const tn = t => [...d.querySelectorAll('.tn')].find(x => x.querySelector('span:nth-of-type(2)').textContent === t);
const names = () => db().cat.map(f => f.n + (f.ch.length ? '(' + f.ch.map(c => c.n).join(',') + ')' : '') + '[' + f.it.map(i => i[0]).join(',') + ']').join(' ');
// jsdom не считает размеры — подставляем высоту 40px, чтобы проверить зоны «выше/внутрь/ниже»
w.Element.prototype.getBoundingClientRect = function () { return { top: 0, bottom: 40, height: 40, left: 0, right: 100, width: 100 }; };
const ev = (type, el, y) => { const e = new w.Event(type, { bubbles: true, cancelable: true }); e.dataTransfer = { setData() {}, setDragImage() {} }; e.clientY = y; el.dispatchEvent(e); };
try {
  console.log('0', names());
  // меню: свернуть все
  click(d.querySelector('[data-act="cat-menu"]')); console.log('1 меню открыто:', !!d.querySelector('.menu'), '| пункты:', [...d.querySelectorAll('.menu button')].map(b => b.textContent).join(' / '));
  click(d.querySelector('[data-act="f-collapse"]')); console.log('  свёрнуто, видно папок:', d.querySelectorAll('.tn').length, '| меню закрыто:', !d.querySelector('.menu'));
  // ↑ ↓: выбрать «Б», поднять дважды
  click(tn('Б')); click(d.querySelector('[data-act="f-up"]')); click(d.querySelector('[data-act="f-up"]'));
  console.log('2 «Б» вверх ×2:', names());
  // перетащить папку «А» ВЫШЕ «Б» (зона before: y=2)
  ev('dragstart', tn('А')); ev('dragover', tn('Б'), 2); console.log('3 линия выше:', tn('Б').classList.contains('dt')); ev('drop', tn('Б'), 2);
  console.log('  ', names());
  // перетащить «А» ВНУТРЬ «В» (середина y=20)
  ev('dragstart', tn('А')); ev('dragover', tn('В'), 20); ev('drop', tn('В'), 20);
  console.log('4 «А» внутрь «В»:', names());
  // порядок товаров: в папке «В» отключим подпапки и перетащим «Шкаф 1» выше «Шкаф 10»
  click(tn('В'));
  click(d.querySelector('[data-act="cat-menu"]')); click(d.querySelector('[data-act="f-deep"]'));
  const row = t => [...d.querySelectorAll('tr.crow')].find(r => r.querySelector('[data-dbl]').textContent === t);
  ev('dragstart', row('Шкаф 1')); ev('dragover', row('Шкаф 10'), 2); ev('drop', row('Шкаф 10'), 2);
  console.log('5 товар выше:', db().cat.find(f => f.n === 'В').it.map(i => i[0]).join(', '), '| вложенные выключены:', db().settings.deepList);
  // сортировка по наименованию внутри «В»
  click(d.querySelector('[data-act="cat-menu"]')); click(d.querySelector('[data-act="f-sort"]'));
  const V = db().cat.find(f => f.n === 'В');
  console.log('6 сортировка «В»: папки', V.ch.map(c => c.n).join(','), '| товары', V.it.map(i => i[0]).join(', '));
  // клик мимо меню закрывает его
  click(d.querySelector('[data-act="cat-menu"]')); click(d.querySelector('h1')); console.log('7 клик мимо закрыл меню:', !d.querySelector('.menu'));
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
