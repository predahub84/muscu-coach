const CACHE='muscu-coach-__BUILD__';
const SHELL=['/accueil.html','/experience.css','/profile.js','/nutrition.js','/nutrition.css','/barcode.js','/','/index.html','/connexion.html','/auth.css','/auth.js','/app.css','/coach-domain.js','/coach-profile.js','/coach-engine.js','/coach-storage.js','/app.js','/cloud.css','/cloud.js','/config.js','/supabase.js','/manifest.webmanifest','/icon-192.png','/icon-512.png','/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('muscu-coach-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
async function networkFirst(request,cacheKey){
 const cache=await caches.open(CACHE);
 try{
  const response=await fetch(request);
  if(response&&response.ok)await cache.put(cacheKey||request,response.clone());
  return response;
 }catch{
  return (await cache.match(cacheKey||request))||Response.error();
 }
}
self.addEventListener('fetch',event=>{
 const u=new URL(event.request.url);
 if(event.request.method!=='GET'||u.origin!==self.location.origin)return;
 // Auth et DB ne passent jamais par ce cache. Pour l'interface, le réseau gagne
 // quand il est disponible afin qu'un nouveau déploiement ne reste pas bloqué
 // derrière une ancienne version installée sur iPhone/PWA.
 if(event.request.mode==='navigate'){
  const fallback=['/connexion.html','/accueil.html'].includes(u.pathname)?u.pathname:'/index.html';
  event.respondWith(networkFirst(event.request,fallback));
  return;
 }
 if(SHELL.includes(u.pathname))event.respondWith(networkFirst(event.request,u.pathname));
});
