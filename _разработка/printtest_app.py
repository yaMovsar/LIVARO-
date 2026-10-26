"""Проверка: накладная из программы помещается на 1 лист A4 (печать через Edge в PDF)."""
import json
import re
import subprocess
import time

ROOT = r'C:\Users\user\Desktop\LIVARO'
OUT = r'C:\Users\user\AppData\Local\Temp\claude\c--Users-user-Desktop-APEX-VPN\1c5147b7-8f74-4a54-9a74-10559da22c6f\scratchpad'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

cab = [['Корпус Милан 6х БЕЛЫЙ по бокам трубы 220х270х52 ( Коробка № 1 и № 2 )', 1, 30000],
       ['дверь АЙША на корпус МИЛАН 220 БЕЛЫЙ С - образ', 4, 0], ['Рамка с зеркалом на корпус МИЛАН Белый', 2, 0],
       ['Ручки плоские 60 см СЕРЕБРО', 6, 500], ['Комплект выдвижных ящиков под полки БЕЛЫЙ ( 2 ящика )', 1, 2000],
       ['Антресоль 6-х на корпус МИЛАН БЕЛЫЙ', 1, 12000], ['Двери Антресоль - Белый С - обр', 6, 500],
       ['Карниз на 6 дв. + фурнитура', 1, 0]]
html = __import__('re').sub(r'\?v=[^"]*', '', open(ROOT + r'\LIVARO.html', encoding='utf-8').read())  # без номера версии
html = html.replace('href="app/styles.css"', 'href="' + ROOT.replace('\\', '/') + '/app/styles.css"')
for n in (4, 5):
    groups = [{'t': 'Шкаф Айша %d' % (i + 1), 'items': [{'n': a, 'q': q, 'p': p} for a, q, p in cab]} for i in range(n)]
    total = sum(q * p for _, q, p in cab) * n
    db = {'v': 1, 'cat': [], 'clients': [{'id': 'c1', 'name': 'Шамиль BUGLAN', 'opening': 990000}],
          'orders': [{'id': 'o1', 'no': 1, 'date': '2026-10-23', 'clientId': 'c1', 'groups': groups, 'total': total, 'createdAt': 1}],
          'payments': [], 'cart': {'groups': [], 'cur': 0}, 'nextNo': 2, 'lastBackup': time.time() * 1000, 'notice': ''}
    for kind in ('c', 'l'):
        page = html.replace('<script src="app/catalog-1c.js"></script>',
                            '<script>localStorage.setItem("livaro_db_v1",%s);location.hash="#/print/%s/o1";</script>' % (json.dumps(json.dumps(db, ensure_ascii=False)), kind))
        page = page.replace('src="app/app.js"', 'src="' + ROOT.replace('\\', '/') + '/app/app.js"')
        f = OUT + r'\pa.html'
        open(f, 'w', encoding='utf-8').write(page)
        pdf = OUT + r'\pa_%s_%d.pdf' % (kind, n)
        subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--allow-file-access-from-files',
                        '--print-to-pdf=' + pdf, 'file:///' + f.replace('\\', '/')], capture_output=True, timeout=60)
        data = open(pdf, 'rb').read()
        print(kind, n, 'шкафов', n * len(cab), 'строк ->', len(re.findall(rb'/Type\s*/Page[^s]', data)), 'стр.')
