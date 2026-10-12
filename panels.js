/* PixelProTech Pixel App — panels.js
   Left-hand panels: Add (components + reusable blocks), Layers (hierarchy tree with drag reorder), Pages.
   Also renders the selection breadcrumb in the status bar. Every control calls the engine; nothing here holds project state. */
(function () {
  'use strict';
  const PX = (window.PX = window.PX || {});
  const E = () => PX.Engine;
  const el = (...a) => PX.el(...a);

  let host = null, tab = 'add', hooks = {}, queued = false;
  const collapsed = new Set();
  const ORDER = ['Structure', 'Content', 'Site'];

  function init(hostEl, h) {
    host = hostEl; hooks = h || {};
    host.addEventListener('dragover', (e) => { const r = host.getBoundingClientRect(); if (e.clientY < r.top + 36) host.scrollTop -= 14; else if (e.clientY > r.bottom - 36) host.scrollTop += 14; });
  }
  const setTab = (t) => { tab = t; document.querySelectorAll('#left .tab').forEach((b) => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }); render(); };
  const currentTab = () => tab;

  /* ---------- Add ---------- */
  function addView() {
    const root = el('div');
    const groups = {};
    Object.keys(PX.Types).forEach((t) => { const g = PX.Types[t].group || 'Content'; (groups[g] = groups[g] || []).push(t); });
    ORDER.forEach((g) => {
      if (!groups[g]) return;
      root.appendChild(el('div', { class: 'sechead' }, el('span', { text: '▪' }), g));
      const grid = el('div', { class: 'palette' });
      groups[g].forEach((t) => {
        const def = PX.Types[t];
        const b = el('button', { type: 'button', class: 'pitem', draggable: 'true', title: `Add ${def.label} — click to insert at the selection, or drag onto the page`, html: PX.icon(def.icon) + '<span>' + PX.esc(def.label) + '</span>' });
        b.addEventListener('click', () => { const id = E().insertSmart(t); if (!id && PX.UI) PX.UI.toast(`${def.label} could not be placed here.`, 'warn'); else if (id) PX.Canvas.reveal(id); });
        b.addEventListener('dragstart', (ev) => { PX.Canvas.setDrag({ kind: 'add', type: t }); try { ev.dataTransfer.setData('text/plain', 'px-add:' + t); ev.dataTransfer.effectAllowed = 'copy'; } catch (x) { /* ignore */ } });
        b.addEventListener('dragend', () => PX.Canvas.endDrag());
        grid.appendChild(b);
      });
      root.appendChild(grid);
    });
    root.appendChild(el('div', { class: 'sechead' }, el('span', { text: '▪' }), 'Reusable blocks'));
    const bg = el('div', { class: 'palette' });
    PX.Blueprints.blocks.forEach((blk) => {
      const b = el('button', { type: 'button', class: 'pitem block', draggable: 'true', title: `Insert the "${blk.name}" block (real components you can edit)`, html: PX.icon('i-block') + '<span>' + PX.esc(blk.name) + '</span>' });
      b.addEventListener('click', () => { const n = blk.build(); const id = E().insertSmart(n.type, n); if (id) PX.Canvas.reveal(id); });
      b.addEventListener('dragstart', (ev) => { PX.Canvas.setDrag({ kind: 'block', type: 'section', make: () => blk.build() }); try { ev.dataTransfer.setData('text/plain', 'px-block:' + blk.id); ev.dataTransfer.effectAllowed = 'copy'; } catch (x) { /* ignore */ } });
      b.addEventListener('dragend', () => PX.Canvas.endDrag());
      bg.appendChild(b);
    });
    root.appendChild(bg);
    root.appendChild(el('p', { class: 'hintline', text: 'Click inserts next to the selected component. Drag to place exactly. Double-click text on the page to edit it in place.' }));
    return root;
  }

  /* ---------- Layers ---------- */
  function zoneFor(e, row, node) {
    const d = hooks.getDrag && hooks.getDrag(); if (!d) return null;
    const type = d.kind === 'move' ? ((E().find(d.id) || {}).node || {}).type : d.type; if (!type) return null;
    const moved = d.kind === 'move' ? (E().find(d.id) || {}).node : null;
    const f = E().find(node.id); if (!f) return null;
    const r = row.getBoundingClientRect(), ratio = (e.clientY - r.top) / r.height;
    const bad = (pid) => { if (!moved) return false; if (pid === moved.id) return true; return pid ? E().isDesc(moved, pid) : false; };
    const okIn = (parentNode) => PX.canContain(parentNode ? parentNode.type : 'root', type);
    if (PX.isContainer(node.type) && ratio > 0.28 && ratio < 0.72 && okIn(node) && !bad(node.id)) return { zone: 'dropin', parentId: node.id, index: node.children.length };
    if (moved && moved.id === node.id) return null;
    if (!okIn(f.parent)) return null;
    if (f.parent && bad(f.parent.id)) return null;
    const before = ratio < 0.5;
    return { zone: before ? 'dropb' : 'dropa', parentId: f.parent ? f.parent.id : null, index: before ? f.index : f.index + 1 };
  }
  const clearMarks = () => host && host.querySelectorAll('.dropb,.dropa,.dropin').forEach((r) => r.classList.remove('dropb', 'dropa', 'dropin'));

  function expandToSelection() { let f = E().selectedId && E().find(E().selectedId); while (f && f.parent) { collapsed.delete(f.parent.id); f = E().find(f.parent.id); } }
  function layersView() {
    const wrap = el('div', { role: 'tree', 'aria-label': 'Page layers' });
    const sel = E().selectedId; const nodes = E().page().nodes;
    if (!nodes.length) wrap.appendChild(el('p', { class: 'hintline', text: 'This page has no components yet.' }));
    (function add(list, depth) {
      list.forEach((n) => {
        const def = PX.Types[n.type]; if (!def) return;
        const hasKids = !!(n.children && n.children.length), isCol = collapsed.has(n.id);
        const row = el('div', { class: 'lrow' + (sel === n.id ? ' sel' : ''), role: 'treeitem', 'aria-level': depth + 1, 'aria-selected': String(sel === n.id), 'aria-expanded': hasKids ? String(!isCol) : null, tabindex: '0', draggable: 'true', 'data-id': n.id, style: 'padding-left:' + (4 + depth * 14) + 'px' });
        if (hasKids) { const tw = el('button', { type: 'button', class: 'twist', title: (isCol ? 'Expand ' : 'Collapse ') + def.label, 'aria-label': (isCol ? 'Expand ' : 'Collapse ') + def.label, text: isCol ? '▸' : '▾' }); tw.addEventListener('click', (ev) => { ev.stopPropagation(); if (collapsed.has(n.id)) collapsed.delete(n.id); else collapsed.add(n.id); render(); }); row.appendChild(tw); } else row.appendChild(el('span', { class: 'twspace' }));
        row.insertAdjacentHTML('beforeend', PX.icon(def.icon) + '<span class="lt">' + PX.esc(PX.describe(n)) + '</span>');
        row.addEventListener('click', () => E().select(n.id));
        row.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); E().select(n.id); } });
        row.addEventListener('dragstart', (ev) => { PX.Canvas.setDrag({ kind: 'move', id: n.id }); try { ev.dataTransfer.setData('text/plain', 'px-move'); ev.dataTransfer.effectAllowed = 'move'; } catch (x) { /* ignore */ } });
        row.addEventListener('dragend', () => { clearMarks(); PX.Canvas.endDrag(); });
        row.addEventListener('dragover', (ev) => { const z = zoneFor(ev, row, n); clearMarks(); if (!z) return; ev.preventDefault(); row.classList.add(z.zone); });
        row.addEventListener('dragleave', () => row.classList.remove('dropb', 'dropa', 'dropin'));
        row.addEventListener('drop', (ev) => { const z = zoneFor(ev, row, n); clearMarks(); if (!z) return; ev.preventDefault(); const d = hooks.getDrag(); PX.Canvas.performDrop(d, z.parentId, z.index); PX.Canvas.endDrag(); });
        wrap.appendChild(row);
        if (hasKids && !isCol) add(n.children, depth + 1);
      });
    })(nodes, 0);
    return el('div', null, wrap, el('p', { class: 'hintline', text: 'Click to select. Drag a layer to reorder it or nest it into a container. Dragging also works from the component palette.' }));
  }

  /* ---------- Pages ---------- */
  function pagesView() {
    const pr = E().project, cur = E().pageId || pr.pages[0].id;
    const root = el('div');
    pr.pages.forEach((p, i) => {
      const row = el('div', { class: 'prow' + (p.id === cur ? ' on' : ''), role: 'button', tabindex: '0', 'aria-current': p.id === cur ? 'page' : null },
        el('div', { style: 'flex:1;min-width:0' }, el('b', { text: p.title || '(untitled)' }), el('small', { text: i === 0 ? 'index.html · home' : p.slug + '.html' })));
      row.addEventListener('click', () => E().setPage(p.id));
      row.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); E().setPage(p.id); } });
      if (i > 0) row.appendChild(PX.iconBtn('i-up', 'Make "' + (p.title || p.slug) + '" the home page', (ev) => { ev.stopPropagation(); E().makeHome(p.id); }, 'sm'));
      if (pr.pages.length > 1) row.appendChild(PX.iconBtn('i-trash', 'Delete page "' + (p.title || p.slug) + '"', (ev) => { ev.stopPropagation(); hooks.confirm(`Delete page "${p.title || p.slug}"? Links to it will be flagged by Preflight.`, () => E().deletePage(p.id)); }, 'sm danger'));
      root.appendChild(row);
    });
    const input = el('input', { type: 'text', placeholder: 'New page title', maxlength: '60', 'aria-label': 'New page title', style: 'flex:1;min-width:0;background:var(--s2);border:1px solid var(--line2);padding:6px 8px' });
    const add = () => { const v = input.value.trim(); E().addPage(v || 'New page'); input.value = ''; };
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') add(); });
    root.appendChild(el('div', { class: 'row' }, input, el('button', { type: 'button', class: 'btn small', html: PX.icon('i-plus') + '<span>Add page</span>', onclick: add })));
    root.appendChild(el('p', { class: 'hintline', text: 'A new page copies the navigation and footer from the home page. Select nothing on the canvas to edit the page title, file name and design tokens in the inspector.' }));
    return root;
  }

  /* ---------- shell ---------- */
  function render() {
    if (!host) return;
    host.innerHTML = '';
    if (!E().project) { host.appendChild(el('p', { class: 'hintline', text: 'Open or start a project to add components.' })); return; }
    host.appendChild(tab === 'layers' ? layersView() : tab === 'pages' ? pagesView() : addView());
    if (tab === 'layers') { const s = host.querySelector('.lrow.sel'); if (s && s.scrollIntoView) s.scrollIntoView({ block: 'nearest' }); }
  }
  function renderSoon() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; if (tab !== 'add') render(); }); }

  function crumbs(node) {
    const c = document.getElementById('crumbs'); if (!c) return; c.innerHTML = '';
    const eng = E(); if (!eng.project) return;
    const pg = eng.page();
    const pageBtn = el('button', { type: 'button', text: pg.title || pg.slug, title: 'Select nothing (page settings)' }); pageBtn.addEventListener('click', () => eng.select(null)); c.appendChild(pageBtn);
    const id = eng.selectedId; if (!id) return;
    const chain = []; let f = eng.find(id);
    while (f) { chain.unshift(f.node); f = f.parent ? eng.find(f.parent.id) : null; }
    chain.forEach((n, i) => {
      c.appendChild(document.createTextNode(' › '));
      if (i === chain.length - 1) c.appendChild(el('b', { text: PX.describe(n) }));
      else { const b = el('button', { type: 'button', text: PX.describe(n) }); b.addEventListener('click', () => eng.select(n.id)); c.appendChild(b); }
    });
  }

  PX.Panels = { expandToSelection, init, render, renderSoon, setTab, currentTab, crumbs, clearMarks };
})();
