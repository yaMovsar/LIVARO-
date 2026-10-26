"""Снимок экрана программы с тестовыми данными (Edge headless). Аргумент: раздел, например sales."""
import json
import subprocess
import sys
import time

ROOT = r'C:\Users\user\Desktop\LIVARO'
OUT = sys.argv[2] if len(sys.argv) > 2 else ROOT + r'\_разработка'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
view = sys.argv[1] if len(sys.argv) > 1 else 'sales'
today = time.strftime('%Y-%m-%d')


def o(i, no, cid, total, status='shipped', items=None):
    return {'id': i, 'no': no, 'date': today, 'shipDate': None if status == 'ordered' else today, 'shippedAt': no * 10, 'status': status,
            'clientId': cid, 'groups': [{'t': 'Шкаф Айша 6', 'items': items or [{'n': 'Корпус Милан 6х БЕЛЫЙ', 'q': 1, 'p': total}]}], 'total': total, 'createdAt': no}


db = {'v': 1, 'cat': json.load(open(ROOT + r'\app\catalog-1c.js', encoding='utf-8-sig').read().split('=', 1)[1].rstrip().rstrip(';') and None) if False else [],
      'templates': [], 'trash': [],
      'clients': [{'id': 'sh', 'name': 'Шамиль BUGLAN', 'opening': 0}, {'id': 'ra', 'name': 'Рашид ДАЧА', 'opening': 0}, {'id': 'ab', 'name': 'Абдурахим', 'opening': 50000}],
      'orders': [o('a', 1, 'sh', 64000), o('b', 2, 'ra', 30000), o('c', 3, 'sh', 30000), o('d', 4, 'ab', 42000), o('e', 5, 'ra', 18000, 'ordered'), o('f', 6, 'ab', 12000, 'cancelled')],
      'payments': [{'id': 'p1', 'clientId': 'sh', 'amount': 64000, 'method': 'cash', 'status': 'received', 'date': today, 'receivedDate': today, 'orderId': None,
                    'alloc': [{'orderId': 'a', 'amount': 64000}], 'createdAt': 100}],
      'cart': {'groups': [{'t': 'Шкаф 1', 'items': []}], 'cur': 0}, 'nextNo': 7, 'lastBackup': time.time() * 1000, 'notice': ''}
html = __import__('re').sub(r'\?v=[^"]*', '', open(ROOT + r'\LIVARO.html', encoding='utf-8').read())  # без номера версии
base = ROOT.replace('\\', '/')
html = html.replace('href="app/styles.css"', 'href="file:///' + base + '/app/styles.css"')
html = html.replace('<script src="app/catalog-1c.js"></script>', '<script>localStorage.setItem("livaro_db_v1",%s);location.hash="#/%s";</script>' % (json.dumps(json.dumps(db, ensure_ascii=False)), view))
html = html.replace('src="app/app.js"', 'src="file:///' + base + '/app/app.js"')
f = OUT + r'\shot.html'
open(f, 'w', encoding='utf-8').write(html)
png = OUT + r'\shot_' + view.replace('/', '_') + '.png'
subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--window-size=1440,900', '--screenshot=' + png, 'file:///' + f.replace('\\', '/')], capture_output=True, timeout=60)
print(png)
