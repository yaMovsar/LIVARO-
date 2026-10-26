/* LIVARO онлайн: подготовка данных ДО запуска программы.
   Сервер вставляет в страницу window.LIVARO_BOOT = {rev, docs, user}; здесь из записей собирается обычная база программы
   и кладётся в localStorage — программа (app.js) читает её как всегда. Корзина заказа остаётся своей у каждого браузера. */
(function () {
  'use strict';
  var B = window.LIVARO_BOOT, KEY = 'livaro_db_v1';
  if (!B) return;
  var old = null;
  try { old = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { old = null; }
  var cart = old && old.cart;
  if (!B.docs.length) { // база на сервере пустая — программа создаст новую с каталогом из 1С, online.js отправит её на сервер
    try { localStorage.removeItem(KEY); } catch (e) { /* нет доступа к localStorage */ }
    return;
  }
  var db = { v: 1, clients: [], orders: [], payments: [], templates: [], trash: [], installments: [], stockMoves: [], nextNo: 1, instNo: 1, notice: '' };
  B.docs.forEach(function (d) {
    if (d.data == null) return;
    if (d.coll === 'meta') {
      if (d.id === 'cat') db.cat = d.data;
      else if (d.id === 'settings') db.settings = d.data;
      else if (d.id === 'counters') { db.nextNo = d.data.nextNo || 1; db.instNo = d.data.instNo || 1; }
    } else if (db[d.coll]) db[d.coll].push(d.data);
  });
  var byTime = function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); };
  ['clients', 'orders', 'payments', 'installments', 'stockMoves'].forEach(function (c) { db[c].sort(byTime); });
  db.trash.sort(function (a, b) { return (b.deletedAt || 0) - (a.deletedAt || 0); }); // свежие удалённые сверху
  if (!db.cat) db.cat = JSON.parse(JSON.stringify(window.CAT_1C || []));
  db.cart = cart || { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 };
  db.lastBackup = Date.now(); // данные хранит сервер — напоминание «сделайте копию» не нужно
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* переполнено — программа покажет ошибку сохранения */ }
})();
