(() => {
// ===== Canvas & Globals =====
const main = document.getElementById('c');
const paint = document.getElementById('paintCanvas');
const ctx = main.getContext('2d');
const ptx = paint.getContext('2d');
const dpr = Math.max(1, window.devicePixelRatio || 1);

let W=0,H=0,CX=0,CY=0, pxPerMM=3.78*dpr;

const startScreen = document.getElementById('startScreen');
const hud = document.getElementById('hud');
const elLayers = document.getElementById('layersLeft');
const elBounces= document.getElementById('bounces');
const btnReset = document.getElementById('reset');
const btnBack  = document.getElementById('backMenu');
const elMsg    = document.getElementById('msg');

// ===== UI =====
const ui = {
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

// ===== Helpers: HSL -> RGB (nur rgb/rgba-Strings benutzen) =====
function hslToRgb(h, s, l){
  h = ((h % 360) + 360) % 360;
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2*l - 1)) * s;
  const x = c * (1 - Math.abs(((h/60) % 2) - 1));
  const m = l - c/2;
  let r=0,g=0,b=0;
  if (0<=h && h<60)   { r=c; g=x; b=0; }
  else if (60<=h && h<120){ r=x; g=c; b=0; }
  else if (120<=h && h<180){ r=0; g=c; b=x; }
  else if (180<=h && h<240){ r=0; g=x; b=c; }
  else if (240<=h && h<300){ r=x; g=0; b=c; }
  else { r=c; g=0; b=x; }
  return [
    Math.round((r+m)*255),
    Math.round((g+m)*255),
    Math.round((b+m)*255)
  ];
}
function rgbString(r,g,b){ return `rgb(${r},${g},${b})`; }
function rgbaString(r,g,b,a){ return `rgba(${r},${g},${b},${a})`; }

function updateOpenUnitLabel(){
  const isLines = ui.shape.value === 'lines';
  ui.openWidthLbl.firstChild.textContent = isLines ? "Öffnung (mm): " : "Öffnung (°): ";
  ui.openWidthVal.textContent = ui.openWidth.value + (isLines ? " mm" : "°");
}
function syncLabels(){
  ui.numRingsVal.textContent = ui.numRings.value;
  ui.shotSpeedVal.textContent = ui.shotSpeed.value;
  ui.gravityVal.textContent = ui.gravity.value;
  ui.trailLenVal.textContent = ui.trailLen.value;
  ui.pitchShiftVal.textContent = ui.pitchShift.value;
  ui.toneDurVal.textContent = parseFloat(ui.toneDur.value).toFixed(2) + " s";
  updateOpenUnitLabel();
}
[ui.numRings, ui.openWidth, ui.shotSpeed, ui.gravity, ui.trailLen, ui.pitchShift, ui.toneDur, ui.shape, ui.drawColorMode]
  .forEach(el=>{ el.addEventListener('input', syncLabels); el.addEventListener('change', syncLabels); });
syncLabels();

// ===== Audio =====
let audioCtx=null, masterGain=null, bounceCount=0;
const scaleSemitones=[0,3,5,7,10,12,15,17];

// ----- Bekannte Melodien (Semitone-Offsets relativ zu A3 = 220 Hz) -----
// „Alle meine Entchen“ – erste zwei Zeilen mit Längen durch Wiederholungen
// C D E F | G G | A A | G G | F F | E |  C C | D D | E E | F | G G | F F | E E | D | C
const melodyEntchen = [
  3,5,7,8, 10,10, 12,12, 10,10, 8,8, 7,
  3,3, 5,5, 7,7, 8, 10,10, 8,8, 7,7, 5, 3
];

// James-Bond-Hauptmotiv (chromatisches E–F–E–Eb–E mit charakteristischem Sprung auf B)
// E4, F4, E4, Eb4, E4, B3,  E4, F4, E4, Eb4, E4, Bb3, B3,  E4 (Verstärkung durch Wiederholungen)
const melodyBond = [
  7,8,7,6,7, 2,
  7,8,7,6,7, 1,2,
  7,7
];
const melodyState = { idx: 0 };
function isMelodyMode(){
  const m = ui.toneOrder.value;
  return (m === 'melody_entchen' || m === 'melody_bond');
}
function currentMelodyArray(){
  return (ui.toneOrder.value === 'melody_entchen') ? melodyEntchen : melodyBond;
}
// ----- /NEU -----

const seqState = { idx:0, dir:1 };
function resetToneSeq(){
  const N=scaleSemitones.length;
  if (ui.toneOrder.value==='downup'){ seqState.idx=N-1; seqState.dir=-1; }
  else { seqState.idx=0; seqState.dir=1; }
  // NEU: Melodie auf Anfang setzen
  melodyState.idx = 0;
}
function nextScaleIndex(){
  const N=scaleSemitones.length;
  const mode = ui.toneOrder.value;
  if (mode==='random') return Math.floor(Math.random()*N);
  const out = seqState.idx;
  seqState.idx += seqState.dir;
  if (seqState.idx>=N-1 || seqState.idx<=0) seqState.dir *= -1;
  return out;
}
function initAudio(){
  if(!audioCtx){ audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    masterGain=audioCtx.createGain(); masterGain.gain.value=0.18; masterGain.connect(audioCtx.destination);
  }
  if(audioCtx.state==='suspended') audioCtx.resume();
}
function playBounce(){
  if(!audioCtx) return;
  const t=audioCtx.currentTime;
  const shift = parseInt(ui.pitchShift.value,10) || 0;
  const dur = Math.max(0.22, Math.min(5, parseFloat(ui.toneDur.value)||0.22));
  const type = ui.toneType.value;

  // ===== NEU: Frequenz aus Melodie ODER aus bestehender Skala =====
  let freq;
  if (isMelodyMode()){
    const arr = currentMelodyArray();
    const midx = melodyState.idx % arr.length;
    const semiAbs = arr[midx] + shift;         // globaler Pitch-Shift (Halbtöne)
    freq = 220 * Math.pow(2, semiAbs/12);      // A3=220 Hz
    melodyState.idx = (melodyState.idx + 1) % arr.length;
  } else {
    const idx = nextScaleIndex();
    const octave = (Math.floor(bounceCount/scaleSemitones.length))%2;
    const semi   = scaleSemitones[idx] + 12*octave + shift;
    freq = 220*Math.pow(2, semi/12);
  }
  // ===== /NEU =====

  if (type==='noise'){
    const len=Math.max(0.05, Math.min(5, dur)), sr=audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, Math.floor(sr*len), sr);
    const data = buffer.getChannelData(0); for (let i=0;i<data.length;i++) data[i]=(Math.random()*2-1);
    const src=audioCtx.createBufferSource(); src.buffer=buffer;
    const bp=audioCtx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=freq; bp.Q.value=2.5;
    const g=audioCtx.createGain(); g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(0.4,t+0.01); g.gain.exponentialRampToValueAtTime(0.0008,t+len);
    src.connect(bp); bp.connect(g); g.connect(masterGain); src.start(t); src.stop(t+len);
  } else if (type==='horn'){
    const osc=audioCtx.createOscillator(); osc.type='sawtooth'; osc.frequency.setValueAtTime(freq,t);
    const lfo=audioCtx.createOscillator(); lfo.type='sine'; lfo.frequency.value=6; const lfoG=audioCtx.createGain(); lfoG.gain.value=8;
    const g=audioCtx.createGain(); g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(0.5,t+0.02); g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
    lfo.connect(lfoG); lfoG.connect(osc.frequency); osc.connect(g); g.connect(masterGain);
    osc.start(t); lfo.start(t); osc.stop(t+dur+0.02); lfo.stop(t+dur+0.02);
  } else if (type==='fart'){
    const osc=audioCtx.createOscillator(); osc.type='square';
    const f0=Math.max(40, Math.min(160, freq*0.35)); osc.frequency.setValueAtTime(f0,t); osc.frequency.exponentialRampToValueAtTime(40,t+dur*0.8);
    const lp=audioCtx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=280;
    const g=audioCtx.createGain(); g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(0.6,t+0.015); g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
    osc.connect(lp); lp.connect(g); g.connect(masterGain); osc.start(t); osc.stop(t+dur+0.02);
  } else if (type==='pluck'){
    const len=Math.max(0.1, Math.min(3, dur)), sr=audioCtx.sampleRate;
    const buffer=audioCtx.createBuffer(1, Math.floor(sr*len), sr); const data=buffer.getChannelData(0); for (let i=0;i<data.length;i++) data[i]=(Math.random()*2-1);
    const src=audioCtx.createBufferSource(); src.buffer=buffer;
    const bp=audioCtx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=freq*2; bp.Q.value=8;
    const g=audioCtx.createGain(); g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(0.7,t+0.003); g.gain.exponentialRampToValueAtTime(0.0006,t+len);
    src.connect(bp); bp.connect(g); g.connect(masterGain); src.start(t); src.stop(t+len);
  } else {
    const osc=audioCtx.createOscillator(); osc.type=type; osc.frequency.setValueAtTime(freq,t);
    const g=audioCtx.createGain(); g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(0.35,t+0.012); g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
    osc.connect(g); g.connect(masterGain); osc.start(t); osc.stop(t+dur+0.02);
  }

  bounceCount++; elBounces.textContent=bounceCount;
}

