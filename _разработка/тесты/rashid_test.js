const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const ord = (id, no, cid, total, date) => ({ id, no, date, shipDate: date, shippedAt: no * 10, status: 'shipped', clientId: cid, groups: [{ t: 'Шкаф', items: [{ n: 'Шкаф', q: 1, p: total }] }], total, createdAt: no });
// Рашид без начального долга: 2 накладные по 50 000; Абдурахим: аванс 100 000 на начало, накладная 60 000
const db0 = { v: 1, cat: [], templates: [], trash: [], clients: [{ id: 'ra', name: 'Рашид ДАЧА', phone: '', opening: 0 }, { id: 'ab', name: 'Абдурахим', opening: 100000 }, { id: 'mu', name: 'Муслим', opening: -20000 }],
  orders: [ord('a', 1, 'ra', 50000, '2026-10-20'), ord('b', 2, 'ra', 50000, '2026-10-21'), ord('c', 3, 'ab', 60000, '2026-10-21'), ord('d', 4, 'mu', 30000, '2026-10-21')],
  payments: [], cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 5, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/client/ra', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const sync = () => w.dispatchEvent(new w.HashChangeEvent('hashchange'));
const pay = (amount, method) => { click(d.querySelector('[data-act="pay-new"]')); d.getElementById('p-amount').value = amount; d.getElementById('p-method').value = method; click(d.querySelector('[data-act="pay-save"]')); };
const sales = () => { w.location.hash = '#/sales'; sync(); (click(d.querySelector('[data-act="range-open"]')), click(d.querySelector('[data-act="rp-clear"]')), click(d.querySelector('[data-act="rp-apply"]'))); return [...d.querySelectorAll('tbody tr')].map(r => '№' + r.children[1].textContent + ' ' + r.children[3].textContent + ': ' + r.children[5].textContent + ' | остаток ' + r.children[7].textContent).join('\n   '); };
try {
  pay('80000', 'transfer');
  console.log('1 Рашид прислал чек 80 000 (перевод):\n   ' + sales());
  w.location.hash = '#/client/ra'; sync(); pay('20000', 'cash');
  console.log('2 ещё 20 000 наличными:\n   ' + sales());
  w.location.hash = '#/client/mu'; sync(); pay('40000', 'transfer');
  console.log('3 Муслим (долг на начало 20 000) перевёл 40 000 → сначала закрыт старый долг:\n   ' + sales().split('\n').filter(x => x.includes('Муслим')).join(''));
  console.log('  баланс Муслима:', (w.location.hash = '#/client/mu', sync(), d.querySelector('.tile .v').textContent));
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);

