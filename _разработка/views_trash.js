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
