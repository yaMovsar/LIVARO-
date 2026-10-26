"""Проверка: накладная превращается в PNG через html2canvas в настоящем браузере (Edge headless)."""
import json
import subprocess
import sys
import time

ROOT = r'C:\Users\user\Desktop\LIVARO'
OUT = sys.argv[1] if len(sys.argv) > 1 else ROOT + r'\_разработка'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
today = time.strftime('%Y-%m-%d')
items = [{'n': 'Корпус Милан 6х БЕЛЫЙ по бокам трубы 220х270х52 ( Коробка № 1 и № 2 )', 'q': 1, 'p': 30000},
         {'n': 'дверь АЙША на корпус МИЛАН 220 БЕЛЫЙ С - образ', 'q': 6, 'p': 0},
         {'n': 'Ручки плоские 60 см ЗОЛОТО', 'q': 6, 'p': 750}, {'n': 'Карниз на 6 дв. + фурнитура', 'q': 1, 'p': 0}]
db = {'v': 1, 'cat': [], 'templates': [], 'trash': [], 'clients': [{'id': 'c1', 'name': 'Шамиль BUGLAN', 'phone': '+7 928 111-22-33', 'opening': 100000}],
      'installments': [{'id': 'i1', 'no': 1, 'date': today, 'buyer': {'name': 'Алиева Патимат Магомедовна', 'phone': '8 928 555 44 33', 'address': 'г. Махачкала, ул. Ленина 5', 'note': ''}, 'groups': [{'t': 'Шкаф Айша 6, белый', 'items': items}], 'price': 34500, 'pct': 10, 'pctBase': 'all', 'markup': 3450, 'total': 37950, 'down': 10000, 'months': 3, 'schedule': [{'date': '2026-11-24', 'amount': 9300}, {'date': '2026-12-24', 'amount': 9300}, {'date': '2027-01-24', 'amount': 9350}], 'pays': [{'id': 'p', 'date': today, 'amount': 10000, 'method': 'cash', 'kind': 'down'}], 'createdAt': 1}], 'instNo': 2, 'orders': [{'id': 'o1', 'no': 7, 'date': today, 'shipDate': today, 'shippedAt': 5, 'status': 'shipped', 'clientId': 'c1',
                  'groups': [{'t': 'Шкаф Айша 6, белый', 'items': items}], 'total': 34500, 'createdAt': 1}],
      'payments': [], 'cart': {'groups': [], 'cur': 0}, 'nextNo': 8, 'lastBackup': time.time() * 1000, 'notice': ''}
base = 'file:///' + ROOT.replace('\\', '/')
html = __import__('re').sub(r'\?v=[^"]*', '', open(ROOT + r'\LIVARO.html', encoding='utf-8').read())  # без номера версии
html = html.replace('href="app/', 'href="' + base + '/app/').replace('src="app/', 'src="' + base + '/app/')
html = html.replace('<script src="' + base + '/app/catalog-1c.js"></script>',
                    '<script>localStorage.setItem("livaro_db_v1",%s);</script>' % json.dumps(json.dumps(db, ensure_ascii=False)))
html = html.replace('</body>', '<script>paperImage(VIEWS.iprint(["i1"])).then(b=>{document.title="PNG "+b.size;'
                    'document.body.innerHTML="<img style=\\"width:794px;display:block\\" src=\\""+URL.createObjectURL(b)+"\\">";})'
                    '.catch(e=>{document.title="ERR "+e;});</script></body>')
f = OUT + r'\wa.html'
open(f, 'w', encoding='utf-8').write(html)
png = OUT + r'\inst_shot.png'
subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--virtual-time-budget=8000',
                '--window-size=794,1123', '--screenshot=' + png, 'file:///' + f.replace('\\', '/')], capture_output=True, timeout=90)
print(png)

