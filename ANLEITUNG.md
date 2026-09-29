# Urlaubsplaner Team ZFP – Web-App einrichten (kostenlos)

Du brauchst: ein Google-Konto (für Firebase) und ein kostenloses GitHub-Konto.
Alles geht am Handy im Browser (Chrome/Safari). Wir gehen die Schritte im Chat zusammen durch.

1. **Firebase-Projekt anlegen** – console.firebase.google.com → „Projekt hinzufügen“ → Name z. B. `urlaub-zfp` → Google Analytics AUS.
2. **Anmeldung einschalten** – Build → Authentication → „Jetzt starten“ → „E-Mail-Adresse/Passwort“ → aktivieren → Speichern.
3. **Datenbank anlegen** – Build → Firestore Database → „Datenbank erstellen“ → Standort `europe-west3 (Frankfurt)` → „Produktionsmodus“.
4. **Regeln einfügen** – Firestore → Tab „Regeln“ → alles löschen → Inhalt von `firestore.rules` einfügen → „Veröffentlichen“.
5. **Web-App registrieren** – Zahnrad → Projekteinstellungen → unten „</>“ (Web) → Name `Urlaubsplaner` → Hosting NICHT anhaken → die `firebaseConfig`-Werte kopieren und an Claude schicken (oder selbst in `config.js` eintragen).
6. **GitHub** – github.com → Konto anlegen → neues Repository `urlaubsplaner` (Public) → „uploading an existing file“ → alle Dateien aus diesem Ordner hochladen (index.html, config.js, manifest.webmanifest, sw.js, icon-192.png, icon-512.png).
7. **Veröffentlichen** – Repository → Settings → Pages → Branch `main` / `root` → Save. Nach 1–2 Minuten: `https://DEINNAME.github.io/urlaubsplaner/`
8. **Domain freigeben** – Firebase → Authentication → Einstellungen → „Autorisierte Domains“ → `DEINNAME.github.io` hinzufügen.
9. **Als Erster registrieren** – Link öffnen → „Konto erstellen“ mit genau der Admin-E-Mail aus `config.js`.
10. **Link an die Kollegen schicken.** Sie tippen im Browser auf „Zum Startbildschirm hinzufügen“, erstellen ein Konto, du bestätigst sie unter „Team“.

**Später etwas ändern:** neue `index.html` bei GitHub hochladen (gleicher Name, überschreiben) – alle haben sofort die neue Version.
**Kosten:** Firebase „Spark“ (kostenlos) + GitHub Pages (kostenlos). Keine Kreditkarte nötig.
**Passwort vergessen:** mit E-Mail → „Passwort vergessen?“. Ohne E-Mail → Admin löscht den Nutzer in Firebase → Authentication → Nutzer, dann neu registrieren.
