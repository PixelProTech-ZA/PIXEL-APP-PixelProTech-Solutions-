/* PixelProTech Pixel App — inspector.js
   Small DOM helpers + the property inspector. Every control writes to the engine; the canvas reacts to engine events. */
(function () {
  'use strict';
  const PX = (window.PX = window.PX || {});

  /* ---------- DOM helpers ---------- */
  function el(tag, attrs) {
    const e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach((k) => {
      const v = attrs[k]; if (v == null || v === false) return;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'value') e.value = v; else e.setAttribute(k, v === true ? '' : v);
    });
    for (let i = 2; i < arguments.length; i++) { const c = arguments[i]; if (c == null || c === false) continue; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return e;
  }
  const icon = (name, cls) => `<svg class="ic ${cls || ''}" aria-hidden="true" focusable="false"><use href="icons.svg#${name}"/></svg>`;
  function iconBtn(name, label, onclick, cls) { return el('button', { type: 'button', class: 'ibtn ' + (cls || ''), title: label, 'aria-label': label, html: icon(name), onclick }); }
  PX.el = el; PX.icon = icon; PX.iconBtn = iconBtn;

  const E = () => PX.Engine;
  const OR = { origin: 'inspector' };

  function field(label, control, hint) {
    return el('div', { class: 'fld' }, el('label', { class: 'fl', text: label }), control, hint ? el('div', { class: 'hint', text: hint }) : null);
  }
  function group(title, body, num) {
    return el('section', { class: 'grp' }, el('h3', { class: 'gh' }, el('span', { class: 'gn', text: num || '' }), title), body);
  }
  const colorOk = (v) => /^#[0-9a-f]{6}$/i.test(v);

  /* ---------- widgets ---------- */
  function wText(get, set, multi) {
    const i = el(multi ? 'textarea' : 'input', multi ? { rows: 3 } : { type: 'text' });
    i.value = get() == null ? '' : get(); i.addEventListener('input', () => set(i.value)); return i;
  }
  function wSelect(opts, get, set) {
    const s = el('select');
    opts.forEach(([v, l]) => s.appendChild(el('option', { value: v, text: l })));
    s.value = String(get() == null ? '' : get()); if (s.value !== String(get() == null ? '' : get())) s.value = opts[0][0];
    s.addEventListener('change', () => set(s.value)); return s;
  }
  function wBool(get, set, label) {
    const i = el('input', { type: 'checkbox' }); i.checked = !!get(); i.addEventListener('change', () => set(i.checked));
    return el('label', { class: 'chk' }, i, el('span', { text: label || 'Enabled' }));
  }
  function wNumber(get, set, def, inherited) {
    const i = el('input', { type: 'number', inputmode: 'decimal' });
    if (def.min != null) i.min = def.min; if (def.max != null) i.max = def.max;
    const v = get(); i.value = v == null || v === '' ? '' : v; if (inherited != null) i.placeholder = String(inherited); else i.placeholder = 'auto';
    i.addEventListener('input', () => { if (i.value === '') return set(''); const n = Number(i.value); if (Number.isFinite(n)) set(Math.min(def.max != null ? def.max : n, Math.max(def.min != null ? def.min : n, n))); });
    return i;
  }
  function wColor(get, set, inherited) {
    const v = get() || ''; const pick = el('input', { type: 'color', 'aria-label': 'Pick colour' });
    const txt = el('input', { type: 'text', placeholder: inherited || 'inherit', spellcheck: 'false' });
    pick.value = colorOk(v) ? v : (colorOk(inherited || '') ? inherited : '#000000'); txt.value = v;
    pick.addEventListener('input', () => { txt.value = pick.value; set(pick.value); });
    txt.addEventListener('input', () => { const t = txt.value.trim(); if (t === '') return set(''); if (colorOk(t)) { pick.value = t; set(t); } });
    const clr = iconBtn('i-close', 'Clear (inherit)', () => { txt.value = ''; set(''); }, 'sm');
    return el('div', { class: 'colorrow' }, pick, txt, clr);
  }
  function wLink(get, set) {
    const eng = E(); const cur = String(get() || '');
    const kinds = [['none', '— none —'], ['page', 'Page'], ['anchor', 'Section on this page'], ['url', 'Web address'], ['mail', 'Email'], ['tel', 'Phone']];
    let kind = PX.linkKind(cur); if (kind === 'invalid') kind = 'url';
    const wrap = el('div', { class: 'linkw' }); const ksel = el('select', { 'aria-label': 'Target type' });
    kinds.forEach(([v, l]) => ksel.appendChild(el('option', { value: v, text: l }))); ksel.value = kind;
    const body = el('div', { class: 'linkb' });
    function build(k, init) {
      body.innerHTML = '';
      if (k === 'page') {
        const s = el('select', { 'aria-label': 'Page' }); eng.project.pages.forEach((p) => s.appendChild(el('option', { value: 'page:' + p.id, text: p.title || p.slug })));
        s.value = init && init.startsWith('page:') ? init : 'page:' + eng.project.pages[0].id; s.addEventListener('change', () => set(s.value)); body.appendChild(s); if (!init || !init.startsWith('page:')) set(s.value);
      } else if (k === 'anchor') {
        const anchors = []; PX.walk(eng.page().nodes, (n) => { if (n.type === 'section' && n.props.anchor) anchors.push(n.props.anchor); });
        if (!anchors.length) body.appendChild(el('div', { class: 'hint', text: 'No section on this page has an anchor id yet. Select a section and set one.' }));
        const s = el('select', { 'aria-label': 'Section' }); anchors.forEach((a) => s.appendChild(el('option', { value: '#' + a, text: '#' + a })));
        if (init && init.startsWith('#') && !anchors.includes(init.slice(1))) s.appendChild(el('option', { value: init, text: init + ' (missing)' }));
        s.value = init && init.startsWith('#') ? init : (anchors[0] ? '#' + anchors[0] : ''); if (anchors.length) { s.addEventListener('change', () => set(s.value)); if (!init) set(s.value); } body.appendChild(s);
      } else if (k === 'none') { /* nothing */ } else {
        const pre = { url: 'https://', mail: 'mailto:', tel: 'tel:' }[k]; const t = el('input', { type: 'text', placeholder: { url: 'https://example.com', mail: 'name@example.com', tel: '+27 12 345 6789' }[k], spellcheck: 'false' });
        t.value = init && init.toLowerCase().startsWith(pre) ? init.slice(pre.length) : (k === 'url' && init && /^https?:\/\//i.test(init) ? init : '');
        if (k === 'url' && init && /^https?:\/\//i.test(init)) t.value = init;
        t.addEventListener('input', () => { const v = t.value.trim(); set(v === '' ? '' : (k === 'url' ? (/^https?:\/\//i.test(v) ? v : 'https://' + v) : pre + v)); });
        body.appendChild(t);
      }
    }
    build(kind, cur);
    ksel.addEventListener('change', () => { set(''); build(ksel.value, ''); });
    wrap.appendChild(ksel); wrap.appendChild(body); return wrap;
  }
  function wLinks(get, set) {
    const root = el('div', { class: 'linkslist' });
    const draw = () => {
      root.innerHTML = ''; const arr = get().map((x) => Object.assign({}, x));
      arr.forEach((l, i) => {
        const row = el('div', { class: 'lkrow' });
        const lab = el('input', { type: 'text', placeholder: 'Label', value: l.label, 'aria-label': 'Link label' });
        lab.addEventListener('input', () => { const a = get().map((x) => Object.assign({}, x)); a[i].label = lab.value; set(a, true); });
        const tools = el('div', { class: 'ltools' },
          iconBtn('i-up', 'Move up', () => { if (i > 0) { const a = get().slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; set(a); draw(); } }, 'sm'),
          iconBtn('i-down', 'Move down', () => { if (i < arr.length - 1) { const a = get().slice(); [a[i + 1], a[i]] = [a[i], a[i + 1]]; set(a); draw(); } }, 'sm'),
          iconBtn('i-trash', 'Remove link', () => { const a = get().slice(); a.splice(i, 1); set(a); draw(); }, 'sm'));
        row.appendChild(el('div', { class: 'lhead' }, lab, tools));
        row.appendChild(wLink(() => (get()[i] || {}).href, (v) => { const a = get().map((x) => Object.assign({}, x)); if (a[i]) { a[i].href = v; set(a, true); } }));
        root.appendChild(row);
      });
      root.appendChild(el('button', { type: 'button', class: 'btn small', html: icon('i-plus') + '<span>Add link</span>', onclick: () => { const a = get().slice(); a.push({ label: 'Link', href: '' }); set(a); draw(); } }));
    };
    draw(); return root;
  }
  function wAsset(get, set, done) {
    const eng = E(); const wrap = el('div', { class: 'assetw' });
    const sel = el('select', { 'aria-label': 'Choose stored image' }); sel.appendChild(el('option', { value: '', text: '— none —' }));
    Object.values(eng.assets).forEach((a) => sel.appendChild(el('option', { value: a.id, text: a.name })));
    sel.value = get() || ''; sel.addEventListener('change', () => { set(sel.value); done && done(); });
    const file = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif', class: 'hidden' });
    const msg = el('div', { class: 'hint' });
    file.addEventListener('change', () => PX.uploadImage(file.files[0], msg).then((id) => { if (id) { set(id); done && done(); } }));
    const thumb = get() && eng.assets[get()] ? el('img', { class: 'thumb', src: eng.assets[get()].dataUrl, alt: '' }) : null;
    wrap.appendChild(sel); wrap.appendChild(el('button', { type: 'button', class: 'btn small', html: icon('i-import') + '<span>Upload image…</span>', onclick: () => file.click() }));
    wrap.appendChild(file); if (thumb) wrap.appendChild(thumb); wrap.appendChild(msg); return wrap;
  }

  /* Reads an image file into the project's asset store. Returns asset id or null. */
  PX.uploadImage = function (f, msgEl) {
    return new Promise((res) => {
      const say = (t, bad) => { if (msgEl) { msgEl.textContent = t; msgEl.className = 'hint' + (bad ? ' bad' : ''); } };
      if (!f) return res(null);
      if (!/^image\/(png|jpeg|webp|gif|svg\+xml|avif)$/.test(f.type)) { say('Unsupported file type: ' + (f.type || 'unknown'), true); return res(null); }
      if (f.size > 12 * 1024 * 1024) { say('File is larger than 12 MB — resize it first.', true); return res(null); }
      const r = new FileReader();
      r.onerror = () => { say('Could not read that file.', true); res(null); };
      r.onload = () => { const id = E().addAsset({ name: f.name, mime: f.type, size: f.size, dataUrl: r.result }); say(f.size > 1.5 * 1024 * 1024 ? `Added (${Math.round(f.size / 1024)} KB). Large — Preflight will flag it.` : 'Added.'); res(id); };
      r.readAsDataURL(f);
    });
  };

  /* ---------- node inspector ---------- */
  function nodeView(root, hooks) {
    const eng = E(); const f = eng.find(eng.selectedId); if (!f) return projectView(root, hooks);
    const n = f.node, def = PX.Types[n.type];
    root.appendChild(el('div', { class: 'ihead' },
      el('div', { class: 'ititle', html: icon(def.icon) + '<span>' + PX.esc(def.label) + '</span>' }),
      el('div', { class: 'iacts' },
        f.parent ? iconBtn('i-select', 'Select parent (Esc)', () => eng.select(f.parent.id), 'sm') : null,
        iconBtn('i-up', 'Move up (Alt+↑)', () => eng.moveBy(n.id, -1), 'sm'), iconBtn('i-down', 'Move down (Alt+↓)', () => eng.moveBy(n.id, 1), 'sm'),
        iconBtn('i-copy', 'Duplicate (Ctrl+D)', () => eng.duplicateNode(n.id), 'sm'), iconBtn('i-trash', 'Delete (Del)', () => eng.deleteNode(n.id), 'sm danger'))));
    if (def.fields.length) {
      const body = el('div');
      def.fields.forEach((fd) => {
        const get = () => n.props[fd.k]; const set = (v, noc) => eng.setProp(n.id, fd.k, fd.num ? Number(v) : v, OR);
        let w;
        if (fd.t === 'text') w = wText(get, set); else if (fd.t === 'textarea') w = wText(get, set, true);
        else if (fd.t === 'select') w = wSelect(fd.opts, get, set); else if (fd.t === 'bool') w = wBool(get, set, fd.label);
        else if (fd.t === 'link') w = wLink(get, set); else if (fd.t === 'links') w = wLinks(() => n.props.links || [], (a) => eng.setProp(n.id, 'links', a, OR));
        else if (fd.t === 'asset') w = wAsset(get, set, () => hooks.refresh());
        body.appendChild(fd.t === 'bool' ? el('div', { class: 'fld' }, w) : field(fd.label, w, fd.hint));
      });
      root.appendChild(group('Content', body, '01'));
    }
    // style
    const bpTabs = el('div', { class: 'seg', role: 'tablist', 'aria-label': 'Breakpoint being edited' });
    [['base', 'i-desktop', 'Desktop'], ['tablet', 'i-tablet', 'Tablet ≤900'], ['mobile', 'i-mobile', 'Mobile ≤600']].forEach(([b, ic, l]) => {
      bpTabs.appendChild(el('button', { type: 'button', role: 'tab', class: 'segb' + (eng.bp === b ? ' on' : ''), 'aria-selected': eng.bp === b, title: l, html: icon(ic) + '<span>' + l.split(' ')[0] + '</span>', onclick: () => eng.setBp(b) }));
    });
    const sb = el('div'); sb.appendChild(bpTabs);
    if (eng.bp !== 'base') sb.appendChild(el('div', { class: 'hint', text: `Values set here apply at ${eng.bp === 'tablet' ? '900' : '600'}px and below. Greyed numbers are inherited.` }));
    def.style.forEach((k) => {
      const sd = PX.StyleDefs[k]; if (!sd) return;
      const get = () => n.style[eng.bp] && n.style[eng.bp][k]; const set = (v) => eng.setStyle(n.id, k, v, eng.bp, OR);
      const inh = eng.bp === 'base' ? undefined : eng.effective(n, k, eng.bp === 'tablet' ? 'base' : 'tablet');
      let w;
      if (sd.t === 'number') w = wNumber(get, set, sd, inh);
      else if (sd.t === 'color') w = wColor(get, set, inh);
      else if (sd.t === 'select') w = wSelect(sd.opts, get, set);
      else if (sd.t === 'bool') w = wBool(get, set, sd.label);
      else if (sd.t === 'asset') w = wAsset(get, set, () => hooks.refresh());
      sb.appendChild(sd.t === 'bool' ? el('div', { class: 'fld' }, w) : field(sd.label, w));
    });
    root.appendChild(group('Layout & style', sb, '02'));
  }

  /* ---------- project / page inspector ---------- */
  function projectView(root, hooks) {
    const eng = E(); const pr = eng.project; const pg = eng.page();
    const pb = el('div');
    pb.appendChild(field('Page title', wText(() => pg.title, (v) => eng.setPageField(pg.id, 'title', v))));
    const isHome = pr.pages[0] === pg;
    pb.appendChild(field('File name', isHome ? el('div', { class: 'ro', text: 'index.html (home page)' }) : wText(() => pg.slug, (v) => eng.setPageField(pg.id, 'slug', v)), isHome ? null : 'Exports as <name>.html'));
    const row = el('div', { class: 'btnrow' });
    if (!isHome) row.appendChild(el('button', { type: 'button', class: 'btn small', text: 'Make home page', onclick: () => { eng.makeHome(pg.id); hooks.refresh(); } }));
    if (pr.pages.length > 1) row.appendChild(el('button', { type: 'button', class: 'btn small danger', html: icon('i-trash') + '<span>Delete page</span>', onclick: () => hooks.confirm(`Delete page "${pg.title}"? Links to it will be flagged by Preflight.`, () => eng.deletePage(pg.id)) }));
    pb.appendChild(row);
    root.appendChild(group('Page', pb, '01'));

    const sb = el('div');
    sb.appendChild(field('Site description', wText(() => pr.settings.description, (v) => eng.setSite('description', v), true), 'Used as the meta description of every page.'));
    sb.appendChild(field('Language code', wText(() => pr.settings.lang, (v) => eng.setSite('lang', v.trim()))));
    root.appendChild(group('Site', sb, '02'));

    const tb = el('div'); const c = pr.tokens.colors;
    [['bg', 'Background'], ['surface', 'Surface'], ['text', 'Text'], ['muted', 'Muted text'], ['accent', 'Accent'], ['accentText', 'Text on accent'], ['line', 'Lines & borders']].forEach(([k, l]) => tb.appendChild(field(l, wColor(() => c[k], (v) => v && eng.setToken('colors', k, v)))));
    const fopts = Object.keys(PX.FONT_STACKS).map((k) => [k, PX.FONT_STACKS[k][0]]);
    [['head', 'Heading font'], ['body', 'Body font'], ['mono', 'Label font']].forEach(([k, l]) => tb.appendChild(field(l, wSelect(fopts, () => pr.tokens.fonts[k], (v) => eng.setToken('fonts', k, v)))));
    tb.appendChild(el('div', { class: 'hint', text: 'Fonts are installed system fonts; appearance varies by device.' }));
    tb.appendChild(field('Corner radius (px)', wNumber(() => pr.tokens.radius, (v) => v !== '' && eng.setToken(null, 'radius', v), { min: 0, max: 60 })));
    tb.appendChild(field('Base text size (px)', wNumber(() => pr.tokens.baseSize, (v) => v !== '' && eng.setToken(null, 'baseSize', v), { min: 12, max: 24 })));
    root.appendChild(group('Design tokens', tb, '03'));

    const ab = el('div'); const list = Object.values(eng.assets);
    if (!list.length) ab.appendChild(el('div', { class: 'hint', text: 'No images stored in this project.' }));
    list.forEach((a) => {
      const used = eng.assetUsage(a.id);
      ab.appendChild(el('div', { class: 'arow' }, el('img', { class: 'thumb sm', src: a.dataUrl, alt: '' }), el('div', { class: 'ainfo' }, el('div', { class: 'aname', text: a.name }), el('div', { class: 'hint', text: `${Math.round((a.size || 0) / 1024)} KB · used ${used}×` })),
        iconBtn('i-trash', 'Remove asset', () => hooks.confirm(used ? `"${a.name}" is used ${used}×. Removing it leaves empty image slots, which Preflight will flag.` : `Remove "${a.name}"?`, () => { eng.removeAsset(a.id); hooks.refresh(); }), 'sm danger')));
    });
    const file = el('input', { type: 'file', accept: 'image/*', class: 'hidden' }); const msg = el('div', { class: 'hint' });
    file.addEventListener('change', () => PX.uploadImage(file.files[0], msg).then(() => hooks.refresh()));
    ab.appendChild(el('button', { type: 'button', class: 'btn small', html: icon('i-import') + '<span>Add image…</span>', onclick: () => file.click() })); ab.appendChild(file); ab.appendChild(msg);
    root.appendChild(group('Assets', ab, '04'));
  }

  PX.Inspector = {
    render(root, hooks) { root.innerHTML = ''; const eng = E(); if (!eng.project) return; if (eng.selectedId) nodeView(root, hooks); else projectView(root, hooks); },
  };
})();
