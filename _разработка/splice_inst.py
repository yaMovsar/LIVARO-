"""Встраивает inst.js (рассрочка) в app.js и правит связанные места."""
p = r'C:\Users\user\Desktop\LIVARO\app\app.js'
s = open(p, encoding='utf-8').read()
inst = open(r'C:\Users\user\Desktop\LIVARO\_разработка\inst.js', encoding='utf-8').read()
start, mark = '/* ================= РАССРОЧКА', '/* ================= ВЫБОР ПЕРИОДА'
if start in s:
    s = s[:s.index(start)] + s[s.index(mark):]
s = s.replace(mark, inst + mark, 1)

R = [
    # меню
    ("['sales', 'Продажи', waitingOrders().length], ['catalog', 'Товары'],",
     "['sales', 'Продажи', waitingOrders().length], ['inst', 'Рассрочка', instLate()], ['catalog', 'Товары'],"),
    ("const active = { sale: 'sales', checkout: 'order', client: 'clients', opening: 'clients', print: 'sales' }[name] || name;",
     "const active = { sale: 'sales', checkout: 'order', client: 'clients', opening: 'clients', print: 'sales', ins: 'inst', instnew: 'order', iprint: 'inst' }[name] || name;"),
    ("  trash: '<path d=\"M3 6h18\"/>",
     "  inst: '<path d=\"M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5\"/><path d=\"M16 2v4\"/><path d=\"M8 2v4\"/><path d=\"M3 10h5\"/><path d=\"M17.5 17.5 16 16.3V14\"/><circle cx=\"16\" cy=\"16\" r=\"6\"/>',\n  trash: '<path d=\"M3 6h18\"/>"),
    # данные
    ("templates: [], trash: [],", "templates: [], trash: [], installments: [], instNo: 1,"),
    ("    if (!DB.trash) DB.trash = [];", "    if (!DB.trash) DB.trash = [];\n    if (!DB.installments) { DB.installments = []; DB.instNo = 1; }"),
    # корзина
    ("    '<button class=\"btn pri big\" data-act=\"to-checkout\"' + (cc ? '' : ' disabled') + '>Оформить заказ →</button></div></div>' +",
     "    '<button class=\"btn big\" data-act=\"to-inst\"' + (cc && !DB.cart.editId ? '' : ' disabled') + ' title=\"Розничному покупателю в рассрочку\">В рассрочку →</button>' +\n    '<button class=\"btn pri big\" data-act=\"to-checkout\"' + (cc ? '' : ' disabled') + '>Оформить заказ →</button></div></div>' +"),
    # удалённые
    ("['folder', 'Папки'], ['template', 'Шаблоны']];", "['folder', 'Папки'], ['template', 'Шаблоны'], ['inst', 'Рассрочки']];"),
    ("    else if (k === 'template') DB.templates.push(t.data);", "    else if (k === 'template') DB.templates.push(t.data);\n    else if (k === 'inst') DB.installments.push(t.data);"),
    ("  return ['Шаблон «' + esc(t.data.t) + '»', t.data.items.length + ' поз.', rub(gsum(t.data))];",
     "  if (k === 'inst') return [t.label, esc(t.data.buyer.name), rub(t.data.total)];\n  return ['Шаблон «' + esc(t.data.t) + '»', t.data.items.length + ' поз.', rub(gsum(t.data))];"),
]
for a, b in R:
    if b in s:
        continue
    if a not in s:
        print('НЕ НАЙДЕНО:', a[:70])
    s = s.replace(a, b, 1)
open(p, 'w', encoding='utf-8').write(s)
print('ok')
