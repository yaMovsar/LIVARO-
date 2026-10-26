const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const db0 = { v: 1, templates: [], trash: [], clients: [], orders: [], payments: [],
  cat: [{ n: 'Прочее', ch: [], it: [['Антресоль 1', 1], ['Антресоль 2', 2], ['Антресоль 3', 3], ['Антресоль 4', 4], ['Ручка', 0]] },
        { n: 'Антресоли', ch: [{ n: '2-х', ch: [], it: [] }], it: [] }],
  cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 1, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/catalog', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = (el, opt) => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', Object.assign({ bubbles: true }, opt || {}))); };
const db = () => JSON.parse(w.localStorage.getItem('livaro_db_v1'));
const tn = t => [...d.querySelectorAll('.tn')].find(x => x.textContent.includes(t));
const rowName = t => [...d.querySelectorAll('[data-dbl="cname"]')].find(x => x.textContent === t);
const ev = (type, el) => { const e = new w.Event(type, { bubbles: true, cancelable: true }); e.dataTransfer = { setData() {}, setDragImage() {} }; el.dispatchEvent(e); };
(async () => {
  try {
    click(tn('Прочее'));
    click(rowName('Антресоль 1')); click(rowName('Антресоль 4'), { shiftKey: true });
    console.log('1 щелчок + Shift: выделено', d.querySelectorAll('tr.crow.sel').length, '| панель:', !!d.getElementById('move-to'));
    click(rowName('Антресоль 4')); // снять одну
    console.log('  снятие щелчком: выделено', d.querySelectorAll('tr.crow.sel').length);
    // тянем выделенную строку на закрытую папку «Антресоли» → ждём раскрытия → бросаем на «2-х»
    ev('dragstart', rowName('Антресоль 2').closest('tr'));
    ev('dragover', tn('Антресоли'));
    await new Promise(r => setTimeout(r, 800));
    console.log('2 папка раскрылась при наведении:', !!tn('2-х'));
    ev('dragover', tn('2-х')); ev('drop', tn('2-х')); ev('dragend', d.body);
    console.log('  перенесено в «2-х»:', db().cat[1].ch[0].it.map(i => i[0]).join(', '), '| осталось в «Прочее»:', db().cat[0].it.map(i => i[0]).join(', '));
    // перетаскивание невыделенной строки — переносит только её
    ev('dragstart', rowName('Ручка').closest('tr')); ev('dragover', tn('Антресоли')); ev('drop', tn('Антресоли'));
    console.log('3 одна невыделенная:', db().cat[1].it.map(i => i[0]).join(', '));
    // двойной щелчок — переименование
    const s = rowName('Антресоль 4'); s.dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true }));
    const inp = d.querySelector('td.nm-cell input'); inp.value = 'Антресоль 4-х БЕЛЫЙ'; inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    console.log('4 переименовано:', db().cat[0].it.map(i => i[0]).join(', '));
  } catch (e) { console.log('FAIL', e.stack); }
  console.log('errors:', errors);
})();
