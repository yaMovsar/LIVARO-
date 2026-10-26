const { JSDOM } = require('jsdom');
const path = 'C:/Users/user/Desktop/LIVARO/LIVARO.html';
const errors = [];
(async () => {
  const fs = require('fs'), dir = 'C:/Users/user/Desktop/LIVARO/';
  const html = fs.readFileSync(path, 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(dir + s.split('?')[0], 'utf8') + '<\/script>');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'http://localhost/',
    beforeParse(w) {
      w.confirm = () => true; w.scrollTo = () => {};
      w.prompt = (q, def) => (q.includes('Цена') ? '1500' : 'Тестовая папка');
      // данные пробной версии — должны перенестись
      w.localStorage.setItem('livaro_trial_v1', JSON.stringify({ cat: [{ n: 'Моя папка', ch: [{ n: 'Подпапка', ch: [], it: [['Мой шкаф', 5000]] }], it: [['Ручка тест', 0]] }], doc: [{ t: 'Шкаф X', items: [{ n: 'Мой шкаф', q: 1, p: 5000 }] }], cur: 0 }));
      w.addEventListener('error', e => errors.push(e.message));
    }
  });
  const w = dom.window, d = w.document;
  const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
  const change = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const input = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
  const nav = h => { w.location.hash = h; w.dispatchEvent(new w.HashChangeEvent('hashchange')); };
  const sync = () => w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  const txt = s => (d.querySelector(s) || {}).textContent;

  console.log('home ok:', txt('h1'), '| notice:', !!d.querySelector('.warn'));
  nav('#/order');
  console.log('cart migrated groups:', d.querySelectorAll('.gbox').length, txt('.gsum'));
  // поиск и добавление
  input(d.getElementById('cat-q'), 'Ручка');
  click(d.querySelector('#cat-list .it'));
  console.log('after add rows:', d.querySelectorAll('tr[data-drag]').length);
  click(d.querySelector('[data-act="to-checkout"]')); sync();
  console.log('checkout:', txt('h1'), 'post disabled:', d.querySelector('[data-act="post"]').disabled);
  // новый клиент через поиск
  input(d.getElementById('ck-q'), 'Рашид');
  click(d.querySelector('#ck-dd .new'));
  d.getElementById('f-phone').value = '+7 900 000-00-00';
  d.getElementById('f-bt').value = 'adv'; d.getElementById('f-bal').value = '100 000';
  click(d.querySelector('[data-act="client-save"]'));
  console.log('picked:', txt('.picked b'));
  click([...d.querySelectorAll('[data-act="ck-pay"]')].find(b => b.dataset.v === 'cash'));
  change(d.querySelector('[data-ch="ck-amount"]'), '2000');
  console.log('after preview:', txt('.aside .tot:last-child') || [...d.querySelectorAll('.line.tot')].map(x => x.textContent).join(' | '));
  click(d.querySelector('[data-act="post"]')); sync();
  console.log('sale page:', txt('h1').trim(), '|', !!d.querySelector('.warn'));
  click(d.querySelector('a[href^="#/print/c/"]')); nav(d.querySelector('a[href^="#/print/c/"]').getAttribute('href'));
  console.log('print client rows:', d.querySelectorAll('.p-t tbody tr').length, '| bal:', [...d.querySelectorAll('.bal .line')].map(x => x.textContent).join(' ; '));
  nav(d.querySelector('a[href^="#/print/l/"]').getAttribute('href'));
  console.log('print loader rows:', d.querySelectorAll('.p-t tbody tr').length);
  // второй заказ с оплатой через водителя
  nav('#/order');
  input(d.getElementById('cat-q'), 'Мой шкаф'); click(d.querySelector('#cat-list .it'));
  click(d.querySelector('[data-act="to-checkout"]')); sync();
  click(d.querySelector('.chip[data-act="ck-pick"]'));
  click([...d.querySelectorAll('[data-act="ck-pay"]')].find(b => b.dataset.v === 'driver'));
  change(d.querySelector('[data-ch="ck-amount"]'), '3000');
  click(d.querySelector('[data-act="post"]')); sync();
  nav('#/drivers');
  console.log('drivers pending:', d.querySelectorAll('[data-act="recv"]').length, txt('h2'));
  click(d.querySelector('[data-act="recv"]'));
  nav('#/clients');
  console.log('clients:', [...d.querySelectorAll('tbody tr')].map(r => r.textContent).join(' || '));
  nav('#/client/' + JSON.parse(w.localStorage.getItem('livaro_db_v1')).clients[0].id);
  console.log('client history rows:', d.querySelectorAll('tbody tr').length, '| tiles:', [...d.querySelectorAll('.tile .v')].map(x => x.textContent).join(' / '));
  nav('#/sales');
  console.log('sales rows:', d.querySelectorAll('tbody tr').length, txt('.line.tot'));
  nav('#/home');
  console.log('home tiles:', [...d.querySelectorAll('.tile .v')].map(x => x.textContent).join(' / '));
  // товары: перенос отмеченного в другую папку
  nav('#/catalog');
  click([...d.querySelectorAll('.tn')].find(x => x.textContent.includes('Моя папка')));
  const cb = d.querySelector('[data-ch="ccheck"]'); cb.checked = true; cb.dispatchEvent(new w.Event('change', { bubbles: true }));
  d.getElementById('move-to').value = [...d.getElementById('move-to').options].find(o => o.textContent.includes('Подпапка')).value;
  click(d.querySelector('[data-act="cmove"]'));
  const db = JSON.parse(w.localStorage.getItem('livaro_db_v1'));
  console.log('moved to subfolder:', JSON.stringify(db.cat[0].ch[0].it), '| root items left:', db.cat[0].it.length);
  // перетаскивание товара на папку
  click([...d.querySelectorAll('.tn')].find(x => x.textContent.includes('Подпапка')));
  const ev = (type, el) => { const e = new w.Event(type, { bubbles: true, cancelable: true }); e.dataTransfer = { setData() {} }; el.dispatchEvent(e); };
  ev('dragstart', d.querySelector('[data-cdrag="0"]')); const tgt = [...d.querySelectorAll('.tn')].find(x => x.textContent.includes('Моя папка'));
  ev('dragover', tgt); ev('drop', tgt);
  const db2 = JSON.parse(w.localStorage.getItem('livaro_db_v1'));
  console.log('drag item back:', db2.cat[0].it.map(x => x[0]).join(','), '| sub:', db2.cat[0].ch[0].it.length);
  for (const v of ['payments', 'reports', 'data']) { nav('#/' + v); console.log(v, 'ok:', txt('h1')); }
  console.log('errors:', errors);
})().catch(e => { console.log('TEST FAIL', e.stack); console.log('errors:', errors); });

