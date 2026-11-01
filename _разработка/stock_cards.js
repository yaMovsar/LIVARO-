/* ---------- склад карточками (01.11.2026): модель = карточка, цвета = полоски ---------- */
/* Модели те же, что в бланке пересчёта (invModels: одна модель разных цветов, Сатин = Лино).
   Модель «на учёте», если вносили хоть один её цвет; не внесённые цвета такой модели считаются нулём (решение пользователя).
   Минимум — одна цифра на модель для всех цветов: settings.stockMin[ключ модели], иначе минимум папки settings.stockMinF[путь], иначе 2. */
const SOON_DAYS = 14, MIN_DEFAULT = 2, BAR_FULL = 20;
const SWATCH = { 'белый': '#f3f1ea', 'серый': '#9a9fa6', 'ваниль': '#eadcb8', 'лино': '#cdb48d', 'вотан': '#9b7447', '-': '#c9cfd8' };
const ST_LABEL = { ok: 'есть', low: 'мало', soon: 'скоро закончится', no: 'нет' };
const isViewer = () => !!(window.LIVARO_BOOT && LIVARO_BOOT.user && LIVARO_BOOT.user.role === 'viewer');
const modelKey = names => baseName(names[0]) || names[0].toLowerCase();
function minOf(key, folder) {
  const S = DB.settings || {}, own = (S.stockMin || {})[key];
  if (own !== undefined) return own;
  const F = S.stockMinF || {};
  for (let id = folder.id; ; id = id.slice(0, id.lastIndexOf('-'))) {
    const v = F[folderPath(NODES[id])]; if (v !== undefined) return v;
    if (id.indexOf('-') < 0) return MIN_DEFAULT;
  }
}
/* продано за последние N дней (отгрузки и рассрочки) — по актуальным названиям */
function soldMap(days) {
  const since = Date.now() - days * 864e5, m = {};
  const add = it => { const n = itemName(it.n); m[n] = (m[n] || 0) + it.q; };
  DB.orders.forEach(o => { if (o.status === 'shipped' && (o.shippedAt || o.createdAt) > since) o.groups.forEach(g => g.items.forEach(add)); });
  DB.installments.forEach(i => { if (i.createdAt > since) i.groups.forEach(g => g.items.forEach(add)); });
  return m;
}
function cellState(c, min) {
  if (c.have <= 0 || c.free < 0) return 'no';
  if (c.sold > 0 && c.have / (c.sold / 30) < SOON_DAYS) return 'soon';
  return c.have <= min ? 'low' : 'ok';
}
/* все модели каталога с остатками по цветам */
function stockData() {
  const M = stockMap(), sold = soldMap(30), models = [];
  allFolders(DB.cat).forEach(({ n }) => {
    const items = orderIdx(n).map(i => n.it[i][0]); if (!items.length) return;
    const ms = invModels(items), one = ms.length === 1 && n.id.indexOf('-') > 0;
    if (one) ms[0].title = folderTitle(n.n);
    const group = one ? NODES[n.id.slice(0, n.id.lastIndexOf('-'))] : n;
    ms.forEach(r => {
      const key = modelKey(r.names), min = minOf(key, n), tracked = r.names.some(nm => M[nm] && M[nm].tracked);
      const cells = INV_COLS.map(([k, l]) => [k, l]).concat([['-', 'Кол-во']]).filter(([k]) => r.cells[k]).map(([k, l]) => {
        const name = r.cells[k], s = M[name] || {}, c = { k, label: l, name, have: s.tracked ? s.have : 0, res: s.res || 0, sold: sold[name] || 0 };
        c.free = c.have - c.res; c.st = cellState(c, min); return c;
      });
      const worst = tracked ? ['no', 'soon', 'low'].find(x => cells.some(c => c.st === x)) || 'ok' : '';
      models.push({ title: r.title, key, min, tracked, cells, worst, total: cells.reduce((a, c) => a + Math.max(0, c.have), 0), folder: n, group, top: n.id.split('-')[0] });
    });
  });
  return models;
}
/* название товара → его клетка (для меток в каталоге, корзине и «Товарах») */
function stockIndex() {
  const ix = {};
  stockData().forEach(m => m.cells.forEach(c => { ix[c.name] = Object.assign({ tracked: m.tracked, min: m.min }, c); }));
  return ix;
}
function stockBadge(c) {
  if (!c || !c.tracked) return '';
  if (c.free <= 0) return '<span class="sb no" title="На складе ' + c.have + ', в заказах ' + c.res + '">' + (c.have > 0 ? 'всё в заказах' : 'нет') + '</span>';
  return c.free <= c.min ? '<span class="sb low" title="Свободно на складе">мало: ' + c.free + '</span>' : '<span class="sb ok" title="Свободно на складе">' + c.free + ' шт</span>';
}
function stockCardHtml(m) {
  const v = isViewer();
  return '<div class="scard"><div class="sg"><span>' + esc(m.group.n.replace(/^\d+\.\s*/, '')) + '</span>' + (m.worst && m.worst !== 'ok' ? '<span class="sbadge ' + m.worst + '">' + ST_LABEL[m.worst] + '</span>' : '') + '</div>' +
    '<div class="stt"><b>' + esc(m.title) + '</b><span>' + (m.tracked ? m.total : '—') + '</span></div>' +
    m.cells.map(c => '<button class="srow" data-act="sk-cell" data-name="' + esc(c.name) + '" title="' + esc(c.name) + '"><span class="sl"><i class="swc" style="background:' + SWATCH[c.k] + '"></i>' + c.label + '</span>' +
      '<span class="str"><i class="' + (m.tracked ? c.st : '') + '" style="width:' + (m.tracked && c.have > 0 ? Math.max(5, Math.min(100, c.have / BAR_FULL * 100)) : 0) + '%"></i></span>' +
      '<b class="' + (m.tracked ? c.st : 'muted') + '">' + (m.tracked ? c.have : '—') + '</b></button>').join('') +
    '<div class="sfoot">' + (v ? '<span class="muted">мин. ' + m.min + '</span>' : '<button class="smin" data-act="sk-min" data-key="' + esc(m.key) + '" data-f="' + m.folder.id + '" title="Минимальный остаток для всех цветов модели">мин. ' + m.min + '</button>') +
    (m.cells.some(c => c.res) ? '<span class="muted">в заказах: ' + m.cells.reduce((a, c) => a + c.res, 0) + '</span>' : '') + '</div></div>';
}
VIEWS.stock = () => {
  const all = stockData(), on = all.filter(m => m.tracked), v = isViewer();
  const f = UI.stF || '', top = UI.stTop || 'all', scope = UI.stScope || 'have', q = (UI.stQ || '').trim().toLowerCase();
  const cnt = { total: 0, low: 0, soon: 0, no: 0 };
  on.forEach(m => m.cells.forEach(c => { cnt.total += Math.max(0, c.have); if (c.st !== 'ok') cnt[c.st]++; }));
  const list = all.filter(m => (scope === 'all' || m.tracked) && (top === 'all' || m.top === top) &&
    (!q || (m.title + ' ' + m.group.n + ' ' + m.cells.map(c => c.name).join(' ')).toLowerCase().includes(q)) && (!f || (m.tracked && m.cells.some(c => c.st === f))));
  const tile = (k, cls, l, val, h) => '<button class="stile ' + cls + (f === k ? ' on' : '') + '" data-act="st-f" data-v="' + k + '" aria-pressed="' + (f === k) + '"><span class="l">' + l + '</span><span class="v">' + val + '</span><span class="h">' + h + '</span></button>';
  const tops = DB.cat.map((n, i) => [String(i), n.n.replace(/^\d+\.\s*/, ''), on.filter(m => m.top === String(i)).length]).filter(x => x[2] || scope === 'all');
  const moves = v ? [] : DB.stockMoves.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
  return '<div class="head"><div><h1>Склад</h1><div class="sub-h">' + (v ? 'Остатки на складе. Нажмите на цвет — подробнее.' : 'Остатки по моделям и цветам. Отгрузка списывает товар сама. Нажмите на цвет — история и приход.') + '</div></div>' +
    (v ? '' : '<div class="btns"><a class="btn" href="#/invprint">Бланк пересчёта</a><a class="btn" href="#/inv">Пересчёт</a><button class="btn pri" data-act="sk-open" data-kind="in">+ Приход</button></div>') + '</div>' +
    '<div class="stiles">' + tile('', 't-all', 'На складе всего', cnt.total + ' шт', on.length + ' ' + plural(on.length, 'модель', 'модели', 'моделей') + ' на учёте') +
    tile('low', 't-low', 'Мало', cnt.low, 'остаток не больше минимума') + tile('soon', 't-soon', 'Скоро закончится', cnt.soon, 'хватит меньше чем на 2 недели') +
    tile('no', 't-no', 'Нет в наличии', cnt.no, 'или всё уже в заказах') + '</div>' +
    '<div class="card"><div class="filters"><div class="fgroup"><span>Папка</span>' + seg(top, 'st-top', [['all', 'Все']].concat(tops.map(([i, l, c]) => [i, esc(l), c]))) + '</div></div>' +
    '<div class="filters" style="margin-top:10px">' + seg(scope, 'st-scope', [['have', 'Только на учёте'], ['all', 'Весь каталог']]) +
    '<label class="search">' + icon('search', 16) + '<input class="inp" id="st-q" data-in="st-q" placeholder="Найти модель: милан 4х, антресоль…" value="' + esc(UI.stQ || '') + '"></label>' +
    (f ? '<button class="btn sm" data-act="st-f" data-v="">Показать все</button>' : '') + '</div></div>' +
    (list.length ? '<div class="scards">' + list.map(stockCardHtml).join('') + '</div>' :
      '<div class="card empty">' + (on.length || scope === 'all' ? 'Ничего не найдено' : 'На складе пока ничего не учтено. Нажмите «+ Приход» или «Пересчёт» — товар встанет на учёт.') + '</div>') +
    '<div class="slegend"><span><i class="ok"></i>есть</span><span><i class="low"></i>мало (≤ минимума)</span><span><i class="soon"></i>скоро закончится — по продажам за 30 дней</span><span><i class="no"></i>нет / всё в заказах</span></div>' +
    (moves.length ? '<div class="card"><h2>Последние движения</h2><table class="t"><tbody>' + moves.map(x => '<tr><td style="white-space:nowrap">' + ru(x.date) + '</td><td>' +
      (x.kind === 'in' ? st('paid', 'приход') : st('ordered', 'пересчёт')) + '</td><td>' + esc(x.name) + (x.note ? '<div class="hint">' + esc(x.note) + '</div>' : '') + '</td>' +
      '<td class="num amount">' + (x.q > 0 ? '+' : '') + x.q + '</td><td style="width:36px"><button class="x" data-act="sk-del" data-id="' + x.id + '" aria-label="Удалить движение">×</button></td></tr>').join('') + '</tbody></table></div>' : '');
};
/* окно одного цвета: на складе / в заказах / свободно и история движений */
function stockCellForm(name) {
  const ix = stockIndex(), c = ix[name], M = stockMap(), s = M[name] || {}, v = isViewer(), ev = [];
  if (!c) return;
  if (s.tracked) {
    DB.stockMoves.forEach(m => { if (m.name === name) ev.push([m.createdAt, m.date, m.kind === 'in' ? 'Приход' + (m.note && !v ? ' · ' + m.note : '') : 'Пересчёт', m.q]); });
    DB.orders.forEach(o => { const t = o.shippedAt || o.createdAt; if (o.status === 'shipped' && t > s.since) o.groups.forEach(g => g.items.forEach(it => { if (itemName(it.n) === name) ev.push([t, o.shipDate || o.date, 'Отгрузка № ' + o.no, -it.q]); })); });
    DB.installments.forEach(i => { if (i.createdAt > s.since) i.groups.forEach(g => g.items.forEach(it => { if (itemName(it.n) === name) ev.push([i.createdAt, i.date, 'Рассрочка', -it.q]); })); });
  }
  ev.sort((a, b) => b[0] - a[0]);
  modal('<h2 style="margin:0">' + esc(name) + '</h2><div class="hint">' + (c.tracked ? ST_LABEL[c.st] + ' · минимум ' + c.min + ' · продано за 30 дней: ' + c.sold : 'ещё не на учёте') + '</div>' +
    '<div class="snums"><div><b>' + c.have + '</b><span>на складе</span></div><div><b>' + c.res + '</b><span>в заказах</span></div><div><b class="' + (c.free < 0 ? 'debt' : '') + '">' + c.free + '</b><span>свободно</span></div></div>' +
    '<b>История</b><div class="box" style="max-height:260px">' + (ev.length ? ev.slice(0, 40).map(([, d, t, q]) => '<div class="line"><span>' + ru(d) + ' · ' + esc(t) + '</span><b class="' + (q > 0 ? 'adv' : q < 0 ? 'debt' : '') + '">' + (q > 0 ? '+' : '') + q + '</b></div>').join('') : '<div class="hint" style="padding:8px">Движений нет</div>') + '</div>' +
    '<div class="btns" style="justify-content:flex-end">' + (v ? '' : '<button class="btn" data-act="sk-open" data-kind="adj" data-name="' + esc(name) + '">Пересчитать</button><button class="btn pri" data-act="sk-open" data-kind="in" data-name="' + esc(name) + '">+ Приход</button>') +
    '<button class="btn" data-act="modal-close">Закрыть</button></div>');
}
/* окно минимума: для модели или для всей папки */
function stockMinForm(key, fid) {
  const n = NODES[fid], m = stockData().find(x => x.key === key && x.folder === n); if (!m) return;
  modal('<h2 style="margin:0">Минимальный остаток</h2><div class="hint">Если остаток любого цвета станет не больше этого числа — карточка покажет «мало».</div>' +
    '<label class="fld">' + esc(m.title) + ' — для всех цветов, шт<input class="inp" id="smin-n" inputmode="numeric" value="' + m.min + '"></label>' +
    '<label class="chk"><input type="checkbox" class="cb" id="smin-all"> Поставить этот минимум всем моделям папки «' + esc(m.group.n.replace(/^\d+\.\s*/, '')) + '»</label>' +
    '<div class="btns" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="sk-min-save" data-key="' + esc(key) + '" data-f="' + fid + '">Сохранить</button></div>');
}
Object.assign(ACT, {
  'st-f': el => { UI.stF = el.dataset.v; render(); },
  'st-top': el => { UI.stTop = el.dataset.v; render(); },
  'st-scope': el => { UI.stScope = el.dataset.v; UI.stTop = 'all'; render(); },
  'sk-cell': el => stockCellForm(el.dataset.name),
  'sk-min': el => { if (!isViewer()) stockMinForm(el.dataset.key, el.dataset.f); },
  'sk-min-save': el => {
    const v = num($('#smin-n').value), S = Object.assign({}, DB.settings), m = stockData().find(x => x.key === el.dataset.key && x.folder === NODES[el.dataset.f]);
    if (!m) return modal('');
    if ($('#smin-all').checked) {
      const own = Object.assign({}, S.stockMin);
      stockData().filter(x => x.group === m.group).forEach(x => { delete own[x.key]; });
      S.stockMin = own; S.stockMinF = Object.assign({}, S.stockMinF, { [folderPath(m.group)]: v });
    } else S.stockMin = Object.assign({}, S.stockMin, { [m.key]: v });
    DB.settings = S; modal(''); commit(); toast('Минимум: ' + v + ' шт');
  }
});
