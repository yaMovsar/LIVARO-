// Бланк пересчёта по образцу: модель = строка, колонки Белый…Вотан, Итого, Примечание; нет цвета — пустая клетка
const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/invprint', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {};
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const rows = () => [...d.querySelectorAll('.p-t tr.mrow')];
try {
  console.log('1 заголовок:', d.querySelector('.inv-title').textContent, '| поля:', [...d.querySelectorAll('.inv-fields div')].map(x => x.textContent.trim()).join(' '));
  const heads = [...d.querySelectorAll('.p-t thead th')].map(x => x.textContent);
  console.log('2 колонки:', heads.join(' | '), heads.join('|') === '№|Наименование|Белый|Серый|Ваниль|Лино|Вотан|Итого|Примечание' ? 'OK' : 'FAIL');
  const nos = rows().map(r => +r.children[0].textContent);
  console.log('3 номера по порядку:', nos.slice(0, 5).join(','), '…', nos.length, nos.every((n, i) => n === i + 1) ? 'OK' : 'FAIL');
  console.log('4 штриховок нет:', d.querySelectorAll('td.na').length === 0 ? 'OK' : 'FAIL', '| цифр программы нет:', d.querySelectorAll('.pp').length === 0 ? 'OK' : 'FAIL');
  console.log('5 группы:', [...d.querySelectorAll('.p-t tr.g')].slice(0, 6).map(x => x.textContent).join(' | '));
  console.log('6 названия:'); rows().slice(0, 14).forEach(r => console.log('   ', r.children[0].textContent, r.children[1].textContent));
  const long = rows().filter(r => /\d+\s*[хx]\s*\d+|коробк/i.test(r.children[1].textContent));
  console.log('7 остались размеры/коробки:', long.length ? long.map(r => r.children[1].textContent).join(' ; ') : 'нет — OK');
  // каждая папка с нового листа
  w.eval('DB.settings = Object.assign({}, DB.settings, { invBreak: true }); render()');
  console.log('8 с нового листа:', d.querySelectorAll('tbody.newpage').length, 'разрывов');
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
