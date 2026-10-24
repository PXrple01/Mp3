/* 8-Bit-Ständchen: wird im Browser erzeugt und als WAV abgespielt. */
(function () {
  const RATE = 22050;
  const BPM = 112;
  const BEAT = 60 / BPM;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // "Happy Birthday" (gemeinfrei) im 3/4-Takt, Auftakt eingeschlossen. [MIDI, Schläge]
  const MELODY = [
    [62, .75], [62, .25],
    [64, 1], [62, 1], [67, 1],
    [66, 2], [62, .75], [62, .25],
    [64, 1], [62, 1], [69, 1],
    [67, 2], [62, .75], [62, .25],
    [74, 1], [71, 1], [67, 1],
    [66, 1], [64, 1], [72, .75], [72, .25],
    [71, 1], [67, 1], [69, 1],
    [67, 3]
  ];
  // Akkorde je Takt (Grundton, Terz, Quinte)
  const CHORDS = [
    [43, 47, 50], [38, 42, 45], [38, 42, 45], [43, 47, 50],
    [43, 47, 50], [36, 40, 43], [43, 47, 50], [43, 47, 50]
  ];

  function square(phase, duty) { return (phase % 1) < duty ? 1 : -1; }
  function triangle(phase) { const p = phase % 1; return 4 * Math.abs(p - 0.5) - 1; }

  function addNote(buf, start, dur, freq, vol, kind, opts) {
    opts = opts || {};
    const s0 = Math.floor(start * RATE);
    const len = Math.floor(dur * RATE);
    const gate = Math.floor(len * (opts.gate || 0.88));
    const att = Math.floor(0.004 * RATE), rel = Math.floor(0.03 * RATE);
    let phase = 0;
    for (let i = 0; i < len + rel && s0 + i < buf.length; i++) {
      let env;
      if (i < att) env = i / att;
      else if (i < gate) env = 1 - Math.min(0.35, (i - att) / RATE * (opts.decay || 0.9));
      else env = Math.max(0, (1 - (i - gate) / rel)) * 0.65;
      if (env <= 0) break;
      const t = i / RATE;
      const vib = opts.vibrato && t > 0.18 ? 1 + Math.sin(t * 2 * Math.PI * 5.5) * 0.006 : 1;
      const slide = opts.slide ? Math.pow(2, opts.slide * Math.max(0, 1 - t / 0.05) / 12) : 1;
      phase += (freq * vib * slide) / RATE;
      let v;
      if (kind === "square") v = square(phase, opts.duty || 0.5);
      else if (kind === "tri") v = triangle(phase);
      else v = Math.random() * 2 - 1;
      buf[s0 + i] += v * vol * env;
    }
  }

  function noiseHit(buf, start, dur, vol) {
    const s0 = Math.floor(start * RATE), len = Math.floor(dur * RATE);
    let last = 0;
    for (let i = 0; i < len && s0 + i < buf.length; i++) {
      const env = Math.pow(1 - i / len, 3);
      const n = Math.random() * 2 - 1;
      const hp = n - last; last = n;
      buf[s0 + i] += hp * vol * env;
    }
  }

  function kick(buf, start, vol) {
    const s0 = Math.floor(start * RATE), len = Math.floor(0.12 * RATE);
    let phase = 0;
    for (let i = 0; i < len && s0 + i < buf.length; i++) {
      const t = i / RATE;
      const f = 140 * Math.exp(-t * 28) + 45;
      phase += f / RATE;
      buf[s0 + i] += triangle(phase) * vol * Math.pow(1 - i / len, 2);
    }
  }

  function render() {
    const introBeats = 6, verseBeats = 25, outroBeats = 7;
    const total = (introBeats + verseBeats * 2 + outroBeats) * BEAT + 1.2;
    const buf = new Float32Array(Math.ceil(total * RATE));

    // Intro: Arpeggio + "Level-Start"-Glitzer
    const arp = [67, 71, 74, 79, 74, 71];
    for (let i = 0; i < 12; i++) {
      addNote(buf, i * BEAT / 2, BEAT / 2, mtof(arp[i % 6] + 12), 0.07, "square", { duty: 0.25, gate: 0.6 });
    }
    for (let b = 0; b < introBeats; b++) {
      noiseHit(buf, b * BEAT, 0.05, 0.05);
      if (b % 3 === 0) kick(buf, b * BEAT, 0.35);
    }
    addNote(buf, 4 * BEAT, BEAT, mtof(43), 0.22, "tri");
    addNote(buf, 5 * BEAT, BEAT, mtof(50), 0.22, "tri");

    function verse(t0, transpose, duty, harmony) {
      let t = t0;
      for (const [m, d] of MELODY) {
        addNote(buf, t, d * BEAT, mtof(m + 12 + transpose), 0.16, "square", { duty, vibrato: d >= 2, slide: d >= 1 ? -0.4 : 0 });
        if (harmony) addNote(buf, t, d * BEAT, mtof(m + 12 + transpose - 5), 0.05, "square", { duty: 0.125, gate: 0.8 });
        t += d * BEAT;
      }
      // Walzer-Begleitung: Bass auf 1, Akkord auf 2 und 3
      const tb = t0 + BEAT;
      CHORDS.forEach((c, bar) => {
        const bt = tb + bar * 3 * BEAT;
        addNote(buf, bt, BEAT, mtof(c[0] + transpose), 0.24, "tri", { gate: 0.9 });
        kick(buf, bt, 0.3);
        for (let k = 1; k < 3; k++) {
          addNote(buf, bt + k * BEAT, BEAT * 0.5, mtof(c[1] + 24 + transpose), 0.045, "square", { duty: 0.25, gate: 0.5 });
          addNote(buf, bt + k * BEAT, BEAT * 0.5, mtof(c[2] + 24 + transpose), 0.045, "square", { duty: 0.25, gate: 0.5 });
          noiseHit(buf, bt + k * BEAT, 0.04, 0.045);
        }
      });
      kick(buf, t0, 0.2);
    }

    const v1 = introBeats * BEAT;
    verse(v1, 0, 0.5, false);
    const v2 = v1 + verseBeats * BEAT;
    verse(v2, 2, 0.25, true);

    // Outro: "Level geschafft"-Fanfare
    const o = v2 + verseBeats * BEAT;
    const fan = [69, 73, 76, 81];
    fan.forEach((m, i) => addNote(buf, o + i * BEAT / 3, BEAT / 3, mtof(m + 12), 0.12, "square", { duty: 0.25 }));
    addNote(buf, o + BEAT * 4 / 3, BEAT * 4, mtof(93), 0.11, "square", { duty: 0.5, vibrato: true });
    addNote(buf, o + BEAT * 4 / 3, BEAT * 4, mtof(88), 0.06, "square", { duty: 0.25, vibrato: true });
    addNote(buf, o + BEAT * 4 / 3, BEAT * 4, mtof(45), 0.24, "tri");
    kick(buf, o + BEAT * 4 / 3, 0.35);
    for (let i = 0; i < 6; i++) noiseHit(buf, o + i * BEAT / 4, 0.03, 0.04);

    // Sanfter Tiefpass gegen zu harte Rechtecke + Limiter
    let y = 0;
    for (let i = 0; i < buf.length; i++) {
      y += (buf[i] - y) * 0.55;
      buf[i] = Math.tanh(y * 1.4) * 0.9;
    }
    return buf;
  }

  function toWav(samples) {
    const n = samples.length;
    const ab = new ArrayBuffer(44 + n * 2);
    const v = new DataView(ab);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE");
    str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, "data"); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
    return new Blob([ab], { type: "audio/wav" });
  }

  let cached = null;
  window.Synth = {
    BPM,
    birthdayUrl() {
      if (!cached) cached = URL.createObjectURL(toWav(render()));
      return cached;
    },
    duration: (6 + 25 * 2 + 7) * BEAT + 1.2
  };
})();
