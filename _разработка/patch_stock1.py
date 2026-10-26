"""Склад: списываем только отгрузки ПОСЛЕ постановки товара на учёт (первый приход/инвентаризация)."""
A = """  DB.stockMoves.forEach(x => { const s = get(x.name); s.tracked = true; if (x.kind === 'in') s.inQ += x.q; else s.adj += x.q; });
  DB.orders.forEach(o => {
    if (o.status !== 'shipped' && o.status !== 'ordered') return;
    o.groups.forEach(g => g.items.forEach(it => { const s = get(it.n); if (o.status === 'shipped') s.out += it.q; else s.res += it.q; }));
  });
  DB.installments.forEach(i => i.groups.forEach(g => g.items.forEach(it => { get(it.n).out += it.q; })));"""
B = """  DB.stockMoves.forEach(x => {
    const s = get(x.name); s.tracked = true; s.since = Math.min(s.since || Infinity, x.createdAt);
    if (x.kind === 'in') s.inQ += x.q; else s.adj += x.q;
  });
  // отгрузки до постановки товара на учёт не списываем — их уже нет на складе
  const after = (s, ts) => s.tracked && ts > s.since;
  DB.orders.forEach(o => {
    if (o.status !== 'shipped' && o.status !== 'ordered') return;
    o.groups.forEach(g => g.items.forEach(it => { const s = get(it.n); if (o.status === 'ordered') s.res += it.q; else if (after(s, o.shippedAt || o.createdAt)) s.out += it.q; }));
  });
  DB.installments.forEach(i => i.groups.forEach(g => g.items.forEach(it => { const s = get(it.n); if (after(s, i.createdAt)) s.out += it.q; })));"""
for p in (r'C:\Users\user\Desktop\LIVARO\app\app.js', r'C:\Users\user\Desktop\LIVARO\_разработка\stock.js'):
    s = open(p, encoding='utf-8').read()
    if B not in s:
        if A not in s:
            print('НЕ НАЙДЕНО в', p)
        s = s.replace(A, B)
    open(p, 'w', encoding='utf-8').write(s)
print('ok')
