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
    '<div class="btns"><a class="btn" href="#/inv">Инвентаризация списком</a><button class="btn" data-act="sk-open" data-kind="adj">Пересчитать один товар</button><button class="btn pri" data-act="sk-open" data-kind="in">+ Приход</button></div></div>' +
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