// ===== Math/Utils =====
function angleNorm(a){ a%=Math.PI*2; return a<0?a+Math.PI*2:a; }
function angleDiff(a,b){ let d=angleNorm(a)-angleNorm(b); d=(d+Math.PI)%(Math.PI*2)-Math.PI; return Math.abs(d); }
function inOpening(theta, center, width){ return angleDiff(theta, center)<= (width*0.5); }

// ===== State =====
const BASE_ROT_SPEED=0.9, MAX_SUBSTEPS=16, SUBSTEP_PIXELS=0.7, MAX_BALLS=200;
let rings=[]; // für Kreis
let lines=[]; // für Linien
let ringsLeft=0;
let NUM_RINGS=10, OPEN_VAL=40, MAX_SHOT=1100, G=1300;
let TRAIL_MAX=70;
let ballRadius=6;
let launched=false, aiming=true, aimX=0, aimY=0, finished=false;
const balls=[];
function makeBall(x,y,vx=0,vy=0){
  return { x, y, px:x, py:y, vx, vy, r:ballRadius, trail:[], ringIndex:0, hue:Math.random()*360, neonPhase:Math.random() };
}

// ===== Layout / Resize =====
function calibrateMM(){
  const mmDiv = document.getElementById('mmCal');
  const wCss = mmDiv.getBoundingClientRect().width;
  if (wCss>0) pxPerMM = (wCss/10) * dpr;
}
function resize(){
  const rect = main.getBoundingClientRect();
  const w = Math.floor(rect.width*dpr), h = Math.floor(rect.height*dpr);
  if (w===W && h===H) return;
  W=w; H=h; main.width=W; main.height=H; paint.width=W; paint.height=H; CX=W/2; CY=H/2;
  calibrateMM();
}
window.addEventListener('resize', resize, {passive:true});

