/* ================= ПОМОЩНИК: подсказки по составу шкафа ================= */
/* Правила, а не нейросеть: смотрим на группу (шкаф) и предлагаем то, что обычно забывают. */
const asstOn = () => !(DB.settings && DB.settings.asst === false);
/* число дверей из названия корпуса: «6х», «4-х», «6-ти», «3 дверный»; размеры вида 220х180 не считаем */
function doorsFromName(n) {
  const m = n.match(/(?:^|[^\dхx])([1-9])\s*-?\s*(?:х|x|ти)(?![\dа-яё])/i) || n.match(/(?:^|\D)([1-9])\s*(?:-?\s*х)?\s*дверн/i);
  return m ? +m[1] : 0;
}
const isCarcass = it => /корпус|шкаф/i.test(it.n) && !/антресол|двер[ьи]\b/i.test(it.n) && doorsFromName(it.n) > 0;
const isAntresol = it => /антресол/i.test(it.n) && !/двер/i.test(it.n);
const isAntDoor = it => /антресол/i.test(it.n) && /двер/i.test(it.n);
const isDoor = it => !isAntDoor(it) && /двер(?!н)|рамк|зеркал|фасад/i.test(it.n);
const isHandle = it => /ручк/i.test(it.n);
const isCornice = it => /карниз/i.test(it.n);
const colorOf = n => { const m = n.match(colorRe()); return m ? colorKey(m[0]) : ''; };
function catalogFind(test) { for (const id in NODES) for (const it of NODES[id].it) if (test(it[0])) return it; return null; }
/* самые ходовые ручки по проданному; если продаж нет — ручки 30 см из каталога */
function popularHandles() {
  const cnt = {};
  DB.orders.forEach(o => o.groups.forEach(g => g.items.forEach(it => { if (isHandle(it)) cnt[it.n] = (cnt[it.n] || 0) + it.q; })));
  let names = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  if (!names.length) for (const id in NODES) NODES[id].it.forEach(it => { if (/ручк/i.test(it[0]) && /30 см/i.test(it[0]) && !/комплект/i.test(it[0])) names.push(it[0]); });
  return names.slice(0, 3);
}
const doorType = n => { const m = n.match(/(?:двер[ьи]|рамка)\s+(?:с\s+)?([А-ЯЁа-яё]{3,})/i); if (!m) return ''; const w = m[1].toLowerCase(); return w === 'зеркалом' ? '' : w[0].toUpperCase() + w.slice(1); };
function asstFor(G, gi) {
  const out = [], hide = (UI.asstHide || {});
  const add = (key, text, actions, warn) => { if (!hide[gi + ':' + key]) out.push({ key, text, actions: actions || [], warn }); };
  const items = G.items, carc = items.find(isCarcass);
  if (!items.length) return out;
  const N = carc ? doorsFromName(carc.n) : 0, col = carc ? colorOf(carc.n) : '';
  const doors = items.filter(isDoor), nDoors = doors.reduce((s, it) => s + it.q, 0);
  const handles = items.filter(isHandle), nHandles = handles.reduce((s, it) => s + it.q, 0);
  const cornice = items.find(isCornice), ant = items.find(isAntresol), antDoors = items.filter(isAntDoor).reduce((s, it) => s + it.q, 0);
  const A = (label, act, data) => ({ label, act, data });
  if (carc && N) {
    // двери
    if (nDoors < N) {
      const d = doors[0];
      add('doors', 'Корпус на ' + N + ' ' + plural(N, 'дверь', 'двери', 'дверей') + ', а дверей' + (doors.some(x => /зеркал/i.test(x.n)) ? ' с зеркалами' : '') + ' — ' + nDoors + '.',
        d ? [A('Добавить ещё ' + (N - nDoors) + ': ' + d.n, 'as-add', { name: d.n, q: N - nDoors })] : [A('Выберите двери в каталоге справа', '', {})], true);
    } else if (nDoors > N) add('doors+', 'Дверей ' + nDoors + ', а корпус на ' + N + '. Проверьте, не лишние ли.', [], true);
    // карниз
    const want = catalogFind(n => new RegExp('карниз на ' + N + '\\s*дв', 'i').test(n));
    if (!cornice) add('cornice', 'Нет карниза для ' + N + '-дверного шкафа.', want ? [A('Добавить «' + want[0] + '»', 'as-add', { name: want[0], q: 1 })] : [], true);
    else { const cn = (cornice.n.match(/на\s*(\d+)\s*дв/i) || [])[1]; if (cn && +cn !== N) add('cornice-n', 'Карниз на ' + cn + ' дв., а шкаф ' + N + '-дверный.', want ? [A('Заменить на «' + want[0] + '»', 'as-swap', { from: cornice.n, name: want[0] })] : [], true); }
    // ручки — по одной на дверь
    const need = Math.max(N, nDoors);
    if (!handles.length && !items.some(it => /комплект ручек/i.test(it.n))) add('handles', 'Нет ручек — нужно ' + need + ' шт (по одной на дверь).', popularHandles().map(h => A(h + ' ×' + need, 'as-add', { name: h, q: need })), true);
    else if (handles.length === 1 && nHandles !== need) add('handles-n', 'Ручек ' + nHandles + ', а дверей ' + need + '.', [A('Поставить ' + need + ' шт', 'as-setq', { name: handles[0].n, q: need })], true);
    // антресоль и её двери
    if (ant) {
      const an = items.filter(isAntresol).reduce((s, it) => s + doorsFromName(it.n) * it.q, 0); // 2 антресоли «2-х» = на 4 двери
      if (antDoors < (an || N)) {
        const k = (an || N) - antDoors, ad = catalogFind(n => /двер/i.test(n) && /антресол/i.test(n) && (!col || colorOf(n) === col));
        add('antdoors', 'Антресоль без ' + (antDoors ? 'части ' : '') + 'дверей — нужно ещё ' + k + ' шт.', ad ? [A('Добавить «' + ad[0] + '» ×' + k, 'as-add', { name: ad[0], q: k })] : [], true);
      }
      if (an && an !== N && !(N === 3 || N === 5)) add('ant-n', 'Антресоли на ' + an + ' дв., а шкаф ' + N + '-дверный. Проверьте размер.', [], true);
    }
    // разные цвета в одном шкафу
    const cols = [...new Set(items.filter(it => !isHandle(it)).map(it => colorOf(it.n)).filter(Boolean))];
    if (cols.length > 1) add('colors', 'В шкафу разные цвета: ' + cols.join(', ') + '. Так и задумано?', [], true);
    // название шкафа
    if (/^Шкаф \d+$/.test(G.t.trim())) {
      const dt = doors.map(d => doorType(d.n)).find(Boolean) || '', name = 'Шкаф ' + (dt ? dt + ' ' : '') + N + 'х' + (col ? ', ' + col : '') + (ant ? ', с антресолью' : '');
      add('title', 'Назвать шкаф понятно для накладной.', [A('«' + name + '»', 'as-ren', { name })]);
    }
  }
  return out;
}
function asstHtml(G, gi) {
  if (!asstOn()) return '';
  const tips = asstFor(G, gi); if (!tips.length) return '';
  return '<div class="asst">' + tips.map(t => '<div class="asst-row"><span class="asst-ico" aria-hidden="true">✦</span><span class="asst-text">' + esc(t.text) + '</span><span class="btns" style="gap:6px">' +
    t.actions.filter(a => a.act).map(a => '<button class="btn sm" data-act="' + a.act + '" data-g="' + gi + '"' + Object.keys(a.data).map(k => ' data-' + k + '="' + esc(a.data[k]) + '"').join('') + '>' + esc(a.label) + '</button>').join('') +
    '<button class="x" style="width:28px;height:28px;font-size:15px;color:var(--muted)" data-act="as-hide" data-g="' + gi + '" data-key="' + t.key + '" title="Скрыть подсказку" aria-label="Скрыть подсказку">×</button></span></div>').join('') + '</div>';
}
Object.assign(ACT, {
  'as-add': el => {
    const G = DB.cart.groups[+el.dataset.g], name = el.dataset.name, q = +el.dataset.q, f = findItem(name), ex = G.items.find(x => x.n === name);
    if (ex) ex.q += q; else G.items.push({ n: name, q, p: (f && f.it[1]) || 0 });
    commit(); toast('Добавлено: ' + name + ' ×' + q);
  },
  'as-setq': el => { const it = DB.cart.groups[+el.dataset.g].items.find(x => x.n === el.dataset.name); if (it) it.q = +el.dataset.q; commit(); },
  'as-swap': el => { const it = DB.cart.groups[+el.dataset.g].items.find(x => x.n === el.dataset.from), f = findItem(el.dataset.name); if (it) { it.n = el.dataset.name; it.p = (f && f.it[1]) || 0; } commit(); },
  'as-ren': el => { DB.cart.groups[+el.dataset.g].t = el.dataset.name; commit(); },
  'as-hide': el => { UI.asstHide = UI.asstHide || {}; UI.asstHide[el.dataset.g + ':' + el.dataset.key] = true; render(); },
  'as-toggle': () => { DB.settings = Object.assign({}, DB.settings, { asst: !asstOn() }); commit(); }
});

