"""Вставляет range.js в app.js и переводит «Продажи» на выбор периода."""
p = r'C:\Users\user\Desktop\LIVARO\app\app.js'
s = open(p, encoding='utf-8').read()
rng = open(r'C:\Users\user\Desktop\LIVARO\_разработка\range.js', encoding='utf-8').read()
start = '/* ================= ВЫБОР ПЕРИОДА'
mark = '/* ================= АВТОКОПИЯ'
if start in s:
    s = s[:s.index(start)] + s[s.index(mark):]
s = s.replace(mark, rng + '\n' + mark, 1)
R = [("'<div class=\"fgroup\"><span>Период</span>' + periodChips(UI.salesPeriod, 'sales-period') + '</div>'",
      "'<div class=\"fgroup\"><span>Период</span>' + rangeButton(UI.salesRange, 'range-open') + '</div>'"),
     ("inPeriod(o.shipDate || o.date, UI.salesPeriod)", "inRange(o.shipDate || o.date, UI.salesRange)"),
     ("  search: '<circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.3-4.3\"/>',",
      "  search: '<circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.3-4.3\"/>',\n  calendar: '<rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"/><path d=\"M16 2v4\"/><path d=\"M8 2v4\"/><path d=\"M3 10h18\"/>',")]
for a, b in R:
    if a not in s and b not in s:
        print('НЕ НАЙДЕНО:', a[:60])
    s = s.replace(a, b)
open(p, 'w', encoding='utf-8').write(s)
# держим исходник «Продаж» в том же виде, чтобы splice_sales не вернул старый период
vs = r'C:\Users\user\Desktop\LIVARO\_разработка\views_sales.js'
t = open(vs, encoding='utf-8').read()
for a, b in R[:2]:
    t = t.replace(a, b)
open(vs, 'w', encoding='utf-8').write(t)
print('ok')
