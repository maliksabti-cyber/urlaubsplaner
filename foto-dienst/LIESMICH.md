# Foto-Dienst für „Foto einlesen“

Kleiner Dienst (Cloudflare Worker). Er nimmt das Foto aus der App entgegen, lässt es von Claude
auslesen und schickt nur das Ergebnis (Tage und Schichten) zurück.

- Der API-Schlüssel steht **nur** als geheime Umgebungsvariable im Dienst – nie in der App, nie im Repository.
- Das Foto wird **nicht gespeichert und nicht protokolliert** (Protokolle sind in `wrangler.toml` ausgeschaltet).
- Nur Anfragen von `https://maliksabti-cyber.github.io` werden angenommen.
- Höchstens 5 MB pro Foto und ca. 20 Auswertungen pro Gerät und Tag.
- Ohne Schlüssel antwortet der Dienst mit Beispieldaten (zum Ausprobieren).
- Lehnt das Modell ein Foto ab, versucht der Dienst es automatisch mit einem Ersatzmodell
  (`fallbacks: "default"`). Erst wenn auch das nicht klappt, sieht man eine Fehlermeldung.

## Einrichten (einmalig, ca. 15 Minuten)

1. **API-Schlüssel anlegen:** Auf https://console.anthropic.com anmelden → „API Keys“ →
   „Create Key“. Den Schlüssel kopieren (er wird nur einmal angezeigt). Unter „Billing“ ein
   Guthaben hinterlegen.
2. **Cloudflare-Konto:** Kostenlos auf https://dash.cloudflare.com anlegen.
3. **Dienst hochladen** (auf einem Computer mit Node.js, im Ordner `foto-dienst`):
   ```
   npm install
   npx wrangler login
   npx wrangler kv namespace create LIMITS
   ```
   Die angezeigte `id` in `wrangler.toml` beim Abschnitt `[[kv_namespaces]]` eintragen und die
   drei Zeilen entkommentieren (damit das Tageslimit dauerhaft zählt).
4. **Schlüssel im Dienst hinterlegen** (wird verschlüsselt bei Cloudflare gespeichert):
   ```
   npx wrangler secret put ANTHROPIC_API_KEY
   ```
   Dann den Schlüssel einfügen und Enter drücken.
5. **Veröffentlichen:**
   ```
   npx wrangler deploy
   ```
   Am Ende steht die Adresse, z. B. `https://urlaubsplaner-foto.DEINNAME.workers.dev`.
6. **Adresse in die App eintragen:** In `config.js` bei `photoApi` diese Adresse eintragen
   (ohne Schlüssel!) und die Änderung veröffentlichen.

Fertig. Testen: In der App „Plan“ → „Foto einlesen“.
