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
        for (let b = 1; b <= c; b++) { const n = Math.ceil(left / (c - b + 1)); left -= n; places.push({ g: g.t, text: labelName(it.n) + ' — ' + n + ' шт', sub: c > 1 ? 'коробка ' + b + ' из ' + c : '', fr }); }
      } else for (let b = 1; b <= c; b++) places.push({ g: g.t, text: labelName(it.n), sub: c > 1 ? 'коробка ' + b + ' из ' + c : '', fr });
    });
    if (kit.length) {
      const k = gi + '|kit', c = adj[k] && adj[k].c !== undefined ? adj[k].c : 1, fr = kit.some(it => (adj[gi + '|' + g.items.indexOf(it)] || {}).fr);
      lines.push({ k, g, kit: true, c });
      for (let b = 1; b <= c; b++) places.push({ g: g.t, text: 'Фурнитура: ' + kit.map(it => it.n + (it.q > 1 ? ' — ' + it.q + ' шт' : '')).join('; '), sub: c > 1 ? 'пакет ' + b + ' из ' + c : '', fr });
    }
  });
  return { places, lines };
}
VIEWS.labels = ([id]) => {
  const o = order(id);
  if (!o) return '<div class="card empty">Заказ не найден</div>';
  const c = client(o.clientId) || { name: '—' }, adj = (UI.lbl && UI.lbl.id === o.id) ? UI.lbl.adj : {}, P = buildPlaces(o, adj), N = P.places.length;
  const date = ru(o.shipDate || o.date);
  const lab = (p, i) => '<div class="lab"><div class="top"><span class="brand">LIVARO</span><span class="ldate">' + date + '</span></div>' +
    '<div class="ord">Заказ № ' + o.no + '</div><div class="cli">' + esc(c.name) + '</div>' +
    '<div class="cab"><b>' + esc(p.g) + '</b></div><div class="what">' + esc(p.text) + (p.sub ? '<br>' + p.sub : '') + '</div>' +
    (p.fr ? '<div class="fragile">ХРУПКОЕ</div>' : '') + '<div class="lnum"><small>Место</small><b>' + (i + 1) + ' / ' + N + '</b></div></div>';
  const a4 = (DB.settings && DB.settings.labelFmt) === 'a4';
  let sheets = '';
  if (a4) for (let s = 0; s < N; s += 8) { // лист А4 на 8 наклеек
    let cells = P.places.slice(s, s + 8).map((p, j) => lab(p, s + j)).join('');
    for (let e = Math.min(8, N - s); e < 8; e++) cells += '<div class="lab lempty"></div>';
    sheets += '<div class="lsheet">' + cells + '</div>';
  }
  else sheets = '<style>@media print{@page{size:112mm 75mm;margin:0}}</style>' + // термопринтер: одна наклейка 112×75 мм = одна страница
    '<div class="tlabs">' + P.places.map((p, i) => lab(p, i).replace('class="lab"', 'class="lab tlab"')).join('') + '</div>';
  return '<div class="noprint"><div class="head"><div><div class="crumb"><a href="#/sale/' + o.id + '">Заказ № ' + o.no + '</a> / Этикетки</div><h1>Этикетки на коробки · ' + N + ' ' + plural(N, 'место', 'места', 'мест') + '</h1>' +
    '<div class="sub-h">Проверьте число мест. Если шкаф упакован иначе, поправьте здесь (для этого заказа) или настройте упаковку товара в «Товарах» (навсегда).</div></div>' +
    '<div class="btns">' + seg(oddMode(), 'lbl-odd', [['join', 'Лишняя дверь — в последнюю коробку'], ['split', 'Лишняя дверь — отдельно']]) + seg(a4 ? 'a4' : 'thermal', 'lbl-fmt', [['thermal', 'Термопринтер 11,2 × 7,5 см'], ['a4', 'А4, 8 на листе']]) +
    '<a class="btn" href="#/sale/' + o.id + '">← К заказу</a><button class="btn pri big" data-act="print">Распечатать</button></div></div>' +
    (a4 ? '' : '<div class="hint" style="margin-bottom:14px">При печати выберите термопринтер, размер бумаги 112 × 75 мм (или 11,2 × 7,5 см), поля — «нет», масштаб — 100%. Каждая этикетка печатается на отдельной наклейке.</div>') +
    '<div class="card tcard"><table class="t"><thead><tr><th>Шкаф</th><th>Товар</th><th class="num">Кол-во</th><th>Упаковка</th><th class="num">Мест</th><th>Хрупкое</th></tr></thead><tbody>' +
    P.lines.map(l => l.kit
      ? '<tr><td class="muted">' + esc(l.g.t) + '</td><td><b>Пакет фурнитуры</b> <span class="hint">ручки, карниз и т.п.</span></td><td></td><td class="muted">общий пакет</td>' +
        '<td class="num"><input class="inp pin" style="width:70px" data-ch="lbl-c" data-k="' + l.k + '" value="' + l.c + '"></td><td></td></tr>'
      : '<tr><td class="muted">' + esc(l.g.t) + '</td><td>' + esc(l.it.n) + '</td><td class="num">' + l.it.q + '</td><td class="muted">' + packText(l.r) + '</td>' +
        '<td class="num">' + (l.r.mode === 'kit' ? '<span class="muted">в пакете</span>' : '<input class="inp pin" style="width:70px" data-ch="lbl-c" data-k="' + l.k + '" value="' + l.c + '">') + '</td>' +
        '<td><input type="checkbox" class="cb" data-ch="lbl-fr" data-k="' + l.k + '"' + (l.fr ? ' checked' : '') + ' aria-label="Хрупкое"></td></tr>').join('') +
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

