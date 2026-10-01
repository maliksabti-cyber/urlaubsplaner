/* ============================================================
   Einstellungen für „Schicht & Urlaub“ – nur diese Datei anpassen
   ============================================================ */
window.APP_CONFIG = {
  // true  = Testversion ohne Anmeldung, Daten bleiben nur auf diesem Gerät.
  // false = Anmeldung mit E-Mail, Daten werden in Firebase gesichert
  //         (vorher die Regel „nutzer“ aus ../firestore.rules in Firebase veröffentlichen).
  localMode: true,
  // Gleiches Firebase-Projekt wie der Team-Urlaubsplaner (siehe ../config.js)
  apiKey: "AIzaSyCbn7aw2BBkkL0kD9keFjeCvlBflVaKzPc",
  projectId: "urlaubsplanung-team-zfp",
  // Admin des Teams (gibt Kollegen frei, legt fest, wie viele gleichzeitig Urlaub haben dürfen)
  adminEmail: "malik.sabti@googlemail.com"
};
