"""Оплата товаром (взаимозачёт): что привезли, кол-во × цена, проверка суммы, оприходование на склад (24.10.2026)."""
P = r'C:\Users\user\Desktop\LIVARO\app\app.js'
s = open(P, encoding='utf-8').read()

GOODS = r"""
/* ================= ОПЛАТА ТОВАРОМ (взаимозачёт) ================= */
/* Клиент гасит долг товаром: «120 м ткани по 165 ₽». Сумма = кол-во × цена; если клиент назвал другую сумму — предупреждаем.
   Если привезли товар из нашего каталога (например, подъёмные механизмы) — можно сразу оприходовать на склад. */
const UNITS = ['шт', 'м', 'рул.', 'кг', 'л', 'упак.', 'компл.'];
function goodsFields(px) {
  return '<div class="goods-box"><div class="hint" style="margin-bottom:8px">Что клиент привёз в счёт долга. Сумма посчитается сама: количество × цена.</div>' +
    '<label class="fld">Что привезли<input class="inp" id="' + px + '-what" list="cat-names" data-in="goods-calc" data-px="' + px + '" placeholder="например: ткань, скотч, механизм подъёмный 160"></label>' +
    '<div class="form" style="margin-top:10px"><label class="fld">Количество<input class="inp" id="' + px + '-qty" data-in="goods-calc" data-px="' + px + '" inputmode="decimal"></label>' +
    '<label class="fld">Единица<select class="inp" id="' + px + '-unit">' + UNITS.map(u => '<option>' + u + '</option>').join('') + '</select></label>' +
    '<label class="fld">Цена за единицу, ₽<input class="inp" id="' + px + '-price" data-in="goods-calc" data-px="' + px + '" inputmode="decimal"></label></div>' +
    '<div id="' + px + '-check" class="hint" style="margin-top:8px"></div>' +
    '<label id="' + px + '-stockrow" style="display:none;gap:8px;align-items:center;margin-top:8px;font-weight:600"><input type="checkbox" class="cb" id="' + px + '-stock" checked> Оприходовать на склад (товар есть в каталоге)</label>' +
    '<datalist id="cat-names">' + Object.values(NODES).map(n => n.it.map(it => '<option value="' + esc(it[0]) + '">').join('')).join('') + '</datalist></div>';
}
const dec = v => parseFloat(String(v || '').replace(/\s/g, '').replace(',', '.')) || 0;
const goodsNote = g => g.what + ' — ' + String(g.qty).replace('.', ',') + ' ' + g.unit + ' × ' + fmt(g.price) + ' ₽';
function readGoods(px) {
  const what = ($('#' + px + '-what') || {}).value || '';
  return { what: what.trim(), qty: dec(($('#' + px + '-qty') || {}).value), unit: ($('#' + px + '-unit') || {}).value || 'шт', price: dec(($('#' + px + '-price') || {}).value),
    stock: !!(findItem(what.trim()) && $('#' + px + '-stock') && $('#' + px + '-stock').checked) };
}
/* пересчёт: подставляем сумму, пока её не меняли руками; если клиент назвал другую — показываем расхождение */
function goodsCalc(px) {
  const g = readGoods(px), amt = $('#' + px + '-amount'), prod = Math.round(g.qty * g.price), chk = $('#' + px + '-check'), row = $('#' + px + '-stockrow');
  if (amt && prod && (!amt.value || num(amt.value) === +(amt.dataset.auto || 0))) { amt.value = fmt(prod); amt.dataset.auto = prod; }
  if (chk) {
    const a = amt ? num(amt.value) : prod;
    chk.innerHTML = !prod ? '' : a === prod ? '<span class="adv">' + String(g.qty).replace('.', ',') + ' × ' + fmt(g.price) + ' = <b>' + rub(prod) + '</b></span>'
      : '<span class="debt"><b>Проверьте сумму:</b> ' + String(g.qty).replace('.', ',') + ' × ' + fmt(g.price) + ' = <b>' + rub(prod) + '</b>, а указано ' + rub(a) + '.</span> ' +
        '<button class="btn sm" data-act="goods-fix" data-px="' + px + '">Поставить ' + rub(prod) + '</button>';
  }
  if (row) row.style.display = findItem(g.what) ? 'flex' : 'none';
}
function stockInGoods(g, cid) {
  if (!g.stock || !g.qty) return;
  DB.stockMoves.push({ id: uid(), date: todayISO(), name: g.what, q: Math.round(g.qty), kind: 'in', note: 'взаимозачёт: ' + ((client(cid) || {}).name || ''), createdAt: Date.now() });
}
Object.assign(IN, {
  'goods-calc': el => goodsCalc(el.dataset.px),
  'pay-amt': () => goodsCalc('p'),
  'b-amt-goods': () => goodsCalc('b')
});
Object.assign(CH, {
  'p-method': el => { const box = $('#p-goods'); if (box) box.style.display = el.value === 'goods' ? 'block' : 'none'; if (el.value === 'goods') goodsCalc('p'); }
});
Object.assign(ACT, {
  'goods-fix': el => { const px = el.dataset.px, g = readGoods(px), a = $('#' + px + '-amount'); if (a) { a.value = fmt(Math.round(g.qty * g.price)); a.dataset.auto = Math.round(g.qty * g.price); } goodsCalc(px); }
});

"""
mark = '/* ================= ВЫБОР ПЕРИОДА'
start = '\n/* ================= ОПЛАТА ТОВАРОМ'
if start in s:
    s = s[:s.index(start)] + '\n' + s[s.index(mark):]
