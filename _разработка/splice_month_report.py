# отчёт по месяцам (month_report.js) — вкладка «По месяцам» в «Отчётах»
import io
p = 'app/app.js'; s = io.open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    assert s.count(a) == 1, (s.count(a), a[:90])
    s = s.replace(a, b)


rep("VIEWS.reports = () => {\n  const r = UI.repRange,", "VIEWS.reports = () => {\n  if (UI.repTab === 'month') return monthReport();\n  const r = UI.repRange,")
rep("<h1>Отчёты</h1><div class=\"sub-h\">Только отгруженные заказы за выбранный период.</div></div>' + rangeButton(r, 'range-open', 'repRange')",
    "<h1>Отчёты</h1><div class=\"sub-h\">Только отгруженные заказы за выбранный период.</div>' + repTabs() + '</div>' + rangeButton(r, 'range-open', 'repRange')")
mark = '/* ================= СКЛАД ================= */'  # после объявления ACT/CH
rep(mark, io.open('_разработка/month_report.js', encoding='utf-8').read() + '\n' + mark)
io.open(p, 'w', encoding='utf-8', newline='').write(s)

c = 'app/styles.css'; t = io.open(c, encoding='utf-8').read()
t += '''
/* ===== отчёт по месяцам (01.11.2026) ===== */
.mup{color:#13795B;font-weight:600;white-space:nowrap}.mdown{color:#B3261E;font-weight:600;white-space:nowrap}
.mtable tr.mgone td{color:var(--muted)}
.mtw{display:inline-block;width:16px;color:var(--muted);font-size:11px}
.mtable tr.mdet td{background:#F8FAFC;padding:10px 14px 14px 30px}
.mdet-in{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:24px}
.mdet-in .line{font-size:13.5px}
.mdocs{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.mdocs a{font-size:13px;background:#EEF2FA;border-radius:6px;padding:2px 8px;text-decoration:none}
.mtable tr.mtot td{font-weight:700;border-top:2px solid var(--line)}
.mprint-h{display:none}
@media print{.mprint-h{display:block;margin:0 0 8px}.mtw{display:none}}
@media (max-width:760px){.mdet-in{grid-template-columns:1fr}}
'''
io.open(c, 'w', encoding='utf-8', newline='').write(t)
print('ok')
