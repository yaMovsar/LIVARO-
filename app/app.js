'use strict';
/* LIVARO — учёт продаж мебельного производства.
   Данные хранятся в браузере (localStorage); копии — в файлы через раздел «Данные». */

/* ================= утилиты ================= */
const KEY = 'livaro_db_v1', TRIAL_KEY = 'livaro_trial_v1';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = n => (n === null || n === undefined || n === '') ? '' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const rub = n => fmt(n) + ' ₽';
const num = v => parseInt(String(v == null ? '' : v).replace(/[^\d]/g, ''), 10) || 0;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = x => (x < 10 ? '0' : '') + x;
const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayISO = () => isoOf(new Date());
const ru = iso => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '';
const clone = o => JSON.parse(JSON.stringify(o));
const balTxt = v => v > 0 ? 'на балансе ' + rub(v) : (v < 0 ? 'долг ' + rub(-v) : '0 ₽');
const balTag = v => '<span class="tag ' + (v > 0 ? 'a' : v < 0 ? 'd' : 'z') + '">' + balTxt(v) + '</span>';
const balP = v => (v > 0 ? 'НА БАЛАНСЕ ' : v < 0 ? 'ДОЛГ ' : '') + fmt(Math.abs(v)) + ',00 руб.';
const METHOD = { cash: 'наличные', transfer: 'перевод', driver: 'через водителя', goods: 'товаром' };
const FOLDER = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" style="flex:none"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

/* всплывающее сообщение; undo — необязательная кнопка «Отменить» (держится дольше) */
function toast(msg, undo, ms) {
  const t = $('#toast');
  t.innerHTML = esc(msg) + (undo ? '<button data-act="toast-undo">' + esc(undo.label) + '</button>' : '');
  toast.fn = undo ? undo.fn : null; t.className = 'toast noprint on';
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = 'toast noprint'; toast.fn = null; }, ms || (undo ? 8000 : 2600));
}

/* ================= WhatsApp: накладная картинкой ================= */
function waPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  if (d.length === 10) d = '7' + d;
  return d.length >= 11 ? d : '';
}
/* рисует накладную клиенту (как при печати) в PNG */
const invoiceImage = o => paperImage(VIEWS.print(['c', o.id]));
/* любой печатный лист (.paper) → PNG */
async function paperImage(html) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff';
  box.innerHTML = html;
  box.querySelectorAll('.noprint').forEach(x => x.remove());
  document.body.appendChild(box);
  try {
    const canvas = await html2canvas(box.querySelector('.paper'), { scale: 2, backgroundColor: '#ffffff', logging: false });
    return await new Promise(r => canvas.toBlob(r, 'image/png'));
  } finally { box.remove(); }
}
function waText(o) {
  const b = orderBalance(o);
  return (o.status === 'shipped' ? 'Накладная' : 'Заказ') + ' № ' + o.no + ' от ' + ru(o.shipDate || o.date) + '\nСумма: ' + rub(o.total) +
    '\nВаш баланс после отгрузки: ' + balTxt(b.after) + '\n— LIVARO';
}
/* отправка картинки: 1) окно Windows «Поделиться» → WhatsApp; 2) запасной путь — буфер обмена + пустой чат (Ctrl+V) */
async function sharePng(blob, name, phone) {
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; /* иначе — запасной способ */ }
  }
  let copied = false;
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); copied = true; } catch (e) { /* буфер недоступен */ }
  if (!copied) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }
  window.open('https://wa.me/' + phone, '_blank');
  toast((copied ? 'Картинка скопирована — в чате WhatsApp нажмите Ctrl+V и отправьте.' : 'Картинка сохранена в «Загрузки» — прикрепите её в чате скрепкой.') +
    (phone ? '' : ' Телефон не указан — выберите чат вручную.'), null, 10000);
}
const waBtn = o => '<button class="btn" data-act="wa-send" data-id="' + o.id + '" title="Отправить накладную клиенту картинкой">' + icon('message', 16) + 'WhatsApp</button>';

/* сумма прописью */
const W = {
  u: ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'],
  t1: ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'],
  t: ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'],
  h: ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']
};
function tri(n, fem) {
  const h = Math.floor(n / 100), t = Math.floor(n % 100 / 10), u = n % 10, r = [];
  if (h) r.push(W.h[h]);
  if (t === 1) r.push(W.t1[u]);
  else { if (t) r.push(W.t[t]); if (u) r.push(fem && u < 3 ? ['', 'одна', 'две'][u] : W.u[u]); }
  return r.join(' ');
}
function plural(n, a, b, c) { n = n % 100; if (n > 10 && n < 20) return c; n = n % 10; return n === 1 ? a : (n > 1 && n < 5 ? b : c); }
function words(n) {
  if (!n) return 'Ноль рублей 00 копеек';
  const r = [], m = Math.floor(n / 1e6), th = Math.floor(n % 1e6 / 1000), u = n % 1000;
  if (m) r.push(tri(m) + ' ' + plural(m, 'миллион', 'миллиона', 'миллионов'));
  if (th) r.push(tri(th, true) + ' ' + plural(th, 'тысяча', 'тысячи', 'тысяч'));
  if (u) r.push(tri(u));
  const s = r.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1) + ' ' + plural(n, 'рубль', 'рубля', 'рублей') + ' 00 копеек';
}

/* ================= данные ================= */
function blankDB() {
  return {
    v: 1, cat: clone(window.CAT_1C || []), clients: [], orders: [], payments: [], templates: [], trash: [], installments: [], instNo: 1, stockMoves: [],
    cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 1, lastBackup: null, notice: ''
  };
}
let DB;
function load() {
  try { DB = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { DB = null; }
  if (DB) {
    if (!DB.templates) DB.templates = [];
    if (!DB.trash) DB.trash = [];
    if (!DB.installments) { DB.installments = []; DB.instNo = 1; }
    if (!DB.stockMoves) DB.stockMoves = [];
    // до 24.10.2026 «Провести» сразу отгружало — такие накладные считаем отгруженными
    DB.orders.forEach(o => { if (!o.status) { o.status = 'shipped'; o.shipDate = o.date; } });
    save();
    return;
  }
  DB = blankDB();
  // перенос из пробной версии: папки товаров и набранная корзина
  try {
    const t = JSON.parse(localStorage.getItem(TRIAL_KEY) || 'null');
    if (t && t.cat) {
      DB.cat = t.cat;
      if (t.doc && t.doc.length) DB.cart = { groups: t.doc, cur: t.cur || 0 };
      DB.notice = 'Папки и товары перенесены из пробной версии.';
    }
  } catch (e) { /* пробной версии нет — начинаем с товаров из 1С */ }
  save();
}
let saveFailed = false;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(DB)); saveFailed = false; }
  catch (e) { saveFailed = true; }
  bkSchedule(); // автокопия в папку — через пару секунд после изменений
}
const client = id => DB.clients.find(c => c.id === id);
const order = id => DB.orders.find(o => o.id === id);
const orderTotal = groups => groups.reduce((s, g) => s + gsum(g), 0);
function gsum(g) { return g.items.reduce((s, it) => s + it.q * (it.p || 0), 0); }

/* статусы заказа: ordered — оформлен (на баланс не влияет), shipped — отгружен, cancelled — отменён */
const STATUS = { ordered: 'Ждёт отгрузки', shipped: 'Отгружен', cancelled: 'Отменён' };
const st = (cls, text) => '<span class="st st-' + cls + '"><i></i>' + text + '</span>';
const statusTag = o => st(o.status, STATUS[o.status]);
const shipped = () => DB.orders.filter(o => o.status === 'shipped');
const waitingOrders = () => DB.orders.filter(o => o.status === 'ordered');
const daysSince = iso => Math.floor((new Date(todayISO()) - new Date(iso)) / 864e5);
const LATE_DAYS = 3;

/* движения по клиенту в хронологическом порядке: отгрузки (−) и полученные оплаты (+) */
function payDate(p) { return p.status === 'received' ? (p.receivedDate || p.date) : p.date; }
function moves(cid) {
  const m = [];
  shipped().filter(o => o.clientId === cid).forEach(o => m.push({ kind: 'order', date: o.shipDate, seq: o.shippedAt || o.createdAt, amt: -o.total, ref: o }));
  DB.payments.filter(p => p.clientId === cid && p.status === 'received').forEach(p => m.push({ kind: 'pay', date: payDate(p), seq: p.createdAt, amt: p.amount, ref: p }));
  m.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq);
  return m;
}
function balance(cid) { const c = client(cid); return (c ? c.opening || 0 : 0) + moves(cid).reduce((s, x) => s + x.amt, 0); }
function pendingOf(cid) { return DB.payments.filter(p => p.clientId === cid && p.status === 'pending').reduce((s, p) => s + p.amount, 0); }
/* баланс до/после конкретной накладной — для печати.
   Для неотгруженного заказа — «как будет после отгрузки» от текущего баланса. */
function orderBalance(o) {
  // оплаты «при отгрузке»; у старых накладных (до 2 шагов) все оплаты по ним были при отгрузке
  const atShip = DB.payments.filter(p => p.orderId === o.id && (p.atShip || !o.shippedAt));
  const paidNow = atShip.filter(p => p.status === 'received').reduce((s, p) => s + p.amount, 0);
  const waiting = atShip.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  let before;
  if (o.status === 'shipped') {
    const c = client(o.clientId); before = c ? c.opening || 0 : 0;
    for (const x of moves(o.clientId)) {
      if (x.ref === o) break;
      if (x.kind === 'pay' && atShip.includes(x.ref)) continue;
      before += x.amt;
    }
  } else before = balance(o.clientId);
  return { before, paidNow, waiting, after: before - o.total + paidNow };
}

/* оплата накладных.
   Явно: оплата привязана к накладным (alloc). Автоматически: деньги на балансе и непривязанные оплаты клиента
   закрывают его отгруженные накладные от старых к новым. */
const allocsOf = p => p.alloc || (p.orderId ? [{ orderId: p.orderId, amount: p.amount }] : []);
function payMap() {
  const map = {}, pool = {}, oldDebt = {};
  const addPool = (cid, amount, how) => { if (amount > 0 && pool[cid]) pool[cid].push({ a: amount, how }); };
  DB.orders.forEach(o => { map[o.id] = { paid: 0, explicit: 0, auto: 0, pending: 0, methods: [] }; });
  // «пул» свободных денег клиента — части с подписью, откуда пришли (для «Оплачен · перевод»)
  DB.clients.forEach(c => { pool[c.id] = []; oldDebt[c.id] = Math.max(0, -(c.opening || 0)); addPool(c.id, c.opening || 0, 'с баланса'); });
  DB.payments.filter(p => p.status === 'received').concat(DB.payments.filter(p => p.status !== 'received'))
    .sort((a, b) => payDate(a).localeCompare(payDate(b)) || a.createdAt - b.createdAt).forEach(p => {
      if (!pool[p.clientId]) return;
      let used = 0;
      allocsOf(p).forEach(a => {
        const m = map[a.orderId]; if (!m) return;
        used += a.amount;
        if (p.status === 'received') { m.explicit += a.amount; if (!m.methods.includes(METHOD[p.method])) m.methods.push(METHOD[p.method]); }
        else m.pending += a.amount;
      });
      if (p.status === 'received') addPool(p.clientId, p.amount - used, METHOD[p.method]);
    });
  DB.orders.forEach(o => { if (o.status === 'cancelled') addPool(o.clientId, map[o.id].explicit, 'возврат с отменённого заказа'); });
  // старый долг (отрицательный начальный баланс) закрывается первым
  const take = (cid, need, how) => {
    let got = 0; const P = pool[cid] || [];
    while (need > 0 && P.length) { const t = Math.min(need, P[0].a); P[0].a -= t; need -= t; got += t; if (how && !how.includes(P[0].how)) how.push(P[0].how); if (!P[0].a) P.shift(); }
    return got;
  };
  for (const k in oldDebt) take(k, oldDebt[k]);
  shipped().sort((a, b) => a.shipDate.localeCompare(b.shipDate) || (a.shippedAt || a.createdAt) - (b.shippedAt || b.createdAt)).forEach(o => {
    const m = map[o.id]; let need = o.total - m.explicit;
    if (need < 0) { addPool(o.clientId, -need, 'переплата'); need = 0; }
    const how = [], got = take(o.clientId, need, how);
    m.auto = got; how.forEach(h => { if (!m.methods.includes(h)) m.methods.push(h); }); m.paid = Math.min(o.total, m.explicit + got);
  });
  DB.orders.filter(o => o.status === 'ordered').forEach(o => { map[o.id].paid = Math.min(o.total, map[o.id].explicit); });
  return map;
}
const remaining = (o, m) => Math.max(0, o.total - m.paid);
function payLabel(o, m) {
  if (o.status === 'cancelled') return '<span class="muted">—</span>';
  const pend = m.pending ? ' ' + st('wait', 'у водителя ' + rub(m.pending)) : '';
  const how = m.methods.join(', ');
  if (o.status === 'ordered') return (m.explicit ? st('prepay', 'Предоплата ' + rub(m.explicit)) : '<span class="muted">не оплачен</span>') + pend;
  if (m.paid >= o.total) return st('paid', 'Оплачен') + (how ? '<span class="st-how">' + how + '</span>' : '') + pend;
  if (m.paid > 0) return st('part', 'Частично ' + rub(m.paid)) + pend;
  return st('unpaid', 'Не оплачен') + pend;
}

/* ================= периоды ================= */
const PERIODS = [['today', 'Сегодня'], ['7', '7 дней'], ['30', '30 дней'], ['year', 'Этот год'], ['all', 'Всё время']];
function periodStart(p) {
  const d = new Date();
  if (p === 'today') return todayISO();
  if (p === '7') { d.setDate(d.getDate() - 6); return isoOf(d); }
  if (p === '30') { d.setDate(d.getDate() - 29); return isoOf(d); }
  if (p === 'year') return d.getFullYear() + '-01-01';
  return '0000-00-00';
}
const inPeriod = (iso, p) => iso >= periodStart(p) && iso <= '9999';
/* переключатель-сегмент: options = [[значение, подпись, счётчик?], …] */
function seg(cur, act, options) {
  return '<div class="seg" role="group">' + options.map(([k, l, n]) => '<button' + (k === cur ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + ' data-act="' + act + '" data-v="' + k + '">' + l + (n ? '<small>' + n + '</small>' : '') + '</button>').join('') + '</div>';
}
function periodChips(cur, act) { return seg(cur, act, PERIODS); }

/* ================= каталог: дерево папок ================= */
let NODES = {}, PARENT = {};
function reindex() {
  NODES = {}; PARENT = {};
  (function walk(list, pre) {
    list.forEach((n, i) => { n.id = pre + i; NODES[n.id] = n; PARENT[n.id] = list; walk(n.ch, n.id + '-'); });
  })(DB.cat, '');
}
const UI = { period: 'today', salesPeriod: '30', payPeriod: '30', repPeriod: '30', clientFilter: 'all', salesQ: '', clientQ: '',
  selOrder: null, selCat: null, catChecked: {}, q: '', ck: null, justDone: null };
function folderPath(n) {
  const parts = []; let id = n.id;
  while (id !== undefined && id !== '') { parts.unshift(NODES[id].n); const k = id.lastIndexOf('-'); id = k < 0 ? '' : id.slice(0, k); }
  return parts.join(' / ');
}
function treeHtml(list, depth, view) {
  const sel = view === 'o' ? UI.selOrder : UI.selCat;
  return list.map(n => {
    const has = n.ch.length > 0;
    let h = '<div class="tn' + (sel === n ? ' on' : '') + '" data-act="tree" data-view="' + view + '" data-id="' + n.id + '"' +
      (view === 'c' ? ' draggable="true" data-tdrag="' + n.id + '"' : '') +
      ' style="padding-left:' + (6 + depth * 16) + 'px"><span class="tw">' + (has ? (n.open ? '▾' : '▸') : '') + '</span>' + FOLDER + '<span>' + esc(n.n) + '</span>' +
      (n.it.length ? '<span class="muted" style="margin-left:auto;font-size:11px">' + n.it.length + '</span>' : '') + '</div>';
    if (has && n.open) h += treeHtml(n.ch, depth + 1, view);
    return h;
  }).join('');
}
const priceHtml = p => p === null || p === undefined ? '<span class="noprice">нет цены</span>' : (p ? rub(p) : 'входит');
function allFolders(list, depth, out) {
  out = out || []; depth = depth || 0;
  list.forEach(n => { out.push({ n, depth }); allFolders(n.ch, depth + 1, out); });
  return out;
}

/* ================= шаблоны: смена цвета ================= */
/* порядок цветов LIVARO — так они идут в списках, шаблонах и при сортировке */
const COLORS = [['белый', 'Белый'], ['серый', 'Серый'], ['ваниль', 'Ваниль'], ['лино', 'Лино'], ['вотан', 'Вотан'], ['сатин', 'Сатин']];
const colorRe = () => /(?<![а-яё])(сер(?:ый|ая|ое|ые)|бел(?:ый|ая|ое|ые)|лино|ваниль|в[оа]тан|сатин)(?![а-яё])/gi;
function colorKey(w) {
  w = w.toLowerCase();
  return w.startsWith('сер') ? 'серый' : w.startsWith('бел') ? 'белый' : /^в[оа]тан$/.test(w) ? 'вотан' : w;
}
const baseName = n => n.replace(colorRe(), '').replace(/\s+/g, ' ').trim().toLowerCase();
function recolorText(s, ck) {
  return s.replace(colorRe(), w => {
    const fem = /ая$/i.test(w);
    let out = ck === 'серый' ? (fem ? 'серая' : 'серый') : ck === 'белый' ? (fem ? 'белая' : 'белый') : ck;
    if (w === w.toUpperCase()) out = out.toUpperCase(); else if (w[0] === w[0].toUpperCase()) out = out[0].toUpperCase() + out.slice(1);
    return out;
  });
}
/* сначала ищем такой же товар нужного цвета в каталоге, иначе меняем цвет в названии */
function recolorItem(name, ck) {
  const m = name.match(colorRe());
  if (!m) return name;
  const key = baseName(name) + '|' + ck;
  for (const id in NODES) for (const it of NODES[id].it) {
    const mm = it[0].match(colorRe());
    if (mm && colorKey(mm[0]) === ck && baseName(it[0]) + '|' + ck === key) return it[0];
  }
  return recolorText(name, ck);
}
function templatesCard() {
  const T = DB.templates;
  // компактная строка над корзиной: шаблон — плашка, ✎ и × внутри неё
  return '<div class="card tpl-strip"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><b style="margin-right:4px">Шаблоны</b>' + (T.length ? T.map(t =>
    '<span class="tchip"><button class="tmain" data-act="tpl-open" data-id="' + t.id + '" title="Добавить в корзину — выбрать цвет"><b>' + esc(t.t) + '</b><span class="muted">' + rub(gsum(t)) + '</span></button>' +
    '<button class="tico" data-act="tpl-ren" data-id="' + t.id + '" aria-label="Переименовать шаблон" title="Переименовать">✎</button><button class="tico del" data-act="tpl-del" data-id="' + t.id + '" aria-label="Удалить шаблон" title="Удалить">×</button></span>').join('')
    : '<span class="hint">Соберите шкаф и нажмите «В шаблоны» в его заголовке — потом он добавляется одним нажатием в любом цвете.</span>') + '</div></div>';
}

/* ================= маршруты ================= */
function route() { const h = (location.hash || '#/home').slice(2).split('/'); return { name: h[0] || 'home', args: h.slice(1) }; }
const go = h => { location.hash = h; };
const pendingCount = () => DB.payments.filter(p => p.status === 'pending').length;
const cartCount = () => DB.cart.groups.reduce((s, g) => s + g.items.length, 0);

function sideHtml(name) {
  const items = [
    ['home', 'Главная'], ['order', 'Оформить заказ', cartCount(), 'cta'], ['sales', 'Продажи', waitingOrders().length], ['inst', 'Рассрочка', instLate()], ['catalog', 'Товары'], ['stock', 'Склад'],
    ['clients', 'Клиенты и баланс'], ['drivers', 'Деньги у водителей', pendingCount()], ['payments', 'Оплаты'], ['reports', 'Отчёты'], ['sep'],
    ['trash', 'Удалённые', DB.trash.length], ['data', 'Данные и копии']
  ];
  const active = { sale: 'sales', checkout: 'order', client: 'clients', opening: 'clients', print: 'sales', labels: 'sales', inv: 'stock', invprint: 'stock', ins: 'inst', instnew: 'order', iprint: 'inst' }[name] || name;
  return '<div class="logo"><b>LIVARO</b><span>Учёт производства</span></div>' + items.map(([k, l, c, cls]) =>
    k === 'sep' ? '<div class="sep"></div>' :
      '<a class="nav' + (cls ? ' ' + cls : '') + (active === k && !cls ? ' on' : '') + '" href="#/' + k + '"' + (active === k ? ' aria-current="page"' : '') + '><span>' + icon(k) + l + '</span>' +
      (c ? '<span class="cnt">' + c + '</span>' : '') + '</a>').join('') +
    '<div id="bk-status" style="margin-top:auto">' + bkStatusHtml() + '</div>';
}
/* иконки в стиле Lucide (контур 2px) */
const ICONS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  order: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  sales: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8H8"/><path d="M16 12H8"/><path d="M13 16H8"/>',
  catalog: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  clients: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  drivers: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  payments: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  reports: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  inst: '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M17.5 17.5 16 16.3V14"/><circle cx="16" cy="16" r="6"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  stock: '<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/>',
  data: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>'
};
const icon = (k, s) => '<svg width="' + (s || 18) + '" height="' + (s || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[k] || '') + '</svg>';

function render() {
  reindex();
  const r = route(), view = VIEWS[r.name] || VIEWS.home;
  // сохраняем прокрутку списков между перерисовками
  const keep = {}; document.querySelectorAll('[data-ks]').forEach(el => { keep[el.dataset.ks] = el.scrollTop; });
  $('#side').innerHTML = sideHtml(r.name);
  $('#main').innerHTML = view(r.args) + (saveFailed ? '<div class="warn">Не удалось сохранить данные в браузере. Сделайте копию в разделе «Данные и копии».</div>' : '');
  document.querySelectorAll('[data-ks]').forEach(el => { if (keep[el.dataset.ks]) el.scrollTop = keep[el.dataset.ks]; });
  $('#main').classList.toggle('has-bulk', !!$('.bulkbar'));
}
function commit() { save(); render(); }

/* ================= ГЛАВНАЯ ================= */
const VIEWS = {};
VIEWS.home = () => {
  const p = UI.homeRange, orders = shipped().filter(o => inRange(o.shipDate, p));
  const wait = waitingOrders().sort((a, b) => a.date.localeCompare(b.date)), waitSum = wait.reduce((s, o) => s + o.total, 0);
  const sold = orders.reduce((s, o) => s + o.total, 0);
  const paid = DB.payments.filter(x => x.status === 'received' && inRange(payDate(x), p)).reduce((s, x) => s + x.amount, 0);
  let debt = 0, adv = 0, debtors = [];
  DB.clients.forEach(c => { const b = balance(c.id); if (b < 0) { debt -= b; debtors.push([c, b]); } else adv += b; });
  debtors.sort((a, b) => a[1] - b[1]);
  const pend = DB.payments.filter(x => x.status === 'pending'), pendSum = pend.reduce((s, x) => s + x.amount, 0);
  // продажи по дням за 14 дней
  const days = [], d = new Date(); d.setDate(d.getDate() - 13);
  for (let i = 0; i < 14; i++) { const iso = isoOf(d); days.push([iso, shipped().filter(o => o.shipDate === iso).reduce((s, o) => s + o.total, 0)]); d.setDate(d.getDate() + 1); }
  const max = Math.max(1, ...days.map(x => x[1]));
  const recent = DB.orders.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  const backupOld = !DB.lastBackup || (Date.now() - DB.lastBackup) > 7 * 864e5;
  const cc = cartCount();
  return '<div class="head"><div><div class="crumb">' + ru(todayISO()) + '</div><h1>Главная</h1></div>' + rangeButton(p, 'range-open', 'homeRange') + '</div>' +
    (DB.notice ? '<div class="warn"><span>' + esc(DB.notice) + '</span><button class="btn sm" data-act="notice-ok">Понятно</button></div>' : '') +
    (BK.state !== 'on' && BK.state !== 'prompt' && backupOld && (DB.orders.length || DB.clients.length) ? '<div class="warn"><span>Автокопия не включена — данные хранятся только в браузере. Включите её, это займёт минуту.</span><a class="btn sm" href="#/data">Включить автокопию</a></div>' : '') +
    '<div class="hero"><div><div class="t1">' + (cc ? 'В корзине ' + cc + ' поз. — продолжить оформление' : 'Новый заказ') + '</div><div class="hint">Выберите товары из папок, затем оформите накладную</div></div><a class="btn pri big" href="#/order">Оформить заказ</a></div>' +
    '<div class="tiles">' +
    tile('Отгружено', rub(sold), orders.length + ' ' + plural(orders.length, 'накладная', 'накладные', 'накладных')) +
    tile('Ждут отгрузки', rub(waitSum), wait.length + ' ' + plural(wait.length, 'заказ', 'заказа', 'заказов') + ' · на сегодня') +
    tile('Получено оплат', rub(paid), (() => { const gp = DB.payments.filter(x => x.status === 'received' && x.method === 'goods' && inRange(payDate(x), p)).reduce((s, x) => s + x.amount, 0); return gp ? 'из них товаром ' + rub(gp) : 'наличные, переводы, от водителей'; })()) +
    tile('Клиенты должны', '<span class="debt">' + rub(debt) + '</span>', debtors.length + ' в долгу · на сегодня') +
    tile('Деньги клиентов на балансе', '<span class="adv">' + rub(adv) + '</span>', 'деньги клиентов у вас') +
    tile('Деньги у водителей', '<span style="color:var(--wait-ink)">' + rub(pendSum) + '</span>', pend.length + ' не получено') +
    '</div>' +
    (wait.length ? '<div class="card"><h2>Ждут отгрузки</h2><div class="scroll"><table class="t"><thead><tr><th>№</th><th>Оформлен</th><th>Клиент</th><th class="num">Сумма</th><th></th></tr></thead><tbody>' +
      wait.map(o => { const dd = daysSince(o.date); return '<tr class="click" data-act="go" data-to="#/sale/' + o.id + '"><td><b>' + o.no + '</b></td><td>' + ru(o.date) + ' ' +
        (dd > LATE_DAYS ? '<span class="tag d">' + dd + ' дн. не забирают</span>' : dd ? '<span class="muted">' + dd + ' дн.</span>' : '<span class="muted">сегодня</span>') + '</td><td>' + esc((client(o.clientId) || {}).name) + '</td><td class="num"><b>' + rub(o.total) + '</b></td>' +
        '<td class="num"><button class="btn sm pri" data-act="ship-open" data-id="' + o.id + '">Отгрузить</button></td></tr>'; }).join('') + '</tbody></table></div></div>' : '') +
    '<div class="row"><div class="card grow"><h2>Отгрузки за 14 дней</h2><div class="bars">' +
    days.map(([iso, v]) => '<div class="bar" title="' + ru(iso) + ': ' + rub(v) + '"><i class="' + (v ? '' : 'zero') + '" style="height:' + Math.round(v / max * 120) + 'px"></i><span>' + iso.slice(8) + '</span></div>').join('') +
    '</div></div>' +
    '<div class="card aside"><h2>Больше всех должны</h2>' + (debtors.length ? debtors.slice(0, 5).map(([c, b]) =>
      '<div class="line"><a href="#/client/' + c.id + '">' + esc(c.name) + '</a><span class="debt"><b>' + rub(-b) + '</b></span></div>').join('') : '<div class="hint">Должников нет</div>') + '</div></div>' +
    instDueCard() +
    '<div class="card"><h2>Последние заказы</h2>' + (recent.length ? '<div class="scroll"><table class="t"><thead><tr><th>№</th><th>Дата</th><th>Клиент</th><th>Статус</th><th class="num">Сумма</th></tr></thead><tbody>' +
      recent.map(o => '<tr class="click" data-act="go" data-to="#/sale/' + o.id + '"><td>' + o.no + '</td><td>' + ru(o.shipDate || o.date) + '</td><td>' + esc((client(o.clientId) || {}).name) + '</td><td>' + statusTag(o) + '</td><td class="num"><b>' + rub(o.total) + '</b></td></tr>').join('') +
      '</tbody></table></div>' : '<div class="empty">Пока нет заказов</div>') + '</div>' +
    '<div class="quick">' + [['order', 'Оформить заказ', 'корзина и накладная'], ['sales', 'Продажи', 'все накладные'], ['catalog', 'Товары', 'папки и цены'], ['clients', 'Клиенты и баланс', 'долги и балансы'],
      ['drivers', 'Деньги у водителей', 'ожидаемые оплаты'], ['payments', 'Оплаты', 'приём денег'], ['reports', 'Отчёты', 'по клиентам и товарам'], ['data', 'Данные и копии', 'резервные копии']]
      .map(([k, l, s]) => '<a href="#/' + k + '">' + l + '<span>' + s + '</span></a>').join('') + '</div>';
};
/* на главной: платежи по рассрочке — просроченные и на ближайшие 7 дней */
function instDueCard() {
  const wk = isoOf(addD(D0(), 7)), rows = [];
  DB.installments.forEach(s => instCalc(s).rows.forEach(r => { if (r.st !== 'paid' && r.date <= wk) rows.push([s, r]); }));
  if (!rows.length) return '';
  rows.sort((a, b) => a[1].date.localeCompare(b[1].date));
  return '<div class="card"><h2>Рассрочка: платежи на неделю</h2><table class="t"><tbody>' + rows.slice(0, 10).map(([s, r]) =>
    '<tr class="click" data-act="go" data-to="#/ins/' + s.id + '"><td class="c-client">' + esc(s.buyer.name) + '<div class="hint">' + esc(s.buyer.phone || '') + '</div></td>' +
    '<td>' + (r.st === 'late' ? st('unpaid', 'просрочен ' + ru(r.date)) : r.date === todayISO() ? st('part', 'сегодня') : ru(r.date)) + '</td>' +
    '<td class="num amount">' + rub(r.amount - r.paid) + '</td><td class="num"><button class="btn sm pri" data-act="ipay-new" data-id="' + s.id + '">Принять</button></td></tr>').join('') +
    '</tbody></table></div>';
}
const tile = (l, v, h) => '<div class="card tile"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="h">' + h + '</div></div>';

