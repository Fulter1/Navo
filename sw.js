const CACHE = 'navo-structured-v3';
const ASSETS = [
  './','./index.html','./manifest.webmanifest',
  './styles/main.css','./styles/base/tokens-base.css','./styles/components/app-shell.css','./styles/pages/landing.css','./styles/components/intelligence-focus.css','./styles/motion/reduced-motion.css','./styles/layouts/responsive-fixes.css',
  './config/navo-config.js','./app/main.js','./app/core/performance.js','./app/runtime/navo-runtime.js',
  './assets/navo-mark.svg','./assets/navo-icon.png','./assets/branding/navo-mark.svg','./assets/icons/navo-icon.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(found => found || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(()=>{});
    return response;
  }).catch(() => caches.match('./index.html'))));
});
