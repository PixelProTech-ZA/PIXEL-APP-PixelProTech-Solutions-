/* PixelProTech Pixel App — storage.js
   Local persistence (IndexedDB) with explicit failure reporting, project import/export files,
   and interrupted-session detection. Browser storage is never assumed to be permanent or unlimited. */
(function () {
  'use strict';
  const PX = (window.PX = window.PX || {});
  const DB = 'pixelprotech-pixel-app', VER = 1, FORMAT = 'pixelprotech-pixel-app-project';
  let db = null, mode = 'none', initError = null;
  const mem = new Map(); const memMeta = {};
  const tabId = Math.random().toString(36).slice(2, 10);
  let hb = null;

  const isQuota = (e) => !!e && (e.name === 'QuotaExceededError' || e.code === 22 || /quota/i.test(String(e.message || '')));
  function openDb() {
    return new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('IndexedDB is not available in this browser context'));
      let r; try { r = indexedDB.open(DB, VER); } catch (e) { return rej(e); }
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' }); if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta'); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('Could not open database')); r.onblocked = () => rej(new Error('Database open was blocked by another tab'));
    });
  }
  function tx(store, rw, fn) {
    return new Promise((res, rej) => {
      let t; try { t = db.transaction(store, rw ? 'readwrite' : 'readonly'); } catch (e) { return rej(e); }
      let out; const st = t.objectStore(store);
      try { out = fn(st); } catch (e) { return rej(e); }
      t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
      t.onerror = () => rej(t.error || (out && out.error) || new Error('Transaction failed'));
      t.onabort = () => rej(t.error || new Error('Transaction aborted'));
    });
  }
  async function init() {
    try { db = await openDb(); mode = 'indexeddb'; }
    catch (e) { initError = e; mode = 'memory'; }
    return { mode, error: initError && String(initError.message || initError) };
  }
  async function saveProject(rec) {
    rec.updated = Date.now();
    if (mode !== 'indexeddb') { mem.set(rec.id, PX.clone(rec)); return { ok: true, volatile: true }; }
    try { await tx('projects', true, (s) => s.put(rec)); return { ok: true }; }
    catch (e) { const err = new Error(isQuota(e) ? 'Storage quota exceeded' : String(e && e.message || e)); err.quota = isQuota(e); throw err; }
  }
  async function loadProject(id) {
    if (mode !== 'indexeddb') return mem.get(id) || null;
    return (await tx('projects', false, (s) => s.get(id))) || null;
  }
  async function listProjects() {
    if (mode !== 'indexeddb') return [...mem.values()].map(summary);
    return new Promise((res, rej) => {
      const out = []; const t = db.transaction('projects', 'readonly'); const c = t.objectStore('projects').openCursor();
      c.onsuccess = () => { const cur = c.result; if (cur) { out.push(summary(cur.value)); cur.continue(); } };
      t.oncomplete = () => res(out.sort((a, b) => b.updated - a.updated)); t.onerror = () => rej(t.error);
    });
  }
  const summary = (r) => ({ id: r.id, name: r.project && r.project.name, updated: r.updated, pages: r.project && r.project.pages.length, category: r.project && r.project.category, bytes: r.assets ? Object.values(r.assets).reduce((a, x) => a + (x.size || 0), 0) : 0 });
  async function deleteProject(id) { if (mode !== 'indexeddb') { mem.delete(id); return; } await tx('projects', true, (s) => s.delete(id)); }
  async function getMeta(k) { if (mode !== 'indexeddb') return memMeta[k]; return tx('meta', false, (s) => s.get(k)); }
  async function setMeta(k, v) { if (mode !== 'indexeddb') { memMeta[k] = v; return; } await tx('meta', true, (s) => s.put(v, k)); }

  async function estimate() {
    try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); return { usage: e.usage, quota: e.quota }; } } catch (e) { /* ignore */ }
    return null;
  }
  async function persisted() { try { return navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch (e) { return null; } }
  async function requestPersist() { try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : null; } catch (e) { return null; } }

  /* ---- project file (export/import) ---- */
  function toFile(project, assets) { return JSON.stringify({ format: FORMAT, version: 1, savedAt: new Date().toISOString(), project, assets }); }
  function fromFile(text) {
    let o; try { o = JSON.parse(text); } catch (e) { return { ok: false, error: 'This file is not valid JSON.' }; }
    if (!o || o.format !== FORMAT) return { ok: false, error: 'This is not a Pixel App project file.' };
    if (o.version !== 1) return { ok: false, error: 'Unsupported project file version ' + o.version };
    return { ok: true, project: o.project, assets: o.assets || {} };
  }

  /* ---- session / interrupted-session detection (localStorage heartbeat; best effort) ---- */
  const KEY = 'pixelapp.session';
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const lsSet = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch (e) { return false; } };
  function beginSession() {
    const prev = lsGet(); const now = Date.now(); let state = 'clean';
    if (prev && prev.open) state = now - prev.beat < 20000 && prev.tab !== tabId ? 'other-tab' : 'interrupted';
    lsSet({ tab: tabId, open: true, beat: now });
    hb = setInterval(() => { const cur = lsGet(); if (!cur || cur.tab === tabId || !cur.open) lsSet({ tab: tabId, open: true, beat: Date.now() }); }, 5000);
    const close = () => { const cur = lsGet(); if (cur && cur.tab === tabId) lsSet({ tab: tabId, open: false, beat: Date.now() }); };
    window.addEventListener('pagehide', close);
    return { state, prevBeat: prev && prev.beat };
  }

  PX.Storage = { init, saveProject, loadProject, listProjects, deleteProject, getMeta, setMeta, estimate, persisted, requestPersist, toFile, fromFile, beginSession, isQuota, get mode() { return mode; }, FORMAT };
})();
