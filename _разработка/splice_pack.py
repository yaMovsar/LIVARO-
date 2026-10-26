"""Встраивает pack.js (упаковка и этикетки) и связанные правки в app.js и views_catalog.js."""
APP = r'C:\Users\user\Desktop\LIVARO\app\app.js'
VC = r'C:\Users\user\Desktop\LIVARO\_разработка\views_catalog.js'
s = open(APP, encoding='utf-8').read()
pack = open(r'C:\Users\user\Desktop\LIVARO\_разработка\pack.js', encoding='utf-8').read()
start, mark = '/* ================= УПАКОВКА И ЭТИКЕТКИ', '/* ================= ВЫБОР ПЕРИОДА'
if start in s:
    s = s[:s.index(start)] + s[s.index(mark):]
s = s.replace(mark, pack + mark, 1)

common = [
    # меню ⋮ в «Товарах»
    ("""      '<div class="msep"></div><button role="menuitem" data-act="f-ren"'""",
     """      '<div class="msep"></div><button role="menuitem" data-act="pack-folder"' + (n ? '' : ' disabled') + '>Упаковка папки (коробки, хрупкое)…</button>' +
      '<button role="menuitem" data-act="f-ren"'"""),
    # подпись под заголовком списка — правило упаковки папки
    ("""    (checked ? '<div class="warn" style="background:var(--accent-bg)""",
     """    (n && !q ? '<div class="hint" style="margin:-8px 0 12px">Упаковка: ' + (folderPack(n) ? packText(folderPack(n)) : 'по названию товара') + ' · <button class="btn sm" style="border:0;color:var(--accent);padding:0;min-height:0" data-act="pack-folder">изменить</button></div>' : '') +
    (checked ? '<div class="warn" style="background:var(--accent-bg)"""),
    # окно товара — кнопка «Упаковка»
    ("""    '<div class="btns" style="justify-content:space-between"><button class="btn danger" data-act="citem-del" data-k="' + k + '">Удалить</button>' +""",
     """    '<div class="line"><span class="muted">Упаковка: ' + packText(packRule(it[0])) + '</span><button class="btn sm" data-act="pack-item" data-k="' + k + '">Изменить упаковку</button></div>' +
    '<div class="btns" style="justify-content:space-between"><button class="btn danger" data-act="citem-del" data-k="' + k + '">Удалить</button>' +"""),
]
app_only = [
    ("""'">Печать: заказ клиенту</a>' + waBtn(o) +""", """'">Печать: заказ клиенту</a>' + waBtn(o) + '<a class="btn" href="#/labels/' + o.id + '">Этикетки на коробки</a>' +"""),
    ("""'">Печать: грузчику</a>' + waBtn(o) + payBtn +""", """'">Печать: грузчику</a>' + '<a class="btn" href="#/labels/' + o.id + '">Этикетки на коробки</a>' + waBtn(o) + payBtn +"""),
    ("print: 'sales', ins: 'inst'", "print: 'sales', labels: 'sales', ins: 'inst'"),
    ("""<div>Шкафов: <b style="font-size:16px">' + o.groups.length + '</b></div>""",
     """<div>Шкафов: <b style="font-size:16px">' + o.groups.length + '</b> · Мест: <b style="font-size:16px">' + buildPlaces(o).places.length + '</b></div>"""),
]
for path, rules in ((APP, common + app_only), (VC, common)):
    t = s if path == APP else open(path, encoding='utf-8').read()
    for a, b in rules:
        if b in t:
            continue
        if a not in t:
            print('НЕ НАЙДЕНО в', path.split('\\')[-1], ':', a.strip()[:70])
        t = t.replace(a, b, 1)
    if path == APP:
        s = t
    open(path, 'w', encoding='utf-8').write(t)
print('ok')
