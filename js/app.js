/* juliPod – alles, was sich bewegt. */
(function () {
  "use strict";

  const CFG = Object.assign({
    mama: "Mama", name: "Julian", outfit: "creeper", absender: "", brief: [],
    demoLied: true, eigeneSprueche: [], ueberlieferer: null
  }, window.MAMA_CONFIG || {});
  const MAMA = CFG.mama || "Mama";
  const NAME = (CFG.name || "").trim() || "Julian";
  const LINES = window.LINES || {};
  const SP = window.Sprite;

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();

  const LS = {
    get(k, d) { try { const v = localStorage.getItem("jp." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("jp." + k, JSON.stringify(v)); } catch (e) { } }
  };
  if (/(^|[?#&])neu\b/.test(location.search + location.hash)) {
    try { Object.keys(localStorage).filter((k) => k.indexOf("jp.") === 0).forEach((k) => localStorage.removeItem(k)); } catch (e) { }
  }

  const volumeWorks = (() => {
    if (isIOS) return false;
    try { const a = document.createElement("audio"); a.volume = 0.5; return Math.abs(a.volume - 0.5) < 0.01; } catch (e) { return false; }
  })();

  const ORDER = ["classic", "tape", "stick", "disc"];
  const DEV_SIZE = { classic: [250, 414], tape: [340, 256], stick: [138, 360], disc: [306, 366] };
  const DEV_GLOW = { classic: "#9ec5ff", tape: "#ff9a4a", stick: "#38e0cf", disc: "#c7a0ff" };

  const S = {
    tracks: [], idx: -1, playing: false,
    shuffle: LS.get("shuffle", false), repeat: LS.get("repeat", "all"),
    player: ORDER.indexOf(LS.get("player", "classic")) >= 0 ? LS.get("player", "classic") : "classic",
    vol: clamp(LS.get("vol", 0.85), 0, 1),
    outfit: LS.get("outfit", SP.OUTFITS[CFG.outfit] ? CFG.outfit : "creeper"),
    found: LS.get("found", {}), seen: LS.get("seen", {}),
    lastInput: now(), hold: false, capOff: false,
    skips: [], errors: 0, reelBurst: 0, birthdaySaid: false, coverColor: null
  };
  if (!SP.OUTFITS[S.outfit]) S.outfit = "creeper";

  const fmt = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ":" + String(r).padStart(2, "0");
  };
  const fill = (t, vars) => String(t).replace(/\{mama\}/g, MAMA).replace(/\{name\}/g, NAME).replace(/\{n\}/g, vars && vars.n != null ? vars.n : "");
  const vibrate = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { } };
  const shuffleArr = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  /* ═════════ Audio ═════════ */
  const audio = document.createElement("audio");
  audio.preload = "auto";
  audio.setAttribute("playsinline", "");
  audio.setAttribute("webkit-playsinline", "");
  document.body.appendChild(audio);
  if (volumeWorks) audio.volume = S.vol;

  let actx = null, analyser = null, freq = null, graphTried = false;
  function initGraph() {
    if (graphTried || isIOS) return;
    graphTried = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      actx = new AC();
      const src = actx.createMediaElementSource(audio);
      analyser = actx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.72;
      src.connect(analyser);
      analyser.connect(actx.destination);
      freq = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) { actx = null; analyser = null; }
  }
  function tick() {
    if (!actx || actx.state !== "running") return;
    try {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "square"; o.frequency.value = 2400;
      g.gain.setValueAtTime(0.025, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.012);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + 0.015);
    } catch (e) { }
  }

  const cur = () => S.tracks[S.idx] || null;
  function trackUrl(t) { return t.kind === "demo" ? window.Synth.birthdayUrl() : t.url; }
  function ensureLoaded() {
    const t = cur();
    if (!t) return false;
    if (audio.dataset.tid !== String(t.id)) {
      audio.src = trackUrl(t);
      audio.dataset.tid = String(t.id);
    }
    return true;
  }
  function play() {
    if (!S.tracks.length) { Talk.say("empty", { pr: 2 }); return; }
    if (S.idx < 0) S.idx = 0;
    if (!ensureLoaded()) return;
    initGraph();
    if (actx && actx.state === "suspended") actx.resume();
    const p = audio.play();
    if (p && p.catch) p.catch(() => { });
  }
  function pause() { audio.pause(); }
  function toggle() { if (audio.paused) play(); else pause(); }
  function stop() {
    S.stopping = true;
    audio.pause();
    try { audio.currentTime = 0; } catch (e) { }
    Talk.say("stop", { pr: 1 });
    setTimeout(() => { S.stopping = false; }, 50);
  }
  function setTrack(i, autoplay) {
    if (!S.tracks.length) { S.idx = -1; renderTrack(); return; }
    S.idx = ((i % S.tracks.length) + S.tracks.length) % S.tracks.length;
    const t = cur();
    LS.set("last", t.id);
    S.errors = autoplay ? S.errors : 0;
    if (autoplay) { ensureLoaded(); play(); }
    else if (audio.dataset.tid && audio.dataset.tid !== String(t.id)) { audio.pause(); audio.removeAttribute("src"); audio.dataset.tid = ""; audio.load(); }
    renderTrack();
  }
  function next(fromUser) {
    if (!S.tracks.length) return;
    let i;
    if (S.shuffle && S.tracks.length > 1) { do { i = Math.floor(Math.random() * S.tracks.length); } while (i === S.idx); }
    else i = S.idx + 1;
    if (fromUser !== false) {
      const t = now();
      S.skips = S.skips.filter((x) => t - x < 15000); S.skips.push(t);
      S.reelBurst = t + 650;
      if (S.skips.length >= 4) { Talk.say("skipMany", { pr: 2 }); S.skips = []; }
      else Talk.say("next", { pr: 1 });
      J.spin(700);
    }
    setTrack(i, true);
  }
  function prev() {
    if (!S.tracks.length) return;
    S.reelBurst = now() + 650;
    if (audio.currentTime > 3) { audio.currentTime = 0; play(); return; }
    Talk.say("prev", { pr: 1 });
    setTrack(S.idx - 1, true);
  }
  function seekBy(sec) {
    if (!isFinite(audio.duration)) return;
    audio.currentTime = clamp(audio.currentTime + sec, 0, audio.duration - 0.2);
    showHud("Spulen", audio.currentTime / audio.duration);
  }
  function setVolume(v, quiet) {
    const before = S.vol;
    v = clamp(Math.round(v * 100) / 100, 0, 1);
    S.vol = v;
    if (volumeWorks) audio.volume = v;
    LS.set("vol", v);
    const vi = $("#vol");
    if (vi) { vi.value = Math.round(v * 100); vi.style.setProperty("--p", Math.round(v * 100) + "%"); }
    const tv = $("[data-volwheel]");
    if (tv) { tv.style.setProperty("--vp", (v * 64).toFixed(1) + "px"); tv.setAttribute("aria-valuenow", Math.round(v * 100)); }
    showHud("Lautstärke", v);
    if (quiet) return;
    if (v >= 1 && before < 1) { Talk.say("volMax", { pr: 1 }); J.setMood("shock", 900); J.jump(-60); }
    else if (v <= 0.05 && before > 0.05) Talk.say("volMin", { pr: 1 });
    else if (v - before > 0 && Math.floor(v * 4) > Math.floor(before * 4)) Talk.say("volUp", { pr: 0 });
  }
  function volStep(d) {
    if (!volumeWorks) { Talk.say("volHint", { pr: 1 }); return; }
    setVolume(S.vol + d * 0.1);
  }

  audio.addEventListener("play", () => {
    const was = S.playing;
    S.playing = true;
    document.body.classList.add("is-playing");
    if (actx && actx.state === "suspended") actx.resume();
    const t = cur();
    if (!was) {
      if (t && t.kind === "demo" && !S.birthdaySaid) {
        S.birthdaySaid = true;
        Talk.say("birthday", { pr: 2 });
        setTimeout(() => confettiFromDevice(90), 300);
      } else if (Math.random() < 0.55) Talk.say("play", { pr: 1 });
    }
    if (J.mood === "sleep") Talk.say("wake", { pr: 2 });
    renderStateBits();
    updatePositionState();
  });
  audio.addEventListener("pause", () => {
    S.playing = false;
    document.body.classList.remove("is-playing");
    if (!audio.ended && !S.stopping && audio.currentTime > 0.5 && Math.random() < 0.6) Talk.say("pause", { pr: 1 });
    renderStateBits();
  });
  audio.addEventListener("ended", () => {
    const last = S.idx === S.tracks.length - 1;
    if (document.visibilityState === "visible") { J.mine(); Talk.say("songEnd", { pr: 2 }); }
    if (S.repeat === "one") { audio.currentTime = 0; play(); return; }
    if (last && !S.shuffle && S.repeat === "off") { Talk.say("listEnd", { pr: 2 }); setTrack(0, false); return; }
    next(false);
  });
  audio.addEventListener("loadedmetadata", () => {
    const t = cur();
    if (t && (!t.duration || !isFinite(t.duration)) && isFinite(audio.duration)) { t.duration = audio.duration; renderLibrary(); }
    updatePositionState();
  });
  audio.addEventListener("error", () => {
    if (!audio.getAttribute("src")) return;
    S.errors++;
    if (S.errors > Math.min(4, S.tracks.length)) return;
    Talk.say("error", { pr: 2 });
    if (S.tracks.length > 1) setTimeout(() => next(false), 900);
  });
  audio.addEventListener("playing", () => { S.errors = 0; });

  /* Sperrbildschirm & Kopfhörer-Tasten */
  function updateMediaSession() {
    if (!("mediaSession" in navigator)) return;
    const t = cur();
    if (!t) return;
    try {
      const art = t.cover ? [{ src: t.cover }] : [{ src: artworkData(), sizes: "512x512", type: "image/png" }];
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist || NAME, album: "juliPod für " + MAMA, artwork: art });
    } catch (e) { }
  }
  function updatePositionState() {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    try {
      if (isFinite(audio.duration) && audio.duration > 0) navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: Math.min(audio.currentTime, audio.duration) });
    } catch (e) { }
  }
  if ("mediaSession" in navigator) {
    const h = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch (e) { } };
    h("play", () => play());
    h("pause", () => pause());
    h("previoustrack", () => prev());
    h("nexttrack", () => next());
    h("seekto", (d) => { if (d && d.seekTime != null) { audio.currentTime = d.seekTime; updatePositionState(); } });
    h("seekbackward", (d) => { audio.currentTime = Math.max(0, audio.currentTime - ((d && d.seekOffset) || 10)); });
    h("seekforward", (d) => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + ((d && d.seekOffset) || 10)); });
  }

  /* ═════════ Pegel & Takt ═════════ */
  const Lv = { level: 0, bass: 0, avgBass: 0.2, beat: 0, lastBeat: 0, beatCount: 0, bars: new Float32Array(16), simNext: 0 };
  function updateLevels(t, dt) {
    const bars = Lv.bars;
    if (S.playing && analyser) {
      analyser.getByteFrequencyData(freq);
      let b = 0; for (let i = 1; i <= 5; i++) b += freq[i];
      b /= 5 * 255;
      let all = 0; for (let i = 0; i < 120; i++) all += freq[i];
      all /= 120 * 255;
      Lv.bass = b; Lv.level += (all - Lv.level) * 0.3;
      for (let k = 0; k < 16; k++) {
        const lo = Math.floor(Math.pow(1.32, k)), hi = Math.max(lo + 1, Math.floor(Math.pow(1.32, k + 1)));
        let s = 0; for (let i = lo; i < hi && i < freq.length; i++) s += freq[i];
        const v = s / ((hi - lo) * 255);
        bars[k] += (v - bars[k]) * 0.45;
      }
      if (b > Lv.avgBass * 1.18 && b > 0.32 && t - Lv.lastBeat > 290) onBeat(t);
      Lv.avgBass += (b - Lv.avgBass) * 0.06;
    } else if (S.playing) {
      const c = cur();
      const bpm = c && c.kind === "demo" ? window.Synth.BPM : 104;
      const iv = 60000 / bpm;
      if (t >= Lv.simNext) { Lv.simNext = (Lv.simNext && t - Lv.simNext < iv) ? Lv.simNext + iv : t + iv; onBeat(t); }
      Lv.level += ((0.35 + Lv.beat * 0.35) - Lv.level) * 0.2;
      for (let k = 0; k < 16; k++) {
        const v = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(t * 0.004 * (1 + k * 0.23) + k * 1.7)) * (0.55 + Lv.beat * 0.6) * (1 - k / 22);
        bars[k] += (v - bars[k]) * 0.3;
      }
    } else {
      Lv.level *= 0.92;
      for (let k = 0; k < 16; k++) bars[k] *= 0.9;
    }
    Lv.beat = Math.max(0, Lv.beat - dt * 3.2);
  }
  function onBeat(t) {
    Lv.beat = 1; Lv.lastBeat = t; Lv.beatCount++;
    if (J.mood === "dance" && Lv.beatCount % 2 === 0 && !J.hidden) J.note();
  }

  /* ═════════ Sprechblase ═════════ */
  const bubble = $("#bubble"), bubbleText = $(".bubble-text", bubble), bubbleName = $(".bubble-name", bubble), live = $("#bubble-live");
  const Talk = {
    bags: {}, cur: null, typeTimer: 0, hideTimer: 0, lastEnd: 0, nextGap: 22000,
    pick(key) {
      const arr = LINES[key];
      if (!arr || !arr.length) return null;
      let bag = this.bags[key];
      if (!bag || !bag.length) {
        bag = this.bags[key] = shuffleArr(arr.slice());
        if (bag.length > 1 && bag[bag.length - 1] === this.lastText) bag.unshift(bag.pop());
      }
      return bag.pop();
    },
    busy() { return !!this.cur; },
    say(key, o) {
      o = o || {};
      const pr = o.pr || 0;
      if (this.cur && this.cur.pr > pr) return false;
      if (Intro.active && !o.force) return false;
      const raw = o.text || this.pick(key);
      if (!raw) return false;
      this.show(fill(raw, o), o);
      return true;
    },
    show(text, o) {
      o = o || {};
      clearInterval(this.typeTimer); clearTimeout(this.hideTimer);
      const who = o.who || "julian";
      bubble.classList.toggle("is-brother", who === "brother");
      bubble.classList.toggle("is-shout", o.style === "shout");
      bubbleName.textContent = who === "brother" ? ((CFG.ueberlieferer && CFG.ueberlieferer.titel) || "Mäßiger Überlieferer") : NAME;
      live.textContent = bubbleName.textContent + ": " + text;
      this.lastText = text;
      const hold = o.hold || clamp(2400 + text.length * 52, 3000, 8200);
      this.cur = { pr: o.pr || 0, onEnd: o.onEnd, text, who };
      bubble.classList.remove("show");
      void bubble.offsetWidth;
      bubble.classList.add("show");
      let i = 0;
      const speaker = who === "brother" ? Brother : J;
      if (reduced) { bubbleText.textContent = text; }
      else {
        bubbleText.textContent = "";
        this.typeTimer = setInterval(() => {
          i += 1 + (text[i] === " " ? 1 : 0);
          bubbleText.textContent = text.slice(0, i);
          speaker.talkUntil = now() + 160;
          if (i >= text.length) clearInterval(this.typeTimer);
        }, 26);
      }
      this.hideTimer = setTimeout(() => this.end(), hold + (reduced ? 0 : text.length * 26));
    },
    end() {
      clearInterval(this.typeTimer); clearTimeout(this.hideTimer);
      bubbleText.textContent = this.cur ? this.cur.text : bubbleText.textContent;
      bubble.classList.remove("show");
      const c = this.cur;
      this.cur = null;
      this.lastEnd = now();
      this.nextGap = 24000 + Math.random() * 22000;
      if (c && c.onEnd) c.onEnd();
    },
    skip() {
      if (!this.cur) return;
      if (bubbleText.textContent.length < this.cur.text.length) {
        clearInterval(this.typeTimer);
        bubbleText.textContent = this.cur.text;
        clearTimeout(this.hideTimer);
        this.hideTimer = setTimeout(() => this.end(), 2200);
      } else this.end();
    },
    chain(items, done) {
      let i = 0;
      const step = () => {
        if (i >= items.length) { if (done) done(); return; }
        const it = items[i++];
        this.show(fill(it.text), Object.assign({ pr: 4 }, it, { onEnd: () => setTimeout(step, 280) }));
      };
      step();
    }
  };

  /* ═════════ Szenen (Pixel-Welten in den Displays) ═════════ */
  const SCENE_CFG = {
    classic: { H: 38, ground: (H) => H - 5, margin: 4, bg: bgClassic },
    tape: { H: 66, ground: (H) => H - 3, margin: 14, shadow: true },
    stick: { H: 30, ground: (H) => H - 6, margin: 3, bg: bgStick, lcd: true },
    disc: { H: 62, ground: (H) => Math.round(H / 2) + 10, margin: 0, shadow: true, disc: true }
  };

  function Scene(canvas, kind) {
    this.c = canvas; this.kind = kind; this.cfg = SCENE_CFG[kind];
    this.g = canvas.getContext("2d");
    this.off = document.createElement("canvas");
    this.o = this.off.getContext("2d", { willReadFrequently: kind === "stick" });
    this.H = this.cfg.H; this.W = 60;
  }
  Scene.prototype.resize = function (fit) {
    const w = this.c.clientWidth, h = this.c.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.c.width = Math.max(1, Math.round(w * fit * dpr));
    this.c.height = Math.max(1, Math.round(h * fit * dpr));
    this.W = Math.max(24, Math.round(this.H * w / h));
    this.off.width = this.W; this.off.height = this.H;
    this.ground = this.cfg.ground(this.H);
    if (this.cfg.disc) { const cx = Math.round(this.W / 2) - 5; this.minX = cx - 13; this.maxX = cx + 13; }
    else { this.minX = this.cfg.margin + 1; this.maxX = this.W - this.cfg.margin - 11; }
  };
  Scene.prototype.xOf = function (xr) { return Math.round(this.minX + xr * (this.maxX - this.minX)); };
  Scene.prototype.render = function (t) {
    if (this.ground == null) return;
    const o = this.o, W = this.W, H = this.H;
    o.clearRect(0, 0, W, H);
    if (this.cfg.bg) this.cfg.bg(o, this, t);
    drawWorld(o, this, t);
    if (this.cfg.lcd) lcdize(o, W, H);
    const g = this.g;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, this.c.width, this.c.height);
    g.drawImage(this.off, 0, 0, W, H, 0, 0, this.c.width, this.c.height);
  };

  const SKY = {
    night: ["#0b1430", "#122149", "#1b2d61", "#24396f"],
    dawn: ["#ffb08f", "#ffc8a6", "#ffdcbf", "#ffeedd"],
    day: ["#4a9dff", "#6db2ff", "#93c8ff", "#bfe0ff"],
    dusk: ["#ff7a59", "#ff9b6a", "#ffbe7f", "#ffd9a3"]
  };
  function skyKind() {
    const h = new Date().getHours();
    if (h >= 21 || h < 5) return "night";
    if (h < 8) return "dawn";
    if (h < 17) return "day";
    return "dusk";
  }
  const STARS = Array.from({ length: 18 }, (_, i) => [(i * 37 + 11) % 97 / 97, ((i * 53 + 7) % 61) / 61 * 0.62, i]);
  function bgClassic(o, sc, t) {
    const W = sc.W, gy = sc.ground, kind = skyKind(), sky = SKY[kind];
    const band = Math.ceil(gy / sky.length);
    sky.forEach((c, i) => { o.fillStyle = c; o.fillRect(0, i * band, W, band); });
    for (let i = 1; i < sky.length; i++) {
      o.fillStyle = sky[i];
      for (let x = (i % 2); x < W; x += 2) o.fillRect(x, i * band - 1, 1, 1);
    }
    if (kind === "night") {
      STARS.forEach(([sx, sy, i]) => {
        if (Math.sin(t * 0.002 + i * 2.1) > -0.3) { o.fillStyle = i % 3 ? "#ffffff" : "#ffe58a"; o.fillRect(Math.round(sx * W), Math.round(sy * gy), 1, 1); }
      });
      o.fillStyle = "#f4f1d0"; o.fillRect(W - 14, 4, 5, 5);
      o.fillStyle = "#d9d4ad"; o.fillRect(W - 12, 5, 1, 1); o.fillRect(W - 11, 7, 1, 1);
    } else {
      o.fillStyle = kind === "day" ? "#fff3a8" : "#ffe7a0";
      o.fillRect(W - 15, 4, 6, 6);
      o.fillStyle = kind === "day" ? "#ffe15a" : "#ffcf6a";
      o.fillRect(W - 14, 5, 4, 4);
      const cl = (x0, y) => {
        const x = Math.round(((x0 + t * 0.0025) % (W + 24)) - 12);
        o.fillStyle = "#ffffff"; o.fillRect(x, y, 9, 2); o.fillRect(x + 2, y - 1, 5, 1); o.fillRect(x + 1, y + 2, 7, 1);
      };
      cl(8, 6); cl(W * 0.6, 11);
    }
    // Equalizer im Himmel
    const bars = Lv.bars, bw = W / 16;
    o.fillStyle = "rgba(255,255,255,0.28)";
    for (let k = 0; k < 16; k++) {
      const h = Math.round(bars[k] * (gy - 4));
      if (h > 0) o.fillRect(Math.round(k * bw), gy + 1 - h, Math.max(1, Math.round(bw) - 1), h);
    }
    // Grasblock-Boden
    for (let x = 0; x < W; x++) {
      o.fillStyle = (x * 7) % 5 === 0 ? "#4a9e2f" : "#5fbf3f"; o.fillRect(x, gy + 1, 1, 1);
      o.fillStyle = (x * 3) % 4 === 0 ? "#5fbf3f" : "#4a9e2f"; o.fillRect(x, gy + 2, 1, 1);
      for (let y = gy + 3; y < sc.H; y++) { o.fillStyle = ((x * 13 + y * 7) % 6 === 0) ? "#6d4528" : "#8a5a35"; o.fillRect(x, y, 1, 1); }
    }
  }
  function bgStick(o, sc) {
    const W = sc.W, gy = sc.ground;
    const bars = Lv.bars;
    o.fillStyle = "#1f6fb0";
    for (let k = 0; k < 8; k++) {
      const h = Math.round(bars[k * 2] * (gy - 6));
      if (h > 0) o.fillRect(W - 17 + k * 2, gy - h, 1, h);
    }
    o.fillStyle = "#3a9fe0";
    for (let x = 0; x < W; x += 2) o.fillRect(x, gy + 1, 1, 1);
  }
  function lcdize(o, W, H) {
    const img = o.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 20) continue;
      const l = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255;
      let c;
      if (l > 0.72) c = [150, 226, 255]; else if (l > 0.48) c = [76, 176, 245]; else if (l > 0.24) c = [34, 104, 186]; else c = [10, 34, 66];
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    o.putImageData(img, 0, 0);
  }

  /* Kleine Pixel-Schrift für "RUMMS!" */
  const GLYPH = {
    R: ["110", "101", "110", "101", "101"], U: ["101", "101", "101", "101", "111"],
    M: ["10001", "11011", "10101", "10001", "10001"], S: ["111", "100", "111", "001", "111"], "!": ["1", "1", "1", "0", "1"]
  };
  function pixText(o, str, x, y, col, shadow) {
    let cx = x;
    for (const ch of str) {
      const gl = GLYPH[ch]; if (!gl) { cx += 2; continue; }
      for (let j = 0; j < 5; j++) for (let i = 0; i < gl[j].length; i++) if (gl[j][i] === "1") {
        if (shadow) { o.fillStyle = shadow; o.fillRect(cx + i + 1, y + j + 1, 1, 1); }
        o.fillStyle = col; o.fillRect(cx + i, y + j, 1, 1);
      }
      cx += gl[0].length + 1;
    }
  }
  const textWidth = (str) => Array.from(str).reduce((w, ch) => w + (GLYPH[ch] ? GLYPH[ch][0].length + 1 : 2), -1);

  /* ═════════ Julian ═════════ */
  const J = {
    mood: "idle", moodT0: 0, moodUntil: 0, hidden: true,
    xr: 0.5, tx: 0.5, dir: 1, moving: false, walkT: 0, nextWander: now() + 6000, nextTrick: now() + 12000,
    jy: 0, vy: 0, blinkAt: now() + 2000, blinkUntil: 0, look: 0, lookAt: now() + 3000,
    tail: 0, talkUntil: 0, anger: 0, red: 0, mineS: null, sleepSaid: false, ripple: 0,
    setMood(m, dur) {
      this.mood = m; this.moodT0 = now(); this.moodUntil = dur ? now() + dur : 0;
      if (m === "mine") { this.mineS = { hits: 0, lastPh: -1, broken: false }; this.dir = 1; this.xr = Math.min(this.xr, 0.35); this.tx = this.xr; }
    },
    jump(v) { if (this.hidden) return; this.vy = v || -48; if (this.jy === 0) this.jy = -0.01; },
    spin(ms) { if (this.hidden || this.mood === "rage" || Door.active) return; this.setMood("spin", ms || 1100); this.jump(-40); },
    mine() { if (this.hidden || Door.active) return; this.setMood("mine", 3600); },
    note() {
      const sc = active();
      if (!sc) return;
      const x = sc.xOf(this.xr);
      Parts.add({ x: x + (Math.random() < 0.5 ? -2 : 10), y: sc.ground - 17, vx: (Math.random() - 0.5) * 6, vy: -9, life: 1.6, map: SP.maps.NOTE, pal: { N: ["#ffffff", "#ffe066", "#9be7ff"][Lv.beatCount % 3] }, wob: 1 });
    }
  };

  function baseMood(t) {
    if (S.playing) return "dance";
    const idle = t - S.lastInput;
    if (idle > 60000 && document.visibilityState === "visible") return "sleep";
    if (idle > 15000) return "game";
    return "idle";
  }

  function updateJ(t, dt) {
    if (Intro.active && Intro.phase !== "after") Intro.update(t, dt);
    if (Door.active) Door.update(t, dt);
    if (J.moodUntil && t > J.moodUntil) { J.moodUntil = 0; J.mood = baseMood(t); }
    else if (!J.moodUntil && !Door.active) {
      const b = baseMood(t);
      if (b !== J.mood) {
        if (b === "sleep") { J.sleepSaid = false; unlock("sleep"); }
        J.mood = b;
      }
    }
    if (J.mood === "sleep" && !J.sleepSaid && t - S.lastInput > 63000) { J.sleepSaid = true; Talk.say("sleep", { pr: 1 }); }
    if (J.mood === "sleep" && Math.random() < dt * 0.8) {
      const sc = active(); if (sc) Parts.add({ x: sc.xOf(J.xr) + 9, y: sc.ground - 16, vx: 4, vy: -5, life: 2.2, map: SP.maps.ZED, pal: { Z: "#ffffff" }, wob: 1 });
    }
    // Wut kühlt ab
    J.anger = Math.max(0, J.anger - dt * 1.05);
    const targetRed = J.mood === "rage" || (Door.active && Door.phase !== "out" && Door.phase !== "closed") ? 1 : clamp((J.anger - 1.2) / 3.6, 0, 1);
    J.red += (targetRed - J.red) * Math.min(1, dt * (targetRed > J.red ? 7 : 1.6));
    if (J.red > 0.55 && Math.random() < dt * 10) steam();

    // Blinzeln und Gucken
    if (t > J.blinkAt) { J.blinkUntil = t + 130; J.blinkAt = t + 2200 + Math.random() * 3600; }
    if (t > J.lookAt) { J.look = J.mood === "idle" ? [-1, 0, 0, 1][Math.floor(Math.random() * 4)] : 0; J.lookAt = t + 1500 + Math.random() * 3000; }

    // Herumlaufen und kleine Tricks
    if (J.mood === "idle" && !J.hidden && !Door.active) {
      if (t > J.nextWander) { J.tx = 0.1 + Math.random() * 0.8; J.nextWander = t + 4500 + Math.random() * 6000; }
      if (t > J.nextTrick && !Talk.busy()) {
        const r = Math.random();
        if (r < 0.45) J.setMood("pokeball", 2700);
        else if (r < 0.7) { J.setMood("hop", 900); J.jump(-46); }
        else J.setMood("wave", 1400);
        J.nextTrick = t + 9000 + Math.random() * 9000;
      }
    }
    if (!Door.active && !(Intro.active && Intro.phase !== "after")) {
      const speed = J.mood === "idle" ? 0.16 : 0;
      const d = J.tx - J.xr;
      if (speed && Math.abs(d) > 0.01) {
        J.xr += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
        J.dir = Math.sign(d); J.moving = true; J.walkT += dt;
      } else J.moving = false;
    }

    // Springen
    if (J.jy !== 0 || J.vy !== 0) {
      J.vy += 280 * dt; J.jy += J.vy * dt;
      if (J.jy >= 0) { if (J.vy > 70) dust(); J.jy = 0; J.vy = 0; }
    }
    J.tail += dt * (J.mood === "dance" ? 10 : J.moving ? 8 : J.mood === "spin" ? 20 : 3);
  }

  function poseJ(t) {
    const p = { outfit: S.outfit, eyes: "open", mouth: "smile", armL: "down", armR: "down", legL: 0, legR: 0, headDy: 0, bodyDy: 0, dir: J.dir, look: J.look, tail: J.tail, blush: false, prop: null, dx: 0 };
    const mt = t - J.moodT0;
    switch (J.mood) {
      case "dance": {
        const up = Lv.beatCount % 2;
        p.armL = up ? "up" : "down"; p.armR = up ? "down" : "up";
        p.legL = Lv.beat > 0.55 && up ? 1 : 0; p.legR = Lv.beat > 0.55 && !up ? 1 : 0;
        p.bodyDy = p.headDy = Lv.beat > 0.6 ? -1 : 0;
        if (Lv.beatCount % 4 >= 2) { p.eyes = "happy"; p.mouth = "grin"; }
        p.look = 0;
        break;
      }
      case "game":
        p.armL = p.armR = "front"; p.prop = "controller"; p.light = (t % 900) < 450 ? 1 : 0; p.look = 0;
        if ((t % 5200) < 500) { p.armL = p.armR = "up"; p.prop = null; p.mouth = "grin"; p.eyes = "happy"; }
        break;
      case "sleep": p.eyes = "closed"; p.headDy = (t % 3200) < 1600 ? 1 : 0; p.mouth = "flat"; p.look = 0; break;
      case "wave": p.armR = "wave"; p.eyes = "happy"; p.mouth = "grin"; break;
      case "hop": p.armL = p.armR = "up"; p.mouth = "grin"; break;
      case "love": p.prop = "heart"; p.armL = p.armR = "front"; p.eyes = "happy"; p.blush = true; p.mouth = "grin"; break;
      case "spin": p.armL = p.armR = "up"; p.eyes = "closed"; p.dir = Math.floor(t / 70) % 2 ? 1 : -1; p.mouth = "o"; break;
      case "dizzy": p.eyes = "dizzy"; p.mouth = "o"; p.dx = Math.round(Math.sin(t * 0.008)); break;
      case "shock": p.eyes = "wide"; p.mouth = "o"; p.armL = p.armR = "up"; break;
      case "boot": p.eyes = "wide"; p.mouth = "o"; p.armL = p.armR = "up"; break;
      case "annoyed": p.eyes = "angry"; p.mouth = "flat"; p.dx = Math.floor(t / 90) % 2 ? 1 : 0; break;
      case "rage": p.eyes = "angry"; p.mouth = "shout"; p.armL = p.armR = Math.floor(t / 110) % 2 ? "up" : "down"; p.dx = Math.floor(t / 45) % 2 ? 1 : -1; break;
      case "pokeball": {
        const h = Math.sin(((mt % 900) / 900) * Math.PI);
        p.prop = "pokeball"; p.ballY = 7 - Math.round(h * 13); p.armR = h > 0.45 ? "up" : "front"; p.look = 1; p.mouth = "grin"; p.dir = 1;
        break;
      }
      case "mine": {
        const m = J.mineS;
        const ph = Math.floor(mt / 200);
        if (!m.broken) {
          const down = ph % 2 === 1;
          p.prop = down ? "pickaxe-down" : "pickaxe-up";
          p.armR = down ? "front" : "up"; p.mouth = "flat"; p.dir = 1; p.look = 1;
          if (down && m.lastPh !== ph) {
            m.hits++;
            const sc = active();
            if (sc) {
              const bx = sc.xOf(J.xr) + 12, by = sc.ground - 6;
              for (let i = 0; i < 5; i++) Parts.add({ x: bx + Math.random() * 6, y: by + Math.random() * 3, vx: (Math.random() - 0.3) * 30, vy: -20 - Math.random() * 25, g: 120, life: 0.7, color: Math.random() < 0.5 ? "#8a5a35" : "#5fbf3f" });
              if (m.hits >= 3) {
                m.broken = true;
                for (let i = 0; i < 10; i++) Parts.add({ x: bx + Math.random() * 6, y: by + Math.random() * 6, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 30, g: 140, life: 0.9, color: ["#8a5a35", "#6d4528", "#5fbf3f"][i % 3] });
                Parts.add({ x: bx, y: by, vx: 0, vy: -46, g: 70, life: 2.2, map: SP.maps.DIAMOND, pal: SP.BASE, sparkle: true, floor: by - 4 });
                unlock("diamond");
              }
            }
          }
          m.lastPh = ph;
        } else { p.armL = p.armR = "up"; p.eyes = "happy"; p.mouth = "grin"; }
        break;
      }
      default: break;
    }
    if (Door.active) Door.pose(p, t);
    if (J.moving || (Door.active && Door.running)) { const f = Math.floor(J.walkT * (Door.running ? 14 : 7)) % 2; p.legL = f; p.legR = 1 - f; }
    if (p.eyes === "open" && t < J.blinkUntil) p.eyes = "closed";
    if (J.red > 0.45 && (p.eyes === "open" || p.eyes === "happy")) { p.eyes = "angry"; if (p.mouth === "smile" || p.mouth === "grin") p.mouth = "flat"; }
    if (t < J.talkUntil && p.mouth !== "shout") p.mouth = Math.floor(t / 110) % 2 ? "open" : (p.mouth === "flat" ? "flat" : "smile");
    return p;
  }

  function drawWorld(o, sc, t) {
    const gy = sc.ground;
    // Tür
    if (Door.active) Door.draw(o, sc, t);
    // Intro-Paket & großer Bruder
    if (Intro.active) Intro.draw(o, sc, t);
    // Julian
    if (!J.hidden) {
      const p = poseJ(t);
      const x = sc.xOf(J.xr) + p.dx;
      const lift = J.mood === "spin" ? -3 : 0;
      const y = gy - 15 + Math.round(J.jy) + lift;
      const pal = SP.palette(S.outfit, J.red);
      if (sc.cfg.shadow) { o.fillStyle = "rgba(0,0,0,0.35)"; o.fillRect(x, gy + 1, 10, 1); }
      if (J.mood === "spin") tornado(o, x + 5, gy, t, false, pal);
      if (J.mood === "mine" && J.mineS && !J.mineS.broken) {
        const bx = x + 12, by = gy - 5;
        SP.blit(o, SP.maps.GRASS_BLOCK, bx, by, SP.BLOCK_PAL);
        o.fillStyle = "#2a1a0e";
        if (J.mineS.hits >= 1) { o.fillRect(bx + 2, by + 1, 1, 2); o.fillRect(bx + 3, by + 3, 1, 1); }
        if (J.mineS.hits >= 2) { o.fillRect(bx + 4, by + 2, 1, 3); o.fillRect(bx + 1, by + 4, 2, 1); }
      }
      SP.drawJulian(o, x, y, p, pal);
      if (J.mood === "spin") tornado(o, x + 5, gy, t, true, pal);
      if (J.mood === "dizzy") {
        for (let i = 0; i < 3; i++) {
          const a = t * 0.008 + i * 2.1;
          o.fillStyle = "#ffe066"; o.fillRect(Math.round(x + 5 + Math.cos(a) * 6), Math.round(y - 2 + Math.sin(a) * 1.5), 1, 1);
        }
      }
    }
    Parts.draw(o, t);
    if (Door.active && Door.phase === "slam" && t - Door.t0 < 1100) {
      const w = textWidth("RUMMS!");
      const dx = Math.round(clamp(sc.xOf(Door.xr) + 5 - w / 2, 1, sc.W - w - 1));
      pixText(o, "RUMMS!", dx + (Math.floor(t / 60) % 2), Math.max(1, gy - 26), "#ffd23f", "#7a2a00");
    }
  }

  function tornado(o, cx, gy, t, front, pal) {
    const cols = [pal.L, pal.H, pal.D, "#ffffff"];
    for (let i = 0; i < 52; i++) {
      const h = i / 52, a = t * 0.017 + i * 0.6, r = 2.5 + h * 9;
      if ((Math.sin(a) > 0) !== front) continue;
      o.fillStyle = cols[i % 4];
      o.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(gy + 1 - h * 22), 1, 1);
    }
  }

  function steam() {
    const sc = active(); if (!sc || J.hidden) return;
    const x = sc.xOf(J.xr), y = sc.ground - 15 + Math.round(J.jy);
    const left = Math.random() < 0.5;
    Parts.add({ x: x + (left ? 0 : 8), y: y - 1, vx: left ? -8 : 8, vy: -14, life: 0.65, color: "#ffffff", size: 2, fade: true });
  }
  function dust() {
    const sc = active(); if (!sc) return;
    const x = sc.xOf(J.xr);
    for (let i = 0; i < 6; i++) Parts.add({ x: x + 5 + (i - 2.5) * 2, y: sc.ground, vx: (i - 2.5) * 6, vy: -6 - Math.random() * 6, life: 0.45, color: "#d8d2c4", fade: true });
  }

  /* Partikel */
  const Parts = {
    list: [],
    add(p) { p.max = p.life; this.list.push(p); if (this.list.length > 160) this.list.shift(); },
    clear() { this.list.length = 0; },
    update(dt) {
      for (const p of this.list) {
        p.life -= dt;
        if (p.g) p.vy += p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.floor != null && p.y > p.floor && p.vy > 0) { p.y = p.floor; p.vy *= -0.4; }
        if (p.wob) p.x += Math.sin((p.max - p.life) * 6) * 0.15;
      }
      this.list = this.list.filter((p) => p.life > 0);
    },
    draw(o, t) {
      for (const p of this.list) {
        o.globalAlpha = p.fade ? clamp(p.life / p.max, 0, 1) : clamp(p.life * 3, 0, 1);
        const x = Math.round(p.x), y = Math.round(p.y);
        if (p.map) SP.blit(o, p.map, x, y, p.pal || SP.BASE);
        else { o.fillStyle = p.color; o.fillRect(x, y, p.size || 1, p.size || 1); }
        if (p.sparkle && Math.floor(t / 150) % 2) { o.fillStyle = "#ffffff"; o.fillRect(x - 1, y - 1, 1, 1); o.fillRect(x + 5, y + 1, 1, 1); }
      }
      o.globalAlpha = 1;
    }
  };

  /* ═════════ Tür-zu-Szene ═════════ */
  const Door = {
    active: false, phase: "", t0: 0, xr: 0.9, knocks: 0, running: false,
    start() {
      this.active = true; this.phase = "appear"; this.t0 = now(); this.knocks = 0;
      this.xr = J.xr < 0.5 ? 0.98 : 0.02;
      J.moodUntil = 0; J.mood = "door";
      const sc = active();
      if (sc) for (let i = 0; i < 8; i++) Parts.add({ x: sc.xOf(this.xr) + 5, y: sc.ground - 9, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 30, life: 0.5, color: "#ffffff", fade: true });
    },
    update(t, dt) {
      const el = t - this.t0;
      if (this.phase === "appear" && el > 380) { this.phase = "run"; this.t0 = t; }
      else if (this.phase === "run") {
        this.running = true;
        const d = this.xr - J.xr;
        J.dir = Math.sign(d) || 1;
        J.xr += Math.sign(d) * Math.min(Math.abs(d), 0.75 * dt);
        J.walkT += dt;
        if (Math.abs(this.xr - J.xr) < 0.02) {
          this.running = false; J.hidden = true;
          this.phase = "slam"; this.t0 = t;
          slamDevice();
          unlock("door");
        }
      } else if (this.phase === "slam" && el > 1100) { this.phase = "closed"; this.t0 = t; }
      else if (this.phase === "closed" && (el > 7500 || this.knocks >= 3)) {
        this.phase = "out"; this.t0 = t; J.hidden = false; J.red = 0.2; J.anger = 0;
        J.tx = J.xr = this.xr;
        Talk.say("doorOut", { pr: 4 });
      } else if (this.phase === "out") {
        const target = this.xr > 0.5 ? this.xr - 0.28 : this.xr + 0.28;
        if (el > 500) {
          const d = target - J.xr;
          if (Math.abs(d) > 0.01) { J.xr += Math.sign(d) * Math.min(Math.abs(d), 0.22 * dt); J.dir = Math.sign(d); J.walkT += dt; J.moving = true; }
          else J.moving = false;
        }
        if (el > 2600) {
          this.active = false; J.moving = false; J.tx = J.xr;
          const sc = active();
          if (sc) for (let i = 0; i < 8; i++) Parts.add({ x: sc.xOf(this.xr) + 5, y: sc.ground - 9, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 30, life: 0.5, color: "#ffffff", fade: true });
          J.setMood("love", 2200);
        }
      }
    },
    pose(p, t) {
      if (this.phase === "appear") { p.eyes = "angry"; p.mouth = "shout"; p.dx = Math.floor(t / 45) % 2 ? 1 : -1; }
      else if (this.phase === "run") { p.eyes = "angry"; p.mouth = "flat"; p.armL = p.armR = "down"; }
      else if (this.phase === "out") { p.eyes = "open"; p.look = 0; p.mouth = "flat"; p.blush = true; }
    },
    knock() {
      this.knocks++;
      this.shakeUntil = now() + 300;
      Talk.say("doorKnock", { pr: 3 });
      vibrate(20);
    },
    draw(o, sc, t) {
      const x = sc.xOf(this.xr) + 1, y = sc.ground - 17;
      const open = this.phase === "appear" || this.phase === "run" || (this.phase === "out" && t - this.t0 < 1900);
      let sx = 0;
      if (this.phase === "slam" && t - this.t0 < 350) sx = Math.floor(t / 40) % 2 ? 1 : -1;
      if (this.shakeUntil && t < this.shakeUntil) sx = Math.floor(t / 40) % 2 ? 1 : -1;
      if (open) {
        o.fillStyle = "#5e3a1a"; o.fillRect(x, y, 10, 18);
        o.fillStyle = "#1a120b"; o.fillRect(x + 1, y + 1, 8, 17);
        o.fillStyle = "#a8743e"; o.fillRect(x - 3, y + 1, 3, 17);
        o.fillStyle = "#8f6232"; o.fillRect(x - 3, y + 1, 1, 17);
      } else SP.blit(o, SP.maps.DOOR, x + sx, y, SP.BASE);
    }
  };

  function slamDevice() {
    const dev = $(".slot.is-active .device");
    if (dev && !reduced) { dev.classList.remove("is-shaking"); void dev.offsetWidth; dev.classList.add("is-shaking"); }
    vibrate([30, 40, 70]);
  }

  /* ═════════ Der mäßige Überlieferer (nur einmal) ═════════ */
  const Brother = { xr: -0.4, talkUntil: 0, walkT: 0 };
  const Intro = {
    active: false, phase: "", t0: 0, box: null,
    start() {
      this.active = true; this.phase = "walkin"; this.t0 = now();
      Brother.xr = -0.45; this.box = { xr: 0.62, placed: false, open: false };
      J.hidden = true;
    },
    update(t, dt) {
      const el = t - this.t0;
      if (this.phase === "walkin") {
        Brother.xr += 0.3 * dt; Brother.walkT += dt;
        if (Brother.xr >= 0.2) { Brother.xr = 0.2; this.phase = "drop"; this.t0 = t; this.box.placed = true; this.box.xr = 0.48; }
      } else if (this.phase === "drop" && el > 450) {
        this.phase = "talk"; this.t0 = t;
        const lines = ((CFG.ueberlieferer && CFG.ueberlieferer.saetze) || []).map((s) => ({ text: s, who: "brother" }));
        Talk.chain(lines, () => { this.phase = "shake"; this.t0 = now(); });
      } else if (this.phase === "shake" && el > 1100) {
        this.phase = "pop"; this.t0 = t; this.box.open = true;
        LS.set("introDone", true);
        J.hidden = false; J.xr = J.tx = this.box.xr; J.jy = -1; J.vy = -120; J.setMood("spin", 1000);
        const sc = active();
        if (sc) Parts.add({ x: sc.xOf(this.box.xr), y: sc.ground - 9, vx: -16, vy: -70, g: 160, life: 1.2, map: SP.maps.BOX.slice(0, 4), pal: SP.BASE });
        confettiFromDevice(160);
        vibrate(30);
        Talk.chain((LINES.first || []).map((s) => ({ text: s, who: "julian" })), () => { this.phase = "bye"; this.t0 = now(); });
      } else if (this.phase === "bye" && el > 1300) {
        this.phase = "leave"; this.t0 = t;
      } else if (this.phase === "leave") {
        Brother.xr -= 0.32 * dt; Brother.walkT += dt;
        if (Brother.xr < -0.6) {
          this.phase = "after"; this.active = false;
          const sc = active();
          if (sc) for (let i = 0; i < 8; i++) Parts.add({ x: sc.xOf(this.box.xr) + 4, y: sc.ground - 4, vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 30, life: 0.5, color: "#ffffff", fade: true });
        }
      }
    },
    draw(o, sc, t) {
      const gy = sc.ground;
      const b = this.box;
      if (b.placed) {
        let jx = 0;
        if (this.phase === "shake") jx = Math.floor(t / (90 - Math.min(60, (t - this.t0) / 20))) % 2 ? 1 : -1;
        else if (this.phase === "talk" && (t % 2400) < 220) jx = Math.floor(t / 60) % 2 ? 1 : -1;
        const bx = sc.xOf(b.xr) + 1 + jx;
        SP.blit(o, b.open ? SP.maps.BOX.slice(4) : SP.maps.BOX, bx, gy - (b.open ? 3 : 7), SP.BASE);
      }
      if (this.phase === "after") return;
      const pal = SP.BASE;
      const walking = this.phase === "walkin" || this.phase === "leave";
      const p = {
        carry: this.phase === "walkin",
        wave: this.phase === "bye" || this.phase === "pop",
        walk: walking ? (Math.floor(Brother.walkT * 6) % 2) + 1 : 0,
        blink: (t % 3400) < 140,
        talk: t < Brother.talkUntil && Math.floor(t / 110) % 2,
        headDy: walking ? Math.floor(Brother.walkT * 6) % 2 : 0
      };
      SP.drawBrother(o, sc.xOf(Brother.xr), gy - 20, p, pal);
    }
  };

  /* ═════════ Antippen ═════════ */
  let pressTimer = 0, pressed = false;
  function bindScene(canvas) {
    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      pressed = false;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => { pressed = true; hug(); }, 600);
    });
    const up = () => { clearTimeout(pressTimer); };
    canvas.addEventListener("pointerup", (e) => { up(); if (!pressed) tapJulian(e); });
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerleave", up);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  function tapJulian() {
    bumpInput();
    if (Intro.active && Intro.phase !== "after") { Talk.skip(); return; }
    if (Door.active) { if (Door.phase === "closed") Door.knock(); return; }
    if (J.hidden || J.mood === "rage") return;
    if (J.mood === "sleep") { Talk.say("wake", { pr: 2 }); J.setMood("shock", 800); J.jump(-50); return; }
    J.anger += 1;
    if (J.anger >= 5) { rage(); return; }
    if (J.anger >= 2.6) { Talk.say("annoyed", { pr: 2 }); J.setMood("annoyed", 900); J.jump(-26); return; }
    J.jump(-44);
    Talk.say("tap", { pr: 1 });
    J.setMood("wave", 1400);
  }
  function rage() {
    J.setMood("rage", 1800);
    J.anger = 0;
    Talk.say("rage", { pr: 5, style: "shout", hold: 2400 });
    vibrate([60, 40, 60]);
    setTimeout(() => { if (J.mood === "rage" || J.mood === "door") Door.start(); }, 1650);
  }
  function hug() {
    bumpInput();
    if (J.hidden || Door.active || J.mood === "rage" || (Intro.active && Intro.phase !== "after")) return;
    J.setMood("love", 2600);
    Talk.say("hug", { pr: 2 });
    unlock("hug");
    vibrate(15);
    floatHearts();
  }

  /* ═════════ DOM-Elemente & Player ═════════ */
  const deck = $("#deck");
  const slots = {};
  $$(".slot", deck).forEach((s) => { slots[s.dataset.player] = s; });
  const scenes = {};
  $$("canvas.scene").forEach((c) => { scenes[c.dataset.scene] = new Scene(c, c.dataset.scene); bindScene(c); });
  const active = () => scenes[S.player];
  const fits = {};

  function layout() {
    const deckW = deck.clientWidth || window.innerWidth;
    const maxH = clamp(window.innerHeight - 240, 300, 640);
    const cap = window.innerWidth > 900 ? 1.3 : 1.12;
    ORDER.forEach((name) => {
      const [w, h] = DEV_SIZE[name];
      const f = clamp(Math.min(deckW / (w + 20), maxH / h, cap), 0.55, 2);
      fits[name] = f;
      const fit = $(".fit", slots[name]);
      fit.style.width = w + "px"; fit.style.height = h + "px";
      fit.style.transform = "scale(" + f.toFixed(4) + ")";
    });
    deck.style.height = Math.round(DEV_SIZE[S.player][1] * fits[S.player]) + "px";
    ORDER.forEach((name) => scenes[name] && scenes[name].resize(fits[name]));
    movePill();
    refreshMarquees();
  }

  function setActiveSlot(name) {
    ORDER.forEach((n) => slots[n].classList.toggle("is-active", n === name));
    $$(".switcher [data-switch]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.switch === name)));
    document.documentElement.style.setProperty("--dev-glow", DEV_GLOW[name]);
    movePill();
  }
  function movePill() {
    const btn = $('.switcher [aria-selected="true"]'), pill = $(".switch-pill");
    if (!btn || !pill) return;
    pill.style.width = btn.offsetWidth + "px";
    pill.style.transform = "translateX(" + (btn.offsetLeft - 3) + "px)";
  }

  let switching = false;
  function switchTo(name, dirHint) {
    if (name === S.player || switching || !slots[name]) return;
    bumpInput();
    const from = slots[S.player], to = slots[name];
    const dir = dirHint || (ORDER.indexOf(name) > ORDER.indexOf(S.player) ? 1 : -1);
    closeMenu();
    S.player = name; LS.set("player", name);
    setActiveSlot(name);
    deck.style.height = Math.round(DEV_SIZE[name][1] * fits[name]) + "px";
    Parts.clear();
    if (!reduced && from.animate) {
      switching = true;
      from.classList.add("is-leaving");
      from.animate([{ transform: "none", opacity: 1 }, { transform: "translateX(" + (-dir * 46) + "%) rotateY(" + (dir * 62) + "deg) scale(.78)", opacity: 0 }], { duration: 460, easing: "cubic-bezier(.6,0,.4,1)" })
        .onfinish = () => from.classList.remove("is-leaving");
      const a = to.animate([{ transform: "translateX(" + (dir * 46) + "%) rotateY(" + (-dir * 62) + "deg) scale(.78)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 780, easing: "cubic-bezier(.16,1.15,.3,1)" });
      a.onfinish = () => { switching = false; };
      setTimeout(() => { switching = false; }, 900);
    }
    const scr = $(".screen", to);
    if (scr && !reduced) { scr.classList.remove("power"); void scr.offsetWidth; scr.classList.add("power"); }
    if (!J.hidden && !Door.active && !(Intro.active && Intro.phase !== "after")) { J.jy = -26; J.vy = 0; }
    refreshMarquees();
    if (!S.seen[name]) {
      S.seen[name] = true; LS.set("seen", S.seen);
      Talk.say("p_" + name, { pr: 2 });
      if (ORDER.every((n) => S.seen[n])) unlock("players");
    } else if (Math.random() < 0.35) Talk.say("p_" + name, { pr: 1 });
  }

  /* Bindungen: Titel, Zeiten, Fortschritt */
  const binds = {};
  ["title", "artist", "time", "remain", "bar", "trackno", "state"].forEach((k) => { binds[k] = $$('[data-bind="' + k + '"]'); });
  const lastBind = {};
  function setBind(k, v) {
    if (lastBind[k] === v) return;
    lastBind[k] = v;
    binds[k].forEach((el) => {
      if (el.parentElement && el.parentElement.classList.contains("marquee")) setMarquee(el.parentElement, v);
      else el.textContent = v;
    });
  }
  function setMarquee(box, text) {
    const span = box.firstElementChild;
    box.dataset.text = text;
    box.classList.remove("run");
    span.textContent = text;
    requestAnimationFrame(() => {
      if (span.scrollWidth > box.clientWidth + 2 && !reduced) {
        const gap = "     ★     ";
        span.textContent = text + gap + text + gap;
        box.style.setProperty("--dur", (4 + text.length * 0.32).toFixed(1) + "s");
        box.classList.add("run");
      }
    });
  }
  function refreshMarquees() { $$(".marquee").forEach((m) => { if (m.dataset.text != null) setMarquee(m, m.dataset.text); }); }

  function renderTrack() {
    const t = cur();
    setBind("title", t ? t.title : "Noch keine Lieder");
    setBind("artist", t ? (t.artist || NAME) : "Lad welche hoch");
    setBind("trackno", t ? String(S.idx + 1).padStart(2, "0") : "--");
    updateMediaSession();
    renderNowArt();
    markCurrentRow();
    if (menuOpen) renderMenu();
  }
  function renderStateBits() {
    const use = $(".lcd-state use");
    if (use) use.setAttribute("href", S.playing ? "#i-play" : "#i-pause");
    $$(".key-play").forEach((k) => k.classList.toggle("is-down", S.playing));
    const pb = $(".now .play-btn");
    if (pb) pb.setAttribute("aria-label", S.playing ? "Pause" : "Abspielen");
    setBind("state", S.hold ? "HOLD" : S.playing ? "PLAY" : audio.currentTime > 0.3 ? "PAUSE" : "STOP");
    $(".dc-esp").classList.toggle("on", S.playing);
    markCurrentRow();
  }

  /* Klickrad */
  const hudEl = $(".hud"), hudLabel = $(".hud-label"), hudTrack = $(".hud-track");
  let hudTimer = 0;
  function showHud(label, v) {
    if (!hudEl) return;
    hudLabel.textContent = label;
    hudTrack.style.setProperty("--v", clamp(v, 0, 1).toFixed(3));
    hudEl.classList.add("show");
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => hudEl.classList.remove("show"), 1200);
  }
  let volHintShown = false;
  function wheelStep(s) {
    tick(); vibrate(4);
    if (menuOpen) { menuSel = clamp(menuSel + s, 0, Math.max(0, S.tracks.length - 1)); renderMenu(); return; }
    if (volumeWorks) setVolume(S.vol + s * 0.04);
    else { seekBy(s * 4); if (!volHintShown) { volHintShown = true; Talk.say("volHint", { pr: 1 }); } }
  }
  function setupWheel() {
    const wheel = $("[data-wheel]"), trail = $(".wheel-trail", wheel);
    let st = null;
    const zone = (deg) => deg > -135 && deg < -45 ? "menu" : deg >= -45 && deg <= 45 ? "next" : deg > 45 && deg < 135 ? "play" : "prev";
    wheel.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".wheel-center")) return;
      const r = wheel.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const a = Math.atan2(e.clientY - cy, e.clientX - cx);
      st = { id: e.pointerId, cx, cy, last: a, start: a, acc: 0, moved: 0, total: 0, rot: false, dizzy: false };
      try { wheel.setPointerCapture(e.pointerId); } catch (err) { }
      e.preventDefault();
      trail.style.setProperty("--a", (a * 180 / Math.PI + 90 - 36).toFixed(1) + "deg");
      trail.classList.add("show");
      ripple(wheel, e.clientX - r.left, e.clientY - r.top, r.width / wheel.offsetWidth);
    });
    wheel.addEventListener("pointermove", (e) => {
      if (!st || e.pointerId !== st.id) return;
      const a = Math.atan2(e.clientY - st.cy, e.clientX - st.cx);
      let d = a - st.last;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      st.last = a; st.moved += Math.abs(d); st.total += d; st.acc += d;
      if (st.moved > 0.22) st.rot = true;
      trail.style.setProperty("--a", (a * 180 / Math.PI + 90 - 36).toFixed(1) + "deg");
      const step = Math.PI / 12;
      while (Math.abs(st.acc) >= step) { const s = Math.sign(st.acc); st.acc -= s * step; wheelStep(s); }
      if (!st.dizzy && Math.abs(st.total) >= Math.PI * 2) {
        st.dizzy = true; unlock("dizzy");
        if (!J.hidden && !Door.active) { J.setMood("dizzy", 2600); Talk.say("dizzy", { pr: 2 }); }
      }
    });
    const end = (e) => {
      if (!st || e.pointerId !== st.id) return;
      if (!st.rot && e.type === "pointerup") {
        const z = zone(st.start * 180 / Math.PI);
        const btn = $(".wk-" + z, wheel);
        if (btn) { btn.classList.add("flash"); setTimeout(() => btn.classList.remove("flash"), 160); }
        tick(); vibrate(8);
        act(z, wheel);
      }
      trail.classList.remove("show");
      st = null;
    };
    wheel.addEventListener("pointerup", end);
    wheel.addEventListener("pointercancel", end);
  }
  function ripple(host, x, y, scale) {
    if (reduced) return;
    const r = document.createElement("i");
    r.className = "ripple";
    r.style.left = (x / (scale || 1)) + "px"; r.style.top = (y / (scale || 1)) + "px";
    host.appendChild(r);
    setTimeout(() => r.remove(), 520);
  }

  /* Menü auf dem Klickrad-Display */
  let menuOpen = false, menuSel = 0;
  const menuEl = $(".lcd-menu"), menuList = $(".menu-list"), menuCount = $(".lcd-count");
  function toggleMenu() { if (menuOpen) closeMenu(); else openMenu(); }
  function openMenu() {
    menuOpen = true; menuEl.hidden = false; menuSel = Math.max(0, S.idx); renderMenu();
    if (!LS.get("menuSeen", false)) { LS.set("menuSeen", true); Talk.say("menu", { pr: 1 }); }
  }
  function closeMenu() { menuOpen = false; if (menuEl) menuEl.hidden = true; }
  function renderMenu() {
    menuList.innerHTML = "";
    menuCount.textContent = S.tracks.length ? (menuSel + 1) + "/" + S.tracks.length : "";
    if (!S.tracks.length) {
      const li = document.createElement("li"); li.className = "empty"; li.textContent = "Noch keine Lieder. Lade unten welche hoch.";
      menuList.appendChild(li); return;
    }
    S.tracks.forEach((t, i) => {
      const li = document.createElement("li");
      li.textContent = (i === S.idx && S.playing ? "♪ " : "") + t.title;
      li.dataset.i = i;
      if (i === menuSel) li.className = "sel";
      menuList.appendChild(li);
    });
    const rowH = 20, h = menuList.clientHeight || 120;
    menuList.scrollTop = clamp(menuSel * rowH - h / 2 + rowH / 2, 0, S.tracks.length * rowH);
  }
  menuList.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-i]");
    if (!li) return;
    menuSel = +li.dataset.i; tick(); menuSelectNow();
  });
  function menuSelectNow() { closeMenu(); setTrack(menuSel, true); }

  /* Zentrale Aktionen */
  function act(a, el) {
    bumpInput();
    const dev = el && el.closest && el.closest(".device");
    if (dev && dev.classList.contains("dev-stick") && S.hold && a !== "hold" && a !== "cap") {
      const lock = $(".oled-lock"); lock.classList.add("flash"); setTimeout(() => lock.classList.remove("flash"), 900);
      Talk.say("holdBlocked", { pr: 1 });
      return;
    }
    switch (a) {
      case "play": toggle(); break;
      case "next": next(); break;
      case "prev": prev(); break;
      case "stop": stop(); break;
      case "menu": toggleMenu(); break;
      case "select": if (menuOpen) menuSelectNow(); else tapJulian(); break;
      case "vol+": volStep(1); break;
      case "vol-": volStep(-1); break;
      case "hold": {
        S.hold = !S.hold;
        const d = $(".dev-stick"); d.classList.toggle("is-hold", S.hold);
        $(".st-hold").setAttribute("aria-checked", String(S.hold));
        Talk.say(S.hold ? "hold" : "unhold", { pr: 2 });
        if (S.hold) unlock("hold");
        renderStateBits();
        break;
      }
      case "cap": {
        S.capOff = !S.capOff;
        $(".dev-stick").classList.toggle("is-capoff", S.capOff);
        $(".st-cap").setAttribute("aria-label", S.capOff ? "Kappe aufsetzen" : "Kappe abnehmen");
        Talk.say(S.capOff ? "cap" : "capBack", { pr: 2 });
        if (S.capOff) unlock("cap");
        break;
      }
      default: break;
    }
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    if (b.classList.contains("wk") && e.detail !== 0) return; // Klickrad regelt Zeiger selbst
    act(b.dataset.act, b);
  });

  /* Kassetten-Lautstärkerad */
  function setupVolWheel() {
    const el = $("[data-volwheel]");
    let st = null;
    el.addEventListener("pointerdown", (e) => { st = { y: e.clientY, v: S.vol, id: e.pointerId }; try { el.setPointerCapture(e.pointerId); } catch (err) { } e.preventDefault(); bumpInput(); });
    el.addEventListener("pointermove", (e) => {
      if (!st || e.pointerId !== st.id) return;
      const dy = st.y - e.clientY;
      if (volumeWorks) setVolume(st.v + dy / 160, true);
      else el.style.setProperty("--vp", (dy * 0.6).toFixed(1) + "px");
      if (Math.abs(dy) > 4) vibrate(2);
    });
    const end = () => {
      if (!st) return;
      st = null;
      if (!volumeWorks) Talk.say("volHint", { pr: 1 });
      else setVolume(S.vol);
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowRight") { volStep(1); e.preventDefault(); }
      if (e.key === "ArrowDown" || e.key === "ArrowLeft") { volStep(-1); e.preventDefault(); }
    });
  }

  /* Wischen zwischen Playern */
  function setupSwipe() {
    let sw = null;
    deck.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button, canvas, [data-wheel], [data-volwheel], input, li")) return;
      sw = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    const end = (e) => {
      if (!sw || e.pointerId !== sw.id) return;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
      sw = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        const i = ORDER.indexOf(S.player), d = dx < 0 ? 1 : -1;
        switchTo(ORDER[(i + d + ORDER.length) % ORDER.length], d);
      }
    };
    deck.addEventListener("pointerup", end);
    deck.addEventListener("pointercancel", () => { sw = null; });
    $$(".switcher [data-switch]").forEach((b) => b.addEventListener("click", () => switchTo(b.dataset.switch)));
  }

  /* Neigen (Maus) und Schweben (Touch) */
  const tilt = { rx: 0, ry: 0, gx: 0, gy: 0 };
  function setupTilt() {
    const stage = $("#stage");
    if (finePointer) {
      stage.addEventListener("pointermove", (e) => {
        const dev = $(".slot.is-active .device");
        if (!dev) return;
        const r = dev.getBoundingClientRect();
        const nx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.9), -1, 1);
        const ny = clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 0.9), -1, 1);
        tilt.gy = nx * 10; tilt.gx = -ny * 7;
      });
      stage.addEventListener("pointerleave", () => { tilt.gx = 0; tilt.gy = 0; });
    } else {
      window.addEventListener("deviceorientation", (e) => {
        if (e.gamma == null || e.beta == null) return;
        tilt.gy = clamp(e.gamma / 30, -1, 1) * 7;
        tilt.gx = clamp((e.beta - 50) / 40, -1, 1) * -5;
      });
    }
  }

  /* ═════════ Bibliothek ═════════ */
  const tracksEl = $("#tracks");
  function demoTrack() {
    return { id: "demo", kind: "demo", title: "Happy Birthday, " + MAMA + "!", artist: NAME + " · 8-Bit-Ständchen", duration: window.Synth.duration, cover: null };
  }
  async function loadLibrary() {
    const list = [];
    if (CFG.demoLied && !LS.get("demoHidden", false)) list.push(demoTrack());
    try {
      const r = await fetch("songs/playlist.json", { cache: "no-cache" });
      if (r.ok) {
        const j = await r.json();
        (Array.isArray(j) ? j : (j.lieder || [])).forEach((e) => {
          const file = e && (e.datei || e.file);
          if (!file) return;
          list.push({ id: "url:" + file, kind: "url", title: e.titel || e.title || file.replace(/\.[^.]+$/, ""), artist: e.kuenstler || e.artist || "", duration: 0, url: "songs/" + encodeURI(file), cover: null });
        });
      }
    } catch (e) { }
    let recs = [];
    try { recs = await window.Store.all(); } catch (e) { }
    recs.sort((a, b) => a.added - b.added).forEach((r) => list.push(fromRec(r)));
    S.tracks = list;
    const last = LS.get("last", null);
    const i = list.findIndex((t) => String(t.id) === String(last));
    S.idx = list.length ? (i >= 0 ? i : 0) : -1;
    renderLibrary();
    renderTrack();
    renderStateBits();
  }
  function fromRec(r) {
    return { id: r.id, kind: r.temp ? "temp" : "db", title: r.title, artist: r.artist, duration: r.duration, url: URL.createObjectURL(r.blob), cover: r.cover ? URL.createObjectURL(r.cover) : null };
  }

  function renderLibrary() {
    tracksEl.innerHTML = "";
    if (!S.tracks.length) {
      const li = document.createElement("li");
      li.innerHTML = '<span class="empty">Noch keine Lieder. Tippe auf „Lieder auswählen“, dann zieht Julian sie hier ein.</span>';
      tracksEl.appendChild(li);
    }
    S.tracks.forEach((t, i) => {
      const li = document.createElement("li");
      li.dataset.i = i;
      li.style.animationDelay = Math.min(i, 12) * 0.03 + "s";
      const main = document.createElement("button");
      main.type = "button"; main.className = "tr-main";
      main.setAttribute("aria-label", t.title + " abspielen");
      const thumb = document.createElement("span"); thumb.className = "tr-thumb";
      const img = document.createElement("img"); img.alt = ""; img.src = t.cover || thumbData();
      thumb.appendChild(img);
      const eq = document.createElement("span"); eq.className = "tr-eq"; eq.innerHTML = "<i></i><i></i><i></i>"; thumb.appendChild(eq);
      const text = document.createElement("span"); text.className = "tr-text";
      const ti = document.createElement("span"); ti.className = "tr-title"; ti.textContent = t.title;
      const su = document.createElement("span"); su.className = "tr-sub"; su.textContent = t.artist || (t.kind === "temp" ? "Nur bis zum Schließen" : "Unbekannt");
      ti.style.display = su.style.display = "block";
      text.append(ti, su);
      const du = document.createElement("span"); du.className = "tr-dur"; du.textContent = t.duration ? fmt(t.duration) : "";
      main.append(thumb, text, du);
      li.appendChild(main);
      if (t.kind !== "url") {
        const del = document.createElement("button");
        del.type = "button"; del.className = "tr-del"; del.setAttribute("aria-label", t.title + " löschen");
        del.innerHTML = '<svg><use href="#i-trash"/></svg>';
        li.appendChild(del);
      }
      tracksEl.appendChild(li);
    });
    markCurrentRow();
    renderLibFoot();
    if (menuOpen) renderMenu();
  }
  async function renderLibFoot() {
    const foot = $("#lib-foot");
    const n = S.tracks.length;
    let txt = n === 1 ? "1 Lied" : n + " Lieder";
    const total = S.tracks.reduce((s, t) => s + (t.duration || 0), 0);
    if (total > 0) { const m = Math.max(1, Math.round(total / 60)); txt += " · " + m + (m === 1 ? " Minute" : " Minuten") + " Musik"; }
    try {
      const u = await window.Store.usage();
      if (u > 1024 * 1024) txt += " · " + (u / 1024 / 1024).toFixed(0) + " MB auf diesem Gerät";
    } catch (e) { }
    foot.textContent = txt + ". ";
    if (CFG.demoLied && LS.get("demoHidden", false)) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = "Geburtstagslied zurückholen";
      b.addEventListener("click", () => { LS.set("demoHidden", false); S.tracks.unshift(demoTrack()); if (S.idx >= 0) S.idx++; else S.idx = 0; renderLibrary(); renderTrack(); });
      foot.appendChild(b);
    }
  }
  function markCurrentRow() {
    $$("#tracks li[data-i]").forEach((li) => li.classList.toggle("is-current", +li.dataset.i === S.idx));
  }
  tracksEl.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-i]");
    if (!li) return;
    const i = +li.dataset.i;
    const del = e.target.closest(".tr-del");
    if (del) {
      if (!del.classList.contains("confirm")) {
        $$(".tr-del.confirm").forEach((d) => { d.classList.remove("confirm"); d.innerHTML = '<svg><use href="#i-trash"/></svg>'; });
        del.classList.add("confirm"); del.textContent = "Löschen";
        setTimeout(() => { if (del.isConnected && del.classList.contains("confirm")) { del.classList.remove("confirm"); del.innerHTML = '<svg><use href="#i-trash"/></svg>'; } }, 3500);
        return;
      }
      removeTrack(i);
      return;
    }
    bumpInput();
    if (i === S.idx) toggle(); else setTrack(i, true);
  });
  async function removeTrack(i) {
    const t = S.tracks[i];
    if (!t) return;
    const wasCur = i === S.idx;
    if (t.kind === "demo") LS.set("demoHidden", true);
    else if (t.kind === "db") { try { await window.Store.remove(t.id); } catch (e) { } }
    if (t.url && t.kind !== "url") URL.revokeObjectURL(t.url);
    S.tracks.splice(i, 1);
    if (wasCur) {
      audio.pause(); audio.removeAttribute("src"); audio.dataset.tid = ""; audio.load();
      S.idx = S.tracks.length ? Math.min(i, S.tracks.length - 1) : -1;
    } else if (i < S.idx) S.idx--;
    Talk.say("remove", { pr: 1 });
    renderLibrary(); renderTrack(); renderStateBits();
  }

  /* Hochladen */
  const fileInput = $("#file"), drop = $("#drop"), dropHint = $("#drop-hint");
  const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|aif|aiff|mp4)$/i;
  $$("[data-open-upload]").forEach((b) => b.addEventListener("click", () => {
    if (b.closest(".nav")) $("#musik").scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    fileInput.click();
  }));
  fileInput.addEventListener("change", () => { handleFiles(fileInput.files); fileInput.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => document.addEventListener(ev, (e) => { if (hasFiles(e)) { e.preventDefault(); drop.classList.add("is-over"); } }));
  ["dragleave", "drop"].forEach((ev) => document.addEventListener(ev, (e) => { if (ev === "dragleave" && e.relatedTarget) return; drop.classList.remove("is-over"); }));
  document.addEventListener("drop", (e) => { if (hasFiles(e)) { e.preventDefault(); handleFiles(e.dataTransfer.files); } });
  function hasFiles(e) { return e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf("Files") >= 0; }

  async function handleFiles(files) {
    const arr = Array.from(files || []).filter((f) => (f.type && f.type.indexOf("audio/") === 0) || AUDIO_EXT.test(f.name));
    if (!arr.length) { if (files && files.length) Talk.say("badFile", { pr: 2 }); return; }
    bumpInput();
    drop.classList.add("is-busy");
    const oldHint = "MP3, M4A, AAC oder WAV. Auch mehrere auf einmal.";
    let done = 0, temp = false;
    const firstNew = S.tracks.length;
    for (const f of arr) {
      dropHint.textContent = "Julian räumt ein: " + (done + 1) + " von " + arr.length + " …";
      try {
        const rec = await window.Store.importFile(f);
        if (rec.temp) temp = true;
        S.tracks.push(fromRec(rec));
        done++;
        renderLibrary();
      } catch (e) { }
    }
    drop.classList.remove("is-busy");
    dropHint.textContent = oldHint;
    if (!done) { Talk.say("badFile", { pr: 2 }); return; }
    window.Store.persist();
    if (temp) Talk.say("uploadTemp", { pr: 3 });
    else Talk.say(done === 1 ? "upload1" : "upload", { pr: 3, n: done });
    J.spin(900);
    if (S.idx < 0 || (!S.playing && cur() && cur().kind === "demo" && firstNew <= 1)) { S.idx = firstNew; renderTrack(); }
    markCurrentRow();
  }

  /* ═════════ Outfits ═════════ */
  function applyOutfit(key, animate) {
    const o = SP.OUTFITS[key];
    if (!o) return;
    const prev = S.outfit;
    const apply = () => {
      S.outfit = key; LS.set("outfit", key);
      const st = document.documentElement.style;
      st.setProperty("--acc", o.ui.acc);
      st.setProperty("--acc-ink-light", o.ui.inkL);
      st.setProperty("--acc-ink-dark", o.ui.inkD);
      st.setProperty("--acc-glow", o.ui.glow);
      st.setProperty("--acc-soft", hexA(o.ui.acc, 0.12));
      thumbCache = null; artCache = null;
      drawStaticIcons();
      $$(".tr-thumb img").forEach((img, i) => { const li = img.closest("li[data-i]"); const t = li && S.tracks[+li.dataset.i]; if (t && !t.cover) img.src = thumbData(); });
      $$(".sw").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.outfit === key)));
      updateMediaSession();
    };
    if (animate && prev !== key && !J.hidden && !Door.active) {
      J.setMood("spin", 1200); J.jump(-44);
      setTimeout(apply, 450);
      Talk.say("o_" + key, { pr: 2 });
    } else apply();
  }
  function renderSwatches() {
    const box = $("#swatches");
    box.innerHTML = "";
    Object.keys(SP.OUTFITS).forEach((k) => {
      const o = SP.OUTFITS[k];
      const b = document.createElement("button");
      b.type = "button"; b.className = "sw"; b.dataset.outfit = k;
      b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(k === S.outfit));
      const c = document.createElement("canvas"); c.width = 12; c.height = 11;
      const g = c.getContext("2d");
      SP.drawHead(g, 1, 1, k, "open");
      const name = document.createElement("b"); name.textContent = o.name;
      const sub = document.createElement("small"); sub.textContent = o.sub;
      b.append(c, name, sub);
      b.addEventListener("click", () => { bumpInput(); applyOutfit(k, true); });
      box.appendChild(b);
    });
  }

  /* Symbole aus Pixeln */
  let thumbCache = null, artCache = null;
  function headCanvas(size, pad) {
    const c = document.createElement("canvas"); c.width = size; c.height = size;
    const g = c.getContext("2d");
    const o = SP.OUTFITS[S.outfit];
    g.fillStyle = o.ui.acc; g.fillRect(0, 0, size, size);
    g.fillStyle = hexA("#ffffff", 0.12); g.fillRect(0, 0, size, Math.floor(size / 2));
    const pal = SP.palette(S.outfit);
    const x = Math.round((size - 10) / 2), y = size - 15 + (pad || 0);
    SP.drawJulian(g, x, y, { outfit: S.outfit, eyes: "happy", mouth: "grin", armL: "down", armR: "down" }, pal);
    return c;
  }
  function thumbData() {
    if (!thumbCache) thumbCache = headCanvas(20, 3).toDataURL();
    return thumbCache;
  }
  function artworkData() {
    if (artCache) return artCache;
    const small = headCanvas(24, 4);
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
    g.drawImage(small, 0, 0, 24, 24, 0, 0, 512, 512);
    artCache = c.toDataURL("image/png");
    return artCache;
  }
  function drawStaticIcons() {
    const bh = $(".brand-head");
    if (bh) { const g = bh.getContext("2d"); g.clearRect(0, 0, 10, 9); SP.drawHead(g, 0, 0, S.outfit, "open"); }
    const bt = $(".boot-heart");
    if (bt) { const g = bt.getContext("2d"); g.clearRect(0, 0, 7, 6); SP.blit(g, SP.maps.HEART, 0, 0, SP.BASE); }
    renderNowArt();
  }
  function renderNowArt() {
    const t = cur();
    const img = $(".now-art img"), cv = $(".now-art canvas");
    if (t && t.cover) { img.src = t.cover; img.hidden = false; cv.hidden = true; }
    else {
      img.hidden = true; cv.hidden = false;
      const g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, 24, 24); g.drawImage(headCanvas(24, 4), 0, 0);
    }
    coverGlow(t);
  }
  function coverGlow(t) {
    const set = (c) => document.documentElement.style.setProperty("--cover-glow", c);
    if (!t || !t.cover) { set(t && t.kind === "demo" ? "#ffb86b" : SP.OUTFITS[S.outfit].ui.glow); return; }
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement("canvas"); c.width = c.height = 8;
        const g = c.getContext("2d"); g.drawImage(im, 0, 0, 8, 8);
        const d = g.getImageData(0, 0, 8, 8).data;
        let r = 0, gg = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mx - mn > 30) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } }
        if (n) set("rgb(" + Math.round(r / n) + "," + Math.round(gg / n) + "," + Math.round(b / n) + ")");
      } catch (e) { }
    };
    im.src = t.cover;
  }

  /* ═════════ Geheimnisse ═════════ */
  const SECRETS = [
    { k: "door", name: "Tür zu!", hint: "Tipp ganz schnell ganz oft auf ihn.", icon: "door" },
    { k: "hug", name: "Umarmung", hint: "Halt ihn lange gedrückt.", icon: "heart" },
    { k: "sleep", name: "Schlafmütze", hint: "Lass ihn eine Minute lang in Ruhe.", icon: "zzz" },
    { k: "dizzy", name: "Schwindelig", hint: "Dreh am Klickrad einmal ganz herum.", icon: "star" },
    { k: "diamond", name: "Diamanten!", hint: "Hör ein Lied bis zum Ende.", icon: "diamond" },
    { k: "hold", name: "Gesperrt", hint: "Schieb den HOLD-Schalter am Stick.", icon: "lock" },
    { k: "cap", name: "USB-Forscherin", hint: "Nimm dem Stick die Kappe ab.", icon: "usb" },
    { k: "players", name: "Sammlerin", hint: "Probier alle vier Player aus.", icon: "note" }
  ];
  const ICONS = {
    door: { map: ["nnnnnnn", "neeeeen", "nebbben", "nebWben", "neeeeen", "nebbbgn", "nebbben", "neeeeen", "nnnnnnn"], pal: SP.BASE },
    heart: { map: SP.maps.HEART, pal: SP.BASE },
    zzz: { map: ["ZZZZ...", "..Z....", ".Z.....", "ZZZZ...", "...ZZZ.", "....Z..", "...ZZZ."], pal: { Z: "#5b8def" } },
    star: { map: ["...y...", "...y...", "yyyyyyy", ".yyyyy.", "..yyy..", ".yy.yy.", "y.....y"], pal: { y: "#f4b400" } },
    diamond: { map: SP.maps.DIAMOND, pal: SP.BASE },
    lock: { map: [".kkk.", "k...k", "k...k", "ggggg", "ggKgg", "ggKgg", "ggggg"], pal: { k: "#8d939b", g: "#f4c542", K: "#5a4100" } },
    usb: { map: [".sss.", ".sKs.", ".sss.", "ttttt", "ttttt", "ttttt", "ttttt", ".ttt."], pal: { s: "#c3c9d0", K: "#3b3f45", t: "#12b9b4" } },
    note: { map: SP.maps.NOTE, pal: { N: "#e5484d" } }
  };
  function drawIcon(c, key) {
    const ic = ICONS[key], g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    const w = ic.map[0].length, h = ic.map.length;
    SP.blit(g, ic.map, Math.floor((c.width - w) / 2), Math.floor((c.height - h) / 2), ic.pal);
  }
  function renderSecrets() {
    const box = $("#secrets");
    box.innerHTML = "";
    let n = 0;
    SECRETS.forEach((s) => {
      const f = !!S.found[s.k]; if (f) n++;
      const li = document.createElement("li");
      li.className = "secret" + (f ? " found" : "");
      const c = document.createElement("canvas"); c.width = c.height = 9; drawIcon(c, s.icon);
      const h = document.createElement("h3"); h.textContent = f ? s.name : "? ? ?";
      const p = document.createElement("p"); p.textContent = s.hint;
      const b = document.createElement("span"); b.className = "badge"; b.innerHTML = '<svg><use href="#i-check"/></svg>';
      b.setAttribute("aria-label", f ? "gefunden" : "");
      li.append(c, h, p, b);
      box.appendChild(li);
    });
    $("#secret-count").textContent = n + " von " + SECRETS.length;
  }
  const toastQ = [];
  let toastBusy = false;
  function unlock(k) {
    if (S.found[k]) return;
    S.found[k] = Date.now(); LS.set("found", S.found);
    renderSecrets();
    toastQ.push(k); runToast();
    if (SECRETS.every((s) => S.found[s.k])) setTimeout(() => { Talk.say("allFound", { pr: 3 }); confettiFromDevice(200); }, 2800);
  }
  function runToast() {
    if (toastBusy || !toastQ.length) return;
    toastBusy = true;
    const k = toastQ.shift(), s = SECRETS.find((x) => x.k === k), el = $("#toast");
    drawIcon($(".toast-icon", el), s.icon);
    $(".toast-name", el).textContent = s.name;
    el.classList.add("show");
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => { toastBusy = false; runToast(); }, 650); }, 3200);
  }

  /* ═════════ Konfetti & Herzen ═════════ */
  const cf = { cv: $("#confetti"), parts: [], running: false };
  cf.g = cf.cv.getContext("2d");
  function confettiFromDevice(n) {
    if (reduced) return;
    const scr = $(".slot.is-active .screen");
    const r = scr ? scr.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    confetti(r.left + r.width / 2, r.top + r.height / 2, n || 140);
  }
  function confetti(x, y, n) {
    const o = SP.OUTFITS[S.outfit];
    const cols = [o.ui.acc, o.ui.glow, "#ffd23f", "#ff5a7a", "#4fb4ff", "#ffffff", "#b388ff"];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = 6 + Math.random() * 11;
      cf.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, s: 5 + Math.random() * 6, c: cols[i % cols.length], life: 2.6 + Math.random(), heart: i % 9 === 0 });
    }
    runConfetti();
  }
  function floatHearts() {
    if (reduced) return;
    const scr = $(".slot.is-active .screen");
    if (!scr) return;
    const r = scr.getBoundingClientRect();
    for (let i = 0; i < 9; i++) {
      cf.parts.push({ x: r.left + r.width * (0.3 + Math.random() * 0.4), y: r.top + r.height * 0.5, vx: (Math.random() - 0.5) * 1.5, vy: -2 - Math.random() * 2.5, r: 0, vr: 0, s: 12 + Math.random() * 10, c: ["#ff4d6d", "#ff8fa3", "#ff2e63"][i % 3], life: 2.2 + Math.random(), heart: true, float: true, ph: Math.random() * 6 });
    }
    runConfetti();
  }
  function heartPath(g, s) {
    g.beginPath();
    g.moveTo(0, s * 0.3);
    g.bezierCurveTo(-s * 0.6, -s * 0.2, -s * 0.25, -s * 0.65, 0, -s * 0.25);
    g.bezierCurveTo(s * 0.25, -s * 0.65, s * 0.6, -s * 0.2, 0, s * 0.3);
    g.fill();
  }
  function runConfetti() {
    if (cf.running) return;
    cf.running = true;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cf.cv.width = innerWidth * dpr; cf.cv.height = innerHeight * dpr;
    let last = now();
    const step = () => {
      const t = now(), dt = Math.min(0.05, (t - last) / 1000); last = t;
      const g = cf.g;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, innerWidth, innerHeight);
      cf.parts.forEach((p) => {
        p.life -= dt;
        if (p.float) { p.ph += dt * 3; p.x += Math.sin(p.ph) * 0.8 + p.vx; p.y += p.vy; }
        else { p.vy += 0.35; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; }
        g.save();
        g.globalAlpha = clamp(p.life / 0.8, 0, 1);
        g.translate(p.x, p.y); g.rotate(p.r);
        g.fillStyle = p.c;
        if (p.heart) heartPath(g, p.s); else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        g.restore();
      });
      cf.parts = cf.parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
      if (cf.parts.length) requestAnimationFrame(step);
      else { cf.running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
    };
    requestAnimationFrame(step);
  }

  /* ═════════ Brief ═════════ */
  function renderLetter() {
    const box = $("#letter");
    box.innerHTML = "";
    (CFG.brief || []).forEach((para) => {
      const p = document.createElement("p");
      para.split(/\s+/).filter(Boolean).forEach((w, i) => {
        if (i) p.appendChild(document.createTextNode(" "));
        const s = document.createElement("span"); s.className = "w"; s.textContent = w; p.appendChild(s);
      });
      box.appendChild(p);
    });
    $("#signature").textContent = CFG.absender || "";
    if (reduced) $$(".w", box).forEach((w) => w.classList.add("on"));
  }
  let letterTick = false;
  function onScroll() {
    if (letterTick || reduced) return;
    letterTick = true;
    requestAnimationFrame(() => {
      letterTick = false;
      const box = $("#letter");
      const r = box.getBoundingClientRect(), vh = window.innerHeight;
      const p = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.25), 0, 1);
      const words = $$(".w", box), n = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle("on", i < n));
    });
  }

  /* ═════════ Rest der Bedienung ═════════ */
  function bumpInput() {
    const t = now();
    if (J.mood === "sleep" && !J.hidden) { Talk.say("wake", { pr: 2 }); J.setMood("shock", 700); J.jump(-50); }
    S.lastInput = t;
  }
  ["pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, bumpInput, { passive: true }));

  const scrub = $("#scrub");
  let scrubbing = false;
  scrub.addEventListener("input", () => {
    scrubbing = true;
    if (isFinite(audio.duration)) {
      const t = (scrub.value / 1000) * audio.duration;
      setBind("time", fmt(t)); setBind("remain", "-" + fmt(audio.duration - t));
    }
    scrub.style.setProperty("--p", (scrub.value / 10) + "%");
  });
  scrub.addEventListener("change", () => {
    if (isFinite(audio.duration)) { audio.currentTime = (scrub.value / 1000) * audio.duration; updatePositionState(); }
    else if (cur()) { ensureLoaded(); }
    scrubbing = false;
  });
  const shuffleBtn = $("#btn-shuffle"), repeatBtn = $("#btn-repeat");
  function renderModes() {
    shuffleBtn.setAttribute("aria-pressed", String(S.shuffle));
    repeatBtn.classList.toggle("on", S.repeat !== "off");
    repeatBtn.classList.toggle("one", S.repeat === "one");
    repeatBtn.setAttribute("aria-label", "Wiederholen: " + (S.repeat === "all" ? "alle" : S.repeat === "one" ? "dieses Lied" : "aus"));
  }
  shuffleBtn.addEventListener("click", () => { S.shuffle = !S.shuffle; LS.set("shuffle", S.shuffle); renderModes(); bumpInput(); });
  repeatBtn.addEventListener("click", () => { S.repeat = S.repeat === "all" ? "one" : S.repeat === "one" ? "off" : "all"; LS.set("repeat", S.repeat); renderModes(); bumpInput(); });
  const volInput = $("#vol");
  if (volumeWorks) {
    $("#now-vol").hidden = false;
    volInput.addEventListener("input", () => setVolume(volInput.value / 100, true));
    volInput.addEventListener("change", () => setVolume(volInput.value / 100));
  }

  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea, [contenteditable]")) return;
    if (e.key === " " && !(e.target.closest && e.target.closest("button"))) { e.preventDefault(); toggle(); }
    else if (e.key === "ArrowRight" && e.shiftKey) next();
    else if (e.key === "ArrowLeft" && e.shiftKey) prev();
  });

  let hiddenAt = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hiddenAt = now();
    else if (hiddenAt && now() - hiddenAt > 120000) { Talk.say("back", { pr: 2 }); J.setMood("wave", 1400); }
  });

  // Ab und zu etwas sagen
  setInterval(() => {
    if (document.hidden || (Intro.active && Intro.phase !== "after") || Door.active || J.hidden) return;
    if (Talk.busy() || now() - Talk.lastEnd < Talk.nextGap) return;
    const h = new Date().getHours();
    const custom = (CFG.eigeneSprueche || []).filter(Boolean);
    if (J.mood === "sleep") Talk.say("sleep", { pr: 0 });
    else if (S.playing) Talk.say("playing", { pr: 0 });
    else if (custom.length && Math.random() < 0.3) Talk.say(null, { pr: 0, text: custom[Math.floor(Math.random() * custom.length)] });
    else if ((h >= 22 || h < 5) && Math.random() < 0.3) Talk.say("night", { pr: 0 });
    else Talk.say("idle", { pr: 0 });
  }, 1000);

  /* ═════════ Haupt-Schleife ═════════ */
  const counterDigits = $$(".counter .dg i");
  counterDigits.forEach((i) => { i.innerHTML = "0123456789".split("").concat("0").map((d) => "<b>" + d + "</b>").join(""); });
  const dev = {};
  ORDER.forEach((n) => { dev[n] = $(".device", slots[n]); });
  const reelL = $(".reel-l .hub"), reelR = $(".reel-r .hub"), packL = $(".reel-l .pack"), packR = $(".reel-r .pack");
  const cdSpin = $(".cd-spin"), tapeLed = $(".tp-led"), stLed = $(".st-led"), glowEl = $(".glow");
  const bars = binds.bar;
  const mech = { reelSpeed: 0, aL: 0, aR: 0, counter: 0, counterTid: null, disc: 0, discSpeed: 0 };
  let lastT = now(), lastSec = -1, lastPos = 0, lastTid = null;

  function frame() {
    const t = now();
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    updateLevels(t, dt);
    updateJ(t, dt);
    Parts.update(dt);
    const sc = active();
    if (sc && sc.W) sc.render(t);

    // Zeiten & Fortschritt
    const d = audio.duration, ct = audio.currentTime || 0;
    const c = cur();
    const dur = isFinite(d) && d > 0 ? d : (c && c.duration) || 0;
    const frac = dur ? clamp(ct / dur, 0, 1) : 0;
    const sec = Math.floor(ct);
    const tid = c ? c.id : null;
    if (sec !== lastSec || tid !== lastTid || !dur) {
      lastSec = sec; lastTid = tid;
      if (!scrubbing) {
        setBind("time", fmt(ct));
        setBind("remain", "-" + fmt(Math.max(0, dur - ct)));
      }
      if (S.playing && sec % 5 === 0) updatePositionState();
      if (!S.playing) setBind("state", S.hold ? "HOLD" : ct > 0.3 ? "PAUSE" : "STOP");
    }
    bars.forEach((b) => { b.style.transform = "scaleX(" + frac.toFixed(4) + ")"; });
    if (!scrubbing && Math.abs(frac - lastPos) > 0.0005) { lastPos = frac; scrub.value = Math.round(frac * 1000); scrub.style.setProperty("--p", (frac * 100).toFixed(2) + "%"); }

    // Kassette
    if (S.player === "tape") {
      const target = S.playing ? (t < S.reelBurst ? 7 : 1) : (t < S.reelBurst ? 7 : 0);
      mech.reelSpeed += (target - mech.reelSpeed) * Math.min(1, dt * (target > mech.reelSpeed ? 5 : 2.5));
      const r0 = 15, R = 37;
      const rL = Math.sqrt(r0 * r0 + (1 - frac) * (R * R - r0 * r0)), rR = Math.sqrt(r0 * r0 + frac * (R * R - r0 * r0));
      const v = 34 * mech.reelSpeed;
      mech.aL += (v / rL) * dt; mech.aR += (v / rR) * dt;
      if (c && mech.counterTid !== c.id) { mech.counterTid = c.id; mech.counter = 0; }
      mech.counter += (v / rR) * dt / (Math.PI * 2) * 2;
      reelL.style.transform = "rotate(" + (-mech.aL * 57.3).toFixed(1) + "deg)";
      reelR.style.transform = "rotate(" + (-mech.aR * 57.3).toFixed(1) + "deg)";
      packL.style.transform = "scale(" + (rL / 38).toFixed(3) + ")";
      packR.style.transform = "scale(" + (rR / 38).toFixed(3) + ")";
      const cv = mech.counter % 1000;
      const u = cv % 10, te = Math.floor(cv / 10) % 10, hu = Math.floor(cv / 100) % 10;
      const carry = Math.max(0, u - 9);
      const pos = [hu + (te === 9 ? carry : 0), te + carry, u];
      counterDigits.forEach((el, i) => { el.style.transform = "translateY(" + (-pos[i] * 16).toFixed(1) + "px)"; });
      tapeLed.classList.toggle("on", S.playing);
      tapeLed.style.setProperty("--b", Lv.beat.toFixed(2));
    }
    // CD
    if (S.player === "disc") {
      const target = S.playing ? 520 : 0;
      mech.discSpeed += (target - mech.discSpeed) * Math.min(1, dt * (target > mech.discSpeed ? 1.8 : 0.9));
      mech.disc = (mech.disc + mech.discSpeed * dt) % 360;
      cdSpin.style.transform = "rotate(" + mech.disc.toFixed(1) + "deg)";
    }
    // Stick
    if (S.player === "stick") { stLed.classList.toggle("on", S.playing && Lv.beat > 0.3); stLed.style.setProperty("--b", Lv.beat.toFixed(2)); }

    // Neigen, Schweben, Pulsieren
    const dv = dev[S.player];
    if (dv && !reduced) {
      let tx = tilt.gx, ty = tilt.gy, fy = 0;
      if (!finePointer) { tx += Math.sin(t * 0.0007) * 2.2; ty += Math.sin(t * 0.00055 + 1) * 3.2; fy = Math.sin(t * 0.0011) * 4; }
      tilt.rx += (tx - tilt.rx) * Math.min(1, dt * 5);
      tilt.ry += (ty - tilt.ry) * Math.min(1, dt * 5);
      const s = 1 + Lv.beat * 0.012;
      dv.style.transform = "translateY(" + fy.toFixed(2) + "px) rotateX(" + tilt.rx.toFixed(2) + "deg) rotateY(" + tilt.ry.toFixed(2) + "deg) scale(" + s.toFixed(4) + ")";
      dv.style.setProperty("--gx", (50 + tilt.ry * 4).toFixed(1) + "%");
      dv.style.setProperty("--gy", (10 - tilt.rx * 4).toFixed(1) + "%");
      glowEl.style.transform = "scale(" + (1 + Lv.level * 0.22 + Lv.beat * 0.05).toFixed(3) + ")";
    }
    requestAnimationFrame(frame);
  }

  /* ═════════ Start ═════════ */
  function staticText() {
    $$("[data-mama]").forEach((e) => { e.textContent = MAMA; });
    $$("[data-buddy-name]").forEach((e) => { e.textContent = NAME; });
    const tip = $("#ios-hint");
    const standalone = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
    if (isIOS && !standalone && !inFrame && !LS.get("iosHintClosed", false)) tip.hidden = false;
    $("#ios-hint-close").addEventListener("click", () => { tip.hidden = true; LS.set("iosHintClosed", true); });
  }

  function greet() {
    const h = new Date().getHours();
    const key = h >= 22 || h < 5 ? "greetNight" : h < 11 ? "greetMorning" : h < 18 ? "greetDay" : "greetEvening";
    Talk.say(key, { pr: 2 });
  }
  function bootJulian() {
    J.hidden = false; J.xr = J.tx = 0.5; J.jy = -40; J.vy = 0;
    J.setMood("boot", 900);
    setTimeout(() => { J.setMood("wave", 1500); greet(); }, 950);
  }

  staticText();
  if (!S.seen[S.player]) { S.seen[S.player] = true; LS.set("seen", S.seen); }
  applyOutfit(S.outfit, false);
  renderSwatches();
  renderSecrets();
  renderLetter();
  renderModes();
  setActiveSlot(S.player);
  setupWheel();
  setupVolWheel();
  setupSwipe();
  setupTilt();
  setVolume(S.vol, true);
  $(".hud") && $(".hud").classList.remove("show");
  layout();
  renderTrack();
  loadLibrary();
  window.addEventListener("resize", () => layout());
  window.addEventListener("scroll", onScroll, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layout(); });
  onScroll();
  requestAnimationFrame(frame);
  if ("serviceWorker" in navigator && !inFrame && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(() => { });
  }

  const bootDelay = S.player === "classic" && !reduced ? 1700 : 500;
  setTimeout(() => {
    const hasBrother = CFG.ueberlieferer && (CFG.ueberlieferer.saetze || []).length;
    if (!LS.get("introDone", false) && hasBrother) Intro.start();
    else if (!LS.get("introDone", false)) {
      LS.set("introDone", true);
      bootJulian();
      setTimeout(() => { Talk.chain((LINES.first || []).map((s) => ({ text: s }))); confettiFromDevice(140); }, 1000);
    } else bootJulian();
  }, bootDelay);
})();
