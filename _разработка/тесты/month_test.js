// Отчёт по месяцам (01.11.2026): суммы по клиентам, сравнение, «новый» / «не покупал», рассрочка отдельно, неотгруженные не считаются
const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const ym = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
const now = new Date(), M1 = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1)), M2 = ym(new Date(now.getFullYear(), now.getMonth() - 2, 1));
const K = 'Корпус Милан 4х БЕЛЫЙ 220х180х52 ( Коробка № 1 и № 2 )';
const ord = (id, cid, date, total, status) => ({ id, no: id.charCodeAt(0), clientId: cid, date, shipDate: (status || 'shipped') === 'shipped' ? date : null, shippedAt: 1, createdAt: 1, status: status || 'shipped', total,
  groups: [{ t: 'Шкаф', items: [{ n: K, q: 1, p: total - 500 }, { n: 'Ручки плоские 60 см', q: 4, p: 0 }, { n: 'Антресоль 2х БЕЛЫЙ', q: 1, p: 500 }] }] });
const db0 = { v: 1, templates: [], trash: [], payments: [], stockMoves: [], instNo: 2, settings: {}, cat: [],
  clients: [{ id: 'a', name: 'Альфа', opening: 0 }, { id: 'b', name: 'Бета', opening: 0 }, { id: 'c', name: 'Гамма', opening: 0 }],
  orders: [ord('A', 'a', M1 + '-05', 30000), ord('B', 'a', M1 + '-20', 20000), ord('C', 'a', M2 + '-10', 40000), ord('D', 'b', M2 + '-15', 25000), ord('E', 'c', M1 + '-07', 10000),
    ord('F', 'c', M1 + '-08', 99000, 'ordered'), ord('G', 'b', M1 + '-09', 77000, 'cancelled')],
  installments: [{ id: 'i1', no: 1, date: M1 + '-12', createdAt: 1, total: 37950, buyer: { name: 'Патимат', phone: '' }, groups: [{ t: 'Шкаф', items: [{ n: K, q: 1, p: 30000 }] }], schedule: [], pays: [] }],
  cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 10, lastBackup: Date.now(), notice: '' };
let fails = 0;
const R = (k, ok, info) => { console.log((ok ? 'OK   ' : 'FAIL ') + k + (info !== undefined ? ' — ' + info : '')); if (!ok) fails++; };
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/reports', beforeParse(w) {
  w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0)); w.addEventListener('error', e => errors.push(e.message)); } });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const change = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const row = n => [...d.querySelectorAll('.mtable tbody tr')].find(r => r.children[0].textContent.includes(n));
const cells = n => [...row(n).children].map(c => c.textContent.trim());
try {
  R('1 по умолчанию «За период» — старый отчёт на месте', !!d.querySelector('[data-act="range-open"]') && !d.querySelector('.mtable'));
  click(d.querySelector('[data-act="rep-tab"][data-v="month"]'));
  R('2 по умолчанию прошлый месяц и сравнение с позапрошлым', d.querySelector('[data-ch="rep-m"]').value === M1 && d.querySelector('[data-ch="rep-c"]').value === M2);
  R('3 Альфа: 2 шкафа, 50 000 против 40 000, ▲ +10 000 (+25%)', cells('Альфа').slice(1).join('|') === '2|50 000 ₽|40 000 ₽|▲ +10 000 ₽ (+25%)', cells('Альфа').join('|'));
  R('4 Гамма «новый», оформленный заказ не считается', cells('Гамма')[0].includes('новый') && cells('Гамма')[2] === '10 000 ₽');
  R('5 Бета «не покупал», отменённый не считается', cells('Бета')[0].includes('не покупал') && cells('Бета')[2] === '—' && cells('Бета')[3] === '25 000 ₽');
  R('6 рассрочка отдельной строкой', cells('Розница')[2] === '37 950 ₽');
  R('7 порядок: по сумме, «не покупал» внизу', [...d.querySelectorAll('.mtable tbody tr:not(.mtot)')].map(r => r.children[0].textContent.replace(/новый|не покупал|[▸▾]/g, '').trim()).join(',') === 'Альфа,Розница (рассрочка),Гамма,Бета');
  const tot = [...d.querySelector('.mtot').children].map(c => c.textContent.trim());
  R('8 итого: 4 шкафа, 97 950 против 65 000', tot[1] === '4' && tot[2] === '97 950 ₽' && tot[3] === '65 000 ₽', tot.join('|'));
  const k = [...d.querySelectorAll('.kpi .v')].map(x => x.textContent).join(' / ');
  R('9 итоги сверху', k === '97 950 ₽ / 4 / 2 / 24 488 ₽', k);
  click(row('Альфа'));
  const det = [...d.querySelectorAll('.mdet .line')].map(l => l.textContent).join('; ');
  R('10 раскрыть клиента: что купил (без ручек) и накладные', det.includes('Корпус Милан 4х БЕЛЫЙ2 шт') && det.includes('Антресоль 2х БЕЛЫЙ2 шт') && !det.includes('Ручки') && d.querySelectorAll('.mdocs a').length === 2, det);
  change(d.querySelector('[data-ch="rep-m"]'), M2);
  R('11 смена месяца: сравнение само сдвигается на месяц назад', d.querySelector('[data-ch="rep-c"]').value === ym(new Date(now.getFullYear(), now.getMonth() - 3, 1)) && cells('Альфа')[2] === '40 000 ₽');
  R('12 ошибок JS нет', !errors.length, errors.join(' | '));
} catch (e) { console.log('FAIL', e.stack); fails++; }
console.log(fails ? 'ОШИБОК: ' + fails : 'Все проверки пройдены');
