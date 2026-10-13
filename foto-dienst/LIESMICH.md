# Foto-Dienst für „Foto einlesen“

Kleiner Dienst (Cloudflare Worker). Er nimmt das Foto aus der App entgegen, lässt es von Claude
auslesen und schickt nur das Ergebnis (Tage und Schichten) zurück.

- Der API-Schlüssel steht **nur** als geheime Variable im Dienst – nie in der App, nie im Repository, nie im Chat.
- Das Foto wird **nicht gespeichert und nicht protokolliert**.
- Nur Anfragen von `https://maliksabti-cyber.github.io` werden angenommen.
- Höchstens 5 MB pro Foto und ca. 20 Auswertungen pro Gerät und Tag.
- Lehnt das Modell ein Foto ab, versucht der Dienst es automatisch mit einem Ersatzmodell.

---

## Einrichten im Browser (ohne Programme, ca. 15 Minuten)

Am besten am Computer machen (die Datei ist zum Kopieren auf dem Handy zu groß).

### Schritt 1 – API-Schlüssel anlegen
1. https://console.anthropic.com öffnen und anmelden (oder Konto erstellen).
2. Links **Billing** → Zahlungsmittel hinterlegen und ein kleines Guthaben aufladen (z. B. 5 €).
   Tipp: Unter **Limits** ein Monatslimit setzen, dann kann nie mehr ausgegeben werden.
3. Links **API Keys** → **Create Key** → Name z. B. `urlaubsplaner` → **Create**.
4. Den Schlüssel (beginnt mit `sk-ant-`) **kopieren**. Er wird nur einmal angezeigt.
   Nirgends abspeichern oder verschicken – er kommt gleich nur in Cloudflare.

### Schritt 2 – Dienst bei Cloudflare anlegen
1. https://dash.cloudflare.com öffnen, kostenloses Konto erstellen und anmelden.
2. Links **Compute (Workers)** (oder **Workers & Pages**) → **Create** → **Start with Hello World!**
   (bzw. **Create Worker**).
3. Als Namen `urlaubsplaner-foto` eintragen → **Deploy**.
4. Danach **Edit code** antippen. Im Editor den gesamten Beispiel-Code löschen.
5. In einem neuen Tab diese Datei öffnen:
   https://github.com/maliksabti-cyber/urlaubsplaner/blob/main/foto-dienst/dashboard/worker.js
   Oben rechts auf **Copy raw file** (das Symbol mit den zwei Blättern) klicken.
6. Zurück im Cloudflare-Editor einfügen (Strg+V) → oben rechts **Deploy**.

### Schritt 3 – Schlüssel hinterlegen
1. Im Worker `urlaubsplaner-foto` auf **Settings** → **Variables and Secrets** → **Add**.
2. Typ **Secret**, Name genau: `ANTHROPIC_API_KEY`, Wert: den Schlüssel aus Schritt 1 einfügen.
3. **Deploy** (bzw. **Save**).

### Schritt 4 – Prüfen
Die Adresse des Workers steht oben, z. B. `https://urlaubsplaner-foto.DEINNAME.workers.dev`.
Diese Adresse im Browser öffnen. Dort muss stehen:

```
Foto-Dienst läuft.
API-Schlüssel: hinterlegt ✔
```

### Schritt 5 – Adresse an die App geben
Die Adresse (nur die Adresse, **nie den Schlüssel**) an Claude schicken. Claude trägt sie in
`config.js` bei `photoApi` ein und veröffentlicht die App. Danach funktioniert „Foto einlesen“.

### Freiwillig – dauerhafter Tageszähler
Ohne diesen Schritt funktioniert alles; das Tageslimit zählt dann nur ungefähr.
1. Cloudflare links **Storage & Databases** → **KV** → **Create** → Name `LIMITS`.
2. Im Worker **Settings** → **Bindings** → **Add** → **KV namespace**,
   Variablenname `LIMITS`, Namespace `LIMITS` → **Deploy**.
3. Die Prüfseite zeigt dann „Tageszähler: dauerhaft (KV)“.

---

## Für Entwickler (mit Node.js)
```
npm install
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
```
`dashboard/worker.js` wird aus `src/index.js` gebaut:
`npx esbuild src/index.js --bundle --format=esm --platform=browser --conditions=worker,browser --outfile=dashboard/worker.js`

Zum Testen ohne Kosten: Variable `MOCK` = `1` setzen → der Dienst liefert Beispieldaten.
