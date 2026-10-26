"""Заменяет в app.js VIEWS.sales на версию с оплатой (views_sales.js)."""
p = r'C:\Users\user\Desktop\LIVARO\app\app.js'
s = open(p, encoding='utf-8').read()
new = open(r'C:\Users\user\Desktop\LIVARO\_разработка\views_sales.js', encoding='utf-8').read()
a = s.index('VIEWS.sales = () => {')
b = s.index('function groupsTable(o) {')
s = s[:a] + new + s[b:]
open(p, 'w', encoding='utf-8').write(s)
print('ok')
