import { playBounce } from './audio.js';

export function angleNorm(a){ a%=Math.PI*2; return a<0?a+Math.PI*2:a; }
export function angleDiff(a,b){ let d=angleNorm(a)-angleNorm(b); d=(d+Math.PI)%(Math.PI*2)-Math.PI; return Math.abs(d); }
export function inOpening(theta, center, width){ return angleDiff(theta, center)<= (width*0.5); }

export function makeBall(x,y,vx=0,vy=0){
  const s = globalThis.state;
  return { x, y, px:x, py:y, vx, vy, r:s.ballRadius, trail:[], ringIndex:0, hue:Math.random()*360, neonPhase:Math.random() };
}

export function reflectRadial(b){
  const s = globalThis.state;
  const {CX,CY} = s;
  const r = Math.hypot(b.x-CX, b.y-CY); if (r===0) return;
  const nx=(b.x-CX)/r, ny=(b.y-CY)/r;
  const dot = b.vx*nx + b.vy*ny;
  b.vx -= 2*dot*nx; b.vy -= 2*dot*ny;
}

export function processRingForBall_Circle(b, ring){
  const s = globalThis.state;
  const {CX,CY,rings,elLayers,ui,MAX_BALLS,balls} = s;
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
        s.ringsLeft = rings.filter(r=>!r.removed).length;
        elLayers.textContent = String(s.ringsLeft);
        if (s.ringsLeft===0){
          if (ui.autoRestart.checked){ globalThis.computeLevel(); return; }
          else { s.launched=false; s.aiming=false; s.finished=true; s.elMsg.style.display='block'; }
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

export function processRingForBall_Lines(b){
  const s = globalThis.state;
  const {lines,elLayers,ui,MAX_BALLS,balls} = s;
  if (s.finished) return;
  let idx = b.ringIndex;
  while (idx < lines.length && lines[idx].removed) idx++;
  b.ringIndex = idx;
  if (idx >= lines.length) return;
  const L = lines[idx];
  const yTop = L.y - L.halfT;
  const left = L.openX - L.openW/2;
  const right= L.openX + L.openW/2;
  const prevAboveTop = (b.py + b.r <= yTop);
  const nowBelowTop = (b.y  + b.r >= yTop);
  const prevAboveMid = (b.py <= L.y);
  const nowBelowMid = (b.y >= L.y);
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
      s.ringsLeft = lines.filter(r=>!r.removed).length;
      elLayers.textContent = String(s.ringsLeft);
      if (s.ringsLeft===0){
        if (ui.autoRestart.checked){ globalThis.computeLevel(); return; }
        else { s.launched=false; s.aiming=false; s.finished=true; s.elMsg.style.display='block'; }
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
