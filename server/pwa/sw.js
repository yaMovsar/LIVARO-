/* LIVARO: служебный помощник приложения на телефоне.
   Хранит в телефоне ТОЛЬКО страницу «Нет связи» и значок — данные программы (заказы, клиенты) сюда не попадают:
   страница программы и /api всегда идут на сервер. Если сервер недоступен — показываем «Нет связи». */
const CACHE = 'livaro-offline-v1';
const OFFLINE = '/offline.html';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([OFFLINE, '/app/icons/icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return; // файлы и запросы к серверу — как обычно, без хранения
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});