function computeLevel(){
  NUM_RINGS=+ui.numRings.value;
  OPEN_VAL=+ui.openWidth.value;
  MAX_SHOT=+ui.shotSpeed.value; G=+ui.gravity.value; TRAIL_MAX=+ui.trailLen.value;

  finished=false; resetToneSeq();

  rings.length=0; lines.length=0;

  const shape = ui.shape.value;

  if (shape==='circle'){
    // --- Autozoom für 30 Ringe mit konstantem Außenabstand ---
    const edgeGap = Math.max(22*dpr, 16);
    const Ravail = Math.min(W,H)/2 - edgeGap;
    const gapRatio = 0.33;
    const spanFactor = (NUM_RINGS + (NUM_RINGS-1)*gapRatio);

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

    for (let i=0;i<NUM_RINGS;i++){
      const innerCirc = innerStart + i*(thickness+gap);
      const outerCirc = innerCirc + thickness;
      const midCirc   = (innerCirc + outerCirc)*0.5;
      const openCenter = Math.random()*Math.PI*2;
      const openWidthAngle = OPEN_VAL * Math.PI/180;
      const signDir = Math.random()<0.5?-1:1;
      const factor = 0.5 + Math.random();
      const rotSpeed = signDir * BASE_ROT_SPEED * factor;
      rings.push({ innerCirc, outerCirc, midCirc, openCenter, openWidthAngle, rotSpeed, removed:false });
    }
    ballRadius = Math.max(5*dpr, thickness * 0.23);
    resetRunState(shape);

  } else {
    // ===== LINIEN: horizontale Balken mit Öffnung (mm), Ball fällt von oben nach unten =====
    const topGapPx = 24*dpr;
    const bottomGapPx = 24*dpr;
    const avail = H - topGapPx - bottomGapPx;
    const gapRatio = 0.33;
    const spanFactor = (NUM_RINGS + (NUM_RINGS-1)*gapRatio);

    let thickness = Math.max(10*dpr, avail / (spanFactor+0.0001));
    let gap = thickness * gapRatio;

    const totalNeeded = NUM_RINGS*thickness + (NUM_RINGS-1)*gap;
    if (totalNeeded > avail){
      const scale = avail / totalNeeded;
      thickness *= scale; gap *= scale;
    }

    const openPx = Math.max(6, OPEN_VAL * pxPerMM); // Öffnung in mm -> px
    for (let i=0;i<NUM_RINGS;i++){
      const yCenter = topGapPx + thickness/2 + i*(thickness+gap);
      const rotSpeed = BASE_ROT_SPEED * (0.6 + Math.random()*0.8) * (Math.random()<0.5?-1:1);
      const openX = Math.random()*W;
      lines.push({ y: yCenter, halfT: thickness/2, openX, openW: openPx, rotSpeed, removed:false });
    }
    ballRadius = Math.max(5*dpr, thickness * 0.35);
    resetRunState(shape);
  }

  elMsg.style.display='none';
  ringsLeft = (ui.shape.value==='circle' ? rings.length : lines.length);
  elLayers.textContent = String(ringsLeft);
  bounceCount = 0; elBounces.textContent = "0";
}

