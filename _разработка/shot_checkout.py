"""Снимок страницы оформления заказа с большим балансом — проверка переноса сумм."""
import json
import subprocess
import sys
import time

ROOT = r'C:\Users\user\Desktop\LIVARO'
OUT = sys.argv[1] if len(sys.argv) > 1 else ROOT + r'\_разработка'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
items = [{'n': 'Корпус 4-х Милан белый 220х180х52 ( Коробка № 1 и № 2 )', 'q': 1, 'p': 24000}, {'n': 'дверь АЙША на корпус МИЛАН 220 БЕЛЫЙ С - образ', 'q': 4, 'p': 0}]
db = {'v': 1, 'cat': [], 'templates': [], 'trash': [], 'orders': [], 'payments': [], 'installments': [], 'instNo': 1,
      'clients': [{'id': 'c1', 'name': 'Шамиль BUGLAN', 'opening': 1685400}],
      'cart': {'groups': [{'t': 'Айша 4х', 'items': items}], 'cur': 0}, 'nextNo': 1, 'lastBackup': time.time() * 1000, 'notice': ''}
base = 'file:///' + ROOT.replace('\\', '/')
html = __import__('re').sub(r'\?v=[^"]*', '', open(ROOT + r'\LIVARO.html', encoding='utf-8').read())  # без номера версии
html = html.replace('href="app/', 'href="' + base + '/app/').replace('src="app/', 'src="' + base + '/app/')
html = html.replace('<script src="' + base + '/app/catalog-1c.js"></script>',
                    '<script>localStorage.setItem("livaro_db_v1",%s);location.hash="#/checkout";</script>' % json.dumps(json.dumps(db, ensure_ascii=False)))
html = html.replace('</body>', '<script>UI.ck={clientId:"c1",date:todayISO(),pay:"none",amount:""};render();</script></body>')
f = OUT + r'\checkout.html'
open(f, 'w', encoding='utf-8').write(html)
png = OUT + r'\checkout_shot.png'
subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--window-size=1366,800', '--virtual-time-budget=3000',
                '--screenshot=' + png, 'file:///' + f.replace('\\', '/')], capture_output=True, timeout=90)
print(png)
