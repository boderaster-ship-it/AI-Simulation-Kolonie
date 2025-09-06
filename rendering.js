export function hslToRgb(h, s, l){
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
export function rgbString(r,g,b){ return `rgb(${r},${g},${b})`; }
export function rgbaString(r,g,b,a){ return `rgba(${r},${g},${b},${a})`; }

export function draw(){
  const s = globalThis.state;
  const {ctx,W,H,CX,CY,dpr,rings,lines,balls,ui,aiming,launched,aimX,aimY} = s;
  ctx.clearRect(0,0,W,H);
  const g = ctx.createRadialGradient(CX, CY, Math.min(W,H)*0.1, CX, CY, Math.min(W,H)*0.6);
  g.addColorStop(0, getComputedStyle(document.documentElement).getPropertyValue('--bg'));
  g.addColorStop(1, getComputedStyle(document.documentElement).getPropertyValue('--bg2'));
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  ctx.beginPath();
  const markerR = Math.max(2, 2.5*dpr);
  const mode = ui.shape.value;
  if (mode==='lines'){
    ctx.arc(CX, s.spawnY || Math.max(18*dpr, 10), markerR, 0, Math.PI*2);
  } else {
    ctx.arc(CX, CY, markerR, 0, Math.PI*2);
  }
  ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--accent');
  ctx.fill();

  if (ui.shape.value==='circle'){
    for (let i=0;i<rings.length;i++){
      const ring=rings[i]; if (ring.removed) continue;
      const hue = 200 + i*9;
      const colorMain = `hsla(${hue}, 65%, 66%, 0.85)`;
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
  } else if (ui.shape.value==='lines'){
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

  if (aiming && !launched){
    const baseY = (ui.shape.value==='circle'?CY:(s.spawnY || Math.max(18*dpr,10)));
    const ax=aimX-CX, ay=aimY-baseY;
    const len=Math.hypot(ax,ay);
    const maxPull=Math.min(W,H)*0.46*0.55;
    const pull=Math.min(len, maxPull);
    const dirx=ax/(len||1), diry=ay/(len||1);
    const baseX = CX;
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