/* ================= КОРЗИНА (оформить заказ) ================= */
function cartHtml() {
  const C = DB.cart;
  if (!C.groups.length) return '<div class="empty">Нажмите «+ Новая группа (шкаф)»</div>';
  return C.groups.map((G, g) => {
    let h = '<div class="gbox' + (g === C.cur ? ' cur' : '') + '" data-act="gsel" data-g="' + g + '"><div class="ghead"><input class="inp" data-ch="gtitle" data-g="' + g + '" value="' + esc(G.t) + '" aria-label="Название группы">' +
      (g === C.cur ? '<span class="cur-tag">ТЕКУЩАЯ</span>' : '') + '<span class="gsum">' + rub(gsum(G)) + '</span>' +
      (G.items.length ? '<button class="btn sm" data-act="tpl-save" data-g="' + g + '" title="Сохранить этот шкаф как шаблон">В шаблоны</button>' : '') + '<button class="x" data-act="gdel" data-g="' + g + '" aria-label="Удалить группу">×</button></div><table class="gt">';
    if (!G.items.length) h += '<tr><td class="hint">Нажимайте товары в каталоге справа — они добавятся сюда</td></tr>';
    G.items.forEach((it, i) => {
      // перетаскивание только за ручку ⠿ — чтобы правка цены мышкой не таскала строку
      h += '<tr data-drag="' + g + '|' + i + '"><td><div class="nmrow"><span class="handle" data-grip title="Потяните, чтобы поменять порядок или перенести в другой шкаф" aria-hidden="true">⠿</span><span>' + esc(it.n) + '</span></div></td>' +
        '<td style="white-space:nowrap;width:120px"><button class="qb" data-act="qty" data-g="' + g + '" data-i="' + i + '" data-d="-1" aria-label="Меньше">−</button> <b style="display:inline-block;min-width:22px;text-align:center">' + it.q + '</b> <button class="qb" data-act="qty" data-g="' + g + '" data-i="' + i + '" data-d="1" aria-label="Больше">+</button></td>' +
        '<td class="num" style="width:110px"><input class="inp pin" data-ch="price" data-g="' + g + '" data-i="' + i + '" value="' + fmt(it.p) + '" aria-label="Цена"></td>' +
        '<td class="num" style="width:92px">' + (it.p ? rub(it.q * it.p) : '<span class="muted">входит</span>') + '</td>' +
        '<td style="width:72px;white-space:nowrap"><button class="x" style="color:var(--ink2)" data-act="rep-open" data-g="' + g + '" data-i="' + i + '" aria-label="Заменить на другой товар" title="Заменить (например, зеркало на дверь)">⇄</button>' +
        '<button class="x" data-act="idel" data-g="' + g + '" data-i="' + i + '" aria-label="Убрать">×</button></td></tr>';
    });
    return h + '</table>' + asstHtml(G, g) + '</div>';
  }).join('');
}
function catalogPicker() {
  let list = '', head = '';
  if (UI.q) {
    const q = UI.q.toLowerCase(); let cnt = 0; head = 'Найдено по «' + esc(UI.q) + '»';
    for (const id in NODES) {
      NODES[id].it.forEach((it, i) => {
        if (cnt < 80 && it[0].toLowerCase().includes(q)) { cnt++; list += '<div class="it" data-act="add" data-id="' + id + '" data-i="' + i + '"><span>' + esc(it[0]) + '<div class="hint">' + esc(NODES[id].n) + '</div></span><span class="pr">' + priceHtml(it[1]) + '</span></div>'; }
      });
    }
    if (!cnt) list = '<div class="empty">Ничего не найдено</div>';
  } else {
    const n = UI.selOrder; head = n ? esc(n.n) : 'Выберите папку';
    // товары папки и всех её подпапок; у вложенных — подпись, из какой подпапки
    if (n) (deepOn() ? itemsDeep(n) : orderIdx(n).map(i => [n, i])).forEach(([nd, i]) => {
      const it = nd.it[i];
      list += '<div class="it" data-act="add" data-id="' + nd.id + '" data-i="' + i + '"><span>' + esc(it[0]) + (nd !== n ? '<div class="hint">' + esc(relPath(nd, n)) + '</div>' : '') + '</span><span class="pr">' + priceHtml(it[1]) + '</span></div>';
    });
    if (!list) list = '<div class="empty">' + (n ? 'В этой папке нет товаров' : '') + '</div>';
  }
  // каталог на всю высоту экрана: дерево сверху, товары снизу
  return '<div class="card picker"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px"><h2 style="margin:0">Каталог товаров</h2>' +
    '<span class="btns" style="gap:6px"><button class="btn sm" data-act="f-collapse" title="Свернуть все папки">Свернуть все</button><button class="btn sm" data-act="f-expand" title="Развернуть все папки">Развернуть все</button></span></div><input class="inp" id="cat-q" data-in="q" placeholder="Поиск по всем папкам…" value="' + esc(UI.q) + '" style="margin-bottom:10px">' +
    '<div class="box ptree" data-ks="otree" style="padding:4px">' + treeHtml(DB.cat, 0, 'o') + '</div>' +
    '<div style="font-weight:700;margin:12px 0 6px" id="list-h">' + head + '</div><div class="box plist" data-ks="olist" id="cat-list">' + list + '</div>' +
    '<div class="hint" style="margin-top:8px">Нажмите на товар — он добавится в текущую группу.</div></div>';
}
VIEWS.order = () => {
  if (UI.selOrder && NODES[UI.selOrder.id] !== UI.selOrder) UI.selOrder = null;
  const tot = orderTotal(DB.cart.groups), cc = cartCount();
  const ed = DB.cart.editId ? order(DB.cart.editId) : null;
  if (DB.cart.editId && (!ed || ed.status !== 'ordered')) delete DB.cart.editId;
  return (ed && DB.cart.editId ? '<div class="warn"><span><b>Изменение заказа № ' + ed.no + '.</b> Поменяйте товары и нажмите «Оформить заказ →», чтобы сохранить.</span><button class="btn sm" data-act="edit-cancel">Отменить изменение</button></div>' : '') +
    '<div class="head"><div><div class="crumb">Оформить заказ · шаг 1 из 2</div><h1>Корзина</h1>' +
    (cc ? '<div class="sub-h">' + DB.cart.groups.filter(g => g.items.length).length + ' шк. · ' + cc + ' поз. · <b>' + rub(tot) + '</b></div>' : '<div class="sub-h">Выберите товары в каталоге справа или шаблон</div>') + '</div>' +
    // одна главная кнопка; редкие действия — в меню «Ещё»
    (cc ? '<div class="btns" style="position:relative"><button class="btn" data-act="cart-menu" aria-haspopup="true" aria-expanded="' + (UI.cartMenu ? 'true' : 'false') + '">Ещё <span aria-hidden="true" style="font-size:11px">▼</span></button>' +
      (UI.cartMenu ? '<div class="menu" role="menu" style="min-width:270px"><button role="menuitem" data-act="to-inst"' + (DB.cart.editId ? ' disabled' : '') + '>Оформить в рассрочку (розница)</button>' +
        '<div class="msep"></div><button role="menuitem" class="mdanger" data-act="cart-clear">Очистить корзину</button></div>' : '') +
      '<button class="btn pri" data-act="to-checkout">Оформить заказ →</button></div>' : '') + '</div>' +
    '<div class="row"><div class="grow">' + templatesCard() + '<div class="card">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px"><h2 style="margin:0">Товары в заказе</h2><button class="btn dash" data-act="gnew">+ Новая группа (шкаф)</button></div>' +
    '<div class="hint" style="margin-bottom:12px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>Синяя группа — текущая. Чтобы поменять порядок или перенести строку в другой шкаф, тяните её за значок ⠿ слева.</span>' +
    '<button class="btn sm" data-act="as-toggle" title="Подсказки по составу шкафа">✦ Помощник: ' + (asstOn() ? 'вкл' : 'выкл') + '</button></div>' +
    cartHtml() + (cc ? '<div class="cart-foot"><div><div class="muted">Итого</div><div class="sum">' + rub(tot) + '</div></div><button class="btn pri big" data-act="to-checkout">Оформить заказ →</button></div>' : '') + '</div></div>' +
    '<div class="aside" style="flex-basis:440px">' + catalogPicker() + '</div></div>';
};

/* ================= ОФОРМЛЕНИЕ ================= */
function topClients(n) {
  const cnt = {}; DB.orders.filter(o => o.status !== 'cancelled').forEach(o => { cnt[o.clientId] = (cnt[o.clientId] || 0) + 1; });
  return DB.clients.slice().sort((a, b) => (cnt[b.id] || 0) - (cnt[a.id] || 0) || a.name.localeCompare(b.name)).slice(0, n).map(c => [c, cnt[c.id] || 0]);
}
function ddHtml(q) {
  q = (q || '').trim().toLowerCase();
  if (!q) return '';
  const m = DB.clients.filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)).slice(0, 8);
  return '<div class="dd">' + m.map(c => '<button data-act="ck-pick" data-id="' + c.id + '"><span>' + esc(c.name) + (c.phone ? ' <span class="muted">' + esc(c.phone) + '</span>' : '') + '</span>' + balTag(balance(c.id)) + '</button>').join('') +
    '<button class="new" data-act="client-new" data-name="' + esc(q === '' ? '' : $('#ck-q') ? $('#ck-q').value.trim() : '') + '">+ Создать нового клиента «' + esc($('#ck-q') ? $('#ck-q').value.trim() : q) + '»</button></div>';
}
VIEWS.checkout = () => {
  if (!cartCount()) return '<div class="head"><h1>Оформление</h1></div><div class="card empty">Корзина пуста. <a href="#/order">Выбрать товары</a></div>';
  const ed = DB.cart.editId ? order(DB.cart.editId) : null;
  const ck = UI.ck || (UI.ck = ed ? { clientId: ed.clientId, date: ed.date, pay: 'none', amount: '' } : { clientId: null, date: todayISO(), pay: 'none', amount: '' });
  const c = ck.clientId ? client(ck.clientId) : null, tot = orderTotal(DB.cart.groups);
  const now = c ? balance(c.id) : 0, pre = ck.pay === 'none' ? 0 : num(ck.amount), after = now + pre - tot;
  const tops = topClients(10);
  return '<div class="head"><div><div class="crumb">Оформить заказ · шаг 2 из 2</div><h1>' + (ed ? 'Изменение заказа № ' + ed.no : 'Оформление заказа') + '</h1></div><div class="btns"><a class="btn" href="#/order">← Назад в корзину</a>' +
    '<button class="btn pri big" data-act="post"' + (c ? '' : ' disabled') + '>' + (ed ? 'Сохранить изменения' : 'Оформить заказ') + '</button></div></div>' +
    '<div class="row"><div class="grow"><div class="card"><h2>Клиент</h2>' +
    (c ? '<div class="picked"><div><b style="font-size:16px">' + esc(c.name) + '</b>' + (c.phone ? '<div class="hint">' + esc(c.phone) + '</div>' : '') + '</div><div class="btns">' + balTag(now) + '<button class="btn sm" data-act="ck-change">Другой клиент</button></div></div>'
      : '<div class="ac"><input class="inp" id="ck-q" data-in="ck-q" placeholder="Начните вводить имя клиента или телефон…" autocomplete="off"><div id="ck-dd"></div></div>' +
      (tops.length ? '<div class="hint" style="margin:12px 0 6px">Частые клиенты</div><div class="chips">' + tops.map(([x, n]) => '<button class="chip" data-act="ck-pick" data-id="' + x.id + '">' + esc(x.name) + (n ? '<small>' + n + '</small>' : '') + '</button>').join('') + '</div>' : '<div class="hint" style="margin-top:10px">Клиентов пока нет — введите имя и нажмите «Создать нового клиента».</div>') +
      '<div style="margin-top:12px"><button class="btn sm dash" data-act="client-new">+ Новый клиент</button></div>') +
    '</div><div class="card"><h2>Заказ</h2><div class="form">' +
    '<label class="fld">Номер (автоматически)<input class="inp" value="' + (ed ? ed.no : DB.nextNo) + '" disabled></label>' +
    '<label class="fld">Дата заказа<input class="inp" type="date" data-ch="ck-date" value="' + ck.date + '"></label></div></div>' +
    '<div class="card"><h2>Предоплата</h2><div class="opt">' +
    [['none', 'Без предоплаты'], ['cash', 'Наличные'], ['transfer', 'Перевод']].map(([k, l]) => '<button class="chip' + (ck.pay === k ? ' on' : '') + '" data-act="ck-pay" data-v="' + k + '">' + l + '</button>').join('') + '</div>' +
    (ck.pay === 'none' ? '' : '<label class="fld" style="margin-top:12px;max-width:260px">Сумма, ₽<input class="inp" data-ch="ck-amount" value="' + esc(ck.amount) + '" placeholder="' + fmt(tot) + '"></label>') +
    '<div class="hint" style="margin-top:10px">Предоплата сразу зачтётся клиенту. Оплату при отгрузке и «деньги передаст водитель» укажете, когда нажмёте «Отгрузить».</div></div></div>' +
    '<div class="aside"><div class="card"><h2>Состав</h2>' + DB.cart.groups.filter(g => g.items.length).map(g => '<div class="line"><span>' + esc(g.t) + ' <span class="muted">· ' + g.items.length + ' поз.</span></span><b>' + rub(gsum(g)) + '</b></div>').join('') +
    '<div class="line tot"><span>Итого</span><span>' + rub(tot) + '</span></div></div>' +
    '<div class="card"><h2>Баланс клиента</h2>' + (c ?
      '<div class="line"><span class="muted">Сейчас</span><span>' + balTxt(now) + '</span></div>' +
      (pre ? '<div class="line"><span class="muted">Предоплата</span><span>+' + rub(pre) + '</span></div>' : '') +
      '<div class="line"><span class="muted">Заказ (спишется при отгрузке)</span><span>−' + rub(tot) + '</span></div>' +
      '<div class="line tot ' + (after > 0 ? 'adv' : after < 0 ? 'debt' : '') + '"><span>После отгрузки</span><span>' + balTxt(after) + '</span></div>' : '<div class="hint">Выберите клиента</div>') + '</div>' +
    '<div class="card"><h2>Что будет дальше</h2><div class="hint" style="font-size:13px">Заказ получит статус <span class="tag b">Оформлен</span> — баланс клиента не изменится. Можно распечатать лист погрузки. Когда машина загрузится — нажмите «Отгрузить»: сумма спишется с баланса.</div></div>' +
    '</div></div>';
};

/* ================= ПРОДАЖИ ================= */
VIEWS.sales = () => {
  const q = UI.salesQ.toLowerCase(), sf = UI.salesStatus || 'all', pf = UI.salesPay || 'all', PM = payMap(), sel = UI.salesSel || (UI.salesSel = {});
  const list = DB.orders.filter(o => (o.status === 'ordered' || inRange(o.shipDate || o.date, UI.salesRange)) && (sf === 'all' || o.status === sf) &&
    (pf === 'all' || (pf === 'unpaid' && o.status === 'shipped' && remaining(o, PM[o.id]) > 0) || (pf === 'paid' && o.status === 'shipped' && !remaining(o, PM[o.id]))) &&
    (!q || String(o.no) === q || ((client(o.clientId) || {}).name || '').toLowerCase().includes(q)))
    .sort((a, b) => (a.status === 'ordered' ? 0 : 1) - (b.status === 'ordered' ? 0 : 1) || (b.shipDate || b.date).localeCompare(a.shipDate || a.date) || b.no - a.no);
  Object.keys(sel).forEach(id => { if (!order(id)) delete sel[id]; });
  const chosen = Object.keys(sel).map(order), payable = chosen.filter(o => o.status !== 'cancelled' && remaining(o, PM[o.id]) > 0);
  const allOn = list.length && list.every(o => sel[o.id]);
  const sh = list.filter(o => o.status === 'shipped'), wt = list.filter(o => o.status === 'ordered');
  const sum = sh.reduce((s, o) => s + o.total, 0), debtSum = sh.reduce((s, o) => s + remaining(o, PM[o.id]), 0);
  const nWait = waitingOrders().length;
  return '<div class="head"><div><h1>Продажи</h1><div class="sub-h">Заказы и накладные. Отметьте строки галочками, чтобы оплатить или удалить несколько сразу.</div></div><a class="btn pri" href="#/order">Оформить заказ</a></div>' +
    '<div class="card"><div class="filters">' +
    '<div class="fgroup"><span>Период</span>' + rangeButton(UI.salesRange, 'range-open') + '</div>' +
    '<div class="fgroup"><span>Статус</span>' + seg(sf, 'sales-status', [['all', 'Все'], ['ordered', 'Ждут отгрузки', nWait], ['shipped', 'Отгружены'], ['cancelled', 'Отменены']]) + '</div>' +
    '<div class="fgroup"><span>Оплата</span>' + seg(pf, 'sales-pay', [['all', 'Любая'], ['unpaid', 'Не оплачены'], ['paid', 'Оплачены']]) + '</div>' +
    '<label class="search"><span class="sr" style="position:absolute;left:-9999px">Поиск</span>' + icon('search', 16) + '<input class="inp" data-in="sales-q" id="sales-q" placeholder="Клиент или номер" value="' + esc(UI.salesQ) + '"></label>' +
    '</div></div>' +
    '<div class="kpis">' +
    '<div class="kpi"><div class="l">Отгружено</div><div class="v">' + rub(sum) + '</div><div class="h">' + sh.length + ' ' + plural(sh.length, 'накладная', 'накладные', 'накладных') + '</div></div>' +
    '<div class="kpi"><div class="l">Оплачено</div><div class="v adv">' + rub(sum - debtSum) + '</div><div class="h">по этим накладным</div></div>' +
    '<div class="kpi"><div class="l">Не оплачено</div><div class="v debt">' + rub(debtSum) + '</div><div class="h">' + sh.filter(o => remaining(o, PM[o.id]) > 0).length + ' с долгом</div></div>' +
    '<div class="kpi"><div class="l">Ждут отгрузки</div><div class="v">' + rub(wt.reduce((s, o) => s + o.total, 0)) + '</div><div class="h">' + wt.length + ' ' + plural(wt.length, 'заказ', 'заказа', 'заказов') + '</div></div>' +
    '</div>' +
    '<div class="card tcard">' + (list.length ? '<div class="scroll"><table class="t" style="min-width:860px"><thead><tr>' +
      '<th class="cbcell"><input type="checkbox" class="cb" data-ch="ssel-all"' + (allOn ? ' checked' : '') + ' aria-label="Выбрать все в списке"></th>' +
      '<th>№</th><th>Дата</th><th>Клиент</th><th>Статус</th><th>Оплата</th><th class="num">Сумма</th><th class="num">Остаток</th></tr></thead><tbody>' +
      list.map(o => {
        const m = PM[o.id], dd = o.status === 'ordered' ? daysSince(o.date) : 0, rest = o.status === 'shipped' ? remaining(o, m) : 0;
        return '<tr class="click' + (sel[o.id] ? ' sel' : '') + (o.status === 'cancelled' ? ' dim' : '') + '" data-act="go" data-to="#/sale/' + o.id + '">' +
          '<td class="cbcell"><input type="checkbox" class="cb" data-ch="ssel" data-id="' + o.id + '"' + (sel[o.id] ? ' checked' : '') + ' aria-label="Выбрать № ' + o.no + '"></td>' +
          '<td class="c-no">' + o.no + '</td><td>' + ru(o.shipDate || o.date) + '</td><td class="c-client">' + esc((client(o.clientId) || {}).name) + '</td>' +
          '<td>' + statusTag(o) + (dd > LATE_DAYS ? ' ' + st('unpaid', dd + ' дн.') : '') + '</td><td>' + payLabel(o, m) + '</td>' +
          '<td class="num amount"' + (o.status === 'cancelled' ? ' style="text-decoration:line-through"' : '') + '>' + rub(o.total) + '</td>' +
          '<td class="num">' + (rest ? '<span class="rest">' + rub(rest) + '</span>' : '<span class="muted">—</span>') + '</td></tr>';
      }).join('') + '</tbody><tfoot><tr><td></td><td colspan="5">Итого отгружено за период</td><td class="num">' + rub(sum) + '</td><td class="num">' + (debtSum ? '<span class="rest">' + rub(debtSum) + '</span>' : '—') + '</td></tr></tfoot></table></div>'
      : '<div class="empty">Заказов по этим условиям нет</div>') + '</div>' +
    (chosen.length ? '<div class="bulkbar" role="region" aria-label="Действия с выбранными"><span>Выбрано <b>' + chosen.length + '</b>' +
      (payable.length ? ' · к оплате <b>' + rub(payable.reduce((s, o) => s + remaining(o, PM[o.id]), 0)) + '</b>' : '') + '</span>' +
      '<button class="btn sm" data-act="sel-clear">Снять</button>' +
      '<button class="btn sm pri" data-act="bulk-open"' + (payable.length ? '' : ' disabled') + '>Отметить оплаченными</button>' +
      '<button class="btn sm danger" data-act="bulk-del">Удалить</button></div>' : '');
};

/* окно «Отметить оплаченными» — для одной или нескольких накладных */
function bulkForm() {
  const B = UI.bulk, PM = payMap(), orders = B.ids.map(order).filter(Boolean).sort((a, b) => (a.shipDate || a.date).localeCompare(b.shipDate || b.date) || a.no - b.no);
  const clients = [...new Set(orders.map(o => o.clientId))], need = orders.reduce((s, o) => s + remaining(o, PM[o.id]), 0), one = clients.length === 1;
  const amt = one && B.amount !== '' ? num(B.amount) : need;
  modal('<h2 style="margin:0">Оплата накладных</h2>' +
    '<div style="max-height:220px;overflow:auto">' + orders.map(o => '<div class="line"><span>№ ' + o.no + ' от ' + ru(o.shipDate || o.date) + (one ? '' : ' · ' + esc((client(o.clientId) || {}).name)) + '</span><b>' + rub(remaining(o, PM[o.id])) + '</b></div>').join('') + '</div>' +
    '<div class="line tot"><span>К оплате</span><span>' + rub(need) + '</span></div>' +
    '<div class="fld">Как оплатили</div>' + seg(B.method, 'bulk-method', [['transfer', 'Перевод'], ['cash', 'Наличные'], ['goods', 'Товаром'], ['driver', 'Через водителя']]) +
    (B.method === 'goods' ? (one ? goodsFields('b') : '<div class="warn">Оплату товаром отмечайте по одному клиенту.</div>') : '') +
    '<div class="form"><label class="fld">Дата оплаты<input class="inp" type="date" id="b-date" value="' + B.date + '"></label>' +
    (one ? '<label class="fld">Сумма, ₽<input class="inp" id="b-amount" data-in="bulk-amt" value="' + (B.method === 'goods' ? esc(B.amount) : B.amount === '' ? fmt(need) : esc(B.amount)) + '"></label>' : '') + '</div>' +
    '<div class="hint" id="b-hint">' + bulkHint(amt, need, one) + (B.method === 'driver' ? ' Деньги попадут в «Деньги у водителей».' : '') + '</div>' +
    '<div class="btns" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="bulk-save">Отметить оплаченными</button></div>');
}
function bulkHint(amt, need, one) {
  if (!one) return 'Для каждого клиента будет записана отдельная оплата на сумму его накладных.';
  if (amt > need) return 'Сумма больше долга по накладным — остаток ' + rub(amt - need) + ' останется у клиента на балансе.';
  if (amt < need) return 'Сумма меньше — накладные закроются от старых к новым, последняя будет оплачена частично.';
  return 'Все выбранные накладные будут отмечены оплаченными.';
}
function readBulk() { if ($('#b-date')) UI.bulk.date = $('#b-date').value; if ($('#b-amount')) UI.bulk.amount = $('#b-amount').value; if ($('#b-what')) UI.bulk.g = readGoods('b'); }

/* ================= УДАЛЁННЫЕ: всё, что удаляется, с восстановлением ================= */
const TRASH_KINDS = [['order', 'Заказы'], ['client', 'Клиенты'], ['payment', 'Оплаты'], ['item', 'Товары'], ['folder', 'Папки'], ['template', 'Шаблоны'], ['inst', 'Рассрочки']];
const kindOf = t => t.kind || 'order';
function trashPush(kind, data, label, extra) {
  const t = Object.assign({ id: uid(), kind, data, label, deletedAt: Date.now() }, extra || {});
  DB.trash.unshift(t); return t;
}
/* путь папки по названиям — чтобы вернуть товар/папку на место, даже если номера папок изменились */
function pathOf(node) {
  const names = []; let id = node.id;
  while (id !== undefined && id !== '') { names.unshift(NODES[id].n); const k = id.lastIndexOf('-'); id = k < 0 ? '' : id.slice(0, k); }
  return names;
}
function folderByPath(path) {
  let list = DB.cat, node = null;
  path.forEach(name => {
    node = list.find(x => x.n === name);
    if (!node) { node = { n: name, ch: [], it: [] }; list.push(node); }
    list = node.ch;
  });
  return node;
}
function trashOrders(ids) {
  const items = [];
  ids.forEach(id => {
    const o = order(id); if (!o) return;
    const own = DB.payments.filter(p => p.orderId === o.id), allocs = [];
    DB.payments.forEach(p => {
      if (!p.alloc) return;
      const a = p.alloc.filter(x => x.orderId === o.id);
      if (a.length) { allocs.push({ pid: p.id, alloc: a }); p.alloc = p.alloc.filter(x => x.orderId !== o.id); }
    });
    DB.payments = DB.payments.filter(p => p.orderId !== o.id);
    DB.orders = DB.orders.filter(x => x !== o);
    if (DB.cart.editId === o.id) delete DB.cart.editId;
    items.push(trashPush('order', null, 'Заказ № ' + o.no, { order: o, payments: own, allocs }));
  });
  return items;
}
function restoreTrash(tids) {
  // папки — первыми, чтобы товары легли в них, а не в созданные заново
  tids = tids.slice().sort((a, b) => (kindOf(DB.trash.find(x => x.id === a) || {}) === 'folder' ? 0 : 1) - (kindOf(DB.trash.find(x => x.id === b) || {}) === 'folder' ? 0 : 1));
  tids.forEach(tid => {
    const t = DB.trash.find(x => x.id === tid); if (!t) return;
    const k = kindOf(t);
    if (k === 'order') {
      DB.orders.push(t.order); DB.payments.push(...t.payments);
      t.allocs.forEach(a => { const p = DB.payments.find(x => x.id === a.pid); if (p && p.alloc) p.alloc.push(...a.alloc); });
    } else if (k === 'client') DB.clients.push(t.data);
    else if (k === 'payment') DB.payments.push(t.data);
    else if (k === 'template') DB.templates.push(t.data);
    else if (k === 'inst') DB.installments.push(t.data);
    else if (k === 'item') { const f = folderByPath(t.path); if (f) f.it.push(t.data); else DB.cat.push({ n: 'Восстановленные', ch: [], it: [t.data] }); }
    else if (k === 'folder') {
      const list = t.path.length ? folderByPath(t.path).ch : DB.cat, same = list.find(x => x.n === t.data.n);
      if (same) { same.it.push(...t.data.it); same.ch.push(...t.data.ch); } else list.push(t.data); // склеиваем с одноимённой
    }
    DB.trash = DB.trash.filter(x => x !== t);
  });
}
function undoToast(msg, items) {
  toast(msg, { label: 'Отменить', fn: () => { restoreTrash(items.map(i => i.id)); commit(); toast('Восстановлено'); } });
}
function deleteWithUndo(ids) {
  const items = trashOrders(ids); UI.salesSel = {}; commit();
  undoToast('Удалено: ' + items.length + ' ' + plural(items.length, 'заказ', 'заказа', 'заказов'), items);
}
function trashDetails(t) {
  const k = kindOf(t);
  if (k === 'order') return [t.label || 'Заказ № ' + t.order.no, esc((client(t.order.clientId) || {}).name) + ' · ' + STATUS[t.order.status], rub(t.order.total)];
  if (k === 'client') return [esc(t.data.name), esc(t.data.phone || ''), t.data.opening ? balTxt(t.data.opening) + ' на начало' : ''];
  if (k === 'payment') return ['Оплата, ' + METHOD[t.data.method], esc((client(t.data.clientId) || {}).name || '—') + ' · ' + ru(payDate(t.data)), rub(t.data.amount)];
  if (k === 'item') return [esc(t.data[0]), esc(t.path.join(' / ')), t.data[1] === null ? '' : t.data[1] ? rub(t.data[1]) : 'входит'];
  if (k === 'folder') return [esc(t.label), t.path.length ? 'в папке ' + esc(t.path.join(' / ')) : 'верхний уровень', ''];
  if (k === 'inst') return [t.label, esc(t.data.buyer.name), rub(t.data.total)];
  return ['Шаблон «' + esc(t.data.t) + '»', t.data.items.length + ' поз.', rub(gsum(t.data))];
}
VIEWS.trash = () => {
  const f = UI.trashKind || 'all', T = DB.trash.filter(t => f === 'all' || kindOf(t) === f);
  const cnt = k => DB.trash.filter(t => kindOf(t) === k).length;
  const opts = [['all', 'Всё', DB.trash.length]].concat(TRASH_KINDS.filter(([k]) => cnt(k)).map(([k, l]) => [k, l, cnt(k)]));
  const nameOf = k => (TRASH_KINDS.find(x => x[0] === k) || [k, k])[1];
  return '<div class="head"><div><h1>Удалённые</h1><div class="sub-h">Всё удалённое хранится здесь, пока вы не удалите навсегда: заказы, клиенты, оплаты, товары, папки, шаблоны. Восстанавливается на прежнее место.</div></div>' +
    (T.length ? '<div class="head-actions"><button class="btn pri" data-act="trash-restore-all">Восстановить ' + (f === 'all' ? 'всё' : 'все: ' + nameOf(f).toLowerCase()) + '</button>' +
      '<button class="btn danger-solid" data-act="trash-empty">Очистить ' + (f === 'all' ? 'всё' : nameOf(f).toLowerCase()) + '</button></div>' : '') + '</div>' +
    (DB.trash.length ? '<div class="card"><div class="fgroup"><span>Категория</span>' + seg(f, 'trash-kind', opts) + '</div></div>' : '') +
    '<div class="card tcard">' + (T.length ? '<div class="scroll"><table class="t" style="min-width:760px"><thead><tr><th>Удалено</th><th>Что</th><th>Подробности</th><th class="num">Сумма</th><th></th></tr></thead><tbody>' +
      T.map(t => { const [a, b, c] = trashDetails(t); return '<tr><td style="white-space:nowrap">' + ru(isoOf(new Date(t.deletedAt))) + '<div class="hint">' + nameOf(kindOf(t)) + '</div></td><td class="c-client">' + a + '</td><td class="muted">' + b + '</td>' +
        '<td class="num amount">' + c + '</td><td class="num"><span class="btns" style="justify-content:flex-end"><button class="btn sm pri" data-act="trash-restore" data-id="' + t.id + '">Восстановить</button>' +
        '<button class="btn sm danger" data-act="trash-kill" data-id="' + t.id + '">Удалить навсегда</button></span></td></tr>'; }).join('') + '</tbody></table></div>'
      : '<div class="empty">Здесь пусто</div>') + '</div>';
};
function groupsTable(o) {
  return o.groups.map((g, gi) => '<div class="gbox" style="cursor:default"><div class="ghead"><b style="flex:1">' + (gi + 1) + '. ' + esc(g.t) + '</b><span class="gsum">' + rub(gsum(g)) + '</span></div><table class="gt">' +
    g.items.map(it => '<tr><td>' + esc(it.n) + '</td><td class="num" style="width:70px">' + it.q + ' шт</td><td class="num" style="width:100px">' + (it.p ? rub(it.p) : '<span class="muted">входит</span>') + '</td><td class="num" style="width:100px">' + (it.p ? rub(it.q * it.p) : '') + '</td></tr>').join('') + '</table></div>').join('');
}
VIEWS.sale = ([id]) => {
  const o = order(id);
  if (!o) return '<div class="card empty">Заказ не найден. <a href="#/sales">К продажам</a></div>';
  const c = client(o.clientId) || { name: '—' }, b = orderBalance(o), m = payMap()[o.id];
  const ps = DB.payments.map(p => [p, allocsOf(p).find(a => a.orderId === o.id)]).filter(x => x[1]);
  const payBtn = o.status !== 'cancelled' && remaining(o, m) > 0 ? '<button class="btn" data-act="order-pay" data-id="' + o.id + '">Отметить оплату</button>' : '';
  const jd = UI.justDone && UI.justDone.id === o.id ? UI.justDone.kind : null; UI.justDone = null;
  const msg = {
    ordered: '<b>Заказ оформлен.</b> Баланс клиента пока не изменился. Распечатайте лист погрузки; когда машина загрузится — нажмите «Отгрузить».',
    edited: '<b>Изменения сохранены.</b>',
    shipped: '<b>Заказ отгружен.</b> Сумма списана с баланса клиента — распечатайте накладную клиенту.'
  }[jd];
  const dd = o.status === 'ordered' ? daysSince(o.date) : 0;
  let btns;
  if (o.status === 'ordered') btns = '<button class="btn pri big" data-act="ship-open" data-id="' + o.id + '">Отгрузить</button><a class="btn" href="#/print/l/' + o.id + '">Печать: грузчику</a><a class="btn" href="#/print/c/' + o.id + '">Печать: заказ клиенту</a>' + waBtn(o) + '<a class="btn" href="#/labels/' + o.id + '">Этикетки на коробки</a>' +
    payBtn + '<button class="btn" data-act="order-edit" data-id="' + o.id + '">Изменить</button><button class="btn danger" data-act="order-cancel" data-id="' + o.id + '">Отменить заказ</button><span class="sep" style="width:1px;height:28px;background:var(--line)"></span><button class="btn danger" data-act="order-del" data-id="' + o.id + '">Удалить</button>';
  else if (o.status === 'shipped') btns = '<a class="btn pri" href="#/print/c/' + o.id + '">Печать: клиенту</a><a class="btn pri" href="#/print/l/' + o.id + '">Печать: грузчику</a>' + '<a class="btn" href="#/labels/' + o.id + '">Этикетки на коробки</a>' + waBtn(o) + payBtn +
    '<button class="btn" data-act="repeat" data-id="' + o.id + '">Повторить в корзину</button><button class="btn danger" data-act="unship" data-id="' + o.id + '">Отменить отгрузку</button><span class="sep" style="width:1px;height:28px;background:var(--line)"></span><button class="btn danger" data-act="order-del" data-id="' + o.id + '">Удалить</button>';
  else btns = '<button class="btn pri" data-act="order-restore" data-id="' + o.id + '">Вернуть в работу</button><button class="btn" data-act="repeat" data-id="' + o.id + '">Повторить в корзину</button><button class="btn danger" data-act="order-del" data-id="' + o.id + '">Удалить</button>';
  let calc;
  if (o.status === 'shipped') calc = '<div class="line"><span class="muted">Баланс до отгрузки</span><span>' + balTxt(b.before) + '</span></div>' +
    '<div class="line"><span class="muted">Сумма накладной</span><span>−' + rub(o.total) + '</span></div>' +
    '<div class="line"><span class="muted">Оплачено при отгрузке</span><span>' + (b.paidNow ? '+' + rub(b.paidNow) : '0 ₽') + '</span></div>' +
    (b.waiting ? '<div class="line"><span class="muted">Ждём от водителя</span><span class="tag w">' + rub(b.waiting) + '</span></div>' : '') +
    '<div class="line tot"><span>Баланс после</span><span class="' + (b.after > 0 ? 'adv' : b.after < 0 ? 'debt' : '') + '">' + balTxt(b.after) + '</span></div>';
  else if (o.status === 'ordered') calc = '<div class="line"><span class="muted">Баланс сейчас</span><span>' + balTxt(balance(o.clientId)) + '</span></div>' +
    '<div class="line"><span class="muted">Сумма заказа</span><span>−' + rub(o.total) + '</span></div>' +
    '<div class="line tot"><span>После отгрузки</span><span class="' + (b.after > 0 ? 'adv' : b.after < 0 ? 'debt' : '') + '">' + balTxt(b.after) + '</span></div>' +
    '<div class="hint">Пока заказ не отгружен, баланс клиента не меняется.</div>';
  else calc = '<div class="hint">Заказ отменён и на баланс не влияет. Предоплата по нему (если была) осталась у клиента на балансе.</div>';
  return (msg ? '<div class="warn" style="background:var(--adv-bg);color:var(--adv-ink)"><span>' + msg + '</span></div>' : '') +
    '<div class="head"><div><div class="crumb"><a href="#/sales">Продажи</a> / ' + (o.status === 'shipped' ? 'Накладная' : 'Заказ') + '</div>' +
    '<h1>' + (o.status === 'shipped' ? 'Накладная' : 'Заказ') + ' № ' + o.no + ' <span style="vertical-align:middle">' + statusTag(o) + '</span></h1>' +
    '<div style="margin-top:6px">Клиент: <a href="#/client/' + c.id + '"><b>' + esc(c.name) + '</b></a> · оформлен ' + ru(o.date) + (o.shipDate ? ' · отгружен ' + ru(o.shipDate) : '') +
    (dd > LATE_DAYS ? ' <span class="tag d">не забирают ' + dd + ' дн.</span>' : '') + '</div></div>' +
    '<div class="btns">' + btns + '</div></div>' +
    '<div class="row"><div class="card grow">' + groupsTable(o) + '<div class="line tot" style="font-size:20px"><span>Итого</span><span>' + rub(o.total) + '</span></div></div>' +
    '<div class="aside">' + stockCard(o) + '<div class="card"><h2>Расчёты</h2>' + calc + '<div class="hint" style="margin-top:8px">Баланс клиента сейчас: ' + balTxt(balance(o.clientId)) + '</div></div>' +
    (o.status !== 'cancelled' ? '<div class="card"><h2>Оплата накладной</h2><div style="margin-bottom:8px">' + payLabel(o, m) + '</div>' +
      ps.map(([p, a]) => '<div class="line"><span>' + ru(payDate(p)) + ' · ' + METHOD[p.method] + (p.atShip ? ' <span class="muted">· при отгрузке</span>' : p.alloc ? '' : ' <span class="muted">· предоплата</span>') + '</span><span class="tag ' + (p.status === 'pending' ? 'w' : 'a') + '">' + (p.status === 'pending' ? 'ждём ' : '') + rub(a.amount) + '</span></div>').join('') +
      (m.auto ? '<div class="line"><span>Закрыто оплатами клиента автоматически <span class="muted">(от старых накладных к новым)</span></span><span class="tag a">' + rub(m.auto) + '</span></div>' : '') +
      (o.status === 'shipped' && remaining(o, m) ? '<div class="line tot"><span>Осталось оплатить</span><span class="debt">' + rub(remaining(o, m)) + '</span></div>' : '') + '</div>' : '') +
    '</div></div>';
};

