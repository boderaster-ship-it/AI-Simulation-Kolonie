import { initAudio } from './audio.js';
import { makeBall } from './physics.js';

export const ui = {
  shape: document.getElementById('shape'),
  numRings: document.getElementById('numRings'),
  numRingsVal: document.getElementById('numRingsVal'),
  openWidthLbl: document.getElementById('openWidthLbl'),
  openWidth: document.getElementById('openWidth'),
  openWidthVal: document.getElementById('openWidthVal'),
  shotSpeed: document.getElementById('shotSpeed'),
  shotSpeedVal: document.getElementById('shotSpeedVal'),
  gravity: document.getElementById('gravity'),
  gravityVal: document.getElementById('gravityVal'),
  trailLen: document.getElementById('trailLen'),
  trailLenVal: document.getElementById('trailLenVal'),
  multi: document.getElementById('multi'),
  drawMode: document.getElementById('drawMode'),
  drawColorMode: document.getElementById('drawColorMode'),
  pitchShift: document.getElementById('pitchShift'),
  pitchShiftVal: document.getElementById('pitchShiftVal'),
  toneDur: document.getElementById('toneDur'),
  toneDurVal: document.getElementById('toneDurVal'),
  toneOrder: document.getElementById('toneOrder'),
  toneType: document.getElementById('toneType'),
  autoRestart: document.getElementById('autoRestart'),
  startBtn: document.getElementById('startBtn')
};

export function updateOpenUnitLabel(){
  const isLines = ui.shape.value === 'lines';
  ui.openWidthLbl.firstChild.textContent = isLines ? "Öffnung (mm): " : "Öffnung (°): ";
  ui.openWidthVal.textContent = ui.openWidth.value + (isLines ? " mm" : "°");
}
export function syncLabels(){
  ui.numRingsVal.textContent = ui.numRings.value;
  ui.shotSpeedVal.textContent = ui.shotSpeed.value;
  ui.gravityVal.textContent = ui.gravity.value;
  ui.trailLenVal.textContent = ui.trailLen.value;
  ui.pitchShiftVal.textContent = ui.pitchShift.value;
  ui.toneDurVal.textContent = parseFloat(ui.toneDur.value).toFixed(2) + " s";
  updateOpenUnitLabel();
}

export function getPos(e){
  const s=globalThis.state;
  const rect=s.main.getBoundingClientRect();
  if (e.touches && e.touches.length){
    return { x:(e.touches[0].clientX-rect.left)*s.dpr, y:(e.touches[0].clientY-rect.top)*s.dpr };
  }
  return { x:(e.clientX-rect.left)*s.dpr, y:(e.clientY-rect.top)*s.dpr };
}

export function pointerDown(e){
  const s=globalThis.state; initAudio();
  const p=getPos(e);
  if (!s.launched){ s.aiming=true; s.aimX=p.x; s.aimY=p.y; }
  else {
    const dx=p.x-s.CX, dy=p.y-s.CY;
    if (Math.hypot(dx,dy)<Math.min(s.W,s.H)*0.08) resetRunState();
  }
}
export function pointerMove(e){ const s=globalThis.state; if(!s.aiming) return; const p=getPos(e); s.aimX=p.x; s.aimY=p.y; }
export function pointerUp(){
  const s=globalThis.state;
  if (!s.aiming) return;
  const ax=s.aimX-s.CX, ay=s.aimY-s.CY;
  const len=Math.hypot(ax,ay);
  if (len>0.0001){
    const maxPull=Math.min(s.W,s.H)*0.46*0.55;
    const pull=Math.min(len, maxPull);
    const dirx=ax/len, diry=ay/len;
    const v= s.MAX_SHOT * (pull/maxPull*0.75 + 0.25);
    for (const b of s.balls){ b.vx=dirx*v; b.vy=diry*v; }
    s.launched=true; s.aiming=false; initAudio();
  }
}

export function resetRunState(shapeMode){
  const s=globalThis.state;
  s.ptx.clearRect(0,0,s.W,s.H);
  s.ptx.lineCap='round'; s.ptx.lineJoin='round';
  s.balls.length=0;
  let spawnX = s.CX, spawnY = s.CY + 20*s.dpr;
  if ((shapeMode||ui.shape.value)==='lines'){
    spawnX = s.CX;
    spawnY = Math.max(18*s.dpr, 10);
  }
  const b = makeBall(spawnX, spawnY, 0, 0);
  b.trail.push({x:b.x,y:b.y});
  s.balls.push(b);
  s.aiming=true; s.launched=false; s.finished=false; s.elMsg.style.display='none';
}

export function resetToMenuState(){
  const s=globalThis.state;
  s.launched=false; s.aiming=false; s.finished=false;
  s.rings.length=0; s.lines.length=0; s.balls.length=0;
  s.ctx.clearRect(0,0,s.W,s.H); s.ptx.clearRect(0,0,s.W,s.H);
  s.elMsg.style.display='none'; s.bounceCount=0; s.elBounces.textContent='0'; s.elLayers.textContent='0';
  try { if (s.audioCtx && s.audioCtx.state!=='closed') s.audioCtx.suspend(); } catch(e){}
}

export async function startGame(){
  const s=globalThis.state;
  globalThis.resize();
  globalThis.computeLevel();
  s.hud.classList.remove('hidden');
  s.startScreen.classList.add('hidden');
  try{
    const el = document.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }catch(e){}
  initAudio();
}

export function setupUI(){
  [ui.numRings, ui.openWidth, ui.shotSpeed, ui.gravity, ui.trailLen, ui.pitchShift, ui.toneDur, ui.shape, ui.drawColorMode]
    .filter(Boolean)
    .forEach(el=>{
      el.addEventListener('input', syncLabels);
      el.addEventListener('change', syncLabels);
    });
  syncLabels();
  const s=globalThis.state;
  s.main.addEventListener('mousedown', pointerDown);
  s.main.addEventListener('mousemove', pointerMove);
  window.addEventListener('mouseup', pointerUp);
  s.main.addEventListener('touchstart', (e)=>{ pointerDown(e); }, {passive:true});
  s.main.addEventListener('touchmove',  (e)=>{ pointerMove(e); },  {passive:true});
  s.main.addEventListener('touchend',   (e)=>{ pointerUp(); },     {passive:true});
  ui.startBtn.addEventListener('click', startGame);
  s.btnReset.addEventListener('click', ()=>{ globalThis.computeLevel(); });
  s.btnBack.addEventListener('click', async ()=>{
    s.hud.classList.add('hidden');
    s.startScreen.classList.remove('hidden');
    resetToMenuState();
    try{
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    }catch(e){}
  });
}
