# Aufgabe: Team-Funktion für „Schicht & Urlaub“ (Vorgabe des Nutzers)

1. **Einstieg:** Unter „Mehr“ → „Team erstellen“. Beitritt per Link. Mitglied bleibt im privaten Bereich und kann zusätzlich die Team-Ansicht öffnen. Beim Beitritt: Frage „Kinder?“ und Einverständnis zur Datenfreigabe.
2. **Rollen:** Ersteller = Admin. Admins ernennen weitere Admins (wie WhatsApp). Jeder Admin kann einen Vertreter ernennen, der wiederum einen Vertreter ernennen kann. Nach dem 2./3. Mitglied einmalige Empfehlung, einen Vertreter zu bestimmen (keine Pflicht).
3. **Team-Kalender:** Monatsansicht. Jedes Mitglied automatisch eine Farbe + Form (Kreis, Raute, Herz, Würfel), bei großen Teams Initialen. Tipp auf Tag → Popup mit X. Namen nur bei Einverständnis, sonst nur Farbe/Form.
4. **Admin-Maske:** Name und Farbe pro Mitglied, max. gleichzeitige Urlaube, Abgabefrist für Konfliktlösungen (frei). Zeigt, welche Farben an welchem Tag überschneiden.
5. **Ablauf:** Jeder trägt zuerst Wunschurlaub ein. Überschneidungsprüfung nur beim Eintragen/Ändern.
6. **Konfliktlösung:** Push + Dringlichkeitsanzeige mit Zeit bis zur Frist · Ausweichtage vorschlagen, Verschieben per Klick · sonst „wer zuerst eingetragen hat, behält den Tag“ · keine Ausweichtage → Admin entscheidet · in Schulferien Vorrang für Mitglieder mit Kindern (Person ohne Kinder wird vorher mit Begründung gefragt; lehnt sie ab → Admin) · keine Reaktion → automatische Erinnerung, Admin kann nachfassen.
7. **Mitglied entfernt / Firma verlassen:** Daten verschwinden komplett aus der Team-Ansicht, privater Planer bleibt.
8. **Privater Bereich:** Vollzeit/Teilzeit (fließt in Berechnung ein) · unter dem Jahreskalender Datenansicht pro Zeitraum (Tage, Stunden, Minuten, Dezimal je Wertigkeit: Urlaub, Krank …) · Umrechner Dezimal ↔ Std./Min. · Wertigkeit wird in die Team-Ansicht übernommen.
9. **Freigabe:** Erst wenn der Admin bestätigt, dass alle Überschneidungen gelöst sind, gibt es den fertigen Kalender als PDF.
10. **PDF-Export** (privat + Team): kompakte Jahresübersicht oder detaillierte Monatsansicht, A3 oder A4 mit angepasstem Layout, klickbares Inhaltsverzeichnis, maximale Übersichtlichkeit.
11. **Kalender-Sync:** optional Apple/Google, App fragt vorher.
12. **Später/offen:** Firmenkonto (welche Daten die Firma sieht, noch nicht entschieden).

## Vorgeschlagene Reihenfolge
- **Stufe 1 – privat (ohne Server):** Punkt 8, 10 (privat), 11.
- **Stufe 2 – Team-Grundlage (Firebase):** Punkte 1–5, 7. Neue Firestore-Regeln müssen in Firebase veröffentlicht werden.
- **Stufe 3 – Konfliktlösung & Freigabe:** Punkte 6, 9, 10 (Team). Echte Push-Nachrichten bei geschlossener App brauchen einen Server (z. B. Firebase Cloud Functions, Blaze-Tarif).

