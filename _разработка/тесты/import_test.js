const { JSDOM } = require('jsdom');
const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
const html = fs.readFileSync(dir + 'LIVARO.html', 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
const errors = [];
const db0 = { v: 1, cat: [], templates: [], trash: [], clients: [{ id: 'x', name: 'Шамиль BUGLAN', phone: '', opening: 0 }],
  orders: [{ id: 'o1', no: 1, date: '2026-10-23', shipDate: '2026-10-23', shippedAt: 5, status: 'shipped', clientId: 'x', groups: [{ t: 'Шкаф Айша', items: [{ n: 'Корпус', q: 1, p: 30000 }] }], total: 30000, createdAt: 1 }],
  payments: [], cart: { groups: [{ t: 'Шкаф 1', items: [] }], cur: 0 }, nextNo: 2, lastBackup: Date.now(), notice: '' };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/#/clients', pretendToBeVisual: true, beforeParse(w) {
  w.confirm = () => true; w.scrollTo = () => {}; w.localStorage.setItem('livaro_db_v1', JSON.stringify(db0));
  w.addEventListener('error', e => errors.push(e.message));
} });
const w = dom.window, d = w.document;
const sync = () => w.dispatchEvent(new w.HashChangeEvent('hashchange'));
const db = () => JSON.parse(w.localStorage.getItem('livaro_db_v1'));
try {
  // таблица как из 1С «Вывести список»
  const rows = [['Наименование', 'ИНН', 'Контактная информация'], ['Шамиль BUGLAN', '', ''], ['Рашид ДАЧА', '0544', '+7 (928) 111-22-33, г. Махачкала'], ['Абдурахим', '', '8 900 555 66 77'], ['', '', ''], ['Муслим ( MADALENA )', '', '']];
  const res = w.eval('importClients(' + JSON.stringify(rows) + ')'); w.eval('commit()');
  console.log('1 импорт:', JSON.stringify(res), '|', db().clients.map(c => c.name + ' [' + c.phone + ']').join('; '));
  // также через настоящий xlsx-файл
  const XLSX = w.XLSX, ws = XLSX.utils.aoa_to_sheet([['Покупатель', 'Телефон'], ['Новый клиент', '89281234567']]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Лист1');
  const arr = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const back = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(arr), { type: 'array' }).Sheets['Лист1'], { header: 1, defval: '' });
  console.log('2 xlsx →', JSON.stringify(w.eval('importClients(' + JSON.stringify(back) + ')')));
  w.location.hash = '#/opening'; sync();
  console.log('3 начальные долги, строк:', d.querySelectorAll('tbody tr').length);
  const id = db().clients.find(c => c.name === 'Рашид ДАЧА').id;
  const amt = d.querySelector('[data-ch="op-amt"][data-id="' + id + '"]'); amt.value = '150 000'; amt.dispatchEvent(new w.Event('change', { bubbles: true }));
  console.log('  ввели 150 000 → opening', db().clients.find(c => c.id === id).opening, '| сводка:', d.getElementById('op-sum').textContent.replace(/\s+/g, ' '));
  const id2 = db().clients.find(c => c.name === 'Абдурахим').id;
  const t2 = d.querySelector('[data-ch="op-type"][data-id="' + id2 + '"]'); t2.value = 'adv'; t2.dispatchEvent(new w.Event('change', { bubbles: true }));
  const a2 = d.querySelector('[data-ch="op-amt"][data-id="' + id2 + '"]'); a2.value = '20000'; a2.dispatchEvent(new w.Event('change', { bubbles: true }));
  console.log('  аванс 20 000 → opening', db().clients.find(c => c.id === id2).opening);
  w.location.hash = '#/clients'; sync();
  console.log('4 балансы:', [...d.querySelectorAll('tbody tr')].map(r => r.children[0].textContent + ': ' + r.children[2].textContent).join(' | '));
  // WhatsApp: номер и текст
  console.log('5 номера:', ['+7 (928) 111-22-33', '8 900 555 66 77', '9281234567', ''].map(p => w.eval('waPhone(' + JSON.stringify(p) + ')') || '(нет)').join(', '));
  console.log('  текст:', JSON.stringify(w.eval('waText(order("o1"))')));
  w.location.hash = '#/sale/o1'; sync(); console.log('  кнопка на накладной:', !!d.querySelector('[data-act="wa-send"]'));
  w.location.hash = '#/print/c/o1'; sync(); console.log('  кнопка на печати:', !!d.querySelector('[data-act="wa-send"]'));
} catch (e) { console.log('FAIL', e.stack); }
console.log('errors:', errors);
