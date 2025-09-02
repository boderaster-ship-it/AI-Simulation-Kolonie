import { createSim } from './engine/sim.js';
import { bindUI } from './ui/ui.js';

const canvas = document.getElementById('view');
const sim = createSim(canvas);

bindUI(sim);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(()=>{});
  });
}