function resetRunState(shapeMode){
  ptx.clearRect(0,0,W,H);
  ptx.lineCap='round'; ptx.lineJoin='round';

  balls.length=0;
  let spawnX = CX, spawnY = CY + 20*dpr;
  if ((shapeMode||ui.shape.value)==='lines'){ // Spawn oben
    spawnX = CX;
    spawnY = Math.max(18*dpr, 10);
  }
  const b = makeBall(spawnX, spawnY, 0, 0);
  b.trail.push({x:b.x,y:b.y});
  balls.push(b);
  aiming=true; launched=false; finished=false; elMsg.style.display='none';
}

function resetToMenuState(){
  launched=false; aiming=false; finished=false;
  rings.length=0; lines.length=0; balls.length=0;
  ctx.clearRect(0,0,W,H); ptx.clearRect(0,0,W,H);
  elMsg.style.display='none'; bounceCount=0; elBounces.textContent='0'; elLayers.textContent='0';
  try { if (audioCtx && audioCtx.state!=='closed') audioCtx.suspend(); } catch(e){}
}

// ===== Input =====
function getPos(e){
  const rect=main.getBoundingClientRect();
  if (e.touches && e.touches.length){
    return { x:(e.touches[0].clientX-rect.left)*dpr, y:(e.touches[0].clientY-rect.top)*dpr };
  }
  return { x:(e.clientX-rect.left)*dpr, y:(e.clientY-rect.top)*dpr };
}
function pointerDown(e){
  initAudio();
  const p=getPos(e);
  if (!launched){ aiming=true; aimX=p.x; aimY=p.y; }
  else {
    const dx=p.x-CX, dy=p.y-CY;
    if (Math.hypot(dx,dy)<Math.min(W,H)*0.08) resetRunState();
  }
}
function pointerMove(e){ if(!aiming) return; const p=getPos(e); aimX=p.x; aimY=p.y; }
function pointerUp(){
  if (!aiming) return;
  const ax=aimX-CX, ay=aimY-CY;
  const len=Math.hypot(ax,ay);
  if (len>0.0001){
    const maxPull=Math.min(W,H)*0.46*0.55;
    const pull=Math.min(len, maxPull);
    const dirx=ax/len, diry=ay/len;
    const v= MAX_SHOT * (pull/maxPull*0.75 + 0.25);
    for (const b of balls){ b.vx=dirx*v; b.vy=diry*v; }
    launched=true; aiming=false; initAudio();
  }
}
main.addEventListener('mousedown', pointerDown);
main.addEventListener('mousemove', pointerMove);
window.addEventListener('mouseup', pointerUp);
main.addEventListener('touchstart', (e)=>{ pointerDown(e); }, {passive:true});
main.addEventListener('touchmove',  (e)=>{ pointerMove(e); },  {passive:true});
main.addEventListener('touchend',   (e)=>{ pointerUp(); },     {passive:true});