## Architektur-Regeln (verbindlich für alle Stufen)
1. **Trennung privat ↔ Team:** private Einträge (`S.vacs`, `S.ov` …) und Team-Sichtbarkeit liegen getrennt. Sichtbarkeit über eigene Verknüpfungstabelle `S.share.vac[urlaubsId]`; in Firebase später eigene Sammlung `teamEntries` (Team-Kopie, nur mit Einverständnis). Team verlassen/entfernt = nur Team-Kopie + Verknüpfung löschen. ✅ Grundlage gebaut
2. **Urlaub eintragen** bringt das Feld „Im Team sichtbar“ schon mit (Standard aus Einverständnis-Modul). ✅ gebaut (Urlaub bearbeiten)
3. **Zentrales Benachrichtigungssystem** `notify({type,to,title,text,due,range})` in `team.js` – Konflikt, Erinnerung (manuell gebaut), Freigabe (Stufe 3). In-App-Posteingang mit Dringlichkeit; echter Push später über denselben Kanal. ✅ Grundlage
4. **PDF als ein Modul** (`makePDF` + Bausteine: Format A4/A3, Inhaltsverzeichnis, Monatsseite `drawMonthPage`) für privat und Team. ✅ Bausteine da; Team-Ansicht nutzt sie in Stufe 3
5. **Zentrales Einverständnis-Modul** `CONSENT` / `consentGet` / `consentSet` (Team-Beitritt, Namensanzeige, Kinder, Standard-Sichtbarkeit) – Einstellungen → „Datenschutz & Freigaben“. ✅ gebaut
6. **Konfliktlogik** mit 3+ Personen: feste Reihenfolge, wer zuerst gefragt wird (1. später eingetragen zuerst gefragt; 2. in Schulferien zuerst Personen ohne Kinder; 3. bei Gleichstand späterer Eintrag; 4. sonst Admin). Früh mit 3–5 Fake-Nutzern testen. ⏳ Stufe 3
7. **Vertreter-Kette** maximal 3 Ebenen (`MAXDEP`). ✅
8. **Teilzeit** wirkt auf Stunden **und** Resturlaub (anteiliger Anspruch, Schalter in „Arbeitszeit“). ✅ gebaut
9. **Kalender-Sync:** Änderungen/Löschungen sollen den externen Eintrag mitziehen. Heute: Kalender-Datei mit festen IDs (erneuter Import aktualisiert in Apple). Automatisch ohne Neu-Import geht nur mit Abo-Link vom Server. ⏳ mit Server
10. **Testumgebung:** `tests/fake-firebase.mjs` + `tests/t40-team.mjs` (3 Fake-Nutzer). ✅ (prüft keine Firebase-Regeln)

## Stand Stufe 2 (Team-Grundlage) ✅
`team.js`: Anmeldung, Team erstellen, Beitritt per Link (Kinder-Frage, Einverständnis, Name zeigen), Admin/Vertreter (max. 3 Ebenen), einmalige Vertreter-Empfehlung ab 3 Mitgliedern, Team-Monatskalender (Farbe, Form, Initialen ab 9 Mitgliedern, Popup mit X, Namen nur mit Einverständnis), Admin-Maske (Name, Farbe, Form, Grenze, Frist, Überschneidungen, Erinnern, Entfernen), Überschneidungsprüfung nur beim Eintragen/Ändern, Posteingang mit Dringlichkeit, Team verlassen/entfernt löscht nur Team-Daten.

## Stand Stufe 3 (Konfliktlösung & Freigabe) ✅
- Neue Sammlung `teams/{t}/conflicts/{id}` (Regel in `firestore.rules` – muss neu veröffentlicht werden).
- Reihenfolge: wer zuletzt eingetragen hat, wird zuerst gefragt; in Schulferien zuerst Kollegen ohne Kinder (mit Begründung). Kommt jemand dazu, wird die offene Überschneidung erweitert und der Neue zuerst gefragt.
- Gefragter: „Ausweichtage zeigen“ (bis zu 3 freie Zeiträume ±60 Tage, Kontingent geprüft, ein Tipp verschiebt den privaten Urlaub) oder „Nein, ich behalte“ → Nächster wird gefragt → wenn niemand: Admin entscheidet.
- Admin: „muss ausweichen“ pro Person oder „Regel anwenden“. Frist abgelaufen → Regel automatisch (wer zuerst eingetragen hat, behält).
- Automatische Erinnerung 48 Std. vor Fristende (höchstens 1× pro Tag) – ohne Server beim Öffnen der App durch ein Teammitglied.
- Gelöst wird automatisch erkannt. Freigabe-Knopf in der Admin-Maske erst ohne offene Überschneidungen → Nachricht an alle.
- Team-PDF (gleiches PDF-Modul): Seite 1 Legende + Inhaltsverzeichnis zum Antippen, 12 Monatsseiten mit Farbmarken, rot = zu viele. Für Admins immer, für Mitglieder nach Freigabe.
- Test: `tests/t41-konflikt.mjs` (3 Fake-Nutzer, 16 Prüfungen grün).

## Offen
Echte Push-Nachrichten und automatischer Kalender-Abgleich (brauchen Server).
