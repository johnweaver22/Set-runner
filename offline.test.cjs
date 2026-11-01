const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function harness(){
 const events=new Map(),stores=new Map();let connected=true,login=false,claimed=false;
 const cacheFor=k=>{if(!stores.has(k))stores.set(k,new Map());const m=stores.get(k);return {put:async(k,v)=>m.set(String(k.url||k),v.clone()),match:async k=>m.get(String(k.url||k))?.clone()};};
 const caches={open:async k=>cacheFor(k),keys:async()=>[...stores.keys()],delete:async k=>stores.delete(k),match:async(k,o)=>cacheFor(o.cacheName).match(k)};
 const fetch=async request=>{if(!connected)throw Error('offline');const url=String(request.url||request);if(login)return new Response('<h1>Log in to access</h1>',{headers:{'content-type':'text/html'}});const pathname=new URL(url).pathname;const file=pathname==='/'?'index.html':pathname.slice(1);const mime=file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.webmanifest')?'application/manifest+json':'text/html';return new Response(fs.readFileSync(file),{headers:{'content-type':mime}});};
 const self={location:new URL('https://runner.test/sw.js'),addEventListener:(type,fn)=>events.set(type,fn),skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true;}}};
 vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{self,caches,fetch,URL,Response,Promise});
 return {offline(){connected=false;},login(){login=true;},claimed:()=>claimed,stores,async lifecycle(type){let promise;events.get(type)({waitUntil(p){promise=p;}});await promise;},async request(path,mode='navigate'){let response;events.get('fetch')({request:{url:'https://runner.test'+path,method:'GET',mode},respondWith(p){response=p;}});return response?await response:null;},async status(){let promise,answer;events.get('message')({data:{type:'CHECK_OFFLINE'},source:{postMessage(v){answer=v;}},waitUntil(p){promise=p;}});await promise;return answer;}};
}
test('full app shell loads offline after installation',async()=>{const h=harness();await h.lifecycle('install');await h.lifecycle('activate');assert.equal(h.claimed(),true);assert.equal((await h.status()).ready,true);h.offline();assert.match(await (await h.request('/')).text(),/name="set-runner-app" content="1"/);assert.match(await (await h.request('/engine.js','cors')).text(),/class Runner/);assert.match(await (await h.request('/storage.js','cors')).text(),/class Store/);});
test('login pages are not cached as the app and online access denial is respected',async()=>{const h=harness();h.login();await assert.rejects(h.lifecycle('install'));assert.equal((await h.status()).ready,false);const ready=harness();await ready.lifecycle('install');ready.login();assert.match(await (await ready.request('/')).text(),/Log in to access/);assert.equal(await ready.request('/signin-with-chatgpt'),null);});
