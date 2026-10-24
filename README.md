# juliPod

Ein verspätetes Geburtstagsgeschenk für Mama: vier Retro-Player (Klickrad, Kassette, MP3-Stick, CD) in einer schlichten, modernen App. In jedem Player wohnt Julian als kleiner Pixel-Assistent. Er tanzt zur Musik, zockt PS4, wenn Pause ist, baut Diamanten ab, macht Spinjitzu und sagt Mama in Sprechblasen, wie lieb er sie hat. Überall sind kleine Nachrichten von Johann und Julian versteckt.

Mama muss nichts einrichten und keine Musik hochladen. Die Lieder legt Johann einmal auf ihr Handy, die App findet sie von selbst.

## Auf Mamas Android-Handy bringen

### 1. App installieren

1. Die Datei [`juliPod.apk`](juliPod.apk) auf ihr Handy bringen, zum Beispiel per WhatsApp an sie schicken, per USB-Kabel kopieren oder auf ihrem Handy diesen Link öffnen: `https://github.com/PXrple01/Mp3/raw/julipod/juliPod.apk`
2. Die Datei antippen. Android fragt, ob die App (WhatsApp, Dateien oder Chrome) **Apps installieren darf**: einmal erlauben.
3. Installieren. Falls Google Play Protect warnt, auf „Trotzdem installieren“ tippen. Die App kommt nicht aus dem Play Store, deshalb kommt diese Warnung.

### 2. Musik draufmachen (der 1-GB-Ordner)

1. Ihr Handy per USB-Kabel an den Computer anschließen und am Handy „Dateiübertragung“ wählen.
2. Den Musikordner in den Ordner **Music** (oder „Musik“) auf dem Handy kopieren und ihn **juliPod** nennen. Ergebnis: `Music/juliPod/…`. Unterordner sind erlaubt.
3. Fertig. Die App sortiert die Lieder nach Ordner und Dateiname. Titel, Interpret und Cover liest Android aus den MP3s.

Später neue Lieder? Einfach in denselben Ordner kopieren, die App zeigt sie beim nächsten Öffnen an.

> Warum nicht über eine Cloud? Dann bräuchte die App jedes Mal Internet und mobile Daten, und jedes Lied bräuchte einen eigenen Direktlink. Direkt auf dem Handy spielt alles offline, sofort und ohne Datenverbrauch.

### 3. Beim ersten Öffnen

Die App fragt nach zwei Erlaubnissen: **Musik und Audio** (damit sie den Ordner lesen darf) und **Benachrichtigungen** (für die Steuerung auf dem Sperrbildschirm). Beides erlauben. Danach erscheint einmalig der mäßige Überlieferer mit seinem Paket.

**Tipp:** Öffne die App vor der Übergabe nicht auf Mamas Handy, sonst verpasst sie die Überraschung. Zum Testen kannst du die App auf deinem eigenen Android-Handy installieren.

## Was die App kann

- **Vier Player**, zwischen denen man wischen oder tippen kann. Am Klickrad dreht man, die Kassettenrollen laufen mit, die CD dreht sich, der Stick hat Kappe und HOLD-Schalter.
- **Julian** in Pixel-Art, mit Creeper-Hoodie, Pokémon-Trainer-Outfit oder einem der sechs Ninjago-Anzüge.
- **Läuft im Hintergrund weiter**, auch bei gesperrtem Handy, mit Steuerung in der Benachrichtigung, auf dem Sperrbildschirm und über Kopfhörer-Tasten. Zieht man die Kopfhörer ab, pausiert die Musik.
- **Suche** in der Musikliste, Zufall und Wiederholen.
- **8-Bit-Geburtstagsständchen** als erstes Lied, im Browser erzeugt.
- **Feiertage:** An Weihnachten trägt Julian eine Mütze und es schneit, an Silvester gibt es Feuerwerk, an Halloween einen Kürbis, an Ostern ein Ei. Am Muttertag und an Mamas Geburtstag fliegen Herzen (Datum in `config.js` unter `geburtstag` eintragen).