/* окно отгрузки */
function shipAfter() { const s = UI.ship, o = order(s.id); return balance(o.clientId) - o.total + (s.pay === 'none' || s.pay === 'driver' ? 0 : num(s.amount)); }
function shipForm() {
  const s = UI.ship, o = order(s.id), c = client(o.clientId) || { name: '—' };
  modal('<h2 style="margin:0">Отгрузка заказа № ' + o.no + '</h2><div class="hint" style="font-size:13px">Клиент <b>' + esc(c.name) + '</b> · сумма <b>' + rub(o.total) + '</b>. После отгрузки сумма спишется с баланса клиента.</div>' +
    '<label class="fld">Дата отгрузки<input class="inp" type="date" id="s-date" value="' + s.date + '"></label>' +
    '<div class="fld">Оплата при отгрузке</div><div class="opt">' + [['none', 'Без оплаты'], ['cash', 'Наличные'], ['transfer', 'Перевод'], ['driver', 'Передаст водитель']].map(([k, l]) =>
      '<button class="chip' + (s.pay === k ? ' on' : '') + '" data-act="ship-pay" data-v="' + k + '">' + l + '</button>').join('') + '</div>' +
    (s.pay === 'none' ? '' : '<label class="fld">Сумма, ₽<input class="inp" id="s-amount" data-in="ship-amt" value="' + esc(s.amount) + '" placeholder="' + fmt(o.total) + '"></label>' +
      (s.pay === 'driver' ? '<div class="hint">Сумма попадёт в «Деньги у водителей» и зачтётся, когда отметите «Получено».</div>' : '')) +
    '<div><div class="line"><span class="muted">Баланс сейчас</span><span>' + balTxt(balance(o.clientId)) + '</span></div><div class="line tot"><span>После отгрузки</span><span id="s-after">' + balTxt(shipAfter()) + '</span></div></div>' +
    '<div class="btns" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="ship-do">Отгрузить</button></div>');
}
function readShip() { if ($('#s-date')) UI.ship.date = $('#s-date').value; if ($('#s-amount')) UI.ship.amount = $('#s-amount').value; }

/* ================= ПЕЧАТЬ ================= */
VIEWS.print = ([kind, id]) => {
  const o = order(id);
  if (!o) return '<div class="card empty">Накладная не найдена</div>';
  const c = client(o.clientId) || { name: '—' }, b = orderBalance(o), isShip = o.status === 'shipped';
  const docName = (isShip ? 'Накладная' : 'Заказ') + ' № ' + o.no + (o.status === 'cancelled' ? ' (ОТМЕНЁН)' : ''), docDate = ru(o.shipDate || o.date);
  const bar ='<div class="btns noprint" style="justify-content:center"><a class="btn" href="#/sale/' + o.id + '">← К накладной</a><button class="btn pri" data-act="print">Распечатать</button>' + (kind === 'c' ? waBtn(o) : '') +
    '<a class="btn" href="#/print/' + (kind === 'c' ? 'l' : 'c') + '/' + o.id + '">' + (kind === 'c' ? 'Лист для грузчика' : 'Накладная клиенту') + '</a></div>';
  if (kind === 'l') {
    let rows = '';
    o.groups.forEach((g, gi) => {
      rows += '<tr class="g"><td>' + (gi + 1) + '</td><td colspan="3">' + esc(g.t) + '</td></tr>';
      g.items.forEach(it => { rows += '<tr class="c"><td></td><td class="nm">' + esc(it.n) + '</td><td class="num">' + it.q + '</td><td style="text-align:center"><span class="cbox"></span></td></tr>'; });
    });
    return bar + '<div class="paperwrap"><div class="paper">' +
      '<div class="p-head"><div><div class="brand" style="font-size:18px">LIVARO</div><div style="font-size:16px;font-weight:700;margin-top:4px">Лист погрузки к заказу № ' + o.no + ' от ' + docDate + '</div></div>' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:.06em;border:2px solid #111316;padding:4px 8px">ДЛЯ ГРУЗЧИКА</div></div>' +
      '<div style="border:2px solid #111316;padding:8px 12px;display:flex;justify-content:space-between;gap:20px;font-size:14px"><div>Клиент: <b style="font-size:16px">' + esc(c.name) + '</b></div><div>Шкафов: <b style="font-size:16px">' + o.groups.length + '</b> · Мест: <b style="font-size:16px">' + buildPlaces(o).places.length + '</b></div></div>' +
      '<table class="p-t"><thead><tr><th style="width:20px">№</th><th>Что грузить</th><th class="num" style="width:50px">Кол-во</th><th style="width:70px;text-align:center">Погружено</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="sign" style="grid-template-columns:1fr 1fr 1fr"><div class="s"><b>Выдал со склада</b><div>подпись / расшифровка</div></div><div class="s"><b>Погрузил (грузчик)</b><div>подпись / расшифровка</div></div><div class="s"><b>Принял (водитель)</b><div>подпись / расшифровка</div></div></div>' +
      '</div></div>';
  }
  let rows = '';
  o.groups.forEach((g, gi) => {
    const s = gsum(g);
    rows += '<tr class="g"><td>' + (gi + 1) + '</td><td>' + esc(g.t) + '</td><td class="num">1 шт</td><td class="num">' + fmt(s) + ',00</td><td class="num">' + fmt(s) + ',00</td></tr>';
    g.items.forEach(it => { rows += '<tr class="c"><td></td><td class="nm">' + esc(it.n) + '</td><td class="num">' + it.q + '</td><td class="num">' + (it.p ? fmt(it.p) + ',00' : 'входит') + '</td><td></td></tr>'; });
  });
  rows += '<tr><td colspan="4" class="num"><b>Итого</b></td><td class="num"><b>' + fmt(o.total) + ',00</b></td></tr>';
  return bar + '<div class="paperwrap"><div class="paper">' +
    '<div class="p-head"><div class="brand">LIVARO</div><div style="text-align:right;font-size:15px"><b>' + docName + '</b> от ' + docDate + '</div></div>' +
    '<div class="kv"><div class="k">Поставщик</div><div><b>LIVARO</b></div><div class="k">Покупатель</div><div><b>' + esc(c.name) + '</b></div></div>' +
    '<table class="p-t"><thead><tr><th style="width:20px">№</th><th>Наименование</th><th class="num" style="width:44px">Кол-во</th><th class="num" style="width:74px">Цена, ₽</th><th class="num" style="width:82px">Сумма, ₽</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div style="display:flex;gap:16px;align-items:flex-start"><div style="font-size:12px;flex:1 1 0">Всего позиций ' + o.groups.length + ', на сумму <b>' + fmt(o.total) + ',00 руб.</b><br>' + words(o.total) + '</div>' +
    '<div class="bal" style="flex:0 0 58%"><div style="font-weight:700;margin-bottom:2px">Состояние расчётов с LIVARO</div>' +
    (isShip ? '<div class="line"><span>Баланс до отгрузки</span><span>' + balP(b.before) + '</span></div>' +
      '<div class="line"><span>Сумма этой накладной</span><span>−' + fmt(o.total) + ',00</span></div>' +
      '<div class="line"><span>Оплачено при отгрузке</span><span>' + fmt(b.paidNow) + ',00</span></div>'
      : '<div class="line"><span>Баланс сейчас</span><span>' + balP(b.before + b.paidNow) + '</span></div>' +
      '<div class="line"><span>Сумма заказа</span><span>−' + fmt(o.total) + ',00</span></div>') +
    (b.waiting ? '<div class="line"><span>Передаётся через водителя</span><span>' + fmt(b.waiting) + ',00</span></div>' : '') +
    '<div class="line" style="font-size:14px;font-weight:700;border-top:1px solid #111316;padding-top:4px;margin-top:4px"><span>Баланс после отгрузки</span><span>' + balP(b.after) + '</span></div>' +
    '<div style="font-size:10px;color:#3A414A;margin-top:2px">На балансе — ваши средства у LIVARO в счёт будущих отгрузок. Долг — сумма к оплате LIVARO.</div></div></div>' +
    '<div class="sign" style="grid-template-columns:1fr 1fr"><div class="s"><b>Отпустил (LIVARO)</b><div>подпись / расшифровка</div></div><div class="s"><b>Получил (водитель покупателя), претензий к количеству и качеству нет</b><div>подпись / расшифровка</div></div></div>' +
    '</div></div>';
};

/* ================= ТОВАРЫ (папки) ================= */
VIEWS.catalog = () => {
  if (UI.selCat && NODES[UI.selCat.id] !== UI.selCat) UI.selCat = null;
  const n = UI.selCat, q = (UI.catQ || '').trim().toLowerCase(), chk = UI.catChecked;
  let rows = [];
  if (q) { for (const id in NODES) NODES[id].it.forEach((it, i) => { if (it[0].toLowerCase().includes(q)) rows.push([NODES[id], i]); }); }
  else if (n) rows = deepOn() ? itemsDeep(n) : orderIdx(n).map(i => [n, i]); // по умолчанию — вместе с подпапками
  const key = (nd, i) => nd.id + '|' + i;
  Object.keys(chk).forEach(k => { if (!chk[k]) delete chk[k]; });
  const checked = Object.keys(chk).length, allOn = rows.length > 0 && rows.every(([nd, i]) => chk[key(nd, i)]);
  const folders = allFolders(DB.cat);
  UI.catRows = rows.map(([nd, i]) => key(nd, i)); // порядок строк — для выделения с Shift
  const body = rows.map(([nd, i]) => {
    const it = nd.it[i], k = key(nd, i);
    return '<tr class="crow' + (chk[k] ? ' sel' : '') + '" draggable="true" data-cdrag="' + k + '" data-act="crow" data-k="' + k + '"><td class="cbcell"><input type="checkbox" class="cb" data-ch="ccheck" data-k="' + k + '"' + (chk[k] ? ' checked' : '') + ' aria-label="Выбрать товар"></td>' +
      '<td class="nm-cell"><span class="grip" aria-hidden="true">⋮⋮</span><span data-dbl="cname" data-k="' + k + '" title="Двойной щелчок — изменить название">' + esc(it[0]) + '</span>' +
      (q ? '<div class="hint" style="margin:2px 0 0 26px">' + esc(folderPath(nd)) + '</div>' : nd !== n ? '<div class="hint" style="margin:2px 0 0 26px">' + esc(relPath(nd, n)) + '</div>' : '') + '</td>' +
      '<td class="num" style="width:130px"><input class="inp pin" style="width:110px" data-ch="cprice" data-k="' + k + '" value="' + fmt(it[1]) + '" placeholder="нет цены" aria-label="Цена"></td>' +
      '<td style="width:84px;white-space:nowrap"><button class="x" style="color:var(--ink2)" data-act="citem-edit" data-k="' + k + '" aria-label="Изменить товар" title="Изменить">✎</button>' +
      '<button class="x" data-act="citem-del" data-k="' + k + '" aria-label="Удалить товар" title="Удалить">×</button></td></tr>';
  }).join('');
  return '<div class="head"><div><h1>Товары</h1><div class="sub-h">Щёлкните по товарам, чтобы выделить (Shift — несколько подряд), и перетащите мышкой на нужную папку слева. Двойной щелчок по названию — изменить.</div></div></div>' +
    '<div class="row"><div class="card cat-tree" style="flex:1 1 320px;min-width:0">' +
    '<div class="btns" style="margin-bottom:10px;position:relative"><button class="btn sm" data-act="f-add">+ Папка</button><button class="btn sm" data-act="f-sub"' + (n ? '' : ' disabled') + '>+ Подпапка</button>' +
    '<button class="btn sm" data-act="f-up"' + (n ? '' : ' disabled') + ' title="Переместить папку выше" aria-label="Папку выше">↑</button><button class="btn sm" data-act="f-down"' + (n ? '' : ' disabled') + ' title="Переместить папку ниже" aria-label="Папку ниже">↓</button>' +
    '<button class="btn sm" data-act="cat-menu" aria-haspopup="true" aria-expanded="' + (UI.catMenu ? 'true' : 'false') + '" title="Ещё" aria-label="Ещё действия">⋮</button>' +
    (UI.catMenu ? '<div class="menu" role="menu">' +
      '<button role="menuitem" data-act="f-collapse">Свернуть все</button><button role="menuitem" data-act="f-expand">Развернуть все</button>' +
      '<button role="menuitem" data-act="f-sort">Сортировать по наименованию' + (n ? ' (в «' + esc(n.n) + '»)' : ' (весь каталог)') + '</button>' +
      '<button role="menuitem" data-act="f-color">Сортировать по цвету' + (n ? ' (в «' + esc(n.n) + '»)' : ' (весь каталог)') + '</button>' +
      '<button role="menuitem" data-act="f-deep"><span class="mcheck">' + (deepOn() ? '✓' : '') + '</span>Показывать товары вложенных папок</button>' +
      '<div class="msep"></div><button role="menuitem" data-act="pack-folder"' + (n ? '' : ' disabled') + '>Упаковка папки (коробки, хрупкое)…</button>' +
      '<button role="menuitem" data-act="f-ren"' + (n ? '' : ' disabled') + '>Переименовать папку</button><button role="menuitem" class="mdanger" data-act="f-del"' + (n ? '' : ' disabled') + '>Удалить папку</button>' +
      '</div>' : '') + '</div>' +
    '<div class="box" data-ks="ctree" style="max-height:640px;padding:4px">' + treeHtml(DB.cat, 0, 'c') + '</div></div>' +
    '<div class="card" style="flex:999 1 520px;min-width:0">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">' +
    '<label class="search" style="margin-left:0;max-width:420px"><span style="position:absolute;left:-9999px">Поиск по всем папкам</span>' + icon('search', 16) + '<input class="inp" id="cat-q2" data-in="cat-q2" placeholder="Поиск по всем папкам, например «Антресоль 4-х»" value="' + esc(UI.catQ || '') + '"></label>' +
    (n && !q ? '<div class="btns"><button class="btn sm" data-act="citem-add">+ Товар</button><button class="btn sm pri" data-act="model-new">+ Модель во всех цветах</button></div>' : '') + '</div>' +
    '<h2>' + (q ? 'Найдено: ' + rows.length + (q && UI.catQ ? ' <button class="btn sm" data-act="catq-clear" style="margin-left:8px">Сбросить поиск</button>' : '') :
      n ? esc(folderPath(n)) + ' <span class="muted" style="font-weight:400">· ' + rows.length + ' ' + plural(rows.length, 'товар', 'товара', 'товаров') + (n.ch.length && deepOn() ? ' вместе с подпапками' : '') + '</span>' : 'Выберите папку слева или найдите товар') + '</h2>' +
    (n && !q ? '<div class="hint" style="margin:-8px 0 12px">Упаковка: ' + (folderPack(n) ? packText(folderPack(n)) : 'по названию товара') + ' · <button class="btn sm" style="border:0;color:var(--accent);padding:0;min-height:0" data-act="pack-folder">изменить</button></div>' : '') +
    (checked ? '<div class="warn" style="background:var(--accent-bg);color:var(--accent-ink);margin-bottom:12px"><span>Отмечено: <b>' + checked + '</b></span><span class="btns">' +
      '<select class="inp" id="move-to" style="max-width:340px;min-height:36px;padding:4px 8px" aria-label="Папка, куда перенести">' +
      folders.map(x => '<option value="' + x.n.id + '">' + '   '.repeat(x.depth) + esc(x.n.n) + '</option>').join('') + '</select>' +
      '<button class="btn sm pri" data-act="cmove">Перенести сюда</button><button class="btn sm danger" data-act="cdel-checked">Удалить отмеченные</button><button class="btn sm" data-act="ccheck-none">Снять</button></span></div>' : '') +
    '<div class="scroll"><table class="t" style="min-width:480px">' + (rows.length ? '<thead><tr><th class="cbcell"><input type="checkbox" class="cb" data-ch="ccheck-all"' + (allOn ? ' checked' : '') + ' aria-label="Отметить все"></th><th>Наименование</th><th class="num">Цена, ₽</th><th></th></tr></thead>' : '') +
    '<tbody>' + (body || '<tr><td class="empty">' + (q ? 'Ничего не найдено' : n ? 'В этой папке пока нет товаров' : '') + '</td></tr>') + '</tbody></table></div>' +
    '<div class="hint" style="margin-top:10px">Цена 0 — товар входит в стоимость шкафа («входит» в накладной). Пустая цена — «нет цены».</div></div></div>';
};
const deepOn = () => !(DB.settings && DB.settings.deepList === false);
const sortRu = (a, b) => a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' });
/* сортировка по цвету: модели остаются на местах, внутри модели цвета — в порядке COLORS */
function colorRank(name) {
  const m = name.match(colorRe()); if (!m) return 99;
  const i = COLORS.findIndex(([k]) => k === colorKey(m[0])); return i < 0 ? 98 : i;
}
function sortByColor(node) {
  const groups = [], byBase = {};
  node.it.forEach(it => { const b = baseName(it[0]); if (!byBase[b]) { byBase[b] = []; groups.push(byBase[b]); } byBase[b].push(it); });
  node.it = [].concat(...groups.map(g => g.map((it, i) => [it, i]).sort((a, b) => colorRank(a[0][0]) - colorRank(b[0][0]) || a[1] - b[1]).map(x => x[0])));
  node.ch.forEach(sortByColor);
}
function sortFolder(list, items) {
  if (items) items.sort((a, b) => sortRu(a[0], b[0]));
  list.sort((a, b) => sortRu(a.n, b.n));
  list.forEach(f => sortFolder(f.ch, f.it));
}
/* товары папки, затем всех вложенных папок по порядку */
/* порядок показа товаров папки: модели — как лежат, внутри модели цвета по порядку COLORS (индексы — настоящие) */
function orderIdx(node) {
  const first = {}, base = node.it.map(it => baseName(it[0]));
  base.forEach((b, i) => { if (first[b] === undefined) first[b] = i; });
  return node.it.map((it, i) => i).sort((a, b) => first[base[a]] - first[base[b]] || colorRank(node.it[a][0]) - colorRank(node.it[b][0]) || a - b);
}
function itemsDeep(node) {
  const out = orderIdx(node).map(i => [node, i]);
  node.ch.forEach(c => out.push(...itemsDeep(c)));
  return out;
}
/* путь подпапки относительно выбранной: «Антресоли / 4-х» → «4-х» */
const relPath = (nd, base) => folderPath(nd).slice(folderPath(base).length + 3);
function itemForm(k) {
  const [nd, i] = itemByKey(k), it = nd.it[i];
  modal('<h2 style="margin:0">Товар</h2>' +
    '<label class="fld">Название<input class="inp" id="e-name" value="' + esc(it[0]) + '"></label>' +
    '<label class="fld">Цена, ₽<input class="inp" id="e-price" value="' + fmt(it[1]) + '" placeholder="пусто — нет цены, 0 — входит в стоимость"></label>' +
    '<label class="fld">Папка<select class="inp" id="e-folder">' + allFolders(DB.cat).map(x => '<option value="' + x.n.id + '"' + (x.n === nd ? ' selected' : '') + '>' + '   '.repeat(x.depth) + esc(x.n.n) + '</option>').join('') + '</select></label>' +
    '<div class="line"><span class="muted">Упаковка: ' + packText(packRule(it[0])) + '</span><button class="btn sm" data-act="pack-item" data-k="' + k + '">Изменить упаковку</button></div>' +
    '<div class="btns" style="justify-content:space-between"><button class="btn danger" data-act="citem-del" data-k="' + k + '">Удалить</button>' +
    '<span class="btns"><button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="citem-save" data-k="' + k + '">Сохранить</button></span></div>');
  const f = $('#e-name'); f.select();
}
function itemByKey(k) { const p = k.lastIndexOf('|'); return [NODES[k.slice(0, p)], +k.slice(p + 1)]; }
/* забирает отмеченные товары из их папок (с конца, чтобы не сбить номера) */
function takeChecked() {
  const keys = Object.keys(UI.catChecked).filter(k => UI.catChecked[k]).map(itemByKey).filter(([nd]) => nd)
    .sort((a, b) => a[0].id === b[0].id ? b[1] - a[1] : 0);
  const out = [];
  keys.forEach(([nd, i]) => { out.push({ node: nd, item: nd.it.splice(i, 1)[0] }); });
  UI.catChecked = {};
  return out.reverse();
}
function modelForm() {
  modal('<h2 style="margin:0">Модель во всех цветах</h2><div class="hint">Создаст по товару на каждый отмеченный цвет в папке «' + esc(UI.selCat.n) + '». Цвет допишется в конец названия.</div>' +
    '<label class="fld">Название без цвета<input class="inp" id="m-name" placeholder="Например: Антресоль 1-х на корпус МИЛАН"></label>' +
    '<div class="fld">Цвета</div><div class="chips">' + COLORS.map(([k, l], i) => '<label class="chip" style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" class="cb" data-color="' + k + '"' + (i < 5 ? ' checked' : '') + '>' + l + '</label>').join('') + '</div>' +
    '<label class="fld">Цена, ₽<input class="inp" id="m-price" placeholder="пусто — нет цены, 0 — входит в стоимость"></label>' +
    '<div class="btns" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="model-save">Создать</button></div>');
}

