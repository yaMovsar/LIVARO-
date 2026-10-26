"""Бланк инвентаризации: удобная печать на А4 (поля, повтор шапки, высокие строки, графа «Примечание»)."""
R = [
    ("""    rows += '<tr class="g"><td colspan="3">' + esc(folderPath(n)) + '</td></tr>';""",
     """    rows += '<tr class="g"><td colspan="4">' + esc(folderPath(n)) + '</td></tr>';"""),
    ("""    orderIdx(n).forEach(i => { rows += '<tr><td>' + (++no) + '</td><td>' + esc(n.it[i][0]) + '</td><td></td></tr>'; });""",
     """    orderIdx(n).forEach(i => { rows += '<tr><td>' + (++no) + '</td><td>' + esc(n.it[i][0]) + '</td><td></td><td></td></tr>'; });"""),
    ("""    '<div class="paperwrap"><div class="paper"><div class="p-head"><div class="brand">LIVARO</div><div style="text-align:right;font-size:15px"><b>Инвентаризация склада</b>""",
     """    '<style>@media print{@page{size:A4;margin:12mm 10mm 12mm 12mm}}</style>' + // поля на каждом листе
    '<div class="paperwrap"><div class="paper inv-paper"><div class="p-head"><div class="brand">LIVARO</div><div style="text-align:right;font-size:15px"><b>Инвентаризация склада</b>"""),
    ("""    '<table class="p-t"><thead><tr><th style="width:28px">№</th><th>Товар</th><th style="width:90px">Факт, шт</th></tr></thead><tbody>' + rows + '</tbody></table>' +""",
     """    '<table class="p-t"><thead><tr><th style="width:30px">№</th><th>Товар</th><th style="width:26mm">Факт, шт</th><th style="width:34mm">Примечание</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div style="font-size:12px;margin-top:6px">Всего позиций: ' + no + '</div>' +"""),
]
for p in (r'C:\Users\user\Desktop\LIVARO\app\app.js', r'C:\Users\user\Desktop\LIVARO\_разработка\inv.js'):
    s = open(p, encoding='utf-8').read()
    for a, b in R:
        if b in s:
            continue
        if a not in s:
            print('НЕ НАЙДЕНО в', p.split('\\')[-1], ':', a.strip()[:60])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)
print('ok')
