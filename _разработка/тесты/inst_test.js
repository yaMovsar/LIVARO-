const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const db0 = { v: 1, templates: [], trash: [], clients: [], orders: [], payments: [], cat: [{ n: 'Шкафы', ch: [], it: [['Шкаф Айша 6 БЕЛЫЙ', 60000], ['Тумба', 5500]] }],
  cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 1, lastBackup: Date.now(), notice: '' }; // старая база — без installments
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/order', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const change = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const input = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const sync = () => w.dispatchEvent(new w.HashChangeEvent('hashchange'));
const db = () => JSON.parse(w.localStorage.getItem('livaro_db_v1'));
const f = name => d.querySelector('[data-f="' + name + '"]');
const calc = () => [...d.querySelectorAll('.aside .card:last-child .line')].map(l => l.textContent).join(' | ');
try {
  input(d.getElementById('cat-q'), 'Айша'); click(d.querySelector('#cat-list .it'));
  input(d.getElementById('cat-q'), 'Тумба'); click(d.querySelector('#cat-list .it')); click(d.querySelector('#cat-list .it'));
  click(d.querySelector('[data-act="cart-menu"]')); click(d.querySelector('[data-act="to-inst"]')); sync();
  console.log('1', d.querySelector('h1').textContent);
  change(f('name'), 'Алиева Патимат Магомедовна'); change(f('phone'), '8 928 555 44 33'); change(f('address'), 'г. Махачкала, ул. Ленина 5');
  change(f('pct'), '10'); change(f('down'), '20 000'); change(f('date'), '2026-10-24');
  click(d.querySelector('[data-act="i-months"][data-v="3"]'));
  console.log('2 расчёт:', calc());
  console.log('  график:', [...d.querySelectorAll('[data-ch="i-sdate"]')].map((x, i) => x.value + ' ' + d.querySelectorAll('[data-ch="i-samt"]')[i].value).join('; '));
  click(d.querySelector('[data-act="i-base"][data-v="rest"]'));
  console.log('3 процент на остаток:', calc());
  click(d.querySelector('[data-act="i-base"][data-v="all"]'));
  // подвинуть дату второго платежа и сумму
  change(d.querySelector('[data-ch="i-sdate"][data-i="1"]'), '2026-12-28');
  change(d.querySelector('[data-ch="i-samt"][data-i="0"]'), '20000');
  console.log('4 правка графика: предупреждение о сумме =', !!d.querySelector('.card .warn'));
  click(d.querySelector('[data-act="i-resched"]'));
  click(d.querySelector('[data-act="inst-save"]')); sync();
  const s = db().installments[0];
  console.log('5 оформлено:', s.no, s.buyer.name, '| итог', s.total, '| взнос', s.down, '| график', s.schedule.map(r => r.date + ' ' + r.amount).join('; '), '| корзина пуста:', !db().cart.groups[0].items.length);
  console.log('  карточка:', [...d.querySelectorAll('.kpi')].map(k => k.querySelector('.l').textContent + ' ' + k.querySelector('.v').textContent).join(' | '));
  // платёж
  click(d.querySelector('[data-act="ipay-new"]')); console.log('6 предложено:', d.getElementById('ip-amount').value);
  change(d.getElementById('ip-amount'), '30000'); click(d.querySelector('[data-act="ipay-save"]'));
  console.log('  статусы графика:', [...d.querySelectorAll('.tcard tbody tr')].map(r => r.children[4].textContent + '(' + r.children[3].textContent + ')').join(', '));
  // просрочка: сдвинуть первый платёж в прошлое
  w.eval('DB.installments[0].schedule[0].date = "2026-09-01"; DB.installments[0].pays = DB.installments[0].pays.filter(p => p.kind === "down"); commit();');
  w.location.hash = '#/inst'; sync();
  console.log('7 список:', [...d.querySelectorAll('tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ')).join(' || '), '| меню:', d.querySelector('a[href="#/inst"]').textContent);
  w.location.hash = '#/home'; sync(); console.log('8 главная:', (d.querySelector('.card h2') && [...d.querySelectorAll('.card h2')].map(h => h.textContent).filter(t => t.includes('Рассрочка')).join()) || 'нет');
  w.location.hash = '#/iprint/' + s.id; sync();
  console.log('9 накладная:', d.querySelector('.p-head').textContent, '| график строк:', d.querySelectorAll('.p-t')[1].querySelectorAll('tbody tr').length, '| прописью:', d.querySelector('.paper > div[style*="font-size:12px"]').textContent.slice(0, 40));
  w.location.hash = '#/ins/' + s.id; sync(); click(d.querySelector('[data-act="inst-del"]')); sync();
  console.log('10 удалена:', db().installments.length, '| в удалённых:', db().trash.map(t => t.kind).join());
  click(d.querySelector('[data-act="toast-undo"]')); console.log('  отмена:', db().installments.length);
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);

