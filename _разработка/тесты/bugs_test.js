// Проверка исправлений 27.10.2026: копейки и минус в суммах, оплата товаром ↔ склад, переименование товара, опасные символы в именах
const { JSDOM } = require('jsdom'); const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const T = (d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(new Date());
const XSS = 'Ахмед "Мебель" <img src=x onerror="window.HACK=1">';
const db0 = { v: 1, templates: [{ id: 't1', t: 'Шкаф Т', items: [{ n: 'Корпус А белый', q: 1, p: 10000 }] }], trash: [], installments: [], instNo: 1, stockMoves: [], payments: [],
  cat: [{ n: 'Корпуса', ch: [], it: [['Корпус А белый', 10000], ['Механизм 160', 4000]] }], clients: [{ id: 'r', name: 'Рашид', opening: 0, phone: '' }, { id: 'x', name: XSS, opening: -5000, phone: '' }],
  orders: [{ id: 'o1', no: 1, date: T, shipDate: T, shippedAt: Date.now() + 5000, createdAt: Date.now(), status: 'shipped', clientId: 'x', groups: [{ t: XSS, items: [{ n: 'Корпус А белый', q: 2, p: 10000 }] }], total: 20000 }],
  cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 2, lastBackup: Date.now(), settings: {} };
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/home', beforeParse(w) { w.confirm = () => true; w.prompt = () => null; w.scrollTo = () => {}; w.print = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0)); w.addEventListener('error', e => errors.push(e.message)); } });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const input = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const change = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const nav = h => { w.location.hash = h; w.dispatchEvent(new w.HashChangeEvent('hashchange')); };
const db = () => JSON.parse(w.localStorage.getItem('livaro_db_v1'));
const R = (k, ok, info) => console.log((ok ? 'OK   ' : 'FAIL ') + k + (info ? ' — ' + info : ''));
try {
  // 1. опасные символы в имени клиента/шкафа: все экраны
  for (const h of ['#/home', '#/clients', '#/client/x', '#/sales', '#/sale/o1', '#/print/c/o1', '#/print/l/o1', '#/labels/o1', '#/payments', '#/reports', '#/opening']) nav(h);
  R('1 имя с <img onerror> не выполняется (11 экранов)', !w.HACK && !d.querySelector('img[src="x"]'));
  // 2. сумма с копейками
  nav('#/client/r'); click(d.querySelector('[data-act="pay-new"]')); change(d.getElementById('p-method'), 'cash'); input(d.getElementById('p-amount'), '12 500,50'); click(d.querySelector('[data-act="pay-save"]'));
  const a2 = db().payments.slice(-1)[0].amount; R('2 сумма «12 500,50» сохраняется как ~12 500', a2 < 20000, 'сохранено ' + a2);
  // 3. отрицательная сумма
  click(d.querySelector('[data-act="pay-new"]')); change(d.getElementById('p-method'), 'cash'); input(d.getElementById('p-amount'), '-3000'); click(d.querySelector('[data-act="pay-save"]'));
  const a3 = db().payments.slice(-1)[0].amount; const n3 = db().payments.length; R('3 «-3000» не сохраняется, есть предупреждение', db().payments.slice(-1)[0].amount !== 3000 && /минус/.test(d.getElementById('toast').textContent), 'последняя оплата ' + a3); w.eval('modal("")');
  // 2б. разные записи чисел
  const N = w.eval('[num("12 500,50"), num("12.500"), num("1 000 000"), num("7,4"), num(""), num("15 000 ₽")]').join(',');
  R('2б числа 12 500,50→12501; 12.500→12500; 1 000 000; 7,4→7; пусто→0; 15 000 ₽', N === '12501,12500,1000000,7,0,15000', N);
  // 4. оплата товаром с оприходованием, затем удаление оплаты
  click(d.querySelector('[data-act="pay-new"]')); change(d.getElementById('p-method'), 'goods'); input(d.getElementById('p-what'), 'Механизм 160'); input(d.getElementById('p-qty'), '5'); input(d.getElementById('p-price'), '4000'); click(d.querySelector('[data-act="pay-save"]'));
  const gp = db().payments.slice(-1)[0]; const st0 = w.eval('(stockMap()["Механизм 160"]||{}).have');
  nav('#/payments'); const delb = [...d.querySelectorAll('[data-act="pay-del"]')].find(b => b.dataset.id === gp.id);
  if (delb) { click(delb); const st1 = w.eval('(stockMap()["Механизм 160"]||{}).have'); R('4 удалили оплату товаром — приход на склад тоже отменён', st1 !== st0, 'склад был ' + st0 + ', стал ' + st1);
    click(d.querySelector('[data-act="toast-undo"]')); const st2 = w.eval('(stockMap()["Механизм 160"]||{}).have'); R('4б «Отменить» — оплата и приход вернулись', st2 === st0 && db().payments.some(p => p.id === gp.id), 'склад ' + st2); }
  else R('4 удаление оплаты товаром', false, 'нет кнопки удаления в «Оплатах»');
  // 4в. старая оплата товаром (до связи payId): приход находится по названию, количеству и времени
  w.eval('(() => { const t = Date.now() - 3600000; DB.payments.push({ id: "old1", clientId: "r", amount: 8000, method: "goods", status: "received", date: "' + T + '", receivedDate: "' + T + '", goods: { what: "Механизм 160", qty: 2, unit: "шт", price: 4000, stock: true }, createdAt: t }); DB.stockMoves.push({ id: "om", date: "' + T + '", name: "Механизм 160", q: 2, kind: "in", note: "взаимозачёт: Рашид", createdAt: t + 3 }); save(); })()');
  const o0 = w.eval('stockMap()["Механизм 160"].have'); nav('#/payments'); click([...d.querySelectorAll('[data-act="pay-del"]')].find(b => b.dataset.id === 'old1'));
  R('4в старая оплата товаром — приход убран', w.eval('stockMap()["Механизм 160"].have') === o0 - 2, 'было ' + o0 + ', стало ' + w.eval('stockMap()["Механизм 160"].have'));
  // 5. переименование товара, по которому есть склад и шаблон
  w.eval('DB.stockMoves.push({id:"m1",date:"' + T + '",name:"Корпус А белый",q:10,kind:"in",note:"",createdAt:Date.now()-100000}); save(); render()');
  const before = w.eval('stockMap()["Корпус А белый"].have');
  nav('#/catalog'); w.eval('UI.selCat = DB.cat[0]; render()'); w.eval('itemForm(DB.cat[0].id + "|0")'); d.getElementById('e-name').value = 'Корпус А БЕЛЫЙ (новый)'; click(d.querySelector('[data-act="citem-save"]'));
  const after = w.eval('(stockMap()["Корпус А БЕЛЫЙ (новый)"]||{have:"нет на учёте"}).have');
  R('5 переименовали товар — остаток на складе сохранился (с учётом прошлой отгрузки под старым именем)', after === before, 'было ' + before + ', после переименования ' + after);
  const tplOk = w.eval('!!findItem(DB.templates[0].items[0].n)'); R('5б шаблон после переименования находит товар', tplOk);
  // 6. начальный долг и баланс со спецсимволами
  nav('#/clients'); R('6 список клиентов отрисован', d.querySelectorAll('tbody tr').length >= 2);
  // 7. пустая корзина — оформить нельзя
  nav('#/order'); const btn = d.querySelector('[data-act="to-checkout"]'); R('7 пустую корзину нельзя оформить', !btn || btn.disabled || (click(btn), w.location.hash !== '#/checkout'));
  // 8. дробное количество товаром «2,5 м»
  nav('#/client/r'); click(d.querySelector('[data-act="pay-new"]')); change(d.getElementById('p-method'), 'goods'); input(d.getElementById('p-what'), 'Ткань'); input(d.getElementById('p-qty'), '2,5'); input(d.getElementById('p-price'), '165'); 
  R('8 «2,5 м × 165» = 413', d.getElementById('p-amount').value.replace(/\s/g, '') === '413', 'в поле: ' + d.getElementById('p-amount').value);
  w.eval('modal("")');
    R('9 ошибок JS при всех действиях', errors.length === 0, errors.join(' | '));
} catch (e) { console.log('FAIL', e.stack); }
