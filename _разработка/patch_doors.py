"""Двери по 2 в коробке, зеркала по 1; нечётная дверь — в последнюю коробку или отдельно (24.10.2026)."""
R = [
    ("  if (/рамк|зеркал|стекл|двер(?!н)|фасад/.test(s)) return { mode: 'per', n: 2, fragile: true }; // «дверный шкаф» — не дверь",
     "  if (/зеркал/.test(s)) return { mode: 'per', n: 1, fragile: true }; // зеркало — всегда по одному\n"
     "  if (/рамк|стекл|двер(?!н)|фасад/.test(s)) return { mode: 'per', n: 2, fragile: true }; // двери по 2; «дверный шкаф» — не дверь"),
    ("const ceil = (a, b) => Math.ceil(a / Math.max(1, b));",
     "const ceil = (a, b) => Math.ceil(a / Math.max(1, b));\n"
     "/* нечётный остаток: 'join' — докладываем в последнюю коробку (3 двери = 1 коробка), 'split' — отдельной коробкой */\n"
     "const oddMode = () => (DB.settings && DB.settings.oddDoor) || 'join';\n"
     "const perBoxes = (q, n) => n > 1 && oddMode() === 'join' ? Math.max(1, Math.floor(q / n)) : ceil(q, n);"),
    ("const def = r.mode === 'box' ? it.q * (r.n || 1) : r.mode === 'per' ? ceil(it.q, r.n || 1) : 0,",
     "const def = r.mode === 'box' ? it.q * (r.n || 1) : r.mode === 'per' ? perBoxes(it.q, r.n || 1) : 0,"),
    ("    '<div class=\"btns\">' + seg(a4 ? 'a4' : 'thermal', 'lbl-fmt',",
     "    '<div class=\"btns\">' + seg(oddMode(), 'lbl-odd', [['join', 'Лишняя дверь — в последнюю коробку'], ['split', 'Лишняя дверь — отдельно']]) + seg(a4 ? 'a4' : 'thermal', 'lbl-fmt',"),
    ("  'lbl-fmt': el =>",
     "  'lbl-odd': el => { DB.settings = Object.assign({}, DB.settings, { oddDoor: el.dataset.v }); if (UI.lbl) UI.lbl.adj = {}; commit(); },\n  'lbl-fmt': el =>"),
]
for p in (r'C:\Users\user\Desktop\LIVARO\app\app.js', r'C:\Users\user\Desktop\LIVARO\_разработка\pack.js'):
    s = open(p, encoding='utf-8').read()
    for a, b in R:
        if b in s:
            continue
        if a not in s:
            print('НЕ НАЙДЕНО в', p.split('\\')[-1], ':', a.strip()[:70])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)
print('ok')