## Anpassen

Alles Persönliche steht in [`config.js`](config.js): Johanns drei Sätze, die Nachricht auf Seite B der Kassette, die Notizen im Klickrad, der Bonus-Track der CD, das P.S. unter dem Brief, Mamas Geburtstag und der Name des Musikordners. Was Julian sonst so sagt, steht in [`js/lines.js`](js/lines.js).

Nach Änderungen die App neu bauen:

```bash
./android/build.sh
```

Das Skript lädt beim ersten Mal die Android-Werkzeuge (braucht Java 17 oder neuer) und erzeugt `juliPod.apk`.

**Wichtig – Signier-Schlüssel:** `android/julipod.keystore` liegt absichtlich nicht im Repository, weil es öffentlich ist. Bewahre die Datei gut auf und lege sie vor dem nächsten Bauen wieder in den Ordner `android/`. Nur mit demselben Schlüssel lässt sich die App später aktualisieren, ohne sie vorher zu löschen. Löschen würde Julians Fortschritt (Geheimnisse, Outfit) zurücksetzen, die Musik bleibt aber auf dem Handy.

## Web-Version

Die gleiche Seite läuft auch im Browser, zum Beispiel über GitHub Pages (Settings → Pages → Branch wählen). Dort kommen Lieder aus `songs/playlist.json`:

```json
[
  { "datei": "lieblingslied.mp3", "titel": "Lieblingslied", "kuenstler": "Band" },
  { "url": "https://example.com/anderes-lied.mp3", "titel": "Anderes Lied" }
]
```

`#neu` an der Adresse setzt im Browser alles zurück (Intro, Geheimnisse, Einstellungen).

## Technik

Reines HTML, CSS und JavaScript ohne Build-Schritt. Die Android-App ([`android/`](android)) ist eine kleine Java-Hülle mit WebView: Sie liefert die Seite aus den App-Dateien aus, liest die Musik über den Android-MediaStore und streamt sie mit Range-Unterstützung an die Seite. Ein Vordergrund-Dienst mit MediaSession übernimmt Benachrichtigung und Sperrbildschirm. Die Pixel-Figuren zeichnet [`js/sprite.js`](js/sprite.js), das Ständchen synthetisiert [`js/synth.js`](js/synth.js).

<details>
<summary>Spoiler: die 12 Geheimnisse und weitere versteckte Nachrichten</summary>

| Geheimnis | So findet man es |
| --- | --- |
| Tür zu! | Schnell und oft auf Julian tippen: Er läuft rot an, schreit „JETZT LASST MICH ALLE IN RUHE!“ und knallt die Tür zu. Nach dreimal Klopfen oder ein paar Sekunden kommt er wieder raus. |
| Umarmung | Julian lange gedrückt halten |
| Schlafmütze | Eine Minute lang nichts anfassen |
| Schwindelig | Am Klickrad einmal ganz herumdrehen |
| Diamanten! | Ein Lied bis zum Ende hören |
| Gesperrt | Den HOLD-Schalter am Stick umlegen |
| USB-Forscherin | Die Kappe vom Stick abnehmen |
| Sammlerin | Alle vier Player ausprobieren |
| Seite B | An der Kassette auf „Auto Reverse“ tippen: Die Kassette dreht sich um, auf Seite B steht Johanns Dank an seine beste Freundin. |
| Bonus-Track | Auf die Schrift am CD-Deckel tippen |
| Notizen | Im Klickrad-Menü ganz nach unten zu „Extras“ |
| Geheimes P.S. | Im Brief auf die Unterschrift tippen |

Ohne Fortschritts-Meldung, aber genauso versteckt:
- Akku-Symbol am Klickrad antippen
- Bei abgenommener Stick-Kappe den USB-Stecker antippen
- „Julian innen.“ in der Überschrift antippen
- Die Zeile ganz unten auf der Seite antippen
- Das Handy kräftig schütteln
- Julian hält manchmal ein Schild hoch, und zwischendurch sagt er süße Sätze von sich und Johann

</details>
