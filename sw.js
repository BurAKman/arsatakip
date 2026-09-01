// Çapsız Çapçı — servis calisani
// Amac: uygulamanin kurulabilir olmasi ve internet yokken de acilmasi.
// Strateji: HTML her zaman once agdan (guncelleme aninda gelsin),
// gorseller ve kutuphaneler once onbellekten (hizli acilsin).

const SURUM = "cc-v1";
const TEMEL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./logo.png",
  "./icon.png",
  "./loading.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SURUM).then((c) => c.addAll(TEMEL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((adlar) => Promise.all(adlar.filter((a) => a !== SURUM).map((a) => caches.delete(a))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const istek = e.request;
  if (istek.method !== "GET") return;

  const url = new URL(istek.url);

  // Supabase ve dis servisler onbelleklenmez
  if (url.hostname.includes("supabase.co") ||
      url.hostname.includes("tkgm.gov.tr") ||
      url.hostname.includes("arcgisonline.com") ||
      url.hostname.includes("overpass") ||
      url.hostname.includes("openstreetmap")) return;

  const htmlMi = istek.mode === "navigate" ||
    (istek.headers.get("accept") || "").includes("text/html");

  if (htmlMi) {
    // once ag: yeni surum varsa hemen gelsin
    e.respondWith(
      fetch(istek)
        .then((cevap) => {
          const kopya = cevap.clone();
          caches.open(SURUM).then((c) => c.put(istek, kopya));
          return cevap;
        })
        .catch(() => caches.match(istek).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  // digerleri: once onbellek
  e.respondWith(
    caches.match(istek).then((bulunan) => {
      if (bulunan) return bulunan;
      return fetch(istek).then((cevap) => {
        if (cevap && cevap.status === 200 && url.origin === location.origin) {
          const kopya = cevap.clone();
          caches.open(SURUM).then((c) => c.put(istek, kopya));
        }
        return cevap;
      });
    })
  );
});
