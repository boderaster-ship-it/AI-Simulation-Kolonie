const CACHE='kolonie-v1';
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll([
    '/', '/index.html','/styles.css','/app.js',
    '/engine/world.js','/engine/agent.js','/engine/colony.js',
    '/engine/brain.js','/engine/sim.js','/ui/ui.js','/manifest.webmanifest'
  ])));
});
self.addEventListener('fetch',e=>{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
