"""Заменяет в app.js блок от VIEWS.checkout до раздела ПЕЧАТЬ на views_orders.js."""
p = r'C:\Users\user\Desktop\LIVARO\app\app.js'
s = open(p, encoding='utf-8').read()
new = open(r'C:\Users\user\Desktop\LIVARO\_разработка\views_orders.js', encoding='utf-8').read()
a = s.index('VIEWS.checkout = () => {')
b = s.index('/* ================= ПЕЧАТЬ ================= */') + len('/* ================= ПЕЧАТЬ ================= */\n')
s = s[:a] + new + s[b:]
open(p, 'w', encoding='utf-8').write(s)
print('ok')
