/* LIVARO онлайн: синхронизация с сервером. Подключается ПОСЛЕ app.js (только в онлайн-версии).
   — после каждого сохранения отправляет на сервер только изменённые записи (с версией, которую видел сотрудник);
   — каждые несколько секунд забирает правки коллег и перерисовывает экран (если сотрудник ничего не вводит);
   — если запись одновременно изменили двое, правка не затирается: показываем актуальную и предупреждаем. */
(function () {
  'use strict';
  var B = window.LIVARO_BOOT;
  if (!B) return;
  var COLLS = ['clients', 'orders', 'payments', 'templates', 'trash', 'installments', 'stockMoves'];
  var SEP = '\u0001', K = function (c, i) { return c + SEP + i; };
  var base = new Map(), ver = new Map(), rev = B.rev, busy = false, dirty = false, timer = null, needRender = false, state = 'ok', lastErr = '';

  /* одинаковая запись JSON независимо от порядка полей (сервер хранит поля в своём порядке) */
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  B.docs.forEach(function (d) { var k = K(d.coll, d.id); ver.set(k, d.version); if (d.data != null) base.set(k, stable(d.data)); });

  /* все записи программы сейчас */
  function current() {
    var m = new Map();
    COLLS.forEach(function (c) {
      (DB[c] || []).forEach(function (x) { if (!x || typeof x !== 'object') return; if (!x.id) x.id = uid(); m.set(K(c, x.id), x); });
    });
    m.set(K('meta', 'cat'), DB.cat || []);
    m.set(K('meta', 'settings'), DB.settings || {});
    m.set(K('meta', 'counters'), { nextNo: DB.nextNo || 1, instNo: DB.instNo || 1 });
    return m;
  }

  function api(url, data) {
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 30000);
    return fetch(url, data ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LIVARO': '1' }, body: JSON.stringify(data), signal: ctl.signal, credentials: 'same-origin' }
      : { signal: ctl.signal, credentials: 'same-origin' }).then(function (r) {
      clearTimeout(t);
      if (r.status === 401) { location.href = '/login.html'; throw new Error('Нужно войти заново'); }
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Ошибка сервера'); return d; });
    }, function (e) { clearTimeout(t); throw e; });
  }

  /* правка с сервера → в базу программы */
  function applyOne(d) {
    if (d.coll === 'meta') {
      if (d.data == null) return;
      if (d.id === 'cat') DB.cat = d.data;
      else if (d.id === 'settings') DB.settings = d.data;
      else if (d.id === 'counters') { DB.nextNo = d.data.nextNo; DB.instNo = d.data.instNo; }
      return;
    }
    var arr = DB[d.coll] || (DB[d.coll] = []), i = -1;
    for (var j = 0; j < arr.length; j++) if (arr[j] && arr[j].id === d.id) { i = j; break; }
    if (d.data == null) { if (i >= 0) arr.splice(i, 1); }
    else if (i >= 0) arr[i] = d.data;
    else if (d.coll === 'trash') arr.unshift(d.data);
    else arr.push(d.data);
  }
  function applyRemote(list) {
    var touched = false;
    list.forEach(function (d) {
      var k = K(d.coll, d.id);
      if ((ver.get(k) || 0) >= d.version) return; // это уже есть (в том числе наша собственная правка)
      ver.set(k, d.version);
      if (d.data == null) base.delete(k); else base.set(k, stable(d.data));
      applyOne(d); touched = true;
    });
    if (touched) { origSave(); needRender = true; }
    return touched;
  }

  /* два сотрудника одновременно взяли один номер заказа (или рассрочки). Номер меняет тот, кто создал документ позже,
     — и только у себя: «свои» новые документы этой вкладки помнятся в mine. */
  var mine = {};
  function fixNumbers() {
    var msgs = [];
    [['orders', 'nextNo', 'Заказ № '], ['installments', 'instNo', 'Рассрочка Р-']].forEach(function (x) {
      var arr = DB[x[0]] || [], first = function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0) || (a.id < b.id ? -1 : 1); };
      arr.forEach(function (o) {
        if (!mine[K(x[0], o.id)]) return;
        var dups = arr.filter(function (y) { return y.no === o.no; });
        if (dups.length < 2 || dups.sort(first)[0] === o) return; // мой документ создан раньше — номер остаётся у меня
        var max = arr.reduce(function (m, y) { return Math.max(m, +y.no || 0); }, 0);
        DB[x[1]] = Math.max(DB[x[1]] || 1, max + 1);
        msgs.push(x[2] + o.no + ' → ' + DB[x[1]]);
        o.no = DB[x[1]]++;
      });
    });
    if (msgs.length) {
      origSave(); needRender = true; dirty = true;
      toast('Номер уже занял другой сотрудник, присвоен новый: ' + msgs.join(', ') + '. Если документ уже распечатан — распечатайте заново.', null, 12000);
    }
    return msgs;
  }

  /* отправить свои изменения */
  function push() {
    if (busy) { dirty = true; return Promise.resolve(); }
    var cur = current(), sent = new Map(), changes = [];
    cur.forEach(function (v, k) { var s = stable(v); if (base.get(k) !== s) { sent.set(k, s); changes.push([k, v]); } });
    base.forEach(function (s, k) { if (!cur.has(k)) { sent.set(k, null); changes.push([k, null]); } });
    dirty = false;
    if (!changes.length) return Promise.resolve();
    busy = true; setState('saving');
    var body = changes.map(function (c) { var p = c[0].split(SEP); if (!ver.get(c[0]) && c[1]) mine[c[0]] = 1; return { coll: p[0], id: p[1], data: c[1], base: ver.get(c[0]) || 0 }; });
    return api('/api/sync', { changes: body }).then(function (r) {
      r.applied.forEach(function (a) { var k = K(a.coll, a.id), s = sent.get(k); ver.set(k, a.version); if (s == null) base.delete(k); else base.set(k, s); });
      busy = false;
      if (r.conflicts.length) {
        r.conflicts.forEach(function (c) { var k = K(c.coll, c.id); ver.set(k, c.version); if (c.data == null) base.delete(k); else base.set(k, stable(c.data)); applyOne(c); });
        origSave(); needRender = true; dirty = true;
        if (!fixNumbers().length) toast('Эти данные только что изменил другой сотрудник — показаны его изменения. Проверьте и при необходимости повторите.', null, 9000);
      }
      setState('ok');
      fixNumbers();
      if (dirty) schedule(300);
    }, function (e) {
      busy = false; dirty = true; lastErr = e.message || ''; setState('offline'); schedule(8000);
    });
  }
  /* забрать правки коллег */
  function pull() {
    if (busy) return Promise.resolve();
    return api('/api/changes?since=' + rev).then(function (r) {
      if (busy) return; // пока ждали ответа, ушли свои правки — заберём в следующий раз
      if (applyRemote(r.changes)) fixNumbers();
      rev = r.rev;
      if (state === 'offline') setState('ok');
      if (r.more) return pull();
    }, function (e) { lastErr = e.message || ''; setState('offline'); });
  }
  function tick() { return push().then(pull).then(maybeRender); }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(tick, ms == null ? 500 : ms); }

  /* перерисовать экран, только если сотрудник сейчас ничего не вводит */
  function idle() {
    var a = document.activeElement, m = document.getElementById('modal');
    return !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) && !(m && m.innerHTML.trim());
  }
  function maybeRender() { if (needRender && idle()) { needRender = false; render(); } else if (needRender) setState(state); }

  /* ---------- встраивание в программу ---------- */
  var origSave = window.save, origRender = window.render;
  window.save = function () { origSave(); dirty = true; schedule(); };
  window.render = function () { origRender(); userBox(); };

  var ROLE = { admin: 'руководитель', accountant: 'бухгалтер', manager: 'менеджер', storekeeper: 'склад' };
  function setState(s) { state = s; var el = document.getElementById('on-state'); if (el) el.outerHTML = stateHtml(); }
  function stateHtml() {
    var t = state === 'saving' ? ['сохраняю…', '#B07A00'] : state === 'offline' ? ['нет связи — изменения отправятся сами', '#B3261E'] : needRender ? ['есть обновления — появятся, когда закончите ввод', '#1F4FB5'] : ['всё сохранено на сервере', '#1E7A46'];
    return '<div id="on-state" style="display:flex;gap:6px;align-items:center;font-size:12px;color:var(--muted)" title="' + (state === 'offline' ? lastErr.replace(/"/g, '') : '') + '"><span style="width:8px;height:8px;border-radius:50%;background:' + t[1] + ';flex:none"></span>' + t[0] + '</div>';
  }
  function userBox() {
    var side = document.getElementById('side'); if (!side) return;
    var old = document.getElementById('on-user'); if (old) old.remove();
    side.querySelectorAll('.bk').forEach(function (b) { b.style.display = 'none'; }); // копии в папку не нужны — данные хранит сервер
    var u = B.user || {}, div = document.createElement('div');
    div.id = 'on-user'; div.className = 'noprint';
    div.style.cssText = 'margin-top:12px;padding:12px 4px 0;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:6px;font-size:13px';
    div.innerHTML = '<div><b>' + esc(u.name || u.login) + '</b>' + (String(u.name || '').toLowerCase() === (ROLE[u.role] || '') ? '' : ' <span style="color:var(--muted)">· ' + esc(ROLE[u.role] || u.role || '') + '</span>') + '</div>' + stateHtml() +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + (u.role === 'admin' ? '<a class="btn sm" href="/admin.html">Сотрудники и журнал</a>' : '') + '<button class="btn sm" id="on-logout">Выйти</button></div>';
    side.appendChild(div);
  }
  document.addEventListener('click', function (e) {
    if (!e.target || e.target.id !== 'on-logout') return;
    push().then(function () { return api('/api/logout', {}); }).then(function () { location.href = '/login.html'; }, function () { location.href = '/login.html'; });
  });
  window.addEventListener('beforeunload', function (e) {
    var unsent = busy || dirty || (function () { var cur = current(), d = false; cur.forEach(function (v, k) { if (!d && base.get(k) !== stable(v)) d = true; }); return d; })();
    if (unsent) { push(); e.preventDefault(); e.returnValue = 'Изменения ещё отправляются на сервер'; }
  });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') schedule(0); });
  document.addEventListener('focusout', function () { setTimeout(maybeRender, 50); });
  window.LIVARO_SYNC = { push: push, pull: pull, tick: tick, state: function () { return state; } }; // для проверок

  userBox();
  schedule(300); // первые изменения (новая база, недостающие поля) — сразу на сервер
  setInterval(function () { if (!busy) tick(); }, 8000);
})();
