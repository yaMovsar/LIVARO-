import json
import re
import openpyxl

SD = r'C:\Users\user\AppData\Local\Temp\claude\c--Users-user-Desktop-APEX-VPN\1c5147b7-8f74-4a54-9a74-10559da22c6f\scratchpad'
wb = openpyxl.load_workbook(r'C:\Users\user\Downloads\Список.xlsx', data_only=True)
rows = list(wb.active.iter_rows(values_only=True))[1:]

TOP = ['1. Шкафы распашные', '2. Двери', '4. Антресоль и пеналы', '5. Ручки', '6. Прихожие',
       '7. Кровати', '8. Комоды и тумбы', '9. Карниз + Фурнитура', '10. Ящики выдвижные', 'Прочее']


def folder(n):
    s = n.lower()
    if 'ручк' in s:
        if 'комплект' in s:
            return ['5. Ручки', 'Комплекты ручек']
        if '30 см' in s:
            return ['5. Ручки', '30 см']
        if '50 см' in s:
            return ['5. Ручки', '50 см']
        if '60 см' in s:
            return ['5. Ручки', '60 см']
        return ['5. Ручки', '100 см']
    if 'карниз' in s:
        return ['9. Карниз + Фурнитура']
    if 'ящик' in s:
        return ['10. Ящики выдвижные']
    if 'прихож' in s or 'обувниц' in s:
        return ['6. Прихожие']
    if 'кровать' in s or 'подъем' in s or 'подъём' in s:
        return ['7. Кровати']
    if 'комод' in s or 'тумба' in s:
        return ['8. Комоды и тумбы']
    if 'рамка' in s:
        if 'зеркал' in s:
            return ['2. Двери', 'Двери МИЛАН', 'Рамка на корпус МИЛАН']
        return ['2. Двери', 'Рамки со стеклом']
    if s.startswith('двер') or s.startswith('комплект двери') or 'дверь +' in s:
        if 'антресол' in s:
            return ['4. Антресоль и пеналы']
        if 'лион' in s:
            return ['2. Двери', 'Двери ЛИОН']
        if 'аиша 250' in s:
            return ['2. Двери', 'Двери Айша 250']
        if 'элегант' in s:
            return ['2. Двери', 'Двери Элегант']
        if 'премиум' in s:
            return ['2. Двери', 'Двери ПРЕМИУМ']
        if 'техно' in s:
            return ['2. Двери', 'Двери ТЕХНО']
        if 'волна' in s:
            return ['2. Двери', 'Двери МИЛАН', 'Волна']
        if 'полурефлен' in s:
            return ['2. Двери', 'Двери МИЛАН', 'Двери полурефленные']
        if 'марьям' in s:
            return ['2. Двери', 'Двери МИЛАН', 'Марьям']
        if 'турция' in s:
            return ['2. Двери', 'Двери МИЛАН', 'Турция']
        if 'г - образ' in s:
            return ['2. Двери', 'Двери МИЛАН', 'Г - образная']
        if 'багет' in s:
            return ['2. Двери', 'Двери МИЛАН', 'С - одинарный багет']
        if 'с - образ' in s:
            return ['2. Двери', 'Двери МИЛАН', 'С - Образная']
        return ['2. Двери']
    if 'антресол' in s or 'пенал' in s:
        return ['4. Антресоль и пеналы']
    if 'техно' in s:
        return ['1. Шкафы распашные', 'Техно']
    if 'лион' in s:
        return ['1. Шкафы распашные', 'Шкаф Лион']
    if 'заказн' in s:
        return ['1. Шкафы распашные', 'Шкафы заказные']
    if 'милан' in s:
        if '133' in s:
            return ['1. Шкафы распашные', 'Шкафы МИЛАН', 'Милан 133 (3х дверный)']
        if '4-х' in s:
            return ['1. Шкафы распашные', 'Шкафы МИЛАН', 'Шкаф Милан - 4х']
        if '6х' in s and 'полки' in s:
            return ['1. Шкафы распашные', 'Шкафы МИЛАН', 'Шкаф Милан - 6х (1 труба)']
        if '6х' in s:
            return ['1. Шкафы распашные', 'Шкафы МИЛАН', 'Шкаф Милан - 6х (2 трубы)']
        return ['1. Шкафы распашные', 'Шкафы МИЛАН', 'Шкаф Милан 2-х']
    if 'премиум' in s or 'элегант' in s:
        return ['1. Шкафы распашные', 'Шкафы ПРЕМИУМ']
    if s.startswith('шкаф'):
        return ['1. Шкафы распашные']
    if s.startswith('+') or s.startswith('4 двери'):
        return ['Прочее', 'Допы']
    return ['Прочее']


COLORS = re.compile(r'\b(серый|серая|лино|ваниль|белый|белая|вотан|ватан|сатин)\b', re.I)


def base(n):
    return re.sub(r'\s+', ' ', COLORS.sub('', n)).strip(' -').lower()


items = []
for r in rows:
    name = re.sub(r'\s+', ' ', str(r[0] or '')).strip()
    if not name:
        continue
    p = r[2]
    p = int(p) if isinstance(p, (int, float)) else None
    if p == 1:
        p = 0
    items.append([name, p])

# одна модель в любом цвете — одна цена
prices = {}
for n, p in items:
    if p:
        prices.setdefault(base(n), set()).add(p)
filled = 0
for it in items:
    if it[1] is None:
        ps = prices.get(base(it[0]))
        if ps and len(ps) == 1:
            it[1] = ps.pop() if False else next(iter(ps))
            filled += 1

root = {'ch': {}, 'it': []}
for n, p in items:
    node = root
    for f in folder(n):
        node = node['ch'].setdefault(f, {'ch': {}, 'it': []})
    node['it'].append([n, p])


def conv(d, order=None):
    names = list(d.keys())
    if order:
        names.sort(key=lambda x: order.index(x) if x in order else 99)
    else:
        names.sort()
    return [{'n': k, 'ch': conv(d[k]['ch']), 'it': d[k]['it']} for k in names]


cat = conv(root['ch'], TOP)
open(SD + r'\cat.js', 'w', encoding='utf-8').write('var CAT=' + json.dumps(cat, ensure_ascii=False) + ';\n')
print('items', len(items), 'filled_by_color', filled,
      'no_price', sum(1 for i in items if i[1] is None),
      'included_zero', sum(1 for i in items if i[1] == 0),
      'other', len(root['ch'].get('Прочее', {'it': []})['it']))
