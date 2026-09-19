// رقم إصدار ديناميكي يتغير دائماً
const CACHE_NAME = 'albasem-cams-live-v' + Date.now();

// 1. التثبيت الفوري وتخطي الانتظار
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 2. تنظيف ومسح كل الكاش القديم فوراً عند التفعيل
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          return caches.delete(cache);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Network First: اسحب دائماً من السيرفر والإنترنت أولاً
self.addEventListener('fetch', (event) => {
  // عدم تخزين طلبات فايربيس أو البث المباشر
  if (event.request.url.includes('firebaseio.com') || event.request.url.includes('.m3u8')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
