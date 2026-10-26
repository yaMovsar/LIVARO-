const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const cv = (t, p) => ['БЕЛЫЙ', 'СЕРЫЙ', 'ВАНИЛЬ', 'ЛИНО'].map(c => [t + ' ' + c, p]);
const db0 = { v: 1, trash: [], clients: [{ id: 'c1', name: 'Рашид', opening: 0 }], orders: [], payments: [], installments: [], instNo: 1,
  cat: [{ n: 'Двери МИЛАН', ch: [{ n: 'Марьям', ch: [], it: cv('Дверь Марьям на корпус МИЛАН', 0) }, { n: 'Рамка на корпус МИЛАН', ch: [], it: cv('Рамка с зеркалом на корпус МИЛАН', 0) }], it: [] },
        { n: 'Корпуса', ch: [], it: cv('Корпус Милан 133 ( 3х дверный )', 14000) }],
  templates: [{ id: 't1', t: 'Марьям 3х', items: [{ n: 'Корпус Милан 133 ( 3х дверный ) БЕЛЫЙ', q: 1, p: 14000 }, { n: 'Дверь Марьям на корпус МИЛАН БЕЛЫЙ', q: 2, p: 0 }, { n: 'Рамка с зеркалом на корпус МИЛАН БЕЛЫЙ', q: 1, p: 0 }] }],
  cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 1, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/order', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const db = () => JSON.parse(w.localStorage.getItem('livaro_db_v1'));
try {
  click(d.querySelector('[data-act="tpl-open"]')); click(d.querySelector('[data-act="tpl-apply"][data-color="белый"]'));
  console.log('1 шаблон Марьям 3х:', db().cart.groups[0].items.map(i => i.n.replace(' на корпус МИЛАН', '') + ' ×' + i.q).join(' | '));
  // ⇄ на строке зеркала (3-я строка)
  click(d.querySelector('[data-act="rep-open"][data-g="0"][data-i="2"]'));
  console.log('2 варианты замены (первые 5):', [...d.querySelectorAll('[data-act="rep-pick"]')].slice(0, 5).map(b => b.textContent.split(/Марьям$|Рамка на/)[0].replace(' на корпус МИЛАН', '').trim()).join(' | '));
  click(d.querySelector('[data-act="rep-pick"]'));
  console.log('3 после замены:', db().cart.groups[0].items.map(i => i.n.replace(' на корпус МИЛАН', '') + ' ×' + i.q).join(' | '));
  // оформить и посмотреть коробки
  click(d.querySelector('[data-act="to-checkout"]')); w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  click(d.querySelector('.chip[data-act="ck-pick"]') || d.querySelector('[data-act="client-new"]'));
  if (!d.querySelector('[data-act="post"]') || d.querySelector('[data-act="post"]').disabled) { w.eval('UI.ck.clientId="c1";render()'); }
  click(d.querySelector('[data-act="post"]')); w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  const id = db().orders[0].id; w.location.hash = '#/labels/' + id; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  console.log('4', d.querySelector('h1').textContent, '\n   ' + [...d.querySelectorAll('.lab:not(.lempty)')].map(l => l.querySelector('.lnum b').textContent + ' ' + l.querySelector('.what').textContent.replace(' на корпус МИЛАН', '').slice(0, 40) + (l.querySelector('.fragile') ? ' [Х]' : '')).join('\n   '));
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