btnReset.addEventListener('click', ()=>{ computeLevel(); });

// ===== Kollisionslogik =====
function reflectRadial(b){
  const r = Math.hypot(b.x-CX, b.y-CY); if (r===0) return;
  const nx=(b.x-CX)/r, ny=(b.y-CY)/r;
  const dot = b.vx*nx + b.vy*ny;
  b.vx -= 2*dot*nx; b.vy -= 2*dot*ny;
}

function processRingForBall_Circle(b, ring){
  const rNow = Math.hypot(b.x-CX, b.y-CY);
  const rPrev= Math.hypot(b.px-CX, b.py-CY);
  const thNow= angleNorm(Math.atan2(b.y-CY, b.x-CX));

  const innerB = ring.innerCirc + b.r;
  const outerB = ring.outerCirc - b.r;
  const open = inOpening(thNow, ring.openCenter, ring.openWidthAngle);

  if (rPrev < innerB && rNow >= innerB){
    if (!open){
      const ux=(b.x-CX)/(rNow||1), uy=(b.y-CY)/(rNow||1);
      const snap = (innerB - 0.01);
      b.x = CX + ux*snap; b.y = CY + uy*snap;
      reflectRadial(b); playBounce();
    }
  } else if (rPrev > innerB && rNow <= innerB){
    if (!open){
      const ux=(b.x-CX)/(rNow||1), uy=(b.y-CY)/(rNow||1);
      const snap = (innerB + 0.01);
      b.x = CX + ux*snap; b.y = CY + uy*snap;
      reflectRadial(b); playBounce();
    }
  }
  if (rPrev < outerB && rNow >= outerB){
    if (open){
      if (!ring.removed){
        ring.removed = true;
        ringsLeft = rings.filter(r=>!r.removed).length;
        elLayers.textContent = String(ringsLeft);
        if (ringsLeft===0){
          if (ui.autoRestart.checked){ computeLevel(); return; }
          else { launched=false; aiming=false; finished=true; elMsg.style.display='block'; }
        }
      }
      b.ringIndex++;
      if (ui.multi.checked && balls.length < MAX_BALLS){
        const speed = Math.hypot(b.vx,b.vy), ang=Math.atan2(b.vy,b.vx), d=0.18;
        const nb = makeBall(b.x, b.y, Math.cos(ang+d)*speed, Math.sin(ang+d)*speed);
        nb.ringIndex = b.ringIndex; balls.push(nb);
        b.vx = Math.cos(ang-d)*speed; b.vy = Math.sin(ang-d)*speed;
      }
    } else {
      const ux=(b.x-CX)/(rNow||1), uy=(b.y-CY)/(rNow||1);
      const snap = (outerB - 0.01);
      b.x = CX + ux*snap; b.y = CY + uy*snap;
      reflectRadial(b); playBounce();
    }
  } else if (rPrev > outerB && rNow <= outerB){
    if (!open){
      const ux=(b.x-CX)/(rNow||1), uy=(b.y-CY)/(rNow||1);
      const snap = (outerB + 0.01);
      b.x = CX + ux*snap; b.y = CY + uy*snap;
      reflectRadial(b); playBounce();
    }
  }
}

