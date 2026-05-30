// OrbMaster Service Worker — enables offline play
const CACHE_NAME = 'orbmaster-v1';

const ASSETS = [
  './OrbMaster.html',
  './manifest.json',
  './Images/OrbMaster title new.png',
  './Images/OrbMaster title trans.png',
  './Images/OrbMaster blank.png',
  './Images/OrbMaster_press start.png',
  './Images/stone wall.png',
  './Images/Mind Orb Assets/orange_orb.png',
  './Images/Mind Orb Assets/blue_orb.png',
  './Images/Mind Orb Assets/green_orb.png',
  './Images/Mind Orb Assets/silver_bar.png',
  './Images/Mind Orb Assets/red_orb.png',
  './Images/Mind Orb Assets/purple_orb.png',
  './Images/Mind Orb Assets/yellow_orb.png',
  './Images/Mind Orb Assets/gold_bar.png',
  './Images/Mind Orb Assets/pink_orb.png',
  './Images/Mind Orb Assets/white_orb.png',
  './Images/Mind Orb Assets/black_orb.png',
  './Images/Mind Orb Assets/teal_orb.png',
  './Images/Boss Character Assets/Boss_1 - Lemons.png',
  './Images/Boss Character Assets/Boss_2 - Templefrist.png',
  './Images/Boss Character Assets/Boss_3 - Bigginsly.png',
  './Images/Boss Character Assets/Boss_4 - Nanomic.png',
  './Images/Boss Character Assets/Boss_5 - Natty D.png',
  './Images/Boss Character Assets/Boss_6 - Pretty Pea.png',
  './Images/Boss Character Assets/Boss_7 - Sir Louie.png',
  './Images/Boss Character Assets/Boss_8 - Queen Asabeth.png',
  './Images/Boss Character Assets/Boss_9 - Elkgore.png',
  './Images/Boss Character Assets/Boss_010 - Mad Martin.png',
  './Audio/The_Clockwork_Outcome.mp3',
  './Audio/Boss 1 - Lemon_Zest_Fury.mp3',
];

// Install: cache all assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
