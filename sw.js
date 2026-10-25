/* Приложение «Конкуренты · Склейки»: сеть в первую очередь, без сети — последняя сохранённая версия страниц и данных.
   Данные лежат зашифрованными, ключ — только у пользователя (как на сайте). Лежит в корне /shov/, чтобы охватить оба сервиса. */
const C = 'konk-v1';
const SHELL = ['/shov/', '/shov/konkurenty/', '/shov/pwa/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;   // картинки Озона, Telegram — мимо
  e.respondWith(fetch(r).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(C).then(c => c.put(r.url.split('?')[0], copy)); }
    return res;
  }).catch(() => caches.match(r.url.split('?')[0]).then(m => m || caches.match('/shov/konkurenty/'))));
});
