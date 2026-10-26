"""Упаковка: «дверный» — не дверь; из текста этикетки убираем «( Коробка № 1 и № 2 )»."""
R = [
    ("if (/рамк|зеркал|стекл|двер|фасад/.test(s)) return { mode: 'per', n: 2, fragile: true };",
     "if (/рамк|зеркал|стекл|двер(?!н)|фасад/.test(s)) return { mode: 'per', n: 2, fragile: true }; // «дверный шкаф» — не дверь"),
    ("const ceil = (a, b) => Math.ceil(a / Math.max(1, b));",
     "const ceil = (a, b) => Math.ceil(a / Math.max(1, b));\nconst labelName = n => n.replace(/\\(\\s*коробк[аи][^)]*\\)/i, '').replace(/\\s+/g, ' ').trim(); // номер коробки и так пишется ниже"),
    ("places.push({ g: g.t, text: it.n + ' — ' + n + ' шт',", "places.push({ g: g.t, text: labelName(it.n) + ' — ' + n + ' шт',"),
    ("else for (let b = 1; b <= c; b++) places.push({ g: g.t, text: it.n,", "else for (let b = 1; b <= c; b++) places.push({ g: g.t, text: labelName(it.n),"),
]
for p in (r'C:\Users\user\Desktop\LIVARO\app\app.js', r'C:\Users\user\Desktop\LIVARO\_разработка\pack.js'):
    s = open(p, encoding='utf-8').read()
    for a, b in R:
        if b in s:
            continue
        if a not in s:
            print('НЕ НАЙДЕНО в', p.split('\\')[-1], ':', a[:60])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)
print('ok')
