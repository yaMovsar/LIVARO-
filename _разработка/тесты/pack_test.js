const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const g2 = { t: 'Шкаф Милан 2-х, белый', items: [{ n: 'Шкаф Милан 2-х дверный (Труба) БЕЛЫЙ', q: 1, p: 11000 }, { n: 'Дверь Марьям на корпус МИЛАН БЕЛЫЙ', q: 2, p: 0 }, { n: 'Ручки скобы 30 см ЗОЛОТО', q: 2, p: 0 }, { n: 'Карниз на 2 дв. + фурнитура', q: 1, p: 0 }] };
const g4 = { t: 'Шкаф Айша 4х, белый', items: [{ n: 'Корпус 4-х Милан белый 220х180х52 ( Коробка № 1 и № 2 )', q: 1, p: 24000 }, { n: 'дверь АЙША на корпус МИЛАН 220 БЕЛЫЙ С - образ', q: 4, p: 0 }, { n: 'Ручки скобы 30 см ЗОЛОТО', q: 4, p: 0 }, { n: 'Карниз на 4 дв. + фурнитура', q: 1, p: 0 }] };
const db0 = { v: 1, templates: [], trash: [], payments: [], installments: [], instNo: 1, clients: [{ id: 'c1', name: 'Шамиль BUGLAN', opening: 0 }],
  cat: [{ n: 'Шкафы МИЛАН', ch: [{ n: 'Корпус Милан 6х', ch: [], it: [['Корпус Милан 6х БЕЛЫЙ', 30000]] }], it: [['Шкаф Милан 2-х дверный (Труба) БЕЛЫЙ', 11000]] },
        { n: 'Двери', ch: [], it: [['Дверь Марьям на корпус МИЛАН БЕЛЫЙ', 0], ['дверь АЙША на корпус МИЛАН 220 БЕЛЫЙ С - образ', 0]] }],
  orders: [{ id: 'o1', no: 15, date: '2026-10-24', status: 'ordered', clientId: 'c1', groups: [g2, g4], total: 35000, createdAt: 1 }],
  cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 16, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/labels/o1', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const change = (el, v) => { if (typeof v === 'boolean') el.checked = v; else el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const sync = () => w.dispatchEvent(new w.HashChangeEvent('hashchange'));
const labs = () => [...d.querySelectorAll('.lab:not(.lempty)')].map(l => l.querySelector('.lnum b').textContent + ' ' + l.querySelector('.what').textContent.slice(0, 48) + (l.querySelector('.fragile') ? ' [ХРУПКОЕ]' : ''));
try {
  console.log('1', d.querySelector('h1').textContent);
  labs().forEach(x => console.log('   ' + x));
  // по шкафам: 2-х дверный 3 места, 4-х дверный 5
  const P = w.eval('buildPlaces(order("o1")).places'); console.log('  по шкафам:', ['Шкаф Милан 2-х', 'Шкаф Айша 4х'].map(t => t + ' = ' + P.filter(p => p.g.startsWith(t)).length).join(', '));
  // правка на месте: двери Айша в 1 коробку
  change(d.querySelector('[data-ch="lbl-c"][data-k="1|1"]'), '1');
  console.log('2 двери Айша в 1 коробку →', d.querySelector('h1').textContent);
  // правило папки «Двери»: по 4 шт в коробке
  w.location.hash = '#/catalog'; sync();
  click([...d.querySelectorAll('.tn')].find(x => x.textContent.includes('Двери')));
  click(d.querySelector('[data-act="cat-menu"]')); click(d.querySelector('[data-act="pack-folder"]'));
  change(d.getElementById('pk-mode'), 'per'); change(d.getElementById('pk-n'), '4'); change(d.getElementById('pk-fr'), true);
  click(d.querySelector('[data-act="pack-save"]'));
  console.log('3 папка «Двери»:', d.querySelector('.card h2 + .hint, h2 ~ .hint') ? [...d.querySelectorAll('.hint')].map(h => h.textContent).find(t => t.startsWith('Упаковка')) : '');
  // правило товара: корпус Милан 6х — 3 коробки
  click(d.querySelector('.picker [data-act="f-expand"]') || d.querySelector('[data-act="cat-menu"]')); if (d.querySelector('[data-act="f-expand"]')) click(d.querySelector('[data-act="f-expand"]'));
  click([...d.querySelectorAll('.tn')].find(x => x.textContent.includes('Корпус Милан 6х')));
  click(d.querySelector('[data-act="citem-edit"]')); click(d.querySelector('[data-act="pack-item"]'));
  change(d.getElementById('pk-mode'), 'box'); change(d.getElementById('pk-n'), '3'); click(d.querySelector('[data-act="pack-save"]'));
  console.log('4 корпус 6х:', w.eval('packText(packRule("Корпус Милан 6х БЕЛЫЙ"))'), '| дверь Айша теперь:', w.eval('packText(packRule("дверь АЙША на корпус МИЛАН 220 БЕЛЫЙ С - образ"))'));
  w.location.hash = '#/labels/o1'; sync(); console.log('5 этикетки после настроек:', d.querySelector('h1').textContent);
  w.location.hash = '#/print/l/o1'; sync(); console.log('6 лист погрузки:', d.querySelector('.paper > div[style*="border:2px"]').textContent);
  w.location.hash = '#/sale/o1'; sync(); console.log('7 кнопка на заказе:', !!d.querySelector('a[href="#/labels/o1"]'));
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
