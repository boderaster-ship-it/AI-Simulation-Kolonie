import { draw, hslToRgb, rgbString, rgbaString } from "./rendering.js";
import { angleNorm, makeBall, processRingForBall_Circle, processRingForBall_Lines } from './physics.js';
import { initAudio, playBounce, resetToneSeq } from './audio.js';
import { ui, setupUI, resetRunState } from './ui.js';

const main = document.getElementById('c');
const paint = document.getElementById('paintCanvas');
const ctx = main.getContext('2d');
const ptx = paint.getContext('2d');
const dpr = Math.max(1, window.devicePixelRatio || 1);

const state = {
  main, paint, ctx, ptx, dpr,
  W:0,H:0,CX:0,CY:0, pxPerMM:3.78*dpr,
  startScreen: document.getElementById('startScreen'),
  hud: document.getElementById('hud'),
  elLayers: document.getElementById('layersLeft'),
  elBounces: document.getElementById('bounces'),
  btnReset: document.getElementById('reset'),
  btnBack: document.getElementById('backMenu'),
  elMsg: document.getElementById('msg'),
  ui,
  BASE_ROT_SPEED:0.9, MAX_SUBSTEPS:16, SUBSTEP_PIXELS:0.7, MAX_BALLS:200,
  rings:[], lines:[], ringsLeft:0,
  NUM_RINGS:10, OPEN_VAL:40, MAX_SHOT:1100, G:1300, TRAIL_MAX:70,
  ballRadius:6,
  launched:false, aiming:true, aimX:0, aimY:0, finished:false,
  balls:[],
  bounceCount:0,
  audioCtx:null, masterGain:null,
    pendulum:{angle:Math.PI/4, vel:0, length:120, damping:0, gravity:2.5}
};

globalThis.state = state;

function updateHudPosition(){
  const s = state;
  let topPx;
  if (ui.shape.value === 'circle'){
    const edgeGap = Math.max(22*s.dpr,16);
    const outerR = Math.min(s.W,s.H)/2 - edgeGap;
    topPx = s.CY + outerR + 8*s.dpr;
  } else {
    const bottomGapPx = 24*s.dpr;
    topPx = s.H - bottomGapPx + 8*s.dpr;
  }
  s.hud.style.top = (topPx / s.dpr) + 'px';
}

function calibrateMM(){
  const mmDiv = document.getElementById('mmCal');
  const wCss = mmDiv.getBoundingClientRect().width;
  if (wCss>0) state.pxPerMM = (wCss/10) * dpr;
}

function resize(){
  const rect = main.getBoundingClientRect();
  const w = Math.floor(rect.width*dpr), h = Math.floor(rect.height*dpr);
  if (w===state.W && h===state.H) return;
  state.W=w; state.H=h; main.width=w; main.height=h; paint.width=w; paint.height=h; state.CX=w/2; state.CY=h/2;
  calibrateMM();
  updateHudPosition();
}
window.addEventListener('resize', resize, {passive:true});