/* ================= КЛИЕНТЫ ================= */
VIEWS.clients = () => {
  const q = UI.clientQ.toLowerCase(), f = UI.clientFilter;
  const rows = DB.clients.map(c => ({ c, b: balance(c.id), w: pendingOf(c.id), last: shipped().filter(o => o.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date))[0] }))
    .filter(x => (!q || x.c.name.toLowerCase().includes(q) || (x.c.phone || '').includes(q)) &&
      (f === 'all' || (f === 'debt' && x.b < 0) || (f === 'adv' && x.b > 0) || (f === 'wait' && x.w > 0)))
    .sort((a, b) => a.b - b.b);
  return '<div class="head"><h1>Клиенты и баланс</h1><div class="btns">' +
    '<label class="btn" title="Файл Excel со списком покупателей из 1С">' + icon('upload', 16) + 'Загрузить из 1С<input type="file" accept=".xlsx,.xls,.csv" data-ch="clients-import" style="display:none"></label>' +
    '<a class="btn" href="#/opening">Начальные долги</a><button class="btn" data-act="pay-new">Принять оплату</button><button class="btn pri" data-act="client-new">+ Новый клиент</button></div></div>' +
    '<div class="card"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px"><div class="chips">' +
    [['all', 'Все'], ['debt', 'Должники'], ['adv', 'С балансом'], ['wait', 'Ждём от водителя']].map(([k, l]) => '<button class="chip' + (f === k ? ' on' : '') + '" data-act="cfilter" data-v="' + k + '">' + l + '</button>').join('') +
    '</div><input class="inp" style="max-width:300px" id="client-q" data-in="client-q" placeholder="Поиск по имени или телефону" value="' + esc(UI.clientQ) + '"></div>' +
    (rows.length ? '<div class="scroll"><table class="t" style="min-width:640px"><thead><tr><th>Клиент</th><th>Телефон</th><th class="num">Баланс</th><th>Последняя покупка</th><th></th></tr></thead><tbody>' +
      rows.map(x => '<tr class="click" data-act="go" data-to="#/client/' + x.c.id + '"><td><b>' + esc(x.c.name) + '</b></td><td>' + esc(x.c.phone || '') + '</td><td class="num">' + balTag(x.b) + '</td><td>' +
        (x.last ? ru(x.last.date) + ' · ' + rub(x.last.total) : '<span class="muted">—</span>') + '</td><td>' + (x.w ? '<span class="tag w">' + rub(x.w) + ' у водителя</span>' : '') + '</td></tr>').join('') +
      '</tbody></table></div>' : '<div class="empty">' + (DB.clients.length ? 'Никого не найдено' : 'Клиентов пока нет. Они появятся при оформлении заказа или кнопкой «+ Новый клиент».') + '</div>') + '</div>';
};
/* начальные долги и балансы всех клиентов — одной таблицей */
VIEWS.opening = () => {
  const q = (UI.openQ || '').toLowerCase();
  const list = DB.clients.filter(c => !q || c.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  return '<div class="head"><div><div class="crumb"><a href="#/clients">Клиенты и баланс</a> / Начальные долги</div><h1>Начальные долги и балансы</h1>' +
    '<div class="sub-h">Укажите, сколько каждый клиент был должен (или сколько его денег было у вас) на день перехода на программу. Сохраняется сразу.</div></div></div>' +
    '<div class="kpis" id="op-sum">' + openingKpis() + '</div>' +
    '<div class="card"><label class="search" style="margin-left:0;max-width:360px">' + icon('search', 16) + '<input class="inp" id="open-q" data-in="open-q" placeholder="Найти клиента" value="' + esc(UI.openQ || '') + '"></label></div>' +
    '<div class="card tcard">' + (list.length ? '<div class="scroll"><table class="t" style="min-width:620px"><thead><tr><th>Клиент</th><th>Телефон</th><th style="width:170px">На начало</th><th class="num" style="width:180px">Сумма, ₽</th></tr></thead><tbody>' +
      list.map(c => { const o = c.opening || 0; return '<tr><td class="c-client">' + esc(c.name) + '</td><td>' + esc(c.phone || '') + '</td>' +
        '<td><select class="inp" style="min-height:38px" data-ch="op-type" data-id="' + c.id + '" aria-label="Долг или баланс"><option value="0"' + (!o ? ' selected' : '') + '>Ноль</option><option value="debt"' + (o < 0 ? ' selected' : '') + '>Долг</option><option value="adv"' + (o > 0 ? ' selected' : '') + '>На балансе</option></select></td>' +
        '<td class="num"><input class="inp pin" style="width:150px" data-ch="op-amt" data-id="' + c.id + '" value="' + (o ? fmt(Math.abs(o)) : '') + '" placeholder="0" aria-label="Сумма"></td></tr>'; }).join('') +
      '</tbody></table></div>' : '<div class="empty">Клиентов нет. Загрузите их из 1С на странице «Клиенты и баланс».</div>') + '</div>';
};
function openingKpis() {
  let d = 0, a = 0, nd = 0;
  DB.clients.forEach(c => { const o = c.opening || 0; if (o < 0) { d -= o; nd++; } else a += o; });
  return '<div class="kpi"><div class="l">Клиентов</div><div class="v">' + DB.clients.length + '</div></div>' +
    '<div class="kpi"><div class="l">Долги на начало</div><div class="v debt">' + rub(d) + '</div><div class="h">' + nd + ' должников</div></div>' +
    '<div class="kpi"><div class="l">На балансе на начало</div><div class="v adv">' + rub(a) + '</div></div>';
}
function setOpening(id) {
  const c = client(id), t = document.querySelector('[data-ch="op-type"][data-id="' + id + '"]').value;
  let amt = num(document.querySelector('[data-ch="op-amt"][data-id="' + id + '"]').value);
  if (t === '0') amt = 0;
  c.opening = t === 'adv' ? amt : t === 'debt' ? -amt : 0;
  save(); $('#op-sum').innerHTML = openingKpis();
}
/* загрузка покупателей из Excel 1С: ищем колонку с названием и телефоном */
function importClients(rows) {
  const isHead = r => r.some(x => /наименование|контрагент|покупател|клиент|^имя/i.test(String(x || '')));
  let h = rows.findIndex(isHead), nameCol = 0, phoneCol = -1;
  if (h >= 0) {
    nameCol = rows[h].findIndex(x => /наименование|контрагент|покупател|клиент|^имя/i.test(String(x || '')));
    phoneCol = rows[h].findIndex(x => /телефон|контакт/i.test(String(x || '')));
  }
  const have = new Set(DB.clients.map(c => c.name.toLowerCase())); let added = 0, skipped = 0;
  rows.slice(h + 1).forEach(r => {
    const name = String(r[nameCol] == null ? '' : r[nameCol]).replace(/\s+/g, ' ').trim();
    if (!name || /^\d+$/.test(name)) return;
    if (have.has(name.toLowerCase())) { skipped++; return; }
    const m = phoneCol >= 0 ? String(r[phoneCol] || '').match(/\+?\d[\d\s\-()]{8,}\d/) : null;
    DB.clients.push({ id: uid(), name, phone: m ? m[0].trim() : '', opening: 0, note: '', createdAt: Date.now() });
    have.add(name.toLowerCase()); added++;
  });
  return { added, skipped };
}
VIEWS.client = ([id]) => {
  const c = client(id);
  if (!c) return '<div class="card empty">Клиент не найден. <a href="#/clients">К списку</a></div>';
  const m = moves(id), b = balance(id), w = pendingOf(id);
  const mine = shipped().filter(o => o.clientId === id), shippedSum = mine.reduce((s, o) => s + o.total, 0);
  const inWork = waitingOrders().filter(o => o.clientId === id);
  const paid = DB.payments.filter(p => p.clientId === id && p.status === 'received').reduce((s, p) => s + p.amount, 0);
  let run = c.opening || 0; const rows = m.map(x => { run += x.amt; return [x, run]; }).reverse();
  return '<div class="head"><div><div class="crumb"><a href="#/clients">Клиенты и баланс</a> / Карточка</div><h1>' + esc(c.name) + '</h1>' + (c.phone || c.note ? '<div class="hint" style="font-size:14px;margin-top:4px">' + esc([c.phone, c.note].filter(Boolean).join(' · ')) + '</div>' : '') + '</div>' +
    '<div class="btns"><button class="btn" data-act="client-edit" data-id="' + c.id + '">Изменить</button><button class="btn" data-act="pay-new" data-id="' + c.id + '">Принять оплату</button><button class="btn pri" data-act="order-for" data-id="' + c.id + '">Оформить заказ</button>' +
    '<span style="width:1px;height:28px;background:var(--line)"></span><button class="btn danger" data-act="client-del" data-id="' + c.id + '">Удалить</button></div></div>' +
    '<div class="tiles">' + tile('Баланс сейчас', '<span class="' + (b > 0 ? 'adv' : b < 0 ? 'debt' : '') + '">' + balTxt(b) + '</span>', b < 0 ? 'клиент должен вам' : b > 0 ? 'деньги клиента у вас' : 'расчёты закрыты') +
    tile('Отгружено всего', rub(shippedSum), mine.length + ' ' + plural(mine.length, 'накладная', 'накладные', 'накладных')) + tile('Оплачено всего', rub(paid), 'полученные деньги') +
    (w ? tile('Ждём от водителя', '<span style="color:var(--wait-ink)">' + rub(w) + '</span>', 'ещё не получено') : '') + '</div>' +
    (inWork.length ? '<div class="card"><h2>Заказы в работе (ещё не отгружены)</h2><table class="t"><tbody>' + inWork.map(o => '<tr class="click" data-act="go" data-to="#/sale/' + o.id + '"><td><b>№ ' + o.no + '</b></td><td>оформлен ' + ru(o.date) + '</td><td class="num"><b>' + rub(o.total) + '</b></td>' +
      '<td class="num"><button class="btn sm pri" data-act="ship-open" data-id="' + o.id + '">Отгрузить</button></td></tr>').join('') + '</tbody></table></div>' : '') +
    '<div class="card"><h2>История расчётов</h2><div class="scroll"><table class="t" style="min-width:640px"><thead><tr><th>Дата</th><th>Операция</th><th class="num">Отгрузка</th><th class="num">Оплата</th><th class="num">Баланс после</th></tr></thead><tbody>' +
    rows.map(([x, r]) => x.kind === 'order'
      ? '<tr class="click" data-act="go" data-to="#/sale/' + x.ref.id + '"><td>' + ru(x.date) + '</td><td>Накладная № ' + x.ref.no + '</td><td class="num">' + rub(x.ref.total) + '</td><td></td><td class="num">' + balTag(r) + '</td></tr>'
      : '<tr><td>' + ru(x.date) + '</td><td>Оплата, ' + METHOD[x.ref.method] + (x.ref.note ? ' <span class="muted">· ' + esc(x.ref.note) + '</span>' : '') + '</td><td></td><td class="num adv">' + rub(x.ref.amount) + '</td><td class="num">' + balTag(r) + '</td></tr>').join('') +
    '<tr><td></td><td class="muted">Начальный баланс</td><td></td><td></td><td class="num">' + balTag(c.opening || 0) + '</td></tr>' +
    '</tbody></table></div></div>';
};

/* ================= ДЕНЬГИ У ВОДИТЕЛЕЙ / ОПЛАТЫ ================= */
VIEWS.drivers = () => {
  const pend = DB.payments.filter(p => p.status === 'pending').sort((a, b) => a.date.localeCompare(b.date));
  const got = DB.payments.filter(p => p.method === 'driver' && p.status === 'received').sort((a, b) => b.receivedDate.localeCompare(a.receivedDate)).slice(0, 15);
  const pr = p => { const o = p.orderId ? order(p.orderId) : null; return o ? '<a href="#/sale/' + o.id + '">№ ' + o.no + '</a>' : '—'; };
  return '<div class="head"><div><h1>Деньги у водителей</h1><div class="hint" style="font-size:14px;margin-top:6px">Клиент передал деньги со своим водителем, а до вас они ещё не дошли. Нажмите «Получено», когда водитель привезёт деньги — они зачтутся клиенту.</div></div></div>' +
    '<div class="card"><h2>Ожидаем · ' + rub(pend.reduce((s, p) => s + p.amount, 0)) + '</h2>' + (pend.length ? '<div class="scroll"><table class="t" style="min-width:560px"><thead><tr><th>Дата</th><th>Клиент</th><th>Накладная</th><th class="num">Сумма</th><th></th></tr></thead><tbody>' +
      pend.map(p => '<tr><td>' + ru(p.date) + '</td><td><a href="#/client/' + p.clientId + '"><b>' + esc((client(p.clientId) || {}).name) + '</b></a></td><td>' + pr(p) + '</td><td class="num"><b>' + rub(p.amount) + '</b></td><td class="num"><button class="btn sm pri" data-act="recv" data-id="' + p.id + '">Получено</button></td></tr>').join('') +
      '</tbody></table></div>' : '<div class="empty">Все деньги от водителей получены</div>') + '</div>' +
    (got.length ? '<div class="card"><h2>Недавно получено</h2><table class="t"><tbody>' + got.map(p => '<tr><td>' + ru(p.receivedDate) + '</td><td>' + esc((client(p.clientId) || {}).name) + '</td><td>' + pr(p) + '</td><td class="num">' + rub(p.amount) + '</td></tr>').join('') + '</tbody></table></div>' : '');
};
VIEWS.payments = () => {
  const pk = UI.payKind || 'all';
  const list = DB.payments.filter(p => inRange(payDate(p), UI.payRange) && (pk === 'all' || (pk === 'goods') === (p.method === 'goods'))).sort((a, b) => payDate(b).localeCompare(payDate(a)) || b.createdAt - a.createdAt);
  const sum = list.filter(p => p.status === 'received').reduce((s, p) => s + p.amount, 0), gsumP = list.filter(p => p.status === 'received' && p.method === 'goods').reduce((s, p) => s + p.amount, 0);
  return '<div class="head"><h1>Оплаты</h1><button class="btn pri" data-act="pay-new">Принять оплату</button></div>' +
    '<div class="card"><div class="filters" style="margin-bottom:12px"><div class="fgroup"><span>Период</span>' + rangeButton(UI.payRange, 'range-open', 'payRange') + '</div>' +
    '<div class="fgroup"><span>Чем оплатили</span>' + seg(pk, 'pay-kind', [['all', 'Всё'], ['money', 'Деньгами'], ['goods', 'Товаром']]) + '</div></div>' +
    (list.length ? '<div class="scroll"><table class="t" style="min-width:640px"><thead><tr><th>Дата</th><th>Клиент</th><th>Способ</th><th>Комментарий</th><th class="num">Сумма</th><th></th></tr></thead><tbody>' +
      list.map(p => '<tr><td>' + ru(payDate(p)) + '</td><td><a href="#/client/' + p.clientId + '">' + esc((client(p.clientId) || {}).name) + '</a></td><td>' + METHOD[p.method] + (p.status === 'pending' ? ' <span class="tag w">ждём</span>' : '') + '</td><td class="muted">' + esc(p.note || '') + '</td>' +
        '<td class="num"><b>' + rub(p.amount) + '</b></td><td style="width:36px"><button class="x" data-act="pay-del" data-id="' + p.id + '" aria-label="Удалить оплату">×</button></td></tr>').join('') +
      '</tbody></table></div><div class="line tot"><span>Получено за период</span><span>' + rub(sum) + '</span></div>' + (gsumP && pk === 'all' ? '<div class="line"><span class="muted">из них товаром (взаимозачёт)</span><span>' + rub(gsumP) + '</span></div>' : '') : '<div class="empty">Оплат за этот период нет</div>') + '</div>';
};

/* ================= ОТЧЁТЫ ================= */
VIEWS.reports = () => {
  const r = UI.repRange, orders = shipped().filter(o => inRange(o.shipDate, r));
  const byClient = {}, byDay = {}, byModel = {}, byColor = {}, byPart = {};
  let cabinets = 0;
  orders.forEach(o => {
    const k = o.clientId; byClient[k] = byClient[k] || { s: 0, n: 0 }; byClient[k].s += o.total; byClient[k].n++;
    byDay[o.shipDate] = (byDay[o.shipDate] || 0) + o.total;
    o.groups.forEach(g => {
      const carc = g.items.find(isCarcass);
      if (carc) { // шкаф: модель по дверям и числу дверей, цвет по корпусу
        cabinets++;
        const N = doorsFromName(carc.n), dt = g.items.filter(isDoor).map(d => doorType(d.n)).find(Boolean) || '', key = (dt ? dt + ' ' : 'Шкаф ') + N + 'х';
        byModel[key] = byModel[key] || { q: 0, s: 0 }; byModel[key].q++; byModel[key].s += gsum(g);
        const c = colorOf(carc.n) || 'без цвета'; byColor[c] = (byColor[c] || 0) + 1;
      }
      g.items.forEach(it => { // детали без учёта цвета (ручки и карнизы не считаем)
        if (isHandle(it) || isCornice(it)) return;
        const b = baseName(it.n); byPart[b] = byPart[b] || { n: it.n.replace(colorRe(), '').replace(/\s+/g, ' ').trim(), q: 0 }; byPart[b].q += it.q;
      });
    });
  });
  const sum = orders.reduce((s, o) => s + o.total, 0);
  const models = Object.entries(byModel).sort((a, b) => b[1].q - a[1].q);
  const colors = COLORS.map(([k, l]) => [l, byColor[k] || 0]).concat(byColor['без цвета'] ? [['Без цвета', byColor['без цвета']]] : []).filter(x => x[1]);
  const cmax = Math.max(1, ...colors.map(x => x[1])), ctot = colors.reduce((s, x) => s + x[1], 0);
  const SW = { 'Белый': '#F7F5EF', 'Серый': '#8C9096', 'Ваниль': '#EADDBF', 'Лино': '#CDBB9E', 'Вотан': '#8B6A47', 'Сатин': '#D8C8B0', 'Без цвета': '#FFFFFF' };
  const parts = Object.values(byPart).sort((a, b) => b.q - a.q).slice(0, 15);
  const cl = Object.entries(byClient).sort((a, b) => b[1].s - a[1].s), days = Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0]));
  const empty = '<div class="empty">Нет отгрузок за период</div>';
  return '<div class="head"><div><h1>Отчёты</h1><div class="sub-h">Только отгруженные заказы за выбранный период.</div></div>' + rangeButton(r, 'range-open', 'repRange') + '</div>' +
    '<div class="kpis"><div class="kpi"><div class="l">Отгружено</div><div class="v">' + rub(sum) + '</div><div class="h">' + orders.length + ' ' + plural(orders.length, 'накладная', 'накладные', 'накладных') + '</div></div>' +
    '<div class="kpi"><div class="l">Шкафов</div><div class="v">' + cabinets + '</div><div class="h">' + (cabinets ? 'в среднем ' + rub(Math.round(sum / Math.max(1, orders.length))) + ' за накладную' : '') + '</div></div>' +
    '<div class="kpi"><div class="l">Самая ходовая модель</div><div class="v" style="font-size:20px">' + (models[0] ? esc(models[0][0]) : '—') + '</div><div class="h">' + (models[0] ? models[0][1].q + ' шт' : '') + '</div></div>' +
    '<div class="kpi"><div class="l">Самый ходовой цвет</div><div class="v" style="font-size:20px">' + (colors.length ? colors.slice().sort((a, b) => b[1] - a[1])[0][0] : '—') + '</div></div></div>' +
    '<div class="row"><div class="card grow"><h2>Шкафы по моделям</h2>' + (models.length ? '<table class="t"><thead><tr><th>Модель</th><th class="num">Шкафов</th><th class="num">Сумма</th></tr></thead><tbody>' +
      models.map(([m, v]) => '<tr><td class="c-client">' + esc(m) + '</td><td class="num amount">' + v.q + '</td><td class="num">' + rub(v.s) + '</td></tr>').join('') + '</tbody></table>' : empty) + '</div>' +
    '<div class="card aside"><h2>Цвета (по шкафам)</h2>' + (colors.length ? colors.map(([l, n]) => '<div style="margin:10px 0"><div class="line" style="margin:0 0 4px"><span><i class="dot" style="width:12px;height:12px;border:1px solid #B5BBC2;background:' + SW[l] + ';vertical-align:-1px;margin-right:6px"></i>' + l + '</span>' +
      '<span><b>' + n + '</b> <span class="muted">· ' + Math.round(n / ctot * 100) + '%</span></span></div><div style="height:8px;background:#EEF0F3;border-radius:4px"><div style="height:8px;border-radius:4px;background:var(--accent);width:' + Math.round(n / cmax * 100) + '%"></div></div></div>').join('') : empty) + '</div></div>' +
    '<div class="row"><div class="card grow"><h2>Детали: что уходит чаще (все цвета вместе)</h2>' + (parts.length ? '<table class="t"><thead><tr><th>Товар</th><th class="num">Шт</th></tr></thead><tbody>' +
      parts.map(p => '<tr><td>' + esc(p.n) + '</td><td class="num amount">' + p.q + '</td></tr>').join('') + '</tbody></table>' : empty) + '</div>' +
    '<div class="card aside"><h2>По клиентам</h2>' + (cl.length ? cl.map(([k, v]) => '<div class="line"><span><a href="#/client/' + k + '">' + esc((client(k) || {}).name) + '</a> <span class="muted">· ' + v.n + '</span></span><b>' + rub(v.s) + '</b></div>').join('') : empty) +
    '<h2 style="margin-top:18px">По дням</h2>' + (days.length ? days.map(([dd, s]) => '<div class="line"><span>' + ru(dd) + '</span><b>' + rub(s) + '</b></div>').join('') : empty) + '</div></div>';
};

/* ================= ДАННЫЕ ================= */
VIEWS.data = () => {
  const items = Object.values(NODES).reduce((s, n) => s + n.it.length, 0);
  let auto;
  if (BK.state === 'unsupported') auto = '<div class="hint" style="font-size:14px">Этот браузер не умеет сохранять в папку автоматически. Откройте программу в Яндекс.Браузере, Chrome или Edge — или сохраняйте копию вручную кнопкой ниже.</div>';
  else if (BK.state === 'off') auto = '<div class="hint" style="font-size:14px;margin-bottom:12px">Выберите папку <b>LIVARO / Резервные копии</b> — программа будет сама сохранять туда копию после каждого изменения. Хранятся копии за последние ' + BK_KEEP + ' дней.</div>' +
    '<button class="btn pri big" data-act="bk-choose">Включить автокопию — выбрать папку</button>';
  else if (BK.state === 'prompt') auto = '<div class="warn" style="margin-bottom:12px"><span>Браузер просит заново разрешить запись в папку «' + esc(BK.handle.name) + '». Нажмите кнопку и выберите «Разрешить» (лучше — «Разрешать всегда»).</span></div>' +
    '<button class="btn pri big" data-act="bk-reconnect">Разрешить автокопию</button>';
  else auto = '<div class="line"><span class="muted">Папка</span><b>' + esc(BK.handle.name) + '</b></div>' +
    '<div class="line"><span class="muted">Последняя копия</span><b>' + (BK.last ? bkTime(BK.last) : 'ещё не было') + '</b></div>' +
    (BK.error ? '<div class="warn" style="margin:8px 0">Ошибка последнего сохранения: ' + esc(BK.error) + '</div>' : '') +
    '<div class="btns" style="margin-top:12px"><button class="btn pri" data-act="bk-now">Сохранить копию сейчас</button><button class="btn" data-act="bk-choose">Сменить папку</button><button class="btn danger" data-act="bk-off">Выключить</button></div>' +
    '<h2 style="margin-top:20px">Копии в папке</h2><div id="bk-list" class="hint">Загружаю список…</div>';
  if (BK.state === 'on') setTimeout(bkList, 0);
  return '<div class="head"><h1>Данные и копии</h1></div>' +
    '<div class="card"><h2>Автоматическая копия' + (BK.state === 'on' ? ' <span class="st st-paid"><i></i>включена</span>' : BK.state === 'unsupported' ? '' : ' <span class="st st-unpaid"><i></i>' + (BK.state === 'prompt' ? 'ждёт разрешения' : 'выключена') + '</span>') + '</h2>' + auto + '</div>' +
    '<div class="card"><h2>Где хранятся данные</h2><div class="hint" style="font-size:14px">Рабочие данные хранятся в этом браузере. Автокопия — запасной экземпляр в обычных файлах на диске: если браузер очистят или переустановят, всё восстанавливается из папки. ' +
    'Совет: если папка LIVARO лежит в Яндекс.Диске или Google Диске, копия будет и в интернете — на случай поломки компьютера.</div>' +
    '<div class="tiles" style="margin-top:14px">' + tile('Товаров', items, Object.keys(NODES).length + ' папок') + tile('Клиентов', DB.clients.length, '') + tile('Накладных', DB.orders.length, 'следующий № ' + DB.nextNo) + '</div></div>' +
    '<div class="card"><h2>Копия вручную</h2><div class="btns"><button class="btn" data-act="backup">Сохранить копию в файл</button>' +
    '<label class="btn">Загрузить из копии…<input type="file" accept=".json,application/json" data-ch="restore" style="display:none"></label></div>' +
    '<div class="hint" style="margin-top:10px">Например, чтобы перенести данные на другой компьютер или прислать копию мне.</div></div>' +
    '<div class="card"><h2>Начать заново</h2><div class="hint" style="margin-bottom:10px">Удаляет клиентов, накладные и оплаты. Товары и папки остаются. Сначала сохраните копию.</div><button class="btn danger" data-act="wipe">Удалить клиентов, накладные и оплаты</button></div>';
};