function processRingForBall_Lines(b){
  if (finished) return;
  let idx = b.ringIndex;
  while (idx < lines.length && lines[idx].removed) idx++;
  b.ringIndex = idx;
  if (idx >= lines.length) return;

  const L = lines[idx];
  const yTop = L.y - L.halfT;
  const yBot = L.y + L.halfT;

  const left = L.openX - L.openW/2;
  const right= L.openX + L.openW/2;

  const prevAboveTop = (b.py <= yTop - b.r), nowBelowTop = (b.y  >= yTop + b.r);
  const prevAboveMid = (b.py <= L.y), nowBelowMid = (b.y >= L.y);

  if (prevAboveTop && nowBelowTop){
    if (!(b.x >= left && b.x <= right)){
      b.y = yTop - b.r - 0.01;
      b.vy = -Math.abs(b.vy);
      playBounce();
      return;
    }
  }
  if (prevAboveMid && nowBelowMid){
    if ((b.x >= left && b.x <= right)){
      L.removed = true;
      b.ringIndex++;
      ringsLeft = lines.filter(r=>!r.removed).length;
      elLayers.textContent = String(ringsLeft);
      if (ringsLeft===0){
        if (ui.autoRestart.checked){ computeLevel(); return; }
        else { launched=false; aiming=false; finished=true; elMsg.style.display='block'; }
      }
      if (ui.multi.checked && balls.length < MAX_BALLS){
        const speed = Math.hypot(b.vx,b.vy), ang=Math.atan2(b.vy,b.vx), d=0.14;
        const nb = makeBall(b.x, b.y, Math.cos(ang+d)*speed, Math.sin(ang+d)*speed);
        nb.ringIndex = b.ringIndex; balls.push(nb);
        b.vx = Math.cos(ang-d)*speed; b.vy = Math.sin(ang-d)*speed;
      }
    }
  } 
}

