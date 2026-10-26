"""Заменяет в app.js VIEWS.catalog на views_catalog.js."""
p = r'C:\Users\user\Desktop\LIVARO\app\app.js'
s = open(p, encoding='utf-8').read()
new = open(r'C:\Users\user\Desktop\LIVARO\_разработка\views_catalog.js', encoding='utf-8').read()
a = s.index('VIEWS.catalog = () => {')
b = s.index('/* ================= КЛИЕНТЫ ================= */')
s = s[:a] + new + s[b:]
open(p, 'w', encoding='utf-8').write(s)
print('ok')