s = s.replace(mark, GOODS.lstrip('\n') + mark, 1)

R = [
    ("const METHOD = { cash: 'наличные', transfer: 'перевод', driver: 'через водителя' };",
     "const METHOD = { cash: 'наличные', transfer: 'перевод', driver: 'через водителя', goods: 'товаром' };"),
    # окно «Принять оплату»
    ("""    '<div class="form"><label class="fld">Сумма, ₽<input class="inp" id="p-amount"></label><label class="fld">Дата<input class="inp" type="date" id="p-date" value="' + todayISO() + '"></label></div>' +
    '<label class="fld">Способ<select class="inp" id="p-method"><option value="transfer">Перевод</option><option value="cash">Наличные</option><option value="driver">Через водителя (ещё не получено)</option></select></label>' +""",
     """    '<label class="fld">Способ<select class="inp" id="p-method" data-ch="p-method"><option value="transfer">Перевод</option><option value="cash">Наличные</option><option value="goods">Товаром (взаимозачёт)</option><option value="driver">Через водителя (ещё не получено)</option></select></label>' +
    '<div id="p-goods" style="display:none">' + goodsFields('p') + '</div>' +
    '<div class="form"><label class="fld">Сумма, ₽<input class="inp" id="p-amount" data-in="pay-amt"></label><label class="fld">Дата<input class="inp" type="date" id="p-date" value="' + todayISO() + '"></label></div>' +"""),
    ("""    const amt = num($('#p-amount').value); if (!amt) return toast('Введите сумму');
    const m = $('#p-method').value, d = $('#p-date').value || todayISO();
    DB.payments.push({ id: uid(), clientId: $('#p-client').value, amount: amt, method: m, status: m === 'driver' ? 'pending' : 'received', date: d, receivedDate: m === 'driver' ? null : d, orderId: null, note: $('#p-note').value.trim(), createdAt: Date.now() });
    modal(''); commit(); toast('Оплата сохранена');""",
     """    const amt = num($('#p-amount').value); if (!amt) return toast('Введите сумму');
    const m = $('#p-method').value, d = $('#p-date').value || todayISO(), cid = $('#p-client').value, g = m === 'goods' ? readGoods('p') : null;
    if (g && !g.what) return toast('Напишите, что привёз клиент');
    const note = [g ? goodsNote(g) : '', $('#p-note').value.trim()].filter(Boolean).join(' · ');
    DB.payments.push({ id: uid(), clientId: cid, amount: amt, method: m, status: m === 'driver' ? 'pending' : 'received', date: d, receivedDate: m === 'driver' ? null : d, orderId: null, note, goods: g || undefined, createdAt: Date.now() });
    if (g) stockInGoods(g, cid);
    modal(''); commit(); toast(g ? 'Оплата товаром сохранена' + (g.stock ? ', товар оприходован на склад' : '') : 'Оплата сохранена');"""),
    # окно «Отметить оплаченными»
    ("""    '<div class="fld">Как оплатили</div>' + seg(B.method, 'bulk-method', [['transfer', 'Перевод'], ['cash', 'Наличные'], ['driver', 'Через водителя']]) +""",
     """    '<div class="fld">Как оплатили</div>' + seg(B.method, 'bulk-method', [['transfer', 'Перевод'], ['cash', 'Наличные'], ['goods', 'Товаром'], ['driver', 'Через водителя']]) +
    (B.method === 'goods' ? (one ? goodsFields('b') : '<div class="warn">Оплату товаром отмечайте по одному клиенту.</div>') : '') +"""),
    ("""    (one ? '<label class="fld">Сумма, ₽<input class="inp" id="b-amount" data-in="bulk-amt" value="' + (B.amount === '' ? fmt(need) : esc(B.amount)) + '"></label>' : '') + '</div>' +""",
     """    (one ? '<label class="fld">Сумма, ₽<input class="inp" id="b-amount" data-in="bulk-amt" value="' + (B.method === 'goods' ? esc(B.amount) : B.amount === '' ? fmt(need) : esc(B.amount)) + '"></label>' : '') + '</div>' +"""),
    ("function readBulk() { if ($('#b-date')) UI.bulk.date = $('#b-date').value; if ($('#b-amount')) UI.bulk.amount = $('#b-amount').value; }",
     "function readBulk() { if ($('#b-date')) UI.bulk.date = $('#b-date').value; if ($('#b-amount')) UI.bulk.amount = $('#b-amount').value; if ($('#b-what')) UI.bulk.g = readGoods('b'); }"),
    ("""        orderId: null, alloc, note: 'по накладным № ' + os.map(o => o.no).join(', '), createdAt: now + k });""",
     """        orderId: null, alloc, note: (B.method === 'goods' && B.g ? goodsNote(B.g) + ' · ' : '') + 'по накладным № ' + os.map(o => o.no).join(', '),
        goods: B.method === 'goods' ? B.g : undefined, createdAt: now + k });
      if (B.method === 'goods' && B.g) stockInGoods(B.g, cid);"""),
    # главная: сколько из полученного — товаром
    ("""    tile('Получено оплат', rub(paid), 'наличные, переводы, от водителей') +""",
     """    tile('Получено оплат', rub(paid), (() => { const gp = DB.payments.filter(x => x.status === 'received' && x.method === 'goods' && inRange(payDate(x), p)).reduce((s, x) => s + x.amount, 0); return gp ? 'из них товаром ' + rub(gp) : 'наличные, переводы, от водителей'; })()) +"""),
    # журнал оплат: фильтр «деньги / товаром» и итог
    ("""  const list = DB.payments.filter(p => inRange(payDate(p), UI.payRange)).sort((a, b) => payDate(b).localeCompare(payDate(a)) || b.createdAt - a.createdAt);
  const sum = list.filter(p => p.status === 'received').reduce((s, p) => s + p.amount, 0);""",
     """  const pk = UI.payKind || 'all';
  const list = DB.payments.filter(p => inRange(payDate(p), UI.payRange) && (pk === 'all' || (pk === 'goods') === (p.method === 'goods'))).sort((a, b) => payDate(b).localeCompare(payDate(a)) || b.createdAt - a.createdAt);
  const sum = list.filter(p => p.status === 'received').reduce((s, p) => s + p.amount, 0), gsumP = list.filter(p => p.status === 'received' && p.method === 'goods').reduce((s, p) => s + p.amount, 0);"""),
    ("""    '<div class="card"><div style="margin-bottom:12px">' + rangeButton(UI.payRange, 'range-open', 'payRange') + '</div>' +""",
     """    '<div class="card"><div class="filters" style="margin-bottom:12px"><div class="fgroup"><span>Период</span>' + rangeButton(UI.payRange, 'range-open', 'payRange') + '</div>' +
    '<div class="fgroup"><span>Чем оплатили</span>' + seg(pk, 'pay-kind', [['all', 'Всё'], ['money', 'Деньгами'], ['goods', 'Товаром']]) + '</div></div>' +"""),
    ("""'<div class="line tot"><span>Получено за период</span><span>' + rub(sum) + '</span></div>'""",
     """'<div class="line tot"><span>Получено за период</span><span>' + rub(sum) + '</span></div>' + (gsumP && pk === 'all' ? '<div class="line"><span class="muted">из них товаром (взаимозачёт)</span><span>' + rub(gsumP) + '</span></div>' : '')"""),
    ("  'sales-pay': el =>", "  'pay-kind': el => { UI.payKind = el.dataset.v; render(); },\n  'sales-pay': el =>"),
]
for a, b in R:
    if b in s:
        continue
    if a not in s:
        print('НЕ НАЙДЕНО:', a.strip()[:80])
    s = s.replace(a, b, 1)
open(P, 'w', encoding='utf-8').write(s)
print('ok')
