/* ================= ОТЧЁТ ПО МЕСЯЦАМ (01.11.2026) ================= */
/* Клиенты за месяц в сравнении с другим месяцем: сколько шкафов и на какую сумму. Считаем по дате отгрузки (как балансы);
   оформленные, но не отгруженные заказы не входят. Розница в рассрочку — отдельной строкой. */
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const monthName = ym => MONTHS[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);
const prevMonth = ym => { const y = +ym.slice(0, 4), m = +ym.slice(5, 7); return m === 1 ? (y - 1) + '-12' : y + '-' + pad(m - 1); };
const RETAIL = '__retail';
const repTabs = () => '<div style="margin-top:10px">' + seg(UI.repTab || 'period', 'rep-tab', [['period', 'За период'], ['month', 'По месяцам']]) + '</div>';
/* продажи по клиентам за месяц: сумма, шкафы, накладные и что именно купили */
function monthSales(ym) {
  const by = {};
  const get = k => by[k] || (by[k] = { s: 0, cab: 0, docs: [], items: {} });
  const take = (x, g) => {
    if (g.items.some(isCarcass)) x.cab++;
    g.items.forEach(it => { if (isHandle(it) || isCornice(it)) return; const n = shortTitle(it.n); x.items[n] = (x.items[n] || 0) + it.q; });
  };
  shipped().forEach(o => { if (!o.shipDate || o.shipDate.slice(0, 7) !== ym) return; const x = get(o.clientId); x.s += o.total; x.docs.push({ no: '№ ' + o.no, href: '#/sale/' + o.id }); o.groups.forEach(g => take(x, g)); });
  DB.installments.forEach(i => { if (!i.date || i.date.slice(0, 7) !== ym) return; const x = get(RETAIL); x.s += i.total || 0; x.docs.push({ no: instNo(i) + ' · ' + i.buyer.name, href: '#/ins/' + i.id }); i.groups.forEach(g => take(x, g)); });
  return by;
}
/* месяцы, в которых есть отгрузки, + текущий */
function salesMonths() {
  const set = {}; set[todayISO().slice(0, 7)] = 1;
  shipped().forEach(o => { if (o.shipDate) set[o.shipDate.slice(0, 7)] = 1; });
  DB.installments.forEach(i => { if (i.date) set[i.date.slice(0, 7)] = 1; });
  return Object.keys(set).sort().reverse();
}
const delta = (a, b, money) => {
  if (!b && !a) return '<span class="muted">—</span>';
  const d = a - b, pct = b ? Math.round(d / b * 100) : null, txt = money ? rub(Math.abs(d)) : Math.abs(d);
  if (!d) return '<span class="muted">без изменений</span>';
  return '<span class="' + (d > 0 ? 'mup' : 'mdown') + '">' + (d > 0 ? '▲ +' : '▼ −') + txt + (pct !== null ? ' (' + (d > 0 ? '+' : '−') + Math.abs(pct) + '%)' : '') + '</span>';
};
function monthReport() {
  const months = salesMonths(); if (!months.includes(prevMonth(todayISO().slice(0, 7)))) months.splice(1, 0, prevMonth(todayISO().slice(0, 7)));
  // по умолчанию — последний законченный месяц (текущий ещё идёт, сравнение с полным месяцем было бы нечестным)
  const last = prevMonth(todayISO().slice(0, 7));
  if (!UI.repM || !months.includes(UI.repM)) UI.repM = Object.keys(monthSales(last)).length ? last : months.find(m => Object.keys(monthSales(m)).length) || months[0];
  if (!UI.repC) UI.repC = prevMonth(UI.repM);
  const A = monthSales(UI.repM), B = monthSales(UI.repC), keys = [...new Set(Object.keys(A).concat(Object.keys(B)))];
  const name = k => k === RETAIL ? 'Розница (рассрочка)' : (client(k) || {}).name || '—';
  const rows = keys.map(k => ({ k, a: A[k] || { s: 0, cab: 0, docs: [], items: {} }, b: B[k] || { s: 0, cab: 0 } }))
    .sort((x, y) => (y.a.s > 0) - (x.a.s > 0) || y.a.s - x.a.s || y.b.s - x.b.s || name(x.k).localeCompare(name(y.k), 'ru'));
  const sum = by => Object.values(by).reduce((s, x) => s + x.s, 0), cab = by => Object.values(by).reduce((s, x) => s + x.cab, 0);
  const docs = by => Object.values(by).reduce((s, x) => s + x.docs.length, 0), cnt = by => Object.keys(by).filter(k => k !== RETAIL).length;
  const avg = by => docs(by) ? Math.round(sum(by) / docs(by)) : 0;
  const mopts = sel => [...new Set(months.concat([UI.repC, prevMonth(UI.repM), (+UI.repM.slice(0, 4) - 1) + UI.repM.slice(4)]))].sort().reverse()
    .map(m => '<option value="' + m + '"' + (m === sel ? ' selected' : '') + '>' + monthName(m) + '</option>').join('');
  const kpi = (l, a, b, money) => '<div class="kpi"><div class="l">' + l + '</div><div class="v">' + (money ? rub(a) : a) + '</div><div class="h">' + monthName(UI.repC) + ': ' + (money ? rub(b) : b) + ' · ' + delta(a, b, money) + '</div></div>';
  const LA = MONTHS[+UI.repM.slice(5, 7) - 1], LB = MONTHS[+UI.repC.slice(5, 7) - 1] + (UI.repC.slice(0, 4) !== UI.repM.slice(0, 4) ? ' ' + UI.repC.slice(0, 4) : '');
  const body = rows.map(r => {
    const tag = !r.b.s && r.a.s ? ' <span class="tag a">новый</span>' : r.b.s && !r.a.s ? ' <span class="tag d">не покупал</span>' : '';
    const open = UI.repOpen === r.k && r.a.s;
    return '<tr class="' + (r.a.s ? 'click' : 'mgone') + '"' + (r.a.s ? ' data-act="rep-open-c" data-k="' + r.k + '"' : '') + '><td class="c-client">' + (r.a.s ? '<span class="mtw">' + (open ? '▾' : '▸') + '</span>' : '<span class="mtw"></span>') + esc(name(r.k)) + tag + '</td>' +
      '<td class="num">' + (r.a.cab || '<span class="muted">—</span>') + '</td><td class="num amount">' + (r.a.s ? rub(r.a.s) : '<span class="muted">—</span>') + '</td>' +
      '<td class="num">' + (r.b.s ? rub(r.b.s) : '<span class="muted">—</span>') + '</td><td class="num">' + delta(r.a.s, r.b.s, true) + '</td></tr>' +
      (open ? '<tr class="mdet"><td colspan="5"><div class="mdet-in"><div><b>Что купил</b>' + Object.entries(r.a.items).sort((x, y) => y[1] - x[1]).map(([n, q]) => '<div class="line"><span>' + esc(n) + '</span><b>' + q + ' шт</b></div>').join('') + '</div>' +
        '<div><b>Накладные</b><div class="mdocs">' + r.a.docs.map(d => '<a href="' + d.href + '">' + esc(d.no) + '</a>').join('') + '</div></div></div></td></tr>' : '');
  }).join('');
  return '<div class="head"><div><h1>Отчёты</h1><div class="sub-h">Продажи по клиентам за месяц — по дате отгрузки. Нажмите на клиента — что он купил.</div>' + repTabs() + '</div>' +
    '<div class="btns noprint"><button class="btn" data-act="rep-m-xls">Скачать в Excel</button><button class="btn" data-act="print">Печать</button></div></div>' +
    '<div class="card noprint"><div class="filters"><div class="fgroup"><span>Месяц</span><select class="inp" style="min-height:36px" data-ch="rep-m">' + mopts(UI.repM) + '</select></div>' +
    '<div class="fgroup"><span>Сравнить с</span><select class="inp" style="min-height:36px" data-ch="rep-c">' + mopts(UI.repC) + '</select></div></div></div>' +
    (UI.repM === todayISO().slice(0, 7) ? '<div class="warn">' + monthName(UI.repM) + ' ещё идёт — цифры на сегодня, а сравниваемый месяц полный.</div>' : '') +
    '<h2 class="mprint-h">' + monthName(UI.repM) + ' в сравнении с: ' + monthName(UI.repC) + '</h2>' +
    '<div class="kpis">' + kpi('Продано', sum(A), sum(B), true) + kpi('Шкафов', cab(A), cab(B)) + kpi('Клиентов купили', cnt(A), cnt(B)) + kpi('Средняя накладная', avg(A), avg(B), true) + '</div>' +
    '<div class="card tcard">' + (rows.length ? '<div class="scroll"><table class="t mtable" style="min-width:640px"><thead><tr><th>Клиент</th><th class="num">Шкафов</th><th class="num">' + LA + '</th><th class="num">' + LB + '</th><th class="num">Разница</th></tr></thead><tbody>' + body +
      '<tr class="mtot"><td>Итого</td><td class="num">' + cab(A) + '</td><td class="num">' + rub(sum(A)) + '</td><td class="num">' + rub(sum(B)) + '</td><td class="num">' + delta(sum(A), sum(B), true) + '</td></tr></tbody></table></div>'
      : '<div class="empty">В этих месяцах отгрузок нет</div>') + '</div>';
}
Object.assign(ACT, {
  'rep-tab': el => { UI.repTab = el.dataset.v; render(); },
  'rep-open-c': el => { UI.repOpen = UI.repOpen === el.dataset.k ? null : el.dataset.k; render(); },
  'rep-m-xls': () => {
    if (typeof XLSX === 'undefined') return toast('Не загрузилась библиотека Excel');
    const A = monthSales(UI.repM), B = monthSales(UI.repC), keys = [...new Set(Object.keys(A).concat(Object.keys(B)))];
    const name = k => k === RETAIL ? 'Розница (рассрочка)' : (client(k) || {}).name || '—';
    const aoa = [['Клиент', 'Шкафов (' + monthName(UI.repM) + ')', monthName(UI.repM) + ', ₽', monthName(UI.repC) + ', ₽', 'Разница, ₽', 'Разница, %']];
    keys.map(k => [k, (A[k] || {}).s || 0, (B[k] || {}).s || 0]).sort((x, y) => y[1] - x[1] || y[2] - x[2]).forEach(([k, a, b]) =>
      aoa.push([name(k), (A[k] || {}).cab || 0, a, b, a - b, b ? Math.round((a - b) / b * 100) : '']));
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 34 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 11 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'По месяцам');
    XLSX.writeFile(wb, 'LIVARO продажи ' + monthName(UI.repM) + '.xlsx'); toast('Файл скачан в «Загрузки»');
  }
});
Object.assign(CH, {
  'rep-m': el => { UI.repM = el.value; UI.repC = prevMonth(el.value); UI.repOpen = null; render(); },
  'rep-c': el => { UI.repC = el.value; render(); }
});
