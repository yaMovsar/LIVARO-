const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const g1 = { t: 'Шкаф 1', items: [{ n: 'Корпус Милан 6х БЕЛЫЙ по бокам трубы 220х270х52 ( Коробка № 1 и № 2 )', q: 1, p: 30000 }, { n: 'дверь АЙША на корпус МИЛАН 220 БЕЛЫЙ С - образ', q: 4, p: 0 }] };
const g2 = { t: 'Шкаф 2', items: [{ n: 'Корпус 4-х Милан белый 220х180х52 ( Коробка № 1 и № 2 )', q: 1, p: 24000 }, { n: 'Антресоль 4-х на корпус МИЛАН БЕЛЫЙ', q: 1, p: 8000 },
  { n: 'Дверь Марьям на корпус МИЛАН СЕРЫЙ', q: 4, p: 0 }, { n: 'Ручки скобы 30 см ЗОЛОТО', q: 2, p: 0 }, { n: 'Карниз на 6 дв. + фурнитура', q: 1, p: 0 }] };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/order', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {};
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const tips = gi => [...d.querySelectorAll('.gbox')[gi].querySelectorAll('.asst-row')].map(r => r.querySelector('.asst-text').textContent + '  →  [' + [...r.querySelectorAll('button.btn')].map(b => b.textContent).join('] [') + ']');
try {
  w.eval('DB.cart = ' + JSON.stringify({ groups: [g1, g2], cur: 0 }) + '; commit();');
  console.log('числа дверей:', ['Корпус Милан 6х БЕЛЫЙ по бокам трубы 220х270х52', 'Корпус 4-х Милан белый 220х180х52', 'Корпус Милан 133 ( 3х дверный ) (в220 - ш135 - г52 ) СЕРЫЙ', 'шкаф 6-ти премиум ЛИНО С БАГЕТОМ 250 х 300 х 50', 'Шкаф 3 дверный ТЕХНО БЕЛЫЙ', 'Шкаф ПРЕМИУМ № 3 ( 250 х 100 х 50 ) СЕРЫЙ'].map(n => w.eval('doorsFromName(' + JSON.stringify(n) + ')')).join(', '));
  console.log('\nШКАФ 1:'); tips(0).forEach(t => console.log('  ' + t));
  console.log('\nШКАФ 2:'); tips(1).forEach(t => console.log('  ' + t));
  // нажимаем все «добавить/исправить» в шкафу 1 по очереди
  for (let k = 0; k < 6; k++) { const b = d.querySelectorAll('.gbox')[0].querySelector('.asst button.btn'); if (!b) break; click(b); }
  console.log('\nШКАФ 1 после подсказок:', JSON.parse(w.localStorage.getItem('livaro_db_v1')).cart.groups[0].t, '|', JSON.parse(w.localStorage.getItem('livaro_db_v1')).cart.groups[0].items.map(i => i.n.slice(0, 30) + ' ×' + i.q).join(' | '));
  console.log('  подсказок осталось:', tips(0).length);
  click(d.querySelector('[data-act="as-toggle"]')); console.log('выключили помощника, подсказок:', d.querySelectorAll('.asst-row').length);
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
