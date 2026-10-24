/* Lieder bleiben auf dem Gerät: IndexedDB + ID3-Tags auslesen. */
(function () {
  const DB_NAME = "mama-player";
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("tracks")) db.createObjectStore("tracks", { keyPath: "id", autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  function tx(mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction("tracks", mode);
      const store = t.objectStore("tracks");
      let result;
      Promise.resolve(fn(store)).then((r) => { result = r; });
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  function all() {
    return tx("readonly", (s) => new Promise((res) => {
      const r = s.getAll();
      r.onsuccess = () => res(r.result || []);
    })).catch(() => []);
  }

  function add(rec) {
    return tx("readwrite", (s) => new Promise((res) => {
      const r = s.add(rec);
      r.onsuccess = () => res(r.result);
    }));
  }

  function remove(id) {
    return tx("readwrite", (s) => { s.delete(id); });
  }

  /* ── ID3v2 ─────────────────────────────────────── */
  function synchsafe(b, o) { return (b[o] << 21) | (b[o + 1] << 14) | (b[o + 2] << 7) | b[o + 3]; }
  function u32(b, o) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }

  function decodeText(bytes, enc) {
    try {
      if (enc === 0) return new TextDecoder("latin1").decode(bytes);
      if (enc === 1) return new TextDecoder("utf-16").decode(bytes);
      if (enc === 2) return new TextDecoder("utf-16be").decode(bytes);
      return new TextDecoder("utf-8").decode(bytes);
    } catch (e) { return ""; }
  }
  const clean = (s) => s.replace(/\u0000/g, "").replace(/﻿/g, "").trim();

  function findTerminator(b, from, enc) {
    if (enc === 1 || enc === 2) {
      for (let i = from; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i;
    } else {
      for (let i = from; i < b.length; i++) if (b[i] === 0) return i;
    }
    return b.length;
  }

  async function readTags(file) {
    const out = {};
    try {
      const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
      if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return out;
      const ver = head[3];
      const size = synchsafe(head, 6);
      const b = new Uint8Array(await file.slice(10, 10 + Math.min(size, 6 * 1024 * 1024)).arrayBuffer());
      let p = 0;
      if (head[5] & 0x40) p += ver === 4 ? synchsafe(b, 0) : u32(b, 0) + 4; // erweiterter Header
      const idLen = ver === 2 ? 3 : 4;
      const hdrLen = ver === 2 ? 6 : 10;
      while (p + hdrLen < b.length) {
        const id = String.fromCharCode.apply(null, b.subarray(p, p + idLen));
        if (!/^[A-Z0-9]+$/.test(id)) break;
        let fsize;
        if (ver === 2) fsize = (b[p + 3] << 16) | (b[p + 4] << 8) | b[p + 5];
        else if (ver === 4) fsize = synchsafe(b, p + 4);
        else fsize = u32(b, p + 4);
        const data = b.subarray(p + hdrLen, p + hdrLen + fsize);
        p += hdrLen + fsize;
        if (!fsize) continue;
        const key = id;
        if (key === "TIT2" || key === "TT2") out.title = clean(decodeText(data.subarray(1), data[0]));
        else if (key === "TPE1" || key === "TP1") out.artist = clean(decodeText(data.subarray(1), data[0]));
        else if (key === "TALB" || key === "TAL") out.album = clean(decodeText(data.subarray(1), data[0]));
        else if ((key === "APIC" || key === "PIC") && !out.cover) {
          const enc = data[0];
          let q = 1, mime;
          if (key === "PIC") { mime = "image/" + String.fromCharCode(data[1], data[2], data[3]).toLowerCase().replace("jpg", "jpeg"); q = 4; }
          else { const e = findTerminator(data, 1, 0); mime = decodeText(data.subarray(1, e), 0) || "image/jpeg"; q = e + 1; }
          q += 1; // Bildtyp
          const d = findTerminator(data, q, enc);
          q = d + (enc === 1 || enc === 2 ? 2 : 1);
          if (!/^image\//.test(mime)) mime = "image/" + mime;
          out.cover = new Blob([data.slice(q)], { type: mime });
        }
      }
    } catch (e) { /* Tags sind optional */ }
    return out;
  }

  function probeDuration(blob) {
    return new Promise((resolve) => {
      const a = document.createElement("audio");
      const url = URL.createObjectURL(blob);
      let done = false;
      const finish = (d) => { if (done) return; done = true; URL.revokeObjectURL(url); a.removeAttribute("src"); resolve(isFinite(d) ? d : 0); };
      a.preload = "metadata";
      a.onloadedmetadata = () => finish(a.duration);
      a.onerror = () => finish(0);
      setTimeout(() => finish(0), 8000);
      a.src = url;
    });
  }

  function fromFilename(name) {
    const base = name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/_/g, " ").replace(/^\d{1,3}[\s.\-]+/, "").trim();
    const m = base.split(/\s+[-–]\s+/);
    if (m.length >= 2) return { artist: m[0].trim(), title: m.slice(1).join(" – ").trim() };
    return { title: base };
  }

  async function importFile(file) {
    const tags = await readTags(file);
    const guess = fromFilename(file.name);
    const duration = await probeDuration(file);
    const rec = {
      title: tags.title || guess.title || "Unbekanntes Lied",
      artist: tags.artist || guess.artist || "",
      album: tags.album || "",
      cover: tags.cover || null,
      duration,
      blob: file,
      type: file.type || "audio/mpeg",
      added: Date.now()
    };
    try { rec.id = await add(rec); }
    catch (e) { rec.id = "tmp-" + Date.now() + "-" + Math.random().toString(36).slice(2); rec.temp = true; }
    return rec;
  }

  async function usage() {
    try {
      if (navigator.storage && navigator.storage.estimate) return (await navigator.storage.estimate()).usage || 0;
    } catch (e) {}
    return 0;
  }

  function persist() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  }

  window.Store = { all, add, remove, importFile, usage, persist, readTags };
})();
