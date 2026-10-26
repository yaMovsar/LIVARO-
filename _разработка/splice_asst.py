"""Встраивает помощника (assistant.js) в app.js."""
p = r'C:\Users\user\Desktop\LIVARO\app\app.js'
s = open(p, encoding='utf-8').read()
a = open(r'C:\Users\user\Desktop\LIVARO\_разработка\assistant.js', encoding='utf-8').read()
start, mark = '/* ================= ПОМОЩНИК', '/* ================= ВЫБОР ПЕРИОДА'
if start in s:
    s = s[:s.index(start)] + s[s.index(mark):]
s = s.replace(mark, a + mark, 1)
R = [("    return h + '</table></div>';", "    return h + '</table>' + asstHtml(G, g) + '</div>';"),
     ("""'<div class="hint" style="margin-bottom:12px">Синяя группа — текущая. Чтобы поменять порядок или перенести строку в другой шкаф, тяните её за значок ⠿ слева.</div>' +""",
      """'<div class="hint" style="margin-bottom:12px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>Синяя группа — текущая. Чтобы поменять порядок или перенести строку в другой шкаф, тяните её за значок ⠿ слева.</span>' +
    '<button class="btn sm" data-act="as-toggle" title="Подсказки по составу шкафа">✦ Помощник: ' + (asstOn() ? 'вкл' : 'выкл') + '</button></div>' +""")]
for x, y in R:
    if y in s:
        continue
    if x not in s:
        print('НЕ НАЙДЕНО:', x.strip()[:60])
    s = s.replace(x, y, 1)
open(p, 'w', encoding='utf-8').write(s)
print('ok')
