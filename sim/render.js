export function createRenderer(canvas, engine){
  const ctx = canvas.getContext('2d', { alpha:false, desynchronized:true });
  let W=0,H=0,CW=0,CH=0,CELL=10;
  let theme='dark';
  let raf=null, redrawAll=true;

  const colors = {
    dark: { bg:'#0b0d12', obs:'#262b39', res:'#2ecf91', A:'#59b1ff', B:'#ff6b6b' },
    neon: { bg:'#05050a', obs:'#141428', res:'#00ffaa', A:'#22aaff', B:'#ff3377' },
    mono: { bg:'#0b0d12', obs:'#252525', res:'#b9b9b9', A:'#e0e0e0', B:'#a0a0a0' },
  };

  function resize(){
    const DPR = 1; // iPhone Performance
    canvas.style.width = innerWidth+'px';
    canvas.style.height = innerHeight+'px';
    canvas.width = Math.floor(innerWidth*DPR);
    canvas.height = Math.floor(innerHeight*DPR);
    W=canvas.width; H=canvas.height;
    CELL = Math.max(6, Math.floor(Math.min(W,H)/80));
    CW = Math.floor(W/CELL); CH = Math.floor(H/CELL);
    engine.setGrid(CW,CH,CELL);
    redrawAll = true;
  }

  function draw(){
    const pal = colors[theme] || colors.dark;
    const st = engine.state;
    const {resources:rs, obstacles:ob, occ, agents} = st;
    // Hintergrund (trails)
    if (redrawAll){
      ctx.fillStyle = pal.bg; ctx.fillRect(0,0,W,H);
      redrawAll=false;
    } else {
      ctx.globalAlpha=0.25; ctx.fillStyle=pal.bg; ctx.fillRect(0,0,W,H); ctx.globalAlpha=1;
    }

    // Tiles
    for (let y=0;y<CH;y++){
      const py = y*CELL;
      for (let x=0;x<CW;x++){
        const id = y*CW+x;
        if (ob && ob[id]){ ctx.fillStyle = pal.obs; ctx.fillRect(x*CELL,py,CELL,CELL); }
        else if (rs && rs[id]){ ctx.fillStyle = pal.res; ctx.fillRect(x*CELL+1,py+1,CELL-2,CELL-2); }
      }
    }

    // Agents
    for (let i=0;i<agents.length;i++){
      const a = agents[i]; if (!a.alive) continue;
      ctx.fillStyle = a.col===0 ? pal.A : pal.B;
      const px=a.x*CELL, py=a.y*CELL;
      ctx.fillRect(px+1,py+1,CELL-2,CELL-2);
      // Energy bar
      const ratio = Math.max(0,Math.min(1,a.e/30));
      ctx.fillStyle = '#0b0d12'; ctx.fillRect(px+1,py+1,CELL-2,3);
      ctx.fillStyle = ratio>0.5? '#6fda9b' : (ratio>0.25? '#ffd166' : '#ff7b7b');
      ctx.fillRect(px+1,py+1,(CELL-2)*ratio,3);
    }
  }

  function loop(){
    draw(); raf = requestAnimationFrame(loop);
  }

  function start(){ cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
  function stop(){ cancelAnimationFrame(raf); }
  function setTheme(t){ theme=t; redrawAll=true; }

  return { resize, start, stop, setTheme };
}
