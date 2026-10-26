"""Печать этикеток в PDF (Edge): число страниц и размер страницы термопринтера 112×75 мм."""
import json
import subprocess
import sys
import time

ROOT = r'C:\Users\user\Desktop\LIVARO'
OUT = sys.argv[1] if len(sys.argv) > 1 else ROOT + r'\_разработка'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
g2 = {'t': 'Шкаф Милан 2-х, белый', 'items': [{'n': 'Шкаф Милан 2-х дверный (Труба) БЕЛЫЙ', 'q': 1, 'p': 11000}, {'n': 'Дверь Марьям на корпус МИЛАН БЕЛЫЙ', 'q': 2, 'p': 0},
                                              {'n': 'Ручки скобы 30 см ЗОЛОТО', 'q': 2, 'p': 0}, {'n': 'Карниз на 2 дв. + фурнитура', 'q': 1, 'p': 0}]}
g4 = {'t': 'Шкаф Айша 4х, белый', 'items': [{'n': 'Корпус 4-х Милан белый 220х180х52 ( Коробка № 1 и № 2 )', 'q': 1, 'p': 24000}, {'n': 'дверь АЙША на корпус МИЛАН 220 БЕЛЫЙ С - образ', 'q': 4, 'p': 0},
                                            {'n': 'Ручки скобы 30 см ЗОЛОТО', 'q': 4, 'p': 0}, {'n': 'Карниз на 4 дв. + фурнитура', 'q': 1, 'p': 0}]}
db = {'v': 1, 'cat': [], 'templates': [], 'trash': [], 'payments': [], 'installments': [], 'instNo': 1, 'clients': [{'id': 'c1', 'name': 'Шамиль BUGLAN', 'opening': 0}],
      'orders': [{'id': 'o1', 'no': 15, 'date': '2026-10-24', 'status': 'ordered', 'clientId': 'c1', 'groups': [g2, g4], 'total': 35000, 'createdAt': 1}],
      'cart': {'groups': [], 'cur': 0}, 'nextNo': 16, 'lastBackup': time.time() * 1000, 'notice': ''}
base = 'file:///' + ROOT.replace('\\', '/')
html = __import__('re').sub(r'\?v=[^"]*', '', open(ROOT + r'\LIVARO.html', encoding='utf-8').read())  # без номера версии
html = html.replace('href="app/', 'href="' + base + '/app/').replace('src="app/', 'src="' + base + '/app/')
html = html.replace('<script src="' + base + '/app/catalog-1c.js"></script>',
                    '<script>localStorage.setItem("livaro_db_v1",%s);location.hash="#/labels/o1";</script>' % json.dumps(json.dumps(db, ensure_ascii=False)))
f = OUT + r'\lbl.html'
open(f, 'w', encoding='utf-8').write(html)
pdf = OUT + r'\labels.pdf'
subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--no-pdf-header-footer', '--virtual-time-budget=3000',
                '--print-to-pdf=' + pdf, 'file:///' + f.replace('\\', '/')], capture_output=True, timeout=90)
import pymupdf
d = pymupdf.open(pdf)
print('страниц:', len(d), '| размер первой, мм:', round(d[0].rect.width / 72 * 25.4, 1), 'x', round(d[0].rect.height / 72 * 25.4, 1))
d[0].get_pixmap(dpi=150).save(OUT + r'\label_p1.png')
d[4].get_pixmap(dpi=150).save(OUT + r'\label_p5.png')

