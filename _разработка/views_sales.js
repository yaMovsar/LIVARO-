VIEWS.sales = () => {
  const q = UI.salesQ.toLowerCase(), sf = UI.salesStatus || 'all', pf = UI.salesPay || 'all', PM = payMap(), sel = UI.salesSel || (UI.salesSel = {});
  const list = DB.orders.filter(o => (o.status === 'ordered' || inRange(o.shipDate || o.date, UI.salesRange)) && (sf === 'all' || o.status === sf) &&
    (pf === 'all' || (pf === 'unpaid' && o.status === 'shipped' && remaining(o, PM[o.id]) > 0) || (pf === 'paid' && o.status === 'shipped' && !remaining(o, PM[o.id]))) &&
    (!q || String(o.no) === q || ((client(o.clientId) || {}).name || '').toLowerCase().includes(q)))
    .sort((a, b) => (a.status === 'ordered' ? 0 : 1) - (b.status === 'ordered' ? 0 : 1) || (b.shipDate || b.date).localeCompare(a.shipDate || a.date) || b.no - a.no);
  Object.keys(sel).forEach(id => { if (!order(id)) delete sel[id]; });
  const chosen = Object.keys(sel).map(order), payable = chosen.filter(o => o.status !== 'cancelled' && remaining(o, PM[o.id]) > 0);
  const allOn = list.length && list.every(o => sel[o.id]);
  const sh = list.filter(o => o.status === 'shipped'), wt = list.filter(o => o.status === 'ordered');
  const sum = sh.reduce((s, o) => s + o.total, 0), debtSum = sh.reduce((s, o) => s + remaining(o, PM[o.id]), 0);
  const nWait = waitingOrders().length;
  return '<div class="head"><div><h1>Продажи</h1><div class="sub-h">Заказы и накладные. Отметьте строки галочками, чтобы оплатить или удалить несколько сразу.</div></div><a class="btn pri" href="#/order">Оформить заказ</a></div>' +
    '<div class="card"><div class="filters">' +
    '<div class="fgroup"><span>Период</span>' + rangeButton(UI.salesRange, 'range-open') + '</div>' +
    '<div class="fgroup"><span>Статус</span>' + seg(sf, 'sales-status', [['all', 'Все'], ['ordered', 'Ждут отгрузки', nWait], ['shipped', 'Отгружены'], ['cancelled', 'Отменены']]) + '</div>' +
    '<div class="fgroup"><span>Оплата</span>' + seg(pf, 'sales-pay', [['all', 'Любая'], ['unpaid', 'Не оплачены'], ['paid', 'Оплачены']]) + '</div>' +
    '<label class="search"><span class="sr" style="position:absolute;left:-9999px">Поиск</span>' + icon('search', 16) + '<input class="inp" data-in="sales-q" id="sales-q" placeholder="Клиент или номер" value="' + esc(UI.salesQ) + '"></label>' +
    '</div></div>' +
    '<div class="kpis">' +
    '<div class="kpi"><div class="l">Отгружено</div><div class="v">' + rub(sum) + '</div><div class="h">' + sh.length + ' ' + plural(sh.length, 'накладная', 'накладные', 'накладных') + '</div></div>' +
    '<div class="kpi"><div class="l">Оплачено</div><div class="v adv">' + rub(sum - debtSum) + '</div><div class="h">по этим накладным</div></div>' +
    '<div class="kpi"><div class="l">Не оплачено</div><div class="v debt">' + rub(debtSum) + '</div><div class="h">' + sh.filter(o => remaining(o, PM[o.id]) > 0).length + ' с долгом</div></div>' +
    '<div class="kpi"><div class="l">Ждут отгрузки</div><div class="v">' + rub(wt.reduce((s, o) => s + o.total, 0)) + '</div><div class="h">' + wt.length + ' ' + plural(wt.length, 'заказ', 'заказа', 'заказов') + '</div></div>' +
    '</div>' +
    '<div class="card tcard">' + (list.length ? '<div class="scroll"><table class="t" style="min-width:860px"><thead><tr>' +
      '<th class="cbcell"><input type="checkbox" class="cb" data-ch="ssel-all"' + (allOn ? ' checked' : '') + ' aria-label="Выбрать все в списке"></th>' +
      '<th>№</th><th>Дата</th><th>Клиент</th><th>Статус</th><th>Оплата</th><th class="num">Сумма</th><th class="num">Остаток</th></tr></thead><tbody>' +
      list.map(o => {
        const m = PM[o.id], dd = o.status === 'ordered' ? daysSince(o.date) : 0, rest = o.status === 'shipped' ? remaining(o, m) : 0;
        return '<tr class="click' + (sel[o.id] ? ' sel' : '') + (o.status === 'cancelled' ? ' dim' : '') + '" data-act="go" data-to="#/sale/' + o.id + '">' +
          '<td class="cbcell"><input type="checkbox" class="cb" data-ch="ssel" data-id="' + o.id + '"' + (sel[o.id] ? ' checked' : '') + ' aria-label="Выбрать № ' + o.no + '"></td>' +
          '<td class="c-no">' + o.no + '</td><td>' + ru(o.shipDate || o.date) + '</td><td class="c-client">' + esc((client(o.clientId) || {}).name) + '</td>' +
          '<td>' + statusTag(o) + (dd > LATE_DAYS ? ' ' + st('unpaid', dd + ' дн.') : '') + '</td><td>' + payLabel(o, m) + '</td>' +
          '<td class="num amount"' + (o.status === 'cancelled' ? ' style="text-decoration:line-through"' : '') + '>' + rub(o.total) + '</td>' +
          '<td class="num">' + (rest ? '<span class="rest">' + rub(rest) + '</span>' : '<span class="muted">—</span>') + '</td></tr>';
      }).join('') + '</tbody><tfoot><tr><td></td><td colspan="5">Итого отгружено за период</td><td class="num">' + rub(sum) + '</td><td class="num">' + (debtSum ? '<span class="rest">' + rub(debtSum) + '</span>' : '—') + '</td></tr></tfoot></table></div>'
      : '<div class="empty">Заказов по этим условиям нет</div>') + '</div>' +
    (chosen.length ? '<div class="bulkbar" role="region" aria-label="Действия с выбранными"><span>Выбрано <b>' + chosen.length + '</b>' +
      (payable.length ? ' · к оплате <b>' + rub(payable.reduce((s, o) => s + remaining(o, PM[o.id]), 0)) + '</b>' : '') + '</span>' +
      '<button class="btn sm" data-act="sel-clear">Снять</button>' +
      '<button class="btn sm pri" data-act="bulk-open"' + (payable.length ? '' : ' disabled') + '>Отметить оплаченными</button>' +
      '<button class="btn sm danger" data-act="bulk-del">Удалить</button></div>' : '');
};

