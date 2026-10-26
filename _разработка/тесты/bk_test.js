const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
// имитация папки на диске (File System Access API)
const files = {};
for (let i = 1; i <= 33; i++) files['LIVARO 2026-09-' + String(i).padStart(2, '0') + '.json'] = { t: '{}', m: i }; // 33 старых копии (даты условные)
const fileH = name => ({ kind: 'file', name, getFile: async () => ({ text: async () => files[name].t, lastModified: Date.now(), size: files[name].t.length }),
  createWritable: async () => { let buf = ''; return { write: async t => { buf = t; }, close: async () => { files[name] = { t: buf }; } }; } });
const dirH = { name: 'Резервные копии', getFileHandle: async (n, o) => { if (!files[n] && !(o && o.create)) throw new Error('нет файла'); if (!files[n]) files[n] = { t: '' }; return fileH(n); },
  values: async function* () { for (const n of Object.keys(files)) yield fileH(n); }, removeEntry: async n => { delete files[n]; },
  queryPermission: async () => 'granted', requestPermission: async () => 'granted' };
const db0 = { v: 1, templates: [], trash: [], clients: [{ id: 'c1', name: 'Рашид', opening: 0 }], orders: [], payments: [], cat: [{ n: 'Шкафы', ch: [], it: [['Шкаф', 1000]] }],
  cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 1, lastBackup: null, notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/data', beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.showDirectoryPicker = async () => dirH;
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const sync = () => w.dispatchEvent(new w.HashChangeEvent('hashchange'));
(async () => {
  try {
    await wait(100);
    console.log('1 до включения:', d.getElementById('bk-status').textContent, '| кнопка:', !!d.querySelector('[data-act="bk-choose"]'));
    click(d.querySelector('[data-act="bk-choose"]')); await wait(300);
    const days = Object.keys(files).filter(n => /^LIVARO \d{4}-\d{2}-\d{2}\.json$/.test(n));
    console.log('2 включено:', d.getElementById('bk-status').textContent, '| файлов за дни:', days.length, '(должно быть 30) | есть «последняя»:', !!files['LIVARO последняя копия.json']);
    // изменение данных → автосохранение через 2 с
    w.location.hash = '#/clients'; sync();
    files['LIVARO последняя копия.json'].t = 'старое';
    w.eval('DB.clients.push({id:"c2",name:"Шамиль",opening:0}); commit();');
    await wait(2500);
    console.log('3 после изменения: в копии клиентов =', JSON.parse(files['LIVARO последняя копия.json'].t).clients.length);
    // восстановление из копии
    w.location.hash = '#/data'; sync(); await wait(200);
    console.log('4 список копий, строк:', d.querySelectorAll('#bk-list tr').length);
    const today = [...d.querySelectorAll('[data-act="bk-restore"]')].find(b => /последняя/.test(b.dataset.name));
    w.eval('DB.clients = []; save();');
    click(today); await wait(300);
    console.log('5 восстановлено: клиентов', JSON.parse(w.localStorage.getItem('livaro_db_v1')).clients.length, '| страховочная копия:', Object.keys(files).some(n => n.includes('перед восстановлением')));
  } catch (e) { console.log('FAIL', e.stack); }
  console.log('errors:', errors);
})();
