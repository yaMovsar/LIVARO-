const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const it = n => [n, 1000];
const db0 = { v: 1, templates: [], trash: [], clients: [], orders: [], payments: [], installments: [], instNo: 1,
  cat: [{ n: 'Шкафы', ch: [{ n: 'Двери', ch: [], it: [it('Дверь Айша СЕРАЯ'), it('Дверь Айша БЕЛАЯ'), it('Дверь Айша Ваниль')] }],
    it: [it('Шкаф Премиум №1 СЕРЫЙ'), it('Шкаф Премиум №1 ЛИНО'), it('Шкаф Премиум №1 ВАНИЛЬ'), it('Шкаф Премиум №1 БЕЛЫЙ'),
         it('Шкаф Милан ВАТАН'), it('Шкаф Милан САТИН'), it('Шкаф Милан СЕРЫЙ'), it('Шкаф Милан БЕЛЫЙ'), it('Карниз'), it('Шкаф Милан ЛИНО')] }],
  cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 1, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/catalog', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const db = () => JSON.parse(w.localStorage.getItem('livaro_db_v1'));
try {
  [...d.querySelectorAll('.tn')].find(x => x.textContent.includes('Шкафы')).click();
  click(d.querySelector('[data-act="cat-menu"]'));
  console.log('пункт в меню:', [...d.querySelectorAll('.menu button')].map(b => b.textContent).find(t => t.includes('цвету')));
  click(d.querySelector('[data-act="f-color"]'));
  console.log('шкафы:', db().cat[0].it.map(i => i[0]).join(' | '));
  console.log('двери:', db().cat[0].ch[0].it.map(i => i[0]).join(' | '));
  click(d.querySelector('[data-act="model-new"]'));
  console.log('модель во всех цветах, отмечены:', [...d.querySelectorAll('#modal [data-color]')].filter(x => x.checked).map(x => x.dataset.color).join(', '));
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
