/* Çevrimdışı çalışma: uygulama dosyaları önbellekte tutulur.
 * Uygulamayı güncellediğinde CACHE sürümünü artır. */
const CACHE = 'tm-v1.4.0';
const SHELL = [
  './', 'index.html', 'app.css', 'app.js', 'ocr.js', 'dictionary.js', 'pinyin.js', 'translate.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];
const OCR_CACHE = 'tm-ocr-v5';

const OCR_FILES = [
  'tesseract.min.js', 'worker.min.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js',
  'lang/chi_sim.traineddata.gz', 'lang/eng.traineddata.gz',
].map(f => new URL('vendor/tesseract/' + f, self.registration.scope).href);

self.addEventListener('message', e => {
  if (e.data !== 'warm-ocr') return;
  e.waitUntil(caches.open(OCR_CACHE).then(async c => {
    for (const url of OCR_FILES) {
      if (await c.match(url)) continue;
      try { const res = await fetch(url); if (res.ok) await c.put(url, res); } catch (_) { /* sonra tekrar denenir */ }
    }
  }));
});

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE && k !== OCR_CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // kur servisleri vb. doğrudan ağa gitsin

  // OCR motoru ve dil dosyaları: büyük, değişmez → önce önbellek
  if (url.pathname.includes('/vendor/')) {
    e.respondWith(caches.open(OCR_CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Uygulama dosyaları: önbellekten anında aç, arka planda güncelle
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    return res || c.match('index.html');
  }));
});