function computeLevel(){
  const s=state;
  s.NUM_RINGS=+ui.numRings.value;
  s.OPEN_VAL=+ui.openWidth.value;
  s.MAX_SHOT=+ui.shotSpeed.value; s.G=+ui.gravity.value; s.TRAIL_MAX=+ui.trailLen.value;
  s.finished=false; resetToneSeq();
  s.rings.length=0; s.lines.length=0;
  const shape = ui.shape.value;
  if (shape==='circle'){
    const edgeGap = Math.max(22*dpr, 16);
    const Ravail = Math.min(s.W,s.H)/2 - edgeGap;
    const gapRatio = 0.33;
    const spanFactor = (s.NUM_RINGS + (s.NUM_RINGS-1)*gapRatio);
    let innerStart = 28*dpr;
    let thickness = (Ravail - innerStart) / spanFactor;
    if (!isFinite(thickness) || thickness <= 0){
      thickness = Math.max(1.5*dpr, Ravail / Math.max(1, spanFactor+1));
      innerStart = Math.max(8*dpr, Ravail - thickness*spanFactor);
    } else if (thickness < 1.5*dpr){
      thickness = Math.max(1.5*dpr, (Ravail - 8*dpr)/spanFactor);
      innerStart = Math.max(8*dpr, Ravail - thickness*spanFactor);
    }
    const gap = thickness * gapRatio;
    for (let i=0;i<s.NUM_RINGS;i++){
      const innerCirc = innerStart + i*(thickness+gap);
      const outerCirc = innerCirc + thickness;
      const midCirc   = (innerCirc + outerCirc)*0.5;
      const openCenter = Math.random()*Math.PI*2;
      const openWidthAngle = s.OPEN_VAL * Math.PI/180;
      const signDir = Math.random()<0.5?-1:1;
      const factor = 0.5 + Math.random();
      const rotSpeed = signDir * s.BASE_ROT_SPEED * factor;
      s.rings.push({ innerCirc, outerCirc, midCirc, openCenter, openWidthAngle, rotSpeed, removed:false });
    }
    s.ballRadius = Math.max(5*dpr, thickness * 0.23);
    resetRunState(shape);
  } else if (shape==='pendulum'){
    ui.drawMode.checked = true;
    s.ballRadius = Math.max(5*dpr, 6*dpr);
    s.pendulum.length = +ui.pendulumLen.value;
    resetRunState(shape);
    try{ if (s.audioCtx && s.audioCtx.state!=='closed') s.audioCtx.suspend(); }catch(e){}
    s.ringsLeft = 0;
    s.elLayers.textContent = '0';
    s.bounceCount = 0; s.elBounces.textContent = '0';
    s.elMsg.style.display='none';
    return;
  } else {
    const topGapPx = 24*dpr;
    const bottomGapPx = 24*dpr;
    const avail = s.H - topGapPx - bottomGapPx;
    const gapRatio = 0.33;
    const spanFactor = (s.NUM_RINGS + (s.NUM_RINGS-1)*gapRatio);
    let thickness = Math.max(10*dpr, avail / (spanFactor+0.0001));
    let gap = thickness * gapRatio;
    const totalNeeded = s.NUM_RINGS*thickness + (s.NUM_RINGS-1)*gap;
    if (totalNeeded > avail){
      const scale = avail / totalNeeded;
      thickness *= scale; gap *= scale;
    }
    const openPx = Math.max(6, s.OPEN_VAL * s.pxPerMM);
    for (let i=0;i<s.NUM_RINGS;i++){
      const yCenter = topGapPx + thickness/2 + i*(thickness+gap);
      const rotSpeed = s.BASE_ROT_SPEED * (0.6 + Math.random()*0.8) * (Math.random()<0.5?-1:1);
      const openX = Math.random()*s.W;
      s.lines.push({ y: yCenter, halfT: thickness/2, openX, openW: openPx, rotSpeed, removed:false });
    }
    s.ballRadius = Math.max(5*dpr, thickness * 0.35);
    resetRunState(shape);
  }
  s.elMsg.style.display='none';
  s.ringsLeft = (ui.shape.value==='circle' ? s.rings.length : s.lines.length);
  s.elLayers.textContent = String(s.ringsLeft);
  s.bounceCount = 0; s.elBounces.textContent = '0';
  updateHudPosition();
}

globalThis.resize = resize;
globalThis.computeLevel = computeLevel;

