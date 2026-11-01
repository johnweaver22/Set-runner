(function(scope){
  'use strict';
  const E=typeof module!=='undefined'?require('./engine.js'):scope.SetRunnerEngine;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const KEYS={current:'swim-set-runner-v1',library:'swim-set-runner-library-v1',session:'swim-set-runner-session-v1'};
  function draft(value){
    if(!value||!Number.isInteger(value.rounds)||value.rounds<1||value.rounds>4||![5,10].includes(value.gap)||!Array.isArray(value.roundData)||value.roundData.length<value.rounds||value.roundData.length>4)throw Error('Invalid saved setup.');
    const result=copy(value);
    for(const round of result.roundData){if(round&&round.linked&&round.blocks===undefined)round.blocks=[];if(!round||!Array.isArray(round.blocks))throw Error('Invalid round.');for(const block of round.blocks)if(!block||!['Fixed','Descending','Ascending'].includes(block.type)||!['rep','round'].includes(block.apply)||!['Start','Final'].includes(block.anchor))throw Error('Invalid block.');}
    result.name=String(value.name||'').trim().slice(0,80);
    while(result.roundData.length<4)result.roundData.push({linked:true,rest:'0:00',open:false,blocks:copy(result.roundData[0].blocks)});
    return result;
  }
  function config(value){E.compile(value);const result=draft(value);result.name=result.name||'Untitled set';return result;}
  function name(value){const n=String(value||'').trim();if(!n||n.length>80)throw Error('Enter a set name of 1–80 characters.');return n;}
  class Store {
    constructor(storage){this.storage=storage;}
    read(key){const raw=this.storage.getItem(key);return raw?JSON.parse(raw):null;}
    write(key,value){this.storage.setItem(key,JSON.stringify(value));}
    current(){const c=this.read(KEYS.current);if(!c)return null;if(![1,2].includes(c.laneCount)||c.lanes?.length!==2)throw Error('Invalid saved setup.');return {laneCount:c.laneCount,lanes:c.lanes.map(draft)};}
    saveCurrent(lanes,laneCount){if(![1,2].includes(laneCount)||lanes.length!==2)throw Error('Invalid lanes.');this.write(KEYS.current,{lanes:lanes.map(draft),laneCount});}
    library(){
      let lib=this.read(KEYS.library);
      if(!lib){
        lib={version:1,sets:[]};
        const old=this.current();
        if(old)for(let i=0;i<old.laneCount;i++){
          let c;try{c=config(old.lanes[i]);}catch{continue;}let title=c.name;if(lib.sets.some(s=>s.name===title))title+=' · Lane '+(i+1);
          c.name=title;lib.sets.push({id:'imported-lane-'+i,name:title,config:c,updatedAt:Date.now()});
        }
        this.write(KEYS.library,lib);
      }
      if(lib.version!==1||!Array.isArray(lib.sets))throw Error('Saved-set library could not be read.');
      const ids=new Set();
      for(const item of lib.sets){if(typeof item.id!=='string'||!item.id||ids.has(item.id))throw Error('Invalid saved set.');ids.add(item.id);item.name=name(item.name);item.config=config(item.config);item.config.name=item.name;}
      return lib;
    }
    savePreset(value,id=null){
      const c=config(value),title=name(value.name),lib=this.library();
      if(lib.sets.some(s=>s.id!==id&&s.name.toLowerCase()===title.toLowerCase()))throw Error('That set name is already saved. Load it to update it, or choose a different name.');
      const index=id===null?-1:lib.sets.findIndex(s=>s.id===id);
      if(id!==null&&index<0)throw Error('The selected saved set no longer exists.');
      const item={id:id||('set-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),name:title,config:{...c,name:title},updatedAt:Date.now()};
      if(index<0)lib.sets.push(item);else lib.sets[index]=item;
      this.write(KEYS.library,lib);return copy(item);
    }
    rename(id,title){const item=this.library().sets.find(s=>s.id===id);if(!item)throw Error('Choose a saved set.');return this.savePreset({...item.config,name:name(title)},id);}
    remove(id){const lib=this.library(),index=lib.sets.findIndex(s=>s.id===id);if(index<0)throw Error('Choose a saved set.');lib.sets.splice(index,1);this.write(KEYS.library,lib);}
    saveSession(value){this.write(KEYS.session,{...value,version:1});}
    session(){const s=this.read(KEYS.session);if(!s)return null;if(s.version!==1||s.runners?.length!==2||!['one','two','setup'].includes(s.view))throw Error('Invalid timer recovery data.');return s;}
  }
  const api={Store,KEYS,config,draft};if(typeof module!=='undefined')module.exports=api;else scope.SetRunnerStorage=api;
})(globalThis);