/* ================= окна: клиент и оплата ================= */
function modal(html) { $('#modal').innerHTML = html ? '<div class="ovl" data-act="modal-bg"><div class="dlg" role="dialog" aria-modal="true">' + html + '</div></div>' : ''; const f = $('#modal input'); if (f) f.focus(); }
function clientForm(c, name) {
  c = c || {}; const o = c.opening || 0;
  modal('<h2 style="margin:0">' + (c.id ? 'Клиент' : 'Новый клиент') + '</h2>' +
    '<label class="fld">Имя или название<input class="inp" id="f-name" value="' + esc(c.name || name || '') + '"></label>' +
    '<label class="fld">Телефон<input class="inp" id="f-phone" value="' + esc(c.phone || '') + '"></label>' +
    '<div class="form"><label class="fld">Баланс на начало<select class="inp" id="f-bt"><option value="0"' + (o === 0 ? ' selected' : '') + '>Ноль</option><option value="adv"' + (o > 0 ? ' selected' : '') + '>На балансе</option><option value="debt"' + (o < 0 ? ' selected' : '') + '>Долг</option></select></label>' +
    '<label class="fld">Сумма, ₽<input class="inp" id="f-bal" value="' + (o ? fmt(Math.abs(o)) : '') + '"></label></div>' +
    '<div class="hint">Баланс на начало — долг клиента или его деньги на балансе на момент перехода на эту программу.</div>' +
    '<label class="fld">Комментарий<input class="inp" id="f-note" value="' + esc(c.note || '') + '"></label>' +
    '<div class="btns" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="client-save" data-id="' + (c.id || '') + '">Сохранить</button></div>');
}
function payForm(cid) {
  const opts = DB.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => '<option value="' + c.id + '"' + (c.id === cid ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
  if (!opts) { toast('Сначала добавьте клиента'); return; }
  modal('<h2 style="margin:0">Принять оплату</h2>' +
    '<label class="fld">Клиент<select class="inp" id="p-client">' + opts + '</select></label>' +
    '<label class="fld">Способ<select class="inp" id="p-method" data-ch="p-method"><option value="transfer">Перевод</option><option value="cash">Наличные</option><option value="goods">Товаром (взаимозачёт)</option><option value="driver">Через водителя (ещё не получено)</option></select></label>' +
    '<div id="p-goods" style="display:none">' + goodsFields('p') + '</div>' +
    '<div class="form"><label class="fld">Сумма, ₽<input class="inp" id="p-amount" data-in="pay-amt"></label><label class="fld">Дата<input class="inp" type="date" id="p-date" value="' + todayISO() + '"></label></div>' +
    '<label class="fld">Комментарий<input class="inp" id="p-note"></label>' +
    '<div class="btns" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="pay-save">Сохранить</button></div>');
  $('#p-amount').focus();
}

/* окно замены строки корзины */
function repList() {
  const R = UI.rep, row = DB.cart.groups[R.g].items[R.i], q = R.q.trim().toLowerCase();
  const f = findItem(row.n), m = row.n.match(colorRe()), ck = m ? colorKey(m[0]) : '';
  let cands = [];
  if (q) { for (const id in NODES) NODES[id].it.forEach((it, i) => { if (it[0].toLowerCase().includes(q)) cands.push([NODES[id], i]); }); }
  else if (f) { // весь раздел, где лежит товар: для зеркала Милана — все двери Милана
    const k = f.node.id.lastIndexOf('-'), parent = k < 0 ? f.node : NODES[f.node.id.slice(0, k)];
    cands = itemsDeep(parent);
  }
  const same = ([nd, i]) => { const mm = nd.it[i][0].match(colorRe()); return ck && mm && colorKey(mm[0]) === ck ? 0 : 1; };
  cands = cands.filter(([nd, i]) => nd.it[i][0] !== row.n).sort((a, b) => same(a) - same(b)).slice(0, 120);
  return cands.length ? cands.map(([nd, i]) => '<button class="it" style="width:100%;border:0;background:none;font:inherit;text-align:left" data-act="rep-pick" data-id="' + nd.id + '" data-i="' + i + '">' +
    '<span>' + esc(nd.it[i][0]) + '<div class="hint">' + esc(nd.n) + '</div></span><span class="pr">' + priceHtml(nd.it[i][1]) + '</span></button>').join('') : '<div class="empty">Ничего не найдено — попробуйте поиск</div>';
}
function repForm() {
  const row = DB.cart.groups[UI.rep.g].items[UI.rep.i];
  modal('<h2 style="margin:0">Заменить</h2><div class="hint">' + esc(row.n) + ' · ' + row.q + ' шт. Количество останется тем же, строка — отдельной (своя коробка на этикетках).</div>' +
    '<input class="inp" id="rep-q" data-in="rep-q" placeholder="Поиск по всем товарам…" value="' + esc(UI.rep.q) + '">' +
    '<div class="box" id="rep-list" style="max-height:380px">' + repList() + '</div>' +
    '<div class="btns" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Отмена</button></div>');
  const dlg = $('#modal .dlg'); if (dlg) dlg.style.maxWidth = '620px';
}

/* ================= корзина: перенос строк ================= */
function moveRow(g, i, to, pos) {
  const C = DB.cart, T = C.groups[to].items, it = C.groups[g].items[i];
  if (pos === null && g === to) return;
  C.groups[g].items.splice(i, 1);
  const f = g !== to ? T.findIndex(x => x.n === it.n && x.p === it.p) : -1;
  if (f >= 0) T[f].q += it.q;
  else { if (pos === null) pos = T.length; if (g === to && i < pos) pos--; T.splice(pos, 0, it); }
  commit();
}

/* ================= действия (клики) ================= */
const ACT = {
  go: el => go(el.dataset.to),
  period: el => { UI.period = el.dataset.v; render(); },
  'sales-period': el => { UI.salesPeriod = el.dataset.v; render(); },
  'pay-period': el => { UI.payPeriod = el.dataset.v; render(); },
  'rep-period': el => { UI.repPeriod = el.dataset.v; render(); },
  cfilter: el => { UI.clientFilter = el.dataset.v; render(); },
  'notice-ok': () => { DB.notice = ''; commit(); },
  tree: el => {
    const n = NODES[el.dataset.id], v = el.dataset.view;
    const sel = v === 'o' ? UI.selOrder : UI.selCat;
    if (n.ch.length) n.open = sel === n ? !n.open : true;
    if (v === 'o') { UI.selOrder = n; UI.q = ''; } else { UI.selCat = n; UI.catChecked = {}; }
    commit();
  },
  add: el => {
    const it = NODES[el.dataset.id].it[+el.dataset.i], C = DB.cart;
    if (!C.groups.length) { C.groups.push({ t: 'Шкаф 1', items: [] }); C.cur = 0; }
    const G = C.groups[C.cur], f = G.items.findIndex(x => x.n === it[0]);
    if (f >= 0) G.items[f].q++; else G.items.push({ n: it[0], q: 1, p: it[1] || 0 });
    commit();
  },
  gsel: (el, e) => { if (/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)) return; DB.cart.cur = +el.dataset.g; commit(); },
  gnew: () => { DB.cart.groups.push({ t: 'Шкаф ' + (DB.cart.groups.length + 1), items: [] }); DB.cart.cur = DB.cart.groups.length - 1; commit(); },
  gdel: el => {
    const g = +el.dataset.g;
    if (DB.cart.groups[g].items.length && !confirm('Удалить группу «' + DB.cart.groups[g].t + '» со всеми товарами?')) return;
    DB.cart.groups.splice(g, 1); DB.cart.cur = Math.max(0, Math.min(DB.cart.cur, DB.cart.groups.length - 1)); commit();
  },
  qty: el => { const it = DB.cart.groups[+el.dataset.g].items[+el.dataset.i]; it.q = Math.max(1, it.q + (+el.dataset.d)); commit(); },
  idel: el => { DB.cart.groups[+el.dataset.g].items.splice(+el.dataset.i, 1); commit(); },
  /* ⇄ замена строки корзины: товары из того же раздела (например, все двери Милана), того же цвета — первыми */
  'rep-open': el => { UI.rep = { g: +el.dataset.g, i: +el.dataset.i, q: '' }; repForm(); },
  'rep-pick': el => {
    const it = NODES[el.dataset.id].it[+el.dataset.i], row = DB.cart.groups[UI.rep.g].items[UI.rep.i], old = row.n;
    row.n = it[0]; row.p = it[1] || 0; // строка остаётся отдельной — на этикетках своя коробка
    modal(''); commit(); toast('«' + old + '» заменено на «' + it[0] + '»', null, 4000);
  },
  'tpl-save': el => {
    const G = DB.cart.groups[+el.dataset.g];
    const nm = prompt('Название шаблона', G.t.replace(/^Шкаф \d+$/, '')); if (!nm || !nm.trim()) return;
    const old = DB.templates.find(t => t.t.toLowerCase() === nm.trim().toLowerCase());
    if (old && !confirm('Шаблон «' + old.t + '» уже есть. Заменить его?')) return;
    const t = { id: old ? old.id : uid(), t: nm.trim(), items: clone(G.items) };
    if (old) DB.templates[DB.templates.indexOf(old)] = t; else DB.templates.push(t);
    commit(); toast('Шаблон «' + t.t + '» сохранён');
  },
  'tpl-open': el => {
    const t = DB.templates.find(x => x.id === el.dataset.id);
    modal('<h2 style="margin:0">' + esc(t.t) + '</h2><div class="hint">Выберите цвет — все детали шаблона (' + t.items.length + ' поз.) добавятся в корзину новым шкафом. Ручки, карниз и другие детали без цвета останутся как есть.</div>' +
      '<div class="chips">' + COLORS.map(([k, l]) => '<button class="chip" style="min-height:44px;padding:0 18px" data-act="tpl-apply" data-id="' + t.id + '" data-color="' + k + '">' + l + '</button>').join('') + '</div>' +
      '<div class="btns" style="justify-content:space-between"><button class="btn sm" data-act="tpl-apply" data-id="' + t.id + '" data-color="">Без смены цвета</button><button class="btn" data-act="modal-close">Отмена</button></div>');
  },
  'tpl-apply': el => {
    const t = DB.templates.find(x => x.id === el.dataset.id), ck = el.dataset.color, C = DB.cart;
    const g = { t: ck ? recolorText(t.t, ck) : t.t, items: t.items.map(it => ({ n: ck ? recolorItem(it.n, ck) : it.n, q: it.q, p: it.p })) };
    if (ck && !colorRe().test(g.t)) g.t += ', ' + ck;
    if (C.groups.length === 1 && !C.groups[0].items.length) C.groups = [];
    C.groups.push(g); C.cur = C.groups.length - 1;
    modal(''); commit(); toast('В корзину добавлен «' + g.t + '»');
  },
  'tpl-ren': el => { const t = DB.templates.find(x => x.id === el.dataset.id), nm = prompt('Новое название шаблона', t.t); if (nm && nm.trim()) { t.t = nm.trim(); commit(); } },
  'tpl-del': el => {
    const t = DB.templates.find(x => x.id === el.dataset.id); if (!confirm('Удалить шаблон «' + t.t + '»?')) return;
    DB.templates = DB.templates.filter(x => x !== t); const tr = trashPush('template', t, 'Шаблон «' + t.t + '»'); commit(); undoToast('Шаблон удалён', [tr]);
  },
  'cart-clear': () => { if (confirm('Очистить корзину?')) { DB.cart = { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }; commit(); } else render(); },
  'cart-menu': () => { UI.cartMenu = !UI.cartMenu; render(); },
  'to-checkout': () => { DB.cart.groups = DB.cart.groups.filter(g => g.items.length); DB.cart.cur = 0; save(); go('#/checkout'); },
  'ck-pick': el => { UI.ck.clientId = el.dataset.id; render(); },
  'ck-change': () => { UI.ck.clientId = null; render(); setTimeout(() => $('#ck-q') && $('#ck-q').focus(), 0); },
  'ck-pay': el => { UI.ck.pay = el.dataset.v; render(); },
  post: () => {
    const ck = UI.ck, c = client(ck.clientId);
    if (!c) return toast('Выберите клиента');
    const groups = clone(DB.cart.groups.filter(g => g.items.length));
    if (!groups.length) return toast('Корзина пуста');
    const ed = DB.cart.editId ? order(DB.cart.editId) : null;
    let o;
    if (ed && ed.status === 'ordered') {
      o = Object.assign(ed, { clientId: c.id, date: ck.date || ed.date, groups, total: orderTotal(groups) });
      DB.payments.filter(p => p.orderId === o.id).forEach(p => { p.clientId = c.id; });
    } else {
      o = { id: uid(), no: DB.nextNo++, date: ck.date || todayISO(), clientId: c.id, groups, total: orderTotal(groups), status: 'ordered', shipDate: null, createdAt: Date.now() };
      DB.orders.push(o);
    }
    const amt = ck.pay === 'none' ? 0 : num(ck.amount);
    if (amt > 0) DB.payments.push({ id: uid(), clientId: c.id, amount: amt, method: ck.pay, status: 'received', date: o.date, receivedDate: o.date, orderId: o.id, note: 'предоплата', createdAt: Date.now() + 1 });
    DB.cart = { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 };
    UI.ck = null; UI.justDone = { id: o.id, kind: ed ? 'edited' : 'ordered' }; save(); go('#/sale/' + o.id);
  },
  'sales-status': el => { UI.salesStatus = el.dataset.v; render(); },
  'pay-kind': el => { UI.payKind = el.dataset.v; render(); },
  'sales-pay': el => { UI.salesPay = el.dataset.v; render(); },
  'sel-clear': () => { UI.salesSel = {}; render(); },
  'bulk-open': () => {
    const PM = payMap(), ids = Object.keys(UI.salesSel || {}).filter(id => { const o = order(id); return o && o.status !== 'cancelled' && remaining(o, PM[id]) > 0; });
    UI.bulk = { ids, method: 'transfer', date: todayISO(), amount: '' }; bulkForm();
  },
  'bulk-del': () => {
    const ids = Object.keys(UI.salesSel || {}), os = ids.map(order).filter(Boolean), shippedN = os.filter(o => o.status === 'shipped').length;
    if (!confirm('Удалить ' + os.length + ' ' + plural(os.length, 'заказ', 'заказа', 'заказов') + '?\nОни попадут в «Удалённые» — оттуда их можно восстановить.' +
      (shippedN ? '\n\nСреди них отгруженных: ' + shippedN + '. Балансы клиентов изменятся, пока заказы не восстановлены.' : ''))) return;
    deleteWithUndo(ids);
  },
  'wa-send': async el => {
    const o = order(el.dataset.id), c = client(o.clientId) || {}, phone = waPhone(c.phone);
    if (typeof html2canvas === 'undefined') return toast('Не загрузилась библиотека для картинок (app/vendor)');
    const label = el.innerHTML; el.disabled = true; el.textContent = 'Готовлю картинку…';
    const name = (o.status === 'shipped' ? 'Накладная' : 'Заказ') + ' ' + o.no + ' LIVARO.png';
    const blob = await invoiceImage(o).catch(() => null);
    el.disabled = false; el.innerHTML = label;
    if (!blob) return toast('Не удалось подготовить картинку накладной');
    sharePng(blob, name, phone);
  },
  'toast-undo': () => { const f = toast.fn; toast.fn = null; $('#toast').className = 'toast noprint'; if (f) f(); },
  'trash-kind': el => { UI.trashKind = el.dataset.v; render(); },
  'trash-restore': el => { restoreTrash([el.dataset.id]); commit(); toast('Восстановлено'); },
  'trash-restore-all': () => {
    const f = UI.trashKind || 'all', ids = DB.trash.filter(t => f === 'all' || kindOf(t) === f).map(t => t.id);
    restoreTrash(ids); UI.trashKind = 'all'; commit(); toast('Восстановлено: ' + ids.length);
  },
  'trash-kill': el => {
    const t = DB.trash.find(x => x.id === el.dataset.id);
    if (confirm('Удалить навсегда: ' + trashDetails(t)[0].replace(/<[^>]+>/g, '') + '? Восстановить будет нельзя.')) { DB.trash = DB.trash.filter(x => x !== t); commit(); }
  },
  'trash-empty': () => {
    const f = UI.trashKind || 'all', T = DB.trash.filter(t => f === 'all' || kindOf(t) === f);
    if (confirm('Удалить навсегда ' + T.length + ' ' + plural(T.length, 'запись', 'записи', 'записей') + '? Восстановить будет нельзя.')) { DB.trash = DB.trash.filter(t => !T.includes(t)); UI.trashKind = 'all'; commit(); }
  },
  'order-pay': el => { UI.bulk = { ids: [el.dataset.id], method: 'transfer', date: todayISO(), amount: '' }; bulkForm(); },
  'bulk-method': el => { readBulk(); UI.bulk.method = el.dataset.v; if (el.dataset.v === 'goods') UI.bulk.amount = ''; bulkForm(); }, // товаром — сумма из кол-ва × цены
  'bulk-save': () => {
    readBulk();
    const B = UI.bulk, PM = payMap(), byC = {}, d = B.date || todayISO(), now = Date.now();
    B.ids.map(order).filter(Boolean).sort((a, b) => (a.shipDate || a.date).localeCompare(b.shipDate || b.date) || a.no - b.no)
      .forEach(o => { (byC[o.clientId] = byC[o.clientId] || []).push(o); });
    const keys = Object.keys(byC), one = keys.length === 1;
    keys.forEach((cid, k) => {
      const os = byC[cid], need = os.reduce((s, o) => s + remaining(o, PM[o.id]), 0);
      const total = one && B.amount !== '' ? num(B.amount) : need; let left = total;
      if (!total) return;
      const alloc = [];
      os.forEach(o => { const a = Math.min(remaining(o, PM[o.id]), left); if (a > 0) { alloc.push({ orderId: o.id, amount: a }); left -= a; } });
      DB.payments.push({ id: uid(), clientId: cid, amount: total, method: B.method, status: B.method === 'driver' ? 'pending' : 'received', date: d, receivedDate: B.method === 'driver' ? null : d,
        orderId: null, alloc, note: (B.method === 'goods' && B.g ? goodsNote(B.g) + ' · ' : '') + 'по накладным № ' + os.map(o => o.no).join(', '),
        goods: B.method === 'goods' ? B.g : undefined, createdAt: now + k });
      if (B.method === 'goods' && B.g) stockInGoods(B.g, cid);
    });
    UI.salesSel = {}; modal(''); commit(); toast(B.method === 'driver' ? 'Записано: ждём деньги от водителя' : 'Оплата записана');
  },
  'ship-open': el => { UI.ship = { id: el.dataset.id, date: todayISO(), pay: 'none', amount: '' }; shipForm(); },
  'ship-pay': el => { readShip(); UI.ship.pay = el.dataset.v; shipForm(); },
  'ship-do': () => {
    readShip();
    const s = UI.ship, o = order(s.id);
    o.status = 'shipped'; o.shipDate = s.date || todayISO(); o.shippedAt = Date.now();
    const amt = s.pay === 'none' ? 0 : num(s.amount);
    if (amt > 0) DB.payments.push({ id: uid(), clientId: o.clientId, amount: amt, method: s.pay, status: s.pay === 'driver' ? 'pending' : 'received', date: o.shipDate, receivedDate: s.pay === 'driver' ? null : o.shipDate, orderId: o.id, atShip: true, note: '', createdAt: o.shippedAt + 1 });
    modal(''); UI.justDone = { id: o.id, kind: 'shipped' }; save();
    const r = route(); if (r.name === 'sale' && r.args[0] === o.id) render(); else go('#/sale/' + o.id);
  },
  unship: el => {
    const o = order(el.dataset.id);
    if (!confirm('Отменить отгрузку № ' + o.no + '? Заказ вернётся в «Оформлен», сумма вернётся на баланс клиента. Оплаты, принятые при отгрузке, удалятся.')) return;
    o.status = 'ordered'; o.shipDate = null; o.shippedAt = null; DB.payments = DB.payments.filter(p => !(p.orderId === o.id && p.atShip)); commit(); toast('Отгрузка отменена');
  },
  'order-cancel': el => {
    const o = order(el.dataset.id);
    if (!confirm('Отменить заказ № ' + o.no + '? Он останется в журнале как отменённый. Предоплата (если была) останется у клиента на балансе.')) return;
    o.status = 'cancelled'; commit(); toast('Заказ № ' + o.no + ' отменён');
  },
  'order-restore': el => { order(el.dataset.id).status = 'ordered'; commit(); toast('Заказ снова в работе'); },
  'order-edit': el => {
    const o = order(el.dataset.id);
    if (cartCount() && DB.cart.editId !== o.id && !confirm('В корзине есть товары. Заменить их заказом № ' + o.no + '?')) return;
    DB.cart = { groups: clone(o.groups), cur: 0, editId: o.id };
    UI.ck = { clientId: o.clientId, date: o.date, pay: 'none', amount: '' }; save(); go('#/order');
  },
  'edit-cancel': () => { const id = DB.cart.editId; DB.cart = { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }; UI.ck = null; save(); go('#/sale/' + id); },
  repeat: el => {
    const o = order(el.dataset.id);
    if (cartCount() && !confirm('В корзине уже есть товары. Заменить их товарами из этой накладной?')) return;
    DB.cart = { groups: clone(o.groups), cur: 0 }; save(); toast('Товары накладной в корзине — можно изменить и оформить'); go('#/order');
  },
  'order-del': el => {
    const o = order(el.dataset.id);
    if (!confirm('Удалить заказ № ' + o.no + '? Он попадёт в «Удалённые», оттуда его можно восстановить.' + (o.status === 'shipped' ? '\nЗаказ отгружен — баланс клиента изменится.' : ''))) return;
    go('#/sales'); deleteWithUndo([o.id]);
  },
  'order-for': el => { UI.ck = { clientId: el.dataset.id, date: todayISO(), pay: 'none', amount: '' }; go('#/order'); },
  print: () => window.print(),
  /* товары и папки */
  'f-add': () => { const nm = prompt('Название новой папки'); if (nm) { DB.cat.push({ n: nm.trim(), ch: [], it: [] }); commit(); } },
  'f-sub': () => { const n = UI.selCat, nm = prompt('Название подпапки в «' + n.n + '»'); if (nm) { n.ch.push({ n: nm.trim(), ch: [], it: [] }); n.open = true; commit(); } },
  'f-ren': () => { const n = UI.selCat, nm = prompt('Новое название папки', n.n); if (nm) { n.n = nm.trim(); commit(); } },
  'f-del': () => {
    const n = UI.selCat, cnt = allFolders([n]).reduce((s, x) => s + x.n.it.length, 0);
    if (!confirm('Удалить папку «' + n.n + '»' + (cnt ? ' и ' + cnt + ' товаров в ней' : '') + '? Её можно будет восстановить из «Удалённых».')) return;
    const t = trashPush('folder', n, 'Папка «' + n.n + '»' + (cnt ? ' · ' + cnt + ' товаров' : ''), { path: pathOf(n).slice(0, -1) });
    PARENT[n.id].splice(PARENT[n.id].indexOf(n), 1); UI.selCat = null; commit(); undoToast('Папка удалена', [t]);
  },
  'citem-add': () => {
    const nm = prompt('Название товара'); if (!nm) return;
    const pr = prompt('Цена, ₽ (0 — входит в стоимость шкафа; пусто — нет цены)', '');
    UI.selCat.it.push([nm.trim(), pr === null || pr.trim() === '' ? null : num(pr)]); commit();
  },
  'citem-del': el => {
    const [nd, i] = itemByKey(el.dataset.k), it = nd.it[i];
    if (!confirm('Удалить товар «' + it[0] + '»?')) return;
    const t = trashPush('item', nd.it.splice(i, 1)[0], it[0], { path: pathOf(nd) }); UI.catChecked = {}; modal(''); commit(); undoToast('Товар удалён', [t]);
  },
  'citem-edit': el => itemForm(el.dataset.k),
  'citem-save': el => {
    const [nd, i] = itemByKey(el.dataset.k), it = nd.it[i];
    const name = $('#e-name').value.trim(); if (!name) return toast('Введите название');
    const pv = $('#e-price').value.trim(), to = NODES[$('#e-folder').value];
    it[0] = name; it[1] = pv === '' ? null : num(pv);
    if (to && to !== nd) { to.it.push(nd.it.splice(i, 1)[0]); UI.catChecked = {}; }
    modal(''); commit(); toast(to && to !== nd ? 'Сохранено и перенесено в «' + to.n + '»' : 'Сохранено');
  },
  'cdel-checked': () => {
    const n = Object.keys(UI.catChecked).length;
    if (!confirm('Удалить отмеченные товары (' + n + ')? Их можно будет восстановить из «Удалённых».')) return;
    const ts = takeChecked().map(x => trashPush('item', x.item, x.item[0], { path: pathOf(x.node) })); commit(); undoToast('Удалено товаров: ' + ts.length, ts);
  },
  'ccheck-none': () => { UI.catChecked = {}; render(); },
  /* меню «⋮» и порядок папок */
  'cat-menu': () => { UI.catMenu = !UI.catMenu; render(); },
  'f-up': () => moveFolder(-1),
  'f-down': () => moveFolder(1),
  'f-collapse': () => { allFolders(DB.cat).forEach(x => { x.n.open = false; }); UI.catMenu = false; commit(); },
  'f-expand': () => { allFolders(DB.cat).forEach(x => { if (x.n.ch.length) x.n.open = true; }); UI.catMenu = false; commit(); },
  'f-sort': () => {
    const n = UI.selCat; UI.catMenu = false;
    if (!confirm('Отсортировать по алфавиту ' + (n ? 'папки и товары внутри «' + n.n + '»' : 'весь каталог') + '? Ваш ручной порядок там заменится.')) return render();
    if (n) sortFolder(n.ch, n.it); else sortFolder(DB.cat, null);
    UI.catChecked = {}; commit(); toast('Отсортировано по наименованию');
  },
  'f-color': () => {
    const n = UI.selCat; UI.catMenu = false;
    if (n) sortByColor(n); else DB.cat.forEach(sortByColor);
    UI.catChecked = {}; commit(); toast('Цвета по порядку: белый, серый, ваниль, лино, вотан');
  },
  'f-deep': () => { DB.settings = Object.assign({}, DB.settings, { deepList: !deepOn() }); UI.catMenu = false; commit(); },
  /* щелчок по строке товара: выделить/снять; с Shift — выделить всё от прошлого щелчка */
  crow: (el, e) => {
    if (/INPUT|BUTTON|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const k = el.dataset.k, rows = UI.catRows || [];
    if (e.shiftKey && UI.catLast && rows.includes(UI.catLast)) {
      const a = rows.indexOf(UI.catLast), b = rows.indexOf(k);
      rows.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => { UI.catChecked[x] = true; });
      window.getSelection && window.getSelection().removeAllRanges();
    } else if (UI.catChecked[k]) delete UI.catChecked[k];
    else UI.catChecked[k] = true;
    UI.catLast = k; render();
  },
  'catq-clear': () => { UI.catQ = ''; UI.catChecked = {}; render(); },
  cmove: () => {
    const to = NODES[$('#move-to').value], moved = takeChecked();
    to.it.push(...moved.map(x => x.item)); to.open = true; toast('Перенесено ' + moved.length + ' в «' + to.n + '»'); commit();
  },
  'model-new': () => modelForm(),
  'model-save': () => {
    const name = $('#m-name').value.trim(); if (!name) return toast('Введите название модели');
    const cols = [...document.querySelectorAll('#modal [data-color]')].filter(x => x.checked).map(x => x.dataset.color);
    if (!cols.length) return toast('Отметьте хотя бы один цвет');
    const pv = $('#m-price').value.trim(), price = pv === '' ? null : num(pv);
    cols.forEach(c => UI.selCat.it.push([name + ' ' + c.toUpperCase(), price]));
    modal(''); commit(); toast('Создано товаров: ' + cols.length);
  },
  /* клиенты и оплаты */
  'client-new': el => clientForm(null, el.dataset.name || ($('#ck-q') ? $('#ck-q').value.trim() : '')),
  'client-edit': el => clientForm(client(el.dataset.id)),
  'client-del': el => {
    const c = client(el.dataset.id), n = DB.orders.filter(o => o.clientId === c.id).length, np = DB.payments.filter(p => p.clientId === c.id).length;
    if (n || np) return toast('У клиента есть заказы (' + n + ') или оплаты (' + np + '). Сначала удалите их — иначе пропадёт история расчётов.', null, 6000);
    if (!confirm('Удалить клиента «' + c.name + '»? Его можно будет восстановить из «Удалённых».')) return;
    DB.clients = DB.clients.filter(x => x !== c); const t = trashPush('client', c, c.name); save(); go('#/clients'); undoToast('Клиент удалён', [t]);
  },
  'client-save': el => {
    const name = $('#f-name').value.trim(); if (!name) return toast('Введите имя клиента');
    const bt = $('#f-bt').value, amt = num($('#f-bal').value), opening = bt === 'adv' ? amt : bt === 'debt' ? -amt : 0;
    let c = el.dataset.id ? client(el.dataset.id) : null;
    if (!c && DB.clients.some(x => x.name.toLowerCase() === name.toLowerCase()) && !confirm('Клиент «' + name + '» уже есть. Создать ещё одного с таким же именем?')) return;
    if (!c) { c = { id: uid(), createdAt: Date.now() }; DB.clients.push(c); }
    Object.assign(c, { name, phone: $('#f-phone').value.trim(), opening, note: $('#f-note').value.trim() });
    modal(''); if (UI.ck && route().name === 'checkout') UI.ck.clientId = c.id;
    commit(); toast('Клиент сохранён');
  },
  'pay-new': el => payForm(el.dataset.id || ''),
  'pay-save': () => {
    const amt = num($('#p-amount').value); if (!amt) return toast('Введите сумму');
    const m = $('#p-method').value, d = $('#p-date').value || todayISO(), cid = $('#p-client').value, g = m === 'goods' ? readGoods('p') : null;
    if (g && !g.what) return toast('Напишите, что привёз клиент');
    const note = [g ? goodsNote(g) : '', $('#p-note').value.trim()].filter(Boolean).join(' · ');
    DB.payments.push({ id: uid(), clientId: cid, amount: amt, method: m, status: m === 'driver' ? 'pending' : 'received', date: d, receivedDate: m === 'driver' ? null : d, orderId: null, note, goods: g || undefined, createdAt: Date.now() });
    if (g) stockInGoods(g, cid);
    modal(''); commit(); toast(g ? 'Оплата товаром сохранена' + (g.stock ? ', товар оприходован на склад' : '') : 'Оплата сохранена');
  },
  'pay-del': el => {
    const p = DB.payments.find(x => x.id === el.dataset.id); if (!confirm('Удалить оплату ' + rub(p.amount) + '?')) return;
    DB.payments = DB.payments.filter(x => x !== p); const t = trashPush('payment', p, 'Оплата ' + rub(p.amount)); commit(); undoToast('Оплата удалена', [t]);
  },
  recv: el => { const p = DB.payments.find(x => x.id === el.dataset.id); p.status = 'received'; p.receivedDate = todayISO(); commit(); toast(rub(p.amount) + ' получено и зачтено клиенту'); },
  'modal-close': () => modal(''),
  'modal-bg': (el, e) => { if (e.target === el) modal(''); },
  /* данные */
  backup: async () => {
    const text = JSON.stringify(DB, null, 1), name = 'LIVARO копия ' + todayISO() + '.json';
    try {
      if (window.showSaveFilePicker) {
        const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Копия LIVARO', accept: { 'application/json': ['.json'] } }] });
        const w = await h.createWritable(); await w.write(text); await w.close();
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click();
      }
      DB.lastBackup = Date.now(); commit(); toast('Копия сохранена');
    } catch (e) { if (e && e.name !== 'AbortError') toast('Не удалось сохранить копию'); }
  },
  wipe: () => {
    if (!confirm('Удалить всех клиентов, накладные и оплаты? Товары останутся.')) return;
    if (!confirm('Точно? Это нельзя отменить без резервной копии.')) return;
    Object.assign(DB, { clients: [], orders: [], payments: [], trash: [], nextNo: 1 }); commit(); toast('Данные удалены');
  }
};
function moveFolder(dir) {
  const n = UI.selCat, arr = PARENT[n.id], i = arr.indexOf(n), j = i + dir;
  UI.catMenu = false;
  if (j < 0 || j >= arr.length) return render();
  arr.splice(i, 1); arr.splice(j, 0, n); commit();
}
/* порядок товаров: перетащили на строку товара — встаёт выше/ниже неё (выделенные — все вместе) */
function reorderItems(srcKey, targetKey, after) {
  const [tn, ti] = itemByKey(targetKey), target = tn.it[ti];
  let moving;
  if (UI.catChecked[srcKey] && Object.keys(UI.catChecked).length > 1) {
    if (UI.catChecked[targetKey]) return;
    moving = takeChecked().map(x => x.item);
  } else {
    const [sn, si] = itemByKey(srcKey); if (sn.it[si] === target) return;
    moving = [sn.it.splice(si, 1)[0]]; UI.catChecked = {};
  }
  let idx = tn.it.indexOf(target); if (after) idx++;
  tn.it.splice(idx, 0, ...moving); commit();
}
/* над папкой: верхняя четверть — «выше», нижняя — «ниже», середина — «внутрь» */
function zone(e, el) { const b = el.getBoundingClientRect(), y = e.clientY - b.top; return y < b.height * 0.28 ? 'before' : y > b.height * 0.72 ? 'after' : 'into'; }

document.addEventListener('click', e => {
  if (UI.catMenu && !e.target.closest('.menu,[data-act="cat-menu"]')) { UI.catMenu = false; render(); if (!e.target.closest('[data-act]')) return; }
  // меню «Ещё» в корзине закрывается любым щелчком (пункт меню при этом срабатывает)
  if (UI.cartMenu && !e.target.closest('[data-act="cart-menu"]')) { UI.cartMenu = false; if (!e.target.closest('[data-act]')) { render(); return; } }
  if (e.target.matches('input[type="checkbox"]')) return; // галочка в строке не открывает накладную
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const f = ACT[el.dataset.act];
  if (f) f(el, e);
});

/* поля: изменения после ввода */
const CH = {
  gtitle: el => { DB.cart.groups[+el.dataset.g].t = el.value; save(); },
  price: el => { DB.cart.groups[+el.dataset.g].items[+el.dataset.i].p = num(el.value); commit(); },
  'ck-date': el => { UI.ck.date = el.value; },
  'ck-amount': el => { UI.ck.amount = el.value; render(); },
  ccheck: el => { if (el.checked) UI.catChecked[el.dataset.k] = true; else delete UI.catChecked[el.dataset.k]; render(); },
  'ccheck-all': el => {
    const on = el.checked; UI.catChecked = {};
    if (on) document.querySelectorAll('[data-ch="ccheck"]').forEach(x => { UI.catChecked[x.dataset.k] = true; });
    render();
  },
  ssel: el => { UI.salesSel[el.dataset.id] = el.checked; if (!el.checked) delete UI.salesSel[el.dataset.id]; render(); },
  'ssel-all': el => {
    const on = el.checked; UI.salesSel = {};
    if (on) document.querySelectorAll('[data-ch="ssel"]').forEach(x => { UI.salesSel[x.dataset.id] = true; });
    render();
  },
  /* корзина удалённых: см. VIEWS.trash */
  cname: el => { const [nd, i] = itemByKey(el.dataset.k); nd.it[i][0] = el.value.trim(); save(); },
  cprice: el => { const [nd, i] = itemByKey(el.dataset.k); nd.it[i][1] = el.value.trim() === '' ? null : num(el.value); commit(); },
  'op-type': el => {
    const amt = document.querySelector('[data-ch="op-amt"][data-id="' + el.dataset.id + '"]');
    if (el.value === '0') amt.value = ''; else if (!amt.value) amt.focus();
    setOpening(el.dataset.id);
  },
  'op-amt': el => {
    const t = document.querySelector('[data-ch="op-type"][data-id="' + el.dataset.id + '"]');
    if (num(el.value) && t.value === '0') t.value = 'debt'; // ввели сумму — по умолчанию это долг
    setOpening(el.dataset.id);
  },
  'clients-import': el => {
    const f = el.files[0]; if (!f) return;
    if (typeof XLSX === 'undefined') return toast('Не загрузилась библиотека Excel (app/vendor)');
    const r = new FileReader();
    r.onload = () => {
      try {
        const wb = XLSX.read(new Uint8Array(r.result), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
        const res = importClients(rows); commit();
        toast('Добавлено клиентов: ' + res.added + (res.skipped ? ', уже были: ' + res.skipped : '') + '. Теперь можно ввести начальные долги.', null, 7000);
        if (res.added) go('#/opening');
      } catch (e) { toast('Не удалось прочитать файл. Сохраните список из 1С как «Лист Excel».'); }
    };
    r.readAsArrayBuffer(f); el.value = '';
  },
  restore: el => {
    const f = el.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d.cat || !d.orders) throw new Error();
        if (!confirm('Загрузить копию от файла «' + f.name + '»? Текущие данные будут заменены.')) return;
        DB = d; commit(); toast('Данные загружены из копии');
      } catch (e) { toast('Это не файл копии LIVARO'); }
    };
    r.readAsText(f);
  }
};
document.addEventListener('change', e => { const f = CH[e.target.dataset.ch]; if (f) f(e.target); });

/* поля: живой поиск (без перерисовки всей страницы, чтобы не терять курсор) */
const IN = {
  'rep-q': el => { UI.rep.q = el.value; $('#rep-list').innerHTML = repList(); },
  q: el => { UI.q = el.value; const box = document.createElement('div'); box.innerHTML = catalogPicker(); $('#cat-list').innerHTML = box.querySelector('#cat-list').innerHTML; $('#list-h').innerHTML = box.querySelector('#list-h').innerHTML; },
  'ck-q': el => { $('#ck-dd').innerHTML = ddHtml(el.value); },
  'bulk-amt': el => {
    UI.bulk.amount = el.value; const PM = payMap(), os = UI.bulk.ids.map(order).filter(Boolean);
    $('#b-hint').textContent = bulkHint(num(el.value), os.reduce((s, o) => s + remaining(o, PM[o.id]), 0), true);
    if ($('#b-what')) goodsCalc('b'); // оплата товаром: сверяем сумму с кол-вом × ценой
  },
  'ship-amt': el => { UI.ship.amount = el.value; $('#s-after').textContent = balTxt(shipAfter()); },
  'sales-q': el => { UI.salesQ = el.value; rerenderKeepFocus('sales-q'); },
  'client-q': el => { UI.clientQ = el.value; rerenderKeepFocus('client-q'); },
  'open-q': el => { UI.openQ = el.value; rerenderKeepFocus('open-q'); },
  'cat-q2': el => { UI.catQ = el.value; UI.catChecked = {}; rerenderKeepFocus('cat-q2'); }
};
function rerenderKeepFocus(id) { const pos = $('#' + id).selectionStart; render(); const f = $('#' + id); f.focus(); f.setSelectionRange(pos, pos); }
document.addEventListener('input', e => { const f = IN[e.target.dataset.in]; if (f) f(e.target); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#modal').innerHTML) modal('');
  if (e.key === 'Enter' && e.target.id === 'ck-q') { const b = $('#ck-dd button'); if (b) b.click(); }
});

/* ================= перетаскивание ================= */
let DRAG = null;
const clearOver = () => document.querySelectorAll('.over,.dt,.db,.drop').forEach(x => x.classList.remove('over', 'dt', 'db', 'drop'));
const below = (e, r) => { const b = r.getBoundingClientRect(); return e.clientY > b.top + b.height / 2; };
document.addEventListener('dragstart', e => {
  const t = e.target.closest ? e.target.closest('[data-drag],[data-cdrag],[data-tdrag]') : null;
  if (!t) return;
  DRAG = t.dataset.drag ? { k: 'row', v: t.dataset.drag } : t.dataset.cdrag !== undefined ? { k: 'item', v: t.dataset.cdrag } : { k: 'folder', v: t.dataset.tdrag };
  try { e.dataTransfer.setData('text', 'x'); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* старые браузеры */ }
  // подпись у курсора: сколько товаров переносим
  if (DRAG.k === 'item' && e.dataTransfer && e.dataTransfer.setDragImage) {
    const n = UI.catChecked[DRAG.v] ? Object.keys(UI.catChecked).length : 1;
    const g = document.createElement('div'); g.className = 'dragimg';
    g.textContent = n > 1 ? 'Перенести ' + n + ' ' + plural(n, 'товар', 'товара', 'товаров') : 'Перенести: ' + itemByKey(DRAG.v)[0].it[itemByKey(DRAG.v)[1]][0];
    document.body.appendChild(g); e.dataTransfer.setDragImage(g, 12, 12); setTimeout(() => g.remove(), 0);
  }
});
document.addEventListener('dragover', e => {
  if (!DRAG) return;
  if (DRAG.k === 'row') {
    const b = e.target.closest('.gbox[data-g]'); if (!b) return;
    e.preventDefault(); clearOver();
    const r = e.target.closest('[data-drag]'); if (r) r.classList.add(below(e, r) ? 'db' : 'dt'); else b.classList.add('over');
  } else {
    // товар над другим товаром — меняем порядок (синяя линия выше/ниже)
    if (DRAG.k === 'item') { const r = e.target.closest('tr.crow'); if (r) { e.preventDefault(); clearOver(); r.classList.add(below(e, r) ? 'db' : 'dt'); return; } }
    const n = e.target.closest('.tn[data-view="c"]'); if (!n) return;
    e.preventDefault(); clearOver();
    const z = DRAG.k === 'folder' ? zone(e, n) : 'into';
    n.classList.add(z === 'before' ? 'dt' : z === 'after' ? 'db' : 'drop');
    // задержали над закрытой папкой — раскрываем её (дерево перерисовываем отдельно, строку не трогаем)
    if (hoverTn !== n.dataset.id) {
      hoverTn = n.dataset.id; clearTimeout(hoverT);
      hoverT = setTimeout(() => {
        const node = NODES[hoverTn]; if (!DRAG || !node || !node.ch.length || node.open) return;
        node.open = true; const box = document.querySelector('[data-ks="ctree"]'); if (box) box.innerHTML = treeHtml(DB.cat, 0, 'c');
      }, 700);
    }
  }
});
document.addEventListener('drop', e => {
  if (!DRAG) return;
  const d = DRAG; DRAG = null;
  if (d.k === 'row') {
    const b = e.target.closest('.gbox[data-g]'); if (!b) return; e.preventDefault(); clearOver();
    const a = d.v.split('|').map(Number), r = e.target.closest('[data-drag]');
    const pos = r ? +r.dataset.drag.split('|')[1] + (below(e, r) ? 1 : 0) : null;
    moveRow(a[0], a[1], +b.dataset.g, pos);
    return;
  }
  if (d.k === 'item') { const r = e.target.closest('tr.crow'); if (r) { e.preventDefault(); clearOver(); reorderItems(d.v, r.dataset.k, below(e, r)); return; } }
  const t = e.target.closest('.tn[data-view="c"]'); if (!t) return; e.preventDefault(); clearOver();
  const to = NODES[t.dataset.id];
  if (d.k === 'item') {
    // перетащили отмеченный товар — переносим все отмеченные, иначе только его
    if (UI.catChecked[d.v] && Object.keys(UI.catChecked).length > 1) {
      const moved = takeChecked(); to.it.push(...moved.map(x => x.item)); toast('Перенесено ' + moved.length + ' в «' + to.n + '»'); commit(); return;
    }
    const [from, i] = itemByKey(d.v); if (!from || from === to) return;
    to.it.push(from.it.splice(i, 1)[0]); UI.catChecked = {}; toast('Товар перенесён в «' + to.n + '»'); commit();
  } else {
    const f = NODES[d.v]; if (!f || f === to || t.dataset.id.indexOf(d.v + '-') === 0) return;
    const z = zone(e, t);
    PARENT[d.v].splice(PARENT[d.v].indexOf(f), 1);
    if (z === 'into') { to.ch.push(f); to.open = true; toast('Папка перенесена в «' + to.n + '»'); }
    else { const arr = PARENT[t.dataset.id]; arr.splice(arr.indexOf(to) + (z === 'after' ? 1 : 0), 0, f); }
    commit();
  }
});
document.addEventListener('dragend', () => { DRAG = null; hoverTn = null; clearTimeout(hoverT); clearOver(); dragReset(); });
/* строка корзины становится перетаскиваемой только пока зажата ручка ⠿;
   в остальных списках — не перетаскиваем, если мышь нажата в поле ввода (цена, количество) */
document.addEventListener('mousedown', e => {
  const g = e.target.closest('[data-grip]');
  if (g) { const r = g.closest('[data-drag]'); if (r) r.setAttribute('draggable', 'true'); return; }
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
    const r = e.target.closest('[draggable="true"]'); if (r) { r.setAttribute('draggable', 'false'); r.dataset.dragoff = '1'; }
  }
});
function dragReset() {
  document.querySelectorAll('tr[data-drag][draggable]').forEach(r => r.removeAttribute('draggable'));
  document.querySelectorAll('[data-dragoff]').forEach(r => { r.setAttribute('draggable', 'true'); delete r.dataset.dragoff; });
}
document.addEventListener('mouseup', dragReset);
let hoverTn = null, hoverT = null;

/* двойной щелчок по названию товара — изменить его на месте */
document.addEventListener('dblclick', e => {
  const s = e.target.closest('[data-dbl="cname"]'); if (!s) return;
  const [nd, i] = itemByKey(s.dataset.k), inp = document.createElement('input');
  inp.className = 'inp'; inp.value = nd.it[i][0]; inp.style.cssText = 'min-height:34px;padding:5px 10px;width:calc(100% - 22px)';
  s.replaceWith(inp); inp.focus(); inp.select();
  let done = false;
  const finish = ok => { if (done) return; done = true; if (ok && inp.value.trim()) nd.it[i][0] = inp.value.trim(); commit(); };
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') finish(true); if (ev.key === 'Escape') finish(false); });
  inp.addEventListener('blur', () => finish(true));
});

/* ================= РАССРОЧКА (розничные покупатели) ================= */
/* s = { id, no, date, buyer:{name,phone,address,note}, groups, price, pct, pctBase:'all'|'rest', markup, total,
         down, months, schedule:[{date, amount}], pays:[{id,date,amount,method,kind?,note}], createdAt } */
