"""Склад (stock.js), новые «Отчёты» (reports.js) и выбор периода на главной/в оплатах/в отчётах."""
P = r'C:\Users\user\Desktop\LIVARO\app\app.js'
D = r'C:\Users\user\Desktop\LIVARO\_разработка'
s = open(P, encoding='utf-8').read()
def rd(n):
    return open(D + '\\' + n, encoding='utf-8').read()

# склад — перед выбором периода
start, mark = '/* ================= СКЛАД', '/* ================= ВЫБОР ПЕРИОДА'
if start in s:
    s = s[:s.index(start)] + s[s.index(mark):]
s = s.replace(mark, rd('stock.js') + mark, 1)
# отчёты — заменить целиком
a, b = s.index('VIEWS.reports = () => {'), s.index('/* ================= ДАННЫЕ')
s = s[:a] + rd('reports.js') + s[b:]

R = [
    # выбор периода
    ("function rangeButton(r, act) {\n  return '<button class=\"btn\" data-act=\"' + act + '\" aria-haspopup=\"dialog\">'",
     "function rangeButton(r, act, k) {\n  return '<button class=\"btn\" data-act=\"' + act + '\"' + (k ? ' data-k=\"' + k + '\"' : '') + ' aria-haspopup=\"dialog\">'"),
    ("UI.salesRange = rangeOf('Месяц');",
     "UI.salesRange = rangeOf('Месяц'); UI.homeRange = rangeOf('Сегодня'); UI.payRange = rangeOf('Месяц'); UI.repRange = rangeOf('Месяц');"),
    ("const p = UI.period, orders = shipped().filter(o => inPeriod(o.shipDate, p));", "const p = UI.homeRange, orders = shipped().filter(o => inRange(o.shipDate, p));"),
    ("inPeriod(payDate(x), p)", "inRange(payDate(x), p)"),
    ("periodChips(p, 'period')", "rangeButton(p, 'range-open', 'homeRange')"),
    ("inPeriod(payDate(p), UI.payPeriod)", "inRange(payDate(p), UI.payRange)"),
    ("periodChips(UI.payPeriod, 'pay-period')", "rangeButton(UI.payRange, 'range-open', 'payRange')"),
    # склад: меню, данные, страница заказа
    ("['inst', 'Рассрочка', instLate()], ['catalog', 'Товары'],", "['inst', 'Рассрочка', instLate()], ['catalog', 'Товары'], ['stock', 'Склад'],"),
    ("  data: '<ellipse", "  stock: '<path d=\"M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z\"/><path d=\"M6 18h12\"/><path d=\"M6 14h12\"/><rect width=\"12\" height=\"12\" x=\"6\" y=\"10\"/>',\n  data: '<ellipse"),
    ("templates: [], trash: [], installments: [], instNo: 1,", "templates: [], trash: [], installments: [], instNo: 1, stockMoves: [],"),
    ("    if (!DB.installments) { DB.installments = []; DB.instNo = 1; }", "    if (!DB.installments) { DB.installments = []; DB.instNo = 1; }\n    if (!DB.stockMoves) DB.stockMoves = [];"),
    ("'<div class=\"aside\"><div class=\"card\"><h2>Расчёты</h2>' + calc +", "'<div class=\"aside\">' + stockCard(o) + '<div class=\"card\"><h2>Расчёты</h2>' + calc +"),
]
for x, y in R:
    if y in s:
        continue
    if x not in s:
        print('НЕ НАЙДЕНО:', x[:70])
    s = s.replace(x, y)
open(P, 'w', encoding='utf-8').write(s)
# исходник выбора периода держим в том же виде
rp = D + r'\range.js'
t = open(rp, encoding='utf-8').read()
for x, y in R[:2]:
    t = t.replace(x, y)
open(rp, 'w', encoding='utf-8').write(t)
print('ok')
