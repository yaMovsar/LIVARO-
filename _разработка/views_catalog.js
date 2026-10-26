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

