const CACHE='navo-v10-username-mobile-settings';
const ASSETS=['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./assets/navo-icon.png','./assets/navo-mark.svg','./assets/navo-logo.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(e.request.mode==='navigate'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/navo-config.js')){
    e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match('./index.html')));return;
  }
  e.respondWith(caches.match(e.request).then(cached=>{
    return cached||fetch(e.request).then(res=>{
      const copy=res.clone();
      if(res.ok)caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
      return res;
    });
  }).catch(()=>caches.match('./index.html')));
});
