VIEWS.checkout = () => {
  if (!cartCount()) return '<div class="head"><h1>Оформление</h1></div><div class="card empty">Корзина пуста. <a href="#/order">Выбрать товары</a></div>';
  const ed = DB.cart.editId ? order(DB.cart.editId) : null;
  const ck = UI.ck || (UI.ck = ed ? { clientId: ed.clientId, date: ed.date, pay: 'none', amount: '' } : { clientId: null, date: todayISO(), pay: 'none', amount: '' });
  const c = ck.clientId ? client(ck.clientId) : null, tot = orderTotal(DB.cart.groups);
  const now = c ? balance(c.id) : 0, pre = ck.pay === 'none' ? 0 : num(ck.amount), after = now + pre - tot;
  const tops = topClients(10);
  return '<div class="head"><div><div class="crumb">Оформить заказ · шаг 2 из 2</div><h1>' + (ed ? 'Изменение заказа № ' + ed.no : 'Оформление заказа') + '</h1></div><div class="btns"><a class="btn" href="#/order">← Назад в корзину</a>' +
    '<button class="btn pri big" data-act="post"' + (c ? '' : ' disabled') + '>' + (ed ? 'Сохранить изменения' : 'Оформить заказ') + '</button></div></div>' +
    '<div class="row"><div class="grow"><div class="card"><h2>Клиент</h2>' +
    (c ? '<div class="picked"><div><b style="font-size:16px">' + esc(c.name) + '</b>' + (c.phone ? '<div class="hint">' + esc(c.phone) + '</div>' : '') + '</div><div class="btns">' + balTag(now) + '<button class="btn sm" data-act="ck-change">Другой клиент</button></div></div>'
      : '<div class="ac"><input class="inp" id="ck-q" data-in="ck-q" placeholder="Начните вводить имя клиента или телефон…" autocomplete="off"><div id="ck-dd"></div></div>' +
      (tops.length ? '<div class="hint" style="margin:12px 0 6px">Частые клиенты</div><div class="chips">' + tops.map(([x, n]) => '<button class="chip" data-act="ck-pick" data-id="' + x.id + '">' + esc(x.name) + (n ? '<small>' + n + '</small>' : '') + '</button>').join('') + '</div>' : '<div class="hint" style="margin-top:10px">Клиентов пока нет — введите имя и нажмите «Создать нового клиента».</div>') +
      '<div style="margin-top:12px"><button class="btn sm dash" data-act="client-new">+ Новый клиент</button></div>') +
    '</div><div class="card"><h2>Заказ</h2><div class="form">' +
    '<label class="fld">Номер (автоматически)<input class="inp" value="' + (ed ? ed.no : DB.nextNo) + '" disabled></label>' +
    '<label class="fld">Дата заказа<input class="inp" type="date" data-ch="ck-date" value="' + ck.date + '"></label></div></div>' +
    '<div class="card"><h2>Предоплата</h2><div class="opt">' +
    [['none', 'Без предоплаты'], ['cash', 'Наличные'], ['transfer', 'Перевод']].map(([k, l]) => '<button class="chip' + (ck.pay === k ? ' on' : '') + '" data-act="ck-pay" data-v="' + k + '">' + l + '</button>').join('') + '</div>' +
    (ck.pay === 'none' ? '' : '<label class="fld" style="margin-top:12px;max-width:260px">Сумма, ₽<input class="inp" data-ch="ck-amount" value="' + esc(ck.amount) + '" placeholder="' + fmt(tot) + '"></label>') +
    '<div class="hint" style="margin-top:10px">Предоплата сразу зачтётся клиенту. Оплату при отгрузке и «деньги передаст водитель» укажете, когда нажмёте «Отгрузить».</div></div></div>' +
    '<div class="aside"><div class="card"><h2>Состав</h2>' + DB.cart.groups.filter(g => g.items.length).map(g => '<div class="line"><span>' + esc(g.t) + ' <span class="muted">· ' + g.items.length + ' поз.</span></span><b>' + rub(gsum(g)) + '</b></div>').join('') +
    '<div class="line tot"><span>Итого</span><span>' + rub(tot) + '</span></div></div>' +
    '<div class="card"><h2>Баланс клиента</h2>' + (c ?
      '<div class="line"><span class="muted">Сейчас</span><span>' + balTxt(now) + '</span></div>' +
      (pre ? '<div class="line"><span class="muted">Предоплата</span><span>+' + rub(pre) + '</span></div>' : '') +
      '<div class="line"><span class="muted">Заказ (спишется при отгрузке)</span><span>−' + rub(tot) + '</span></div>' +
      '<div class="line tot ' + (after > 0 ? 'adv' : after < 0 ? 'debt' : '') + '"><span>После отгрузки</span><span>' + balTxt(after) + '</span></div>' : '<div class="hint">Выберите клиента</div>') + '</div>' +
    '<div class="card"><h2>Что будет дальше</h2><div class="hint" style="font-size:13px">Заказ получит статус <span class="tag b">Оформлен</span> — баланс клиента не изменится. Можно распечатать лист погрузки. Когда машина загрузится — нажмите «Отгрузить»: сумма спишется с баланса.</div></div>' +
    '</div></div>';
};

