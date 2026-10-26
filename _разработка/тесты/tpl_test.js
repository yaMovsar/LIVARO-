const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/order', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.prompt = (q, d) => 'Айша 6 с антресолью';
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const input = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const add = s => { input(d.getElementById('cat-q'), s); click(d.querySelector('#cat-list .it')); };
try {
  ['Корпус Милан 6х БЕЛЫЙ по бокам трубы', 'АЙША на корпус МИЛАН 220 БЕЛЫЙ С', 'Рамка с зеркалом на корпус МИЛАН Белый', 'Ручки плоские 60 см СЕРЕБРО', 'Антресоль 6-х на корпус МИЛАН БЕЛЫЙ', 'Двери Антресоль - Белый', 'Карниз на 6 дв'].forEach(add);
  const g = JSON.parse(w.localStorage.getItem('livaro_db_v1')).cart.groups[0];
  console.log('cart items:', g.items.map(x => x.n).join(' | '));
  click(d.querySelector('[data-act="tpl-save"]'));
  console.log('templates:', d.querySelectorAll('[data-act="tpl-open"]').length, d.querySelector('[data-act="tpl-open"]').textContent);
  click(d.querySelector('[data-act="tpl-open"]'));
  click(d.querySelector('[data-act="tpl-apply"][data-color="серый"]'));
  click(d.querySelector('[data-act="tpl-open"]'));
  click(d.querySelector('[data-act="tpl-apply"][data-color="вотан"]'));
  const db = JSON.parse(w.localStorage.getItem('livaro_db_v1'));
  const allNames = new Set(); (function walk(l) { l.forEach(n => { n.it.forEach(i => allNames.add(i[0])); walk(n.ch); }); })(db.cat);
  db.cart.groups.slice(1).forEach(G => {
    console.log('\nGROUP:', G.t);
    G.items.forEach(x => console.log('  ' + (allNames.has(x.n) ? '[в каталоге] ' : '[по названию] ') + x.n + ' ×' + x.q + ' ' + x.p));
  });
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
