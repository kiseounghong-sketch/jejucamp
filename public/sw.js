// 가쓸신제 제주도 캠프 앱 서비스워커
// 앱 화면(골격)은 저장해 두고, 인터넷이 약할 때 저장본으로 띄웁니다.
// 구글시트·지도 타일·날씨 같은 실시간 데이터는 저장하지 않고 항상 새로 받아와요.
const CACHE_NAME = "jejucamp-shell-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];
const CACHEABLE_HOSTS = ["unpkg.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(ASSETS.map((url) => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 새 버전을 먼저 받아보고(network first), 안 되면 저장본을 씁니다.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const isSameOrigin = url.origin === location.origin;
  const isCacheableExternal = CACHEABLE_HOSTS.some((host) => url.hostname.includes(host));
  if (!isSameOrigin && !isCacheableExternal) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
