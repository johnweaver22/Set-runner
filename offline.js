(function(){
  const badge=document.getElementById('offline-status');
  function state(text){badge.textContent=text;}
  if(!('serviceWorker' in navigator)||!window.isSecureContext){state('Offline unavailable');return;}
  let ready=false;
  function label(){state(ready?(navigator.onLine?'Offline ready':'Offline · ready'):(navigator.onLine?'Preparing offline…':'Offline not ready'));}
  function check(){navigator.serviceWorker.controller?.postMessage({type:'CHECK_OFFLINE'});}
  navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='OFFLINE_STATUS'){ready=event.data.ready===true;label();}});
  navigator.serviceWorker.addEventListener('controllerchange',check);
  window.addEventListener('online',label);window.addEventListener('offline',label);
  label();navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready).then(check).catch(()=>state('Offline unavailable'));
})();
