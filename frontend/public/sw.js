self.addEventListener('install', (e) => {
    console.log('[SafeHer ServiceWorker] Install');
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[SafeHer ServiceWorker] Activate');
});

self.addEventListener('fetch', (e) => {
    // Basic pass-through for prototype
    e.respondWith(fetch(e.request).catch(err => {
        console.log('[SafeHer ServiceWorker] Fetch Error', err);
    }));
});
