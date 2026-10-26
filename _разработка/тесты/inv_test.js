const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/inv', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {};
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const db = () => JSON.parse(w.localStorage.getItem('livaro_db_v1'));
try {
  console.log('1 строк в таблице:', d.querySelectorAll('.inv-in').length, '| папок-заголовков:', d.querySelectorAll('tr.inv-f').length);
  // ручной ввод + Enter
  const a = d.querySelectorAll('.inv-in')[0]; a.focus(); a.value = '5';
  a.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  console.log('2 после Enter фокус на строке №', [...d.querySelectorAll('.inv-in')].indexOf(d.activeElement), '| кнопка:', d.querySelector('[data-act="inv-save"]').textContent);
  // загрузка «остатков из 1С»: Наименование + Остаток (как в «Вывести список»)
  const rows = [['Наименование', 'Остаток', 'Ед. изм'], ['Ручки плоские 60 см ЧЕРНЫЕ( семерки )', '2 111,000', 'шт'], ['Ручки плоские 60 см ЗОЛОТО ( семерки )', 1928, 'шт'],
    ['Корпус 4-х Милан белый 220х180х52 ( Коробка № 1 и № 2 )', 7, 'шт'], ['Несуществующий товар', 3, 'шт'], ['Шкаф заказной №', '', 'шт']];
  const res = w.eval('UI.inv = UI.inv || {}; invImport(' + JSON.stringify(rows) + ')'); w.eval('render()');
  console.log('3 импорт:', JSON.stringify(res), '| сообщение показано:', !!d.querySelector('.warn'));
  click(d.querySelector('[data-act="inv-save"]')); w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  console.log('4 склад:', [...d.querySelectorAll('.tcard tbody tr')].map(r => r.children[0].textContent.slice(0, 32) + ' = ' + r.children[1].textContent).join(' | '));
  console.log('  движений:', db().stockMoves.length);
  // повторная инвентаризация: корпусов на самом деле 6 → поправка −1
  w.location.hash = '#/inv'; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  w.eval('UI.inv={}; invImport([["Товар","Факт"],["Корпус 4-х Милан белый 220х180х52 ( Коробка № 1 и № 2 )",6]]); render()');
  click(d.querySelector('[data-act="inv-save"]'));
  console.log('5 пересчёт корпус = 6, последняя поправка:', db().stockMoves.slice(-1)[0].q, '| остаток:', w.eval('stockMap()["Корпус 4-х Милан белый 220х180х52 ( Коробка № 1 и № 2 )"].have'));
  w.location.hash = '#/invprint'; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  console.log('6 бланк: строк товаров', d.querySelectorAll('.p-t tbody tr:not(.g)').length, '| папок', d.querySelectorAll('.p-t tbody tr.g').length);
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
