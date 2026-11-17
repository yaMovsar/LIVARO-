// Телефонная версия (ширина до 760 px): верхняя полоса с меню, «Ещё ⋯», подписи клеток таблиц, итог корзины внизу, подсказки «ниже».
// jsdom не понимает @media, поэтому «телефон» включаем подменой matchMedia; проверяем разметку и поведение, а не внешний вид.
const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
let phone = true;
const ord = (id, no, cid, st, total) => ({ id, no, date: '2026-11-10', shipDate: st === 'shipped' ? '2026-11-10' : '', shippedAt: st === 'shipped' ? no * 10 : 0, status: st, clientId: cid,
  groups: [{ t: 'Шкаф 1', items: [{ n: 'Шкаф А', q: 1, p: total }] }], total, createdAt: no });
const db0 = { v: 1, cat: [{ n: 'Шкафы', ch: [], it: [['Шкаф А', 1000], ['Шкаф Б', 2000]] }], templates: [],
  clients: [{ id: 'c1', name: 'Тест Клиент', phone: '+7 900 000-00-00', opening: 0 }],
  orders: [ord('o1', 1, 'c1', 'shipped', 5000), ord('o2', 2, 'c1', 'ordered', 7000)],
  payments: [], cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 3, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/sales', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.scrollBy = () => {}; w.Element.prototype.scrollIntoView = function () { w.__scrolled = this.id || this.className; };
  w.matchMedia = q => ({ matches: phone && /max-width:\s*760px/.test(q), media: q, addListener() {}, removeListener() {} });
  w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const go = h => { w.location.hash = h; w.dispatchEvent(new w.HashChangeEvent('hashchange')); };
let ok = 0, bad = 0;
const t = (name, cond, extra) => { if (cond) ok++; else bad++; console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra !== undefined ? ' — ' + extra : '')); };
const tick = () => new Promise(r => setTimeout(r, 0));
(async () => {
  try {
    // 1. верхняя полоса
    const top = d.getElementById('mtop');
    t('1 верхняя полоса: кнопка меню', !!top.querySelector('[data-act="menu"]'));
    t('1 верхняя полоса: название раздела', top.querySelector('.mtitle').textContent === 'Продажи', top.querySelector('.mtitle').textContent);
    // 2. меню открывается и закрывается, при переходе закрывается само
    click(top.querySelector('[data-act="menu"]'));
    t('2 меню открылось (с плавным выездом)', d.body.classList.contains('menu-open') && d.body.classList.contains('menu-anim'));
    click(d.querySelector('.mback'));
    t('2 тап по затемнению закрыл меню', !d.body.classList.contains('menu-open'));
    click(top.querySelector('[data-act="menu"]')); go('#/clients');
    t('2 переход в раздел закрыл меню', !d.body.classList.contains('menu-open'));
    t('2 заголовок сменился', d.querySelector('#mtop .mtitle').textContent === 'Клиенты и баланс');
    // 3. подписи клеток для карточек
    go('#/sales'); await tick();
    const cells = [...d.querySelectorAll('#main table.t tbody td[data-l]')];
    t('3 клетки таблицы получили подписи из шапки', cells.length > 0, cells.slice(0, 4).map(c => c.dataset.l).join(', '));
    // 4. «Ещё ⋯» в заказе
    go('#/sale/o2');
    const more = d.querySelector('[data-act="more"]'), box = more && more.parentElement;
    t('4 кнопка «Ещё ⋯» есть', !!more);
    t('4 редкие кнопки на месте (удалить, отменить)', !!box.querySelector('.rare [data-act="order-del"]') && !!box.querySelector('.rare [data-act="order-cancel"]'));
    click(more);
    t('4 «Ещё» раскрывает, надпись «Скрыть»', box.classList.contains('open') && more.textContent === 'Скрыть');
    click(more);
    t('4 повторное нажатие сворачивает', !box.classList.contains('open') && more.textContent === 'Ещё ⋯');
    // 5. корзина: подсказки «ниже», итог внизу
    go('#/order');
    t('5 пустая корзина: «каталоге ниже»', d.getElementById('main').textContent.includes('каталоге ниже'));
    t('5 нет подсказки про перетаскивание за ⠿', !d.getElementById('main').textContent.includes('тяните её за значок'));
    t('5 итога внизу нет, пока корзина пуста', !d.querySelector('.mcart'));
    w.__scrolled = ''; click(d.querySelector('[data-act="tree"][data-view="o"]'));
    t('5 выбор папки в каталоге заказа прокрутил к товарам', w.__scrolled === 'cat-list', w.__scrolled);
    click(d.querySelector('.it[data-act="add"]'));
    t('5 товар добавлен → итог внизу экрана', !!d.querySelector('.mcart') && d.querySelector('.mcart').textContent.includes('1 поз.'), d.querySelector('.mcart') && d.querySelector('.mcart').textContent);
    t('5 подсказка «Добавлено в …»', d.getElementById('toast').textContent.includes('Добавлено в «Шкаф 1»'), d.getElementById('toast').textContent);
    t('5 «+ Заказ» вверху показывает число', d.querySelector('#mtop .cnt') && d.querySelector('#mtop .cnt').textContent === '1');
    click(d.querySelector('[data-act="cart-top"]'));
    t('5 «к корзине ↑» прокручивает к корзине', w.__scrolled === 'cart-card', w.__scrolled);
    // 6. «Товары»: подсказка для телефона и прокрутка к списку после выбора папки
    go('#/catalog');
    t('6 подсказка «товары появятся ниже»', d.querySelector('.sub-h').textContent.includes('появятся ниже'));
    w.__scrolled = ''; click(d.querySelector('[data-act="tree"]'));
    t('6 выбор папки прокрутил к списку товаров', w.__scrolled === 'cat-items', w.__scrolled);
    // 7. на компьютере всё по-старому
    phone = false; go('#/order');
    t('7 компьютер: «каталоге справа»', d.getElementById('main').textContent.includes('каталоге справа') || d.getElementById('main').textContent.includes('тяните её за значок'));
    go('#/catalog'); w.__scrolled = ''; click(d.querySelector('[data-act="tree"]'));
    t('7 компьютер: без прокрутки к списку', !w.__scrolled);
    t('8 ошибок JS нет', !errors.length, errors.join(' | '));
  } catch (e) { bad++; console.log('FAIL исключение:', e.stack); }
  console.log(bad ? 'ОШИБОК: ' + bad : 'Все проверки пройдены (' + ok + ')');
  process.exit(bad ? 1 : 0);
})();
