// RCMU Service Worker v6.0
// Site: https://sasindurcm.github.io/RCMU.net/

const CACHE = 'rcmu-v6';
const BASE  = '/RCMU.net';

const PRECACHE = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/student-portal.html',
  BASE + '/student-login.html',
  BASE + '/login.html',
  BASE + '/style.css',
  BASE + '/app.js',
  BASE + '/manifest.json',
  BASE + '/404.html',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(PRECACHE.map(url =>
        cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (
    url.hostname !== self.location.hostname ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('cdnjs')
  ) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.status === 200) {
            caches.open(CACHE).then(c => c.put(req, res.clone()));
          }
          return res;
        })
        .catch(() =>
          caches.match(req)
            .then(cached => cached || caches.match(BASE + '/index.html'))
        )
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          caches.open(CACHE).then(c => c.put(req, res.clone()));
        }
        return res;
      }).catch(() => null);
      return cached || net;
    })
  );
});

self.addEventListener('push', e => {
  let data = { title: 'RCMU', body: 'You have an upcoming duty.' };
  try { if (e.data) data = e.data.json(); } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'RCMU', {
      body: data.body || 'Check your portal.',
      icon: BASE + '/icon-192.png',
      badge: BASE + '/icon-96.png',
      tag: data.tag || 'rcmu',
      renotify: true,
      requireInteraction: data.urgency === 'high',
      data: { url: data.url || (BASE + '/student-portal.html') },
      actions: [
        { action: 'open', title: '📱 Open' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'SCHEDULE_REMINDER') return;
  const { notifId, dutyDate, dutyLabel, dutyPeriod, daysBefore, fireAt } = e.data;
  const delay = new Date(fireAt).getTime() - Date.now();
  if (delay <= 0 || delay > 7 * 24 * 3600 * 1000) return;
  const msgs = {
    3: `⏰ Duty in 3 days: "${dutyLabel}" on ${dutyDate} (${dutyPeriod})`,
    2: `⏰ Duty in 2 days: "${dutyLabel}" on ${dutyDate} (${dutyPeriod})`,
    1: `🔔 Tomorrow: "${dutyLabel}" is tomorrow! (${dutyPeriod})`,
    0: `🚨 TODAY: "${dutyLabel}" duty is today! (${dutyPeriod})`
  };
  setTimeout(() => {
    self.registration.showNotification('RCMU Duty Reminder', {
      body: msgs[daysBefore] || `Duty: "${dutyLabel}"`,
      icon: BASE + '/icon-192.png',
      badge: BASE + '/icon-96.png',
      tag: 'rcmu-reminder-' + notifId,
      requireInteraction: daysBefore === 0,
      data: { url: BASE + '/student-portal.html' }
    });
  }, delay);
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const url = e.notification.data?.url || (BASE + '/student-portal.html');
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      const match = wins.find(w => w.url.includes('student-portal'));
      if (match) return match.focus();
      return clients.openWindow(url);
    })
  );
});