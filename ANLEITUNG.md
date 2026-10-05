# Schicht & Urlaub – Web-App

Die App liegt direkt unter `https://maliksabti-cyber.github.io/urlaubsplaner/`.
(Die alte Adresse `…/urlaubsplaner/schicht/` leitet automatisch dorthin weiter.)

**Aufs Handy holen:** Link im Browser öffnen →
- Android/Chrome: Menü ⋮ → „Zum Startbildschirm hinzufügen“ bzw. „App installieren“
- iPhone/Safari: Teilen-Symbol → „Zum Home-Bildschirm“

**Aktualisieren:** Neue Versionen kommen automatisch. Die App meldet „Neue Version der App ist da“ → „Aktualisieren“.
Von Hand: Tab „Mehr“ → „🔄 App aktualisieren“.
Bei einer neuen Version in `index.html` die Zeile `APP_VERSION="…"` hochzählen, damit alle den Hinweis bekommen.

**Daten:** bleiben auf dem eigenen Handy (`localMode: true` in `config.js`). Ab und zu unter Einstellungen eine Sicherung teilen.

**Team-Funktion:** nutzt das Firebase-Projekt aus `config.js`. Regeln stehen in `firestore.rules`
(Firebase → Firestore → „Regeln“ → einfügen → „Veröffentlichen“).
