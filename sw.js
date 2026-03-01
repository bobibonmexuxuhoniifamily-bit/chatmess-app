/* ChatMess 2.5 — Service Worker */
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
    if (!e.data) return;
    const d = e.data.json();
    e.waitUntil(self.registration.showNotification(d.title||'💬 ChatMess', {
        body:d.body||'Tin nhắn mới!', icon:d.icon||null,
        tag:d.tag||'chatmess', renotify:true, vibrate:[200,100,200],
        data:{url:self.location.origin}
    }));
});
self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(self.clients.matchAll({type:'window'}).then(cs => {
        for(const c of cs) if('focus' in c) return c.focus();
        if(self.clients.openWindow) return self.clients.openWindow('/');
    }));
});
self.addEventListener('message', e => {
    if(e.data?.type==='SHOW_NOTIF')
        self.registration.showNotification(e.data.title||'💬 ChatMess',
            {body:e.data.body||'',icon:e.data.icon||null,tag:e.data.tag||'chatmess',renotify:true,vibrate:[200,100,200]});
});
