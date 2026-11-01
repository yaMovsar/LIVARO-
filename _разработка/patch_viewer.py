# роль «Управляющий» (viewer): видит только остатки склада — сервер отдаёт ему названия и количества без цен, клиентов и денег,
# правки от него не принимает
import io


def patch(p, pairs):
    s = io.open(p, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, s.count(a), a[:80])
        s = s.replace(a, b)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)


ROLE_OLD = "storekeeper: 'Склад' };"
ROLE_NEW = "storekeeper: 'Склад', viewer: 'Управляющий (только остатки склада)' };"
patch('server/db.js', [(ROLE_OLD, ROLE_NEW)])
patch('server/admin.html', [(ROLE_OLD, ROLE_NEW)])

patch('server/index.js', [
    ("const MAX_BODY = 30 * 1024 * 1024;\n",
     "const MAX_BODY = 30 * 1024 * 1024;\n\n"
     "/* управляющий (роль viewer) видит только остатки: из записей убираем цены, клиентов, суммы и заметки;\n"
     "   клиенты, оплаты, шаблоны, удалённые и счётчики ему не отдаются вовсе */\n"
     "const VIEW_COLLS = ['orders', 'installments', 'stockMoves', 'meta'];\n"
     "function forViewer(d) {\n"
     "  if (!VIEW_COLLS.includes(d.coll) || (d.coll === 'meta' && d.id === 'counters')) return null;\n"
     "  if (d.data == null) return d;\n"
     "  const x = d.data, lines = g => ({ t: '', items: (g.items || []).map(it => ({ n: it.n, q: it.q })) });\n"
     "  let data;\n"
     "  if (d.coll === 'meta' && d.id === 'cat') { const strip = l => (l || []).map(n => ({ n: n.n, ch: strip(n.ch), it: (n.it || []).map(it => [it[0], null]) })); data = strip(x); }\n"
     "  else if (d.coll === 'meta') data = { itemAlias: x.itemAlias, stockMin: x.stockMin, stockMinF: x.stockMinF };\n"
     "  else if (d.coll === 'stockMoves') data = { id: x.id, name: x.name, q: x.q, kind: x.kind, date: x.date, createdAt: x.createdAt };\n"
     "  else if (d.coll === 'orders') data = { id: x.id, no: x.no, status: x.status, date: x.date, shipDate: x.shipDate, shippedAt: x.shippedAt, createdAt: x.createdAt, groups: (x.groups || []).map(lines) };\n"
     "  else data = { id: x.id, date: x.date, createdAt: x.createdAt, groups: (x.groups || []).map(lines) };\n"
     "  return Object.assign({}, d, { data });\n"
     "}\n"
     "const viewDocs = (user, list) => user.role === 'viewer' ? list.map(forViewer).filter(Boolean) : list;\n"),
    ("    const B = await S.boot();\n    B.user = user;", "    const B = await S.boot();\n    B.docs = viewDocs(user, B.docs); B.user = user;"),
    ("    if (p === '/api/changes' && m === 'GET') return json(res, 200, await S.changes(Math.max(0, parseInt(url.searchParams.get('since'), 10) || 0)));\n"
     "    if (p === '/api/sync' && m === 'POST') { const b = await body(req); return json(res, 200, await S.sync(user, cleanChanges(b.changes))); }",
     "    if (p === '/api/changes' && m === 'GET') { const ch = await S.changes(Math.max(0, parseInt(url.searchParams.get('since'), 10) || 0)); ch.changes = viewDocs(user, ch.changes); return json(res, 200, ch); }\n"
     "    if (p === '/api/sync' && m === 'POST') {\n"
     "      if (user.role === 'viewer') return json(res, 403, { error: 'Только просмотр: изменять данные нельзя' });\n"
     "      const b = await body(req); return json(res, 200, await S.sync(user, cleanChanges(b.changes)));\n"
     "    }"),
])

patch('app/online.js', [
    ("storekeeper: 'склад' };", "storekeeper: 'склад', viewer: 'управляющий' };"),
    ("  function push() {\n", "  var viewer = (B.user || {}).role === 'viewer'; // управляющий только смотрит — ничего не отправляем\n  function push() {\n    if (viewer) { dirty = false; return Promise.resolve(); }\n"),
    ("  window.addEventListener('beforeunload', function (e) {\n", "  window.addEventListener('beforeunload', function (e) {\n    if (viewer) return;\n"),
])

# проверка сервера: управляющий
patch('server/test/server_test.js', [
    ("    // журнал\n",
     "    // управляющий: только остатки, без цен и клиентов, изменять нельзя\n"
     "    await post('/api/sync', { changes: [{ coll: 'clients', id: 'c9', data: { id: 'c9', name: 'Секретный Клиент', opening: 0, createdAt: 5 }, base: 0 },\n"
     "      { coll: 'orders', id: 'o9', data: { id: 'o9', no: 7, status: 'shipped', clientId: 'c9', total: 99000, date: '2026-11-01', shipDate: '2026-11-01', shippedAt: 6, createdAt: 6, groups: [{ t: 'Шкаф Секрет', items: [{ n: 'Товар', q: 2, p: 49500 }] }] }, base: 0 },\n"
     "      { coll: 'payments', id: 'p9', data: { id: 'p9', clientId: 'c9', amount: 99000, method: 'cash', status: 'received', createdAt: 7 }, base: 0 }] }, boss);\n"
     "    r = await post('/api/users', { login: 'upr', name: 'Управляющий', role: 'viewer', password: '654321' }, boss); check('руководитель добавляет управляющего', r.ok && (await r.json()).user.role === 'viewer');\n"
     "    const vc = await login('upr', '654321'); check('управляющий входит', !!vc);\n"
     "    d = await (await get('/LIVARO.html', vc)).text();\n"
     "    check('в программе управляющего нет клиентов, цен и сумм', d.includes('\"Товар\"') && !d.includes('Секретный') && !d.includes('49500') && !d.includes('99000') && !d.includes('Шкаф Секрет') && d.includes('\"role\":\"viewer\"'));\n"
     "    d = await (await get('/api/changes?since=0', vc)).json();\n"
     "    check('изменения для управляющего — только склад, заказы без денег', d.changes.every(c => ['orders', 'installments', 'stockMoves', 'meta'].includes(c.coll)) && d.changes.some(c => c.coll === 'orders' && c.data && c.data.groups[0].items[0].q === 2 && !('total' in c.data) && !('clientId' in c.data)), d.changes.map(c => c.coll).join(','));\n"
     "    r = await post('/api/sync', { changes: [{ coll: 'stockMoves', id: 's2', data: { id: 's2', name: 'Товар', q: 99, kind: 'in' }, base: 0 }] }, vc); check('управляющему изменять нельзя (403)', r.status === 403);\n"
     "    r = await get('/api/users', vc); check('управляющему список сотрудников закрыт', r.status === 403);\n\n"
     "    // журнал\n"),
])
print('ok')
