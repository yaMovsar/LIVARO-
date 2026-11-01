# исправления по проверке 27.10.2026: копейки и минус в суммах, переименование товара (склад, шаблоны, корзина, заказы),
# удаление оплаты товаром убирает её приход со склада
import io
p = 'app/app.js'; s = io.open(p, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:80])
    s = s.replace(a, b)

# 1. числа: «12 500,50» → 12 501 (копейки округляются, а не приклеиваются к рублям); «12.500» — по-прежнему 12 500
rep("const num = v => parseInt(String(v == null ? '' : v).replace(/[^\d]/g, ''), 10) || 0;",
    "/* целое число из ввода: пробелы и «₽» пропускаем; «12 500,50» → 12 501 (1–2 цифры после запятой/точки — копейки, округляем); «12.500» → 12 500 */\n"
    "const num = v => { const t = String(v == null ? '' : v).replace(/[^\d.,]/g, ''), m = t.match(/^(.*?)[.,](\d{1,2})$/);\n"
    "  return Math.round(m ? +(m[1].replace(/\D/g, '') || 0) + +('0.' + m[2]) : parseInt(t.replace(/\D/g, ''), 10) || 0); };\n"
    "/* минус в денежном поле: не переворачиваем знак молча, а останавливаем ввод */\n"
    "const minus = v => /^\s*[-−–]/.test(String(v == null ? '' : v));\n"
    "const MINUS_MSG = 'Сумма не может быть с минусом. Введите сумму без знака «−».';")

# 2. минус в суммах оплат
rep("    const amt = num($('#p-amount').value); if (!amt) return toast('Введите сумму');",
    "    if (minus($('#p-amount').value)) return toast(MINUS_MSG);\n    const amt = num($('#p-amount').value); if (!amt) return toast('Введите сумму');")
rep("  'bulk-save': () => {\n    readBulk();\n", "  'bulk-save': () => {\n    readBulk(); if (minus(UI.bulk.amount)) return toast(MINUS_MSG);\n")
rep("  'ship-do': () => {\n    readShip();\n", "  'ship-do': () => {\n    readShip(); if (UI.ship.pay !== 'none' && minus(UI.ship.amount)) return toast(MINUS_MSG);\n")
rep("    const amt = ck.pay === 'none' ? 0 : num(ck.amount);", "    if (ck.pay !== 'none' && minus(ck.amount)) return toast(MINUS_MSG);\n    const amt = ck.pay === 'none' ? 0 : num(ck.amount);")
rep("const s = DB.installments.find(x => x.id === el.dataset.id), amt = num($('#ip-amount').value);",
    "if (minus($('#ip-amount').value)) return toast(MINUS_MSG);\n    const s = DB.installments.find(x => x.id === el.dataset.id), amt = num($('#ip-amount').value);")

# 3. переименование товара — во всех трёх местах через renameItem
rep("    it[0] = name; it[1] = pv === '' ? null : num(pv);", "    if (!renameItem(nd, i, name)) return; it[1] = pv === '' ? null : num(pv);")
rep("  cname: el => { const [nd, i] = itemByKey(el.dataset.k); nd.it[i][0] = el.value.trim(); save(); },",
    "  cname: el => { const [nd, i] = itemByKey(el.dataset.k); if (renameItem(nd, i, el.value.trim())) save(); else el.value = nd.it[i][0]; },")
