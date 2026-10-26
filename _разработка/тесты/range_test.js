const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const ord = (id, no, date, status) => ({ id, no, date, shipDate: status === 'ordered' ? null : date, shippedAt: no, status: status || 'shipped', clientId: 'c1', groups: [{ t: 'Ш', items: [{ n: 'Ш', q: 1, p: 1000 }] }], total: 1000, createdAt: no });
const db0 = { v: 1, templates: [], trash: [], clients: [{ id: 'c1', name: 'Рашид', opening: 0 }], payments: [], cat: [],
  orders: [ord('a', 1, '2026-01-15'), ord('b', 2, '2026-09-28'), ord('c', 3, '2026-10-05'), ord('d', 4, '2026-10-23'), ord('e', 5, '2026-08-01', 'ordered')],
  cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 6, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/sales', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const nos = () => [...d.querySelectorAll('tbody tr')].map(r => r.children[1].textContent).join(',');
try {
  console.log('сегодня:', w.eval('todayISO()'));
  console.log('1 по умолчанию:', d.querySelector('[data-act="range-open"]').textContent, '| строки №', nos());
  // все варианты: печатаем даты
  const all = w.eval('Object.keys(RANGES).map(t => t + ": " + RANGES[t].map(([n]) => { const r = rangeOf(n); return n + " " + (r.from||"…") + "→" + (r.to||"…"); }).join("; ")).join("\\n")');
  console.log(all);
  click(d.querySelector('[data-act="range-open"]'));
  console.log('2 окно:', d.querySelector('#modal h2').textContent, '| вкладки:', [...d.querySelectorAll('#modal .seg button')].map(b => b.textContent).join('/'));
  click(d.querySelector('[data-act="rp-tab"][data-v="Год"]')); click(d.querySelector('[data-act="rp-pick"][data-v="С начала этого года"]'));
  console.log('  поля дат:', d.getElementById('r-from').value, '–', d.getElementById('r-to').value);
  click(d.querySelector('[data-act="rp-apply"]'));
  console.log('3 с начала года:', d.querySelector('[data-act="range-open"]').textContent, '| №', nos());
  // произвольный период вручную
  click(d.querySelector('[data-act="range-open"]'));
  d.getElementById('r-from').value = '2026-10-01'; d.getElementById('r-to').value = '2026-10-10';
  click(d.querySelector('[data-act="rp-apply"]'));
  console.log('4 вручную 01–10.10:', d.querySelector('[data-act="range-open"]').textContent, '| №', nos(), '(заказ №5 ждёт отгрузки — виден всегда)');
  click(d.querySelector('[data-act="range-open"]')); click(d.querySelector('[data-act="rp-clear"]')); click(d.querySelector('[data-act="rp-apply"]'));
  console.log('5 очистить период:', d.querySelector('[data-act="range-open"]').textContent, '| №', nos());
  // двойной щелчок по варианту — выбрать сразу
  click(d.querySelector('[data-act="range-open"]')); click(d.querySelector('[data-act="rp-tab"][data-v="Месяц"]'));
  d.querySelector('[data-act="rp-pick"][data-v="Прошлый месяц"]').dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true }));
  console.log('6 двойной щелчок «Прошлый месяц»:', d.querySelector('[data-act="range-open"]').textContent, '| окно закрыто:', !d.querySelector('#modal .dlg'), '| №', nos());
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