// ===== Loop =====
let lastT=0;
function step(ts){
  const t=ts/1000;
  const dtFull=Math.min(0.033, t-lastT || 0.016);
  lastT=t;

  if (ui.shape.value==='circle'){
    for (const ring of rings){
      if (ring.removed) continue;
      ring.openCenter = angleNorm(ring.openCenter + ring.rotSpeed*dtFull);
    }
  } else {
    for (const L of lines){
      if (L.removed) continue;
      const margin = Math.max(20*dpr, L.openW*0.6);
      const amp = (W/2 - margin);
      const phase = (performance.now()*0.001) * L.rotSpeed;
      L.openX = CX + Math.sin(phase)*amp;
    }
  }

  if (launched){
    let maxSpeed=0;
    for (const b of balls) maxSpeed=Math.max(maxSpeed, Math.hypot(b.vx,b.vy));
    const desiredSteps=Math.ceil((maxSpeed*dtFull)/SUBSTEP_PIXELS);
    const steps=Math.max(1, Math.min(MAX_SUBSTEPS, desiredSteps));
    const dt=dtFull/steps;

    for (let s=0;s<steps;s++){
      for (const b of balls){
        b.px=b.x; b.py=b.y;

        b.vy += G*dt;
        b.x  += b.vx*dt;
        b.y  += b.vy*dt;

        if (ui.shape.value==='circle'){
          let idx = b.ringIndex; while (idx < rings.length && rings[idx].removed) idx++; b.ringIndex = idx;
          if (idx < rings.length) processRingForBall_Circle(b, rings[idx]);
        } else {
          processRingForBall_Lines(b);
        }

        const margin = b.r + 4*dpr;
        if (b.x < margin){ b.x = margin; b.vx = Math.abs(b.vx); playBounce(); }
        if (b.x > W - margin){ b.x = W - margin; b.vx = -Math.abs(b.vx); playBounce(); }
        if (b.y < margin){ b.y = margin; b.vy = Math.abs(b.vy); playBounce(); }
        if (b.y > H - margin){ b.y = H - margin; b.vy = -Math.abs(b.vy); playBounce(); }

        // Trail-Punkte sammeln (für Normalmodus)
        b.trail.push({x:b.x,y:b.y});
        if (!ui.drawMode.checked && b.trail.length>TRAIL_MAX) b.trail.shift();

        // ======= ZEICHENMODUS – Kern (RGB) + dunkler Rand + Schatten =======
        if (ui.drawMode.checked){
          // Farbe wählen
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

          // 1) Rand
          ptx.save();
          ptx.lineCap = 'round';
          ptx.lineJoin = 'round';
          ptx.strokeStyle = edgeColor;
          ptx.lineWidth   = edgeW;
          ptx.beginPath();
          ptx.moveTo(b.px,b.py);
          ptx.lineTo(b.x,b.y);
          ptx.stroke();
          ptx.restore();

          // 2) Kern + Schatten
          ptx.save();
          ptx.lineCap = 'round';
          ptx.lineJoin = 'round';
          ptx.strokeStyle = coreColor;
          ptx.lineWidth   = coreW;
          ptx.shadowColor   = rgbaString(0,0,0,0.35);
          ptx.shadowBlur    = coreW * 0.6;
          ptx.shadowOffsetX = 1;
          ptx.shadowOffsetY = 1;
          ptx.beginPath();
          ptx.moveTo(b.px,b.py);
          ptx.lineTo(b.x,b.y);
          ptx.stroke();
          ptx.restore();
        }
        // ======= /ZEICHENMODUS =======
      }
    }
  }

  draw();
  requestAnimationFrame(step);
}

