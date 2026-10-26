"""Накладная рассрочки для покупателя: без процента и переплаты (24.10.2026)."""
R = [
    ("""  s.groups.forEach((g, gi) => {
    const sm = gsum(g);
    rows += '<tr class="g"><td>' + (gi + 1) + '</td><td>' + esc(g.t) + '</td><td class="num">1 шт</td><td class="num">' + fmt(sm) + ',00</td></tr>';
    g.items.forEach(it => { rows += '<tr class="c"><td></td><td class="nm">' + esc(it.n) + '</td><td class="num">' + it.q + '</td><td class="num">' + (it.p ? fmt(it.q * it.p) + ',00' : 'входит') + '</td></tr>'; });
  });""",
     """  // покупателю наценка не видна: суммы шкафов сразу с учётом рассрочки (остаток округления — в последний), детали без цен
  const k = s.price ? s.total / s.price : 1; let left = s.total;
  s.groups.forEach((g, gi) => {
    const sm = gi === s.groups.length - 1 ? left : Math.round(gsum(g) * k); left -= sm;
    rows += '<tr class="g"><td>' + (gi + 1) + '</td><td>' + esc(g.t) + '</td><td class="num">1 шт</td><td class="num">' + fmt(sm) + ',00</td></tr>';
    g.items.forEach(it => { rows += '<tr class="c"><td></td><td class="nm">' + esc(it.n) + '</td><td class="num">' + it.q + '</td><td></td></tr>'; });
  });"""),
    ("""'<tr><td colspan="3" class="num"><b>Цена товара</b></td><td class="num"><b>' + fmt(s.price) + ',00</b></td></tr></tbody></table>' +""",
     """'<tr><td colspan="3" class="num"><b>Итого</b></td><td class="num"><b>' + fmt(s.total) + ',00</b></td></tr></tbody></table>' +"""),
    ("""    '<div class="line"><span>Цена товара</span><span>' + fmt(s.price) + ',00</span></div>' +
    '<div class="line"><span>Переплата ' + s.pct + '%</span><span>' + fmt(s.markup) + ',00</span></div>' +
""", ""),
]
for p in (r'C:\Users\user\Desktop\LIVARO\app\app.js', r'C:\Users\user\Desktop\LIVARO\_разработка\inst.js'):
    s = open(p, encoding='utf-8').read()
    for a, b in R:
        if a not in s:
            print('НЕ НАЙДЕНО в', p.split('\\')[-1], ':', a.strip()[:60])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)
print('ok')
