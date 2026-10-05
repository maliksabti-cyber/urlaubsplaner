# Mahmed – Fehlerbericht (Kurzfassung für Mr. Smith)
Testskripte/Screenshots: /tmp/claude-0/mahmed/ (t1–t22.mjs, h.mjs). Zeilennummern beziehen sich auf den Stand von PR #30.

KRITISCH
1. Sicherung einspielen: `{"v":1,"types":[],"rots":[]}` passiert die Prüfung, S=d + save() laufen, dann crasht render() (ov/notes/carry fehlen) → catch meldet „keine gültige Sicherung", Daten aber schon überschrieben; nach Neuladen Einrichtung, alles weg, kein Rückgängig. Fix: vollständige Validierung + fehlende Felder ergänzen (gemeinsame normalize-Funktion), erst nach erfolgreichem Test-Render übernehmen; sonst alten Stand behalten; Rückgängig anbieten. load() ebenso robust machen (fehlende Felder ergänzen statt Absturz). (renderSet im.onclick ~Z.967, load ~Z.1904)

MITTEL
2. Urlaub per Tag-Fenster „U" oder U-Pinsel an Tag ohne Schichtplan zählt 0 (addVac(s,s) ohne fixed) – openVac rechnet Mo–Fr. Fix: gleiche Logik wie vacSave/vacCount (openDay ~Z.785, wireGrid paint ~Z.720).
3. Schichtart löschen: Meldung „Tage werden frei", Code löscht nur ov → Rhythmus greift. Fix: S.ov[k]="" (frei) für übermalte Tage; für Rhythmus-Tage ist pattern→null schon so.
4. Soll/Ist: Feiertage (holFree) senken Soll nicht → Mo–Fr 37,5 h/Woche ergibt 2027 −50:20 h. Fix: Soll für gesetzliche Feiertage an Werktagen (Mo–Fr) abziehen bzw. als Ist gutschreiben (soll/5 pro Feiertag) – wähle eine saubere Regel und dokumentiere sie im Hinweis.
5. creditMin = Schnitt der Schichten im Zeitraum → ganzer Monat Urlaub/krank ohne soll = 0 €. Fix: Schnitt aus Schichtarten des Rhythmus / Vormonaten oder Standard-Schichtlänge.
6. Komma: type=number + de-DE → „15,5" wird 155, „37,5" → 375. Fix: type=text inputmode=decimal, Komma→Punkt; Plausibilität (Soll > 60 h/Woche, Lohn > 200 €/h) mit Rückfrage.
7. „Urlaub einstellen": Vorschau nutzt gespeicherten Resturlaub statt eingetippten (expd/calc ~Z.1856–1861).

KLEIN
8. vacCheck: nach „Urlaub anpassen?" überschreibt toast("Urlaub angepasst") die Meldung mit Rückgängig (~Z.575). Fix: Text kombinieren, Rückgängig behalten.
9. Zeitumstellung: Nachtschicht 27./28.3. real 7 h, 30./31.10. real 9 h, gerechnet 8 h (minutes ~Z.580, shiftSplit ~Z.1236). Fix: Dauer per echter Uhrzeit (Date mit Europe/Berlin) bzw. ±60 min an DST-Tagen.
10. Urlaubsrechner mit Jahr außerhalb der Auswahl (2025/2029 aus Urlaub-Tab): select leer, Rechnung für dieses Jahr. Fix: Auswahlliste um das Jahr erweitern oder Jahr begrenzen.
11. Negativer Rest (mehr verplant als Anspruch): Meldungen irreführend; `!real`/`!rest` erkennt nur 0. Fix: <=0 prüfen, Text „Du hast X Tage mehr verplant als dein Anspruch."
12. Mal-Leiste 360px: „✎ Tagschicht" überlappt „↻ Wiederholen"; lange Namen laufen in Knöpfe; Dunkelmodus Knopfränder unsichtbar (.selbar ~Z.348–352).

OK geprüft: Feiertage 2027 (10 Länder), Urlaubszählung inkl. Jahreswechsel/Überlappung/krank, Resturlaub/Verfall, Nachtschicht Monats-/Jahresende, Schaltjahr, Rhythmuswechsel, Zuschläge-Zuordnung, Abrechnung 16.–15., Rechner-Kombis/0/60 Tage, 360px ohne Querscroll, Zurück-Wege, 112 Knöpfe ohne JS-Fehler.