/* ================= ПРОДАЖИ ================= */
VIEWS.sales = () => {
  const q = UI.salesQ.toLowerCase(), sf = UI.salesStatus || 'all';
  const list = DB.orders.filter(o => (o.status === 'ordered' || inPeriod(o.shipDate || o.date, UI.salesPeriod)) && (sf === 'all' || o.status === sf) &&
    (!q || String(o.no) === q || ((client(o.clientId) || {}).name || '').toLowerCase().includes(q)))
    .sort((a, b) => (a.status === 'ordered' ? 0 : 1) - (b.status === 'ordered' ? 0 : 1) || (b.shipDate || b.date).localeCompare(a.shipDate || a.date) || b.no - a.no);
  const sh = list.filter(o => o.status === 'shipped'), sum = sh.reduce((s, o) => s + o.total, 0);
  return '<div class="head"><h1>Продажи</h1><a class="btn pri" href="#/order">Оформить заказ</a></div>' +
    '<div class="card"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px">' + periodChips(UI.salesPeriod, 'sales-period') +
    '<input class="inp" style="max-width:300px" data-in="sales-q" id="sales-q" placeholder="Клиент или номер" value="' + esc(UI.salesQ) + '"></div>' +
    '<div class="chips" style="margin-bottom:12px">' + [['all', 'Все'], ['ordered', 'Ждут отгрузки'], ['shipped', 'Отгружены'], ['cancelled', 'Отменены']].map(([k, l]) =>
      '<button class="chip' + (sf === k ? ' on' : '') + '" data-act="sales-status" data-v="' + k + '">' + l + (k === 'ordered' && waitingOrders().length ? '<small>' + waitingOrders().length + '</small>' : '') + '</button>').join('') + '</div>' +
    (list.length ? '<div class="scroll"><table class="t" style="min-width:700px"><thead><tr><th>№</th><th>Дата</th><th>Клиент</th><th>Статус</th><th>Оплата</th><th class="num">Сумма</th></tr></thead><tbody>' +
      list.map(o => {
        const ps = DB.payments.filter(p => p.orderId === o.id), dd = o.status === 'ordered' ? daysSince(o.date) : 0;
        const pay = ps.length ? ps.map(p => '<span class="tag ' + (p.status === 'pending' ? 'w' : 'a') + '">' + METHOD[p.method] + ' ' + rub(p.amount) + '</span>').join(' ') : '<span class="muted">—</span>';
        return '<tr class="click" data-act="go" data-to="#/sale/' + o.id + '"' + (o.status === 'cancelled' ? ' style="opacity:.55"' : '') + '><td><b>' + o.no + '</b></td><td>' + ru(o.shipDate || o.date) + '</td><td>' + esc((client(o.clientId) || {}).name) + '</td>' +
          '<td>' + statusTag(o) + (dd > LATE_DAYS ? ' <span class="tag d">' + dd + ' дн.</span>' : '') + '</td><td>' + pay + '</td><td class="num"' + (o.status === 'cancelled' ? ' style="text-decoration:line-through"' : '') + '><b>' + rub(o.total) + '</b></td></tr>';
      }).join('') + '</tbody></table></div><div class="line tot"><span>Отгружено за период: ' + sh.length + ' ' + plural(sh.length, 'накладная', 'накладные', 'накладных') + '</span><span>' + rub(sum) + '</span></div>'
      : '<div class="empty">Заказов нет</div>') + '</div>';
};
function groupsTable(o) {
  return o.groups.map((g, gi) => '<div class="gbox" style="cursor:default"><div class="ghead"><b style="flex:1">' + (gi + 1) + '. ' + esc(g.t) + '</b><span class="gsum">' + rub(gsum(g)) + '</span></div><table class="gt">' +
    g.items.map(it => '<tr><td>' + esc(it.n) + '</td><td class="num" style="width:70px">' + it.q + ' шт</td><td class="num" style="width:100px">' + (it.p ? rub(it.p) : '<span class="muted">входит</span>') + '</td><td class="num" style="width:100px">' + (it.p ? rub(it.q * it.p) : '') + '</td></tr>').join('') + '</table></div>').join('');
}
VIEWS.sale = ([id]) => {
  const o = order(id);
  if (!o) return '<div class="card empty">Заказ не найден. <a href="#/sales">К продажам</a></div>';
  const c = client(o.clientId) || { name: '—' }, b = orderBalance(o), ps = DB.payments.filter(p => p.orderId === o.id);
  const jd = UI.justDone && UI.justDone.id === o.id ? UI.justDone.kind : null; UI.justDone = null;
  const msg = {
    ordered: '<b>Заказ оформлен.</b> Баланс клиента пока не изменился. Распечатайте лист погрузки; когда машина загрузится — нажмите «Отгрузить».',
    edited: '<b>Изменения сохранены.</b>',
    shipped: '<b>Заказ отгружен.</b> Сумма списана с баланса клиента — распечатайте накладную клиенту.'
  }[jd];
  const dd = o.status === 'ordered' ? daysSince(o.date) : 0;
  let btns;
  if (o.status === 'ordered') btns = '<button class="btn pri big" data-act="ship-open" data-id="' + o.id + '">Отгрузить</button><a class="btn" href="#/print/l/' + o.id + '">Печать: грузчику</a><a class="btn" href="#/print/c/' + o.id + '">Печать: заказ клиенту</a>' +
    '<button class="btn" data-act="order-edit" data-id="' + o.id + '">Изменить</button><button class="btn danger" data-act="order-cancel" data-id="' + o.id + '">Отменить заказ</button>';
  else if (o.status === 'shipped') btns = '<a class="btn pri" href="#/print/c/' + o.id + '">Печать: клиенту</a><a class="btn pri" href="#/print/l/' + o.id + '">Печать: грузчику</a>' +
    '<button class="btn" data-act="repeat" data-id="' + o.id + '">Повторить в корзину</button><button class="btn danger" data-act="unship" data-id="' + o.id + '">Отменить отгрузку</button>';
  else btns = '<button class="btn pri" data-act="order-restore" data-id="' + o.id + '">Вернуть в работу</button><button class="btn" data-act="repeat" data-id="' + o.id + '">Повторить в корзину</button><button class="btn danger" data-act="order-del" data-id="' + o.id + '">Удалить</button>';
  let calc;
  if (o.status === 'shipped') calc = '<div class="line"><span class="muted">Баланс до отгрузки</span><span>' + balTxt(b.before) + '</span></div>' +
    '<div class="line"><span class="muted">Сумма накладной</span><span>−' + rub(o.total) + '</span></div>' +
    '<div class="line"><span class="muted">Оплачено по заказу</span><span>' + (b.paidNow ? '+' + rub(b.paidNow) : '0 ₽') + '</span></div>' +
    (b.waiting ? '<div class="line"><span class="muted">Ждём от водителя</span><span class="tag w">' + rub(b.waiting) + '</span></div>' : '') +
    '<div class="line tot"><span>Баланс после</span><span class="' + (b.after > 0 ? 'adv' : b.after < 0 ? 'debt' : '') + '">' + balTxt(b.after) + '</span></div>';
  else if (o.status === 'ordered') calc = '<div class="line"><span class="muted">Баланс сейчас</span><span>' + balTxt(balance(o.clientId)) + '</span></div>' +
    '<div class="line"><span class="muted">Сумма заказа</span><span>−' + rub(o.total) + '</span></div>' +
    '<div class="line tot"><span>После отгрузки</span><span class="' + (b.after > 0 ? 'adv' : b.after < 0 ? 'debt' : '') + '">' + balTxt(b.after) + '</span></div>' +
    '<div class="hint">Пока заказ не отгружен, баланс клиента не меняется.</div>';
  else calc = '<div class="hint">Заказ отменён и на баланс не влияет. Предоплата по нему (если была) осталась у клиента авансом.</div>';
  return (msg ? '<div class="warn" style="background:var(--adv-bg);color:var(--adv-ink)"><span>' + msg + '</span></div>' : '') +
    '<div class="head"><div><div class="crumb"><a href="#/sales">Продажи</a> / ' + (o.status === 'shipped' ? 'Накладная' : 'Заказ') + '</div>' +
    '<h1>' + (o.status === 'shipped' ? 'Накладная' : 'Заказ') + ' № ' + o.no + ' <span style="vertical-align:middle">' + statusTag(o) + '</span></h1>' +
    '<div style="margin-top:6px">Клиент: <a href="#/client/' + c.id + '"><b>' + esc(c.name) + '</b></a> · оформлен ' + ru(o.date) + (o.shipDate ? ' · отгружен ' + ru(o.shipDate) : '') +
    (dd > LATE_DAYS ? ' <span class="tag d">не забирают ' + dd + ' дн.</span>' : '') + '</div></div>' +
    '<div class="btns">' + btns + '</div></div>' +
    '<div class="row"><div class="card grow">' + groupsTable(o) + '<div class="line tot" style="font-size:20px"><span>Итого</span><span>' + rub(o.total) + '</span></div></div>' +
    '<div class="aside"><div class="card"><h2>Расчёты</h2>' + calc + '<div class="hint" style="margin-top:8px">Баланс клиента сейчас: ' + balTxt(balance(o.clientId)) + '</div></div>' +
    (ps.length ? '<div class="card"><h2>Оплаты по заказу</h2>' + ps.map(p => '<div class="line"><span>' + ru(payDate(p)) + ' · ' + METHOD[p.method] + (p.atShip ? '' : ' <span class="muted">· предоплата</span>') + '</span><span class="tag ' + (p.status === 'pending' ? 'w' : 'a') + '">' + (p.status === 'pending' ? 'ждём ' : '') + rub(p.amount) + '</span></div>').join('') + '</div>' : '') +
    '</div></div>';
};

