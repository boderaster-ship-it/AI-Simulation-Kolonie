export function bindUI({ engine, renderer, onStart, onStop }){
  const el = {
    panel: document.getElementById('panel'),
    btnStart: document.getElementById('btnStart'),
    btnQuick: document.getElementById('btnQuick'),
    btnPause: document.getElementById('btnPause'),
    btnResume: document.getElementById('btnResume'),
    btnStop: document.getElementById('btnStop'),

    alpha: document.getElementById('alpha'),
    eps: document.getElementById('eps'),
    vision: document.getElementById('vision'),
    agents: document.getElementById('agents'),
    resStart: document.getElementById('resStart'),
    obsStart: document.getElementById('obsStart'),
    wrap: document.getElementById('wrap'),
    speed: document.getElementById('speed'),
    resLive: document.getElementById('resLive'),
    theme: document.getElementById('theme'),

    alphaVal: document.getElementById('alphaVal'),
    epsVal: document.getElementById('epsVal'),
    visionVal: document.getElementById('visionVal'),
    resStartVal: document.getElementById('resStartVal'),
    obsStartVal: document.getElementById('obsStartVal'),
    speedVal: document.getElementById('speedVal'),
    resLiveVal: document.getElementById('resLiveVal'),

    aAlive: document.getElementById('aAlive'),
    bAlive: document.getElementById('bAlive'),
    aScore: document.getElementById('aScore'),
    bScore: document.getElementById('bScore'),
    tick: document.getElementById('tick'),
    fps: document.getElementById('fps')
  };

  // Labels updaten
  const syncLabels = ()=>{
    el.alphaVal.textContent = (+el.alpha.value).toFixed(2);
    el.epsVal.textContent = (+el.eps.value).toFixed(2);
    el.visionVal.textContent = (+el.vision.value|0);
    el.resStartVal.textContent = `${(+el.resStart.value|0)}%`;
    el.obsStartVal.textContent = `${(+el.obsStart.value|0)}%`;
    el.speedVal.textContent = `${(+el.speed.value|0)} t/s`;
    el.resLiveVal.textContent = `${(+el.resLive.value|0)}%`;
  };
  ['input','change'].forEach(evt=>{
    [el.alpha,el.eps,el.vision,el.resStart,el.obsStart,el.speed,el.resLive].forEach(c=>c.addEventListener(evt,syncLabels));
  });
  syncLabels();

  // Stats abonnieren
  engine.onStats(({tick,fps,aAlive,bAlive,aScore,bScore})=>{
    el.tick.textContent = tick;
    el.fps.textContent = fps;
    el.aAlive.textContent = aAlive;
    el.bAlive.textContent = bAlive;
    el.aScore.textContent = aScore;
    el.bScore.textContent = bScore;
  });

  // Buttons
  el.btnStart.addEventListener('click', async ()=>{
    el.panel.style.display='none';
    renderer.setTheme(el.theme.value);
    await onStart({
      alpha:+el.alpha.value, epsilon:+el.eps.value, vision:+el.vision.value,
      startAgents:+el.agents.value, resPct:+el.resStart.value/100, obsPct:+el.obsStart.value/100,
      wrap: el.wrap.checked, stepsPerSec:+el.speed.value, liveResPct:+el.resLive.value/100
    });
  });

  el.btnQuick.addEventListener('click', ()=>{
    el.alpha.value=0.22; el.eps.value=0.12; el.vision.value=4;
    el.agents.value=22; el.resStart.value=6; el.obsStart.value=6;
    el.wrap.checked=true; el.speed.value=120; el.resLive.value=6; el.theme.value='neon';
    syncLabels();
  });

  el.btnPause.addEventListener('click', ()=> engine.pause());
  el.btnResume.addEventListener('click', ()=> engine.resume());
  el.btnStop.addEventListener('click', ()=> { onStop(); el.panel.style.display='block'; });

  // Theme live
  el.theme.addEventListener('change', ()=> renderer.setTheme(el.theme.value));

  return { };
}
