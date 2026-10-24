/*
  ───────────────────────────────────────────────
  Hier kannst du alles Persönliche anpassen.
  Nur die Texte zwischen den Anführungszeichen ändern.
  ───────────────────────────────────────────────
*/
window.MAMA_CONFIG = {
  // So nennt er sie.
  mama: "Mama",

  // Wer im Player wohnt.
  name: "Julian",

  // Sein Outfit zum Start:
  // "creeper" (Hoodie), "trainer" (Pokémon), "gruen", "rot", "blau", "schwarz", "weiss" oder "gold" (Ninjago).
  outfit: "creeper",

  // Der große Bruder. Er taucht nur ein einziges Mal auf: beim allerersten Öffnen.
  ueberlieferer: {
    titel: "Mäßiger Überlieferer",
    saetze: [
      "Hallo {mama}! Hier spricht der mäßige Überlieferer.",
      "Sorry, dass dein Geschenk so spät kommt. Die Verspätung tut mir echt leid.",
      "Viel Spaß mit deinem juliPod! Ich hab dich lieb."
    ]
  },

  // Unter dem Brief.
  absender: "Deine Jungs",

  // Der Brief unten auf der Seite. Jede Zeile ist ein Absatz.
  brief: [
    "Liebe Mama,",
    "dein Geburtstag ist schon ein paar Tage her. Das Geschenk kommt spät, aber es kommt von Herzen.",
    "In diesem juliPod steckt deine Musik und jemand, der dich sehr lieb hat. Draußen baut er manchmal Mist. Hier drin ist er nur lieb, versprochen.",
    "Danke für alles, was du jeden Tag für uns machst. Alles Gute nachträglich!"
  ],

  // Das 8-Bit-Geburtstagslied als erstes Lied anzeigen (true = ja, false = nein).
  demoLied: true,

  // Eigene Sprüche, die Julian zwischendurch sagt. {mama} wird automatisch ersetzt.
  eigeneSprueche: [
    // "Ich hab heute meine Hausaufgaben gemacht, {mama}. Fast alle.",
  ]
};