const instNo = s => 'Р-' + s.no;
function addMonthsISO(iso, n) {
  const d = new Date(iso + 'T12:00:00'), day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return isoOf(d);
}
/* остаток делим на месяцы, суммы круглые (до сотни), хвост — в последний платёж */
function makeSchedule(rest, months, startISO) {
  const base = Math.floor(rest / months / 100) * 100, out = [];
  for (let i = 1; i <= months; i++) out.push({ date: addMonthsISO(startISO, i), amount: i < months ? base : rest - base * (months - 1) });
  return out;
}
function instTerms(price, pct, base, down) {
  const markup = Math.round((base === 'rest' ? Math.max(0, price - down) : price) * pct / 100), total = price + markup;
  return { markup, total, rest: Math.max(0, total - down) };
}
/* платежи сверх первого взноса закрывают график по порядку */
function instCalc(s) {
  const paidAll = s.pays.reduce((a, p) => a + p.amount, 0), today = todayISO();
  let cover = paidAll - s.down, next = null, overdue = 0, overdueN = 0;
  const rows = s.schedule.map(r => {
    const paid = Math.max(0, Math.min(r.amount, cover)); cover -= paid;
    const st = paid >= r.amount ? 'paid' : r.date < today ? 'late' : paid > 0 ? 'part' : 'wait';
    if (st === 'late') { overdue += r.amount - paid; overdueN++; }
    if (!next && paid < r.amount) next = { date: r.date, amount: r.amount - paid, late: r.date < today };
    return Object.assign({}, r, { paid, st });
  });
  const rest = Math.max(0, s.total - paidAll);
  return { paidAll, rest, rows, next, overdue, overdueN, closed: rest <= 0 };
}
const INST_ST = { paid: ['paid', 'Оплачен'], part: ['part', 'Частично'], late: ['unpaid', 'Просрочен'], wait: ['ordered', 'Ожидается'] };
const instLate = () => DB.installments.filter(s => instCalc(s).overdueN > 0).length;

/* ---------- список ---------- */
VIEWS.inst = () => {
  const f = UI.instF || 'active', q = (UI.instQ || '').toLowerCase(), wk = isoOf(addD(D0(), 7));
  const all = DB.installments.map(s => ({ s, c: instCalc(s) }));
  const list = all.filter(({ s, c }) => (f === 'all' || (f === 'active' && !c.closed) || (f === 'late' && c.overdueN) || (f === 'closed' && c.closed)) &&
    (!q || s.buyer.name.toLowerCase().includes(q) || (s.buyer.phone || '').includes(q) || instNo(s).toLowerCase() === q))
    .sort((a, b) => (a.c.closed - b.c.closed) || ((a.c.next || {}).date || '9').localeCompare((b.c.next || {}).date || '9'));
  const act = all.filter(x => !x.c.closed), restSum = act.reduce((a, x) => a + x.c.rest, 0), late = all.filter(x => x.c.overdueN);
  const week = act.reduce((a, x) => a + x.c.rows.filter(r => r.st !== 'paid' && r.date <= wk).reduce((b, r) => b + r.amount - r.paid, 0), 0);
  return '<div class="head"><div><h1>Рассрочка</h1><div class="sub-h">Розничные покупатели в рассрочку до 4 месяцев. Новая рассрочка оформляется из корзины кнопкой «В рассрочку».</div></div><a class="btn pri" href="#/order">Новая рассрочка</a></div>' +
    '<div class="kpis">' +
    '<div class="kpi"><div class="l">Ждём к получению</div><div class="v">' + rub(restSum) + '</div><div class="h">' + act.length + ' ' + plural(act.length, 'рассрочка', 'рассрочки', 'рассрочек') + '</div></div>' +
    '<div class="kpi"><div class="l">Просрочено</div><div class="v debt">' + rub(late.reduce((a, x) => a + x.c.overdue, 0)) + '</div><div class="h">' + late.length + ' ' + plural(late.length, 'покупатель', 'покупателя', 'покупателей') + '</div></div>' +
    '<div class="kpi"><div class="l">Платежи до ' + ru(wk).slice(0, 5) + '</div><div class="v">' + rub(week) + '</div><div class="h">включая просроченные</div></div></div>' +
    '<div class="card"><div class="filters"><div class="fgroup"><span>Показать</span>' + seg(f, 'inst-f', [['active', 'Активные'], ['late', 'Просрочка', late.length], ['closed', 'Закрытые'], ['all', 'Все']]) + '</div>' +
    '<label class="search">' + icon('search', 16) + '<input class="inp" id="inst-q" data-in="inst-q" placeholder="Покупатель, телефон или номер" value="' + esc(UI.instQ || '') + '"></label></div></div>' +
    '<div class="card tcard">' + (list.length ? '<div class="scroll"><table class="t" style="min-width:860px"><thead><tr><th>№</th><th>Покупатель</th><th>Оформлено</th><th class="num">Сумма</th><th class="num">Оплачено</th><th class="num">Остаток</th><th>Следующий платёж</th></tr></thead><tbody>' +
      list.map(({ s, c }) => '<tr class="click" data-act="go" data-to="#/ins/' + s.id + '"><td class="c-no">' + instNo(s) + '</td><td class="c-client">' + esc(s.buyer.name) + '<div class="hint">' + esc(s.buyer.phone || '') + '</div></td>' +
        '<td>' + ru(s.date) + '<div class="hint">' + s.months + ' мес. · ' + s.pct + '%</div></td><td class="num amount">' + rub(s.total) + '</td><td class="num adv">' + rub(c.paidAll) + '</td>' +
        '<td class="num">' + (c.rest ? '<span class="rest">' + rub(c.rest) + '</span>' : st('paid', 'Закрыта')) + '</td>' +
        '<td>' + (c.next ? (c.next.late ? st('unpaid', 'просрочен ' + ru(c.next.date)) : ru(c.next.date)) + ' · <b>' + rub(c.next.amount) + '</b>' : '<span class="muted">—</span>') + '</td></tr>').join('') +
      '</tbody></table></div>' : '<div class="empty">' + (DB.installments.length ? 'По этим условиям ничего нет' : 'Рассрочек пока нет. Соберите товары в корзине и нажмите «В рассрочку».') + '</div>') + '</div>';
};

/* ---------- оформление ---------- */
function instDraft() {
  if (!UI.ins) UI.ins = { name: '', phone: '', address: '', note: '', date: todayISO(), months: 4, pct: 10, pctBase: 'all', down: '', downMethod: 'cash', schedule: null };
  const x = UI.ins, price = orderTotal(DB.cart.groups), down = num(x.down), t = instTerms(price, num(x.pct), x.pctBase, down);
  if (!x.schedule || x.schedKey !== [t.rest, x.months, x.date].join('|')) { x.schedule = makeSchedule(t.rest, x.months, x.date); x.schedKey = [t.rest, x.months, x.date].join('|'); }
  return Object.assign({ price, down }, t);
}
VIEWS.instnew = () => {
  if (!cartCount()) return '<div class="head"><h1>Рассрочка</h1></div><div class="card empty">Корзина пуста. <a href="#/order">Выбрать товары</a></div>';
  const x = UI.ins || (instDraft(), UI.ins), t = instDraft(), schedSum = x.schedule.reduce((a, r) => a + r.amount, 0);
  const fld = (f, label, ph, type) => '<label class="fld">' + label + '<input class="inp"' + (type ? ' type="' + type + '"' : '') + ' data-ch="i-field" data-f="' + f + '" value="' + esc(x[f]) + '"' + (ph ? ' placeholder="' + ph + '"' : '') + '></label>';
  return '<div class="head"><div><div class="crumb">Корзина → рассрочка</div><h1>Оформление рассрочки № Р-' + DB.instNo + '</h1></div><div class="btns"><a class="btn" href="#/order">← Назад в корзину</a>' +
    '<button class="btn pri big" data-act="inst-save">Оформить рассрочку</button></div></div>' +
    '<div class="row"><div class="grow">' +
    '<div class="card"><h2>Покупатель</h2><div class="form">' + fld('name', 'ФИО *', 'Фамилия Имя Отчество') + fld('phone', 'Телефон', '+7 …', 'tel') +
    '<div style="grid-column:1/-1">' + fld('address', 'Адрес', 'Город, улица, дом, квартира') + '</div><div style="grid-column:1/-1">' + fld('note', 'Комментарий', 'Паспорт, место работы, поручитель…') + '</div></div></div>' +
    '<div class="card"><h2>Условия</h2><div class="filters" style="margin-bottom:14px"><div class="fgroup"><span>Срок</span>' + seg(String(x.months), 'i-months', [['1', '1 мес.'], ['2', '2 мес.'], ['3', '3 мес.'], ['4', '4 мес.']]) + '</div>' +
    '<div class="fgroup"><span>Процент начисляется</span>' + seg(x.pctBase, 'i-base', [['all', 'на всю сумму'], ['rest', 'на остаток после взноса']]) + '</div></div>' +
    '<div class="form">' + fld('pct', 'Процент переплаты, %', '10') + fld('down', 'Первый взнос, ₽', '0') +
    '<label class="fld">Взнос внесён<select class="inp" data-ch="i-field" data-f="downMethod"><option value="cash"' + (x.downMethod === 'cash' ? ' selected' : '') + '>Наличными</option><option value="transfer"' + (x.downMethod === 'transfer' ? ' selected' : '') + '>Переводом</option></select></label>' +
    fld('date', 'Дата оформления', '', 'date') + '</div></div>' +
    '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0">График платежей</h2><button class="btn sm" data-act="i-resched">Пересчитать заново</button></div>' +
    '<div class="hint" style="margin:6px 0 10px">Даты и суммы можно поменять — например, подстроить под дни зарплаты покупателя.</div>' +
    '<table class="t"><thead><tr><th>№</th><th>Дата платежа</th><th class="num">Сумма, ₽</th></tr></thead><tbody>' +
    x.schedule.map((r, i) => '<tr><td>' + (i + 1) + '</td><td><input class="inp" type="date" style="max-width:200px" data-ch="i-sdate" data-i="' + i + '" value="' + r.date + '"></td>' +
      '<td class="num"><input class="inp pin" style="width:130px" data-ch="i-samt" data-i="' + i + '" value="' + fmt(r.amount) + '"></td></tr>').join('') +
    '</tbody></table>' + (schedSum !== t.rest ? '<div class="warn" style="margin-top:10px">Сумма графика ' + rub(schedSum) + ' не равна остатку ' + rub(t.rest) + '. Поправьте суммы или нажмите «Пересчитать заново».</div>' : '') + '</div></div>' +
    '<div class="aside"><div class="card"><h2>Товары</h2>' + DB.cart.groups.filter(g => g.items.length).map(g => '<div class="line"><span>' + esc(g.t) + '</span><b>' + rub(gsum(g)) + '</b></div>').join('') + '</div>' +
    '<div class="card"><h2>Расчёт</h2>' +
    '<div class="line"><span class="muted">Цена товара</span><span>' + rub(t.price) + '</span></div>' +
    '<div class="line"><span class="muted">Переплата ' + num(x.pct) + '%</span><span>+' + rub(t.markup) + '</span></div>' +
    '<div class="line tot"><span>Цена в рассрочку</span><span>' + rub(t.total) + '</span></div>' +
    '<div class="line"><span class="muted">Первый взнос</span><span>−' + rub(t.down) + '</span></div>' +
    '<div class="line tot debt"><span>Остаток выплатить</span><span>' + rub(t.rest) + '</span></div>' +
    '<div class="hint">' + x.months + ' ' + plural(x.months, 'платёж', 'платежа', 'платежей') + ' примерно по ' + rub(Math.round(t.rest / x.months)) + '</div></div></div></div>';
};

/* ---------- карточка рассрочки ---------- */
VIEWS.ins = ([id]) => {
  const s = DB.installments.find(x => x.id === id);
  if (!s) return '<div class="card empty">Рассрочка не найдена. <a href="#/inst">К списку</a></div>';
  const c = instCalc(s), b = s.buyer;
  return '<div class="head"><div><div class="crumb"><a href="#/inst">Рассрочка</a> / ' + instNo(s) + '</div>' +
    '<h1>' + esc(b.name) + ' <span style="vertical-align:middle">' + (c.closed ? st('paid', 'Закрыта') : c.overdueN ? st('unpaid', 'Просрочка') : st('ordered', 'Платит')) + '</span></h1>' +
    '<div class="sub-h">' + esc([b.phone, b.address].filter(Boolean).join(' · ')) + (b.note ? '<br>' + esc(b.note) : '') + '</div></div>' +
    '<div class="btns">' + (c.closed ? '' : '<button class="btn pri big" data-act="ipay-new" data-id="' + s.id + '">Принять платёж</button>') +
    '<a class="btn" href="#/iprint/' + s.id + '">Печать накладной</a><button class="btn" data-act="wa-inst" data-id="' + s.id + '">' + icon('message', 16) + 'WhatsApp</button>' +
    '<span style="width:1px;height:28px;background:var(--line)"></span><button class="btn danger" data-act="inst-del" data-id="' + s.id + '">Удалить</button></div></div>' +
    '<div class="kpis"><div class="kpi"><div class="l">Цена в рассрочку</div><div class="v">' + rub(s.total) + '</div><div class="h">товар ' + rub(s.price) + ' + ' + s.pct + '% (' + rub(s.markup) + ')</div></div>' +
    '<div class="kpi"><div class="l">Оплачено</div><div class="v adv">' + rub(c.paidAll) + '</div><div class="h">включая взнос ' + rub(s.down) + '</div></div>' +
    '<div class="kpi"><div class="l">Остаток</div><div class="v ' + (c.rest ? 'debt' : 'adv') + '">' + rub(c.rest) + '</div><div class="h">' + (c.overdue ? 'просрочено ' + rub(c.overdue) : c.closed ? 'выплачено полностью' : 'без просрочки') + '</div></div>' +
    '<div class="kpi"><div class="l">Следующий платёж</div><div class="v">' + (c.next ? rub(c.next.amount) : '—') + '</div><div class="h">' + (c.next ? (c.next.late ? 'был ' : '') + ru(c.next.date) : '') + '</div></div></div>' +
    '<div class="row"><div class="grow"><div class="card tcard"><div style="padding:16px 18px 0"><h2>График платежей · ' + s.months + ' мес.</h2></div><table class="t"><thead><tr><th>№</th><th>Дата</th><th class="num">Сумма</th><th class="num">Оплачено</th><th>Статус</th></tr></thead><tbody>' +
    c.rows.map((r, i) => '<tr><td>' + (i + 1) + '</td><td>' + ru(r.date) + '</td><td class="num amount">' + rub(r.amount) + '</td><td class="num">' + (r.paid ? rub(r.paid) : '—') + '</td><td>' + st(INST_ST[r.st][0], INST_ST[r.st][1]) + '</td></tr>').join('') +
    '</tbody></table></div><div class="card">' + groupsTable(s) + '</div></div>' +
    '<div class="aside"><div class="card"><h2>Платежи</h2>' + (s.pays.length ? s.pays.slice().sort((a, b) => b.date.localeCompare(a.date)).map(p => '<div class="line" style="align-items:center"><span>' + ru(p.date) + ' · ' + METHOD[p.method] +
      (p.kind === 'down' ? ' <span class="muted">· первый взнос</span>' : '') + (p.note ? '<div class="hint">' + esc(p.note) + '</div>' : '') + '</span><span style="white-space:nowrap"><b class="adv">' + rub(p.amount) + '</b>' +
      '<button class="x" data-act="ipay-del" data-id="' + s.id + '" data-p="' + p.id + '" aria-label="Удалить платёж">×</button></span></div>').join('') : '<div class="hint">Платежей ещё не было</div>') + '</div>' +
    '<div class="card"><h2>Условия</h2><div class="line"><span class="muted">Оформлено</span><span>' + ru(s.date) + '</span></div><div class="line"><span class="muted">Срок</span><span>' + s.months + ' мес.</span></div>' +
    '<div class="line"><span class="muted">Переплата</span><span>' + s.pct + '% ' + (s.pctBase === 'rest' ? 'на остаток' : 'на всю сумму') + '</span></div><div class="line"><span class="muted">Первый взнос</span><span>' + rub(s.down) + '</span></div></div></div></div>';
};

/* ---------- накладная рассрочки ---------- */
VIEWS.iprint = ([id]) => {
  const s = DB.installments.find(x => x.id === id);
  if (!s) return '<div class="card empty">Рассрочка не найдена</div>';
  const c = instCalc(s), b = s.buyer;
  let rows = '';
  // покупателю наценка не видна: суммы шкафов сразу с учётом рассрочки (остаток округления — в последний), детали без цен
  const k = s.price ? s.total / s.price : 1; let left = s.total;
  s.groups.forEach((g, gi) => {
    const sm = gi === s.groups.length - 1 ? left : Math.round(gsum(g) * k); left -= sm;
    rows += '<tr class="g"><td>' + (gi + 1) + '</td><td>' + esc(g.t) + '</td><td class="num">1 шт</td><td class="num">' + fmt(sm) + ',00</td></tr>';
    g.items.forEach(it => { rows += '<tr class="c"><td></td><td class="nm">' + esc(it.n) + '</td><td class="num">' + it.q + '</td><td></td></tr>'; });
  });
  return '<div class="btns noprint" style="justify-content:center"><a class="btn" href="#/ins/' + s.id + '">← К рассрочке</a><button class="btn pri" data-act="print">Распечатать</button>' +
    '<button class="btn" data-act="wa-inst" data-id="' + s.id + '">' + icon('message', 16) + 'WhatsApp</button></div>' +
    '<div class="paperwrap"><div class="paper">' +
    '<div class="p-head"><div class="brand">LIVARO</div><div style="text-align:right;font-size:15px"><b>Накладная (рассрочка) № ' + instNo(s) + '</b> от ' + ru(s.date) + '</div></div>' +
    '<div class="kv"><div class="k">Продавец</div><div><b>LIVARO</b></div><div class="k">Покупатель</div><div><b>' + esc(b.name) + '</b></div>' +
    (b.phone ? '<div class="k">Телефон</div><div>' + esc(b.phone) + '</div>' : '') + (b.address ? '<div class="k">Адрес</div><div>' + esc(b.address) + '</div>' : '') + '</div>' +
    '<table class="p-t"><thead><tr><th style="width:20px">№</th><th>Наименование</th><th class="num" style="width:50px">Кол-во</th><th class="num" style="width:90px">Сумма, ₽</th></tr></thead><tbody>' + rows +
    '<tr><td colspan="3" class="num"><b>Итого</b></td><td class="num"><b>' + fmt(s.total) + ',00</b></td></tr></tbody></table>' +
    '<div style="display:flex;gap:16px;align-items:flex-start">' +
    '<div class="bal" style="flex:1 1 0"><div style="font-weight:700;margin-bottom:2px">Условия рассрочки</div>' +
    '<div class="line" style="font-weight:700"><span>Цена в рассрочку</span><span>' + fmt(s.total) + ',00</span></div>' +
    '<div class="line"><span>Первый взнос</span><span>' + fmt(s.down) + ',00</span></div>' +
    '<div class="line"><span>Срок</span><span>' + s.months + ' мес.</span></div>' +
    '<div class="line" style="font-size:14px;font-weight:700;border-top:1px solid #111316;padding-top:4px;margin-top:4px"><span>Остаток к оплате</span><span>' + fmt(c.rest) + ',00 руб.</span></div></div>' +
    '<div style="flex:1 1 0"><table class="p-t"><thead><tr><th>№</th><th>Дата платежа</th><th class="num">Сумма, ₽</th><th>Отметка</th></tr></thead><tbody>' +
    c.rows.map((r, i) => '<tr><td>' + (i + 1) + '</td><td>' + ru(r.date) + '</td><td class="num">' + fmt(r.amount) + ',00</td><td>' + (r.st === 'paid' ? 'оплачен' : '') + '</td></tr>').join('') +
    '</tbody></table></div></div>' +
    '<div style="font-size:12px">' + words(s.total) + ' — цена в рассрочку. Покупатель обязуется вносить платежи в указанные даты.</div>' +
    '<div class="sign" style="grid-template-columns:1fr 1fr"><div class="s"><b>Продавец (LIVARO)</b><div>подпись / расшифровка</div></div><div class="s"><b>Покупатель, с условиями согласен, товар получил</b><div>подпись / расшифровка</div></div></div>' +
    '</div></div>';
};

/* ---------- платёж ---------- */
function ipayForm(id) {
  const s = DB.installments.find(x => x.id === id), c = instCalc(s), sug = c.overdue || (c.next ? c.next.amount : c.rest);
  modal('<h2 style="margin:0">Платёж по рассрочке ' + instNo(s) + '</h2><div class="hint">' + esc(s.buyer.name) + ' · остаток ' + rub(c.rest) + (c.overdue ? ' · просрочено ' + rub(c.overdue) : '') + '</div>' +
    '<div class="form"><label class="fld">Сумма, ₽<input class="inp" id="ip-amount" value="' + fmt(Math.min(sug, c.rest)) + '"></label><label class="fld">Дата<input class="inp" type="date" id="ip-date" value="' + todayISO() + '"></label></div>' +
    '<label class="fld">Способ<select class="inp" id="ip-method"><option value="cash">Наличные</option><option value="transfer">Перевод</option></select></label>' +
    '<label class="fld">Комментарий<input class="inp" id="ip-note"></label>' +
    '<div class="btns" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="ipay-save" data-id="' + s.id + '">Сохранить</button></div>');
  $('#ip-amount').select();
}

Object.assign(ACT, {
  'to-inst': () => { DB.cart.groups = DB.cart.groups.filter(g => g.items.length); DB.cart.cur = 0; save(); go('#/instnew'); },
  'inst-f': el => { UI.instF = el.dataset.v; render(); },
  'i-months': el => { UI.ins.months = +el.dataset.v; render(); },
  'i-base': el => { UI.ins.pctBase = el.dataset.v; render(); },
  'i-resched': () => { UI.ins.schedule = null; render(); },
  'inst-save': () => {
    const x = UI.ins, t = instDraft();
    if (!x.name.trim()) { toast('Введите ФИО покупателя'); const f = document.querySelector('[data-f="name"]'); if (f) f.focus(); return; }
    if (t.down > t.total) return toast('Первый взнос больше цены');
    const schedSum = x.schedule.reduce((a, r) => a + r.amount, 0);
    if (schedSum !== t.rest && !confirm('Сумма графика (' + rub(schedSum) + ') не равна остатку (' + rub(t.rest) + '). Всё равно оформить?')) return;
    const s = { id: uid(), no: DB.instNo++, date: x.date || todayISO(), buyer: { name: x.name.trim(), phone: x.phone.trim(), address: x.address.trim(), note: x.note.trim() },
      groups: clone(DB.cart.groups.filter(g => g.items.length)), price: t.price, pct: num(x.pct), pctBase: x.pctBase, markup: t.markup, total: t.total,
      down: t.down, months: x.months, schedule: clone(x.schedule), pays: [], createdAt: Date.now() };
    if (t.down) s.pays.push({ id: uid(), date: s.date, amount: t.down, method: x.downMethod, kind: 'down', note: '' });
    DB.installments.push(s); DB.cart = { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }; UI.ins = null;
    save(); go('#/ins/' + s.id); toast('Рассрочка ' + instNo(s) + ' оформлена');
  },
  'ipay-new': el => ipayForm(el.dataset.id),
  'ipay-save': el => {
    const s = DB.installments.find(x => x.id === el.dataset.id), amt = num($('#ip-amount').value);
    if (!amt) return toast('Введите сумму');
    s.pays.push({ id: uid(), date: $('#ip-date').value || todayISO(), amount: amt, method: $('#ip-method').value, note: $('#ip-note').value.trim() });
    modal(''); commit(); toast(instCalc(s).closed ? 'Рассрочка полностью оплачена' : 'Платёж сохранён');
  },
  'ipay-del': el => {
    const s = DB.installments.find(x => x.id === el.dataset.id), p = s.pays.find(x => x.id === el.dataset.p);
    if (!confirm('Удалить платёж ' + rub(p.amount) + ' от ' + ru(p.date) + '?')) return;
    s.pays = s.pays.filter(x => x !== p); if (p.kind === 'down') s.down = 0; commit();
  },
  'inst-del': el => {
    const s = DB.installments.find(x => x.id === el.dataset.id);
    if (!confirm('Удалить рассрочку ' + instNo(s) + ' (' + s.buyer.name + ')? Её можно будет восстановить из «Удалённых».')) return;
    DB.installments = DB.installments.filter(x => x !== s); const t = trashPush('inst', s, 'Рассрочка ' + instNo(s));
    save(); go('#/inst'); undoToast('Рассрочка удалена', [t]);
  },
  'wa-inst': async el => {
    const s = DB.installments.find(x => x.id === el.dataset.id);
    const label = el.innerHTML; el.disabled = true; el.textContent = 'Готовлю картинку…';
    const blob = await paperImage(VIEWS.iprint([s.id])).catch(() => null);
    el.disabled = false; el.innerHTML = label;
    if (!blob) return toast('Не удалось подготовить картинку');
    sharePng(blob, 'Рассрочка ' + instNo(s) + ' LIVARO.png', waPhone(s.buyer.phone));
  }
});
Object.assign(CH, {
  'i-field': el => { UI.ins[el.dataset.f] = el.value; if (/^(pct|down|date)$/.test(el.dataset.f)) render(); },
  'i-sdate': el => { UI.ins.schedule[+el.dataset.i].date = el.value; },
  'i-samt': el => { UI.ins.schedule[+el.dataset.i].amount = num(el.value); render(); }
});
Object.assign(IN, { 'inst-q': el => { UI.instQ = el.value; rerenderKeepFocus('inst-q'); } });

/* ================= УПАКОВКА И ЭТИКЕТКИ НА КОРОБКИ ================= */
/* правило упаковки: { mode: 'box' (n коробок на 1 шт) | 'per' (n шт в коробке) | 'kit' (в пакет фурнитуры шкафа) | 'none', n, fragile }
   берётся у товара (it[2]), иначе у ближайшей папки (node.pack), иначе угадывается по названию */
