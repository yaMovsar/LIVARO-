# бланк пересчёта по образцу пользователя: заменяет VIEWS.invprint (и invModels/modelTitle) кодом из blank_v2.js
import io
p = 'app/app.js'; s = io.open(p, encoding='utf-8').read()
a = s.index('/* бланк обхода склада. Два вида:'); b = s.index('/* загрузка таблицы: ищем колонку')
s = s[:a] + io.open('_разработка/blank_v2.js', encoding='utf-8').read() + s[b:]
for old, new in [
    ("const invSet = () => Object.assign({ invShow: 'all', invPlan: true, invBreak: false, invMatrix: true }, DB.settings || {});",
     "const invSet = () => Object.assign({ invShow: 'all', invBreak: false }, DB.settings || {});"),
    ("  'inv-matrix': el => { DB.settings = Object.assign({}, DB.settings, { invMatrix: el.checked }); commit(); },\n", ''),
    ("  'inv-plan': el => { DB.settings = Object.assign({}, DB.settings, { invPlan: el.checked }); commit(); },\n", ''),
    ("'<a class=\"btn\" href=\"#/invprint\">Бланк обхода</a><button class=\"btn pri big\" data-act=\"inv-save\"", "'<a class=\"btn\" href=\"#/invprint\">Бланк пересчёта</a><button class=\"btn pri big\" data-act=\"inv-save\""),
    ('<a class="btn" href="#/invprint">Бланк обхода</a><a class="btn" href="#/inv">', '<a class="btn" href="#/invprint">Бланк пересчёта</a><a class="btn" href="#/inv">'),
]:
    assert s.count(old) == 1, old[:70]
    s = s.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='').write(s)

c = 'app/styles.css'; t = io.open(c, encoding='utf-8').read()
a = t.index('/* бланк «цвета колонками»'); b = t.index('.inv-paper tbody.newpage')
t = t[:a] + '''/* бланк пересчёта (по образцу): заголовок по центру, серая шапка таблицы, клетки под ручку */
.inv-title{text-align:center;font-weight:700;font-size:19px;letter-spacing:.01em;margin:2px 0 4px}
.inv-mx .p-t th{background:#E4E6EA;font-size:12px;font-weight:700;color:#111316;padding:6px 3px}
.inv-mx .p-t th.mcol{width:15mm}
.inv-mx .p-t tr.mrow td{height:9mm;font-size:12px}
.inv-mx .p-t td.no{text-align:center;font-size:11.5px;padding:0 2px}
.inv-mx .p-t tr.g td{background:#EFF0F2;font-size:12.5px}
''' + t[b:]
t = t.replace('.inv-fields{display:grid;grid-template-columns:1fr 1.4fr 1.4fr;gap:14px;margin:10px 0 8px;font-size:12.5px}',
              '.inv-fields{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:18px;margin:6px 0 10px;font-size:13px}')
io.open(c, 'w', encoding='utf-8', newline='').write(t)
print('ok')
