/* No offline cache: authenticated responses and conversation data stay out of CacheStorage. */
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data;
    try { data = event.data.json(); } catch { return; }
    const url = new URL(data.url, self.location.origin);
    if (url.origin !== self.location.origin || url.pathname !== '/inbox' || !url.searchParams.get('conversationId')) return;
    await self.registration.showNotification('MillionsNest Connect', {
      body: 'Há uma nova mensagem para atendimento.',
      icon: '/brand/connect/v2/02_app/pwa/icon-192.png',
      tag: typeof data.tag === 'string' ? data.tag : 'connect-inbox',
      data: { url: url.href },
    });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL(event.notification.data?.url || '/inbox', self.location.origin);
    if (url.origin !== self.location.origin || url.pathname !== '/inbox') return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === url.origin) {
        await client.navigate(url.href);
        await client.focus();
        return;
      }
    }
    await self.clients.openWindow(url.href);
  })());
});
