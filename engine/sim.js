import { createWorld } from './world.js';
import { createAgent } from './agent.js';
import { createColony } from './colony.js';
import { decide } from './brain.js';

export function createSim(canvas){
  const ctx = canvas.getContext('2d');
  let W=0,H=0,CELL=10,CW=0,CH=0;
  let running=false, raf=null;
  const colonies = [
    createColony('A','#59b1ff',{aggro:1.0}),
    createColony('B','#ff6b6b',{aggro:0.5})
  ];
  let world;

  function resize(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    W=canvas.width; H=canvas.height;
    CELL=Math.max(6,Math.floor(Math.min(W,H)/80));
    CW=Math.floor(W/CELL); CH=Math.floor(H/CELL);
    world=createWorld(CW,CH);
    colonies.forEach(c=>c.agents=[]);
    spawn();
  }
  window.addEventListener('resize', resize);

  function spawn(){
    for(let col=0;col<colonies.length;col++){
      for(let i=0;i<20;i++){
        let x=(Math.random()*CW)|0, y=(Math.random()*CH)|0;
        colonies[col].agents.push(createAgent(x,y,col));
      }
    }
  }

  function step(){
    colonies.forEach(colony=>{
      colony.agents.forEach(agent=>{
        if(!agent.alive) return;
        const act=decide(agent,world,colony);
        if(act==='EAT') agent.energy+=2;
        if(act==='ATTACK'){
          agent.energy-=2; colony.score+=1;
        }
        if(act==='MOVE'){ agent.x=(agent.x+((Math.random()*3)|0)-1+CW)%CW;
                          agent.y=(agent.y+((Math.random()*3)|0)-1+CH)%CH;
                          agent.energy-=1;}
        if(agent.energy<=0) agent.alive=false;
        agent.exp++;
        if(agent.exp>20){agent.lvl++;agent.exp=0;}
      });
    });
  }

  function draw(){
    ctx.fillStyle='#0b0d12'; ctx.fillRect(0,0,W,H);
    colonies.forEach(colony=>{
      ctx.fillStyle=colony.color;
      colony.agents.forEach(a=>{
        if(!a.alive) return;
        ctx.fillRect(a.x*CELL,a.y*CELL,CELL-1,CELL-1);
      });
    });
  }

  function loop(){
    step(); draw();
    raf=requestAnimationFrame(loop);
  }

  function start(){
    if(running) return;
    running=true; resize(); loop();
  }
  function stop(){running=false;cancelAnimationFrame(raf);}

  return { start, stop, colonies };
}
