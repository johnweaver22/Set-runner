(function(scope){
  'use strict';
  const parse = value => /^\d+:[0-5]\d$/.test(value) ? Number(value.split(':')[0])*60+Number(value.split(':')[1]) : NaN;
  function compile(config) {
    if(!Number.isInteger(config.rounds)||config.rounds<1||config.rounds>4)throw Error('Choose 1–4 rounds.');
    if(![5,10].includes(config.gap))throw Error('Choose a 5 or 10 second swimmer gap.');
    let cursor=5;
    const reps=[],rests=[];
    for(let r=0;r<config.rounds;r++) {
      const round=config.roundData[r];
      if(!round)throw Error('Missing round.');
      const rest=r?parse(round.rest):0;
      if(!Number.isFinite(rest)||rest<0)throw Error('Enter round rest as m:ss.');
      if(rest){rests.push({start:cursor,end:cursor+rest,round:r});cursor+=rest;}
      const blocks=round.linked?config.roundData[0].blocks:round.blocks;
      if(!Array.isArray(blocks)||!blocks.length)throw Error('Add at least one block per round.');
      blocks.forEach((block,b)=>{
        if(!Number.isInteger(block.reps)||block.reps<1||block.reps>100||!Number.isFinite(block.distance)||block.distance<=0)throw Error('Enter 1–100 reps and a positive distance.');
        if(!['Fixed','Descending','Ascending'].includes(block.type)||!['rep','round'].includes(block.apply)||!['Start','Final'].includes(block.anchor))throw Error('Check turnaround settings.');
        const count=block.apply==='round'?config.rounds:block.reps;
        const step=block.type==='Fixed'?0:Number(block.step)*(block.type==='Descending'?-1:1);
        if(block.type!=='Fixed'&&(!Number.isInteger(block.step)||block.step<=0))throw Error('Enter a positive whole-second change.');
        const first=parse(block.time)-(block.anchor==='Final'?step*(count-1):0);
        for(let p=0;p<block.reps;p++) {
          const interval=first+step*(block.apply==='round'?r:p);
          if(!Number.isFinite(interval)||interval<=0)throw Error('Every turnaround must be positive (m:ss).');
          reps.push({start:cursor,end:cursor+interval,interval,round:r,block:b,rep:p,reps:block.reps,blocks:blocks.length,distance:block.distance,stroke:block.stroke,instruction:block.instruction||''});
          cursor+=interval;
        }
      });
    }
    return {reps,rests,rounds:config.rounds,gap:config.gap,end:cursor+4*config.gap,leadEnd:cursor};
  }
  class Runner {
    constructor(plan){this.plan=plan;this.status='ready';this.elapsed=0;this.anchor=0;this.resumeUntil=0;}
    time(now){return this.status==='running'?this.elapsed+Math.max(0,now-this.anchor):this.elapsed;}
    start(now){this.elapsed=0;this.anchor=now;this.status='running';this.resumeUntil=0;}
    pause(now){if(this.status==='running'){this.elapsed=this.time(now);this.status='paused';}else if(this.status==='resuming'){this.status='paused';}}
    resume(now){if(this.status==='paused'){this.resumeUntil=now+5;this.status='resuming';}}
    stop(){this.status='ready';this.elapsed=0;this.resumeUntil=0;}
    tick(now){if(this.status==='resuming'&&now>=this.resumeUntil){this.anchor=this.resumeUntil;this.status='running';}if(this.status==='running'&&this.time(now)>=this.plan.end){this.elapsed=this.plan.end;this.status='complete';}return this.time(now);}
    checkpoint(now,wall){
      this.tick(now);
      return {status:this.status,elapsed:this.time(now),savedAt:wall,resumeRemaining:this.status==='resuming'?Math.max(0,this.resumeUntil-now):0};
    }
    static restore(plan,saved,now,wall){
      if(!saved||!['ready','running','paused','resuming','complete'].includes(saved.status)||!Number.isFinite(saved.elapsed)||saved.elapsed<0||saved.elapsed>plan.end||!Number.isFinite(saved.savedAt)||!Number.isFinite(saved.resumeRemaining)||saved.resumeRemaining<0||saved.resumeRemaining>5)throw Error('Invalid timer recovery data.');
      const r=new Runner(plan),away=Math.max(0,(wall-saved.savedAt)/1000);
      r.elapsed=saved.elapsed;r.status=saved.status;
      if(r.status==='running'){r.elapsed+=away;r.anchor=now;}
      else if(r.status==='resuming'){
        const remaining=saved.resumeRemaining-away;
        if(remaining>0)r.resumeUntil=now+remaining;
        else {r.elapsed+=-remaining;r.anchor=now;r.status='running';}
      }
      if(r.status==='ready')r.elapsed=0;
      if(r.elapsed>=plan.end||r.status==='complete'){r.elapsed=plan.end;r.status='complete';}
      return r;
    }
  }
  function position(plan,t,swimmer=0){
    const offset=swimmer*plan.gap;
    const next=plan.reps.find(rep=>rep.start+offset>t);
    let current=null;for(const rep of plan.reps){if(rep.start+offset<=t)current=rep;else break;}
    const done=t>=plan.leadEnd+offset;
    return {next,current,done,remaining:next?next.start+offset-t:Math.max(0,plan.leadEnd+offset-t)};
  }
  const api={compile,Runner,position,parse};
  if(typeof module!=='undefined')module.exports=api;
  else scope.SetRunnerEngine=api;
})(globalThis);
