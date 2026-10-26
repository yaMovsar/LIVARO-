"""Встраивает инвентаризацию списком (inv.js)."""
P = r'C:\Users\user\Desktop\LIVARO\app\app.js'
s = open(P, encoding='utf-8').read()
inv = open(r'C:\Users\user\Desktop\LIVARO\_разработка\inv.js', encoding='utf-8').read()
start, mark = '/* ================= ИНВЕНТАРИЗАЦИЯ СПИСКОМ', '/* ================= ВЫБОР ПЕРИОДА'
if start in s:
    s = s[:s.index(start)] + s[s.index(mark):]
s = s.replace(mark, inv + mark, 1)
R = [("labels: 'sales', ins: 'inst'", "labels: 'sales', inv: 'stock', invprint: 'stock', ins: 'inst'"),
     ("""    '<div class="btns"><button class="btn" data-act="sk-open" data-kind="adj">Инвентаризация</button><button class="btn pri" data-act="sk-open" data-kind="in">+ Приход</button></div></div>' +""",
      """    '<div class="btns"><a class="btn" href="#/inv">Инвентаризация списком</a><button class="btn" data-act="sk-open" data-kind="adj">Пересчитать один товар</button><button class="btn pri" data-act="sk-open" data-kind="in">+ Приход</button></div></div>' +""")]
for x, y in R:
    if y in s:
        continue
    if x not in s:
        print('НЕ НАЙДЕНО:', x[:60])
    s = s.replace(x, y)
open(P, 'w', encoding='utf-8').write(s)
st = r'C:\Users\user\Desktop\LIVARO\_разработка\stock.js'
t = open(st, encoding='utf-8').read().replace(R[1][0], R[1][1])
open(st, 'w', encoding='utf-8').write(t)
print('ok')
