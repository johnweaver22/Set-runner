(() => {
  'use strict';
  const root=document.getElementById('sr-review'),E=window.SetRunnerEngine,S=window.SetRunnerStorage;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const esc=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmt=seconds=>Math.floor(Math.max(0,seconds)/60)+':'+String(Math.max(0,seconds)%60).padStart(2,'0');
  const parse=E.parse;
  const blankBlock=()=>({reps:'',distance:'',stroke:'FR',type:'Fixed',time:'',anchor:'Start',step:5,apply:'rep',instruction:''});
  const laneConfig=()=>({rounds:1,gap:5,name:'',roundData:Array.from({length:4},(_,r)=>({linked:r>0,open:r===0,rest:'0:00',blocks:r===0?[blankBlock()]:[]}))});
  const lanes=[laneConfig(),laneConfig()],presetIds=[null,null],librarySelections=[null,null],played=new Map();
  let laneCount=1,runLaneCount=1,currentScreen='setup',runtime=[],audio=null,wakeLock=null,draftTimer=null,store;
  try{store=new S.Store(window.localStorage);}catch{store=new S.Store({getItem(){return null;},setItem(){throw Error('Device storage is unavailable. Sets and timer recovery cannot be saved.');}});}
  const editor=index=>root.querySelector('[data-editor-lane="'+index+'"]');
  const field=(name,index)=>editor(index)?.querySelector('[data-control="'+name+'"]');
  function fitLandscape(){
    const portrait=window.matchMedia('(orientation: portrait)').matches;
    root.classList.toggle('sr-portrait',portrait);
    if(portrait){root.querySelectorAll('.sr-screen').forEach(screen=>{screen.style.zoom='1';screen.style.width='100%';});return;}
    const width=root.getBoundingClientRect().width;
    const chrome=document.querySelector('.toolbar').offsetHeight+(root.querySelector('#sr-clock-nav')?.offsetHeight||0)+(document.querySelector('.note')?.offsetHeight||30)+document.getElementById('recovery-notice').offsetHeight+20;
    const scale=Math.min(width/1024,Math.max(300,window.innerHeight-(document.fullscreenElement?12:chrome))/768);
    if(scale>0)root.querySelectorAll('.sr-screen').forEach(screen=>{screen.style.zoom=String(scale);screen.style.width=(width/scale)+'px';});
  }
  function showScreen(name){
    currentScreen=name;
    ['one','two','setup'].forEach(screen=>root.querySelector('#sr-'+screen+'-panel').hidden=screen!==name);
    root.querySelector('#sr-clock-nav').hidden=name==='setup';
    root.dataset.screen=name;fitLandscape();window.scrollTo(0,0);
  }
  function notice(text){document.getElementById('recovery-text').textContent=text;document.getElementById('recovery-notice').hidden=false;fitLandscape();}
  function clearRecoveryNotice(){if(document.getElementById('recovery-text').textContent.startsWith('Set recovered.'))document.getElementById('recovery-notice').hidden=true;}
  function problem(error,index){
    const message=error.name==='QuotaExceededError'?'Device storage is full. New changes and timer recovery could not be saved.':error.message;
    const target=index===undefined?root.querySelector('#sr-global-error'):field('builder-message',index);
    if(target){target.textContent=message;target.hidden=false;}
    return message;
  }
  function persistCurrent(){try{store.saveCurrent(lanes,laneCount);return true;}catch(error){problem(error);return false;}}
  function queueDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(persistCurrent,250);}
  function runnable(config){try{E.compile(config);return true;}catch{return false;}}
  function makeRunner(config){const cfg=S.draft(config),plan=runnable(cfg)?E.compile(cfg):{reps:[],rests:[],rounds:cfg.rounds,gap:cfg.gap,end:0,leadEnd:0};const runner=new E.Runner(plan);runner.config=cfg;return runner;}
  function timing(block,roundIndex,laneIndex){
    const count=block.apply==='round'?lanes[laneIndex].rounds:Number(block.reps),step=block.type==='Fixed'?0:Number(block.step)*(block.type==='Descending'?-1:1);
    const start=parse(block.time)-(block.anchor==='Final'?step*(count-1):0);
    return {sequence:Array.from({length:Math.min(100,Math.max(0,count))},(_,i)=>start+step*i),interval:start+(block.apply==='round'?roundIndex*step:0)};
  }
  function work(block){return (block.reps||'—')+' × '+(block.distance||'—')+' '+block.stroke;}
  function roundBlocks(index,laneIndex){const config=lanes[laneIndex];return config.roundData[index].linked?config.roundData[0].blocks:config.roundData[index].blocks;}
  function option(value,selected){return '<option'+(value===selected?' selected':'')+'>'+esc(value)+'</option>';}
      function blockUI(block,r,b,laneIndex) {
        const sequence=timing(block,r,laneIndex).sequence;
        const valid=sequence.every(x=>Number.isFinite(x)&&x>0)&&block.reps>0&&block.distance>0;
        const untouched=block.reps===''&&block.distance===''&&block.time==='';
        const seq=block.type==='Fixed'?'Fixed turnaround · '+block.time:sequence.map(fmt).join(' → ');
        return '<section class="sr-block" data-round="'+r+'" data-block="'+b+'"><div class="sr-block-title"><span>Block '+(b+1)+'</span><span class="sr-block-tag">'+esc(work(block))+'</span><button type="button" class="sr-button sr-danger sr-delete-block" data-delete-round="'+r+'" data-delete-block="'+b+'" aria-label="Delete block '+(b+1)+' from round '+(r+1)+'">×</button></div><div class="sr-block-grid">'+
        '<label class="sr-field"><span>Reps</span><input type="number" min="1" max="100" data-field="reps" value="'+block.reps+'"></label>'+
        '<label class="sr-field"><span>Distance</span><input type="number" min="1" step="25" data-field="distance" value="'+block.distance+'"></label>'+
        '<label class="sr-field"><span>Stroke</span><select class="cursor-interaction" data-field="stroke">'+['FR','BK','BR','FL','IM','Choice'].map(x=>option(x,block.stroke)).join('')+'</select></label>'+
        '<label class="sr-field"><span>Turnaround type</span><select class="cursor-interaction" data-field="type">'+['Fixed','Descending','Ascending'].map(x=>option(x,block.type)).join('')+'</select></label>'+
        '<label class="sr-field"><span>'+(block.type==='Fixed'?'Turnaround':block.anchor+' turnaround')+'</span><input type="text" inputmode="text" autocapitalize="off" spellcheck="false" placeholder="m:ss" data-field="time" value="'+esc(block.time)+'" aria-label="Block '+(b+1)+' turnaround, minutes and seconds"></label></div>'+
        '<div class="sr-gradient"'+(block.type==='Fixed'?' hidden':'')+'><label class="sr-field"><span>Known turnaround</span><select class="cursor-interaction" data-field="anchor">'+['Start','Final'].map(x=>option(x,block.anchor)).join('')+'</select></label><label class="sr-field"><span>Change in seconds</span><input type="number" min="1" max="600" data-field="step" value="'+block.step+'"></label><label class="sr-field"><span>Change each</span><select class="cursor-interaction" data-field="apply"><option value="rep"'+(block.apply==='rep'?' selected':'')+'>Rep</option><option value="round"'+(block.apply==='round'?' selected':'')+'>Round</option></select></label><div class="sr-field"><span>Direction</span><div style="padding:10px 0;font-size:14px">'+(block.type==='Descending'?'−':'＋')+block.step+' sec</div></div></div>'+
        '<div class="sr-sequence'+(valid||untouched?'':' sr-error')+'">'+(untouched?'Enter reps, distance and turnaround.':valid?esc(seq):'Enter valid reps, distance and positive turnarounds (m:ss).')+'</div>'+
        '<label class="sr-field sr-instruction-field"><span>Block instruction · optional</span><input data-field="instruction" maxlength="140" value="'+esc(block.instruction)+'" placeholder="Leave blank for no instruction"></label></section>';
      }
      function displayLane(number,variant,block,rounds,blocks,gap,ready) {
        const key=variant+'-'+number;
        if(!block)return '<section class="sr-lane" data-key="'+key+'" data-lane-number="'+number+'"><div class="sr-lane-top"><span class="sr-lane-name">LANE '+number+'</span><span class="sr-status">Set needed</span></div><div class="sr-empty-state"><p>Build a set for lane '+number+', then choose Ready to start.</p><button type="button" class="sr-button sr-primary" data-build-lane="'+(number-1)+'">Build lane '+number+' set</button></div></section>';
        const countdown=number===1?5:18;
        const count=block.apply==='round'?rounds:Number(block.reps);
        const step=block.type==='Fixed'?0:Number(block.step)*(block.type==='Descending'?-1:1);
        const interval=parse(block.time)-(block.anchor==='Final'?step*(count-1):0);
        const turnLabel='Turnaround '+fmt(interval)+(step?' · '+(step>0?'+':'−')+Math.abs(step)+' sec / '+block.apply:'');
        return '<section class="sr-lane" data-key="'+key+'" data-lane-number="'+number+'" data-gap="'+gap+'" data-interval="'+interval+'" data-reps="'+block.reps+'"><div class="sr-lane-top"><span class="sr-lane-name">LANE '+number+'</span><span class="sr-status">'+(ready?'Ready':'Running')+'</span></div><div class="sr-board"><aside class="sr-swimmers" aria-label="Five swimmer clocks"><div class="sr-swim-caption">NEXT STARTS<br>'+gap+' SEC APART</div>'+Array.from({length:5},(_,i)=>'<div class="sr-swimmer'+(i===0?' sr-leading':'')+'"><span class="sr-swimmer-label">'+(i===0?'1 · Lead':'Position '+(i+1))+'</span><span class="sr-swimmer-time">'+fmt((ready?5:countdown)+i*gap)+'</span></div>').join('')+'</aside><div class="sr-master"><div class="sr-meta"><span>ROUND 1 / '+rounds+'</span><span>BLOCK 1 / '+blocks+'</span></div><div class="sr-work">'+esc(work(block))+'</div><div class="sr-turn">'+esc(turnLabel)+'</div><div class="sr-clock-area'+(!ready&&number===1?' sr-warning':'')+'"><div class="sr-clock-label">'+(ready?'READY TO START':'NEXT REP IN')+'</div><div class="sr-clock">'+(ready?'0:05':fmt(countdown))+'</div><div class="sr-cue">'+(ready?'FIVE-SECOND COUNTDOWN ON GO':number===1?'BLEEP + MASTER FLASH':'LEAD SWIMMER')+'</div></div><p class="sr-instruction">'+esc(block.instruction)+'</p></div></div><div class="sr-lane-foot"><span class="sr-next">'+(ready?'Rep 1 of '+block.reps:'Current rep 2 / '+block.reps+' · next 3')+'</span><div class="sr-actions"><button type="button" class="sr-button sr-primary cursor-interaction" data-pause data-state="'+(ready?'ready':'running')+'">'+(ready?'Start':'Pause')+'</button><button type="button" class="sr-button cursor-interaction" data-stop>Stop</button></div></div><div class="sr-confirm" hidden><p>Stop lane '+number+' and return to ready?</p><div class="sr-actions"><button type="button" class="sr-button cursor-interaction" data-cancel>Keep running</button><button type="button" class="sr-button sr-danger cursor-interaction" data-confirm>Stop lane '+number+'</button></div></div></section>';
      }
      function update(){
        const now=performance.now()/1000;let cue=false,go=false;
        runtime.forEach((runner,index)=>{
          if(!runner.plan.reps.length)return;
          const t=runner.tick(now),p=runner.plan,pos=E.position(p,t);
          const current=pos.current||p.reps[0],next=pos.next;
          const rest=p.rests.find(r=>t>=r.start&&t<r.end);
          const ready=runner.status==='ready',paused=runner.status==='paused',resuming=runner.status==='resuming',active=runner.status==='running';
          const resumeLeft=runner.resumeUntil-now;
          // Only recent cues are emitted: returning to the tab never replays missed starts.
          if(active||resuming){
            const candidates=resuming?Array.from({length:5},(_,i)=>({at:runner.resumeUntil-5+i,id:'resume-'+runner.resumeUntil+'-'+i,go:false,time:now})):
              p.reps.flatMap((rep,i)=>Array.from({length:6},(_,j)=>({at:rep.start-5+j,id:'rep-'+i+'-'+j,go:j===5,time:t})));
            for(const c of candidates){const key=index+'-'+runner.anchor+'-'+c.id;if(c.time>=c.at&&c.time-c.at<.25&&!played.has(key)){played.set(key,true);cue=true;go=go||c.go;}}
          }
          root.querySelectorAll('.sr-lane[data-lane-number="'+(index+1)+'"]').forEach(lane=>{
            const set=(selector,value)=>lane.querySelector(selector).textContent=value;
            const workRep=rest?next:current;
            set('.sr-status',ready?'Ready':paused?'Paused':resuming?'Resuming':runner.status==='complete'?'Complete':pos.done?'Last swimmers finishing':rest?'Round rest':'Running');
            const pause=lane.querySelector('[data-pause]');pause.textContent=ready?'Start':paused?'Resume':runner.status==='complete'?'Run again':'Pause';
            set('.sr-meta span:first-child','ROUND '+((workRep?.round??current.round)+1)+' / '+p.rounds);
            set('.sr-meta span:last-child','BLOCK '+((workRep?.block??current.block)+1)+' / '+(workRep?.blocks??current.blocks));
            set('.sr-work',work(workRep||current));set('.sr-turn','Turnaround '+fmt((workRep||current).interval));set('.sr-instruction',(workRep||current).instruction);
            const remaining=ready?5:resuming?resumeLeft:pos.done?0:pos.remaining;
            const recent=active&&p.reps.some(r=>t>=r.start&&t-r.start<.35);
            const clock=lane.querySelector('.sr-clock');clock.classList.toggle('sr-words',pos.done&&!ready&&!resuming);
            clock.textContent=recent?'GO':pos.done&&!ready&&!resuming?'DONE':fmt(Math.ceil(remaining));
            set('.sr-clock-label',paused?'PAUSED':ready?'READY TO START':resuming?'RESUMING IN':pos.done?'LEAD SWIMMER COMPLETE':rest?'NEXT ROUND IN':!pos.current?'FIRST START IN':next?'NEXT REP IN':'FINAL TURNAROUND');
            const warn=(resuming&&resumeLeft<=5)||(active&&next&&pos.remaining<=5);
            lane.querySelector('.sr-clock-area').classList.toggle('sr-warning',Boolean(recent||(warn&&remaining%1>.45)));
            set('.sr-cue',paused?'ALL FIVE CLOCKS FROZEN':ready?'FIVE-SECOND COUNTDOWN ON GO':rest?'ROUND STARTS AUTOMATICALLY':pos.done?'':'LEAD SWIMMER · FIVE-SECOND WARNING');
            set('.sr-next',ready?'Rep 1 of '+current.reps:rest?'Next: round '+(next.round+1):'Rep '+(current.rep+1)+' / '+current.reps+(next?' · next '+(next.round!==current.round?'round '+(next.round+1):next.block!==current.block?'block '+(next.block+1):'rep '+(next.rep+1)): ' · final rep'));
            lane.querySelectorAll('.sr-swimmer').forEach((tile,i)=>{
              const s=E.position(p,t,i),flash=active&&p.reps.some(r=>t>=r.start+i*p.gap&&t-r.start-i*p.gap<.35);
              tile.classList.toggle('sr-start-flash',flash);
              tile.querySelector('.sr-swimmer-time').textContent=flash?'GO':ready?fmt(5+i*p.gap):s.done?'DONE':fmt(Math.ceil(s.remaining));
            });
          });
        });
        if(cue)beep(go);
        if(!runtime.some(r=>['running','resuming','paused'].includes(r.status))&&wakeLock){wakeLock.release().catch(()=>{});wakeLock=null;}
      }
  function roundUI(config,r,index){
    const round=config.roundData[r],blocks=roundBlocks(r,index);
    return '<section class="sr-round" data-round-index="'+r+'"><div class="sr-round-head"><button type="button" class="sr-round-toggle" data-open="'+r+'" aria-expanded="'+(!round.linked&&round.open)+'"><span class="sr-round-title">Round '+(r+1)+'</span><span aria-hidden="true">'+(!round.linked&&round.open?'−':'+')+'</span></button>'+(r>0?'<label class="sr-linked"><input type="checkbox" data-link="'+r+'"'+(round.linked?' checked':'')+'> Same as round 1</label>':'')+'</div>'+
      (!round.linked&&round.open?blocks.map((block,b)=>blockUI(block,r,b,index)).join('')+'<button class="sr-button sr-add" type="button" data-add="'+r+'">＋ Add block</button>':'<p class="sr-round-summary">'+(blocks.length?blocks.map(block=>esc(work(block))+' @ '+esc(block.time||'—')).join(' · '):'No blocks yet')+'</p>')+
      (r>0?'<label class="sr-round-rest">Extra rest before round '+(r+1)+'<input type="text" inputmode="text" autocapitalize="off" spellcheck="false" placeholder="m:ss" value="'+esc(round.rest)+'" data-rest="'+r+'" aria-label="Extra rest before round '+(r+1)+', minutes and seconds"></label>':'')+'</section>';
  }
  function laneEditor(index){
    const config=lanes[index];
    return '<section class="sr-lane-editor" data-editor-lane="'+index+'" aria-label="Lane '+(index+1)+' set builder"><header class="sr-editor-head"><div><h1>Lane '+(index+1)+'</h1><p>Independent set and swimmer gap</p></div>'+(index===1?'<button type="button" class="sr-button sr-danger" data-action="remove-lane">Remove lane</button>':'')+'</header><div class="sr-builder">'+
      '<div class="sr-library"><label class="sr-field sr-grow"><span>Saved sets on this device</span><select data-control="saved-sets"><option value="">Choose a saved set</option></select></label><button type="button" class="sr-button" data-action="new-set">New set</button><button type="button" class="sr-button" data-action="load" disabled>Load</button><button type="button" class="sr-button" data-action="rename" disabled>Rename</button><button type="button" class="sr-button sr-danger" data-action="delete-preset" disabled>Delete</button></div>'+
      '<div class="sr-builder-top"><div class="sr-field"><span>Rounds</span><div class="sr-choice" data-choice="rounds">'+[1,2,3,4].map(value=>'<button type="button" class="sr-button" data-value="'+value+'" aria-pressed="'+(value===config.rounds)+'">'+value+'</button>').join('')+'</div></div><label class="sr-field"><span>Swimmer send-off</span><select data-control="gap"><option value="5"'+(config.gap===5?' selected':'')+'>5 seconds</option><option value="10"'+(config.gap===10?' selected':'')+'>10 seconds</option></select></label></div>'+
      config.roundData.slice(0,config.rounds).map((_,r)=>roundUI(config,r,index)).join('')+'</div>'+
      '<footer class="sr-builder-foot"><label class="sr-field sr-save-name"><span>Set name</span><input data-control="set-name" value="'+esc(config.name)+'" maxlength="80" placeholder="Name your set"></label><span class="sr-editor-status" data-control="save-status" role="status"></span><div class="sr-actions"><button type="button" class="sr-button" data-action="save">'+(presetIds[index]?'Save changes':'Save set')+'</button><button type="button" class="sr-button" data-action="save-new">Save as new</button>'+(index===0&&laneCount===1?'<button type="button" class="sr-button sr-primary" data-action="add-lane">＋ Add Lane 2</button>':'')+'</div></footer><p class="sr-builder-message" data-control="builder-message" role="alert" hidden></p></section>';
  }
  function libraryButtons(index){const chosen=!!field('saved-sets',index).value;['load','rename','delete-preset'].forEach(action=>editor(index).querySelector('[data-action="'+action+'"]').disabled=!chosen);}
  function renderLibrary(index){
    try{
      const items=store.library().sets.sort((a,b)=>a.name.localeCompare(b.name)),select=field('saved-sets',index);
      select.innerHTML='<option value="">Choose a saved set</option>'+items.map(item=>'<option value="'+esc(item.id)+'">'+esc(item.name)+'</option>').join('');
      select.value=librarySelections[index]||presetIds[index]||'';libraryButtons(index);
    }catch(error){problem(error,index);}
  }
  function builder(index){
    if(index===undefined){root.querySelector('#sr-editors').innerHTML=Array.from({length:laneCount},(_,i)=>laneEditor(i)).join('');for(let i=0;i<laneCount;i++)renderLibrary(i);}
    else {editor(index).outerHTML=laneEditor(index);renderLibrary(index);}
    root.querySelector('#sr-ready-help').textContent=laneCount===2?'Open both clocks, then start each lane independently.':'Open the clock screen, then press Start when the swimmers are ready.';
  }
  function renderRuns(){
    const cards=(variant,count)=>runtime.slice(0,count).map((runner,index)=>{const c=runner.config;return displayLane(index+1,variant,runner.plan.reps.length?c.roundData[0].blocks[0]:null,c.rounds,c.roundData[0].blocks.length,c.gap,true);}).join('');
    root.querySelector('[data-run=single]').innerHTML=cards('single',1);root.querySelector('[data-run=dual]').innerHTML=cards('dual',2);update();
  }
  function checkpoint(){
    if(!runtime.length)return;
    try{const now=performance.now()/1000,wall=Date.now();store.saveSession({laneCount:runLaneCount,view:currentScreen,runners:runtime.map(r=>({config:r.config,state:r.checkpoint(now,wall)}))});}
    catch(error){notice(problem(error));}
  }
  async function wake(){try{if('wakeLock' in navigator)wakeLock=await navigator.wakeLock.request('screen');}catch{}}
  async function unlockSound(){try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();await audio.resume();soundStatus();}catch{document.getElementById('sound-note').textContent='Sound unavailable';}}
  function soundStatus(){document.getElementById('sound-note').textContent=audio?.state==='running'?'Sound on':'Enable sound';}
  function beep(go=false){if(audio?.state!=='running')return;const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=go?1300:880;g.gain.setValueAtTime(.001,audio.currentTime);g.gain.exponentialRampToValueAtTime(.6,audio.currentTime+.008);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+(go?.3:.12));o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+(go?.32:.14));}
  function status(index,text){field('save-status',index).textContent=text;}
  function selectedPreset(index){const id=field('saved-sets',index).value,item=store.library().sets.find(s=>s.id===id);if(!item)throw Error('Choose a saved set.');return item;}
  function saveNamed(index,asNew){
    let value=lanes[index];if(asNew){const name=prompt('Name for the new saved set',value.name+' copy');if(name===null)return;value={...value,name};}
    const item=store.savePreset(value,asNew?null:presetIds[index]);lanes[index].name=item.name;presetIds[index]=item.id;librarySelections[index]=item.id;
    field('set-name',index).value=item.name;for(let i=0;i<laneCount;i++)renderLibrary(i);
    editor(index).querySelector('[data-action="save"]').textContent='Save changes';field('builder-message',index).hidden=true;persistCurrent();status(index,'Saved “'+item.name+'”');
  }
  function editSets(index){builder();showScreen('setup');if(index!==undefined)editor(index)?.scrollIntoView({block:'start'});}
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.id==='sr-edit-sets'){editSets();return;}
    if(button.id==='sr-ready'){
      root.querySelector('#sr-global-error').hidden=true;
      for(let i=0;i<laneCount;i++){try{E.compile(lanes[i]);}catch(error){problem(Error('Lane '+(i+1)+': '+error.message));problem(error,i);editor(i).scrollIntoView({block:'start'});return;}}
      const changed=runLaneCount!==laneCount||lanes.slice(0,laneCount).some((c,i)=>JSON.stringify(E.compile(c))!==JSON.stringify(runtime[i]?.plan));
      if(changed){if(runtime.some(r=>['running','paused','resuming'].includes(r.status))&&!confirm('Apply the edited sets and return the clocks to ready? This stops the current timers.'))return;runtime=lanes.map(makeRunner);runLaneCount=laneCount;played.clear();renderRuns();}
      lanes.slice(0,laneCount).forEach((c,i)=>runtime[i].config=S.draft(c));persistCurrent();clearRecoveryNotice();showScreen(runLaneCount===2?'two':'one');checkpoint();return;
    }
    const laneCard=button.closest('.sr-lane');
    if(laneCard){
      const index=Number(laneCard.dataset.laneNumber)-1,runner=runtime[index];
      if(button.hasAttribute('data-build-lane')){editSets(index);return;}
      if(button.hasAttribute('data-stop'))laneCard.querySelector('.sr-confirm').hidden=false;
      else if(button.hasAttribute('data-cancel'))laneCard.querySelector('.sr-confirm').hidden=true;
      else if(button.hasAttribute('data-confirm')){runner.stop();laneCard.querySelector('.sr-confirm').hidden=true;update();checkpoint();}
      else if(button.hasAttribute('data-pause')){unlockSound();wake();const now=performance.now()/1000;if(['running','resuming'].includes(runner.status))runner.pause(now);else if(runner.status==='paused')runner.resume(now);else runner.start(now);update();checkpoint();}
      return;
    }
    const section=button.closest('[data-editor-lane]');if(!section)return;
    const index=Number(section.dataset.editorLane),config=lanes[index];
    try{
      const action=button.dataset.action;
      if(action==='add-lane'){lanes[1]=laneConfig();presetIds[1]=librarySelections[1]=null;laneCount=2;builder();persistCurrent();editor(1).scrollIntoView({block:'start'});return;}
      if(action==='remove-lane'){laneCount=1;lanes[1]=laneConfig();presetIds[1]=librarySelections[1]=null;builder();persistCurrent();return;}
      if(action==='new-set'){lanes[index]=laneConfig();presetIds[index]=librarySelections[index]=null;builder(index);persistCurrent();return;}
      if(action==='save'||action==='save-new'){saveNamed(index,action==='save-new');return;}
      if(action==='load'){const item=selectedPreset(index);lanes[index]=S.config(item.config);presetIds[index]=librarySelections[index]=item.id;builder(index);persistCurrent();status(index,'Loaded into lane '+(index+1));return;}
      if(action==='rename'){const item=selectedPreset(index),name=prompt('Rename saved set',item.name);if(name===null)return;const renamed=store.rename(item.id,name);lanes.forEach((c,i)=>{if(presetIds[i]===item.id&&c.name===item.name)c.name=renamed.name;});builder();persistCurrent();status(index,'Renamed to “'+renamed.name+'”');return;}
      if(action==='delete-preset'){const item=selectedPreset(index);if(!confirm('Delete saved set “'+item.name+'”? The current builders and timers will stay available.'))return;store.remove(item.id);presetIds.forEach((id,i)=>{if(id===item.id)presetIds[i]=null;if(librarySelections[i]===item.id)librarySelections[i]=null;});builder();status(index,'Saved set deleted');return;}
      if(button.closest('[data-choice=rounds]'))config.rounds=Number(button.dataset.value);
      else if(button.hasAttribute('data-open')){const round=config.roundData[Number(button.dataset.open)];if(!round.linked)round.open=!round.open;}
      else if(button.hasAttribute('data-add'))config.roundData[Number(button.dataset.add)].blocks.push(blankBlock());
      else if(button.hasAttribute('data-delete-block'))config.roundData[Number(button.dataset.deleteRound)].blocks.splice(Number(button.dataset.deleteBlock),1);
      else return;
      builder(index);persistCurrent();
    }catch(error){problem(error,index);}
  });
  function refreshPreview(index,blockElement){
    const config=lanes[index],r=Number(blockElement.dataset.round),b=Number(blockElement.dataset.block),model=config.roundData[r].blocks[b],sequence=timing(model,r,index).sequence;
    blockElement.querySelector('.sr-block-tag').textContent=work(model);
    const untouched=model.reps===''&&model.distance===''&&model.time==='';
    const valid=Number.isInteger(model.reps)&&model.reps>0&&model.reps<=100&&model.distance>0&&sequence.length&&sequence.every(x=>Number.isFinite(x)&&x>0),preview=blockElement.querySelector('.sr-sequence');
    preview.classList.toggle('sr-error',!valid&&!untouched);preview.textContent=untouched?'Enter reps, distance and turnaround.':valid?(model.type==='Fixed'?'Fixed turnaround · '+model.time:sequence.map(fmt).join(' → ')):'Enter valid reps, distance and positive turnarounds (m:ss).';
    editor(index).querySelectorAll('.sr-round').forEach((round,i)=>{const summary=round.querySelector('.sr-round-summary');if(summary)summary.textContent=roundBlocks(i,index).map(item=>work(item)+' @ '+(item.time||'—')).join(' · ')||'No blocks yet';});
  }
  root.addEventListener('input',event=>{
    const input=event.target,section=input.closest('[data-editor-lane]');if(!section)return;
    const index=Number(section.dataset.editorLane),config=lanes[index],block=input.closest('[data-block]');
    if(input.dataset.control==='set-name')config.name=input.value;
    if(input.hasAttribute('data-rest'))config.roundData[Number(input.dataset.rest)].rest=input.value;
    if(block&&input.dataset.field){const key=input.dataset.field;config.roundData[Number(block.dataset.round)].blocks[Number(block.dataset.block)][key]=['reps','distance','step'].includes(key)?(input.value===''?'':Number(input.value)):input.value;refreshPreview(index,block);}
    status(index,'');root.querySelector('#sr-global-error').hidden=true;queueDraft();
  });
  root.addEventListener('change',event=>{
    const input=event.target,section=input.closest('[data-editor-lane]');if(!section)return;
    const index=Number(section.dataset.editorLane),config=lanes[index],block=input.closest('[data-block]');
    if(input.dataset.control==='saved-sets'){librarySelections[index]=input.value;libraryButtons(index);return;}
    if(input.dataset.control==='gap')config.gap=Number(input.value);
    else if(input.hasAttribute('data-link')){const round=config.roundData[Number(input.dataset.link)];if(!input.checked)round.blocks=copy(config.roundData[0].blocks);round.linked=input.checked;round.open=!input.checked;builder(index);}
    else if(input.hasAttribute('data-rest'))config.roundData[Number(input.dataset.rest)].rest=input.value;
    else if(block&&input.dataset.field){const key=input.dataset.field;config.roundData[Number(block.dataset.round)].blocks[Number(block.dataset.block)][key]=['reps','distance','step'].includes(key)?(input.value===''?'':Number(input.value)):input.value;if(input.tagName==='SELECT')builder(index);}
    persistCurrent();
  });
  document.getElementById('sound-note').onclick=unlockSound;
  document.getElementById('full-screen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>{});};
  document.getElementById('dismiss-notice').onclick=()=>{document.getElementById('recovery-notice').hidden=true;fitLandscape();};
  let hadSaved=false,recovered=false,recoveryScreen='setup';
  try{const saved=store.current();if(saved){lanes.splice(0,2,...saved.lanes);laneCount=saved.laneCount;hadSaved=true;}}catch(error){notice('Saved setup could not be restored. '+problem(error));}
  runLaneCount=laneCount;runtime=lanes.map(makeRunner);
  try{
    const session=store.session();
    if(session&&session.runners.some(item=>item.state.status!=='ready')){
      const now=performance.now()/1000,wall=Date.now();
      const restored=session.runners.map(item=>{const c=S.draft(item.config),r=item.state.status==='ready'?makeRunner(c):E.Runner.restore(E.compile(c),item.state,now,wall);r.config=c;return r;});
      runtime=restored;runLaneCount=session.laneCount===2?2:1;recovered=true;
      if(!hadSaved){lanes.splice(0,2,...restored.map(r=>S.draft(r.config)));laneCount=runLaneCount;}
      recoveryScreen=session.view==='setup'?'setup':runLaneCount===2?'two':'one';
    }
  }catch(error){notice('Timer recovery could not be read. '+problem(error));}
  try{const saved=store.library().sets;lanes.forEach((c,i)=>presetIds[i]=saved.find(item=>item.name===c.name)?.id||null);}catch{}
  builder();renderRuns();showScreen(recoveryScreen);
  if(recovered){notice(runtime.some(r=>['running','resuming'].includes(r.status))?'Set recovered. Running clocks continued during the interruption. Tap Enable sound to restore bleeps.':runtime.some(r=>r.status==='paused')?'Set recovered. Paused clocks are still paused. Resume starts a five-second warning.':'Set recovered. The previous set has finished.');if(runtime.some(r=>['running','resuming'].includes(r.status)))wake();}
  const observer=new ResizeObserver(fitLandscape);observer.observe(root);observer.observe(document.getElementById('recovery-notice'));
  window.addEventListener('resize',fitLandscape);document.addEventListener('fullscreenchange',fitLandscape);
  function saveBeforeExit(){clearTimeout(draftTimer);persistCurrent();checkpoint();}
  window.addEventListener('pagehide',saveBeforeExit);window.addEventListener('beforeunload',saveBeforeExit);
  document.addEventListener('visibilitychange',()=>{saveBeforeExit();if(!document.hidden){update();soundStatus();if(runtime.some(r=>['running','resuming'].includes(r.status)))wake();}});
  setInterval(update,40);setInterval(checkpoint,1000);
})();
