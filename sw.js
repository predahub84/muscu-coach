const CACHE='muscu-coach-__BUILD__';
const SHELL=['/accueil.html','/experience.css','/profile.js','/nutrition.js','/nutrition.css','/barcode.js','/','/index.html','/connexion.html','/auth.css','/auth.js','/app.css','/coach-domain.js','/coach-engine.js','/coach-storage.js','/app.js','/cloud.css','/cloud.js','/config.js','/supabase.js','/manifest.webmanifest','/icon-192.png','/icon-512.png','/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
// No skipWaiting: an ongoing workout keeps a consistent application version.
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('muscu-coach-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==self.location.origin)return;
  // Never cache authentication or database traffic. Only explicit static assets.
  if(event.request.mode==='navigate'){event.respondWith(caches.open(CACHE).then(async c=>(await c.match(['/connexion.html','/accueil.html'].includes(u.pathname)?u.pathname:'/index.html'))||fetch(event.request)));return}
  if(SHELL.includes(u.pathname))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(u.pathname))||fetch(event.request)));
});
