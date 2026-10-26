const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const g3 = { t: 'Шкаф Марьям 3х, белый', items: [{ n: 'Корпус Милан 133 ( 3х дверный ) (в220 - ш135 - г52 ) БЕЛЫЙ', q: 1, p: 14000 }, { n: 'Дверь Марьям на корпус МИЛАН БЕЛЫЙ', q: 3, p: 0 }, { n: 'Ручки скобы 30 см ЗОЛОТО', q: 3, p: 0 }, { n: 'Карниз на 3 дв. + фурнитура', q: 1, p: 0 }] };
const g6 = { t: 'Шкаф Турция 6х', items: [{ n: 'Корпус Милан 6х БЕЛЫЙ по бокам трубы 220х270х52 ( Коробка № 1 и № 2 )', q: 1, p: 30000 }, { n: 'Рамка с зеркалом на корпус МИЛАН Белый', q: 2, p: 0 }, { n: 'Дверь Турция 220 на корпус МИЛАН - БЕЛЫЙ', q: 4, p: 0 }, { n: 'Карниз на 6 дв. + фурнитура', q: 1, p: 0 }] };
const db0 = { v: 1, cat: [], templates: [], trash: [], payments: [], installments: [], instNo: 1, clients: [{ id: 'c1', name: 'Рашид', opening: 0 }],
  orders: [{ id: 'o1', no: 3, date: '2026-10-24', status: 'ordered', clientId: 'c1', groups: [g3, g6], total: 44000, createdAt: 1 }],
  cart: { groups: [], cur: 0 }, nextNo: 4, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/labels/o1', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
try {
  const boxes = (name, mode) => w.eval('DB.settings=Object.assign({},DB.settings,{oddDoor:"' + mode + '"});' + '[1,2,3,4,5,6].map(q=>{const r=packRule(' + JSON.stringify(name) + ');return q+"→"+perBoxes(q,r.n)}).join("  ")');
  console.log('двери, лишняя в последнюю: ', boxes('Дверь Марьям на корпус МИЛАН БЕЛЫЙ', 'join'));
  console.log('двери, лишняя отдельно:    ', boxes('Дверь Марьям на корпус МИЛАН БЕЛЫЙ', 'split'));
  console.log('зеркала:                   ', boxes('Рамка с зеркалом на корпус МИЛАН Белый', 'join'), '|', w.eval('packText(packRule("Рамка с зеркалом на корпус МИЛАН Белый"))'));
  w.eval('DB.settings.oddDoor="join";render()');
  const show = () => [...d.querySelectorAll('.lab:not(.lempty)')].map(l => l.querySelector('.lnum b').textContent + ' ' + l.querySelector('.what').textContent.slice(0, 44) + (l.querySelector('.fragile') ? ' [Х]' : '')).join('\n   ');
  console.log('\n1 лишняя в последнюю коробку —', d.querySelector('h1').textContent, '\n   ' + show());
  click(d.querySelector('[data-act="lbl-odd"][data-v="split"]'));
  console.log('\n2 лишняя отдельно —', d.querySelector('h1').textContent, '\n   ' + show());
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
