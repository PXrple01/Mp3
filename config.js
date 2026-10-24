/*
  ───────────────────────────────────────────────
  Hier kannst du alles Persönliche anpassen.
  Nur die Texte zwischen den Anführungszeichen ändern.
  ───────────────────────────────────────────────
*/
window.MAMA_CONFIG = {
  // So nennen sie sie.
  mama: "Mama",

  // Wer im Player wohnt.
  name: "Julian",

  // Sein Outfit zum Start:
  // "creeper" (Hoodie), "trainer" (Pokémon), "gruen", "rot", "blau", "schwarz", "weiss" oder "gold" (Ninjago).
  outfit: "creeper",

  // Ordner auf Mamas Handy, in dem die Musik liegt (Android-App). Groß/klein ist egal.
  musikOrdner: "juliPod",

  // Mamas Geburtstag als "TT.MM", z. B. "14.10". Dann gibt es an dem Tag eine Überraschung.
  geburtstag: "",

  // Der große Bruder. Er taucht nur ein einziges Mal auf: beim allerersten Öffnen.
  ueberlieferer: {
    name: "Johann",
    titel: "Mäßiger Überlieferer",
    saetze: [
      "Hallo {mama}! Hier spricht der mäßige Überlieferer.",
      "Sorry, dass dein Geschenk so spät kommt. Die Verspätung tut mir echt leid.",
      "Viel Spaß mit deinem juliPod! Ich hab dich lieb."
    ],
    // Steht versteckt auf Seite B der Kassette.
    seiteB: "Danke, dass du immer meine beste Freundin bist.",
    seiteBLang: "Psst, Seite B ist von mir. Danke, dass du immer meine beste Freundin bist, {mama}. Egal was ist, ich kann immer zu dir kommen. Ich hab dich lieb."
  },

  // Versteckte Notizen im Klickrad-Menü (ganz unten unter "Extras").
  notizen: [
    { titel: "Für Mama", text: "Wir hätten uns keine bessere Mama wünschen können." },
    { titel: "Von Johann", text: "Danke, dass du immer meine beste Freundin bist. Egal was ist, ich kann immer zu dir kommen." },
    { titel: "Von Julian", text: "Ich bau manchmal Mist. Aber ich hab dich am allermeisten lieb. Mehr als Minecraft. Und mehr als PS4." },
    { titel: "Danke", text: "Danke für jedes Essen, jede Umarmung und jede zweite Chance. Und dritte. Und vierte." },
    { titel: "Zuhause", text: "Zuhause ist da, wo du bist." },
    { titel: "Für schlechte Tage", text: "Wenn du mal einen schlechten Tag hast: Du bist die Beste. Steht hier schwarz auf weiß. Also hell auf blau." }
  ],

  // Bonus-Track auf der CD.
  bonusTrack: "Anti-Skip heißt: Unsere Liebe zu dir springt nie. Wir hätten uns keine bessere Mama wünschen können.",

  // Versteckt unter dem Brief.
  ps: [
    "P.S. Wir hätten uns keine bessere Mama wünschen können.",
    "P.P.S. Von Julian: Mein Zimmer räum ich trotzdem morgen auf."
  ],

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