/* окно отгрузки */
function shipAfter() { const s = UI.ship, o = order(s.id); return balance(o.clientId) - o.total + (s.pay === 'none' || s.pay === 'driver' ? 0 : num(s.amount)); }
function shipForm() {
  const s = UI.ship, o = order(s.id), c = client(o.clientId) || { name: '—' };
  modal('<h2 style="margin:0">Отгрузка заказа № ' + o.no + '</h2><div class="hint" style="font-size:13px">Клиент <b>' + esc(c.name) + '</b> · сумма <b>' + rub(o.total) + '</b>. После отгрузки сумма спишется с баланса клиента.</div>' +
    '<label class="fld">Дата отгрузки<input class="inp" type="date" id="s-date" value="' + s.date + '"></label>' +
    '<div class="fld">Оплата при отгрузке</div><div class="opt">' + [['none', 'Без оплаты'], ['cash', 'Наличные'], ['transfer', 'Перевод'], ['driver', 'Передаст водитель']].map(([k, l]) =>
      '<button class="chip' + (s.pay === k ? ' on' : '') + '" data-act="ship-pay" data-v="' + k + '">' + l + '</button>').join('') + '</div>' +
    (s.pay === 'none' ? '' : '<label class="fld">Сумма, ₽<input class="inp" id="s-amount" data-in="ship-amt" value="' + esc(s.amount) + '" placeholder="' + fmt(o.total) + '"></label>' +
      (s.pay === 'driver' ? '<div class="hint">Сумма попадёт в «Деньги у водителей» и зачтётся, когда отметите «Получено».</div>' : '')) +
    '<div><div class="line"><span class="muted">Баланс сейчас</span><span>' + balTxt(balance(o.clientId)) + '</span></div><div class="line tot"><span>После отгрузки</span><span id="s-after">' + balTxt(shipAfter()) + '</span></div></div>' +
    '<div class="btns" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="ship-do">Отгрузить</button></div>');
}
function readShip() { if ($('#s-date')) UI.ship.date = $('#s-date').value; if ($('#s-amount')) UI.ship.amount = $('#s-amount').value; }

/* ================= ПЕЧАТЬ ================= */
