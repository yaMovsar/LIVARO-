// Бланк обхода «цвета колонками»: модель = строка, цвета = колонки, нет цвета — штриховка
const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/invprint', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {};
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
try {
  const heads = [...d.querySelectorAll('.p-t thead th')].map(x => x.textContent);
  console.log('1 колонки:', heads.join(' | '));
  const rows = d.querySelectorAll('.p-t tr.mrow').length, cells = d.querySelectorAll('.p-t td.mc').length;
  console.log('2 строк-моделей:', rows, '| клеток для цифр:', cells, '(товаров 321)', cells === 321 ? 'OK' : 'FAIL');
  // корпус Милан 6х: одна строка, 5 цветов
  const r = [...d.querySelectorAll('.p-t tr.mrow')].find(x => /Корпус Милан 6х по бокам полки/.test(x.textContent));
  console.log('3 «' + r.children[1].textContent + '» №', r.children[0].textContent, '| клеток:', r.querySelectorAll('td.mc').length, '| штриховок:', r.querySelectorAll('td.na').length);
  // цифры программы в углу клетки
  const lino = w.eval('(() => { for (const id in NODES) { const it = NODES[id].it.find(x => /по бокам полки/.test(x[0]) && /лино/i.test(x[0])); if (it) return it[0]; } })()');
  w.eval('DB.stockMoves.push({ id: "t1", date: "2026-10-26", name: ' + JSON.stringify(lino) + ', q: 7, kind: "in", note: "", createdAt: 1 }); render()');
  const r2 = [...d.querySelectorAll('.p-t tr.mrow')].find(x => /Корпус Милан 6х по бокам полки/.test(x.textContent));
  console.log('4 по программе в клетке ЛИНО:', [...r2.children].map(td => td.querySelector('.pp') ? td.querySelector('.pp').textContent : '').filter(Boolean).join(','), '| колонка:', heads[[...r2.children].findIndex(td => td.querySelector('.pp'))]);
  // вид списком
  w.eval('DB.settings = Object.assign({}, DB.settings, { invMatrix: false }); render()');
  console.log('5 списком: строк товаров', d.querySelectorAll('.p-t td.no').length, '| штриховок', d.querySelectorAll('td.na').length);
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
