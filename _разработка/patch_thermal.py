"""Этикетки под термопринтер 112 × 75 мм (по умолчанию) + запасной формат А4 по 8."""
R = [
    ("""  let sheets = '';
  for (let s = 0; s < N; s += 8) {
    let cells = P.places.slice(s, s + 8).map((p, j) => lab(p, s + j)).join('');
    for (let e = Math.min(8, N - s); e < 8; e++) cells += '<div class="lab lempty"></div>';
    sheets += '<div class="lsheet">' + cells + '</div>';
  }""",
     """  const a4 = (DB.settings && DB.settings.labelFmt) === 'a4';
  let sheets = '';
  if (a4) for (let s = 0; s < N; s += 8) { // лист А4 на 8 наклеек
    let cells = P.places.slice(s, s + 8).map((p, j) => lab(p, s + j)).join('');
    for (let e = Math.min(8, N - s); e < 8; e++) cells += '<div class="lab lempty"></div>';
    sheets += '<div class="lsheet">' + cells + '</div>';
  }
  else sheets = '<style>@media print{@page{size:112mm 75mm;margin:0}}</style>' + // термопринтер: одна наклейка 112×75 мм = одна страница
    '<div class="tlabs">' + P.places.map((p, i) => lab(p, i).replace('class="lab"', 'class="lab tlab"')).join('') + '</div>';"""),
    ("""    '<div class="btns"><a class="btn" href="#/sale/' + o.id + '">← К заказу</a><button class="btn pri big" data-act="print">Распечатать</button></div></div>' +""",
     """    '<div class="btns">' + seg(a4 ? 'a4' : 'thermal', 'lbl-fmt', [['thermal', 'Термопринтер 11,2 × 7,5 см'], ['a4', 'А4, 8 на листе']]) +
    '<a class="btn" href="#/sale/' + o.id + '">← К заказу</a><button class="btn pri big" data-act="print">Распечатать</button></div></div>' +
    (a4 ? '' : '<div class="hint" style="margin-bottom:14px">При печати выберите термопринтер, размер бумаги 112 × 75 мм (или 11,2 × 7,5 см), поля — «нет», масштаб — 100%. Каждая этикетка печатается на отдельной наклейке.</div>') +"""),
    ("""  'pack-folder': () =>""", """  'lbl-fmt': el => { DB.settings = Object.assign({}, DB.settings, { labelFmt: el.dataset.v }); commit(); },
  'pack-folder': () =>"""),
]
for p in (r'C:\Users\user\Desktop\LIVARO\app\app.js', r'C:\Users\user\Desktop\LIVARO\_разработка\pack.js'):
    s = open(p, encoding='utf-8').read()
    for a, b in R:
        if b in s:
            continue
        if a not in s:
            print('НЕ НАЙДЕНО в', p.split('\\')[-1], ':', a.strip()[:60])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)
print('ok')