/* окно «Отметить оплаченными» — для одной или нескольких накладных */
function bulkForm() {
  const B = UI.bulk, PM = payMap(), orders = B.ids.map(order).filter(Boolean).sort((a, b) => (a.shipDate || a.date).localeCompare(b.shipDate || b.date) || a.no - b.no);
  const clients = [...new Set(orders.map(o => o.clientId))], need = orders.reduce((s, o) => s + remaining(o, PM[o.id]), 0), one = clients.length === 1;
  const amt = one && B.amount !== '' ? num(B.amount) : need;
  modal('<h2 style="margin:0">Оплата накладных</h2>' +
    '<div style="max-height:220px;overflow:auto">' + orders.map(o => '<div class="line"><span>№ ' + o.no + ' от ' + ru(o.shipDate || o.date) + (one ? '' : ' · ' + esc((client(o.clientId) || {}).name)) + '</span><b>' + rub(remaining(o, PM[o.id])) + '</b></div>').join('') + '</div>' +
    '<div class="line tot"><span>К оплате</span><span>' + rub(need) + '</span></div>' +
    '<div class="fld">Как оплатили</div>' + seg(B.method, 'bulk-method', [['transfer', 'Перевод'], ['cash', 'Наличные'], ['driver', 'Через водителя']]) +
    '<div class="form"><label class="fld">Дата оплаты<input class="inp" type="date" id="b-date" value="' + B.date + '"></label>' +
    (one ? '<label class="fld">Сумма, ₽<input class="inp" id="b-amount" data-in="bulk-amt" value="' + (B.amount === '' ? fmt(need) : esc(B.amount)) + '"></label>' : '') + '</div>' +
    '<div class="hint" id="b-hint">' + bulkHint(amt, need, one) + (B.method === 'driver' ? ' Деньги попадут в «Деньги у водителей».' : '') + '</div>' +
    '<div class="btns" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="bulk-save">Отметить оплаченными</button></div>');
}
function bulkHint(amt, need, one) {
  if (!one) return 'Для каждого клиента будет записана отдельная оплата на сумму его накладных.';
  if (amt > need) return 'Сумма больше долга по накладным — остаток ' + rub(amt - need) + ' зачтётся клиенту авансом.';
  if (amt < need) return 'Сумма меньше — накладные закроются от старых к новым, последняя будет оплачена частично.';
  return 'Все выбранные накладные будут отмечены оплаченными.';
}
function readBulk() { if ($('#b-date')) UI.bulk.date = $('#b-date').value; if ($('#b-amount')) UI.bulk.amount = $('#b-amount').value; }