let lastT=0;
function step(ts){
  const s=state;
  const t=ts/1000;
  const dtFull=Math.min(0.033, t-lastT || 0.016);
  lastT=t;
  if (ui.shape.value==='circle'){
    for (const ring of s.rings){
      if (ring.removed) continue;
      ring.openCenter = angleNorm(ring.openCenter + ring.rotSpeed*dtFull);
    }
  } else if (ui.shape.value==='lines'){
    for (const L of s.lines){
      if (L.removed) continue;
      const margin = Math.max(20*dpr, L.openW*0.6);
      const amp = (s.W/2 - margin);
      const phase = (performance.now()*0.001) * L.rotSpeed;
      L.openX = s.CX + Math.sin(phase)*amp;
    }
  }
  if (ui.shape.value==='pendulum'){
    const b = s.balls[0];
    if (b){
      b.px = b.x; b.py = b.y;
      if (s.launched){
        const dx = s.CX - b.x, dy = s.CY - b.y;
        const dist = Math.hypot(dx,dy) || 1;
        const ax = dx/dist * s.G;
        const ay = dy/dist * s.G;
        b.vx += ax * dtFull;
        b.vy += ay * dtFull;
        const damp = s.pendulum.damping;
        b.vx *= (1 - damp*dtFull);
        b.vy *= (1 - damp*dtFull);
        b.x += b.vx*dtFull;
        b.y += b.vy*dtFull;
        const margin = b.r + 4*dpr;
        if (b.x < margin){ b.x = margin; b.vx = Math.abs(b.vx); playBounce(); }
        if (b.x > s.W - margin){ b.x = s.W - margin; b.vx = -Math.abs(b.vx); playBounce(); }
        if (b.y < margin){ b.y = margin; b.vy = Math.abs(b.vy); playBounce(); }
        if (b.y > s.H - margin){ b.y = s.H - margin; b.vy = -Math.abs(b.vy); playBounce(); }
      }
      b.trail.push({x:b.x,y:b.y});
      if (ui.drawMode.checked){
        let hue, sat=88, light=60;
        const mode = ui.drawColorMode.value;
        if (mode==='rainbow'){ b.hue=(b.hue+30*dtFull)%360; hue=b.hue; }
        else if (mode==='red'){ hue=0; }
        else if (mode==='blue'){ hue=210; }
        else if (mode==='green'){ hue=130; }
        else if (mode==='magenta'){ hue=300; }
        else if (mode==='cyan'){ hue=185; }
        else if (mode==='yellow'){ hue=55; }
        else if (mode==='white'){ hue=0; sat=0; light=96; }
        else if (mode==='neon'){
          const palette=[50,140,200,290,330];
          b.neonPhase=(b.neonPhase+dtFull*0.4)%1;
          hue=palette[Math.floor(b.neonPhase*palette.length)]; sat=96; light=62;
        } else { hue=200; }
        const [cr,cg,cb] = hslToRgb(hue, sat, light);
        const coreColor = rgbString(cr,cg,cb);
        const edgeColor = rgbString(50,50,50);
        const base  = Math.max(1.0, b.r);
        const coreW = Math.max(2.0, base * 1.0);
        const edgeW = coreW + Math.max(1.0, base * 0.0005);
        ptx.save();
        ptx.lineCap='round'; ptx.lineJoin='round';
        ptx.strokeStyle=edgeColor; ptx.lineWidth=edgeW;
        ptx.beginPath(); ptx.moveTo(b.px,b.py); ptx.lineTo(b.x,b.y); ptx.stroke(); ptx.restore();
        ptx.save(); ptx.lineCap='round'; ptx.lineJoin='round';
        ptx.strokeStyle=coreColor; ptx.lineWidth=coreW;
        ptx.shadowColor = rgbaString(0,0,0,0.35);
        ptx.shadowBlur = coreW * 0.6;
        ptx.shadowOffsetX = 1; ptx.shadowOffsetY = 1;
        ptx.beginPath(); ptx.moveTo(b.px,b.py); ptx.lineTo(b.x,b.y); ptx.stroke(); ptx.restore();
      } else if (b.trail.length>s.TRAIL_MAX){
        b.trail.shift();
      }
    }
  } else if (s.launched){
    let maxSpeed=0;
    for (const b of s.balls) maxSpeed=Math.max(maxSpeed, Math.hypot(b.vx,b.vy));
    const desiredSteps=Math.ceil((maxSpeed*dtFull)/s.SUBSTEP_PIXELS);
    const steps=Math.max(1, Math.min(s.MAX_SUBSTEPS, desiredSteps));
    const dt=dtFull/steps;
    for (let st=0; st<steps; st++){
      for (const b of s.balls){
        b.px=b.x; b.py=b.y;
        b.vy += s.G*dt;
        b.x  += b.vx*dt;
        b.y  += b.vy*dt;
        if (ui.shape.value==='circle'){
          let idx = b.ringIndex; while (idx < s.rings.length && s.rings[idx].removed) idx++; b.ringIndex = idx;
          if (idx < s.rings.length) processRingForBall_Circle(b, s.rings[idx]);
        } else {
          processRingForBall_Lines(b);
        }
        const margin = b.r + 4*dpr;
        if (b.x < margin){ b.x = margin; b.vx = Math.abs(b.vx); playBounce(); }
        if (b.x > s.W - margin){ b.x = s.W - margin; b.vx = -Math.abs(b.vx); playBounce(); }
        if (b.y < margin){ b.y = margin; b.vy = Math.abs(b.vy); playBounce(); }
        if (b.y > s.H - margin){ b.y = s.H - margin; b.vy = -Math.abs(b.vy); playBounce(); }
        b.trail.push({x:b.x,y:b.y});
        if (!ui.drawMode.checked && b.trail.length>s.TRAIL_MAX) b.trail.shift();
        if (ui.drawMode.checked){
          let hue, sat=88, light=60;
          const mode = ui.drawColorMode.value;
          if (mode==='rainbow'){ b.hue=(b.hue+30*dt)%360; hue=b.hue; }
          else if (mode==='red'){ hue=0; }
          else if (mode==='blue'){ hue=210; }
          else if (mode==='green'){ hue=130; }
          else if (mode==='magenta'){ hue=300; }
          else if (mode==='cyan'){ hue=185; }
          else if (mode==='yellow'){ hue=55; }
          else if (mode==='white'){ hue=0; sat=0; light=96; }
          else if (mode==='neon'){
            const palette=[50,140,200,290,330];
            b.neonPhase=(b.neonPhase+dt*0.4)%1;
            hue=palette[Math.floor(b.neonPhase*palette.length)]; sat=96; light=62;
          } else { hue=200; }
          const [cr,cg,cb] = hslToRgb(hue, sat, light);
          const coreColor = rgbString(cr,cg,cb);
          const edgeColor = rgbString(50,50,50);
          const base  = Math.max(1.0, b.r);
          const coreW = Math.max(2.0, base * 1.0);
          const edgeW = coreW + Math.max(1.0, base * 0.0005);
          ptx.save();
          ptx.lineCap='round'; ptx.lineJoin='round';
          ptx.strokeStyle=edgeColor; ptx.lineWidth=edgeW;
          ptx.beginPath(); ptx.moveTo(b.px,b.py); ptx.lineTo(b.x,b.y); ptx.stroke(); ptx.restore();
          ptx.save(); ptx.lineCap='round'; ptx.lineJoin='round';
          ptx.strokeStyle=coreColor; ptx.lineWidth=coreW;
          ptx.shadowColor = rgbaString(0,0,0,0.35);
          ptx.shadowBlur = coreW * 0.6;
          ptx.shadowOffsetX = 1; ptx.shadowOffsetY = 1;
          ptx.beginPath(); ptx.moveTo(b.px,b.py); ptx.lineTo(b.x,b.y); ptx.stroke(); ptx.restore();
        }
      }
    }
  }
  draw();
  requestAnimationFrame(step);
}

window.addEventListener('DOMContentLoaded', () => {
  setupUI();
  resize();
  requestAnimationFrame(step);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
});
