/* Pixel-Figuren: alles wird in logischen Pixeln gezeichnet und später hochskaliert. */
(function () {
  /* Outfits für Julian. ui = Akzentfarben der Seite. */
  const OUTFITS = {
    creeper: { name: "Creeper-Hoodie", sub: "Minecraft", kind: "hoodie", H: "#4cae4f", D: "#2f7d36", L: "#86d97f", U: "#2d3340", F: "#16181c",
      ui: { acc: "#1a8f44", inkL: "#138a3e", inkD: "#4cd472", glow: "#57d36a" } },
    trainer: { name: "Trainer", sub: "Pokémon", kind: "trainer", H: "#2f6fd6", D: "#1d4a9a", L: "#6ea4ff", U: "#2d3a66", F: "#d8343a",
      ui: { acc: "#d8343a", inkL: "#c82d33", inkD: "#ff7a72", glow: "#ff5a5f" } },
    gruen: { name: "Grün", sub: "Energie", kind: "gi", H: "#2fae55", D: "#1b7436", L: "#6bdc80", U: "#2fae55", F: "#1b2a1f", B: "#173d22", G: "#f4c542",
      ui: { acc: "#1a8f44", inkL: "#138a3e", inkD: "#4cd472", glow: "#3ee07a" } },
    rot: { name: "Rot", sub: "Feuer", kind: "gi", H: "#d9412f", D: "#8f2217", L: "#ff8063", U: "#d9412f", F: "#2a1210", B: "#4a120c", G: "#f4c542",
      ui: { acc: "#d23a28", inkL: "#c8321f", inkD: "#ff7a5c", glow: "#ff6a3d" } },
    blau: { name: "Blau", sub: "Blitz", kind: "gi", H: "#2f7fdc", D: "#1a4c92", L: "#77b6ff", U: "#2f7fdc", F: "#0f1d33", B: "#0f2a52", G: "#f4c542",
      ui: { acc: "#1f6fd6", inkL: "#1866c9", inkD: "#6fb1ff", glow: "#4aa3ff" } },
    schwarz: { name: "Schwarz", sub: "Erde", kind: "gi", H: "#35363d", D: "#1b1c20", L: "#5f626c", U: "#35363d", F: "#0d0d10", B: "#a7adb7", G: "#e0a83a",
      ui: { acc: "#3a3b42", inkL: "#3a3b42", inkD: "#c9ccd4", glow: "#8e95a3" } },
    weiss: { name: "Weiß", sub: "Eis", kind: "gi", H: "#e8eef4", D: "#a9b6c3", L: "#ffffff", U: "#e8eef4", F: "#5a6b7d", B: "#5a6b7d", G: "#7cc6ff",
      ui: { acc: "#2f7fbf", inkL: "#2f7fbf", inkD: "#cfe8ff", glow: "#9fdcff" } },
    gold: { name: "Gold", sub: "Gold", kind: "gi", H: "#efb42a", D: "#a8761a", L: "#ffe07a", U: "#efb42a", F: "#3b2a08", B: "#6b4508", G: "#ffffff",
      ui: { acc: "#b37a00", inkL: "#a06d00", inkD: "#ffd25e", glow: "#ffc93d" } }
  };

  const BASE = {
    A: "#9a5b34", a: "#6b3c22", Q: "#c47e4a",           // Haare
    S: "#f6d2b8", s: "#e0ad8f", E: "#26232c", M: "#b5545a", P: "#ff8fa3",
    K: "#2b2d34", w: "#e9edf2", r: "#ff4b5c", l: "#3aa0ff",
    C: "#4fe3e0", c: "#2bb3b8", W: "#ffffff", T: "#8a5a2b", R: "#e3343c",
    X: "#1c2a1d", N: "#ffffff", Z: "#ffffff",
    // Mäßiger Überlieferer
    Y: "#cfd0d4", y: "#8d8e95", O: "#2e2e33", o: "#d7ecf7", V: "#1f2a48", J: "#e8e8ec", u: "#34363d",
    // Paket + Tür
    b: "#c99257", d: "#8f6232", e: "#a8743e", n: "#5e3a1a", g: "#f4c542", k: "#1a120b"
  };

  function mix(c1, c2, t) {
    const p = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const a = p(c1), b = p(c2);
    const m = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return "#" + m.map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  function palette(key, red) {
    const o = OUTFITS[key] || OUTFITS.creeper;
    const p = Object.assign({}, BASE, { H: o.H, D: o.D, L: o.L, U: o.U, F: o.F, B: o.B || o.D, G: o.G || o.L, N: o.H });
    if (red > 0) {
      const t = Math.min(1, red);
      p.S = mix(BASE.S, "#ff3b2f", t * 0.85);
      p.s = mix(BASE.s, "#c41f16", t * 0.85);
    }
    return p;
  }

  /* ── Pixelkarten ─────────────────────────────── */
  const HEAD = [
    "..AAAAAA..",
    ".AQAAQAAA.",
    "AAAQAAAAaA",
    "AAASAAASAa",
    "aSSSSSSSSa",
    "aSSSSSSSSa",
    ".SSSSSSSS.",
    ".SSSSSSSS.",
    "..SSSSSS.."
  ];
  const CAP = [
    "..RRRRRR..",
    ".RRWWWWRR.",
    "RRRRRRRRRR"
  ];
  const BODY_GI = ["HHLGHHHD", "HHHHHHHD", "BBBBBBBB", "HHHHHHHD"];
  const BODY_HOODIE = ["LHXHDXHD", "HDHXXHLH", "DHXXXXHD", "HLXHHXDH"];
  const BODY_TRAINER = ["HWHHHHWH", "HHHKHHHD", "HHHKHLHD", "HHHKHHHD"];

  const OB_HEAD = [
    "..YYYYYY..",
    ".YyYYyYYY.",
    "YYYYyYYyYY",
    "yYYyYYYYyY",
    "sSSSSSSSSs",
    "SOoEOOEoOS",
    "SSOOSSOOSS",
    ".SSSMMSSS.",
    "..SSSSSS.."
  ];
  const OB_BODY = [
    "JJJVVVVJJJ",
    "JJVVVVVVJJ",
    "JJVVVVVVJJ",
    "JJVVVVVVJJ",
    "JJVVVVVVJJ",
    "JVVVVVVVVJ",
    "VVVVVVVVVV"
  ];

  const CONTROLLER = [".KKllKK.", "KwKKKKrK", "KK....KK"];
  const PICKAXE = ["..CCC...", "....CC..", "....TcC.", "...T..C.", "..T...c.", ".T......", "T......."];
  const HEART = [".RR.RR.", "RWRRRRR", "RRRRRRR", ".RRRRR.", "..RRR..", "...R..."];
  const HEART_S = ["R.R", "RRR", ".R."];
  const NOTE = ["..NN", "..N.", "..N.", "NNN.", "NN.."];
  const ZED = ["ZZZ", ".Z.", "ZZZ"];
  const DIAMOND = [".CCC.", "CWCCC", "CCCCc", ".CCc.", "..c.."];
  const GRASS_BLOCK = ["gGgGGg", "GgdGgG", "dbdbbd", "bdbbdb", "bbdbbb", "dbbbdb"];
  const BLOCK_PAL = { g: "#5fbf3f", G: "#4a9e2f", d: "#7a5230", b: "#96673c" };
  const POKEBALL = [".RRR.", "RRRRR", "KKWKK", "WWWWW", ".WWW."];
  const BOX = [
    "..RR.RR.",
    "...RRR..",
    "bbbbRbbb",
    "eeeeReee",
    "bbbbRbbb",
    "bbbbRbbb",
    "bbbbRbbb",
    "ddddRddd"
  ];
  const DOOR = [
    "nnnnnnnnnn",
    "nddddddddn",
    "ndeeeeeedn",
    "ndebbbbedn",
    "ndebWWbedn",
    "ndebRWbedn",
    "ndebbbbedn",
    "ndeeeeeedn",
    "nddddddddn",
    "nddddddgdn",
    "nddddddddn",
    "ndeeeeeedn",
    "ndebbbbedn",
    "ndebbbbedn",
    "ndebbbbedn",
    "ndeeeeeedn",
    "nddddddddn",
    "nnnnnnnnnn"
  ];

  function blit(g, map, x, y, pal, flip) {
    for (let j = 0; j < map.length; j++) {
      const row = map[j], w = row.length;
      for (let i = 0; i < w; i++) {
        const ch = row[i];
        if (ch === ".") continue;
        const col = pal[ch];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(flip ? x + (w - 1 - i) : x + i, y + j, 1, 1);
      }
    }
  }

  function rotate90(map) {
    const h = map.length, w = map[0].length, out = [];
    for (let i = 0; i < w; i++) {
      let s = "";
      for (let j = h - 1; j >= 0; j--) s += map[j][i];
      out.push(s);
    }
    return out;
  }
  const PICKAXE_DOWN = rotate90(PICKAXE);

  function dot(g, x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
  function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

  /*
    Julian. (x, y) = linke obere Ecke des Kopfes, Füße liegen bei y + 15.
    p: { outfit, eyes, look, mouth, brows, armL, armR, legL, legR, headDy, bodyDy, dir, prop, blush, tail, light }
  */
  function drawJulian(g, x, y, p, pal) {
    x = Math.round(x); y = Math.round(y);
    const o = OUTFITS[p.outfit] || OUTFITS.creeper;
    const hy = y + (p.headDy || 0);
    const by = y + (p.bodyDy || 0);
    const dir = p.dir || 1;

    // Stirnband-Enden flattern hinter dem Kopf
    if (o.kind === "gi") {
      const t = p.tail || 0;
      const tx = dir > 0 ? x - 1 : x + 10, sx = dir > 0 ? -1 : 1;
      const w1 = Math.round(Math.sin(t)), w2 = Math.round(Math.sin(t + 1.3));
      dot(g, tx, hy + 3, pal.D);
      dot(g, tx + sx, hy + 3 + w1, pal.H);
      dot(g, tx + sx * 2, hy + 4 + w1, pal.D);
      dot(g, tx + sx, hy + 5 + w2, pal.H);
    }

    legs(g, x, by, p.legL || 0, 1, pal);
    legs(g, x, by, p.legR || 0, 6, pal);

    const body = o.kind === "hoodie" ? BODY_HOODIE : o.kind === "trainer" ? BODY_TRAINER : BODY_GI;
    blit(g, body, x + 1, by + 9, pal);
    if (o.kind === "hoodie") { dot(g, x + 1, by + 9, pal.D); dot(g, x + 8, by + 9, pal.D); }

    arm(g, x, by, hy, p.armL || "down", -1, pal);
    arm(g, x, by, hy, p.armR || "down", 1, pal);

    // Kopf
    blit(g, HEAD, x, hy, pal);
    if (o.kind === "gi") { rect(g, x, hy + 3, 10, 1, pal.N); dot(g, x + 9, hy + 3, pal.D); }
    if (o.kind === "trainer") {
      blit(g, CAP, x, hy, pal);
      rect(g, dir > 0 ? x + 2 : x - 2, hy + 3, 10, 1, "#b0242b");
    }
    face(g, x, hy, p, pal);

    if (p.armL === "up" || p.armL === "wave") arm(g, x, by, hy, p.armL, -1, pal, true);
    if (p.armR === "up" || p.armR === "wave") arm(g, x, by, hy, p.armR, 1, pal, true);

    props(g, x, y, by, hy, p, pal);
  }

  function props(g, x, y, by, hy, p, pal) {
    if (p.prop === "controller") {
      blit(g, CONTROLLER, x + 1, by + 10, Object.assign({}, pal, { l: (p.light || 0) > 0.5 ? pal.l : "#1d5fa8" }));
      dot(g, x + 1, by + 11, pal.S); dot(g, x + 8, by + 11, pal.S);
    } else if (p.prop === "heart") {
      blit(g, HEART, x + 1, by + 8, pal);
      dot(g, x, by + 11, pal.S); dot(g, x + 9, by + 11, pal.S);
    } else if (p.prop === "pickaxe-up") {
      blit(g, PICKAXE, x + 7, hy - 3, pal);
    } else if (p.prop === "pickaxe-down") {
      blit(g, PICKAXE_DOWN, x + 9, by + 6, pal);
    } else if (p.prop === "pokeball") {
      blit(g, POKEBALL, x + 9 + (p.ballX || 0), y + (p.ballY == null ? 4 : p.ballY), pal);
    }
  }

  function legs(g, x, by, lift, ox, pal) {
    const lx = x + ox;
    if (lift > 0) {
      rect(g, lx, by + 13, 3, 1, pal.U);
      rect(g, lx, by + 14, 3, 1, pal.F);
    } else {
      rect(g, lx, by + 13, 3, 2, pal.U);
      rect(g, lx, by + 15, 3, 1, pal.F);
    }
  }

  function arm(g, x, by, hy, pose, side, pal, front) {
    const L = side < 0;
    if ((pose === "up" || pose === "wave") && !front) return;
    if (pose === "down") {
      const ax = L ? x - 1 : x + 9;
      rect(g, ax, by + 9, 2, 3, pal.H);
      dot(g, L ? ax : ax + 1, by + 10, pal.D);
      rect(g, ax, by + 12, 2, 1, pal.S);
    } else if (pose === "front") {
      const ax = L ? x - 1 : x + 9;
      rect(g, ax, by + 9, 2, 2, pal.H);
      dot(g, L ? x : x + 9, by + 11, pal.S);
    } else if (pose === "up" || pose === "wave") {
      const off = pose === "wave" ? (Math.floor(performance.now() / 180) % 2) * side : 0;
      const ax = (L ? x - 2 : x + 10) + off;
      rect(g, L ? x - 1 : x + 9, by + 9, 2, 1, pal.H);
      rect(g, ax, hy + 6, 2, 3, pal.H);
      rect(g, ax, hy + 5, 2, 1, pal.S);
    }
  }

  function face(g, x, hy, p, pal) {
    const look = p.look || 0;
    const lx = x + 2 + look, rx = x + 7 + look;
    const e = p.eyes || "open";
    if (e === "open") {
      rect(g, lx, hy + 5, 1, 2, pal.E); rect(g, rx, hy + 5, 1, 2, pal.E);
    } else if (e === "closed") {
      dot(g, lx, hy + 6, pal.E); dot(g, rx, hy + 6, pal.E);
      dot(g, lx - 1, hy + 6, pal.s); dot(g, rx + 1, hy + 6, pal.s);
    } else if (e === "happy") {
      dot(g, x + 2, hy + 5, pal.E); dot(g, x + 1, hy + 6, pal.E); dot(g, x + 3, hy + 6, pal.E);
      dot(g, x + 7, hy + 5, pal.E); dot(g, x + 6, hy + 6, pal.E); dot(g, x + 8, hy + 6, pal.E);
    } else if (e === "wide") {
      rect(g, x + 1, hy + 4, 2, 3, pal.W); dot(g, x + 2, hy + 5, pal.E); dot(g, x + 2, hy + 6, pal.E);
      rect(g, x + 7, hy + 4, 2, 3, pal.W); dot(g, x + 7, hy + 5, pal.E); dot(g, x + 7, hy + 6, pal.E);
    } else if (e === "dizzy") {
      const f = Math.floor(performance.now() / 120) % 2;
      dot(g, x + 1 + f, hy + 5, pal.E); dot(g, x + 3 - f, hy + 6, pal.E);
      dot(g, x + 6 + f, hy + 5, pal.E); dot(g, x + 8 - f, hy + 6, pal.E);
    } else if (e === "angry") {
      dot(g, x + 2, hy + 6, pal.E); dot(g, x + 7, hy + 6, pal.E);
      dot(g, x + 1, hy + 4, pal.E); dot(g, x + 2, hy + 5, pal.a); dot(g, x + 3, hy + 5, pal.E);
      dot(g, x + 8, hy + 4, pal.E); dot(g, x + 7, hy + 5, pal.a); dot(g, x + 6, hy + 5, pal.E);
    }
    if (p.blush) { dot(g, x + 1, hy + 7, pal.P); dot(g, x + 8, hy + 7, pal.P); }
    const m = p.mouth || "smile";
    if (m === "smile") { rect(g, x + 4, hy + 7, 2, 1, pal.M); }
    else if (m === "grin") { dot(g, x + 3, hy + 7, pal.M); dot(g, x + 6, hy + 7, pal.M); rect(g, x + 4, hy + 7, 2, 1, pal.W); rect(g, x + 4, hy + 8, 2, 1, pal.M); }
    else if (m === "open") { rect(g, x + 4, hy + 7, 2, 1, pal.E); }
    else if (m === "o") { rect(g, x + 4, hy + 7, 2, 2, pal.E); }
    else if (m === "flat") { rect(g, x + 3, hy + 7, 4, 1, pal.s); }
    else if (m === "shout") { rect(g, x + 3, hy + 6, 4, 3, pal.E); rect(g, x + 4, hy + 8, 2, 1, "#e0475a"); }
  }

  /* Der mäßige Überlieferer. Füße bei y + 20. */
  function drawBrother(g, x, y, p, pal) {
    x = Math.round(x); y = Math.round(y);
    const walk = p.walk || 0;
    // Beine
    const l1 = walk === 1 ? 1 : 0, l2 = walk === 2 ? 1 : 0;
    rect(g, x + 1, y + 16, 3, 4 - l1, pal.u); rect(g, x + 1, y + 20 - l1, 3, 1, pal.E);
    rect(g, x + 6, y + 16, 3, 4 - l2, pal.u); rect(g, x + 6, y + 20 - l2, 3, 1, pal.E);
    blit(g, OB_BODY, x, y + 9, pal);
    // Arme
    if (p.carry) {
      rect(g, x - 1, y + 10, 2, 4, pal.J); rect(g, x + 9, y + 10, 2, 4, pal.J);
      blit(g, BOX, x + 1, y + 9, pal);
      dot(g, x, y + 13, pal.S); dot(g, x + 9, y + 13, pal.S);
    } else if (p.wave) {
      const off = Math.floor(performance.now() / 180) % 2;
      rect(g, x - 1, y + 10, 2, 5, pal.J); rect(g, x - 1, y + 15, 2, 1, pal.S);
      rect(g, x + 10 + off, y + 5, 2, 4, pal.J); rect(g, x + 10 + off, y + 4, 2, 1, pal.S);
      rect(g, x + 9, y + 9, 2, 1, pal.J);
    } else {
      rect(g, x - 1, y + 10, 2, 5, pal.J); rect(g, x - 1, y + 15, 2, 1, pal.S);
      rect(g, x + 9, y + 10, 2, 5, pal.J); rect(g, x + 9, y + 15, 2, 1, pal.S);
    }
    blit(g, OB_HEAD, x, y + (p.headDy || 0), pal);
    if (p.blink) { dot(g, x + 3, y + 5, pal.o); dot(g, x + 6, y + 5, pal.o); }
    if (p.talk) rect(g, x + 4, y + 7, 2, 1, pal.E);
  }

  /* Kleiner Kopf als Symbol */
  function drawHead(g, x, y, outfit, eyesKind) {
    const pal = palette(outfit);
    const o = OUTFITS[outfit] || OUTFITS.creeper;
    blit(g, HEAD, x, y, pal);
    if (o.kind === "gi") rect(g, x, y + 3, 10, 1, pal.N);
    if (o.kind === "trainer") { blit(g, CAP, x, y, pal); rect(g, x, y + 3, 10, 1, "#b0242b"); }
    face(g, x, y, { eyes: eyesKind || "open", mouth: eyesKind === "happy" ? "grin" : "smile" }, pal);
  }

  window.Sprite = {
    OUTFITS, palette, mix, blit, drawJulian, drawBrother, drawHead, dot, rect,
    maps: { HEART, HEART_S, NOTE, ZED, DIAMOND, GRASS_BLOCK, PICKAXE, CONTROLLER, POKEBALL, BOX, DOOR },
    BLOCK_PAL, BASE
  };
})();