/* ================= УДАЛЁННЫЕ: всё, что удаляется, с восстановлением ================= */
const TRASH_KINDS = [['order', 'Заказы'], ['client', 'Клиенты'], ['payment', 'Оплаты'], ['item', 'Товары'], ['folder', 'Папки'], ['template', 'Шаблоны']];
const kindOf = t => t.kind || 'order';
function trashPush(kind, data, label, extra) {
  const t = Object.assign({ id: uid(), kind, data, label, deletedAt: Date.now() }, extra || {});
  DB.trash.unshift(t); return t;
}
/* путь папки по названиям — чтобы вернуть товар/папку на место, даже если номера папок изменились */
function pathOf(node) {
  const names = []; let id = node.id;
  while (id !== undefined && id !== '') { names.unshift(NODES[id].n); const k = id.lastIndexOf('-'); id = k < 0 ? '' : id.slice(0, k); }
  return names;
}
function folderByPath(path) {
  let list = DB.cat, node = null;
  path.forEach(name => {
    node = list.find(x => x.n === name);
    if (!node) { node = { n: name, ch: [], it: [] }; list.push(node); }
    list = node.ch;
  });
  return node;
}
function trashOrders(ids) {
  const items = [];
  ids.forEach(id => {
    const o = order(id); if (!o) return;
    const own = DB.payments.filter(p => p.orderId === o.id), allocs = [];
    DB.payments.forEach(p => {
      if (!p.alloc) return;
      const a = p.alloc.filter(x => x.orderId === o.id);
      if (a.length) { allocs.push({ pid: p.id, alloc: a }); p.alloc = p.alloc.filter(x => x.orderId !== o.id); }
    });
    DB.payments = DB.payments.filter(p => p.orderId !== o.id);
    DB.orders = DB.orders.filter(x => x !== o);
    if (DB.cart.editId === o.id) delete DB.cart.editId;
    items.push(trashPush('order', null, 'Заказ № ' + o.no, { order: o, payments: own, allocs }));
  });
  return items;
}
function restoreTrash(tids) {
  tids.forEach(tid => {
    const t = DB.trash.find(x => x.id === tid); if (!t) return;
    const k = kindOf(t);
    if (k === 'order') {
      DB.orders.push(t.order); DB.payments.push(...t.payments);
      t.allocs.forEach(a => { const p = DB.payments.find(x => x.id === a.pid); if (p && p.alloc) p.alloc.push(...a.alloc); });
    } else if (k === 'client') DB.clients.push(t.data);
    else if (k === 'payment') DB.payments.push(t.data);
    else if (k === 'template') DB.templates.push(t.data);
    else if (k === 'item') { const f = folderByPath(t.path); if (f) f.it.push(t.data); else DB.cat.push({ n: 'Восстановленные', ch: [], it: [t.data] }); }
    else if (k === 'folder') { if (t.path.length) folderByPath(t.path).ch.push(t.data); else DB.cat.push(t.data); }
    DB.trash = DB.trash.filter(x => x !== t);
  });
}
function undoToast(msg, items) {
  toast(msg, { label: 'Отменить', fn: () => { restoreTrash(items.map(i => i.id)); commit(); toast('Восстановлено'); } });
}
function deleteWithUndo(ids) {
  const items = trashOrders(ids); UI.salesSel = {}; commit();
  undoToast('Удалено: ' + items.length + ' ' + plural(items.length, 'заказ', 'заказа', 'заказов'), items);
}
function trashDetails(t) {
  const k = kindOf(t);
  if (k === 'order') return [t.label, esc((client(t.order.clientId) || {}).name) + ' · ' + STATUS[t.order.status], rub(t.order.total)];
  if (k === 'client') return [esc(t.data.name), esc(t.data.phone || ''), t.data.opening ? balTxt(t.data.opening) + ' на начало' : ''];
  if (k === 'payment') return ['Оплата, ' + METHOD[t.data.method], esc((client(t.data.clientId) || {}).name || '—') + ' · ' + ru(payDate(t.data)), rub(t.data.amount)];
  if (k === 'item') return [esc(t.data[0]), esc(t.path.join(' / ')), t.data[1] === null ? '' : t.data[1] ? rub(t.data[1]) : 'входит'];
  if (k === 'folder') return [esc(t.label), t.path.length ? 'в папке ' + esc(t.path.join(' / ')) : 'верхний уровень', ''];
  return ['Шаблон «' + esc(t.data.t) + '»', t.data.items.length + ' поз.', rub(gsum(t.data))];
}
VIEWS.trash = () => {
  const f = UI.trashKind || 'all', T = DB.trash.filter(t => f === 'all' || kindOf(t) === f);
  const cnt = k => DB.trash.filter(t => kindOf(t) === k).length;
  const opts = [['all', 'Всё', DB.trash.length]].concat(TRASH_KINDS.filter(([k]) => cnt(k)).map(([k, l]) => [k, l, cnt(k)]));
  const nameOf = k => (TRASH_KINDS.find(x => x[0] === k) || [k, k])[1];
  return '<div class="head"><div><h1>Удалённые</h1><div class="sub-h">Всё удалённое хранится здесь, пока вы не удалите навсегда: заказы, клиенты, оплаты, товары, папки, шаблоны. Восстанавливается на прежнее место.</div></div>' +
    (T.length ? '<div class="head-actions"><button class="btn pri" data-act="trash-restore-all">Восстановить ' + (f === 'all' ? 'всё' : 'все: ' + nameOf(f).toLowerCase()) + '</button>' +
      '<button class="btn danger-solid" data-act="trash-empty">Очистить ' + (f === 'all' ? 'всё' : nameOf(f).toLowerCase()) + '</button></div>' : '') + '</div>' +
    (DB.trash.length ? '<div class="card"><div class="fgroup"><span>Категория</span>' + seg(f, 'trash-kind', opts) + '</div></div>' : '') +
    '<div class="card tcard">' + (T.length ? '<div class="scroll"><table class="t" style="min-width:760px"><thead><tr><th>Удалено</th><th>Что</th><th>Подробности</th><th class="num">Сумма</th><th></th></tr></thead><tbody>' +
      T.map(t => { const [a, b, c] = trashDetails(t); return '<tr><td style="white-space:nowrap">' + ru(isoOf(new Date(t.deletedAt))) + '<div class="hint">' + nameOf(kindOf(t)) + '</div></td><td class="c-client">' + a + '</td><td class="muted">' + b + '</td>' +
        '<td class="num amount">' + c + '</td><td class="num"><span class="btns" style="justify-content:flex-end"><button class="btn sm pri" data-act="trash-restore" data-id="' + t.id + '">Восстановить</button>' +
        '<button class="btn sm danger" data-act="trash-kill" data-id="' + t.id + '">Удалить навсегда</button></span></td></tr>'; }).join('') + '</tbody></table></div>'
      : '<div class="empty">Здесь пусто</div>') + '</div>';
};
