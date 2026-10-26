const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const today = new Date(), iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), T = iso(today);
const K6 = 'Корпус Милан 6х БЕЛЫЙ по бокам трубы 220х270х52 ( Коробка № 1 и № 2 )', DA = 'дверь АЙША на корпус МИЛАН 220 БЕЛЫЙ С - образ';
const shk = (col, door, n) => ({ t: 'Шкаф', items: [{ n: (n === 6 ? 'Корпус Милан 6х ' : 'Корпус 4-х Милан ') + col + ' 220х270х52', q: 1, p: 30000 }, { n: door, q: n, p: 0 }, { n: 'Ручки скобы 30 см ЗОЛОТО', q: n, p: 0 }] });
const db0 = { v: 1, cat: [{ n: 'Шкафы', ch: [], it: [[K6, 30000], [DA, 0]] }], templates: [], trash: [], payments: [], installments: [], instNo: 1, stockMoves: [],
  clients: [{ id: 'c1', name: 'Рашид', opening: 0 }, { id: 'c2', name: 'Шамиль', opening: 0 }],
  orders: [
    { id: 'a', no: 1, date: T, shipDate: T, shippedAt: 1, status: 'shipped', clientId: 'c1', groups: [shk('БЕЛЫЙ', 'дверь АЙША на корпус МИЛАН 220 БЕЛЫЙ С - образ', 6), shk('СЕРЫЙ', 'Дверь Марьям на корпус МИЛАН СЕРЫЙ', 4)], total: 60000, createdAt: 1 },
    { id: 'b', no: 2, date: T, shipDate: T, shippedAt: 2, status: 'shipped', clientId: 'c2', groups: [shk('БЕЛЫЙ', 'дверь АЙША на корпус МИЛАН 220 БЕЛЫЙ С - образ', 6)], total: 30000, createdAt: 2 },
    { id: 'c', no: 3, date: T, status: 'ordered', clientId: 'c2', groups: [{ t: 'Айша 6', items: [{ n: K6, q: 1, p: 30000 }, { n: DA, q: 6, p: 0 }] }], total: 30000, createdAt: 3 }],
  cart: { groups: [], cur: 0 }, nextNo: 4, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/stock', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const input = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const sync = () => w.dispatchEvent(new w.HashChangeEvent('hashchange'));
const rows = () => [...d.querySelectorAll('.tcard tbody tr')].map(r => r.children[0].textContent.slice(0, 22) + ': склад ' + r.children[1].textContent + ', резерв ' + r.children[2].textContent + ', доступно ' + r.children[3].textContent).join(' | ');
try {
  console.log('1 пустой склад:', d.querySelector('.empty').textContent.slice(0, 40));
  // приход: корпус 6х белый 5 шт, затем «сохранить и ещё» — двери 10
  click(d.querySelector('[data-act="sk-open"][data-kind="in"]'));
  input(d.getElementById('sk-q'), 'корпус милан 6х'); click(d.querySelector('[data-act="sk-pick"]'));
  d.getElementById('sk-n').value = '5'; click(d.querySelector('[data-act="sk-save"][data-more]'));
  input(d.getElementById('sk-q'), 'айша'); click(d.querySelector('[data-act="sk-pick"]')); d.getElementById('sk-n').value = '10'; click(d.querySelector('[data-act="sk-save"]:not([data-more])'));
  console.log('2 после прихода:', rows());
  // отгрузили заказ №3 → списание
  w.location.hash = '#/sale/c'; sync();
  console.log('3 карточка «Склад» в заказе:', d.querySelector('.aside .card').textContent.replace(/\s+/g, ' ').slice(0, 90));
  click(d.querySelector('[data-act="ship-open"]')); click(d.querySelector('[data-act="ship-do"]'));
  w.location.hash = '#/stock'; sync(); console.log('4 после отгрузки:', rows());
  // инвентаризация: дверей реально 3
  click([...d.querySelectorAll('[data-act="sk-open"][data-kind="adj"]')].find(b => b.dataset.name === DA));
  d.getElementById('sk-n').value = '3'; click(d.querySelector('[data-act="sk-save"]:not([data-more])'));
  console.log('5 инвентаризация двери = 3:', rows());
  // новый заказ на 6 дверей при 3 на складе — предупреждение
  w.eval('DB.orders.push({id:"e",no:4,date:todayISO(),status:"ordered",clientId:"c1",groups:[{t:"x",items:[{n:' + JSON.stringify(DA) + ',q:6,p:0}]}],total:0,createdAt:9});commit();');
  w.location.hash = '#/sale/e'; sync(); console.log('6 нехватка в заказе:', d.querySelector('.aside .card').textContent.replace(/\s+/g, ' '));
  w.location.hash = '#/stock'; sync(); click(d.querySelector('[data-act="st-f"][data-v="short"]')); console.log('  фильтр «не хватает»:', rows());
  // отчёты
  w.location.hash = '#/reports'; sync();
  console.log('7 отчёт:', [...d.querySelectorAll('.kpi')].map(k => k.querySelector('.l').textContent + ' ' + k.querySelector('.v').textContent).join(' | '));
  console.log('  модели:', [...d.querySelectorAll('.row')[0].querySelectorAll('tbody tr')].map(r => r.textContent).join(' | '));
  console.log('  цвета:', [...d.querySelectorAll('.aside .line')].slice(0, 3).map(l => l.textContent).join(' | '));
  // выбор периода на главной и в оплатах
  w.location.hash = '#/home'; sync(); console.log('8 главная:', d.querySelector('[data-act="range-open"]').textContent, '| в отчётах кнопка:', !!d.querySelector('[data-k]') );
  click(d.querySelector('[data-act="range-open"]')); click(d.querySelector('[data-act="rp-tab"][data-v="Год"]')); click(d.querySelector('[data-act="rp-pick"][data-v="Этот год"]')); click(d.querySelector('[data-act="rp-apply"]'));
  console.log('  главная → этот год:', d.querySelector('[data-act="range-open"]').textContent);
  w.location.hash = '#/payments'; sync(); console.log('  оплаты:', d.querySelector('[data-act="range-open"]').textContent);
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
