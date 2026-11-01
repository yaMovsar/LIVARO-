# склад карточками (stock_cards.js) + наличие в каталоге заказа, корзине и «Товарах» + режим управляющего (роль viewer)
import io
p = 'app/app.js'; s = io.open(p, encoding='utf-8').read()


def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:90])
    s = s.replace(a, b)


a = s.index('VIEWS.stock = () => {'); b = s.index('/* окно прихода / инвентаризации: выбор товара поиском */')
s = s[:a] + io.open('_разработка/stock_cards.js', encoding='utf-8').read() + s[b:]
rep("  'st-f': el => { UI.stF = el.dataset.v; render(); },\n  'sk-save'", "  'sk-save'")

# каталог при наборе заказа: метка наличия у товара
rep("function catalogPicker() {\n  let list = '', head = '';", "function catalogPicker() {\n  let list = '', head = '';\n  const SX = stockIndex(), sb = nm => stockBadge(SX[nm]);")
rep("'</div></span><span class=\"pr\">' + priceHtml(it[1]) + '</span></div>'; }", "'</div></span><span class=\"pr\">' + sb(it[0]) + priceHtml(it[1]) + '</span></div>'; }")
rep("'</div>' : '') + '</span><span class=\"pr\">' + priceHtml(it[1]) + '</span></div>';", "'</div>' : '') + '</span><span class=\"pr\">' + sb(it[0]) + priceHtml(it[1]) + '</span></div>';")

# корзина: не хватает на складе (при изменении заказа его собственный резерв не считаем)
rep("function cartHtml() {\n  const C = DB.cart;", "function cartHtml() {\n  const C = DB.cart, SX = stockIndex(), need = {}, mine = {}, ed = C.editId ? order(C.editId) : null;\n"
    "  C.groups.forEach(G => G.items.forEach(it => { const n = itemName(it.n); need[n] = (need[n] || 0) + it.q; }));\n"
    "  if (ed && ed.status === 'ordered') ed.groups.forEach(G => G.items.forEach(it => { const n = itemName(it.n); mine[n] = (mine[n] || 0) + it.q; }));\n"
    "  const short = nm => { const n = itemName(nm), c = SX[n]; if (!c || !c.tracked) return ''; const free = c.free + (mine[n] || 0);\n"
    "    return need[n] > free ? '<div class=\"cshort\">на складе свободно ' + Math.max(0, free) + ' шт — не хватает ' + (need[n] - Math.max(0, free)) + '</div>' : ''; };")
rep("<span>' + esc(it.n) + '</span></div></td>' +", "<span>' + esc(it.n) + '</span></div>' + short(it.n) + '</td>' +")

# «Товары»: колонка «На складе»
rep("  const folders = allFolders(DB.cat);\n  UI.catRows", "  const folders = allFolders(DB.cat), SX = stockIndex();\n  UI.catRows")
rep("'<td class=\"num\" style=\"width:130px\"><input class=\"inp pin\" style=\"width:110px\" data-ch=\"cprice\"",
    "'<td class=\"num\" style=\"width:90px\">' + (SX[it[0]] && SX[it[0]].tracked ? '<b class=\"stq ' + SX[it[0]].st + '\">' + SX[it[0]].have + '</b>' : '<span class=\"muted\">—</span>') + '</td>' +\n      '<td class=\"num\" style=\"width:130px\"><input class=\"inp pin\" style=\"width:110px\" data-ch=\"cprice\"")
rep("<th>Наименование</th><th class=\"num\">Цена, ₽</th><th></th></tr></thead>", "<th>Наименование</th><th class=\"num\">На складе</th><th class=\"num\">Цена, ₽</th><th></th></tr></thead>")

# режим управляющего: только склад, меню из одного пункта
rep("  const r = route(), view = VIEWS[r.name] || VIEWS.home;", "  const r = route(), view = isViewer() ? VIEWS.stock : VIEWS[r.name] || VIEWS.home;")
rep("function sideHtml(name) {\n", "function sideHtml(name) {\n  if (isViewer()) return '<div class=\"logo\"><b>LIVARO</b><span>Склад · только просмотр</span></div><a class=\"nav on\" href=\"#/stock\" aria-current=\"page\"><span>' + icon('stock') + 'Склад</span></a>';\n")
io.open(p, 'w', encoding='utf-8', newline='').write(s)

c = 'app/styles.css'; t = io.open(c, encoding='utf-8').read()
t += io.open('_разработка/stock_cards.css', encoding='utf-8').read()
io.open(c, 'w', encoding='utf-8', newline='').write(t)
print('ok')
