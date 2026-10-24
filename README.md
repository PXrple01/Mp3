# juliPod

Ein verspätetes Geburtstagsgeschenk für Mama: vier Retro-Player (Klickrad, Kassette, MP3-Stick, CD) auf einer schlichten, modernen Seite. In jedem Player wohnt Julian als kleiner Pixel-Assistent. Er tanzt zur Musik, zockt PS4, wenn Pause ist, baut Diamanten ab, macht Spinjitzu und sagt Mama in Sprechblasen, wie lieb er sie hat.

Die Seite braucht keinen Server, kein Konto und kein Tracking. Alles läuft im Browser.

## Was drin ist

- **Vier Player**, zwischen denen man wischen oder tippen kann. Jeder hat echte Bedienung: Am Klickrad dreht man, die Kassettenrollen laufen mit, die CD dreht sich, und der Stick hat Kappe und HOLD-Schalter.
- **Julian** in Pixel-Art, standardmäßig im Creeper-Hoodie. Unter „Was zieht Julian heute an?“ gibt es außerdem ein Pokémon-Trainer-Outfit und sechs Ninjago-Anzüge.
- **Der mäßige Überlieferer** taucht nur ein einziges Mal auf, beim allerersten Öffnen. Er bringt ein Paket, entschuldigt sich für die Verspätung und hat Mama lieb. Dann springt Julian aus dem Paket.
- **Ein 8-Bit-Geburtstagsständchen** als erstes Lied. Es wird direkt im Browser erzeugt.
- **Eigene Lieder hochladen** (MP3, M4A, AAC, WAV). Titel, Interpret und Cover werden aus der Datei gelesen. Die Lieder bleiben auf dem Gerät gespeichert.
- **Sperrbildschirm-Steuerung**: Abspielen, Pause und Weiter funktionieren auch bei gesperrtem Handy und mit Kopfhörer-Tasten.
- **8 versteckte Geheimnisse** mit „Fortschritt erzielt!“-Meldung (Spoiler ganz unten).
- **Ein Brief** am Ende der Seite, der sich beim Scrollen Wort für Wort aufbaut.

## Anpassen

Alles Persönliche steht in [`config.js`](config.js): Mamas Anrede, Julians Name, sein Start-Outfit, die drei Sätze des Überlieferers, der Brief, die Unterschrift und eigene Sprüche. Was Julian sonst so sagt, steht in [`js/lines.js`](js/lines.js).

## Online stellen (GitHub Pages)

1. Im Repository auf **Settings → Pages** gehen.
2. Unter „Build and deployment“ als Source **Deploy from a branch** wählen, Branch **main** und Ordner **/ (root)**.
3. Nach ein bis zwei Minuten ist die Seite unter `https://<dein-name>.github.io/<repo-name>/` erreichbar.

## Lieder auf Mamas Handy bringen

Am einfachsten auf **Mamas Handy** selbst: Seite öffnen, auf „Lieder hinzufügen“ tippen, Dateien auswählen. Die Lieder werden nur auf diesem Gerät gespeichert. Lädst du sie auf deinem Handy hoch, sind sie also nicht bei Mama.

**iPhone:** Zuerst in Safari auf *Teilen → Zum Home-Bildschirm* tippen und den juliPod danach über das neue Symbol öffnen. Erst dann die Lieder hochladen. Die Home-Bildschirm-App hat einen eigenen Speicher, den Safari nach längerer Pause nicht aufräumt.

**Lautstärke auf dem iPhone:** iOS lässt Webseiten die Lautstärke nicht ändern. Dort spult das Klickrad deshalb vor und zurück, und Julian erklärt, dass die Lautstärke über die Handy-Tasten geht.

### Lieder vorab einbauen (optional)

Du kannst MP3s auch in den Ordner `songs/` legen und in `songs/playlist.json` eintragen:

```json
[
  { "datei": "lieblingslied.mp3", "titel": "Lieblingslied", "kuenstler": "Band" }
]
```

Achtung: Bei einem öffentlichen Repository kann dann jeder die Lieder herunterladen.

## Einmal-Intro erneut testen

Der Überlieferer erscheint auf jedem Gerät nur einmal. Hängst du `#neu` an die Adresse, wird auf diesem Gerät alles zurückgesetzt (Intro, Geheimnisse, Einstellungen). Die hochgeladenen Lieder bleiben dabei erhalten. Teste das am besten nicht auf Mamas Handy, sonst verpasst sie die Überraschung.

## Technik

Reines HTML, CSS und JavaScript ohne Build-Schritt. Lieder liegen in IndexedDB, Einstellungen in localStorage. Ein Service Worker hält die Seite offline verfügbar. Die Pixel-Figuren werden auf Canvas gezeichnet ([`js/sprite.js`](js/sprite.js)), das Ständchen synthetisiert [`js/synth.js`](js/synth.js).

<details>
<summary>Spoiler: die 8 Geheimnisse</summary>

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

</details>
