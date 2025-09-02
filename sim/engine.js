// RL-Engine: zwei Kolonien, Q-Learning (geteilte Q-Tabellen je Kolonie)
export function createEngine(){
  const A=0,B=1;
  const ACTIONS = ["UP","DOWN","LEFT","RIGHT","STAY","ATTACK"];
  const DIRS = [[0,-1],[0,1],[-1,0],[1,0],[0,0]];

  const COLS = [
    {name:"A", color:"#59b1ff", aggro:1.05, gather:0.75, attack:8, share:1.0},
    {name:"B", color:"#ff6b6b", aggro:0.60, gather:1.20, attack:6, share:1.0}
  ];

  const state = {
    running:false, paused:false,
    wrap:true, tick:0, stepsPerSec:90,
    cw:0,ch:0, cell:10,
    resources:null, obstacles:null, occ:null,
    agents:[], score:[0,0],
    qTables:[new Map(), new Map()],
    params:{ alpha:0.2, epsilon:0.1, gamma:0.9, vision:4, startAgents:22, resPct:0.06, obsPct:0.06 },
    liveResPct:0.06
  };

  // ---- Helpers ----
  const idx = (x,y)=> y*state.cw + x;
  const inBounds = (x,y)=> x>=0 && y>=0 && x<state.cw && y<state.ch;
  const wrapC = (x,y)=>{
    if (!state.wrap) return [x,y];
    if (x<0) x+=state.cw; if (x>=state.cw) x-=state.cw;
    if (y<0) y+=state.ch; if (y>=state.ch) y-=state.ch;
    return [x,y];
  };

  function setGrid(cw,ch,cell){
    state.cw=cw; state.ch=ch; state.cell=cell;
  }

  function resetWorld(){
    state.resources = new Uint8Array(state.cw*state.ch);
    state.obstacles = new Uint8Array(state.cw*state.ch);
    state.occ = new Int32Array(state.cw*state.ch); state.occ.fill(-1);
  }

  function carveDisk(cx,cy,r){
    for (let y=-r;y<=r;y++) for (let x=-r;x<=r;x++){
      const dx=cx+x, dy=cy+y;
      if (!inBounds(dx,dy)) continue;
      if (x*x+y*y<=r*r) state.obstacles[idx(dx,dy)] = 0;
    }
  }

  function seedWorld(resPct, obsPct){
    // Obstacles
    for (let i=0;i<state.cw*state.ch;i++){
      state.obstacles[i] = (Math.random()<obsPct) ? 1 : 0;
    }
    // Bases freiräumen
    const baseA = {x:Math.floor(state.cw*0.15), y:Math.floor(state.ch*0.5)};
    const baseB = {x:Math.floor(state.cw*0.85), y:Math.floor(state.ch*0.5)};
    carveDisk(baseA.x, baseA.y, 5);
    carveDisk(baseB.x, baseB.y, 5);

    // Ressourcen
    const target = Math.floor(state.cw*state.ch*resPct);
    let placed=0, guard=0;
    while(placed<target && guard<target*50){
      guard++;
      const x=(Math.random()*state.cw)|0, y=(Math.random()*state.ch)|0;
      const id=idx(x,y);
      if (!state.obstacles[id] && state.resources[id]===0) {
        state.resources[id]=1; placed++;
      }
    }
  }

  function spawnAgents(n){
    state.agents = [];
    const bases = [
      {cx:Math.floor(state.cw*0.15),cy:Math.floor(state.ch*0.5)},
      {cx:Math.floor(state.cw*0.85),cy:Math.floor(state.ch*0.5)}
    ];
    for (let col=0; col<2; col++){
      let spawned=0, tries=0;
      while (spawned<n && tries<6000){
        tries++;
        const ang = Math.random()*Math.PI*2;
        const r = 2 + (Math.random()*6|0);
        let x = bases[col].cx + Math.round(Math.cos(ang)*r);
        let y = bases[col].cy + Math.round(Math.sin(ang)*r);
        if (!state.wrap && !inBounds(x,y)) continue;
        [x,y] = wrapC(x,y);
        const id=idx(x,y);
        if (state.obstacles[id] || state.occ[id]!==-1) continue;
        const i = state.agents.length;
        state.agents.push({x,y,col, e:26, alive:true});
        state.occ[id]=i; spawned++;
      }
    }
  }

  // ---- Perception ----
  function nearestOf(x,y,rad,kind,col){
    let best=1e9, bestDir='C';
    for (let dy=-rad; dy<=rad; dy++){
      for (let dx=-rad; dx<=rad; dx++){
        let xx=x+dx, yy=y+dy;
        if (state.wrap) [xx,yy]=wrapC(xx,yy); else if(!inBounds(xx,yy)) continue;
        const id=idx(xx,yy);
        let ok=false;
        if (kind==='res') ok = state.resources[id]===1;
        else {
          const a = state.occ[id];
          if (a!==-1 && state.agents[a].alive){
            ok = (kind==='enemy') ? (state.agents[a].col!==col) : (state.agents[a].col===col && !(dx===0&&dy===0));
          }
        }
        if (ok){
          const d=Math.abs(dx)+Math.abs(dy);
          if (d<best){
            best=d;
            // Richtung grob
            if (dx===0 && dy===0) bestDir='C';
            else if (Math.abs(dx)>Math.abs(dy)) bestDir = dx<0?'W':'E';
            else bestDir = dy<0?'N':'S';
            // diagonale Hinweise
            if (dx<0&&dy<0) bestDir='NW';
            if (dx>0&&dy<0) bestDir='NE';
            if (dx<0&&dy>0) bestDir='SW';
            if (dx>0&&dy>0) bestDir='SE';
          }
        }
      }
    }
    return {dist:best, dir:bestDir};
  }

  function hashState(a){
    const v = state.params.vision|0;
    const onRes = state.resources[idx(a.x,a.y)] ? 1:0;
    const life = (a.e<10)?0:(a.e<25)?1:2;
    const R = nearestOf(a.x,a.y,v,'res');
    const E = nearestOf(a.x,a.y,v,'enemy',a.col);
    const L = nearestOf(a.x,a.y,v,'ally',a.col);
    return `${R.dir}|${E.dir}|${L.dir}|${onRes}|${life}`;
  }

  function getQ(table,s){
    let v = table.get(s);
    if (!v){ v = new Float32Array(ACTIONS.length); table.set(s,v); }
    return v;
  }

  function chooseAction(a,s){
    const table = state.qTables[a.col];
    const q = getQ(table,s);
    if (Math.random() < state.params.epsilon){
      return (Math.random()*ACTIONS.length)|0;
    } else {
      let bi=0, best=q[0];
      for (let i=1;i<q.length;i++) if (q[i]>best){ best=q[i]; bi=i; }
      return bi;
    }
  }

  function stepAgent(ai){
    const a = state.agents[ai];
    if (!a.alive) return;
    const s = hashState(a);
    const act = chooseAction(a,s);

    let reward = -0.04; // Schritt-Kosten
    const mv = act<=4 ? DIRS[act] : [0,0];
    let nx=a.x+mv[0], ny=a.y+mv[1];
    if (!state.wrap){
      if (!inBounds(nx,ny)) { reward-=0.3; nx=a.x; ny=a.y; }
    }
    [nx,ny] = wrapC(nx,ny);
    const from=idx(a.x,a.y), to=idx(nx,ny);

    if (state.obstacles[to] || (state.occ[to]!==-1 && (mv[0]||mv[1]))){
      reward -= 0.18;
      nx=a.x; ny=a.y;
    } else if (nx!==a.x || ny!==a.y){
      state.occ[from] = -1;
      state.occ[to] = ai;
      a.x=nx; a.y=ny;
    }

    // ATTACK
    if (act===5){
      const neigh = [[0,-1],[0,1],[-1,0],[1,0]];
      let hit=false;
      for (const [dx,dy] of neigh){
        let xx=a.x+dx, yy=a.y+dy;
        [xx,yy]=wrapC(xx,yy);
        const id=idx(xx,yy);
        const j=state.occ[id];
        if (j!==-1 && state.agents[j].alive && state.agents[j].col!==a.col){
          state.agents[j].e -= COLS[a.col].attack|0;
          hit=true; reward += 0.55 * COLS[a.col].aggro;
          if (state.agents[j].e<=0){
            state.agents[j].alive=false; state.occ[id]=-1;
            state.score[a.col]+=8; reward += 1.8 * COLS[a.col].aggro;
          }
          break;
        }
      }
      if (!hit) reward -= 0.12;
    }

    // Ressourcen sammeln
    const cid = idx(a.x,a.y);
    if (state.resources[cid]===1){
      state.resources[cid]=0; a.e+=10; state.score[a.col]+=1;
      reward += 0.85 * COLS[a.col].gather;
    }

    // Energieverbrauch / Tod
    a.e -= 1;
    if (a.e<=0){
      a.alive=false; state.occ[cid]=-1; reward -= 0.9;
    }

    // Q-Update
    const s2 = hashState(a);
    const q = getQ(state.qTables[a.col], s);
    const q2 = getQ(state.qTables[a.col], s2);
    const maxQ2 = Math.max(...q2);
    const {alpha,gamma} = state.params;
    q[act] = (1-alpha)*q[act] + alpha*(reward + gamma*maxQ2);
  }

  // Ressourcen-Level dynamisch an Ziel anpassen
  function maintainResources(){
    const target = Math.floor(state.cw*state.ch*state.liveResPct);
    let current = 0;
    // schneller Zähler
    for (let i=0;i<state.resources.length;i++) current += state.resources[i];
    const delta = target - current;
    if (delta===0) return;
    const step = Math.sign(delta) * Math.min(Math.abs(delta), Math.max(3, (state.cw*state.ch/400|0)));
    if (step>0){
      let placed=0, guard=0;
      while (placed<step && guard<step*30){
        guard++;
        const x=(Math.random()*state.cw)|0, y=(Math.random()*state.ch)|0, id=idx(x,y);
        if (!state.obstacles[id] && state.resources[id]===0 && state.occ[id]===-1){
          state.resources[id]=1; placed++;
        }
      }
    } else {
      let removed=0, guard=0, need=Math.abs(step);
      while (removed<need && guard<need*30){
        guard++;
        const x=(Math.random()*state.cw)|0, y=(Math.random()*state.ch)|0, id=idx(x,y);
        if (state.resources[id]===1){ state.resources[id]=0; removed++; }
      }
    }
  }

  // ---- Public API ----
  let raf=null, last=0, acc=0, fps=0, fpsSm=0;
  const listeners = { stats:[] };
  function onStats(cb){ listeners.stats.push(cb); }

  function tick(dt){
    // Steps
    acc += dt*state.stepsPerSec;
    const steps = Math.min(600, acc|0);
    acc -= steps;

    if (!state.paused){
      // Agenten in zufälliger Reihenfolge
      if (state.agents.length>1){
        for (let k=state.agents.length-1;k>0;k--){
          const j=(Math.random()*(k+1))|0; const t=state.agents[k]; state.agents[k]=state.agents[j]; state.agents[j]=t;
        }
      }
      for (let s=0;s<steps;s++){
        state.tick++;
        for (let i=0;i<state.agents.length;i++) stepAgent(i);
        maintainResources();
      }
    }
    // Stats
    const aAlive = state.agents.filter(x=>x.alive && x.col===A).length;
    const bAlive = state.agents.filter(x=>x.alive && x.col===B).length;
    listeners.stats.forEach(cb=>cb({
      tick:state.tick, fps:fpsSm|0,
      aAlive, bAlive, aScore:state.score[A], bScore:state.score[B]
    }));
  }

  function loop(ts){
    if (!state.running) return;
    if (!last) last=ts;
    const dt = Math.min(0.1,(ts-last)/1000); last=ts;
    fps = 1/dt; fpsSm = fpsSm*0.9 + fps*0.1;
    tick(dt);
    raf = requestAnimationFrame(loop);
  }

  function start(cfg){
    state.running=true; state.paused=false; state.tick=0;
    state.wrap = !!cfg.wrap;
    state.stepsPerSec = cfg.stepsPerSec|0;
    state.params.alpha = +cfg.alpha;
    state.params.epsilon = +cfg.epsilon;
    state.params.vision = cfg.vision|0;
    state.params.startAgents = cfg.startAgents|0;
    state.params.resPct = +cfg.resPct;
    state.params.obsPct = +cfg.obsPct;
    state.liveResPct = +cfg.liveResPct;

    // Welt
    resetWorld();
    seedWorld(state.params.resPct, state.params.obsPct);
    spawnAgents(state.params.startAgents);
    // Q neu
    state.qTables=[new Map(), new Map()];
    // Go
    last=0; acc=0; fpsSm=0;
    cancelAnimationFrame(raf); raf=requestAnimationFrame(loop);
  }

  function stop(){ state.running=false; cancelAnimationFrame(raf); }
  function pause(){ state.paused=true; }
  function resume(){ state.paused=false; }

  return {
    state, setGrid, start, stop, pause, resume, onStats
  };
}