const PACK_MODES = [['box', 'Коробок на 1 шт'], ['per', 'Штук в одной коробке'], ['kit', 'В общий пакет фурнитуры шкафа'], ['none', 'Не упаковывается (без этикетки)']];
function autoPack(name) {
  const s = name.toLowerCase();
  if (/ручк|карниз|фурнитур|механизм|ткань/.test(s)) return { mode: 'kit' };
  if (/зеркал/.test(s)) return { mode: 'per', n: 1, fragile: true }; // зеркало — всегда по одному
  if (/рамк|стекл|двер(?!н)|фасад/.test(s)) return { mode: 'per', n: 2, fragile: true }; // двери по 2; «дверный шкаф» — не дверь
  if (/коробка\s*№\s*1\s*и\s*№\s*2/.test(s)) return { mode: 'box', n: 2 };
  if (/^\+|доп/.test(s)) return { mode: 'none' };
  return { mode: 'box', n: 1 };
}
function findItem(name) {
  for (const id in NODES) { const it = NODES[id].it.find(x => x[0] === name); if (it) return { node: NODES[id], it }; }
  return null;
}
function folderPack(node) {
  let id = node.id;
  while (id !== undefined && id !== '') { const nd = NODES[id]; if (nd && nd.pack) return nd.pack; const k = id.lastIndexOf('-'); id = k < 0 ? '' : id.slice(0, k); }
  return null;
}
function packRule(name) {
  const f = findItem(name);
  if (f && f.it[2] && f.it[2].mode) return f.it[2];
  return (f && folderPack(f.node)) || autoPack(name);
}
function packText(r) {
  if (!r) return '';
  const t = r.mode === 'box' ? (r.n || 1) + ' ' + plural(r.n || 1, 'коробка', 'коробки', 'коробок') + ' на 1 шт' : r.mode === 'per' ? 'по ' + (r.n || 1) + ' шт в коробке' : r.mode === 'kit' ? 'в пакет фурнитуры' : 'не упаковывается';
  return t + (r.fragile ? ' · хрупкое' : '');
}
const ceil = (a, b) => Math.ceil(a / Math.max(1, b));
/* нечётный остаток: 'join' — докладываем в последнюю коробку (3 двери = 1 коробка), 'split' — отдельной коробкой */
const oddMode = () => (DB.settings && DB.settings.oddDoor) || 'join';
const perBoxes = (q, n) => n > 1 && oddMode() === 'join' ? Math.max(1, Math.floor(q / n)) : ceil(q, n);
const labelName = n => n.replace(/\(\s*коробк[аи][^)]*\)/i, '').replace(/\s+/g, ' ').trim(); // номер коробки и так пишется ниже
/* места заказа; adj — правки с экрана этикеток: { 'g|i': {c, fr}, 'g|kit': {c} } */
function buildPlaces(o, adj) {
  adj = adj || {}; const places = [], lines = [];
  o.groups.forEach((g, gi) => {
    const kit = [];
    g.items.forEach((it, ii) => {
      const r = packRule(it.n), k = gi + '|' + ii, a = adj[k] || {}, fr = a.fr !== undefined ? a.fr : !!r.fragile;
      if (r.mode === 'kit') { kit.push(it); lines.push({ k, g, it, r, c: null, fr }); return; }
      const def = r.mode === 'box' ? it.q * (r.n || 1) : r.mode === 'per' ? perBoxes(it.q, r.n || 1) : 0, c = a.c !== undefined ? a.c : def;
      lines.push({ k, g, it, r, c, fr });
      if (!c) return;
      if (r.mode === 'per') { // делим штуки по коробкам поровну
        let left = it.q;
        for (let b = 1; b <= c; b++) { const n = Math.ceil(left / (c - b + 1)); left -= n; places.push({ gi, g: g.t, text: labelName(it.n) + ' — ' + n + ' шт', sub: c > 1 ? 'коробка ' + b + ' из ' + c : '', fr }); }
      } else for (let b = 1; b <= c; b++) places.push({ gi, g: g.t, text: labelName(it.n), sub: c > 1 ? 'коробка ' + b + ' из ' + c : '', fr });
    });
    if (kit.length) {
      const k = gi + '|kit', c = adj[k] && adj[k].c !== undefined ? adj[k].c : 1, fr = kit.some(it => (adj[gi + '|' + g.items.indexOf(it)] || {}).fr);
      lines.push({ k, g, kit: true, c });
      for (let b = 1; b <= c; b++) places.push({ gi, g: g.t, text: 'Фурнитура: ' + kit.map(it => it.n + (it.q > 1 ? ' — ' + it.q + ' шт' : '')).join('; '), sub: c > 1 ? 'пакет ' + b + ' из ' + c : '', fr });
    }
  });
  // номер места считается внутри своего шкафа (группы заказа): «Шкаф 2 из 4 · место 1 / 3»
  const cnt = {}, seen = {};
  places.forEach(p => { cnt[p.gi] = (cnt[p.gi] || 0) + 1; });
  places.forEach(p => { p.n = seen[p.gi] = (seen[p.gi] || 0) + 1; p.of = cnt[p.gi]; });
  lines.forEach(l => { l.gi = o.groups.indexOf(l.g); });
  return { places, lines, cnt };
}
VIEWS.labels = ([id]) => {
  const o = order(id);
  if (!o) return '<div class="card empty">Заказ не найден</div>';
  const c = client(o.clientId) || { name: '—' }, adj = (UI.lbl && UI.lbl.id === o.id) ? UI.lbl.adj : {}, P = buildPlaces(o, adj), N = P.places.length;
  const date = ru(o.shipDate || o.date), G = o.groups.length;
  const lab = (p, i) => '<div class="lab"><div class="lside"><span>LIVARO</span></div>' + // вариант № 8: чёрная полоса слева
    '<div class="ord">Заказ № ' + o.no + '<span class="ldate">' + date + '</span></div><div class="cli">' + esc(c.name) + '</div>' +
    '<div class="cab"><b>' + (G > 1 ? (p.gi + 1) + '. ' : '') + esc(p.g) + '</b></div><div class="what">' + esc(p.text) + (p.sub ? '<br>' + p.sub : '') + '</div>' +
    (p.fr ? '<div class="fragile">ХРУПКОЕ</div>' : '') + '<div class="lnum"><small>Место</small><b>' + p.n + ' / ' + p.of + '</b></div></div>';
  const a4 = (DB.settings && DB.settings.labelFmt) === 'a4';
  let sheets = '';
  if (a4) for (let s = 0; s < N; s += 8) { // лист А4 на 8 наклеек
    let cells = P.places.slice(s, s + 8).map((p, j) => lab(p, s + j)).join('');
    for (let e = Math.min(8, N - s); e < 8; e++) cells += '<div class="lab lempty"></div>';
    sheets += '<div class="lsheet">' + cells + '</div>';
  }
  else sheets = '<style>@media print{@page{size:112mm 75mm;margin:0}html,body,.shell,.main,.tlabs{margin:0!important;padding:0!important;gap:0!important}.lab.tlab{overflow:visible}.tlab .lside{bottom:-3mm}}</style>' + // термопринтер: одна наклейка 112×75 мм = одна страница
    '<div class="tlabs">' + P.places.map((p, i) => lab(p, i).replace('class="lab"', 'class="lab tlab"')).join('') + '</div>';
  return '<div class="noprint"><div class="head"><div><div class="crumb"><a href="#/sale/' + o.id + '">Заказ № ' + o.no + '</a> / Этикетки</div><h1>Этикетки на коробки · ' + N + ' ' + plural(N, 'место', 'места', 'мест') + '</h1>' +
    '<div class="sub-h">Проверьте число мест. Если шкаф упакован иначе, поправьте здесь (для этого заказа) или настройте упаковку товара в «Товарах» (навсегда).</div></div>' +
    '<div class="btns">' + seg(oddMode(), 'lbl-odd', [['join', 'Лишняя дверь — в последнюю коробку'], ['split', 'Лишняя дверь — отдельно']]) + seg(a4 ? 'a4' : 'thermal', 'lbl-fmt', [['thermal', 'Термопринтер 11,2 × 7,5 см'], ['a4', 'А4, 8 на листе']]) +
    '<a class="btn" href="#/sale/' + o.id + '">← К заказу</a><button class="btn pri big" data-act="print">Распечатать</button></div></div>' +
    (a4 ? '' : '<div class="hint" style="margin-bottom:14px">При печати выберите термопринтер, размер бумаги 112 × 75 мм (или 11,2 × 7,5 см), поля — «нет», масштаб — 100%. Каждая этикетка печатается на отдельной наклейке.</div>') +
    '<div class="card tcard"><table class="t"><thead><tr><th>Товар</th><th class="num">Кол-во</th><th>Упаковка</th><th class="num">Мест</th><th>Хрупкое</th></tr></thead><tbody>' +
    P.lines.map((l, li) => (li && P.lines[li - 1].gi === l.gi ? '' : '<tr class="lgrp"><td colspan="4"><b>' + (l.gi + 1) + '. ' + esc(l.g.t) + '</b></td>' +
      '<td class="num">' + (P.cnt[l.gi] || 0) + ' ' + plural(P.cnt[l.gi] || 0, 'место', 'места', 'мест') + '</td></tr>') + (l.kit
      ? '<tr><td><b>Пакет фурнитуры</b> <span class="hint">ручки, карниз и т.п.</span></td><td></td><td class="muted">общий пакет</td>' +
        '<td class="num"><input class="inp pin" style="width:70px" data-ch="lbl-c" data-k="' + l.k + '" value="' + l.c + '"></td><td></td></tr>'
      : '<tr><td>' + esc(l.it.n) + '</td><td class="num">' + l.it.q + '</td><td class="muted">' + packText(l.r) + '</td>' +
        '<td class="num">' + (l.r.mode === 'kit' ? '<span class="muted">в пакете</span>' : '<input class="inp pin" style="width:70px" data-ch="lbl-c" data-k="' + l.k + '" value="' + l.c + '">') + '</td>' +
        '<td><input type="checkbox" class="cb" data-ch="lbl-fr" data-k="' + l.k + '"' + (l.fr ? ' checked' : '') + ' aria-label="Хрупкое"></td></tr>')).join('') +
    '</tbody></table></div></div>' + sheets;
};
function packForm(kind, key) {
  // kind: 'folder' (UI.selCat) или 'item' (ключ товара)
  let cur, title, inherit;
  if (kind === 'folder') { const n = UI.selCat; cur = n.pack; title = 'Упаковка: папка «' + esc(n.n) + '»'; inherit = folderPack({ id: n.id.lastIndexOf('-') < 0 ? '' : n.id.slice(0, n.id.lastIndexOf('-')) }); }
  else { const [nd, i] = itemByKey(key); cur = nd.it[i][2]; title = 'Упаковка: ' + esc(nd.it[i][0]); inherit = folderPack(nd) || autoPack(nd.it[i][0]); }
  const m = cur ? cur.mode : 'inherit';
  modal('<h2 style="margin:0">' + title + '</h2>' +
    '<label class="fld">Как пакуется<select class="inp" id="pk-mode"><option value="inherit"' + (m === 'inherit' ? ' selected' : '') + '>' + (kind === 'folder' ? 'Как у родительской папки / по названию' : 'Как у папки: ' + packText(inherit)) + '</option>' +
    PACK_MODES.map(([k, l]) => '<option value="' + k + '"' + (m === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
    '<label class="fld">Число (коробок на 1 шт или штук в коробке)<input class="inp" id="pk-n" value="' + ((cur && cur.n) || '') + '" placeholder="например, 2"></label>' +
    '<label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" class="cb" id="pk-fr"' + (cur && cur.fragile ? ' checked' : '') + '> Хрупкое (стекло, зеркало, двери)</label>' +
    '<div class="hint">' + (kind === 'folder' ? 'Правило действует на все товары папки и её подпапок, если у товара не задано своё.' : 'Своё правило для этого товара важнее правила папки.') + '</div>' +
    '<div class="btns" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="pack-save" data-kind="' + kind + '" data-k="' + (key || '') + '">Сохранить</button></div>');
}
Object.assign(ACT, {
  'lbl-odd': el => { DB.settings = Object.assign({}, DB.settings, { oddDoor: el.dataset.v }); if (UI.lbl) UI.lbl.adj = {}; commit(); },
  'lbl-fmt': el => { DB.settings = Object.assign({}, DB.settings, { labelFmt: el.dataset.v }); commit(); },
  'pack-folder': () => { UI.catMenu = false; render(); packForm('folder'); },
  'pack-item': el => packForm('item', el.dataset.k),
  'pack-save': el => {
    const mode = $('#pk-mode').value, n = Math.max(1, num($('#pk-n').value) || 1), fr = $('#pk-fr').checked;
    const rule = mode === 'inherit' ? null : { mode, n: (mode === 'box' || mode === 'per') ? n : undefined, fragile: fr || undefined };
    if (el.dataset.kind === 'folder') { if (rule) UI.selCat.pack = rule; else delete UI.selCat.pack; }
    else { const [nd, i] = itemByKey(el.dataset.k); if (rule) nd.it[i][2] = rule; else nd.it.length = 2; }
    modal(''); commit(); toast('Упаковка сохранена');
  }
});
Object.assign(CH, {
  'lbl-c': el => { lblAdj(el.dataset.k).c = Math.max(0, num(el.value)); render(); },
  'lbl-fr': el => { lblAdj(el.dataset.k).fr = el.checked; render(); }
});
function lblAdj(k) {
  const id = route().args[0];
  if (!UI.lbl || UI.lbl.id !== id) UI.lbl = { id, adj: {} };
  return UI.lbl.adj[k] || (UI.lbl.adj[k] = {});
}

/* ================= ПОМОЩНИК: подсказки по составу шкафа ================= */
/* Правила, а не нейросеть: смотрим на группу (шкаф) и предлагаем то, что обычно забывают. */
const asstOn = () => !(DB.settings && DB.settings.asst === false);
/* число дверей из названия корпуса: «6х», «4-х», «6-ти», «3 дверный»; размеры вида 220х180 не считаем */
function doorsFromName(n) {
  const m = n.match(/(?:^|[^\dхx])([1-9])\s*-?\s*(?:х|x|ти)(?![\dа-яё])/i) || n.match(/(?:^|\D)([1-9])\s*(?:-?\s*х)?\s*дверн/i);
  return m ? +m[1] : 0;
}
const isCarcass = it => /корпус|шкаф/i.test(it.n) && !/антресол|двер[ьи]\b/i.test(it.n) && doorsFromName(it.n) > 0;
const isAntresol = it => /антресол/i.test(it.n) && !/двер/i.test(it.n);
const isAntDoor = it => /антресол/i.test(it.n) && /двер/i.test(it.n);
const isDoor = it => !isAntDoor(it) && /двер(?!н)|рамк|зеркал|фасад/i.test(it.n);
const isHandle = it => /ручк/i.test(it.n);
const isCornice = it => /карниз/i.test(it.n);
const colorOf = n => { const m = n.match(colorRe()); return m ? colorKey(m[0]) : ''; };
function catalogFind(test) { for (const id in NODES) for (const it of NODES[id].it) if (test(it[0])) return it; return null; }
/* самые ходовые ручки по проданному; если продаж нет — ручки 30 см из каталога */
function popularHandles() {
  const cnt = {};
  DB.orders.forEach(o => o.groups.forEach(g => g.items.forEach(it => { if (isHandle(it)) cnt[it.n] = (cnt[it.n] || 0) + it.q; })));
  let names = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  if (!names.length) for (const id in NODES) NODES[id].it.forEach(it => { if (/ручк/i.test(it[0]) && /30 см/i.test(it[0]) && !/комплект/i.test(it[0])) names.push(it[0]); });
  return names.slice(0, 3);
}
const doorType = n => { const m = n.match(/(?:двер[ьи]|рамка)\s+(?:с\s+)?([А-ЯЁа-яё]{3,})/i); if (!m) return ''; const w = m[1].toLowerCase(); return w === 'зеркалом' ? '' : w[0].toUpperCase() + w.slice(1); };
function asstFor(G, gi) {
  const out = [], hide = (UI.asstHide || {});
  const add = (key, text, actions, warn) => { if (!hide[gi + ':' + key]) out.push({ key, text, actions: actions || [], warn }); };
  const items = G.items, carc = items.find(isCarcass);
  if (!items.length) return out;
  const N = carc ? doorsFromName(carc.n) : 0, col = carc ? colorOf(carc.n) : '';
  const doors = items.filter(isDoor), nDoors = doors.reduce((s, it) => s + it.q, 0);
  const handles = items.filter(isHandle), nHandles = handles.reduce((s, it) => s + it.q, 0);
  const cornice = items.find(isCornice), ant = items.find(isAntresol), antDoors = items.filter(isAntDoor).reduce((s, it) => s + it.q, 0);
  const A = (label, act, data) => ({ label, act, data });
  if (carc && N) {
    // двери
    if (nDoors < N) {
      const d = doors[0];
      add('doors', 'Корпус на ' + N + ' ' + plural(N, 'дверь', 'двери', 'дверей') + ', а дверей' + (doors.some(x => /зеркал/i.test(x.n)) ? ' с зеркалами' : '') + ' — ' + nDoors + '.',
        d ? [A('Добавить ещё ' + (N - nDoors) + ': ' + d.n, 'as-add', { name: d.n, q: N - nDoors })] : [A('Выберите двери в каталоге справа', '', {})], true);
    } else if (nDoors > N) add('doors+', 'Дверей ' + nDoors + ', а корпус на ' + N + '. Проверьте, не лишние ли.', [], true);
    // карниз
    const want = catalogFind(n => new RegExp('карниз на ' + N + '\\s*дв', 'i').test(n));
    if (!cornice) add('cornice', 'Нет карниза для ' + N + '-дверного шкафа.', want ? [A('Добавить «' + want[0] + '»', 'as-add', { name: want[0], q: 1 })] : [], true);
    else { const cn = (cornice.n.match(/на\s*(\d+)\s*дв/i) || [])[1]; if (cn && +cn !== N) add('cornice-n', 'Карниз на ' + cn + ' дв., а шкаф ' + N + '-дверный.', want ? [A('Заменить на «' + want[0] + '»', 'as-swap', { from: cornice.n, name: want[0] })] : [], true); }
    // ручки — по одной на дверь
    const need = Math.max(N, nDoors);
    if (!handles.length && !items.some(it => /комплект ручек/i.test(it.n))) add('handles', 'Нет ручек — нужно ' + need + ' шт (по одной на дверь).', popularHandles().map(h => A(h + ' ×' + need, 'as-add', { name: h, q: need })), true);
    else if (handles.length === 1 && nHandles !== need) add('handles-n', 'Ручек ' + nHandles + ', а дверей ' + need + '.', [A('Поставить ' + need + ' шт', 'as-setq', { name: handles[0].n, q: need })], true);
    // антресоль и её двери
    if (ant) {
      const an = items.filter(isAntresol).reduce((s, it) => s + doorsFromName(it.n) * it.q, 0); // 2 антресоли «2-х» = на 4 двери
      if (antDoors < (an || N)) {
        const k = (an || N) - antDoors, ad = catalogFind(n => /двер/i.test(n) && /антресол/i.test(n) && (!col || colorOf(n) === col));
        add('antdoors', 'Антресоль без ' + (antDoors ? 'части ' : '') + 'дверей — нужно ещё ' + k + ' шт.', ad ? [A('Добавить «' + ad[0] + '» ×' + k, 'as-add', { name: ad[0], q: k })] : [], true);
      }
      if (an && an !== N && !(N === 3 || N === 5)) add('ant-n', 'Антресоли на ' + an + ' дв., а шкаф ' + N + '-дверный. Проверьте размер.', [], true);
    }
    // разные цвета в одном шкафу
    const cols = [...new Set(items.filter(it => !isHandle(it)).map(it => colorOf(it.n)).filter(Boolean))];
    if (cols.length > 1) add('colors', 'В шкафу разные цвета: ' + cols.join(', ') + '. Так и задумано?', [], true);
    // название шкафа
    if (/^Шкаф \d+$/.test(G.t.trim())) {
      const dt = doors.map(d => doorType(d.n)).find(Boolean) || '', name = 'Шкаф ' + (dt ? dt + ' ' : '') + N + 'х' + (col ? ', ' + col : '') + (ant ? ', с антресолью' : '');
      add('title', 'Назвать шкаф понятно для накладной.', [A('«' + name + '»', 'as-ren', { name })]);
    }
  }
  return out;
}
function asstHtml(G, gi) {
  if (!asstOn()) return '';
  const tips = asstFor(G, gi); if (!tips.length) return '';
  return '<div class="asst">' + tips.map(t => '<div class="asst-row"><span class="asst-ico" aria-hidden="true">✦</span><span class="asst-text">' + esc(t.text) + '</span><span class="btns" style="gap:6px">' +
    t.actions.filter(a => a.act).map(a => '<button class="btn sm" data-act="' + a.act + '" data-g="' + gi + '"' + Object.keys(a.data).map(k => ' data-' + k + '="' + esc(a.data[k]) + '"').join('') + '>' + esc(a.label) + '</button>').join('') +
    '<button class="x" style="width:28px;height:28px;font-size:15px;color:var(--muted)" data-act="as-hide" data-g="' + gi + '" data-key="' + t.key + '" title="Скрыть подсказку" aria-label="Скрыть подсказку">×</button></span></div>').join('') + '</div>';
}
Object.assign(ACT, {
  'as-add': el => {
    const G = DB.cart.groups[+el.dataset.g], name = el.dataset.name, q = +el.dataset.q, f = findItem(name), ex = G.items.find(x => x.n === name);
    if (ex) ex.q += q; else G.items.push({ n: name, q, p: (f && f.it[1]) || 0 });
    commit(); toast('Добавлено: ' + name + ' ×' + q);
  },
  'as-setq': el => { const it = DB.cart.groups[+el.dataset.g].items.find(x => x.n === el.dataset.name); if (it) it.q = +el.dataset.q; commit(); },
  'as-swap': el => { const it = DB.cart.groups[+el.dataset.g].items.find(x => x.n === el.dataset.from), f = findItem(el.dataset.name); if (it) { it.n = el.dataset.name; it.p = (f && f.it[1]) || 0; } commit(); },
  'as-ren': el => { DB.cart.groups[+el.dataset.g].t = el.dataset.name; commit(); },
  'as-hide': el => { UI.asstHide = UI.asstHide || {}; UI.asstHide[el.dataset.g + ':' + el.dataset.key] = true; render(); },
  'as-toggle': () => { DB.settings = Object.assign({}, DB.settings, { asst: !asstOn() }); commit(); }
});

/* ================= СКЛАД ================= */
/* Остаток считается из движений, а не хранится: приходы и инвентаризации (DB.stockMoves) минус отгруженные заказы
   и рассрочки. Резерв — оформленные, но не отгруженные заказы. На учёте — товары, по которым было хоть одно движение. */
function stockMap() {
  const m = {};
  const get = n => m[n] || (m[n] = { tracked: false, inQ: 0, adj: 0, out: 0, res: 0 });
  DB.stockMoves.forEach(x => {
    const s = get(x.name); s.tracked = true; s.since = Math.min(s.since || Infinity, x.createdAt);
    if (x.kind === 'in') s.inQ += x.q; else s.adj += x.q;
  });
  // отгрузки до постановки товара на учёт не списываем — их уже нет на складе
  const after = (s, ts) => s.tracked && ts > s.since;
  DB.orders.forEach(o => {
    if (o.status !== 'shipped' && o.status !== 'ordered') return;
    o.groups.forEach(g => g.items.forEach(it => { const s = get(it.n); if (o.status === 'ordered') s.res += it.q; else if (after(s, o.shippedAt || o.createdAt)) s.out += it.q; }));
  });
  DB.installments.forEach(i => i.groups.forEach(g => g.items.forEach(it => { const s = get(it.n); if (after(s, i.createdAt)) s.out += it.q; })));
  for (const n in m) { const s = m[n]; s.have = s.inQ + s.adj - s.out; s.free = s.have - s.res; }
  return m;
}
/* чего не хватает под конкретный заказ (его собственный резерв не считаем против него) */
function stockShort(o) {
  const M = stockMap(), need = {};
  o.groups.forEach(g => g.items.forEach(it => { need[it.n] = (need[it.n] || 0) + it.q; }));
  return Object.keys(need).filter(n => M[n] && M[n].tracked).map(n => {
    const s = M[n], avail = s.have - (s.res - (o.status === 'ordered' ? need[n] : 0)) + (o.status === 'shipped' ? need[n] : 0);
    return { n, need: need[n], avail };
  }).filter(x => x.avail < x.need);
}
VIEWS.stock = () => {
  const M = stockMap(), q = (UI.stQ || '').toLowerCase(), f = UI.stF || 'all';
  const rows = Object.keys(M).filter(n => M[n].tracked).map(n => Object.assign({ n }, M[n]))
    .filter(r => (!q || r.n.toLowerCase().includes(q)) && (f === 'all' || (f === 'short' && r.free < 0) || (f === 'res' && r.res > 0)))
    .sort((a, b) => (a.free < 0 ? 0 : 1) - (b.free < 0 ? 0 : 1) || a.n.localeCompare(b.n, 'ru', { numeric: true }));
  const all = Object.values(M).filter(s => s.tracked), shortN = all.filter(s => s.free < 0).length;
  const moves = DB.stockMoves.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
  return '<div class="head"><div><h1>Склад</h1><div class="sub-h">Приход из цеха, остатки и резерв под оформленные заказы. При отгрузке товар списывается сам.</div></div>' +
    '<div class="btns"><a class="btn" href="#/invprint">Бланк пересчёта</a><a class="btn" href="#/inv">Инвентаризация списком</a><button class="btn" data-act="sk-open" data-kind="adj">Пересчитать один товар</button><button class="btn pri" data-act="sk-open" data-kind="in">+ Приход</button></div></div>' +
    '<div class="kpis"><div class="kpi"><div class="l">Позиций на учёте</div><div class="v">' + all.length + '</div><div class="h">' + all.reduce((s, x) => s + Math.max(0, x.have), 0) + ' шт на складе</div></div>' +
    '<div class="kpi"><div class="l">В резерве</div><div class="v">' + all.reduce((s, x) => s + x.res, 0) + ' шт</div><div class="h">под оформленные заказы</div></div>' +
    '<div class="kpi"><div class="l">Не хватает</div><div class="v ' + (shortN ? 'debt' : '') + '">' + shortN + ' ' + plural(shortN, 'позиция', 'позиции', 'позиций') + '</div><div class="h">нужно произвести</div></div></div>' +
    '<div class="card"><div class="filters"><div class="fgroup"><span>Показать</span>' + seg(f, 'st-f', [['all', 'Все на учёте'], ['short', 'Не хватает', shortN], ['res', 'В резерве']]) + '</div>' +
    '<label class="search">' + icon('search', 16) + '<input class="inp" id="st-q" data-in="st-q" placeholder="Найти товар" value="' + esc(UI.stQ || '') + '"></label></div></div>' +
    '<div class="card tcard">' + (rows.length ? '<div class="scroll"><table class="t" style="min-width:760px"><thead><tr><th>Товар</th><th class="num">На складе</th><th class="num">Резерв</th><th class="num">Доступно</th><th></th></tr></thead><tbody>' +
      rows.map(r => '<tr><td class="c-client">' + esc(r.n) + '</td><td class="num amount">' + r.have + '</td><td class="num">' + (r.res || '<span class="muted">—</span>') + '</td>' +
        '<td class="num">' + (r.free < 0 ? st('unpaid', 'не хватает ' + (-r.free)) : '<b class="adv">' + r.free + '</b>') + '</td>' +
        '<td class="num"><span class="btns" style="justify-content:flex-end"><button class="btn sm" data-act="sk-open" data-kind="in" data-name="' + esc(r.n) + '">+ Приход</button>' +
        '<button class="btn sm" data-act="sk-open" data-kind="adj" data-name="' + esc(r.n) + '">Пересчитать</button></span></td></tr>').join('') + '</tbody></table></div>'
      : '<div class="empty">' + (all.length ? 'Ничего не найдено' : 'На складе пока ничего не учтено. Нажмите «+ Приход» или «Инвентаризация» — товар встанет на учёт.') + '</div>') + '</div>' +
    (moves.length ? '<div class="card"><h2>Последние движения</h2><table class="t"><tbody>' + moves.map(x => '<tr><td style="white-space:nowrap">' + ru(x.date) + '</td><td>' +
      (x.kind === 'in' ? st('paid', 'приход') : st('ordered', 'инвентаризация')) + '</td><td>' + esc(x.name) + (x.note ? '<div class="hint">' + esc(x.note) + '</div>' : '') + '</td>' +
      '<td class="num amount">' + (x.q > 0 ? '+' : '') + x.q + '</td><td style="width:36px"><button class="x" data-act="sk-del" data-id="' + x.id + '" aria-label="Удалить движение">×</button></td></tr>').join('') + '</tbody></table></div>' : '');
};
/* окно прихода / инвентаризации: выбор товара поиском */
function skList() {
  const q = (UI.sk.q || '').trim().toLowerCase(); if (!q) return '<div class="hint" style="padding:8px">Начните вводить название товара</div>';
  const out = [];
  for (const id in NODES) NODES[id].it.forEach(it => { if (out.length < 40 && it[0].toLowerCase().includes(q)) out.push(it[0]); });
  return out.length ? out.map(n => '<button class="it" style="width:100%;border:0;background:none;font:inherit;text-align:left" data-act="sk-pick" data-name="' + esc(n) + '"><span>' + esc(n) + '</span></button>').join('') : '<div class="empty">Не найдено</div>';
}
function skForm() {
  const S = UI.sk, M = stockMap(), cur = S.name && M[S.name] ? M[S.name].have : 0;
  modal('<h2 style="margin:0">' + (S.kind === 'in' ? 'Приход на склад' : 'Инвентаризация') + '</h2>' +
    (S.name ? '<div class="picked"><b>' + esc(S.name) + '</b><button class="btn sm" data-act="sk-change">Другой товар</button></div>' :
      '<input class="inp" id="sk-q" data-in="sk-q" placeholder="Поиск товара…" value="' + esc(S.q || '') + '"><div class="box" id="sk-list" style="max-height:260px">' + skList() + '</div>') +
    '<div class="form"><label class="fld">' + (S.kind === 'in' ? 'Пришло, шт' : 'Фактически на складе, шт') + '<input class="inp" id="sk-n" value="' + esc(S.n || '') + '"></label>' +
    '<label class="fld">Дата<input class="inp" type="date" id="sk-d" value="' + (S.d || todayISO()) + '"></label></div>' +
    (S.kind === 'adj' && S.name ? '<div class="hint">Сейчас по программе: ' + cur + ' шт. Разница запишется как поправка.</div>' : '') +
    '<label class="fld">Комментарий<input class="inp" id="sk-note" value="' + esc(S.note || '') + '" placeholder="' + (S.kind === 'in' ? 'например: из цеха, смена Магомеда' : 'например: пересчёт 01.11') + '"></label>' +
    '<div class="btns" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Закрыть</button>' +
    '<button class="btn" data-act="sk-save" data-more="1">Сохранить и ещё</button><button class="btn pri" data-act="sk-save">Сохранить</button></div>');
  const f = S.name ? $('#sk-n') : $('#sk-q'); if (f) f.focus();
}
function skRead() { ['n', 'd', 'note'].forEach(k => { const e = $('#sk-' + k); if (e) UI.sk[k] = e.value; }); }
Object.assign(ACT, {
  'sk-open': el => { UI.sk = { kind: el.dataset.kind, name: el.dataset.name || '', q: '' }; skForm(); },
  'sk-pick': el => { skRead(); UI.sk.name = el.dataset.name; skForm(); },
  'sk-change': () => { skRead(); UI.sk.name = ''; skForm(); },
  'st-f': el => { UI.stF = el.dataset.v; render(); },
  'sk-save': el => {
    skRead(); const S = UI.sk, n = num(S.n);
    if (!S.name) return toast('Выберите товар');
    if (S.kind === 'in' && !n) return toast('Введите количество');
    const q = S.kind === 'in' ? n : n - ((stockMap()[S.name] || {}).have || 0);
    if (S.kind === 'adj' && !q && (stockMap()[S.name] || {}).tracked) { toast('Остаток совпадает — поправка не нужна'); }
    else DB.stockMoves.push({ id: uid(), date: S.d || todayISO(), name: S.name, q, kind: S.kind, note: (S.note || '').trim(), createdAt: Date.now() });
    save(); toast(S.kind === 'in' ? 'Приход: ' + S.name + ' +' + n : 'Остаток ' + S.name + ' = ' + n);
    if (el.dataset.more) { UI.sk = { kind: S.kind, name: '', q: '', d: S.d }; skForm(); render(); } else { modal(''); render(); }
  },
  'sk-del': el => {
    const x = DB.stockMoves.find(m => m.id === el.dataset.id);
    if (!confirm('Удалить движение «' + x.name + ' ' + (x.q > 0 ? '+' : '') + x.q + '»?')) return;
    DB.stockMoves = DB.stockMoves.filter(m => m !== x); commit();
  }
});
Object.assign(IN, {
  'sk-q': el => { UI.sk.q = el.value; $('#sk-list').innerHTML = skList(); },
  'st-q': el => { UI.stQ = el.value; rerenderKeepFocus('st-q'); }
});
/* карточка на странице заказа: хватает ли товара на складе */
function stockCard(o) {
  if (o.status === 'cancelled' || !DB.stockMoves.length) return '';
  const short = stockShort(o);
  if (o.status === 'shipped') return '';
  return '<div class="card"><h2>Склад</h2>' + (short.length ? '<div class="hint" style="margin-bottom:6px">Не хватает на складе:</div>' + short.map(x => '<div class="line"><span>' + esc(x.n) + '</span><span class="debt"><b>нужно ' + x.need + ', есть ' + Math.max(0, x.avail) + '</b></span></div>').join('')
    : '<div class="adv"><b>Всё, что на учёте, есть на складе.</b></div>') + '</div>';
}

/* ================= ИНВЕНТАРИЗАЦИЯ СПИСКОМ ================= */
/* Все товары каталога одной таблицей: вписываете «Факт» (руками, из бланка, из Excel или из остатков 1С) и сохраняете разом.
   Каждая заполненная строка = поправка остатка (инвентаризация) и постановка товара на учёт. */
/* настройки обхода склада (общие для бланка и ввода): какие товары, графа «По программе», папка с нового листа */
const invSet = () => Object.assign({ invShow: 'all', invBreak: false }, DB.settings || {});
const INV_SHOW = [['all', 'Весь каталог'], ['tracked', 'Только на учёте'], ['stock', 'Только где есть остаток']];
/* постоянный номер товара — порядок в каталоге; одинаковый в бланке и в «Инвентаризации списком» */
function invNumbers() {
  const m = {}; let k = 0;
  allFolders(DB.cat).forEach(({ n }) => orderIdx(n).forEach(i => { const name = n.it[i][0]; if (!m[name]) m[name] = ++k; }));
  return m;
}
function invPass(name, M) {
  const show = invSet().invShow, s = M[name];
  return show === 'all' || (show === 'tracked' && s && s.tracked) || (show === 'stock' && s && s.tracked && s.have > 0);
}
function invRows() {
  const f = UI.invF || '', q = (UI.invQ || '').toLowerCase().trim(), out = [], M = stockMap(), NO = invNumbers();
  allFolders(DB.cat).forEach(({ n, depth }) => {
    if (f && !(n.id === f || n.id.indexOf(f + '-') === 0)) return;
    orderIdx(n).forEach(i => {
      const name = n.it[i][0], no = NO[name];
      if (!invPass(name, M)) return;
      if (!q || name.toLowerCase().includes(q) || String(no) === q) out.push({ name, folder: n, no });
    });
  });
  return out;
}
/* папки бланка: DB.settings.invFolders — список путей папок с галочкой; нет списка = все папки.
   Галочка у папки включает и все её подпапки. */
const invSel = () => invSet().invFolders || null;
function invFolderOn(n, sel) {
  if (!sel) return true;
  for (let id = n.id; ; id = id.slice(0, id.lastIndexOf('-'))) {
    if (sel.indexOf(folderPath(NODES[id])) >= 0) return true;
    if (id.indexOf('-') < 0) return false;
  }
}
function invFoldBox(M) {
  const sel = invSel(), all = allFolders(DB.cat);
  const cnt = n => allFolders([n]).reduce((k, x) => k + x.n.it.filter(it => invPass(it[0], M)).length, 0);
  const groups = DB.cat.map(top => '<div class="fold-g">' + allFolders([top]).map(({ n, depth }) => {
    const on = invFolderOn(n, sel), self = !sel || sel.indexOf(folderPath(n)) >= 0, byParent = on && !self && depth > 0, c = cnt(n);
    return '<label class="fold-c" style="padding-left:' + depth * 18 + 'px' + (c ? '' : ';opacity:.5') + '"><input type="checkbox" class="cb" data-ch="inv-fold" data-p="' + esc(folderPath(n)) + '"' +
      (on ? ' checked' : '') + (byParent && sel ? ' disabled title="Входит в отмеченную папку выше"' : '') + '><span' + (depth ? '' : ' style="font-weight:700"') + '>' + esc(n.n) + '</span><span class="muted">' + c + '</span></label>';
  }).join('') + '</div>').join('');
  const nOn = all.filter(({ n }) => invFolderOn(n, sel) && n.it.length).length;
  return '<div class="fold-head"><b>Папки в бланке</b><span class="muted">' + (sel ? 'отмечено папок с товарами: ' + nOn : 'все папки') + '</span>' +
    '<button class="btn sm" data-act="inv-fold-all">Выбрать все</button><button class="btn sm" data-act="inv-fold-none">Снять все</button></div><div class="fold-box">' + groups + '</div>';
}
/* выбор «какие товары» — на экране ввода и над бланком */
const invSetBar = () => '<div class="fgroup"><span>Товары</span>' + seg(invSet().invShow, 'inv-show', INV_SHOW) + '</div>';
VIEWS.inv = () => {
  const M = stockMap(), rows = invRows(), V = UI.inv || (UI.inv = {});
  const filled = Object.keys(V).filter(k => V[k] !== '').length;
  let lastFolder = null, body = '';
  rows.forEach((r, idx) => {
    if (r.folder !== lastFolder) { lastFolder = r.folder; body += '<tr class="inv-f"><td colspan="4">' + esc(folderPath(r.folder)) + '</td></tr>'; }
    const s = M[r.name], have = s && s.tracked ? s.have : null, v = V[r.name] !== undefined ? V[r.name] : '';
    body += '<tr' + (v !== '' ? ' class="sel"' : '') + '><td class="num muted" style="width:56px">' + r.no + '</td><td>' + esc(r.name) + '</td><td class="num muted">' + (have === null ? 'не на учёте' : have) + '</td>' +
      '<td class="num" style="width:130px"><input class="inp pin inv-in" style="width:100px" data-ch="inv-v" data-name="' + esc(r.name) + '" data-idx="' + idx + '" value="' + esc(v) + '" inputmode="numeric" aria-label="Факт"></td></tr>';
  });
  const tops = DB.cat.map((n, i) => [String(i), n.n]);
  return '<div class="head"><div><div class="crumb"><a href="#/stock">Склад</a> / Инвентаризация</div><h1>Инвентаризация списком</h1>' +
    '<div class="sub-h">Впишите фактическое количество (Enter — к следующей строке). Пустые строки не трогаются. Сохраняется по кнопке.</div></div>' +
    '<div class="btns"><button class="btn" data-act="inv-xls">Скачать в Excel</button><label class="btn">Загрузить Excel / остатки 1С<input type="file" accept=".xlsx,.xls,.csv" data-ch="inv-load" style="display:none"></label>' +
    '<a class="btn" href="#/invprint">Бланк пересчёта</a><button class="btn pri big" data-act="inv-save"' + (filled ? '' : ' disabled') + '>Сохранить (' + filled + ')</button></div></div>' +
    (UI.invMsg ? '<div class="warn" style="background:var(--accent-bg);color:var(--accent-ink)"><span>' + UI.invMsg + '</span><button class="btn sm" data-act="inv-msg-x">Понятно</button></div>' : '') +
    '<div class="card"><div class="filters"><div class="fgroup"><span>Папка</span><select class="inp" style="min-height:36px" data-ch="inv-f"><option value="">Все товары</option>' +
    allFolders(DB.cat).map(({ n, depth }) => '<option value="' + n.id + '"' + (UI.invF === n.id ? ' selected' : '') + '>' + '   '.repeat(depth) + esc(n.n) + '</option>').join('') + '</select></div>' +
    invSetBar() + '<label class="search">' + icon('search', 16) + '<input class="inp" id="inv-q" data-in="inv-q" placeholder="Найти товар или № из бланка" value="' + esc(UI.invQ || '') + '"></label>' +
    (filled ? '<button class="btn sm" data-act="inv-clear">Очистить введённое</button>' : '') + '</div></div>' +
    '<div class="card tcard"><table class="t"><thead><tr><th class="num">№</th><th>Товар · ' + rows.length + '</th><th class="num">По программе</th><th class="num">Факт</th></tr></thead><tbody>' + body + '</tbody></table></div>';
};
/* бланк пересчёта склада (по образцу пользователя): строка = модель, колонки Белый…Вотан, Итого, Примечание.
   Клетки пустые — под ручку; если такого цвета у модели нет, клетка тоже пустая. Товары без цвета пишут в «Итого».
   Название строки: если в папке одна модель — имя папки (там уже чистые названия), иначе название товара
   без цвета, размеров и «(Коробка…)». № — порядковый номер строки на бланке. */
const modelTitle = n => n.replace(colorRe(), '').replace(/\(\s*\)/g, '').replace(/\s+-\s*$/, '').replace(/\s+/g, ' ').trim();
const DIMS = /\d+\s*[хx×]\s*\d+(\s*[хx×]\s*\d+)?|[вшг]\s*\d{2,3}/i;
function shortTitle(s) {
  return s.replace(/\(([^()]*)\)/g, (m, x) => DIMS.test(x) || /коробк/i.test(x) ? ' ' : m) // скобки с размерами или «Коробка № 1 и № 2»
    .replace(/\d+\s*[хx×]\s*\d+(\s*[хx×]\s*\d+)?/gi, ' ')                                  // размеры без скобок: 220х270х52, 98 х 98
    .replace(/\(\s*\)/g, ' ').replace(/\s+/g, ' ').replace(/[\s\-–—,]+$/, '').trim();
}
const folderTitle = n => n.replace(/\s*\(\s*([^()]+?)\s*\)\s*$/, ' — $1').replace(/\s+/g, ' ').trim(); // «Милан 2х ( полочный )» → «Милан 2х — полочный»
/* Лино и Сатин — один цвет: в бланке одна колонка «Лино» */
const invColor = k => k === 'сатин' ? 'лино' : k;
const INV_COLS = COLORS.filter(([k]) => k !== 'сатин');
function invModels(names) {
  const out = [], byBase = {};
  names.forEach(name => {
    const m = name.match(colorRe()), ck = m ? invColor(colorKey(m[0])) : '';
    const b = ck ? baseName(name) : '\u0000' + name; // товар без цвета — отдельной строкой
    let row = byBase[b];
    if (!row || row.cells[ck || '-']) { row = { title: shortTitle(ck ? modelTitle(name) : name), cells: {}, names: [] }; byBase[b] = row; out.push(row); }
    row.cells[ck || '-'] = name; row.names.push(name);
  });
  return out;
}
VIEWS.invprint = () => {
  const S = invSet(), sel = invSel();
  // папки с галочкой и их подпапки; в каждой — модели
  const folders = [];
  allFolders(DB.cat).forEach(({ n }) => {
    if (!invFolderOn(n, sel)) return;
    const items = orderIdx(n).map(i => n.it[i][0]);
    if (!items.length) return;
    const models = invModels(items);
    if (models.length === 1 && n.id.indexOf('-') > 0) models[0].title = folderTitle(n.n);
    folders.push({ n, models });
  });
  const colors = INV_COLS, cols = 4 + colors.length;
  // подпапка с одной моделью не получает свой заголовок — идёт под заголовком родителя («Корпуса Милан»)
  const groups = [];
  folders.forEach(x => {
    const one = x.models.length === 1 && x.n.id.indexOf('-') > 0, g = one ? NODES[x.n.id.slice(0, x.n.id.lastIndexOf('-'))] : x.n;
    const last = groups[groups.length - 1];
    if (last && last.n === g) last.models = last.models.concat(x.models); else groups.push({ n: g, models: x.models.slice() });
  });
  let no = 0, body = '';
  groups.forEach((x, gi) => {
    body += '<tbody' + (S.invBreak && gi ? ' class="newpage"' : '') + '><tr class="g"><td colspan="' + cols + '">' + esc(x.n.n.replace(/^\d+\.\s*/, '')) + '</td></tr>' +
      x.models.map(r => '<tr class="mrow"><td class="no">' + (++no) + '</td><td>' + esc(r.title) + '</td>' + colors.map(() => '<td class="mc"></td>').join('') + '<td class="mc"></td><td></td></tr>').join('') + '</tbody>';
  });
  return '<div class="noprint"><div class="head"><div><div class="crumb"><a href="#/stock">Склад</a> / <a href="#/inv">Инвентаризация</a> / Бланк пересчёта</div><h1>Бланк пересчёта склада · ' + no + ' ' + plural(no, 'строка', 'строки', 'строк') + '</h1>' +
    '<div class="sub-h">Отметьте папки, распечатайте и пересчитайте склад. Товары без цвета пишите в «Итого».</div></div>' +
    '<div class="btns"><a class="btn" href="#/inv">← К вводу цифр</a><button class="btn pri big" data-act="print">Распечатать</button></div></div>' +
    '<div class="card">' + invFoldBox(stockMap()) + '<div class="filters" style="margin-top:14px">' +
    '<label class="chk"><input type="checkbox" class="cb" data-ch="inv-break"' + (S.invBreak ? ' checked' : '') + '> Каждая папка с нового листа</label></div></div></div>' +
    '<div class="paperwrap"><div class="paper inv-paper inv-mx"><div class="inv-title">ПЕРЕСЧЁТ СКЛАДА (шт.)</div>' +
    '<div class="inv-fields"><div>Дата: <span></span></div><div>Склад: <span></span></div><div>Считал: <span></span></div></div>' +
    '<table class="p-t"><thead><tr><th style="width:10mm">№</th><th>Наименование</th>' + colors.map(([, l]) => '<th class="mcol">' + l + '</th>').join('') +
    '<th class="mcol">Итого</th><th style="width:22mm">Примечание</th></tr></thead>' +
    (body || '<tbody><tr><td colspan="' + cols + '">' + (sel && !sel.length ? 'Отметьте галочками папки, по которым нужен бланк' : 'В выбранных папках нет товаров') + '</td></tr></tbody>') + '</table></div></div>';
};
/* загрузка таблицы: ищем колонку с названием и колонку «Факт/Остаток/Количество», сопоставляем с каталогом по названию */
function invImport(rows) {
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
  const h = rows.findIndex(r => r.some(x => /наименован|товар/i.test(String(x))) && r.some(x => /факт|остаток|количеств|кол-во/i.test(String(x))));
  if (h < 0) return null;
  const nc = rows[h].findIndex(x => /наименован|товар/i.test(String(x)));
  const qc = (() => { const f = rows[h].findIndex(x => /факт/i.test(String(x))); return f >= 0 ? f : rows[h].findIndex(x => /остаток|количеств|кол-во/i.test(String(x))); })();
  const byName = {}; for (const id in NODES) NODES[id].it.forEach(it => { byName[norm(it[0])] = it[0]; });
  let ok = 0; const miss = [];
  rows.slice(h + 1).forEach(r => {
    const nm = norm(r[nc]), raw = r[qc]; if (!nm || raw === '' || raw == null) return;
    const qty = Math.round(typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/\s/g, '').replace(',', '.')) || 0);
    if (byName[nm]) { UI.inv[byName[nm]] = String(qty); ok++; } else miss.push(String(r[nc]).trim());
  });
  return { ok, miss };
}
Object.assign(ACT, {
  'inv-save': () => {
    const V = UI.inv || {}, M = stockMap(), d = todayISO(); let n = 0;
    Object.keys(V).forEach(name => {
      if (V[name] === '') return;
      const fact = num(V[name]), s = M[name], have = s && s.tracked ? s.have : 0;
      DB.stockMoves.push({ id: uid(), date: d, name, q: fact - have, kind: 'adj', note: 'инвентаризация', createdAt: Date.now() + n });
      n++;
    });
    UI.inv = {}; UI.invMsg = ''; save(); go('#/stock'); toast('Инвентаризация сохранена: ' + n + ' ' + plural(n, 'позиция', 'позиции', 'позиций'), null, 5000);
  },
  'inv-clear': () => { if (confirm('Очистить все введённые цифры?')) { UI.inv = {}; render(); } },
  'inv-msg-x': () => { UI.invMsg = ''; render(); },
  'inv-fold-all': () => { DB.settings = Object.assign({}, DB.settings, { invFolders: null }); commit(); },
  'inv-fold-none': () => { DB.settings = Object.assign({}, DB.settings, { invFolders: [] }); commit(); },
  'inv-show': el => { DB.settings = Object.assign({}, DB.settings, { invShow: el.dataset.v }); commit(); },
  'inv-xls': () => {
    if (typeof XLSX === 'undefined') return toast('Не загрузилась библиотека Excel');
    const M = stockMap(), aoa = [['Папка', 'Товар', 'По программе', 'Факт']];
    allFolders(DB.cat).forEach(({ n }) => orderIdx(n).forEach(i => { const name = n.it[i][0], s = M[name]; aoa.push([folderPath(n), name, s && s.tracked ? s.have : '', '']); }));
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 34 }, { wch: 70 }, { wch: 14 }, { wch: 10 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Инвентаризация');
    XLSX.writeFile(wb, 'LIVARO инвентаризация ' + todayISO() + '.xlsx');
    toast('Файл скачан в «Загрузки». Заполните колонку «Факт» и загрузите обратно.', null, 6000);
  }
});
Object.assign(CH, {
  'inv-v': el => { UI.inv[el.dataset.name] = el.value.trim(); el.closest('tr').classList.toggle('sel', el.value.trim() !== ''); const b = $('[data-act="inv-save"]'); const n = Object.keys(UI.inv).filter(k => UI.inv[k] !== '').length; if (b) { b.disabled = !n; b.textContent = 'Сохранить (' + n + ')'; } },
  'inv-f': el => { UI.invF = el.value; render(); },
  'inv-fold': el => {
    const p = el.dataset.p, tops = DB.cat.map(n => folderPath(n));
    let sel = (invSel() || tops).slice();
    if (el.checked) sel = sel.filter(x => x.indexOf(p + ' / ') !== 0).concat(p); // подпапки уже входят в отмеченную
    else sel = sel.filter(x => x !== p);
    DB.settings = Object.assign({}, DB.settings, { invFolders: tops.every(t => sel.indexOf(t) >= 0) ? null : sel }); commit();
  },
  'inv-break': el => { DB.settings = Object.assign({}, DB.settings, { invBreak: el.checked }); commit(); },
  'inv-load': el => {
    const f = el.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const wb = XLSX.read(new Uint8Array(r.result), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
        UI.inv = UI.inv || {}; const res = invImport(rows);
        if (!res) { toast('Не нашёл колонки «Наименование/Товар» и «Факт/Остаток». Проверьте файл.', null, 6000); return; }
        UI.invMsg = 'Загружено цифр: <b>' + res.ok + '</b>. Проверьте их в таблице (строки подсвечены) и нажмите «Сохранить».' +
          (res.miss.length ? ' Не нашлись в каталоге (' + res.miss.length + '): ' + esc(res.miss.slice(0, 8).join('; ')) + (res.miss.length > 8 ? '…' : '') : '');
        render();
      } catch (e) { toast('Не удалось прочитать файл'); }
    };
    r.readAsArrayBuffer(f); el.value = '';
  }
});
Object.assign(IN, { 'inv-q': el => { UI.invQ = el.value; rerenderKeepFocus('inv-q'); } });
/* Enter в поле «Факт» — к следующей строке */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.classList || !e.target.classList.contains('inv-in')) return;
  e.preventDefault(); e.target.dispatchEvent(new Event('change', { bubbles: true }));
  const all = [...document.querySelectorAll('.inv-in')], i = all.indexOf(e.target);
  if (all[i + 1]) { all[i + 1].focus(); all[i + 1].select(); }
});

