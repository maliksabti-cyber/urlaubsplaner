/* ============================================================
   Einstellungen für „Schicht & Urlaub“ – nur diese Datei anpassen
   ============================================================ */
window.APP_CONFIG = {
  // true  = Testversion ohne Anmeldung, Daten bleiben nur auf diesem Gerät.
  // false = Anmeldung mit E-Mail, Daten werden in Firebase gesichert
  //         (vorher die Regel „nutzer“ aus firestore.rules in Firebase veröffentlichen).
  localMode: true,
  // Firebase-Projekt (nur für Anmeldung/Sicherung in der Cloud, wenn localMode: false)
  apiKey: "AIzaSyCbn7aw2BBkkL0kD9keFjeCvlBflVaKzPc",
  projectId: "urlaubsplanung-team-zfp",
  // „Foto einlesen“: Adresse des Foto-Dienstes (Cloudflare Worker, siehe foto-dienst/LIESMICH.md),
  // z. B. "https://urlaubsplaner-foto.DEINNAME.workers.dev". Hier steht NIE ein API-Schlüssel.
  photoApi: ""
};
