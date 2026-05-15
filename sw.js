const CACHE='navo-reborn-v1';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./styles/main.css','./app/main.js','./assets/navo-icon.png','./assets/navo-mark.svg']))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