// ===== Render =====
function draw(){
  ctx.clearRect(0,0,W,H);
  const g = ctx.createRadialGradient(CX, CY, Math.min(W,H)*0.1, CX, CY, Math.min(W,H)*0.6);
  g.addColorStop(0, getComputedStyle(document.documentElement).getPropertyValue('--bg'));
  g.addColorStop(1, getComputedStyle(document.documentElement).getPropertyValue('--bg2'));
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  // Zentrum / Startmarker
  ctx.beginPath();
  const markerR = Math.max(2, 2.5*dpr);
  const mode = ui.shape.value;
  if (mode==='circle'){
    ctx.arc(CX, CY, markerR, 0, Math.PI*2);
  }else{
    ctx.arc(CX, Math.max(18*dpr, 10), markerR, 0, Math.PI*2);
  }
  ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--accent');
  ctx.fill();

  if (ui.shape.value==='circle'){
    for (let i=0;i<rings.length;i++){
      const ring=rings[i]; if (ring.removed) continue;
      const hue = 200 + i*9;
      const colorMain = `hsla(${hue}, 65%, 66%, 0.85)`; // UI/Ring bleibt wie gehabt
      const colorShine= `hsla(${hue}, 85%, 85%, 0.25)`;
      const tInner = ring.innerCirc, tOuter = ring.outerCirc;
      const thickness = (tOuter - tInner);
      const midR = ring.midCirc;

      ctx.save();
      ctx.lineCap='butt';

      ctx.lineWidth = thickness;
      const gapHalf = ring.openWidthAngle*0.5;
      const start = ring.openCenter + gapHalf;
      const end = ring.openCenter - gapHalf + Math.PI*2;

      ctx.strokeStyle=colorMain;
      ctx.beginPath(); ctx.arc(CX, CY, midR, start, end, false); ctx.stroke();

      ctx.strokeStyle=colorShine;
      ctx.lineWidth = Math.max(1, thickness*0.10);
      ctx.beginPath(); ctx.arc(CX, CY, midR - thickness*0.33, start, end, false); ctx.stroke();
      ctx.restore();
    }
  } else {
    for (let i=0;i<lines.length;i++){
      const L=lines[i]; if (L.removed) continue;
      const hue = 200 + i*9;
      const colorMain = `hsla(${hue}, 65%, 66%, 0.85)`;
      const colorShine= `hsla(${hue}, 85%, 85%, 0.25)`;

      const yTop = Math.round(L.y - L.halfT)+0.5, yBot=Math.round(L.y + L.halfT)+0.5;
      const left = L.openX - L.openW/2, right = L.openX + L.openW/2;

      ctx.save();
      ctx.strokeStyle=colorMain; ctx.lineWidth = yBot - yTop;
      ctx.beginPath(); ctx.moveTo(0, L.y); ctx.lineTo(Math.max(0,left), L.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(Math.min(W,right), L.y); ctx.lineTo(W, L.y); ctx.stroke();

      ctx.strokeStyle=colorShine; ctx.lineWidth = Math.max(1, (yBot-yTop)*0.25);
      const glossY = L.y - (yBot-yTop)*0.25;
      ctx.beginPath(); ctx.moveTo(0, glossY); ctx.lineTo(Math.max(0,left), glossY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(Math.min(W,right), glossY); ctx.lineTo(W, glossY); ctx.stroke();
      ctx.restore();
    }
  }

  // Ball & temporäre Spuren (wenn Zeichenmodus aus)
  for (const b of balls){
    if (!ui.drawMode.checked && b.trail.length>1){
      ctx.save();
      ctx.globalAlpha=0.9; ctx.lineJoin='round'; ctx.lineCap='round';
      for (let pass=0; pass<3; pass++){
        const alpha=(0.35 - pass*0.1); if (alpha<=0) continue;
        ctx.strokeStyle=`rgba(169,184,255,${alpha})`;
        ctx.lineWidth=Math.max(1, (b.r*(0.9 - pass*0.25)));
        ctx.beginPath();
        for (let i=0;i<b.trail.length;i++){
          const p=b.trail[i];
          if (i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fillStyle='#fff'; ctx.fill();
    ctx.lineWidth=Math.max(1,1.5*dpr); ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.stroke();
    ctx.restore();
  }

  // Zielhilfe
  if (aiming && !launched){
    const ax=aimX-(ui.shape.value==='circle'?CX:CX), ay=aimY-(ui.shape.value==='circle'?CY:Math.max(18*dpr,10));
    const len=Math.hypot(ax,ay);
    const maxPull=Math.min(W,H)*0.46*0.55;
    const pull=Math.min(len, maxPull);
    const dirx=ax/(len||1), diry=ay/(len||1);
    const baseX = (ui.shape.value==='circle'?CX:CX);
    const baseY = (ui.shape.value==='circle'?CY:Math.max(18*dpr,10));
    const tipX=baseX+dirx*pull, tipY=baseY+diry*pull;

    ctx.save();
    ctx.globalAlpha=0.9;
    const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent');
    ctx.strokeStyle=accent;
    ctx.lineWidth=Math.max(1,2*dpr);
    ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.beginPath();
    const side=10*dpr, nx=-diry, ny=dirx;
    ctx.moveTo(tipX,tipY);
    ctx.lineTo(tipX - dirx*14*dpr + nx*side, tipY - diry*14*dpr + ny*side);
    ctx.lineTo(tipX - dirx*14*dpr - nx*side, tipY - diry*14*dpr - ny*side);
    ctx.closePath(); ctx.fillStyle=accent; ctx.fill();
    ctx.restore();
  }
}

// ===== Start / Menu =====
async function startGame(){
  resize();
  computeLevel();
  hud.classList.remove('hidden');
  startScreen.classList.add('hidden');
  try{
    const el = document.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }catch(e){}
  initAudio();
}
ui.startBtn.addEventListener('click', startGame);

btnBack.addEventListener('click', async ()=>{
  hud.classList.add('hidden');
  startScreen.classList.remove('hidden');
  resetToMenuState(); // vollständiges Reset
  try{
    if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
  }catch(e){}
});

// ===== Init =====
resize();
requestAnimationFrame(step);
})();