/* ================= ОПЛАТА ТОВАРОМ (взаимозачёт) ================= */
/* Клиент гасит долг товаром: «120 м ткани по 165 ₽». Сумма = кол-во × цена; если клиент назвал другую сумму — предупреждаем.
   Если привезли товар из нашего каталога (например, подъёмные механизмы) — можно сразу оприходовать на склад. */
const UNITS = ['шт', 'м', 'рул.', 'кг', 'л', 'упак.', 'компл.'];
function goodsFields(px) {
  return '<div class="goods-box"><div class="hint" style="margin-bottom:8px">Что клиент привёз в счёт долга. Сумма посчитается сама: количество × цена.</div>' +
    '<label class="fld">Что привезли<input class="inp" id="' + px + '-what" list="cat-names" data-in="goods-calc" data-px="' + px + '" placeholder="например: ткань, скотч, механизм подъёмный 160"></label>' +
    '<div class="form" style="margin-top:10px"><label class="fld">Количество<input class="inp" id="' + px + '-qty" data-in="goods-calc" data-px="' + px + '" inputmode="decimal"></label>' +
    '<label class="fld">Единица<select class="inp" id="' + px + '-unit">' + UNITS.map(u => '<option>' + u + '</option>').join('') + '</select></label>' +
    '<label class="fld">Цена за единицу, ₽<input class="inp" id="' + px + '-price" data-in="goods-calc" data-px="' + px + '" inputmode="decimal"></label></div>' +
    '<div id="' + px + '-check" class="hint" style="margin-top:8px"></div>' +
    '<label id="' + px + '-stockrow" style="display:none;gap:8px;align-items:center;margin-top:8px;font-weight:600"><input type="checkbox" class="cb" id="' + px + '-stock" checked> Оприходовать на склад (товар есть в каталоге)</label>' +
    '<datalist id="cat-names">' + Object.values(NODES).map(n => n.it.map(it => '<option value="' + esc(it[0]) + '">').join('')).join('') + '</datalist></div>';
}
const dec = v => parseFloat(String(v || '').replace(/\s/g, '').replace(',', '.')) || 0;
const goodsNote = g => g.what + ' — ' + String(g.qty).replace('.', ',') + ' ' + g.unit + ' × ' + fmt(g.price) + ' ₽';
function readGoods(px) {
  const what = ($('#' + px + '-what') || {}).value || '';
  return { what: what.trim(), qty: dec(($('#' + px + '-qty') || {}).value), unit: ($('#' + px + '-unit') || {}).value || 'шт', price: dec(($('#' + px + '-price') || {}).value),
    stock: !!(findItem(what.trim()) && $('#' + px + '-stock') && $('#' + px + '-stock').checked) };
}
/* пересчёт: подставляем сумму, пока её не меняли руками; если клиент назвал другую — показываем расхождение */
function goodsCalc(px) {
  const g = readGoods(px), amt = $('#' + px + '-amount'), prod = Math.round(g.qty * g.price), chk = $('#' + px + '-check'), row = $('#' + px + '-stockrow');
  if (amt && prod && (!amt.value || num(amt.value) === +(amt.dataset.auto || 0))) { amt.value = fmt(prod); amt.dataset.auto = prod; }
  if (chk) {
    const a = amt ? num(amt.value) : prod;
    chk.innerHTML = !prod ? '' : a === prod ? '<span class="adv">' + String(g.qty).replace('.', ',') + ' × ' + fmt(g.price) + ' = <b>' + rub(prod) + '</b></span>'
      : '<span class="debt"><b>Проверьте сумму:</b> ' + String(g.qty).replace('.', ',') + ' × ' + fmt(g.price) + ' = <b>' + rub(prod) + '</b>, а указано ' + rub(a) + '.</span> ' +
        '<button class="btn sm" data-act="goods-fix" data-px="' + px + '">Поставить ' + rub(prod) + '</button>';
  }
  if (row) row.style.display = findItem(g.what) ? 'flex' : 'none';
}
function stockInGoods(g, cid) {
  if (!g.stock || !g.qty) return;
  DB.stockMoves.push({ id: uid(), date: todayISO(), name: g.what, q: Math.round(g.qty), kind: 'in', note: 'взаимозачёт: ' + ((client(cid) || {}).name || ''), createdAt: Date.now() });
}
Object.assign(IN, {
  'goods-calc': el => goodsCalc(el.dataset.px),
  'pay-amt': () => goodsCalc('p'),
  'b-amt-goods': () => goodsCalc('b')
});
Object.assign(CH, {
  'p-method': el => { const box = $('#p-goods'); if (box) box.style.display = el.value === 'goods' ? 'block' : 'none'; if (el.value === 'goods') goodsCalc('p'); }
});
Object.assign(ACT, {
  'goods-fix': el => { const px = el.dataset.px, g = readGoods(px), a = $('#' + px + '-amount'); if (a) { a.value = fmt(Math.round(g.qty * g.price)); a.dataset.auto = Math.round(g.qty * g.price); } goodsCalc(px); }
});

/* ================= ВЫБОР ПЕРИОДА (как в 1С) ================= */
const D0 = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; };
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addM = (d, n) => { const x = new Date(d); x.setDate(1); x.setMonth(x.getMonth() + n); return x; };
const monStart = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const mStart = d => new Date(d.getFullYear(), d.getMonth(), 1, 12);
const mEnd = d => new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);
const qStart = d => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1, 12);
const hStart = d => new Date(d.getFullYear(), d.getMonth() < 6 ? 0 : 6, 1, 12);
const yStart = d => new Date(d.getFullYear(), 0, 1, 12);
const decStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate() <= 10 ? 1 : d.getDate() <= 20 ? 11 : 21, 12);
const decEnd = s => s.getDate() === 21 ? mEnd(s) : addD(s, 9);
/* вкладки и варианты: [название, () => [с, по]] */
const RANGES = {
  'День': [['Вчера', () => [addD(D0(), -1), addD(D0(), -1)]], ['Сегодня', () => [D0(), D0()]]],
  'Неделя': [['Прошлая неделя', () => [addD(monStart(D0()), -7), addD(monStart(D0()), -1)]], ['Неделя', () => [addD(D0(), -6), D0()]],
    ['С начала этой недели', () => [monStart(D0()), D0()]], ['Эта неделя', () => [monStart(D0()), addD(monStart(D0()), 6)]]],
  'Декада': [['Прошлая декада', () => { const s = decStart(addD(decStart(D0()), -1)); return [s, decEnd(s)]; }], ['С начала этой декады', () => [decStart(D0()), D0()]],
    ['Эта декада', () => [decStart(D0()), decEnd(decStart(D0()))]]],
  // «Месяц» в 1С — от следующего дня того же числа прошлого месяца по сегодня
  'Месяц': [['Прошлый месяц', () => [mStart(addM(D0(), -1)), mEnd(addM(D0(), -1))]], ['Месяц', () => { const t = D0(), s = new Date(t); s.setMonth(s.getMonth() - 1); s.setDate(s.getDate() + 1); return [s, t]; }],
    ['С начала этого месяца', () => [mStart(D0()), D0()]], ['Этот месяц', () => [mStart(D0()), mEnd(D0())]]],
  'Квартал': [['Прошлый квартал', () => { const s = qStart(addM(qStart(D0()), -3)); return [s, addD(qStart(D0()), -1)]; }], ['Квартал', () => [addD(addD(D0(), 1), -91), D0()]],
    ['С начала этого квартала', () => [qStart(D0()), D0()]], ['Этот квартал', () => [qStart(D0()), addD(addM(qStart(D0()), 3), -1)]]],
  'Полугодие': [['Прошлое полугодие', () => { const s = hStart(addM(hStart(D0()), -6)); return [s, addD(hStart(D0()), -1)]; }], ['С начала этого полугодия', () => [hStart(D0()), D0()]],
    ['Это полугодие', () => [hStart(D0()), addD(addM(hStart(D0()), 6), -1)]]],
  'Год': [['Прошлый год', () => [yStart(addM(yStart(D0()), -12)), addD(yStart(D0()), -1)]], ['Год', () => [addD(addD(D0(), 1), -365), D0()]],
    ['С начала этого года', () => [yStart(D0()), D0()]], ['Этот год', () => [yStart(D0()), new Date(D0().getFullYear(), 11, 31, 12)]]],
  'Прочее': [['Всё время', () => [null, null]], ['Последние 14 дней', () => [addD(D0(), -13), D0()]], ['Последние 90 дней', () => [addD(D0(), -89), D0()]]]
};
function rangeOf(name) {
  for (const tab in RANGES) for (const [n, f] of RANGES[tab]) if (n === name) { const [a, b] = f(); return { from: a ? isoOf(a) : '', to: b ? isoOf(b) : '', name: n, tab }; }
  return { from: '', to: '', name: 'Всё время', tab: 'Прочее' };
}
const inRange = (iso, r) => (!r.from || iso >= r.from) && (!r.to || iso <= r.to);
function rangeLabel(r) {
  const dates = r.from || r.to ? (r.from ? ru(r.from) : '…') + ' – ' + (r.to ? ru(r.to) : '…') : '';
  return r.name ? r.name + (dates ? ' · ' + dates : '') : dates || 'Всё время';
}
function rangeButton(r, act, k) {
  return '<button class="btn" data-act="' + act + '"' + (k ? ' data-k="' + k + '"' : '') + ' aria-haspopup="dialog">' + icon('calendar', 16) + rangeLabel(r) + '</button>';
}
/* окно выбора периода; UI.rp — черновик (что выбрано в окне), применяется кнопкой «Выбрать» */
function rangeForm() {
  const p = UI.rp;
  modal('<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0;font-size:22px">Выбор периода</h2><button class="x" data-act="modal-close" aria-label="Закрыть" style="font-size:22px">×</button></div>' +
    '<div class="btns" style="align-items:center;flex-wrap:nowrap"><input class="inp" type="date" id="r-from" value="' + p.from + '" aria-label="С"><span>–</span><input class="inp" type="date" id="r-to" value="' + p.to + '" aria-label="По">' +
    '<button class="btn sm" style="border:0;color:var(--accent);font-weight:600;white-space:nowrap" data-act="rp-clear">Очистить период</button></div>' +
    seg(p.tab, 'rp-tab', Object.keys(RANGES).map(k => [k, k])) +
    '<div class="rp-list" role="listbox">' + RANGES[p.tab].map(([n]) => '<button role="option" aria-selected="' + (p.name === n) + '" class="' + (p.name === n ? 'on' : '') + '" data-act="rp-pick" data-v="' + esc(n) + '">' + n + '</button>').join('') + '</div>' +
    '<div class="btns" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="rp-apply">Выбрать</button></div>');
  const dlg = $('#modal .dlg'); if (dlg) dlg.style.maxWidth = '640px';
}
function readRange() {
  const f = $('#r-from'), t = $('#r-to'); if (!f) return;
  if (f.value !== UI.rp.from || t.value !== UI.rp.to) { UI.rp.from = f.value; UI.rp.to = t.value; UI.rp.name = ''; } // поменяли даты руками — это произвольный период
}
Object.assign(ACT, {
  'range-open': el => { const k = el.dataset.k || 'salesRange'; UI.rpKey = k; UI.rp = Object.assign({ tab: 'Месяц' }, UI[k]); rangeForm(); },
  'rp-tab': el => { readRange(); UI.rp.tab = el.dataset.v; rangeForm(); },
  'rp-pick': el => { Object.assign(UI.rp, rangeOf(el.dataset.v)); rangeForm(); },
  'rp-clear': () => { Object.assign(UI.rp, { from: '', to: '', name: 'Всё время' }); rangeForm(); },
  'rp-apply': () => {
    readRange(); const p = UI.rp;
    if (p.from && p.to && p.from > p.to) [p.from, p.to] = [p.to, p.from];
    UI[UI.rpKey] = { from: p.from, to: p.to, name: p.name, tab: p.tab }; UI.salesSel = {};
    modal(''); render();
  }
});
document.addEventListener('dblclick', e => { // двойной щелчок по варианту — выбрать сразу
  const o = e.target.closest('[data-act="rp-pick"]'); if (!o) return;
  Object.assign(UI.rp, rangeOf(o.dataset.v)); rangeForm(); ACT['rp-apply']();
});
UI.salesRange = rangeOf('Месяц'); UI.homeRange = rangeOf('Сегодня'); UI.payRange = rangeOf('Месяц'); UI.repRange = rangeOf('Месяц');

/* ================= АВТОКОПИЯ в папку на диске ================= */
/* state: unsupported — браузер не умеет; off — папка не выбрана; prompt — нужно разрешение; on — работает */
const BK = { handle: null, state: 'off', last: 0, error: '', timer: null, busy: false, again: false };
const BK_KEEP = 30, BK_DAY = /^LIVARO \d{4}-\d{2}-\d{2}\.json$/;
const KV = { // папку браузер разрешает хранить только в IndexedDB
  open: () => new Promise((res, rej) => { const r = indexedDB.open('livaro', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }),
  async get(k) { try { const db = await KV.open(); return await new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); } catch (e) { return null; } },
  async put(k, v) { try { const db = await KV.open(); await new Promise(res => { const t = db.transaction('kv', 'readwrite'); v === undefined ? t.objectStore('kv').delete(k) : t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = res; }); } catch (e) { /* без IndexedDB папку придётся выбирать при каждом запуске */ } }
};
function bkTime(ts) {
  const d = new Date(ts), hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
  return isoOf(d) === todayISO() ? 'сегодня, ' + hm : ru(isoOf(d)) + ', ' + hm;
}
function bkStatusHtml() {
  if (BK.state === 'on') return '<a href="#/data" class="bk"><i class="dot" style="background:' + (BK.error ? 'var(--debt)' : 'var(--adv)') + '"></i>' + (BK.error ? 'Ошибка автокопии' : 'Автокопия: ' + (BK.last ? bkTime(BK.last) : 'включена')) + '</a>';
  if (BK.state === 'prompt') return '<button class="bk" data-act="bk-reconnect"><i class="dot" style="background:var(--debt)"></i>Автокопия ждёт разрешения — нажмите</button>';
  if (BK.state === 'off') return '<a href="#/data" class="bk"><i class="dot" style="background:var(--debt)"></i>Автокопия выключена</a>';
  return '<span class="bk"><i class="dot" style="background:var(--muted)"></i>Автокопия недоступна</span>';
}
function bkStatus() { const s = $('#bk-status'); if (s) s.innerHTML = bkStatusHtml(); }
function bkSchedule(ms) { if (BK.state !== 'on') return; clearTimeout(BK.timer); BK.timer = setTimeout(bkWrite, ms == null ? 2000 : ms); }
async function bkFile(name, text) {
  const fh = await BK.handle.getFileHandle(name, { create: true }), w = await fh.createWritable();
  await w.write(text); await w.close();
}
async function bkWrite() {
  if (BK.state !== 'on' || !BK.handle) return;
  if (BK.busy) { BK.again = true; return; }
  BK.busy = true;
  try {
    const text = JSON.stringify(DB);
    await bkFile('LIVARO ' + todayISO() + '.json', text);    // копия за день (перезаписывается в течение дня)
    await bkFile('LIVARO последняя копия.json', text);       // всегда самая свежая
    const days = [];
    for await (const e of BK.handle.values()) if (e.kind === 'file' && BK_DAY.test(e.name)) days.push(e.name);
    for (const n of days.sort().reverse().slice(BK_KEEP)) await BK.handle.removeEntry(n).catch(() => {});
    BK.last = Date.now(); BK.error = '';
    try { localStorage.setItem('livaro_bk_last', BK.last); } catch (e) { /* не критично */ }
  } catch (e) {
    if (e && e.name === 'NotAllowedError') BK.state = 'prompt';
    else BK.error = (e && e.message) || 'не удалось записать файл';
  }
  BK.busy = false; bkStatus();
  if (BK.again) { BK.again = false; bkSchedule(); }
}
async function bkInit() {
  try { BK.last = +localStorage.getItem('livaro_bk_last') || 0; } catch (e) { /* нет доступа */ }
  if (!window.showDirectoryPicker) { BK.state = 'unsupported'; return render(); }
  BK.handle = await KV.get('backupDir');
  if (!BK.handle) { BK.state = 'off'; return render(); }
  BK.state = (await BK.handle.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'on' : 'prompt';
  render(); bkSchedule(800);
}
async function bkList() {
  const box = $('#bk-list'); if (!box || BK.state !== 'on') return;
  try {
    const files = [];
    for await (const e of BK.handle.values()) if (e.kind === 'file' && /^LIVARO .*\.json$/.test(e.name)) { const f = await e.getFile(); files.push([e.name, f.lastModified, f.size]); }
    files.sort((a, b) => b[1] - a[1]);
    box.innerHTML = files.length ? '<table class="t"><tbody>' + files.map(([n, t, s]) => '<tr><td><b>' + esc(n) + '</b></td><td class="muted">' + bkTime(t) + '</td><td class="muted num">' + Math.max(1, Math.round(s / 1024)) + ' КБ</td>' +
      '<td class="num"><button class="btn sm" data-act="bk-restore" data-name="' + esc(n) + '">Восстановить из неё</button></td></tr>').join('') + '</tbody></table>' : 'Копий пока нет';
  } catch (e) { box.textContent = 'Не удалось прочитать папку: ' + ((e && e.message) || ''); }
}
Object.assign(ACT, {
  'bk-choose': async () => {
    try {
      const h = await window.showDirectoryPicker({ id: 'livaro-backup', mode: 'readwrite' });
      BK.handle = h; BK.state = 'on'; await KV.put('backupDir', h); await bkWrite(); render();
      toast('Автокопия включена: папка «' + h.name + '»', null, 5000);
    } catch (e) { if (!e || e.name !== 'AbortError') toast('Не удалось выбрать папку'); }
  },
  'bk-reconnect': async () => {
    if (!BK.handle) return go('#/data');
    BK.state = (await BK.handle.requestPermission({ mode: 'readwrite' })) === 'granted' ? 'on' : 'prompt';
    if (BK.state === 'on') { await bkWrite(); toast('Автокопия снова работает'); }
    render();
  },
  'bk-now': async () => { await bkWrite(); render(); toast(BK.error ? 'Не получилось: ' + BK.error : 'Копия сохранена'); },
  'bk-off': async () => {
    if (!confirm('Выключить автокопию? Данные останутся только в браузере.')) return;
    await KV.put('backupDir', undefined); BK.handle = null; BK.state = 'off'; render();
  },
  'bk-restore': async el => {
    const name = el.dataset.name;
    try {
      const f = await (await BK.handle.getFileHandle(name)).getFile(), d = JSON.parse(await f.text());
      if (!d.cat || !d.orders) throw new Error('не файл LIVARO');
      if (!confirm('Восстановить данные из «' + name + '» (' + bkTime(f.lastModified) + ')?\nТекущие данные будут заменены. Перед этим их копия сохранится в ту же папку.')) return;
      await bkFile('LIVARO перед восстановлением ' + todayISO() + ' ' + Date.now() + '.json', JSON.stringify(DB));
      DB = d; if (!DB.trash) DB.trash = []; if (!DB.templates) DB.templates = [];
      commit(); toast('Данные восстановлены из копии', null, 5000);
    } catch (e) { toast('Не удалось восстановить: ' + ((e && e.message) || '')); }
  }
});

/* ================= старт ================= */
load();
window.addEventListener('hashchange', () => { modal(''); render(); window.scrollTo(0, 0); });
render();
bkInit();
