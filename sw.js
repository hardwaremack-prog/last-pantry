// Last Pantry service worker — app works offline; map tiles you've viewed are cached.
const APP = 'last-pantry-app-v1';
const TILES = 'last-pantry-tiles-v1';
const MAX_TILES = 3000;
const SHELL = [
  './', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, {mode: u.startsWith('http') ? 'cors' : 'same-origin'})).catch(()=>{})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => ![APP, TILES].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const isFont = u => /fonts\.(googleapis|gstatic)\.com/.test(u);
const isTile = u => /tile\.openstreetmap\.org|arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery/.test(u);
async function trimTiles(){
  const c = await caches.open(TILES); const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = req.url;
  if (isTile(url)) {
    // cache-first for map tiles so places you've looked at work offline
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      try { const r = await fetch(req); if (r.ok || r.type === 'opaque') { c.put(req, r.clone()); trimTiles(); } return r; }
      catch (err) { return new Response('', {status: 504}); }
    }));
    return;
  }
  if (req.mode === 'navigate') {
    // network-first for the page so updates arrive, cached copy when offline
    e.respondWith(fetch(req).then(r => { caches.open(APP).then(c => c.put('./index.html', r.clone())); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if ((r.ok || r.type === 'opaque') && (url.startsWith(self.location.origin) || url.includes('cdnjs.cloudflare.com') || isFont(url))) { const cl = r.clone(); caches.open(APP).then(c => c.put(req, cl)); }
    return r;
  })));
});
