import json
import re
import subprocess
import sys

SD = r'C:\Users\user\AppData\Local\Temp\claude\c--Users-user-Desktop-APEX-VPN\1c5147b7-8f74-4a54-9a74-10559da22c6f\scratchpad'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
src = open(r'C:\Users\user\Desktop\Макет учёта мебели.html', encoding='utf-8').read()

cab = [
    ['Корпус Милан 6х БЕЛЫЙ по бокам трубы 220х270х52 ( Коробка № 1 и № 2 )', 1, 30000],
    ['дверь АЙША на корпус МИЛАН 220 БЕЛЫЙ С - образ', 4, 0],
    ['Рамка с зеркалом на корпус МИЛАН Белый', 2, 0],
    ['Ручки плоские 60 см СЕРЕБРО', 6, 500],
    ['Комплект выдвижных ящиков под полки БЕЛЫЙ ( 2 ящика )', 1, 2000],
    ['Антресоль 6-х на корпус МИЛАН БЕЛЫЙ', 1, 12000],
    ['Двери Антресоль - Белый С - обр', 6, 500],
    ['Карниз на 6 дв. + фурнитура', 1, 0],
]


def doc(n):
    return [{'t': 'Шкаф Айша %d с антресолью, белый' % (i + 1),
             'items': [{'n': a, 'q': q, 'p': p} for a, q, p in cab]} for i in range(n)]


for view in ('pc', 'pl'):
    for n in (4, 5, 6):
        inj = ('<script>DOC=%s;HDR.client="Шамиль BUGLAN";HDR.bt="adv";HDR.bal="990000";render();show("%s");</script></body>'
               % (json.dumps(doc(n), ensure_ascii=False), view))
        html = src[:src.rindex('</body>')] + inj + src[src.rindex('</body>') + 7:]
        f = SD + r'\pt.html'
        open(f, 'w', encoding='utf-8').write(html)
        pdf = SD + r'\pt_%s_%d.pdf' % (view, n)
        subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
                        '--print-to-pdf=' + pdf, 'file:///' + f.replace('\\', '/')],
                       capture_output=True, timeout=60)
        data = open(pdf, 'rb').read()
        pages = len(re.findall(rb'/Type\s*/Page[^s]', data))
        print(view, n, 'cabinets', n * len(cab), 'rows ->', pages, 'page(s)')
        sys.stdout.flush()
