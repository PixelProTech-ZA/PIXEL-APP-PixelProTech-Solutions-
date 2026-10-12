/* PixelProTech Pixel App — app.js
   Boot sequence and wiring: engine events → canvas / panels / inspector / top bar, autosave with honest failure
   reporting, project file import/export, keyboard shortcuts, install prompt, and service-worker status. */
(function () {
  'use strict';
  const PX = (window.PX = window.PX || {});
  const E = PX.Engine, S = PX.Storage;
  const $ = (id) => document.getElementById(id);
  const VERSION = '0.1.0';
  const BP_LABEL = { base: 'Desktop', tablet: 'Tablet ≤900', mobile: 'Mobile ≤600' };

  const App = (PX.App = { VERSION, report: null, swStatus: { text: 'Starting…' }, session: { state: 'clean' } });
  let suppress = false, timer = null, saving = false, dirty = false, lastSavedAt = 0, failToast = null, reg = null, updateRequested = false, deferredInstall = null, errCount = 0;

  /* ---------- pills ---------- */
  function pill(id, text, cls) { const p = $(id); if (!p) return; p.className = 'pill' + (cls ? ' ' + cls : ''); p.lastElementChild.textContent = text; }
  const setSave = (t, c) => pill('stSave', t, c);

  /* ---------- top bar ---------- */
  function updateTop() {
    const has = !!E.project;
    document.body.classList.toggle('has-project', has);
    ['projName', 'pageSel', 'btnPreflight', 'btnExport'].forEach((id) => { $(id).disabled = !has; });
    const nm = $('projName'); if (has && document.activeElement !== nm) nm.value = E.project.name;
    const ps = $('pageSel'); ps.innerHTML = '';
    if (has) { E.project.pages.forEach((p) => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.title || p.slug; ps.appendChild(o); }); ps.value = E.pageId || E.project.pages[0].id; }
    $('btnUndo').disabled = !E.canUndo(); $('btnRedo').disabled = !E.canRedo();
    document.querySelectorAll('#bpSeg .segb').forEach((b) => { const on = b.dataset.bp === E.bp; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    updateBadge();
  }
  function updateHist() { $('btnUndo').disabled = !E.canUndo(); $('btnRedo').disabled = !E.canRedo(); }
  function setReport(rep, rev) { App.report = { rep, rev }; updateBadge(); }
  function updateBadge() {
    const b = $('pfBadge'); if (!App.report) { b.classList.add('hidden'); return; }
    const s = App.report.rep.summary; b.classList.remove('hidden');
    b.textContent = s.issues ? String(s.issues) : (s.nt ? 'NT' : 'OK');
    b.className = 'badge' + (s.issues ? '' : ' ok') + (App.report.rev !== E.rev ? ' stale' : '');
    b.title = (App.report.rev !== E.rev ? 'Project changed since this run — run Preflight again. ' : '') + s.issues + ' issue item(s), ' + s.nt + ' not testable';
  }
  function updateVp() {
    const w = PX.Canvas.width(), sc = PX.Canvas.scale(); let t = `${w} px layout` + (sc < 1 ? ` · shown at ${Math.round(sc * 100)}%` : '') + ` · editing ${BP_LABEL[E.bp]}`;
    $('vpInfo').textContent = E.project ? t : '';
  }
  function drawRuler() {
    const r = $('ruler'), fb = $('frameBox'); r.innerHTML = ''; if (!E.project) return;
    const off = fb.getBoundingClientRect().left - r.getBoundingClientRect().left, w = PX.Canvas.width(), sc = PX.Canvas.scale();
    const marks = [[900, 'TABLET ≤900'], [600, 'MOBILE ≤600']].filter(([bp]) => bp <= w);
    for (let x = 0; x <= w; x += 50) {
      const t = document.createElement('span'); t.className = 'rt' + (x % 100 ? ' minor' : ''); t.style.left = off + x * sc + 'px';
      if (!(x % 100) && !marks.some(([bp]) => bp === x)) t.textContent = x; r.appendChild(t);
    }
    marks.forEach(([bp, l]) => { const t = document.createElement('span'); t.className = 'rt'; t.style.left = off + bp * sc + 'px'; t.style.borderColor = 'var(--accent)'; t.style.color = 'var(--accent)'; t.textContent = l; r.appendChild(t); });
  }
  const afterLayout = () => { updateVp(); drawRuler(); };
  PX.onCanvasResize = afterLayout;

  /* ---------- inspector / hooks ---------- */
  const hooks = { refresh: () => renderInspector(), confirm: (m, y) => PX.UI.confirm(m, y, 'Delete') };
  function renderInspector() { if (E.project) PX.Inspector.render($('inspector'), hooks); else $('inspector').innerHTML = ''; }

  function fullRefresh() {
    updateTop(); PX.Canvas.setWidth(E.bp); PX.Canvas.renderAll(); PX.Panels.render(); renderInspector(); PX.Panels.crumbs(); setTimeout(afterLayout, 60);
  }

  /* ---------- engine events ---------- */
  E.on((ev) => {
    const t = ev.type;
    if (t !== 'select' && t !== 'bp' && t !== 'load' && t !== 'page' && !suppress) markDirty();
    switch (t) {
      case 'load': fullRefresh(); break;
      case 'select':
        PX.Canvas.queueOverlay(); if (ev.id && !PX.Canvas.isPick()) PX.Canvas.reveal(ev.id);
        PX.Panels.expandToSelection(); PX.Panels.renderSoon(); PX.Panels.crumbs(); renderInspector(); break;
      case 'bp': PX.Canvas.setWidth(ev.bp); renderInspector(); updateTop(); setTimeout(afterLayout, 220); break;
      case 'prop': PX.Canvas.refreshCss(); PX.Canvas.patchNode(ev.id); PX.Panels.renderSoon(); PX.Panels.crumbs(); if (ev.origin !== 'inspector' && ev.origin !== 'canvas') renderInspector(); break;
      case 'style': PX.Canvas.refreshCss(); if (ev.origin !== 'inspector') renderInspector(); break;
      case 'tokens': PX.Canvas.refreshCss(); if (ev.origin !== 'inspector') renderInspector(); break;
      case 'site': updateTop(); break;
      case 'pages':
        updateTop(); PX.Panels.render();
        if (ev.origin !== 'inspector') { PX.Canvas.renderAll(); renderInspector(); PX.Panels.crumbs(); }
        break;
      case 'page': updateTop(); PX.Canvas.renderAll(); PX.Panels.render(); renderInspector(); PX.Panels.crumbs(); break;
      case 'structure': case 'history': PX.Canvas.renderAll(); updateTop(); PX.Panels.render(); renderInspector(); PX.Panels.crumbs(); break;
      case 'assets': PX.Canvas.renderAll(); break;
      default: break;
    }
    updateHist(); updateBadge();
  });

  /* ---------- autosave ---------- */
  function markDirty() {
    if (!E.project) return;
    dirty = true; setSave('UNSAVED', 'warn');
    clearTimeout(timer); timer = setTimeout(flush, 700);
  }
  async function flush() {
    clearTimeout(timer);
    if (!E.project || !dirty) return;
    if (saving) { timer = setTimeout(flush, 250); return; }
    saving = true; setSave('SAVING…', 'warn');
    const rev = E.rev;
    try {
      const rec = { id: E.project.id, project: PX.clone(E.project), assets: E.assets };
      const r = await S.saveProject(rec);
      await S.setMeta('lastProject', E.project.id);
      lastSavedAt = Date.now();
      if (failToast) { failToast.remove(); failToast = null; }
      dirty = E.rev !== rev;
      if (!dirty) setSave(r.volatile ? 'MEMORY ONLY' : 'SAVED ' + new Date(lastSavedAt).toTimeString().slice(0, 5), r.volatile ? 'warn' : 'ok');
    } catch (e) {
      setSave('SAVE FAILED', 'bad');
      const msg = e && e.quota ? 'Browser storage is full: your latest changes are NOT saved.' : 'Saving failed (' + (e && e.message || e) + '): your latest changes are NOT saved.';
      if (!failToast || !failToast.isConnected) failToast = PX.UI.toast(msg + ' Download a project file now.', 'bad', { sticky: true, action: { label: 'Project files', run: () => PX.Dialogs.projects('files') } });
      dirty = true;
    } finally {
      saving = false;
      if (dirty && !(document.getElementById('stSave').classList.contains('bad'))) timer = setTimeout(flush, 300);
    }
  }
  App.markDirty = markDirty;
  App.flush = flush;
  App.setReport = setReport;

  window.addEventListener('beforeunload', (e) => { if (dirty || saving) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', () => { flush(); });

  /* ---------- project operations ---------- */
  App.newProject = function (cat, tplId) {
    const r = E.newFromTemplate(cat, tplId);
    if (!r.ok) { PX.UI.toast('Could not create the project: ' + (r.errors || []).join('; '), 'bad'); return; }
    App.report = null; updateBadge(); markDirty(); PX.Panels.setTab('add');
    PX.UI.toast('New project created and saved automatically as you edit.');
  };
  App.openSaved = async function (id) {
    let rec; try { rec = await S.loadProject(id); } catch (e) { PX.UI.toast('Could not read that project: ' + (e && e.message || e), 'bad'); return; }
    if (!rec) { PX.UI.toast('That project is no longer stored in this browser.', 'bad'); return; }
    if (E.project) await flush();
    suppress = true; const r = E.load(rec.project, rec.assets); suppress = false;
    if (!r.ok) { PX.UI.toast('That project could not be opened: ' + r.errors.join('; '), 'bad', { sticky: true }); return; }
    App.report = null; dirty = false; await S.setMeta('lastProject', E.project.id).catch(() => {}); setSave('SAVED ' + new Date(rec.updated).toTimeString().slice(0, 5), 'ok'); updateBadge();
    PX.UI.toast(r.warnings.length ? 'Opened with ' + r.warnings.length + ' repair note(s): ' + r.warnings[0] : 'Opened “' + E.project.name + '”.', r.warnings.length ? 'warn' : '');
  };
  App.downloadProjectFile = function () {
    if (!E.project) return;
    try {
      const blob = new Blob([S.toFile(E.project, E.assets)], { type: 'application/json' });
      PX.Exporter.download(blob, (PX.Exporter.safeName(E.project.name) || 'project') + '.pixelapp.json');
      PX.UI.toast('Project file download started. Your browser decides where it is saved.');
    } catch (e) { PX.UI.toast('Could not create the project file: ' + (e && e.message || e), 'bad'); }
  };
  App.importProjectFile = async function (file) {
    let text; try { text = await file.text(); } catch (e) { return { ok: false, error: 'Could not read that file.' }; }
    const r = S.fromFile(text); if (!r.ok) return r;
    if (E.project) await flush();
    const obj = r.project; if (obj && typeof obj === 'object') obj.id = 'p' + PX.uid();
    const v = E.load(obj, r.assets);
    if (!v.ok) return { ok: false, error: 'Project file is damaged: ' + v.errors.join('; ') };
    App.report = null; updateBadge(); markDirty();
    PX.UI.toast(v.warnings.length ? 'Imported with ' + v.warnings.length + ' repair note(s): ' + v.warnings[0] : 'Project file opened as a new project.', v.warnings.length ? 'warn' : '');
    return { ok: true };
  };

  /* ---------- keyboard ---------- */
  function onKey(e) {
    if (!E.project || $('dlg').open) return;
    const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const mod = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
    if (typing) return;
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? E.redo() : E.undo(); }
    else if (mod && k === 'y') { e.preventDefault(); E.redo(); }
    else if (mod && k === 'd') { e.preventDefault(); if (E.selectedId) E.duplicateNode(E.selectedId); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { if (E.selectedId) { e.preventDefault(); E.deleteNode(E.selectedId); } }
    else if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); if (E.selectedId) E.moveBy(E.selectedId, -1); }
    else if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); if (E.selectedId) E.moveBy(E.selectedId, 1); }
    else if (e.key === 'Escape') { const f = E.selectedId && E.find(E.selectedId); if (f) E.select(f.parent ? f.parent.id : null); }
  }
  document.addEventListener('keydown', onKey);
  PX.onCanvasKey = onKey;

  /* ---------- install + service worker ---------- */
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; $('btnInstall').classList.remove('hidden'); });
  window.addEventListener('appinstalled', () => { deferredInstall = null; $('btnInstall').classList.add('hidden'); PX.UI.toast('Pixel App was installed.'); });
  $('btnInstall').addEventListener('click', async () => { if (!deferredInstall) return; deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch (e) { /* ignore */ } deferredInstall = null; $('btnInstall').classList.add('hidden'); });

  function swQuery() {
    return navigator.serviceWorker.ready.then((r) => new Promise((res) => {
      if (!r.active) return res(null);
      const ch = new MessageChannel(), to = setTimeout(() => res(null), 3000);
      ch.port1.onmessage = (ev) => { clearTimeout(to); res(ev.data); };
      r.active.postMessage({ type: 'STATUS' }, [ch.port2]);
    }));
  }
  async function refreshSw() {
    const d = await swQuery();
    if (!d) { App.swStatus = { ok: false, text: 'Worker active, status not reported' }; pill('stSw', 'SHELL ?', 'warn'); return; }
    if (d.cached === d.expected) { App.swStatus = { ok: true, text: `Offline-ready — all ${d.expected} shell files cached`, version: d.version, cached: d.cached, expected: d.expected }; pill('stSw', 'OFFLINE READY', 'ok'); }
    else { App.swStatus = { ok: false, text: `Partial — ${d.cached}/${d.expected} shell files cached`, version: d.version, cached: d.cached, expected: d.expected }; pill('stSw', 'SHELL PARTIAL', 'warn'); }
  }
  function announceUpdate() {
    PX.UI.toast('A new version of Pixel App is ready. Your work is saved automatically.', '', { sticky: true, action: { label: 'Reload now', run: async () => { await flush(); updateRequested = true; if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } } });
  }
  async function initSw() {
    if (!('serviceWorker' in navigator)) { App.swStatus = { ok: false, text: 'Not supported in this browser' }; pill('stSw', 'SHELL N/A', 'warn'); return; }
    if (!window.isSecureContext) { App.swStatus = { ok: false, text: 'Unavailable — page is not served over HTTPS or localhost' }; pill('stSw', 'SHELL N/A', 'warn'); return; }
    try { reg = await navigator.serviceWorker.register('./sw.js'); }
    catch (e) { App.swStatus = { ok: false, text: 'Registration failed: ' + (e && e.message || e) }; pill('stSw', 'SHELL FAILED', 'bad'); return; }
    pill('stSw', 'CACHING…', 'warn');
    if (reg.waiting && navigator.serviceWorker.controller) announceUpdate();
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing; if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) announceUpdate();
        if (nw.state === 'redundant' && !navigator.serviceWorker.controller) { App.swStatus = { ok: false, text: 'Install failed — a shell file could not be cached' }; pill('stSw', 'SHELL FAILED', 'bad'); }
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (updateRequested) location.reload(); else refreshSw(); });
    refreshSw();
  }
  App.checkUpdate = async function () {
    if (!reg) return 'No service worker is registered in this context.';
    try { await reg.update(); } catch (e) { return 'Update check failed: ' + (e && e.message || e); }
    if (reg.waiting) { announceUpdate(); return 'A new version is ready (see the notice).'; }
    return 'The browser found no newer version.';
  };
  function netPill() { pill('stNet', navigator.onLine ? 'ONLINE' : 'OFFLINE', navigator.onLine ? 'ok' : 'warn'); $('stNet').title = navigator.onLine ? 'Network reachable' : 'Offline — editing and local saving continue to work'; }
  window.addEventListener('online', netPill); window.addEventListener('offline', netPill);

  /* ---------- wiring ---------- */
  function wire() {
    $('btnUndo').addEventListener('click', () => E.undo()); $('btnRedo').addEventListener('click', () => E.redo());
    document.querySelectorAll('#bpSeg .segb').forEach((b) => b.addEventListener('click', () => { if (E.project) E.setBp(b.dataset.bp); }));
    $('projName').addEventListener('input', (e) => { if (E.project) E.setSite('name', e.target.value); });
    $('projName').addEventListener('blur', (e) => { if (E.project && !e.target.value.trim()) { E.setSite('name', 'Untitled site'); e.target.value = 'Untitled site'; } });
    $('pageSel').addEventListener('change', (e) => E.setPage(e.target.value));
    document.querySelectorAll('#left .tab').forEach((b) => b.addEventListener('click', () => PX.Panels.setTab(b.dataset.tab)));
    $('btnProjects').addEventListener('click', () => PX.Dialogs.projects());
    $('btnStart').addEventListener('click', () => PX.Dialogs.projects('new'));
    $('btnPreflight').addEventListener('click', () => PX.Dialogs.preflight());
    $('btnExport').addEventListener('click', () => PX.Dialogs.exportSite());
    $('btnSettings').addEventListener('click', () => PX.Dialogs.settings());
    const app = $('app');
    $('btnLeft').addEventListener('click', () => { app.classList.toggle('show-left'); app.classList.remove('show-right'); });
    $('btnRight').addEventListener('click', () => { app.classList.toggle('show-right'); app.classList.remove('show-left'); });
    if (window.innerWidth <= 980) app.classList.remove('show-left', 'show-right');
    window.addEventListener('resize', () => { PX.Canvas.setWidth(E.bp); updateVp(); drawRuler(); });
    $('frameBox').addEventListener('transitionend', afterLayout);
    $('stage').addEventListener('click', (e) => { if (window.innerWidth <= 980 && (e.target.id === 'stage' || e.target.id === 'frameWrap')) { app.classList.remove('show-left', 'show-right'); } });
    window.addEventListener('error', (e) => { if (errCount++ < 3) PX.UI.toast('Unexpected error: ' + (e.message || 'unknown') + '. Your last saved state is safe; export a project file if this repeats.', 'bad'); });
    window.addEventListener('unhandledrejection', (e) => { if (errCount++ < 3) PX.UI.toast('Unexpected error: ' + (e.reason && e.reason.message || e.reason || 'unknown'), 'bad'); });
  }

  /* ---------- boot ---------- */
  async function boot() {
    wire(); netPill(); pill('stSave', 'NO PROJECT');
    PX.Panels.init($('leftBody'), { confirm: hooks.confirm, getDrag: PX.Canvas.getDrag });
    PX.onDragEnd = () => PX.Panels.clearMarks();
    await PX.Canvas.init($('canvas'));
    updateTop(); PX.Panels.render();
    const init = await S.init();
    if (init.mode !== 'indexeddb') PX.UI.toast('Persistent storage is not available here (' + (init.error || 'unknown reason') + '). Projects live in memory only; download project files to keep your work.', 'warn', { sticky: true });
    App.session = S.beginSession();
    if (App.session.state === 'other-tab') PX.UI.toast('Pixel App seems to be open in another tab. Editing the same project in two tabs can overwrite changes.', 'warn', { sticky: true });
    let opened = false;
    try {
      const last = await S.getMeta('lastProject'); const rec = last ? await S.loadProject(last) : null;
      if (rec) {
        suppress = true; const r = E.load(rec.project, rec.assets); suppress = false;
        if (r.ok) {
          opened = true; dirty = false; setSave('SAVED ' + new Date(rec.updated).toTimeString().slice(0, 5), init.mode === 'indexeddb' ? 'ok' : 'warn'); updateTop();
          if (App.session.state === 'interrupted') PX.UI.toast('The last session ended without closing. Restored the last saved state from ' + new Date(rec.updated).toLocaleTimeString() + '; edits after that time may be missing.', 'warn', { sticky: true });
          else if (r.warnings.length) PX.UI.toast('Project opened with ' + r.warnings.length + ' repair note(s): ' + r.warnings[0], 'warn');
        } else PX.UI.toast('The last project could not be opened: ' + r.errors.join('; '), 'bad', { sticky: true });
      }
    } catch (e) { PX.UI.toast('Could not restore the last project: ' + (e && e.message || e), 'bad', { sticky: true }); }
    if (!opened) PX.Dialogs.projects('new');
    initSw();
    document.documentElement.setAttribute('data-ready', '1');
  }
  boot();
})();
