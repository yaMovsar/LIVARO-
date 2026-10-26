/* ================= ИНВЕНТАРИЗАЦИЯ СПИСКОМ ================= */
/* Все товары каталога одной таблицей: вписываете «Факт» (руками, из бланка, из Excel или из остатков 1С) и сохраняете разом.
   Каждая заполненная строка = поправка остатка (инвентаризация) и постановка товара на учёт. */
function invRows() {
  const f = UI.invF || '', q = (UI.invQ || '').toLowerCase(), out = [];
  allFolders(DB.cat).forEach(({ n, depth }) => {
    if (f && !(n.id === f || n.id.indexOf(f + '-') === 0)) return;
    orderIdx(n).forEach(i => { const name = n.it[i][0]; if (!q || name.toLowerCase().includes(q)) out.push({ name, folder: n }); });
  });
  return out;
}
VIEWS.inv = () => {
  const M = stockMap(), rows = invRows(), V = UI.inv || (UI.inv = {});
  const filled = Object.keys(V).filter(k => V[k] !== '').length;
  let lastFolder = null, body = '';
  rows.forEach((r, idx) => {
    if (r.folder !== lastFolder) { lastFolder = r.folder; body += '<tr class="inv-f"><td colspan="3">' + esc(folderPath(r.folder)) + '</td></tr>'; }
    const s = M[r.name], have = s && s.tracked ? s.have : null, v = V[r.name] !== undefined ? V[r.name] : '';
    body += '<tr' + (v !== '' ? ' class="sel"' : '') + '><td>' + esc(r.name) + '</td><td class="num muted">' + (have === null ? 'не на учёте' : have) + '</td>' +
      '<td class="num" style="width:130px"><input class="inp pin inv-in" style="width:100px" data-ch="inv-v" data-name="' + esc(r.name) + '" data-idx="' + idx + '" value="' + esc(v) + '" inputmode="numeric" aria-label="Факт"></td></tr>';
  });
  const tops = DB.cat.map((n, i) => [String(i), n.n]);
  return '<div class="head"><div><div class="crumb"><a href="#/stock">Склад</a> / Инвентаризация</div><h1>Инвентаризация списком</h1>' +
    '<div class="sub-h">Впишите фактическое количество (Enter — к следующей строке). Пустые строки не трогаются. Сохраняется по кнопке.</div></div>' +
    '<div class="btns"><button class="btn" data-act="inv-xls">Скачать в Excel</button><label class="btn">Загрузить Excel / остатки 1С<input type="file" accept=".xlsx,.xls,.csv" data-ch="inv-load" style="display:none"></label>' +
    '<a class="btn" href="#/invprint">Печать бланка' + (UI.invF && NODES[UI.invF] ? ': ' + esc(NODES[UI.invF].n) : ' (все)') + '</a><button class="btn pri big" data-act="inv-save"' + (filled ? '' : ' disabled') + '>Сохранить (' + filled + ')</button></div></div>' +
    (UI.invMsg ? '<div class="warn" style="background:var(--accent-bg);color:var(--accent-ink)"><span>' + UI.invMsg + '</span><button class="btn sm" data-act="inv-msg-x">Понятно</button></div>' : '') +
    '<div class="card"><div class="filters"><div class="fgroup"><span>Папка</span><select class="inp" style="min-height:36px" data-ch="inv-f"><option value="">Все товары</option>' +
    allFolders(DB.cat).map(({ n, depth }) => '<option value="' + n.id + '"' + (UI.invF === n.id ? ' selected' : '') + '>' + '   '.repeat(depth) + esc(n.n) + '</option>').join('') + '</select></div>' +
    '<label class="search">' + icon('search', 16) + '<input class="inp" id="inv-q" data-in="inv-q" placeholder="Найти товар" value="' + esc(UI.invQ || '') + '"></label>' +
    (filled ? '<button class="btn sm" data-act="inv-clear">Очистить введённое</button>' : '') + '</div></div>' +
    '<div class="card tcard"><table class="t"><thead><tr><th>Товар · ' + rows.length + '</th><th class="num">По программе</th><th class="num">Факт</th></tr></thead><tbody>' + body + '</tbody></table></div>';
};
/* бланк для обхода склада: товары по папкам и пустая графа «Факт» */
VIEWS.invprint = () => {
  let rows = '', no = 0;
  const f = UI.invF || '', fn = f && NODES[f] ? folderPath(NODES[f]) : '';
  allFolders(DB.cat).forEach(({ n }) => {
    if (!n.it.length || (f && !(n.id === f || n.id.indexOf(f + '-') === 0))) return; // только выбранная папка и её подпапки
    rows += '<tr class="g"><td colspan="4">' + esc(folderPath(n)) + '</td></tr>';
    orderIdx(n).forEach(i => { rows += '<tr><td>' + (++no) + '</td><td>' + esc(n.it[i][0]) + '</td><td></td><td></td></tr>'; });
  });
  return '<div class="btns noprint" style="justify-content:center"><a class="btn" href="#/inv">← К инвентаризации</a><button class="btn pri" data-act="print">Распечатать</button></div>' +
    '<style>@media print{@page{size:A4;margin:12mm 10mm 12mm 12mm}}</style>' + // поля на каждом листе
    '<div class="paperwrap"><div class="paper inv-paper"><div class="p-head"><div class="brand">LIVARO</div><div style="text-align:right;font-size:15px"><b>Инвентаризация склада</b> от ____________' + (fn ? '<div style="font-size:13px;margin-top:2px">Папка: ' + esc(fn) + '</div>' : '') + '</div></div>' +
    '<table class="p-t"><thead><tr><th style="width:30px">№</th><th>Товар</th><th style="width:22mm">Факт, шт</th><th style="width:30mm">Примечание</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div style="font-size:12px;margin-top:6px">Всего позиций: ' + no + '</div>' +
    '<div class="sign" style="grid-template-columns:1fr 1fr"><div class="s"><b>Пересчитал</b><div>подпись / расшифровка</div></div><div class="s"><b>Проверил</b><div>подпись / расшифровка</div></div></div></div></div>';
};
/* загрузка таблицы: ищем колонку с названием и колонку «Факт/Остаток/Количество», сопоставляем с каталогом по названию */
function invImport(rows) {
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
  const h = rows.findIndex(r => r.some(x => /наименован|товар/i.test(String(x))) && r.some(x => /факт|остаток|количеств|кол-во/i.test(String(x))));
  if (h < 0) return null;
  const nc = rows[h].findIndex(x => /наименован|товар/i.test(String(x)));
  const qc = (() => { const f = rows[h].findIndex(x => /факт/i.test(String(x))); return f >= 0 ? f : rows[h].findIndex(x => /остаток|количеств|кол-во/i.test(String(x))); })();
  const byName = {}; for (const id in NODES) NODES[id].it.forEach(it => { byName[norm(it[0])] = it[0]; });
  let ok = 0; const miss = [];
  rows.slice(h + 1).forEach(r => {
    const nm = norm(r[nc]), raw = r[qc]; if (!nm || raw === '' || raw == null) return;
    const qty = Math.round(typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/\s/g, '').replace(',', '.')) || 0);
    if (byName[nm]) { UI.inv[byName[nm]] = String(qty); ok++; } else miss.push(String(r[nc]).trim());
  });
  return { ok, miss };
}
Object.assign(ACT, {
  'inv-save': () => {
    const V = UI.inv || {}, M = stockMap(), d = todayISO(); let n = 0;
    Object.keys(V).forEach(name => {
      if (V[name] === '') return;
      const fact = num(V[name]), s = M[name], have = s && s.tracked ? s.have : 0;
      DB.stockMoves.push({ id: uid(), date: d, name, q: fact - have, kind: 'adj', note: 'инвентаризация', createdAt: Date.now() + n });
      n++;
    });
    UI.inv = {}; UI.invMsg = ''; save(); go('#/stock'); toast('Инвентаризация сохранена: ' + n + ' ' + plural(n, 'позиция', 'позиции', 'позиций'), null, 5000);
  },
  'inv-clear': () => { if (confirm('Очистить все введённые цифры?')) { UI.inv = {}; render(); } },
  'inv-msg-x': () => { UI.invMsg = ''; render(); },
  'inv-xls': () => {
    if (typeof XLSX === 'undefined') return toast('Не загрузилась библиотека Excel');
    const M = stockMap(), aoa = [['Папка', 'Товар', 'По программе', 'Факт']];
    allFolders(DB.cat).forEach(({ n }) => orderIdx(n).forEach(i => { const name = n.it[i][0], s = M[name]; aoa.push([folderPath(n), name, s && s.tracked ? s.have : '', '']); }));
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 34 }, { wch: 70 }, { wch: 14 }, { wch: 10 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Инвентаризация');
    XLSX.writeFile(wb, 'LIVARO инвентаризация ' + todayISO() + '.xlsx');
    toast('Файл скачан в «Загрузки». Заполните колонку «Факт» и загрузите обратно.', null, 6000);
  }
});
Object.assign(CH, {
  'inv-v': el => { UI.inv[el.dataset.name] = el.value.trim(); el.closest('tr').classList.toggle('sel', el.value.trim() !== ''); const b = $('[data-act="inv-save"]'); const n = Object.keys(UI.inv).filter(k => UI.inv[k] !== '').length; if (b) { b.disabled = !n; b.textContent = 'Сохранить (' + n + ')'; } },
  'inv-f': el => { UI.invF = el.value; render(); },
  'inv-load': el => {
    const f = el.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const wb = XLSX.read(new Uint8Array(r.result), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
        UI.inv = UI.inv || {}; const res = invImport(rows);
        if (!res) { toast('Не нашёл колонки «Наименование/Товар» и «Факт/Остаток». Проверьте файл.', null, 6000); return; }
        UI.invMsg = 'Загружено цифр: <b>' + res.ok + '</b>. Проверьте их в таблице (строки подсвечены) и нажмите «Сохранить».' +
          (res.miss.length ? ' Не нашлись в каталоге (' + res.miss.length + '): ' + esc(res.miss.slice(0, 8).join('; ')) + (res.miss.length > 8 ? '…' : '') : '');
        render();
      } catch (e) { toast('Не удалось прочитать файл'); }
    };
    r.readAsArrayBuffer(f); el.value = '';
  }
});
Object.assign(IN, { 'inv-q': el => { UI.invQ = el.value; rerenderKeepFocus('inv-q'); } });
/* Enter в поле «Факт» — к следующей строке */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.classList || !e.target.classList.contains('inv-in')) return;
  e.preventDefault(); e.target.dispatchEvent(new Event('change', { bubbles: true }));
  const all = [...document.querySelectorAll('.inv-in')], i = all.indexOf(e.target);
  if (all[i + 1]) { all[i + 1].focus(); all[i + 1].select(); }
});

