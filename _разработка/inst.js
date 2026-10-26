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

