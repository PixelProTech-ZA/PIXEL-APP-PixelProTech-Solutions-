/* PixelProTech Pixel App — dialogs.js
   Toasts, modal dialog and confirm helpers (PX.UI) plus the four working dialogs (PX.Dialogs):
   Projects (templates / saved / files), Pixel Preflight report, Export, Settings & diagnostics.
   No dialog reports success before the underlying operation has actually succeeded. */
(function () {
  'use strict';
  const PX = (window.PX = window.PX || {});
  const E = () => PX.Engine;
  const el = (...a) => PX.el(...a);
  const kb = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : b + ' B');
  const clock = (t) => new Date(t).toTimeString().slice(0, 5);
  const when = (t) => { const d = new Date(t); return d.toLocaleDateString() + ' ' + clock(t); };

  /* ---------- toast ---------- */
  function toast(msg, kind, opts) {
    const host = document.getElementById('toasts'); if (!host) return null;
    opts = opts || {};
    const t = el('div', { class: 'toast' + (kind ? ' ' + kind : ''), role: kind === 'bad' ? 'alert' : 'status' }, el('span', { text: msg }));
    if (opts.action) t.appendChild(el('button', { type: 'button', class: 'btn small', text: opts.action.label, onclick: () => { t.remove(); opts.action.run(); } }));
    t.appendChild(PX.iconBtn('i-close', 'Dismiss', () => t.remove(), 'sm'));
    host.appendChild(t);
    if (!opts.sticky) setTimeout(() => t.remove(), opts.ms || (kind === 'bad' || kind === 'warn' ? 7000 : 3800));
    return t;
  }

  /* ---------- dialog ---------- */
  function dialog(title, body, opts) {
    opts = opts || {};
    const dlg = document.getElementById('dlg');
    if (dlg.open) dlg.close();
    dlg.className = opts.narrow ? 'narrow' : '';
    dlg.innerHTML = '';
    dlg.appendChild(el('div', { class: 'dh' }, el('h2', { id: 'dlgTitle', html: '<span>▪</span> ' + PX.esc(title) }), PX.iconBtn('i-close', 'Close', () => dlg.close())));
    const db = el('div', { class: 'db' }); db.appendChild(body); dlg.appendChild(db);
    dlg.onclick = (e) => { if (e.target === dlg) dlg.close(); };
    dlg.onclose = () => { if (opts.onClose) opts.onClose(); };
    dlg.showModal();
    return { close: () => dlg.close(), body: db, dlg };
  }
  function confirmBox(message, onYes, yesLabel) {
    const body = el('div', null, el('p', { text: message }));
    const h = dialog('Please confirm', body, { narrow: true });
    body.appendChild(el('div', { class: 'row' },
      el('button', { type: 'button', class: 'btn danger', text: yesLabel || 'Confirm', onclick: () => { h.close(); onYes(); } }),
      el('button', { type: 'button', class: 'btn', text: 'Cancel', onclick: () => h.close() })));
    return h;
  }
  PX.UI = { toast, dialog, confirm: confirmBox };

  /* ---------- Projects: New / Saved / Files ---------- */
  function projects(startTab) {
    let tab = startTab || (E().project ? 'saved' : 'new'), cat = 'business';
    const body = el('div'); const h = dialog('Projects', body);
    const draw = async () => {
      body.innerHTML = '';
      const tabs = el('div', { class: 'dtabs', role: 'tablist' });
      [['new', 'New project'], ['saved', 'Saved in this browser'], ['files', 'Project files']].forEach(([k, l]) => tabs.appendChild(el('button', { type: 'button', role: 'tab', class: 'dtab' + (tab === k ? ' on' : ''), 'aria-selected': String(tab === k), text: l, onclick: () => { tab = k; draw(); } })));
      body.appendChild(tabs);
      if (tab === 'new') drawNew(); else if (tab === 'saved') await drawSaved(); else drawFiles();
    };

    function drawNew() {
      const cats = el('div', { class: 'cats' });
      PX.Blueprints.categories.forEach((c) => {
        const ready = c.status === 'ready';
        const b = el('button', { type: 'button', class: 'cat' + (cat === c.id ? ' on' : ''), disabled: ready ? null : true, title: ready ? c.summary : 'Planned — not built yet, so it is not offered.', html: PX.esc(c.name) + '<small>' + (ready ? c.templates.length + ' templates' : 'planned') + '</small>' });
        if (ready) b.addEventListener('click', () => { cat = c.id; draw(); });
        cats.appendChild(b);
      });
      body.appendChild(cats);
      const c = PX.Blueprints.get(cat);
      body.appendChild(el('p', { class: 'note', text: c.summary + ' Contact links are left empty on purpose: Pixel Preflight will report them until you enter your real details.' }));
      const grid = el('div', { class: 'tgrid' });
      c.templates.forEach((t) => {
        let sch = ''; try { sch = PX.schematic(t.build()); } catch (e) { sch = ''; }
        const card = el('button', { type: 'button', class: 'tcard', 'aria-label': 'Start from ' + t.name, html: '<div class="sch">' + sch + '</div><div class="tb"><b>' + PX.esc(t.name) + '</b><div class="pitch">' + PX.esc(t.pitch) + '</div><p>' + PX.esc(t.structure) + '</p><p><i>Responsive:</i> ' + PX.esc(t.responsive) + '</p></div>' });
        card.addEventListener('click', () => { h.close(); PX.App.newProject(cat, t.id); });
        grid.appendChild(card);
      });
      body.appendChild(grid);
      body.appendChild(el('p', { class: 'hintline', text: 'The preview above is drawn from the template’s real component tree, not an image. Starting a new project never overwrites the project you have open; both stay in “Saved in this browser”.' }));
    }

    async function drawSaved() {
      let list = [];
      try { list = await PX.Storage.listProjects(); } catch (e) { body.appendChild(el('p', { class: 'note bad', text: 'Could not read saved projects: ' + (e && e.message || e) })); return; }
      if (PX.Storage.mode !== 'indexeddb') body.appendChild(el('p', { class: 'note warn', text: 'This browser context does not allow persistent storage, so projects are kept in memory only and vanish when the tab closes. Use Project files to keep your work.' }));
      if (!list.length) { body.appendChild(el('p', { class: 'note', text: 'No projects saved in this browser yet.' })); return; }
      const wrap = el('div', { class: 'plist' });
      list.forEach((p) => {
        const isCur = E().project && E().project.id === p.id;
        const row = el('div', { class: 'prec' }, el('div', { class: 'pi' }, el('b', { text: (p.name || 'Untitled') + (isCur ? '  · open' : '') }), el('small', { text: `${p.pages || 0} page(s) · ${p.category || ''} · saved ${when(p.updated)} · images ${kb(p.bytes || 0)}` })));
        row.appendChild(el('button', { type: 'button', class: 'btn small', text: isCur ? 'Open again' : 'Open', onclick: async () => { h.close(); await PX.App.openSaved(p.id); } }));
        row.appendChild(PX.iconBtn('i-trash', 'Delete saved project "' + (p.name || 'Untitled') + '"', () => confirmBox(`Permanently delete "${p.name || 'Untitled'}" from this browser? Export a project file first if you may need it.`, async () => { try { await PX.Storage.deleteProject(p.id); toast('Deleted from this browser.'); if (isCur) PX.App.markDirty(); } catch (e) { toast('Delete failed: ' + (e && e.message || e), 'bad'); } projects('saved'); }, 'Delete'), 'sm danger'));
        wrap.appendChild(row);
      });
      body.appendChild(wrap);
    }

    function drawFiles() {
      body.appendChild(el('p', { class: 'note warn', text: 'Browsers can clear site storage (low disk space, privacy settings, “clear data”). A project file is the only backup you control. Save one before big changes and before closing a device you do not own.' }));
      const ex = el('button', { type: 'button', class: 'btn primary', html: PX.icon('i-export') + '<span>Download project file</span>', disabled: E().project ? null : true, onclick: () => PX.App.downloadProjectFile() });
      const inp = el('input', { type: 'file', accept: '.json,application/json,.pixelapp', class: 'hidden', 'aria-label': 'Choose a project file' });
      const msg = el('div', { class: 'hint' });
      inp.addEventListener('change', async () => {
        const f = inp.files[0]; if (!f) return;
        msg.className = 'hint'; msg.textContent = 'Reading…';
        const r = await PX.App.importProjectFile(f);
        if (r.ok) h.close(); else { msg.className = 'hint bad'; msg.textContent = r.error; }
      });
      const im = el('button', { type: 'button', class: 'btn', html: PX.icon('i-import') + '<span>Open a project file…</span>', onclick: () => inp.click() });
      body.appendChild(el('div', { class: 'row' }, ex, im, inp)); body.appendChild(msg);
      body.appendChild(el('p', { class: 'hintline', text: 'The project file contains your pages, design tokens and every image you added. Opening one creates a separate project in this browser; nothing is overwritten.' }));
    }
    draw(); return h;
  }

  /* ---------- Preflight ---------- */
  function jumpTo(it, h) {
    if (!it.pageId && !it.nodeId) return;
    if (it.pageId && E().pageId !== it.pageId) E().setPage(it.pageId);
    if (it.nodeId) { E().select(it.nodeId); PX.Canvas.reveal(it.nodeId); }
    if (h) h.close();
  }
  function renderReport(body, rep, h) {
    body.innerHTML = '';
    const s = rep.summary;
    body.appendChild(el('div', { class: 'pfsum' },
      el('span', { class: 'chip PASS', text: s.pass + ' PASS' }),
      el('span', { class: 'chip ISSUE', text: s.issue + ' CHECK' + (s.issue === 1 ? '' : 'S') + ' WITH ISSUES (' + s.issues + ' item' + (s.issues === 1 ? '' : 's') + ')' }),
      el('span', { class: 'chip NT', text: s.nt + ' NOT TESTABLE' }),
      el('span', { class: 'hint', text: 'Run ' + clock(rep.at) + ' · ' + rep.total + ' checks' })));
    rep.results.forEach((r) => {
      const card = el('div', { class: 'pcheck' }, el('div', { class: 'pch' }, el('span', { class: 'id', text: r.id }), el('b', { text: r.title }), el('span', { class: 'chip ' + (r.state === 'NOT TESTABLE' ? 'NT' : r.state), text: r.state })), el('div', { class: 'pcov', text: 'Covers: ' + r.covers }));
      if (r.items.length) {
        const list = el('div', { class: 'pitems' });
        r.items.forEach((it) => {
          const row = el('div', { class: 'pit' + (it.kind === 'nt' ? ' nt' : '') }, el('span', { html: PX.icon('i-fault') }), el('div', { class: 'tx' }, el('div', { text: it.message }), el('div', { class: 'act', text: it.action })));
          if (it.nodeId || it.pageId) row.appendChild(el('button', { type: 'button', class: 'btn small', text: 'Show', onclick: () => jumpTo(it, h) }));
          list.appendChild(row);
        });
        card.appendChild(list);
      }
      body.appendChild(card);
    });
    body.appendChild(el('p', { class: 'note', text: 'PASS means only that this specific check found nothing. It is not a statement about accessibility, SEO, security or browser compatibility, which need testing this tool does not perform. External links are never contacted.' }));
    body.appendChild(el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn', text: 'Run again', onclick: () => preflight() })));
  }
  async function preflight() {
    if (!E().project) return;
    const body = el('div', null, el('p', { class: 'note', text: 'Running checks, including layout measurement at 375 px and 768 px…' }));
    const h = dialog('Pixel Preflight', body);
    PX.Canvas.endEdit();
    const rev = E().rev;
    const rep = await PX.Preflight.run(E().project, E().assets);
    PX.App.setReport(rep, rev);
    if (!h.dlg.open) return rep;
    renderReport(body, rep, h);
    return rep;
  }

  /* ---------- Export ---------- */
  function exportSite() {
    if (!E().project) return;
    PX.Canvas.endEdit();
    const body = el('div', null, el('p', { class: 'note', text: 'Building and verifying the website…' }));
    const h = dialog('Export website', body);
    setTimeout(() => {
      let r;
      try { r = PX.Exporter.exportSite(E().project, E().assets); } catch (e) { r = { ok: false, stage: 'generate', errors: ['Unexpected failure: ' + (e && e.message || e)], warnings: [] }; }
      body.innerHTML = '';
      if (!r.ok) {
        body.appendChild(el('p', { class: 'note bad', text: `Export FAILED at the “${r.stage}” stage. No download was produced.` }));
        const ul = el('div', { class: 'pitems' });
        (r.errors || []).forEach((m) => ul.appendChild(el('div', { class: 'pit' }, el('span', { html: PX.icon('i-fault') }), el('div', { class: 'tx', text: m }))));
        body.appendChild(ul);
        body.appendChild(el('p', { class: 'hintline', text: 'Run Pixel Preflight for the same problems with explanations and where to fix them.' }));
        body.appendChild(el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn', html: PX.icon('i-preflight') + '<span>Open Preflight</span>', onclick: () => preflight() })));
        return;
      }
      const total = r.files.reduce((a, f) => a + f.size, 0);
      const fresh = PX.App.report && PX.App.report.rev === E().rev;
      body.appendChild(el('p', { class: 'note ok', text: `Package built and verified: ${r.files.length} files, ${kb(total)}. Every local link, stylesheet, script and image reference resolves to a file inside the package.` }));
      if (r.warnings && r.warnings.length) body.appendChild(el('p', { class: 'note warn', text: r.warnings.join(' ') }));
      body.appendChild(el('dl', { class: 'kv' },
        el('dt', { text: 'Pixel Preflight' }), el('dd', { class: fresh && PX.App.report.rep.summary.issue === 0 ? 'y' : 'n', text: fresh ? (PX.App.report.rep.summary.issue === 0 ? 'No issues found in the last run' : PX.App.report.rep.summary.issues + ' issue item(s) in the last run — review before publishing') : 'Not run on this version of the project' }),
        el('dt', { text: 'Folder layout' }), el('dd', { text: 'Flat: every file sits next to index.html' })));
      const t = el('table', { class: 'flist' }); r.files.forEach((f) => t.appendChild(el('tr', null, el('td', { text: f.name }), el('td', { text: kb(f.size) })))); body.appendChild(t);
      const name = (PX.Exporter.safeName(E().project.name) || 'website') + '-site.zip';
      body.appendChild(el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn primary', html: PX.icon('i-export') + '<span>Download ' + PX.esc(name) + '</span>', onclick: () => { try { PX.Exporter.download(r.blob, name); toast('Download started. Your browser decides where the file is saved.'); } catch (e) { toast('Download failed: ' + (e && e.message || e), 'bad'); } } }),
        el('button', { type: 'button', class: 'btn', html: PX.icon('i-preflight') + '<span>Run Preflight</span>', onclick: () => preflight() })));
      body.appendChild(el('p', { class: 'hintline', text: 'To test independently: unzip the file, open index.html in a browser, then upload every file to your host in one folder. The package has no dependency on this editor.' }));
    }, 30);
  }

  /* ---------- Settings & diagnostics ---------- */
  async function settings() {
    const body = el('div', null, el('p', { class: 'note', text: 'Reading diagnostics…' })); const h = dialog('Settings & diagnostics', body);
    const S = PX.Storage; const est = await S.estimate(); const per = await S.persisted();
    const sw = PX.App.swStatus || {}; const sess = PX.App.session || {};
    body.innerHTML = '';
    const row = (k, v, cls) => [el('dt', { text: k }), el('dd', { class: cls || '', text: v })];
    const dl = el('dl', { class: 'kv' });
    [].concat(
      row('App version', PX.App.VERSION),
      row('Project storage', S.mode === 'indexeddb' ? 'IndexedDB (persistent in this browser profile)' : 'Memory only — NOT persistent', S.mode === 'indexeddb' ? 'y' : 'n'),
      row('Storage used / quota', est ? kb(est.usage) + ' / ' + kb(est.quota) + ' (estimate by the browser)' : 'Not reported by this browser'),
      row('Persistent storage granted', per == null ? 'Not reported by this browser' : per ? 'Yes' : 'No — the browser may evict data under storage pressure', per ? 'y' : 'n'),
      row('Network', navigator.onLine ? 'Online' : 'Offline'),
      row('Secure context (needed for install/offline)', window.isSecureContext ? 'Yes' : 'No — service worker unavailable', window.isSecureContext ? 'y' : 'n'),
      row('Offline application shell', sw.text || 'Unknown', sw.ok ? 'y' : 'n'),
      row('Shell cache', sw.version ? sw.version + (sw.expected ? ` — ${sw.cached}/${sw.expected} files cached` : '') : 'None'),
      row('Last session ended', sess.state === 'interrupted' ? 'Without closing (recovered last saved state)' : sess.state === 'other-tab' ? 'Another tab is open' : 'Cleanly', sess.state === 'clean' ? 'y' : 'n'),
      row('Installed as an app', window.matchMedia && matchMedia('(display-mode: standalone)').matches ? 'Yes' : 'No (running in a browser tab)')
    ).forEach((n) => dl.appendChild(n));
    body.appendChild(dl);
    const out = el('div', { class: 'hint' });
    body.appendChild(el('div', { class: 'row' },
      el('button', { type: 'button', class: 'btn', text: 'Request persistent storage', onclick: async () => { const r = await S.requestPersist(); out.className = 'hint'; out.textContent = r == null ? 'This browser does not support the request.' : r ? 'Granted.' : 'The browser declined. Keep project files as your backup.'; } }),
      el('button', { type: 'button', class: 'btn', text: 'Check for app update', onclick: async () => { out.className = 'hint'; out.textContent = await PX.App.checkUpdate(); } })));
    body.appendChild(out);
    body.appendChild(el('div', { class: 'sechead' }, el('span', { text: '▪' }), 'Keyboard'));
    const keys = [['Ctrl/⌘ + Z', 'Undo'], ['Ctrl/⌘ + Shift + Z or Ctrl + Y', 'Redo'], ['Ctrl/⌘ + D', 'Duplicate selection'], ['Delete', 'Delete selection'], ['Alt + ↑ / ↓', 'Move selection up / down'], ['Esc', 'Select parent, then nothing'], ['Double-click text', 'Edit it on the page (Enter or click away to apply, Esc to cancel)']];
    const kv = el('dl', { class: 'kv' }); keys.forEach(([k, v]) => { kv.appendChild(el('dt', { text: k })); kv.appendChild(el('dd', { text: v })); }); body.appendChild(kv);
    body.appendChild(el('p', { class: 'hintline', text: 'PixelProTech Solutions (Pty) Ltd · Centurion, Gauteng, South Africa · pixelprotechsolutions@proton.me. Pixel App runs entirely in your browser; nothing in your project is uploaded anywhere.' }));
    return h;
  }

  PX.Dialogs = { projects, preflight, exportSite, settings, renderReport };
})();
