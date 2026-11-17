"""Значки приложения LIVARO (вариант 2, синий) из app/icons/*.svg → PNG нужных размеров.
SVG рисует Edge headless (шрифт Segoe UI как в программе), уменьшает pymupdf.
Запуск: python _разработка/make_icons.py"""
import os, subprocess, tempfile, time
import pymupdf as fitz

ROOT = r'C:\Users\user\Desktop\LIVARO'
ICONS = os.path.join(ROOT, 'app', 'icons')
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
TMP = tempfile.mkdtemp(prefix='livaro_icons_')


def render(svg, out, size=512):
    page = os.path.join(TMP, 'p.html')
    url = 'file:///' + os.path.join(ICONS, svg).replace('\\', '/')
    open(page, 'w', encoding='utf-8').write(
        '<!doctype html><html><body style="margin:0;overflow:hidden;background:#1E56B3">'
        '<img src="%s" style="display:block;width:%dpx;height:%dpx"></body></html>' % (url, size, size))
    for _ in range(4):
        if os.path.exists(out): os.remove(out)
        subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
                        '--allow-file-access-from-files', '--user-data-dir=' + os.path.join(TMP, 'prof'), '--window-size=%d,%d' % (size, size),
                        '--screenshot=' + out, 'file:///' + page.replace('\\', '/')], capture_output=True, timeout=60)
        for _ in range(40):  # Edge может дописать снимок уже после выхода запускалки
            if os.path.exists(out) and os.path.getsize(out) > 0: time.sleep(0.5); return
            time.sleep(0.5)
    raise SystemExit('Edge не сделал снимок: ' + out)


def scaled(src, out, size):
    pm = fitz.Pixmap(src)
    if pm.alpha: pm = fitz.Pixmap(pm, 0)
    fitz.Pixmap(pm, size, size, None).save(out)


big = os.path.join(TMP, 'big.png'); render('icon.svg', big)
mask = os.path.join(TMP, 'mask.png'); render('icon-maskable.svg', mask)
for name, src, size in [('icon-512.png', big, 512), ('icon-192.png', big, 192), ('apple-touch-icon.png', big, 180),
                        ('favicon-32.png', big, 32), ('icon-maskable-512.png', mask, 512)]:
    out = os.path.join(ICONS, name)
    if size == 512: fitz.Pixmap(src).save(out)
    else: scaled(src, out, size)
    p = fitz.Pixmap(out)
    print(name, p.width, 'x', p.height)
