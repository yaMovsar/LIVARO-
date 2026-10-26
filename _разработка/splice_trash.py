"""Заменяет блок «УДАЛЁННЫЕ» в app.js (и в views_sales.js, чтобы splice_sales не вернул старый) на views_trash.js."""
new = open(r'C:\Users\user\Desktop\LIVARO\_разработка\views_trash.js', encoding='utf-8').read()
for p, end in ((r'C:\Users\user\Desktop\LIVARO\app\app.js', 'function groupsTable(o) {'),
               (r'C:\Users\user\Desktop\LIVARO\_разработка\views_sales.js', None)):
    s = open(p, encoding='utf-8').read()
    a = s.index('/* ================= УДАЛЁННЫЕ')
    b = s.index(end) if end else len(s)
    s = s[:a] + new + s[b:]
    open(p, 'w', encoding='utf-8').write(s)
print('ok')
