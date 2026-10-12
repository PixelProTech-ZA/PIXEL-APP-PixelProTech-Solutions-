/* PixelProTech Pixel App — engine.js
   The construction engine: structured project model, selection, operations, undo/redo, validation.
   Project data (pages / nodes / tokens / settings) is kept separate from binary assets so history snapshots stay small. */
(function () {
  'use strict';
  const PX = (window.PX = window.PX || {});
  const T = () => PX.Types;

  let project = null;           // { v, id, name, category, templateId, tokens, pages:[{id,title,slug,nodes}], settings }
  let assets = {};              // id -> { id, name, mime, size, dataUrl }
  let pageId = null, selId = null, bp = 'base';
  let past = [], future = [], lastKey = null, lastT = 0, rev = 0;
  const listeners = [];
  const LIMIT = 150;

  const snapshot = () => JSON.stringify(project);
  const emit = (ev) => listeners.forEach((f) => { try { f(ev); } catch (e) { console.error(e); } });
  function commit(key) {
    const now = Date.now();
    if (key && key === lastKey && now - lastT < 1200) { lastT = now; }
    else { past.push(snapshot()); if (past.length > LIMIT) past.shift(); lastKey = key || null; lastT = now; }
    future = []; rev++;
  }
  const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

  function currentPage() { return project && (project.pages.find((p) => p.id === pageId) || project.pages[0]); }
  function find(id) {
    if (!project) return null;
    const search = (list, parent, page) => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === id) return { node: list[i], parent, list, index: i, page };
        const r = search(list[i].children || [], list[i], page); if (r) return r;
      }
      return null;
    };
    for (const p of project.pages) { const r = search(p.nodes, null, p); if (r) return r; }
    return null;
  }
  const typeOf = (parent) => (parent ? parent.type : 'root');
  const isDesc = (anc, id) => { let f = false; PX.walk(anc.children, (n) => { if (n.id === id) f = true; }); return f; };

  /* ----- validation / migration of loaded data ----- */
  function validateProject(obj) {
    const errors = [], warnings = [];
    if (!obj || typeof obj !== 'object') return { ok: false, errors: ['Not a project object'], warnings };
    const p = PX.clone(obj);
    if (!Array.isArray(p.pages) || !p.pages.length) errors.push('Project has no pages');
    if (!p.tokens || typeof p.tokens !== 'object') errors.push('Project has no design tokens');
    if (errors.length) return { ok: false, errors, warnings };
    p.v = 1; p.id = p.id || 'p' + PX.uid(); p.name = String(p.name || 'Untitled site');
    p.category = p.category || 'business'; p.settings = Object.assign({ lang: 'en', description: '' }, p.settings);
    const seen = new Set(); const slugs = new Set();
    p.pages.forEach((pg, i) => {
      pg.id = pg.id || PX.uid(); pg.title = String(pg.title == null ? '' : pg.title);
      pg.slug = slugify(pg.slug) || ('page-' + (i + 1));
      while (slugs.has(pg.slug)) pg.slug += '-2'; slugs.add(pg.slug);
      pg.nodes = Array.isArray(pg.nodes) ? pg.nodes : [];
      const fix = (list, parentType) => {
        for (let k = list.length - 1; k >= 0; k--) {
          const n = list[k];
          if (!n || !T()[n.type]) { warnings.push(`Removed unknown component "${n && n.type}" on page "${pg.title}"`); list.splice(k, 1); continue; }
          n.props = Object.assign({}, T()[n.type].defaults({}).props, n.props);
          n.style = Object.assign({ base: {}, tablet: {}, mobile: {} }, n.style);
          PX.BPS.forEach((b) => { n.style[b] = n.style[b] || {}; });
          n.children = Array.isArray(n.children) ? n.children : [];
          if (!n.id || seen.has(n.id)) n.id = PX.uid();
          seen.add(n.id);
          fix(n.children, n.type);
        }
      };
      fix(pg.nodes, 'root');
    });
    return { ok: true, project: p, errors, warnings };
  }

  /* ----- lifecycle ----- */
  function load(obj, assetMap, opts) {
    const v = validateProject(obj);
    if (!v.ok) return v;
    project = v.project; assets = assetMap ? PX.clone(assetMap) : {};
    pageId = project.pages[0].id; selId = null; bp = (opts && opts.bp) || 'base';
    past = []; future = []; lastKey = null; rev = (opts && opts.keepRev) ? rev + 1 : 0;
    emit({ type: 'load' });
    return v;
  }
  function newFromTemplate(catId, tplId) {
    const cat = PX.Blueprints.get(catId); const tpl = cat && cat.templates.find((t) => t.id === tplId);
    if (!tpl) return { ok: false, errors: ['Unknown template'] };
    const p = tpl.build(); p.id = 'p' + PX.uid(); p.category = catId;
    return load(p, {});
  }

  /* ----- selection / view ----- */
  function select(id) { if (id && !find(id)) id = null; selId = id; emit({ type: 'select', id }); }
  function setPage(id) { if (project.pages.some((p) => p.id === id)) { pageId = id; selId = null; emit({ type: 'page' }); } }
  function setBp(b) { bp = b; emit({ type: 'bp', bp: b }); }

  /* ----- node operations ----- */
  function insertAt(node, parentId, index) {
    const parent = parentId ? find(parentId) : null;
    const list = parent ? parent.node.children : currentPage().nodes;
    if (!PX.canContain(typeOf(parent && parent.node), node.type)) return false;
    index = index == null || index > list.length ? list.length : Math.max(0, index);
    list.splice(index, 0, node);
    return true;
  }
  function ctxForCreate() { return { project, firstPageId: project.pages[0].id }; }

  function addNode(type, parentId, index, patch) {
    if (!T()[type]) return null;
    const node = PX.create(type, ctxForCreate());
    if (patch) { Object.assign(node.props, patch.props); if (patch.style) PX.BPS.forEach((b) => Object.assign(node.style[b], patch.style[b])); }
    return addTree(node, parentId, index);
  }
  function addTree(node, parentId, index) {
    commit();
    if (!insertAt(node, parentId, index)) { past.pop(); rev--; return null; }
    selId = node.id; emit({ type: 'structure', id: node.id }); return node.id;
  }
  /* Insert near the current selection, or at a sensible default; wraps leaf components in a new section if needed. */
  function insertSmart(type, built) {
    const mk = () => built ? PX.cloneTree(built) : PX.create(type, ctxForCreate());
    let node = mk(); const t = node.type;
    const sel = selId ? find(selId) : null;
    if (sel) {
      if (PX.isContainer(sel.node.type) && PX.canContain(sel.node.type, t)) return addTree(node, sel.node.id, null);
      let cur = sel;
      while (cur) {
        if (PX.canContain(typeOf(cur.parent), t)) return addTree(node, cur.parent ? cur.parent.id : null, cur.index + 1);
        const up = cur.parent ? find(cur.parent.id) : null; cur = up;
      }
    }
    const nodes = currentPage().nodes;
    if (PX.canContain('root', t)) {
      let idx = nodes.length; if (t !== 'footer') { const fi = nodes.findIndex((n) => n.type === 'footer'); if (fi >= 0) idx = fi; }
      if (t === 'nav') idx = 0;
      return addTree(node, null, idx);
    }
    // leaf or inner structure with nothing sensible selected: put into last section, else wrap in new section
    let last = null; for (let i = nodes.length - 1; i >= 0; i--) if (nodes[i].type === 'section') { last = nodes[i]; break; }
    if (last) return addTree(node, last.id, null);
    const sec = PX.create('section', ctxForCreate()); sec.children.push(node);
    const fi = nodes.findIndex((n) => n.type === 'footer');
    const id = addTree(sec, null, fi >= 0 ? fi : nodes.length);
    if (id) { selId = node.id; emit({ type: 'select', id: node.id }); }
    return node.id;
  }
  function moveNode(id, parentId, index) {
    const f = find(id); if (!f) return false;
    const target = parentId ? find(parentId) : null;
    if (target && (target.node.id === id || isDesc(f.node, target.node.id))) return false;
    if (!PX.canContain(typeOf(target && target.node), f.node.type)) return false;
    const destList = target ? target.node.children : currentPage().nodes;
    if (f.page !== currentPage()) return false;
    commit();
    f.list.splice(f.index, 1);
    let idx = index == null ? destList.length : index;
    if (destList === f.list && f.index < idx) idx--;
    idx = Math.max(0, Math.min(idx, destList.length));
    destList.splice(idx, 0, f.node);
    selId = id; emit({ type: 'structure', id }); return true;
  }
  function moveBy(id, delta) {
    const f = find(id); if (!f) return false;
    const to = f.index + delta; if (to < 0 || to >= f.list.length) return false;
    commit(); const [n] = f.list.splice(f.index, 1); f.list.splice(to, 0, n);
    emit({ type: 'structure', id }); return true;
  }
  function duplicateNode(id) {
    const f = find(id); if (!f) return null;
    commit(); const c = PX.cloneTree(f.node);
    PX.walk([c], (n) => { if (n.props && n.props.anchor) n.props.anchor = ''; });
    f.list.splice(f.index + 1, 0, c); selId = c.id; emit({ type: 'structure', id: c.id }); return c.id;
  }
  function deleteNode(id) {
    const f = find(id); if (!f) return false;
    commit(); f.list.splice(f.index, 1);
    const nextSel = f.list[f.index] || f.list[f.index - 1] || (f.parent && f.parent.id) || null;
    selId = nextSel; emit({ type: 'structure', id: selId }); return true;
  }
  function setProp(id, key, val, opts) {
    const f = find(id); if (!f) return false;
    if (f.node.props[key] === val) return false;
    commit(opts && opts.nocoalesce ? null : `p:${id}:${key}`);
    f.node.props[key] = val;
    emit({ type: 'prop', id, key, origin: opts && opts.origin });
    return true;
  }
  function setStyle(id, key, val, bpName, opts) {
    const f = find(id); if (!f) return false;
    const b = bpName || bp; const st = f.node.style[b] || (f.node.style[b] = {});
    const empty = val === '' || val == null;
    if (empty ? !(key in st) : st[key] === val) return false;
    commit(`s:${id}:${b}:${key}`);
    if (empty) delete st[key]; else st[key] = val;
    emit({ type: 'style', id, key, bp: b, origin: opts && opts.origin });
    return true;
  }
  function setToken(group, key, val) {
    commit(`t:${group}:${key}`);
    if (group) { project.tokens[group] = project.tokens[group] || {}; project.tokens[group][key] = val; } else project.tokens[key] = val;
    emit({ type: 'tokens', origin: 'inspector' });
  }
  function setSite(key, val) { commit(`site:${key}`); if (key === 'name') project.name = val; else project.settings[key] = val; emit({ type: 'site', key, origin: 'inspector' }); }

  /* ----- pages ----- */
  function uniqueSlug(base) { let s = slugify(base) || 'page'; if (s === 'index') s = 'page'; const taken = new Set(project.pages.map((p) => p.slug)); let out = s, i = 2; while (taken.has(out)) out = s + '-' + i++; return out; }
  function addPage(title) {
    commit();
    const home = project.pages[0]; const nodes = [];
    home.nodes.filter((n) => n.type === 'nav').forEach((n) => nodes.push(PX.cloneTree(n)));
    nodes.push(PX.N('section', { label: 'Section' }, null, [PX.N('heading', { text: title || 'New page', level: 1 })]));
    home.nodes.filter((n) => n.type === 'footer').forEach((n) => nodes.push(PX.cloneTree(n)));
    const pg = { id: PX.uid(), title: title || 'New page', slug: uniqueSlug(title || 'new-page'), nodes };
    project.pages.push(pg); pageId = pg.id; selId = null; emit({ type: 'pages', id: pg.id }); return pg.id;
  }
  function deletePage(id) {
    if (project.pages.length < 2) return false;
    commit(); const i = project.pages.findIndex((p) => p.id === id); if (i < 0) return false;
    project.pages.splice(i, 1); if (pageId === id) pageId = project.pages[0].id; selId = null; emit({ type: 'pages' }); return true;
  }
  function setPageField(id, key, val) {
    const pg = project.pages.find((p) => p.id === id); if (!pg) return false;
    if (key === 'slug') { val = slugify(val); if (!val) return false; }
    commit(`pg:${id}:${key}`); pg[key] = val; emit({ type: 'pages', origin: 'inspector' }); return true;
  }
  function makeHome(id) {
    const i = project.pages.findIndex((p) => p.id === id); if (i <= 0) return false;
    commit(); const [pg] = project.pages.splice(i, 1); project.pages.unshift(pg); emit({ type: 'pages' }); return true;
  }

  /* ----- assets (not part of undo history) ----- */
  function addAsset(a) { const id = 'a' + PX.uid(); assets[id] = { id, name: a.name, mime: a.mime, size: a.size, dataUrl: a.dataUrl }; rev++; emit({ type: 'assets' }); return id; }
  function removeAsset(id) { delete assets[id]; rev++; emit({ type: 'assets' }); }
  function assetUsage(id) {
    let c = 0; project.pages.forEach((p) => PX.walk(p.nodes, (n) => { c += PX.assetRefs({ props: n.props, style: n.style, children: [] }).filter((r) => r.id === id).length; }));
    return c;
  }

  /* ----- history ----- */
  function applySnapshot(str) {
    project = JSON.parse(str);
    if (!project.pages.some((p) => p.id === pageId)) pageId = project.pages[0].id;
    if (selId && !find(selId)) selId = null;
  }
  function undo() { if (!past.length) return false; future.push(snapshot()); applySnapshot(past.pop()); lastKey = null; rev++; emit({ type: 'history' }); return true; }
  function redo() { if (!future.length) return false; past.push(snapshot()); applySnapshot(future.pop()); lastKey = null; rev++; emit({ type: 'history' }); return true; }

  PX.Engine = {
    on: (f) => listeners.push(f),
    get project() { return project; }, get assets() { return assets; }, get pageId() { return pageId; }, get selectedId() { return selId; }, get bp() { return bp; },
    get rev() { return rev; }, canUndo: () => past.length > 0, canRedo: () => future.length > 0,
    page: currentPage, find, select, setPage, setBp, load, newFromTemplate, validateProject,
    addNode, addTree, insertSmart, moveNode, moveBy, duplicateNode, deleteNode, setProp, setStyle, setToken, setSite,
    addPage, deletePage, setPageField, makeHome, addAsset, removeAsset, assetUsage, undo, redo, slugify,
    typeOf, isDesc,
    /* effective style value for key at a breakpoint following the CSS cascade base → tablet → mobile */
    effective(node, key, b) { const order = b === 'base' ? ['base'] : b === 'tablet' ? ['base', 'tablet'] : ['base', 'tablet', 'mobile']; let v; order.forEach((k) => { const x = node.style[k] && node.style[k][key]; if (x !== undefined && x !== '') v = x; }); return v; },
  };
})();
