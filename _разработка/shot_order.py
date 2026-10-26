"""Снимок корзины (Оформить заказ) с настоящим каталогом из 1С — проверка вида."""
import json
import subprocess
import sys
import time

ROOT = r'C:\Users\user\Desktop\LIVARO'
OUT = sys.argv[1] if len(sys.argv) > 1 else ROOT + r'\_разработка'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
cat_js = open(ROOT + r'\app\catalog-1c.js', encoding='utf-8-sig').read()
cat = json.loads(cat_js.split('=', 1)[1].strip().rstrip(';'))
cat[0]['open'] = True
items = [{'n': 'Корпус 4-х Милан белый 220х180х52 ( Коробка № 1 и № 2 )', 'q': 1, 'p': 24000}, {'n': 'дверь АЙША на корпус МИЛАН 220 БЕЛЫЙ С - образ', 'q': 4, 'p': 0},
         {'n': 'Антресоль 2х БЕЛЫЙ', 'q': 2, 'p': 4000}, {'n': 'Ручки скобы 30 см ЗОЛОТО', 'q': 4, 'p': 0}, {'n': 'Двери Антресоль - Белый С - обр', 'q': 4, 'p': 500}]
db = {'v': 1, 'cat': cat, 'templates': [{'id': 't%d' % i, 't': t, 'items': items[:4]} for i, t in enumerate(['Шкаф Айша 6х', 'Шкаф Турция 6х', 'Айша 4х с антресолью', 'Айша 4х'])],
      'trash': [], 'clients': [], 'orders': [], 'payments': [], 'installments': [], 'instNo': 1,
      'cart': {'groups': [{'t': 'Айша 4х с антресолью', 'items': items}], 'cur': 0}, 'nextNo': 1, 'lastBackup': time.time() * 1000, 'notice': ''}
base = 'file:///' + ROOT.replace('\\', '/')
html = __import__('re').sub(r'\?v=[^"]*', '', open(ROOT + r'\LIVARO.html', encoding='utf-8').read())  # без номера версии
html = html.replace('href="app/', 'href="' + base + '/app/').replace('src="app/', 'src="' + base + '/app/')
html = html.replace('<script src="' + base + '/app/catalog-1c.js"></script>',
                    '<script>localStorage.setItem("livaro_db_v1",%s);location.hash="#/order";</script>' % json.dumps(json.dumps(db, ensure_ascii=False)))
f = OUT + r'\order.html'
open(f, 'w', encoding='utf-8').write(html)
png = OUT + r'\order_shot.png'
subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--window-size=1440,900', '--virtual-time-budget=3000',
                '--screenshot=' + png, 'file:///' + f.replace('\\', '/')], capture_output=True, timeout=90)
print(png)
