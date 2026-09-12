self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { title: 'רצף', body: event.data?.text() || 'יש התראה חדשה' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'רצף', { body: data.body || '', icon: '/icon-192.png', badge: '/icon-192.png', data: { url: data.url || '/' }, dir: 'rtl', lang: 'he' }));
});
self.addEventListener('notificationclick', event => { event.notification.close(); const url = event.notification.data?.url || '/'; event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => { const existing = list.find(c => 'focus' in c); return existing ? existing.focus().then(c => c.navigate(url)) : clients.openWindow(url); })); });
