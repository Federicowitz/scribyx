self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
    // Non fa nulla per ora, ma inganna Chrome facendogli credere che siamo pronti per l'offline
});
