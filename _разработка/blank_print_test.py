"""Печать бланка пересчёта в PDF (Edge) на данных из резервной копии: число листов и картинки первых двух.
Запуск: python blank_print_test.py <папка_для_результата> [<копия.json>]"""
import json, os, subprocess, sys, pathlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1]
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
base = pathlib.Path(ROOT).as_uri()
html = open(os.path.join(ROOT, 'LIVARO.html'), encoding='utf-8').read()
html = html.replace('href="app/', 'href="' + base + '/app/').replace('src="app/', 'src="' + base + '/app/')
boot = 'localStorage.clear();'
if len(sys.argv) > 2:
    db = json.load(open(sys.argv[2], encoding='utf-8'))
    db = db.get('db', db)
    db['settings'] = dict(db.get('settings') or {}, invFolders=None, invBreak=False)
    boot += 'localStorage.setItem("livaro_db_v1",' + json.dumps(json.dumps(db, ensure_ascii=False), ensure_ascii=False) + ');'
boot += 'location.hash="#/invprint";'
html = html.replace('<script src="' + base + '/app/catalog-1c.js', '<script>' + boot + '</script><script src="' + base + '/app/catalog-1c.js', 1)
f = os.path.join(OUT, 'blank.html')
open(f, 'w', encoding='utf-8').write(html)
pdf = os.path.join(OUT, 'blank.pdf')
subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--no-pdf-header-footer', '--virtual-time-budget=4000',
                '--print-to-pdf=' + pdf, pathlib.Path(f).as_uri()], capture_output=True, timeout=120)
import pymupdf
d = pymupdf.open(pdf)
print('листов', len(d), 'размер мм', round(d[0].rect.width / 72 * 25.4), round(d[0].rect.height / 72 * 25.4))
for i in range(min(2, len(d))):
    d[i].get_pixmap(dpi=80).save(os.path.join(OUT, 'blank_%d.png' % (i + 1)))
