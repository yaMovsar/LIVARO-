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

