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
  ballSlow: document.getElementById('ballSlow'),
  ballSlowVal: document.getElementById('ballSlowVal'),
  multi: document.getElementById('multi'),
  drawMode: document.getElementById('drawMode'),
  pendulumLen: document.getElementById('pendulumLen'),
  pendulumLenVal: document.getElementById('pendulumLenVal'),
  pendulumSlow: document.getElementById('pendulumSlow'),
  pendulumSlowVal: document.getElementById('pendulumSlowVal'),
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
  const isLines = ui.shape?.value === 'lines';
  if (ui.openWidthLbl?.firstChild){
    ui.openWidthLbl.firstChild.textContent = isLines ? "Öffnung (mm): " : "Öffnung (°): ";
  }
  if (ui.openWidthVal && ui.openWidth){
    ui.openWidthVal.textContent = ui.openWidth.value + (isLines ? " mm" : "°");
  }
}
export function syncLabels(){
  if (ui.numRingsVal && ui.numRings){ ui.numRingsVal.textContent = ui.numRings.value; }
  if (ui.shotSpeedVal && ui.shotSpeed){ ui.shotSpeedVal.textContent = ui.shotSpeed.value; }
  if (ui.gravityVal && ui.gravity){ ui.gravityVal.textContent = ui.gravity.value; }
  if (ui.trailLenVal && ui.trailLen){ ui.trailLenVal.textContent = ui.trailLen.value; }
  if (ui.ballSlowVal && ui.ballSlow){ ui.ballSlowVal.textContent = ui.ballSlow.value + '%'; }
  if (ui.pendulumLenVal && ui.pendulumLen){ ui.pendulumLenVal.textContent = ui.pendulumLen.value; }
  if (ui.pendulumLen && globalThis.state){ globalThis.state.pendulum.length = +ui.pendulumLen.value; }
  if (ui.pendulumSlowVal && ui.pendulumSlow){ ui.pendulumSlowVal.textContent = ui.pendulumSlow.value + '%'; }
  if (ui.pendulumSlow && globalThis.state){
    const pct = parseFloat(ui.pendulumSlow.value);
    globalThis.state.pendulum.damping = pct>0 ? -Math.log(1 - pct/100)/5 : 0;
  }
  if (ui.pitchShiftVal && ui.pitchShift){ ui.pitchShiftVal.textContent = ui.pitchShift.value; }
  if (ui.toneDurVal && ui.toneDur){
    ui.toneDurVal.textContent = parseFloat(ui.toneDur.value).toFixed(2) + " s";
  }
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
  const s=globalThis.state; if (ui.shape.value!=='pendulum') initAudio();
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
  const baseY = (ui.shape.value==='circle'? s.CY : s.spawnY);
  const ax=s.aimX-s.CX, ay=s.aimY-baseY;
  const len=Math.hypot(ax,ay);
  if (len>0.0001){
    const maxPull=Math.min(s.W,s.H)*0.46*0.55;
    const pull=Math.min(len, maxPull);
    const dirx=ax/len, diry=ay/len;
    const v= s.MAX_SHOT * (pull/maxPull*0.75 + 0.25);
    for (const b of s.balls){ b.vx=dirx*v; b.vy=diry*v; }
    s.launched=true; s.aiming=false; if (ui.shape.value!=='pendulum') initAudio();
  }
}

export function resetRunState(shapeMode){
  const s=globalThis.state;
  s.ptx.clearRect(0,0,s.W,s.H);
  s.ptx.lineCap='round'; s.ptx.lineJoin='round';
  s.balls.length=0;
  let spawnX = s.CX, spawnY = s.CY + 20*s.dpr;
  const mode = (shapeMode||ui.shape.value);
  if (mode==='lines'){
    spawnX = s.CX;
    spawnY = s.spawnY || s.H*0.3;
  } else if (mode==='pendulum'){
    spawnX = s.CX;
    spawnY = s.CY + s.pendulum.length * s.dpr;
  }
  const b = makeBall(spawnX, spawnY, 0, 0);
  b.trail.push({x:b.x,y:b.y});
  s.balls.push(b);
  s.aiming=true; s.launched=false;
  s.finished=false; s.elMsg.style.display='none';
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
  if (ui.shape.value!=='pendulum') initAudio();
}

export function setupUI(){
  [ui.numRings, ui.openWidth, ui.shotSpeed, ui.gravity, ui.trailLen, ui.ballSlow, ui.pendulumLen, ui.pendulumSlow, ui.pitchShift, ui.toneDur, ui.shape, ui.drawColorMode]
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
  ui.startBtn?.addEventListener('click', startGame);
  s.btnReset?.addEventListener('click', ()=>{ globalThis.computeLevel(); });
  s.btnBack?.addEventListener('click', async ()=>{
    s.hud.classList.add('hidden');
    s.startScreen.classList.remove('hidden');
    resetToMenuState();
    try{
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    }catch(e){}
  });
}
