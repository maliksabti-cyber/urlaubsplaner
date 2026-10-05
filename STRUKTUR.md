# Schicht & Urlaub – App-Struktur

Leitfaden nach dem 6-Schritte-Plan zur App-Entwicklung. Jede Änderung wird gegen diese Punkte geprüft.

## 1. Konzept & Daten (Fundament)

**Problem:** Schichtarbeiter wollen sehen, wann sie arbeiten, und ihren Urlaub so legen, dass sie mit wenig Urlaubstagen viel frei haben.

**Nutzer-Rollen**
- Privatnutzer: eigener Plan, ohne Konto, Daten auf dem Handy
- Mitarbeiter: zusätzlich im Team angemeldet, Urlaub ans Team
- Admin (Chef): gibt Kollegen frei und legt fest, wie viele höchstens gleichzeitig im Urlaub sein dürfen

**Daten-Objekte** (alle in einem Objekt `S`, gespeichert im Browser)
| Objekt | Feld | Beziehung |
|---|---|---|
| Schichtart | `types` (T Tag, S Spät, N Nacht, U Urlaub, K Krank, F Frei) | wird von Rhythmus, Tagen und Urlaub benutzt |
| Rhythmus | `rots` (Muster ab Startdatum), Vorlagen `tpls` | 1 Nutzer → n Rhythmen |
| Einzelner Tag | `ov` (Datum → Schichtart), Notizen `notes`, Schichttausch `swaps` (Tag, Name, Gegentag, erledigt) | überschreibt den Rhythmus |
| Urlaub | `vacs` (Von–Bis); zählt nur Tage, an denen laut Plan gearbeitet wird | 1 Nutzer → n Urlaube |
| Einstellungen | `land`, `localHol`, `holFree`, `payDay` (Abrechnung ab Tag X), `statMode`, `weekendFree`, `vacPerYear`, `carry` (Resturlaub; `carryAuto` = Rest aus dem Vorjahr automatisch übernehmen), `expire` (Verfall des Resturlaubs: an/aus + Stichtag, Standard 31.3.), `pay`, `soll`, `holCredit`, `remind` | |
| Partner-Pläne | `partners` (per Link erhalten) | für „Gemeinsam frei“ |
| Lotse | `goal`, `gman`, `gopen` | Fortschritt der Schritte |

**Team-Daten** (Firebase): `mitarbeiter` (Name, Freigabe, Grenze `maxWeg`) und `urlaube` (Name, Von, Bis).

## 2. Oberfläche & Wege (Gesicht)
- Unten 4 Tabs: **Heute · Schichtplan · Urlaub · Team**. Oben: ‹ Zurück, ↶ Rückgängig, ? Hilfe, ⚙ Einstellungen.
- Hilfe „So geht's“ und Karte „Neu in der App“ (`NEWS_V`) werden bei neuen Funktionen ergänzt.
- Startseite: Heute (mit Live-Zeile: läuft gerade / beginnt in / Feierabend) + 7 Tage → Schnellknöpfe → Lotse (Ziel → Schritte) → Urlaub → Als Nächstes.
- Schichtplan „Monat“: Monate untereinander in einem eigenen Scroll-Bereich (wie ein Handy-Kalender). Beim Öffnen steht der aktuelle Monat oben, am Anfang/Ende werden je 3 Monate nachgeladen (höchstens 15 gleichzeitig). ‹ › und „↩ Zurück zu heute“ scrollen zum Monat; die Monatskarte darunter gilt für den oben sichtbaren Monat. Malen: Antippen oder seitlich wischen malt, senkrecht wischen scrollt (`touch-action:pan-y`).
- Urlaub-Tab: Monate mit Urlaub untereinander als Kalender.
- Jeder Knopf führt direkt zur Funktion; der Pfeil oben links führt zum vorherigen Fenster bzw. Schritt zurück.
- Regeln: große, fette Überschriften; nur eine Hinweis-Karte zur Zeit; Wichtiges in Rot oder Orange.

## 3. Klick-Logik (Frontend)
- Wenn kein Schichtplan eingetragen ist, wird mit Mo–Fr gerechnet, und die App zeigt einen Hinweis.
- Wenn ein Tag laut Plan frei ist, ist er kein Urlaubstag und wird als F angezeigt.
- Wenn an einem Tag zu viele aus dem Team weg sind, warnt die App, und der Urlaubsrechner lässt den Tag aus.
- Wenn Resturlaub aus dem Vorjahr da ist, wird Urlaub im neuen Jahr zuerst davon abgezogen; was bis zum Stichtag nicht genommen ist, verfällt (Hinweis auf Heute, im Urlaub-Tab und im Lotsen).
- Wenn Urlaub eingetragen wird, bietet die Meldung „Rückgängig“ und „📄 Antrag“ an; im Urlaub-Tab gibt es einen Antrag für mehrere Urlaube.
- Wenn ein Urlaub über den Jahreswechsel geht, zählt jeder Tag in seinem Jahr; die App zeigt den Rest für beide Jahre.
- Wenn der Nutzer etwas ändert, gibt es Rückgängig und das Fenster „Urlaub anpassen?“.

## 4. Speicherung (Gehirn)
- Persönliche Daten liegen nur im Browser (`localStorage`). Gesichert wird über eine Datei per WhatsApp oder Mail, die App erinnert alle 14 Tage daran.
- Team-Daten liegen in Firebase und sind durch Regeln geschützt (`firestore.rules`): Jeder ändert nur seine eigenen Einträge, nur Freigegebene sehen Urlaube, und der Admin darf alles.

## 5. Verbindungen nach außen (Brücke)
- Firebase: Anmeldung und Team-Daten
- Urlaubsantrag als PDF (zum Ausdrucken oder Schicken an den Chef)
- Teilen: PDF, WhatsApp-Link, `mailto:` und Teilen-Menü des Handys
- Handy-Kalender: `.ics`-Datei mit Erinnerung
- „Gemeinsam frei“: Plan als Link (`#plan=…`)
- Keine Bezahlung, keine Werbung, kein eigener Server

## 6. Testen & Veröffentlichen (Finale)
- Tests liegen in `schicht/tests/` (Handy-Emulation mit Playwright, Team mit nachgebautem Firebase). Start mit `schicht/tests/run.sh`.
- Vor jeder Veröffentlichung müssen alle Tests grün sein. Neue Funktion heißt neuer Test.
- Veröffentlicht wird über GitHub Pages (Branch `main`): https://maliksabti-cyber.github.io/urlaubsplaner/schicht/

## Kernfunktionen (nicht verwässern)
1. Schichtplan mit Rhythmus
2. Urlaub eintragen und richtig zählen
3. Urlaub clever planen (Urlaubsrechner)

Alles andere ist Zusatz und muss einfach bleiben.
