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
    '<th class="mcol">Итого</th><th style="width:24mm">Примечание</th></tr></thead>' +
    (body || '<tbody><tr><td colspan="' + cols + '">' + (sel && !sel.length ? 'Отметьте галочками папки, по которым нужен бланк' : 'В выбранных папках нет товаров') + '</td></tr></tbody>') + '</table></div></div>';
};
