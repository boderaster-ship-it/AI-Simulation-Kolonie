import { createEngine } from './sim/engine.js';
import { createRenderer } from './sim/render.js';
import { bindUI } from './sim/ui.js';

// ---- PWA: Icons on-the-fly (PNG) ----
async function ensureIcons() {
  const has192 = localStorage.getItem('icon192');
  const has512 = localStorage.getItem('icon512');
  if (has192 && has512) return;
  const mk = async (size) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = '#0b0d12'; g.fillRect(0,0,size,size);
    g.fillStyle = '#59b1ff'; g.fillRect(size*0.1, size*0.1, size*0.8, size*0.8);
    g.fillStyle = '#2ecf91'; g.fillRect(size*0.2, size*0.55, size*0.6, size*0.25);
    g.fillStyle = '#ff6b6b'; g.fillRect(size*0.2, size*0.25, size*0.25, size*0.2);
    g.fillStyle = '#59b1ff'; g.fillRect(size*0.55, size*0.25, size*0.25, size*0.2);
    return c.toDataURL('image/png');
  };
  localStorage.setItem('icon192', await mk(192));
  localStorage.setItem('icon512', await mk(512));
}
ensureIcons().then(()=>updateManifestIcons());

// ---- Manifest updaten (Data-URIs einfügen) ----
async function updateManifestIcons(){
  const res = await fetch('/manifest.webmanifest');
  const manifest = await res.json();
  const icon192 = localStorage.getItem('icon192');
  const icon512 = localStorage.getItem('icon512');
  if (icon192 && icon512) {
    manifest.icons = [
      { src: icon192, sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: icon512, sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ];
  }
  const blob = new Blob([JSON.stringify(manifest)], {type:'application/manifest+json'});
  const url = URL.createObjectURL(blob);
  const link = document.querySelector('link[rel="manifest"]');
  link.setAttribute('href', url);
}

// ---- Service Worker registrieren ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', ()=> {
    navigator.serviceWorker.register('/sw.js').catch(()=>{});
  });
}

// ---- App Boot ----
const canvas = document.getElementById('view');
const engine = createEngine();
const renderer = createRenderer(canvas, engine);

const ui = bindUI({
  engine, renderer,
  onStart: async (config) => {
    // Vollbild freundlich für iOS
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      // iOS Safari: kein echtes Fullscreen API – wir faken durch UI-Hiding
      window.scrollTo(0,1);
    } catch {}
    engine.start(config);
    renderer.start();
  },
  onStop: () => {
    renderer.stop();
    engine.stop();
  }
});

// Adaptive Resize
function fit() { renderer.resize(); }
window.addEventListener('resize', fit, { passive: true });
fit();

// TouchScroll verhindern (iOS bounce)
document.addEventListener('touchmove', e => e.preventDefault(), { passive:false });
