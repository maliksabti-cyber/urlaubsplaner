/* Alte Adresse /schicht/ – dieser Service Worker räumt sich selbst weg, die App liegt jetzt eine Ebene höher. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => { e.waitUntil(self.registration.unregister().then(() => self.clients.matchAll()).then(cs => cs.forEach(c => c.navigate("../")))); });
