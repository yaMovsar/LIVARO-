/* ================= ВЫБОР ПЕРИОДА (как в 1С) ================= */
const D0 = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; };
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addM = (d, n) => { const x = new Date(d); x.setDate(1); x.setMonth(x.getMonth() + n); return x; };
const monStart = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const mStart = d => new Date(d.getFullYear(), d.getMonth(), 1, 12);
const mEnd = d => new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);
const qStart = d => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1, 12);
const hStart = d => new Date(d.getFullYear(), d.getMonth() < 6 ? 0 : 6, 1, 12);
const yStart = d => new Date(d.getFullYear(), 0, 1, 12);
const decStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate() <= 10 ? 1 : d.getDate() <= 20 ? 11 : 21, 12);
const decEnd = s => s.getDate() === 21 ? mEnd(s) : addD(s, 9);
/* вкладки и варианты: [название, () => [с, по]] */
const RANGES = {
  'День': [['Вчера', () => [addD(D0(), -1), addD(D0(), -1)]], ['Сегодня', () => [D0(), D0()]]],
  'Неделя': [['Прошлая неделя', () => [addD(monStart(D0()), -7), addD(monStart(D0()), -1)]], ['Неделя', () => [addD(D0(), -6), D0()]],
    ['С начала этой недели', () => [monStart(D0()), D0()]], ['Эта неделя', () => [monStart(D0()), addD(monStart(D0()), 6)]]],
  'Декада': [['Прошлая декада', () => { const s = decStart(addD(decStart(D0()), -1)); return [s, decEnd(s)]; }], ['С начала этой декады', () => [decStart(D0()), D0()]],
    ['Эта декада', () => [decStart(D0()), decEnd(decStart(D0()))]]],
  // «Месяц» в 1С — от следующего дня того же числа прошлого месяца по сегодня
  'Месяц': [['Прошлый месяц', () => [mStart(addM(D0(), -1)), mEnd(addM(D0(), -1))]], ['Месяц', () => { const t = D0(), s = new Date(t); s.setMonth(s.getMonth() - 1); s.setDate(s.getDate() + 1); return [s, t]; }],
    ['С начала этого месяца', () => [mStart(D0()), D0()]], ['Этот месяц', () => [mStart(D0()), mEnd(D0())]]],
  'Квартал': [['Прошлый квартал', () => { const s = qStart(addM(qStart(D0()), -3)); return [s, addD(qStart(D0()), -1)]; }], ['Квартал', () => [addD(addD(D0(), 1), -91), D0()]],
    ['С начала этого квартала', () => [qStart(D0()), D0()]], ['Этот квартал', () => [qStart(D0()), addD(addM(qStart(D0()), 3), -1)]]],
  'Полугодие': [['Прошлое полугодие', () => { const s = hStart(addM(hStart(D0()), -6)); return [s, addD(hStart(D0()), -1)]; }], ['С начала этого полугодия', () => [hStart(D0()), D0()]],
    ['Это полугодие', () => [hStart(D0()), addD(addM(hStart(D0()), 6), -1)]]],
  'Год': [['Прошлый год', () => [yStart(addM(yStart(D0()), -12)), addD(yStart(D0()), -1)]], ['Год', () => [addD(addD(D0(), 1), -365), D0()]],
    ['С начала этого года', () => [yStart(D0()), D0()]], ['Этот год', () => [yStart(D0()), new Date(D0().getFullYear(), 11, 31, 12)]]],
  'Прочее': [['Всё время', () => [null, null]], ['Последние 14 дней', () => [addD(D0(), -13), D0()]], ['Последние 90 дней', () => [addD(D0(), -89), D0()]]]
};
function rangeOf(name) {
  for (const tab in RANGES) for (const [n, f] of RANGES[tab]) if (n === name) { const [a, b] = f(); return { from: a ? isoOf(a) : '', to: b ? isoOf(b) : '', name: n, tab }; }
  return { from: '', to: '', name: 'Всё время', tab: 'Прочее' };
}
const inRange = (iso, r) => (!r.from || iso >= r.from) && (!r.to || iso <= r.to);
function rangeLabel(r) {
  const dates = r.from || r.to ? (r.from ? ru(r.from) : '…') + ' – ' + (r.to ? ru(r.to) : '…') : '';
  return r.name ? r.name + (dates ? ' · ' + dates : '') : dates || 'Всё время';
}
function rangeButton(r, act, k) {
  return '<button class="btn" data-act="' + act + '"' + (k ? ' data-k="' + k + '"' : '') + ' aria-haspopup="dialog">' + icon('calendar', 16) + rangeLabel(r) + '</button>';
}
/* окно выбора периода; UI.rp — черновик (что выбрано в окне), применяется кнопкой «Выбрать» */
function rangeForm() {
  const p = UI.rp;
  modal('<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0;font-size:22px">Выбор периода</h2><button class="x" data-act="modal-close" aria-label="Закрыть" style="font-size:22px">×</button></div>' +
    '<div class="btns" style="align-items:center;flex-wrap:nowrap"><input class="inp" type="date" id="r-from" value="' + p.from + '" aria-label="С"><span>–</span><input class="inp" type="date" id="r-to" value="' + p.to + '" aria-label="По">' +
    '<button class="btn sm" style="border:0;color:var(--accent);font-weight:600;white-space:nowrap" data-act="rp-clear">Очистить период</button></div>' +
    seg(p.tab, 'rp-tab', Object.keys(RANGES).map(k => [k, k])) +
    '<div class="rp-list" role="listbox">' + RANGES[p.tab].map(([n]) => '<button role="option" aria-selected="' + (p.name === n) + '" class="' + (p.name === n ? 'on' : '') + '" data-act="rp-pick" data-v="' + esc(n) + '">' + n + '</button>').join('') + '</div>' +
    '<div class="btns" style="justify-content:flex-end"><button class="btn" data-act="modal-close">Отмена</button><button class="btn pri" data-act="rp-apply">Выбрать</button></div>');
  const dlg = $('#modal .dlg'); if (dlg) dlg.style.maxWidth = '640px';
}
function readRange() {
  const f = $('#r-from'), t = $('#r-to'); if (!f) return;
  if (f.value !== UI.rp.from || t.value !== UI.rp.to) { UI.rp.from = f.value; UI.rp.to = t.value; UI.rp.name = ''; } // поменяли даты руками — это произвольный период
}
Object.assign(ACT, {
  'range-open': el => { const k = el.dataset.k || 'salesRange'; UI.rpKey = k; UI.rp = Object.assign({ tab: 'Месяц' }, UI[k]); rangeForm(); },
  'rp-tab': el => { readRange(); UI.rp.tab = el.dataset.v; rangeForm(); },
  'rp-pick': el => { Object.assign(UI.rp, rangeOf(el.dataset.v)); rangeForm(); },
  'rp-clear': () => { Object.assign(UI.rp, { from: '', to: '', name: 'Всё время' }); rangeForm(); },
  'rp-apply': () => {
    readRange(); const p = UI.rp;
    if (p.from && p.to && p.from > p.to) [p.from, p.to] = [p.to, p.from];
    UI[UI.rpKey] = { from: p.from, to: p.to, name: p.name, tab: p.tab }; UI.salesSel = {};
    modal(''); render();
  }
});
document.addEventListener('dblclick', e => { // двойной щелчок по варианту — выбрать сразу
  const o = e.target.closest('[data-act="rp-pick"]'); if (!o) return;
  Object.assign(UI.rp, rangeOf(o.dataset.v)); rangeForm(); ACT['rp-apply']();
});
UI.salesRange = rangeOf('Месяц'); UI.homeRange = rangeOf('Сегодня'); UI.payRange = rangeOf('Месяц'); UI.repRange = rangeOf('Месяц');
