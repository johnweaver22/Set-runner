'use strict';
const CACHE='set-runner-offline-v2';
const SHELL=['./index.html','./engine.js','./storage.js','./offline.js','./manifest.webmanifest','./icon.svg'];
const urls=SHELL.map(path=>new URL(path,self.location).href);
async function valid(response,url){
  if(!response.ok||response.redirected)return false;
  if(url.endsWith('/index.html'))return (await response.clone().text()).includes('name="set-runner-app" content="1"');
  const mime=response.headers.get('content-type')||'';
  return url.endsWith('.js')?/javascript/.test(mime):url.endsWith('.svg')?/svg/.test(mime):/json|manifest/.test(mime);
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  // Fetch and validate the full version before making it available offline.
  const responses=await Promise.all(urls.map(async url=>{const response=await fetch(url,{cache:'reload',credentials:'same-origin',redirect:'error'});if(!await valid(response,url))throw Error('App cache is incomplete');return response;}));
  const cache=await caches.open(CACHE);
  await Promise.all(urls.map((url,i)=>cache.put(url,responses[i])));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('set-runner-offline-')&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url),base=new URL('./',self.location);
  if(request.method!=='GET'||url.origin!==base.origin)return;
  if(request.mode==='navigate'&&(url.pathname===base.pathname||url.pathname===base.pathname+'index.html')){
    event.respondWith((async()=>{
      try{return await fetch(request);}catch(error){const saved=await caches.match(new URL('./index.html',self.location).href,{cacheName:CACHE});if(saved)return saved;throw error;}
    })());return;
  }
  if(urls.includes(url.href))event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(request)||fetch(request);})());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='CHECK_OFFLINE')event.waitUntil((async()=>{
    const cache=await caches.open(CACHE),matches=await Promise.all(urls.map(url=>cache.match(url)));
    event.source?.postMessage({type:'OFFLINE_STATUS',ready:matches.every(Boolean)});
  })());
});
