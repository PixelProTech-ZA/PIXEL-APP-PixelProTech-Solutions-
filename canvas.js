/* PixelProTech Pixel App — canvas.js
   The editing canvas. The page is rendered from the project model (PX.renderNodes, the same renderer the exporter uses)
   into a same-origin iframe so the site's CSS and media queries behave exactly as they will after export.
   Property edits patch one element; structure edits re-render the page body; style/token edits only rewrite the stylesheet. */
(function () {
  'use strict';
  const PX = (window.PX = window.PX || {});
  const E = () => PX.Engine;

  let frame = null, doc = null, win = null, root = null, ov = null, ovLabel = null, dropEl = null;
  let drag = null, editing = null, hoverEl = null, overlayQueued = false, pick = false;

  const SKELETON = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style id="px-css"></style><style id="px-edit">${PX.EDIT_CSS}
#px-root:empty::before{content:'This page is empty. Add a Navigation or a Section from the left panel.';display:block;margin:40px;padding:40px;border:1px dashed rgba(0,212,170,.55);color:#8C8A9C;font:13px ui-monospace,Consolas,monospace;text-align:center}
#px-ov{z-index:99998}</style></head><body><div id="px-root"></div><div id="px-ov"><i></i><i></i><i></i><i></i><b draggable="true" title="Drag to move this component"></b></div><div id="px-drop"></div></body></html>`;

  const mkctx = () => ({ edit: true, project: E().project, assetUrl: (id) => { const a = E().assets[id]; return a && a.dataUrl ? a.dataUrl : ''; } });
  const byId = (id) => (root ? root.querySelector('[data-px="' + id + '"]') : null);
  const isTyping = () => !!editing;

  /* ---------- lifecycle ---------- */
  function init(iframe) {
    frame = iframe;
    return new Promise((resolve) => {
      frame.addEventListener('load', () => { setup(); resolve(); }, { once: true });
      frame.srcdoc = SKELETON;
    });
  }

  function setup() {
    doc = frame.contentDocument; win = frame.contentWindow;
    root = doc.getElementById('px-root'); ov = doc.getElementById('px-ov'); ovLabel = ov.querySelector('b'); dropEl = doc.getElementById('px-drop');

    doc.addEventListener('click', (e) => {
      if (editing && editing.el.contains(e.target)) return;
      if (!e.target.closest || !e.target.closest('.px-nav-toggle,.px-nav-check')) e.preventDefault();
      const t = e.target.closest ? e.target.closest('[data-px]') : null;
      if (!E().project) return;
      pick = true; try { E().select(t ? t.getAttribute('data-px') : null); } finally { pick = false; }
    });
    doc.addEventListener('dblclick', (e) => {
      const t = e.target.closest ? e.target.closest('[data-edit]') : null;
      if (t) startEdit(t);
    });
    doc.addEventListener('mouseover', (e) => {
      if (drag || editing) return;
      const t = e.target.closest ? e.target.closest('[data-px]') : null;
      setHover(t);
    });
    doc.documentElement.addEventListener('mouseleave', () => setHover(null));
    doc.addEventListener('keydown', (e) => { if (!editing && PX.onCanvasKey) PX.onCanvasKey(e); });

    doc.addEventListener('dragover', onDragOver);
    doc.addEventListener('dragleave', (e) => { if (!e.relatedTarget) hideDrop(); });
    doc.addEventListener('drop', onDrop);
    ovLabel.addEventListener('dragstart', (e) => {
      const id = E().selectedId; if (!id) { e.preventDefault(); return; }
      setDrag({ kind: 'move', id });
      try { e.dataTransfer.setData('text/plain', 'px-move'); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* ignore */ }
    });
    ovLabel.addEventListener('dragend', endDrag);

    if (window.ResizeObserver) new ResizeObserver(queueOverlay).observe(root);
    win.addEventListener('resize', () => { queueOverlay(); if (PX.onCanvasResize) PX.onCanvasResize(); });
  }

  /* ---------- rendering ---------- */
  function refreshCss() {
    if (!doc || !E().project) return;
    doc.getElementById('px-css').textContent = PX.buildCss(E().project, mkctx());
    queueOverlay();
  }
  function renderBody() {
    if (!doc) return;
    finishEdit(false);
    const p = E().project; if (!p) { root.innerHTML = ''; queueOverlay(); return; }
    root.innerHTML = PX.renderNodes(E().page().nodes, mkctx());
    hoverEl = null; queueOverlay();
  }
  function renderAll() { refreshCss(); renderBody(); }

  function patchNode(id) {
    if (!doc) return;
    const f = E().find(id), cur = byId(id);
    if (!f || !cur) { renderBody(); return; }
    if (editing && editing.id === id) return;
    const tmp = doc.createElement('div');
    tmp.innerHTML = PX.renderNode(f.node, mkctx());
    const next = tmp.firstElementChild;
    if (!next) { renderBody(); return; }
    cur.replaceWith(next); hoverEl = null; queueOverlay();
  }

  /* The frame always has its true logical width (Desktop 1200 / Tablet 768 / Mobile 375) so media queries match the
     exported site; when the editor area is narrower the whole frame is scaled down rather than re-flowed. */
  let bpNow = 'base', scale = 1;
  function layout() {
    const box = frame && frame.parentElement; if (!box) return;
    const wrap = box.parentElement, logical = bpNow === 'base' ? 1200 : PX.BP_WIDTH[bpNow];
    scale = Math.min(1, Math.max(240, wrap.clientWidth - 44) / logical);
    box.style.width = Math.round(logical * scale) + 'px'; box.style.maxWidth = 'none';
    frame.style.position = 'absolute'; frame.style.left = '0'; frame.style.top = '0';
    frame.style.width = logical + 'px'; frame.style.height = Math.ceil(box.clientHeight / scale) + 'px';
    frame.style.transformOrigin = '0 0'; frame.style.transform = scale < 1 ? 'scale(' + scale + ')' : '';
    queueOverlay();
  }
  function setWidth(bp) { bpNow = bp || bpNow; layout(); }
  const width = () => (frame ? frame.clientWidth : 0);

  /* ---------- overlay ---------- */
  function queueOverlay() {
    if (overlayQueued) return; overlayQueued = true;
    requestAnimationFrame(() => { overlayQueued = false; drawOverlay(); });
  }
  function drawOverlay() {
    if (!ov) return;
    const id = E().selectedId, t = id ? byId(id) : null, f = id ? E().find(id) : null;
    if (!t || !f) { ov.style.display = 'none'; return; }
    const r = t.getBoundingClientRect();
    if (!r.width && !r.height) { ov.style.display = 'none'; return; }
    const top = r.top + win.scrollY;
    ov.style.display = 'block';
    ov.style.left = (r.left + win.scrollX) + 'px'; ov.style.top = top + 'px';
    ov.style.width = r.width + 'px'; ov.style.height = r.height + 'px';
    ovLabel.textContent = PX.describe(f.node) + '  ' + Math.round(r.width) + '×' + Math.round(r.height);
    ov.classList.toggle('in', top < 26);
    ovLabel.style.pointerEvents = 'auto';
  }
  function setHover(t) {
    if (hoverEl === t) return;
    if (hoverEl) hoverEl.classList.remove('px-hover');
    hoverEl = t;
    if (hoverEl && hoverEl.getAttribute('data-px') !== E().selectedId) hoverEl.classList.add('px-hover');
  }
  function reveal(id) {
    const t = byId(id); if (!t) return;
    const r = t.getBoundingClientRect(), vh = win.innerHeight;
    if (r.top < 0 || r.bottom > vh) t.scrollIntoView({ block: r.height > vh ? 'start' : 'center' });
    queueOverlay();
  }

  /* ---------- inline text editing (double-click) ---------- */
  function startEdit(elm) {
    finishEdit(true);
    const owner = elm.closest('[data-px]'); if (!owner) return;
    const id = owner.getAttribute('data-px'), key = elm.getAttribute('data-edit'), f = E().find(id); if (!f) return;
    E().select(id);
    const live = byId(id); const target = live && live.contains(elm) ? elm : (live && live.querySelector('[data-edit="' + key + '"]')) || elm;
    editing = { id, key, el: target, original: String(f.node.props[key] == null ? '' : f.node.props[key]), multi: target.hasAttribute('data-multiline') };
    try { target.contentEditable = 'plaintext-only'; } catch (x) { /* fall back */ }
    if (target.contentEditable !== 'plaintext-only') target.contentEditable = 'true';
    target.addEventListener('keydown', onEditKey); target.addEventListener('blur', onEditBlur); target.addEventListener('paste', onEditPaste);
    target.focus();
    const rg = doc.createRange(); rg.selectNodeContents(target); const s = win.getSelection(); s.removeAllRanges(); s.addRange(rg);
    queueOverlay();
  }
  function onEditKey(e) {
    if (!editing) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); editing.cancel = true; editing.el.blur(); }
    else if (e.key === 'Enter' && (!editing.multi || e.ctrlKey || e.metaKey)) { e.preventDefault(); editing.el.blur(); }
    e.stopPropagation();
  }
  function onEditPaste(e) {
    e.preventDefault();
    let t = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
    if (!editing.multi) t = t.replace(/\s*\r?\n\s*/g, ' ');
    doc.execCommand('insertText', false, t);
  }
  function onEditBlur() { finishEdit(!(editing && editing.cancel)); }
  function finishEdit(commit) {
    if (!editing) return;
    const ed = editing; editing = null;
    ed.el.removeEventListener('keydown', onEditKey); ed.el.removeEventListener('blur', onEditBlur); ed.el.removeEventListener('paste', onEditPaste);
    ed.el.removeAttribute('contenteditable');
    let text = (ed.el.innerText != null ? ed.el.innerText : ed.el.textContent).replace(/ /g, ' ').replace(/\r/g, '');
    text = ed.multi ? text.replace(/\n+$/, '') : text.replace(/\s*\n\s*/g, ' ').trim();
    if (commit && text !== ed.original && E().find(ed.id)) E().setProp(ed.id, ed.key, text, { origin: 'canvas' });
    patchNode(ed.id);
  }

  /* ---------- drag and drop ---------- */
  function setDrag(d) { drag = d; setHover(null); }
  function endDrag() { drag = null; hideDrop(); if (PX.onDragEnd) PX.onDragEnd(); }
  function hideDrop() { if (dropEl) dropEl.style.display = 'none'; }
  const dragType = () => {
    if (!drag) return null;
    if (drag.kind === 'move') { const f = E().find(drag.id); return f ? f.node.type : null; }
    return drag.type;
  };
  function kidsOf(elm) {
    const holder = elm === root ? root : (elm.getAttribute('data-type') === 'section' ? elm.firstElementChild : elm);
    return { holder, kids: Array.prototype.filter.call(holder.children, (c) => c.hasAttribute('data-px')) };
  }
  function indexAt(holder, kids, x, y) {
    const hr = holder.getBoundingClientRect();
    for (let i = 0; i < kids.length; i++) {
      const r = kids[i].getBoundingClientRect(); const side = r.width < hr.width * 0.8;
      if (side ? (y < r.bottom && x < r.left + r.width / 2) : (y < r.top + r.height / 2)) return { index: i, side };
    }
    return { index: kids.length, side: kids.length ? kids[kids.length - 1].getBoundingClientRect().width < hr.width * 0.8 : false };
  }
  function locate(e) {
    const type = dragType(); if (!type) return null;
    const movedNode = drag.kind === 'move' ? (E().find(drag.id) || {}).node : null;
    let elm = e.target && e.target.closest ? e.target.closest('[data-px]') : null;
    while (elm) {
      const id = elm.getAttribute('data-px'), f = E().find(id);
      if (f && PX.isContainer(f.node.type) && PX.canContain(f.node.type, type) && !(movedNode && (id === movedNode.id || E().isDesc(movedNode, id)))) {
        const { holder, kids } = kidsOf(elm); const at = indexAt(holder, kids, e.clientX, e.clientY);
        return { parentId: id, holder, kids, index: at.index, side: at.side };
      }
      elm = elm.parentElement ? elm.parentElement.closest('[data-px]') : null;
    }
    if (PX.canContain('root', type)) { const { holder, kids } = kidsOf(root); const at = indexAt(holder, kids, e.clientX, e.clientY); return { parentId: null, holder, kids, index: at.index, side: false }; }
    return null;
  }
  function showDrop(loc) {
    const sx = win.scrollX, sy = win.scrollY, hr = loc.holder.getBoundingClientRect();
    dropEl.style.display = 'block';
    if (!loc.kids.length) {
      dropEl.className = 'box'; dropEl.style.left = hr.left + sx + 'px'; dropEl.style.top = hr.top + sy + 'px'; dropEl.style.width = hr.width + 'px'; dropEl.style.height = Math.max(hr.height, 24) + 'px'; return;
    }
    dropEl.className = '';
    const after = loc.index >= loc.kids.length; const ref = loc.kids[after ? loc.kids.length - 1 : loc.index], r = ref.getBoundingClientRect();
    if (loc.side) { dropEl.style.left = (after ? r.right : r.left) + sx - 2 + 'px'; dropEl.style.top = r.top + sy + 'px'; dropEl.style.width = '4px'; dropEl.style.height = r.height + 'px'; }
    else { dropEl.style.left = hr.left + sx + 'px'; dropEl.style.top = (after ? r.bottom : r.top) + sy - 2 + 'px'; dropEl.style.width = hr.width + 'px'; dropEl.style.height = '4px'; }
  }
  function onDragOver(e) {
    if (!drag) return;
    const loc = locate(e);
    if (e.clientY < 40) win.scrollBy(0, -16); else if (e.clientY > win.innerHeight - 40) win.scrollBy(0, 16);
    if (!loc) { hideDrop(); try { e.dataTransfer.dropEffect = 'none'; } catch (x) { /* ignore */ } return; }
    e.preventDefault();
    try { e.dataTransfer.dropEffect = drag.kind === 'move' ? 'move' : 'copy'; } catch (x) { /* ignore */ }
    showDrop(loc);
  }
  function onDrop(e) {
    if (!drag) return;
    e.preventDefault();
    const loc = locate(e), d = drag; hideDrop();
    if (loc) performDrop(d, loc.parentId, loc.index);
    endDrag();
  }
  function performDrop(d, parentId, index) {
    let r = null;
    if (d.kind === 'add') r = E().addNode(d.type, parentId, index);
    else if (d.kind === 'block') r = E().addTree(d.make(), parentId, index);
    else if (d.kind === 'move') r = E().moveNode(d.id, parentId, index);
    if (!r && PX.UI) PX.UI.toast('That component cannot be placed there.', 'warn');
    return r;
  }

  PX.Canvas = { scale: () => scale, getDrag: () => drag, isPick: () => pick, init, renderAll, renderBody, refreshCss, patchNode, setWidth, width, queueOverlay, reveal, setDrag, endDrag, performDrop, isEditing: isTyping, endEdit: () => finishEdit(true), get ready() { return !!doc; }, get doc() { return doc; } };
})();
