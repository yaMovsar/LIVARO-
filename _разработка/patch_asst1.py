"""Помощник: антресоль считаем по сумме секций (2 × «2-х» = 4 двери)."""
R = [("""      const an = doorsFromName(ant.n);
      if (antDoors < (an || N)) {
        const k = (an || N) - antDoors,""",
      """      const an = items.filter(isAntresol).reduce((s, it) => s + doorsFromName(it.n) * it.q, 0); // 2 антресоли «2-х» = на 4 двери
      if (antDoors < (an || N)) {
        const k = (an || N) - antDoors,"""),
     ("""      if (an && an !== N && !(N === 3 || N === 5)) add('ant-n', 'Антресоль ' + an + '-х, а шкаф ' + N + '-дверный. Проверьте размер.', [], true);""",
      """      if (an && an !== N && !(N === 3 || N === 5)) add('ant-n', 'Антресоли на ' + an + ' дв., а шкаф ' + N + '-дверный. Проверьте размер.', [], true);""")]
for p in (r'C:\Users\user\Desktop\LIVARO\app\app.js', r'C:\Users\user\Desktop\LIVARO\_разработка\assistant.js'):
    s = open(p, encoding='utf-8').read()
    for a, b in R:
        if b in s:
            continue
        if a not in s:
            print('НЕ НАЙДЕНО в', p.split('\\')[-1], ':', a.strip()[:50])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)
print('ok')