rep("if (ok && inp.value.trim()) nd.it[i][0] = inp.value.trim(); commit(); };", "if (ok && inp.value.trim()) renameItem(nd, i, inp.value.trim()); commit(); };")
rep("function itemByKey(k) {",
    "/* переименование товара: склад, шаблоны, корзина и неотгруженные заказы переходят на новое название.\n"
    "   Отгруженные накладные и рассрочки — история, их не трогаем; склад сопоставляет их через settings.itemAlias (старое → новое). */\n"
    "function renameItem(nd, i, name) {\n"
    "  const old = nd.it[i][0]; if (!name || name === old) return true;\n"
    "  if (findItem(name) && !confirm('Товар «' + name + '» уже есть в каталоге. Остатки и история этих двух товаров объединятся. Продолжить?')) return false;\n"
    "  nd.it[i][0] = name;\n"
    "  const al = Object.assign({}, (DB.settings || {}).itemAlias);\n"
    "  delete al[name]; for (const k in al) if (al[k] === old) al[k] = name; al[old] = name;\n"
    "  DB.settings = Object.assign({}, DB.settings, { itemAlias: al });\n"
    "  const fix = it => { if (it.n === old) it.n = name; };\n"
    "  DB.stockMoves.forEach(m => { if (m.name === old) m.name = name; });\n"
    "  DB.templates.forEach(t => (t.items || []).forEach(fix));\n"
    "  DB.cart.groups.forEach(g => g.items.forEach(fix));\n"
    "  DB.orders.forEach(o => { if (o.status === 'ordered') o.groups.forEach(g => g.items.forEach(fix)); });\n"
    "  return true;\n"
    "}\n"
    "/* актуальное название товара (после переименований) — для склада */\n"
    "const itemName = n => ((DB.settings || {}).itemAlias || {})[n] || n;\n"
    "function itemByKey(k) {")

# склад: отгрузки и рассрочки под старым названием считаются по новому
rep("o.groups.forEach(g => g.items.forEach(it => { const s = get(it.n);", "o.groups.forEach(g => g.items.forEach(it => { const s = get(itemName(it.n));")
rep("DB.installments.forEach(i => i.groups.forEach(g => g.items.forEach(it => { const s = get(it.n);", "DB.installments.forEach(i => i.groups.forEach(g => g.items.forEach(it => { const s = get(itemName(it.n));")
rep("o.groups.forEach(g => g.items.forEach(it => { need[it.n] = (need[it.n] || 0) + it.q; }));", "o.groups.forEach(g => g.items.forEach(it => { const n = itemName(it.n); need[n] = (need[n] || 0) + it.q; }));")

# 4. оплата товаром ↔ приход на склад: связь через payId
rep("function stockInGoods(g, cid) {", "function stockInGoods(g, cid, payId) {")
rep("q: Math.round(g.qty), kind: 'in', note: 'взаимозачёт: ' + ((client(cid) || {}).name || ''), createdAt: Date.now() });",
    "q: Math.round(g.qty), kind: 'in', note: 'взаимозачёт: ' + ((client(cid) || {}).name || ''), payId, createdAt: Date.now() });")
rep("    if (g) stockInGoods(g, cid);", "    if (g) stockInGoods(g, cid, DB.payments[DB.payments.length - 1].id);")
rep("      if (B.method === 'goods' && B.g) stockInGoods(B.g, cid);", "      if (B.method === 'goods' && B.g) stockInGoods(B.g, cid, DB.payments[DB.payments.length - 1].id);")
rep("    DB.payments = DB.payments.filter(x => x !== p); const t = trashPush('payment', p, 'Оплата ' + rub(p.amount)); commit(); undoToast('Оплата удалена', [t]);",
    "    const moves = goodsMoves(p); DB.stockMoves = DB.stockMoves.filter(m => !moves.includes(m));\n"
    "    DB.payments = DB.payments.filter(x => x !== p); const t = trashPush('payment', p, 'Оплата ' + rub(p.amount), { moves }); commit();\n"
    "    undoToast('Оплата удалена' + (moves.length ? ', приход товара со склада убран' : ''), [t]);")
rep("    else if (k === 'payment') DB.payments.push(t.data);", "    else if (k === 'payment') { DB.payments.push(t.data); if (t.moves) DB.stockMoves.push(...t.moves); }")
rep("function stockInGoods(g, cid, payId) {",
    "/* приход на склад от оплаты товаром; у старых записей (до связи payId) — по названию, количеству и времени создания */\n"
    "function goodsMoves(p) {\n"
    "  const g = p.goods; if (!g || !g.stock) return [];\n"
    "  return DB.stockMoves.filter(m => m.payId ? m.payId === p.id : m.kind === 'in' && m.name === itemName(g.what) && m.q === Math.round(g.qty) && Math.abs(m.createdAt - p.createdAt) < 60000);\n"
    "}\n"
    "function stockInGoods(g, cid, payId) {")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
