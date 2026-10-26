"""Порядок цветов всегда (24.10.2026): списки товаров показываются с цветами внутри модели по COLORS."""
R = [
    ("""function itemsDeep(node) {
  const out = node.it.map((it, i) => [node, i]);""",
     """/* порядок показа товаров папки: модели — как лежат, внутри модели цвета по порядку COLORS (индексы — настоящие) */
function orderIdx(node) {
  const first = {}, base = node.it.map(it => baseName(it[0]));
  base.forEach((b, i) => { if (first[b] === undefined) first[b] = i; });
  return node.it.map((it, i) => i).sort((a, b) => first[base[a]] - first[base[b]] || colorRank(node.it[a][0]) - colorRank(node.it[b][0]) || a - b);
}
function itemsDeep(node) {
  const out = orderIdx(node).map(i => [node, i]);"""),
    ("else if (n) rows = deepOn() ? itemsDeep(n) : n.it.map((it, i) => [n, i]);",
     "else if (n) rows = deepOn() ? itemsDeep(n) : orderIdx(n).map(i => [n, i]);"),
]
R_app = [("if (n) (deepOn() ? itemsDeep(n) : n.it.map((x, i) => [n, i])).forEach(([nd, i]) => {",
          "if (n) (deepOn() ? itemsDeep(n) : orderIdx(n).map(i => [n, i])).forEach(([nd, i]) => {")]
for p, rules in ((r'C:\Users\user\Desktop\LIVARO\app\app.js', R + R_app), (r'C:\Users\user\Desktop\LIVARO\_разработка\views_catalog.js', R)):
    s = open(p, encoding='utf-8').read()
    for a, b in rules:
        if a not in s:
            print('НЕ НАЙДЕНО в', p.split('\\')[-1], ':', a.strip()[:70])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)
print('ok')
