p = r'C:\Users\user\Desktop\Макет учёта мебели.html'
sd = r'C:\Users\user\AppData\Local\Temp\claude\c--Users-user-Desktop-APEX-VPN\1c5147b7-8f74-4a54-9a74-10559da22c6f\scratchpad'


def rd(n):
    return open(sd + '\\' + n, encoding='utf-8').read()


s = open(sd + r'\backup_v3.html', encoding='utf-8').read()
head = s[:s.index('<div class="tabs">')]
head = head.replace('</style>', rd('css.txt') + '</style>', 1)
kept = s[s.index('<!-- ============ КЛИЕНТЫ И БАЛАНС'):s.index('<!-- ============ СОБРАТЬ ШКАФ')]
reps = [
    ('>Отгрузки</a>', '>Продажи</a>'),
    ('<a class="nav">Товары и цены</a>', '<a class="nav" data-go="cat">Товары</a>'),
    ('>Новая отгрузка</button>', '>Новая продажа</button>'),
    ('аванс 321 280 ₽</span></td><td>22.10.2026 · 95 500 ₽', 'аванс 382 780 ₽</span></td><td>22.10.2026 · 34 000 ₽'),
    ('471 280 ₽', '532 780 ₽'),
]
for a, b in reps:
    print(kept.count(a))
    kept = kept.replace(a, b)
p3 = rd('part3.txt')
a = p3.index('var COL4=')
b = p3.index('var NODES=')
p3 = p3[:a] + 'function F(n,ch,it){return {n:n,ch:ch||[],it:it||[]};}\n' + rd('cat.js') + p3[b:]
kept = kept.replace('<title>', '<title>')
out = head + rd('part1.txt') + kept + rd('part2.txt') + p3
open(p, 'w', encoding='utf-8').write(out)
a = out.rindex('<script>') + 8
b = out.rindex('</script>')
open(sd + r'\chk.js', 'w', encoding='utf-8').write(out[a:b])
