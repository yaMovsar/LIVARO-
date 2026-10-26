// Бланк обхода: галочки по папкам (DB.settings.invFolders)
const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/invprint', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {};
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const change = (el, v) => { if (!el) throw new Error('no element'); el.checked = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const rows = () => d.querySelectorAll('.p-t tbody tr:not(.g) td.no').length;
const box = p => [...d.querySelectorAll('.fold-c input')].find(x => x.dataset.p === p); // jsdom не ищет «+» в [data-p="…"]
const sel = () => JSON.parse(w.localStorage.getItem('livaro_db_v1')).settings.invFolders;
try {
  w.eval("DB.settings = Object.assign({}, DB.settings, { invMatrix: false }); render()"); // считаем строки-товары (вид списком)
  const all = rows(), tops = w.eval('DB.cat.map(n => folderPath(n))');
  console.log('1 все папки: строк', all, '| галочек', d.querySelectorAll('.fold-c input:checked').length, 'из', d.querySelectorAll('.fold-c input').length);
  click(d.querySelector('[data-act="inv-fold-none"]'));
  console.log('2 снять все: строк', rows(), '| подсказка:', d.querySelector('.p-t tbody td').textContent);
  change(box(tops[0]), true);
  const n0 = w.eval('allFolders([DB.cat[0]]).reduce((k, x) => k + x.n.it.length, 0)');
  console.log('3 папка «' + tops[0] + '»: строк', rows(), '(ожидалось', n0 + ') | подпапки отмечены и заблокированы:', [...d.querySelectorAll('.fold-c input:disabled')].every(x => x.checked), '| сохранено:', JSON.stringify(sel()));
  // подпапка другой верхней папки
  const sub = w.eval('(() => { const t = DB.cat.find((n, i) => i > 0 && n.ch.length); return folderPath(t.ch[0]); })()');
  const nSub = w.eval('(() => { const t = DB.cat.find((n, i) => i > 0 && n.ch.length); return allFolders([t.ch[0]]).reduce((k, x) => k + x.n.it.length, 0); })()');
  change(box(sub), true);
  console.log('4 + подпапка «' + sub + '»: строк', rows(), '(ожидалось', (n0 + nSub) + ') | в шапке:', d.querySelector('.inv-paper .p-head').textContent.includes(sub));
  change(box(tops[0]), false);
  console.log('5 снята первая папка: строк', rows(), '(ожидалось', nSub + ')');
  // перезагрузка страницы — выбор сохранился
  w.eval('load(); render()');
  console.log('6 после перезагрузки: строк', rows(), '| выбор:', JSON.stringify(sel()));
  click(d.querySelector('[data-act="inv-fold-all"]'));
  console.log('7 выбрать все: строк', rows(), rows() === all ? 'OK' : 'FAIL', '| invFolders =', sel());
  // отметить все верхние по одной = «все папки»
  click(d.querySelector('[data-act="inv-fold-none"]'));
  tops.forEach(t => change(box(t), true));
  console.log('8 все верхние по одной → invFolders =', sel(), rows() === all ? 'OK' : 'FAIL');
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
