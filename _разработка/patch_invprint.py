"""Бланк инвентаризации — только по выбранной папке (24.10.2026)."""
R = [
    ("""  let rows = '', no = 0;
  allFolders(DB.cat).forEach(({ n }) => {
    if (!n.it.length) return;""",
     """  let rows = '', no = 0;
  const f = UI.invF || '', fn = f && NODES[f] ? folderPath(NODES[f]) : '';
  allFolders(DB.cat).forEach(({ n }) => {
    if (!n.it.length || (f && !(n.id === f || n.id.indexOf(f + '-') === 0))) return; // только выбранная папка и её подпапки"""),
    ("""'<b>Инвентаризация склада</b> от ____________</div></div>' +""",
     """'<b>Инвентаризация склада</b> от ____________' + (fn ? '<div style="font-size:13px;margin-top:2px">Папка: ' + esc(fn) + '</div>' : '') + '</div></div>' +"""),
    ("""    '<a class="btn" href="#/invprint">Печать бланка</a>""",
     """    '<a class="btn" href="#/invprint">Печать бланка' + (UI.invF && NODES[UI.invF] ? ': ' + esc(NODES[UI.invF].n) : ' (все)') + '</a>"""),
]
for p in (r'C:\Users\user\Desktop\LIVARO\app\app.js', r'C:\Users\user\Desktop\LIVARO\_разработка\inv.js'):
    s = open(p, encoding='utf-8').read()
    for a, b in R:
        if b in s:
            continue
        if a not in s:
            print('НЕ НАЙДЕНО в', p.split('\\')[-1], ':', a.strip()[:50])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)
print('ok')
