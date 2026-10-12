/* PixelProTech Pixel App — components.js
   Component registry: schemas (editable props + style keys), HTML rendering and CSS generation.
   One renderer is shared by the editor canvas and the exporter so the export matches the canvas. */
(function () {
  'use strict';
  const PX = (window.PX = window.PX || {});

  /* ---------- helpers ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeColor = (v) => {
    v = String(v == null ? '' : v).trim();
    return /^(#[0-9a-f]{3,8}|[a-z]{3,20}|rgba?\([\d\s.,%/]+\)|var\(--c-[a-z]+\))$/i.test(v) ? v : '';
  };
  const num = (v) => { if (v === '' || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
  let seq = 0;
  PX.uid = () => 'n' + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 5) + (seq++).toString(36);
  PX.esc = esc;

  const BPS = ['base', 'tablet', 'mobile'];
  const BP_MEDIA = { tablet: '(max-width:900px)', mobile: '(max-width:600px)' };
  PX.BPS = BPS;
  PX.BP_WIDTH = { base: 0, tablet: 768, mobile: 375 };

  const FONT_STACKS = {
    system: ['System UI', 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif'],
    humanist: ['Humanist (Gill Sans / Calibri)', '"Gill Sans","Gill Sans MT",Calibri,"Trebuchet MS",sans-serif'],
    serif: ['Serif (Georgia)', 'Georgia,"Times New Roman",Times,serif'],
    mono: ['Mono (Consolas / Menlo)', 'ui-monospace,"SF Mono",Consolas,Menlo,"Courier New",monospace'],
    impact: ['Condensed display', '"Arial Narrow","Franklin Gothic Medium",Impact,"Helvetica Neue",Arial,sans-serif'],
  };
  PX.FONT_STACKS = FONT_STACKS;

  /* ---------- link model ----------
     href strings: ''  |  page:<pageId>  |  #anchor  |  https://…  |  mailto:…  |  tel:…            */
  function linkKind(h) {
    h = String(h || '');
    if (!h) return 'none';
    if (h.startsWith('page:')) return 'page';
    if (h.startsWith('#')) return 'anchor';
    if (/^https?:\/\//i.test(h)) return 'url';
    if (/^mailto:/i.test(h)) return 'mail';
    if (/^tel:/i.test(h)) return 'tel';
    return 'invalid';
  }
  PX.linkKind = linkKind;

  function pageFile(project, page) {
    const first = project.pages[0];
    return page === first ? 'index.html' : (page.slug || 'page') + '.html';
  }
  PX.pageFile = pageFile;

  /* Returns the resolved target or null when there is no valid target (export then emits no href at all,
     so a broken link is never disguised as a working "#" link; Pixel Preflight reports it). */
  function resolveHref(h, ctx) {
    const k = linkKind(h);
    if (ctx.edit) return '#';
    if (k === 'page') { const p = ctx.project.pages.find((x) => x.id === h.slice(5)); return p ? pageFile(ctx.project, p) : null; }
    if (k === 'anchor' || k === 'url' || k === 'mail' || k === 'tel') return h;
    return null;
  }
  const hrefAttr = (h, ctx) => { const r = resolveHref(h, ctx); return r == null ? '' : ` href="${esc(r)}"`; };

  /* ---------- style catalogue ---------- */
  const O = (a) => a.map((x) => (Array.isArray(x) ? x : [x, x]));
  const S = {
    bg: { label: 'Background', t: 'color', css: (v) => { v = safeColor(v); return v && `background-color:${v}`; } },
    bgImage: { label: 'Background image', t: 'asset' },
    color: { label: 'Text colour', t: 'color', css: (v) => { v = safeColor(v); return v && `color:${v}`; } },
    font: { label: 'Font', t: 'select', opts: O([['', 'Inherit'], ['head', 'Heading font'], ['body', 'Body font'], ['mono', 'Mono font']]), css: (v) => ['head', 'body', 'mono'].includes(v) && `font-family:var(--f-${v})` },
    fontSize: { label: 'Size (px)', t: 'number', min: 8, max: 220, css: (v) => num(v) != null && `font-size:${num(v)}px` },
    fontWeight: { label: 'Weight', t: 'select', opts: O([['', 'Default'], '400', '500', '600', '700', '800']), css: (v) => /^[1-9]00$/.test(v) && `font-weight:${v}` },
    align: { label: 'Text align', t: 'select', opts: O([['', 'Default'], 'left', 'center', 'right']), css: (v) => ['left', 'center', 'right'].includes(v) && `text-align:${v}` },
    padY: { label: 'Padding top/bottom', t: 'number', min: 0, max: 400, css: (v) => num(v) != null && `padding-top:${num(v)}px;padding-bottom:${num(v)}px` },
    padX: { label: 'Padding left/right', t: 'number', min: 0, max: 400, css: (v) => num(v) != null && `padding-left:${num(v)}px;padding-right:${num(v)}px` },
    mt: { label: 'Margin top', t: 'number', min: 0, max: 400, css: (v) => num(v) != null && `margin-top:${num(v)}px` },
    mb: { label: 'Margin bottom', t: 'number', min: 0, max: 400, css: (v) => num(v) != null && `margin-bottom:${num(v)}px` },
    maxW: { label: 'Max width (px)', t: 'number', min: 0, max: 2400, css: (v) => num(v) != null && (num(v) > 0 ? `max-width:${num(v)}px` : 'max-width:none') },
    w: { label: 'Width (%)', t: 'number', min: 1, max: 100, css: (v) => num(v) != null && `width:${num(v)}%` },
    h: { label: 'Height (px)', t: 'number', min: 0, max: 1600, css: (v) => num(v) != null && `height:${num(v)}px` },
    gap: { label: 'Gap (px)', t: 'number', min: 0, max: 200, css: (v) => num(v) != null && `gap:${num(v)}px` },
    cols: { label: 'Columns', t: 'select', opts: O([['1', '1 column'], ['2', '2 columns'], ['3', '3 columns'], ['4', '4 columns'], ['2fr 1fr', '2 : 1'], ['1fr 2fr', '1 : 2'], ['3fr 1fr', '3 : 1'], ['1fr 3fr', '1 : 3']]),
      css: (v) => { v = String(v); if (/^[1-6]$/.test(v)) return `grid-template-columns:repeat(${v},minmax(0,1fr))`; const m = v.match(/^(\d)fr (\d)fr$/); return m ? `grid-template-columns:minmax(0,${m[1]}fr) minmax(0,${m[2]}fr)` : false; } },
    direction: { label: 'Direction', t: 'select', opts: O([['column', 'Vertical'], ['row', 'Horizontal']]), css: (v) => (v === 'row' ? 'flex-direction:row;flex-wrap:wrap' : v === 'column' ? 'flex-direction:column;flex-wrap:nowrap' : false) },
    justify: { label: 'Justify', t: 'select', opts: O([['', 'Default'], ['start', 'Start'], ['center', 'Center'], ['end', 'End'], ['between', 'Space between']]), css: (v) => ({ start: 'justify-content:flex-start', center: 'justify-content:center', end: 'justify-content:flex-end', between: 'justify-content:space-between' }[v] || false) },
    alignItems: { label: 'Align items', t: 'select', opts: O([['', 'Default'], ['stretch', 'Stretch'], ['start', 'Start'], ['center', 'Center'], ['end', 'End']]), css: (v) => ({ stretch: 'align-items:stretch', start: 'align-items:flex-start', center: 'align-items:center', end: 'align-items:flex-end' }[v] || false) },
    radius: { label: 'Corner radius', t: 'number', min: 0, max: 200, css: (v) => num(v) != null && `border-radius:${num(v)}px` },
    border: { label: 'Border', t: 'select', opts: O([['', 'Default'], ['none', 'None'], ['line', 'Line'], ['accent', 'Accent']]), css: (v) => ({ none: 'border:0', line: 'border:1px solid var(--c-line)', accent: 'border:2px solid var(--c-accent)' }[v] || false) },
    hidden: { label: 'Hide at this size', t: 'bool', css: (v) => v === true && 'display:none !important' },
  };
  PX.StyleDefs = S;

  /* ---------- containment ---------- */
  const CONTAINERS = ['section', 'columns', 'stack', 'card'];
  const ROOT_OK = ['nav', 'section', 'footer', 'spacer', 'divider'];
  function canContain(parentType, childType) {
    if (parentType === 'root') return ROOT_OK.includes(childType);
    if (!CONTAINERS.includes(parentType)) return false;
    return !['nav', 'footer', 'section'].includes(childType);
  }

  /* ---------- component definitions ---------- */
  const T = {};
  const cls = (n, base, extra) => `${base} n-${n.id}${extra ? ' ' + extra : ''}`;
  const kids = (n, ctx) => (n.children || []).map((c) => renderNode(c, ctx)).join('');
  const lines = (s) => String(s == null ? '' : s).split(/\r?\n/);
  const ed = (ctx, key, multi) => (ctx.edit ? ` data-edit="${key}"${multi ? ' data-multiline="1"' : ''}` : '');
  const headLevel = (n) => { const l = Number(n.props.level); return l >= 1 && l <= 4 ? l : 2; };

  T.section = {
    label: 'Section', icon: 'i-section', container: true, group: 'Structure',
    defaults: () => ({ props: { label: 'Section', anchor: '' }, style: { base: { padY: 80, padX: 24, maxW: 1120, gap: 24 }, tablet: { padY: 64 }, mobile: { padY: 48, padX: 20 } } }),
    fields: [{ k: 'label', label: 'Layer name', t: 'text' }, { k: 'anchor', label: 'Anchor id (for #links)', t: 'text', hint: 'Letters, digits, dashes. Lets buttons and nav link to this section.' }],
    style: ['bg', 'bgImage', 'color', 'padY', 'padX', 'maxW', 'gap', 'align', 'hidden'],
    inner: ['maxW', 'padX', 'gap'],
    render: (n, ctx, a) => `<section${a} class="${cls(n, 'px-section')}"${n.props.anchor ? ` id="${esc(n.props.anchor)}"` : ''}><div class="px-inner">${kids(n, ctx)}</div></section>`,
  };
  T.columns = {
    label: 'Columns', icon: 'i-columns', container: true, group: 'Structure',
    defaults: () => ({ props: { label: 'Columns' }, style: { base: { cols: '3', gap: 24 }, tablet: { cols: '2' }, mobile: { cols: '1' } } }),
    fields: [{ k: 'label', label: 'Layer name', t: 'text' }],
    style: ['cols', 'gap', 'alignItems', 'justify', 'padY', 'mt', 'mb', 'hidden'],
    render: (n, ctx, a) => `<div${a} class="${cls(n, 'px-columns')}">${kids(n, ctx)}</div>`,
  };
  T.stack = {
    label: 'Stack', icon: 'i-stack', container: true, group: 'Structure',
    defaults: () => ({ props: { label: 'Stack' }, style: { base: { gap: 12, direction: 'column' } } }),
    fields: [{ k: 'label', label: 'Layer name', t: 'text' }],
    style: ['direction', 'gap', 'align', 'alignItems', 'justify', 'bg', 'padY', 'padX', 'maxW', 'mt', 'mb', 'hidden'],
    flex: true,
    render: (n, ctx, a) => `<div${a} class="${cls(n, 'px-stack')}">${kids(n, ctx)}</div>`,
  };
  T.card = {
    label: 'Card', icon: 'i-card', container: true, group: 'Structure',
    defaults: () => ({ props: { label: 'Card' }, style: { base: {} } }),
    fields: [{ k: 'label', label: 'Layer name', t: 'text' }],
    style: ['bg', 'color', 'border', 'radius', 'padY', 'padX', 'gap', 'align', 'maxW', 'mt', 'mb', 'hidden'],
    flex: true,
    render: (n, ctx, a) => `<div${a} class="${cls(n, 'px-card')}">${kids(n, ctx)}</div>`,
  };
  T.heading = {
    label: 'Heading', icon: 'i-heading', group: 'Content', blockText: true,
    defaults: () => ({ props: { text: 'Heading', level: 2 }, style: { base: {} } }),
    fields: [{ k: 'text', label: 'Text', t: 'textarea' }, { k: 'level', label: 'Level', t: 'select', opts: O([['1', 'H1 — page title'], ['2', 'H2 — section'], ['3', 'H3'], ['4', 'H4']]), num: true }],
    style: ['color', 'font', 'fontSize', 'fontWeight', 'align', 'maxW', 'mt', 'mb', 'hidden'],
    render: (n, ctx, a) => { const l = headLevel(n); return `<h${l}${a} class="${cls(n, 'px-heading')}"${ed(ctx, 'text')}>${esc(n.props.text)}</h${l}>`; },
  };
  T.text = {
    label: 'Text', icon: 'i-text', group: 'Content', blockText: true,
    defaults: () => ({ props: { text: 'Write something here.', variant: 'body' }, style: { base: {} } }),
    fields: [{ k: 'text', label: 'Text', t: 'textarea' }, { k: 'variant', label: 'Style', t: 'select', opts: O([['body', 'Body'], ['lead', 'Lead paragraph'], ['eyebrow', 'Eyebrow label'], ['small', 'Small print']]) }],
    style: ['color', 'font', 'fontSize', 'fontWeight', 'align', 'maxW', 'mt', 'mb', 'hidden'],
    render: (n, ctx, a) => `<p${a} class="${cls(n, 'px-text px-text-' + esc(n.props.variant || 'body'))}"${ed(ctx, 'text', true)}>${esc(n.props.text).replace(/\r?\n/g, '<br>')}</p>`,
  };
  T.list = {
    label: 'List', icon: 'i-list', group: 'Content', blockText: true,
    defaults: () => ({ props: { items: 'First item\nSecond item\nThird item', marker: 'check' }, style: { base: {} } }),
    fields: [{ k: 'items', label: 'Items (one per line)', t: 'textarea' }, { k: 'marker', label: 'Marker', t: 'select', opts: O([['check', 'Check'], ['dot', 'Square dot'], ['number', 'Numbered'], ['none', 'None']]) }],
    style: ['color', 'fontSize', 'gap', 'align', 'maxW', 'mt', 'mb', 'hidden'],
    render: (n, ctx, a) => {
      const m = ['check', 'dot', 'number', 'none'].includes(n.props.marker) ? n.props.marker : 'check';
      const li = lines(n.props.items).filter((x) => x.trim() !== '').map((x) => `<li>${esc(x)}</li>`).join('');
      const tag = m === 'number' ? 'ol' : 'ul';
      return `<${tag}${a} class="${cls(n, 'px-list px-list-' + m)}">${li}</${tag}>`;
    },
  };
  T.quote = {
    label: 'Quote', icon: 'i-quote', group: 'Content', blockText: true,
    defaults: () => ({ props: { text: 'A short quotation from a customer or partner.', cite: 'Name, role' }, style: { base: {} } }),
    fields: [{ k: 'text', label: 'Quotation', t: 'textarea' }, { k: 'cite', label: 'Attribution', t: 'text' }],
    style: ['color', 'fontSize', 'align', 'maxW', 'mt', 'mb', 'hidden'],
    render: (n, ctx, a) => `<figure${a} class="${cls(n, 'px-quote')}"><blockquote><p${ed(ctx, 'text', true)}>${esc(n.props.text).replace(/\r?\n/g, '<br>')}</p></blockquote>${n.props.cite ? `<figcaption>${esc(n.props.cite)}</figcaption>` : ''}</figure>`,
  };
  T.button = {
    label: 'Button', icon: 'i-button', group: 'Content',
    defaults: () => ({ props: { label: 'Button', href: '', variant: 'solid', size: 'md', newTab: false }, style: { base: {} } }),
    fields: [{ k: 'label', label: 'Label', t: 'text' }, { k: 'href', label: 'Target', t: 'link' },
      { k: 'variant', label: 'Variant', t: 'select', opts: O([['solid', 'Solid'], ['outline', 'Outline'], ['ghost', 'Ghost']]) },
      { k: 'size', label: 'Size', t: 'select', opts: O([['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large']]) },
      { k: 'newTab', label: 'Open in new tab', t: 'bool' }],
    style: ['bg', 'color', 'fontSize', 'radius', 'mt', 'mb', 'w', 'hidden'],
    render: (n, ctx, a) => {
      const v = ['solid', 'outline', 'ghost'].includes(n.props.variant) ? n.props.variant : 'solid';
      const sz = ['sm', 'md', 'lg'].includes(n.props.size) ? n.props.size : 'md';
      const nt = n.props.newTab && !ctx.edit && /^https?:/i.test(n.props.href || '') ? ' target="_blank" rel="noopener"' : '';
      return `<a${a} class="${cls(n, `px-btn px-btn-${v} px-sz-${sz}`)}"${hrefAttr(n.props.href, ctx)}${nt}${ed(ctx, 'label')}>${esc(n.props.label)}</a>`;
    },
  };
  T.link = {
    label: 'Link', icon: 'i-link', group: 'Content',
    defaults: () => ({ props: { text: 'Link text', href: '' }, style: { base: {} } }),
    fields: [{ k: 'text', label: 'Text', t: 'text' }, { k: 'href', label: 'Target', t: 'link' }],
    style: ['color', 'fontSize', 'fontWeight', 'mt', 'mb', 'hidden'],
    render: (n, ctx, a) => `<a${a} class="${cls(n, 'px-link')}"${hrefAttr(n.props.href, ctx)}${ed(ctx, 'text')}>${esc(n.props.text)}</a>`,
  };
  T.image = {
    label: 'Image', icon: 'i-media', group: 'Content',
    defaults: () => ({ props: { assetId: '', src: '', alt: '', fit: 'cover', ratio: '16/9' }, style: { base: {} } }),
    fields: [{ k: 'assetId', label: 'Image file', t: 'asset' }, { k: 'src', label: 'Or external image URL', t: 'text', hint: 'Hot-linked images cannot be checked offline (Preflight reports NOT TESTABLE).' },
      { k: 'alt', label: 'Alt text', t: 'text' },
      { k: 'fit', label: 'Fit', t: 'select', opts: O([['cover', 'Cover (crop)'], ['contain', 'Contain']]) },
      { k: 'ratio', label: 'Aspect ratio', t: 'select', opts: O([['auto', 'Natural'], ['1/1', '1:1'], ['4/3', '4:3'], ['3/2', '3:2'], ['16/9', '16:9'], ['21/9', '21:9']]) }],
    style: ['w', 'h', 'radius', 'maxW', 'mt', 'mb', 'hidden'],
    propCss: (n) => {
      const r = /^(auto|\d{1,2}\/\d{1,2})$/.test(n.props.ratio) ? n.props.ratio : 'auto';
      return `aspect-ratio:${r};object-fit:${n.props.fit === 'contain' ? 'contain' : 'cover'}`;
    },
    render: (n, ctx, a) => {
      const url = n.props.assetId ? ctx.assetUrl(n.props.assetId) : (n.props.src || '');
      if (!url) return `<div${a} class="${cls(n, 'px-image px-img-empty')}" role="img" aria-label="Empty image slot"></div>`;
      return `<img${a} class="${cls(n, 'px-image')}" src="${esc(url)}" alt="${esc(n.props.alt || '')}" loading="lazy" decoding="async">`;
    },
  };
  T.nav = {
    label: 'Navigation', icon: 'i-nav', group: 'Site',
    defaults: (c) => ({ props: { label: 'Navigation', brand: 'Your brand', logoAsset: '', sticky: true, links: [{ label: 'Home', href: c && c.firstPageId ? 'page:' + c.firstPageId : '' }] }, style: { base: {} } }),
    fields: [{ k: 'brand', label: 'Brand name', t: 'text' }, { k: 'logoAsset', label: 'Logo image', t: 'asset' }, { k: 'sticky', label: 'Stick to top while scrolling', t: 'bool' }, { k: 'links', label: 'Links', t: 'links' }],
    style: ['bg', 'color', 'hidden'],
    propCss: (n) => (n.props.sticky ? 'position:sticky;top:0' : ''),
    render: (n, ctx, a) => {
      const home = ctx.project.pages[0] ? pageFile(ctx.project, ctx.project.pages[0]) : '#';
      const logo = n.props.logoAsset && ctx.assetUrl(n.props.logoAsset) ? `<img src="${esc(ctx.assetUrl(n.props.logoAsset))}" alt="">` : '';
      const links = (n.props.links || []).map((l) => `<a${hrefAttr(l.href, ctx)}>${esc(l.label)}</a>`).join('');
      return `<header${a} class="${cls(n, 'px-nav')}"><div class="px-nav-in"><a class="px-brand" href="${ctx.edit ? '#' : esc(home)}">${logo}<span${ed(ctx, 'brand')}>${esc(n.props.brand)}</span></a><input type="checkbox" id="navt-${n.id}" class="px-nav-check" aria-label="Show menu"><label for="navt-${n.id}" class="px-nav-toggle" title="Menu"><span></span></label><nav class="px-nav-links" aria-label="Main">${links}</nav></div></header>`;
    },
  };
  T.footer = {
    label: 'Footer', icon: 'i-footer', group: 'Site',
    defaults: () => ({ props: { label: 'Footer', text: 'Your business name. All rights reserved.', links: [] }, style: { base: {} } }),
    fields: [{ k: 'text', label: 'Text', t: 'textarea' }, { k: 'links', label: 'Links', t: 'links' }],
    style: ['bg', 'color', 'hidden'],
    render: (n, ctx, a) => `<footer${a} class="${cls(n, 'px-footer')}"><div class="px-footer-in"><p class="px-footer-text"${ed(ctx, 'text', true)}>${esc(n.props.text).replace(/\r?\n/g, '<br>')}</p>${(n.props.links || []).length ? `<nav aria-label="Footer">${n.props.links.map((l) => `<a${hrefAttr(l.href, ctx)}>${esc(l.label)}</a>`).join('')}</nav>` : ''}</div></footer>`,
  };
  T.spacer = {
    label: 'Spacer', icon: 'i-spacer', group: 'Structure',
    defaults: () => ({ props: {}, style: { base: { h: 40 }, mobile: { h: 24 } } }),
    fields: [], style: ['h', 'hidden'],
    render: (n, ctx, a) => `<div${a} class="${cls(n, 'px-spacer')}" aria-hidden="true"></div>`,
  };
  T.divider = {
    label: 'Divider', icon: 'i-divider', group: 'Structure',
    defaults: () => ({ props: {}, style: { base: {} } }),
    fields: [], style: ['w', 'mt', 'mb', 'hidden'],
    render: (n, ctx, a) => `<hr${a} class="${cls(n, 'px-divider')}">`,
  };

  PX.Types = T;
  PX.canContain = canContain;
  PX.isContainer = (t) => CONTAINERS.includes(t);

  /* ---------- node factory ---------- */
  function mergeStyle(a, b) {
    const out = { base: {}, tablet: {}, mobile: {} };
    BPS.forEach((bp) => { out[bp] = Object.assign({}, a && a[bp], b && b[bp]); });
    return out;
  }
  function normStyle(s) {
    if (!s) return {};
    return BPS.some((b) => s[b]) ? s : { base: s };
  }
  function N(type, props, style, children, ctx) {
    const d = T[type].defaults(ctx);
    const given = normStyle(style);
    return {
      id: PX.uid(), type,
      props: Object.assign({}, d.props, props || {}),
      style: mergeStyle(d.style, given),
      children: children || [],
    };
  }
  PX.N = N;
  PX.create = (type, ctx) => N(type, null, null, [], ctx);

  PX.describe = (n) => {
    const d = T[n.type]; if (!d) return n.type;
    if (n.props.label && ['section', 'columns', 'stack', 'card', 'nav', 'footer'].includes(n.type)) return n.props.label;
    const t = n.props.text || n.props.label || n.props.brand || '';
    return d.label + (t ? ' — ' + String(t).replace(/\s+/g, ' ').slice(0, 28) : '');
  };

  /* ---------- rendering ---------- */
  function renderNode(n, ctx) {
    const d = T[n.type];
    if (!d) return '';
    const attr = ctx.edit ? ` data-px="${n.id}" data-type="${n.type}"` : '';
    return d.render(n, ctx, attr);
  }
  PX.renderNode = renderNode;
  PX.renderNodes = (nodes, ctx) => nodes.map((n) => renderNode(n, ctx)).join('');

  /* ---------- CSS ---------- */
  const BASE_CSS = `*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--c-bg);color:var(--c-text);font-family:var(--f-body);font-size:var(--base-size);line-height:1.6;overflow-wrap:break-word}
img{max-width:100%}a{color:var(--c-accent)}
.px-section{width:100%}.px-inner{max-width:1120px;margin:0 auto;padding:0 24px;display:flex;flex-direction:column;gap:24px}
.px-columns{display:grid;gap:24px;grid-template-columns:repeat(3,minmax(0,1fr))}
.px-stack{display:flex;flex-direction:column;gap:12px;min-width:0}
.px-card{display:flex;flex-direction:column;gap:12px;background:var(--c-surface);border:1px solid var(--c-line);border-radius:var(--radius);padding:28px;min-width:0}
.px-heading{margin:0;font-family:var(--f-head);line-height:1.15;font-weight:700;letter-spacing:-.01em}
h1.px-heading{font-size:clamp(2.1rem,5.2vw,3.6rem)}h2.px-heading{font-size:clamp(1.65rem,3.6vw,2.4rem)}h3.px-heading{font-size:1.35rem}h4.px-heading{font-size:1.1rem}
.px-text{margin:0}.px-text-lead{font-size:1.2rem;color:var(--c-muted)}.px-text-eyebrow{font:600 .78rem/1.2 var(--f-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--c-accent)}.px-text-small{font-size:.875rem;color:var(--c-muted)}
.px-btn{display:inline-flex;align-items:center;justify-content:center;align-self:flex-start;text-decoration:none;font:600 1rem/1.2 var(--f-body);padding:.85em 1.4em;border-radius:var(--radius);border:2px solid var(--c-accent);cursor:pointer;text-align:center}
.px-btn-solid{background:var(--c-accent);color:var(--c-accent-text)}.px-btn-outline{background:transparent;color:var(--c-accent)}.px-btn-ghost{background:transparent;border-color:transparent;color:var(--c-text);text-decoration:underline}
.px-btn:hover{filter:brightness(1.1)}.px-sz-sm{font-size:.875rem}.px-sz-lg{font-size:1.15rem}
.px-link{align-self:flex-start;font-weight:600}
.px-image{display:block;width:100%;height:auto;border-radius:var(--radius)}
.px-img-empty{background:repeating-linear-gradient(135deg,transparent 0 10px,var(--c-line) 10px 11px);border:1px dashed var(--c-muted);min-height:140px}
.px-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px;counter-reset:pxl}
.px-list li{position:relative;padding-left:1.7em}.px-list-none li{padding-left:0}
.px-list-check li::before{content:"";position:absolute;left:.1em;top:.35em;width:.85em;height:.45em;border-left:2px solid var(--c-accent);border-bottom:2px solid var(--c-accent);transform:rotate(-45deg)}
.px-list-dot li::before{content:"";position:absolute;left:.15em;top:.62em;width:.45em;height:.45em;background:var(--c-accent)}
.px-list-number li{counter-increment:pxl}.px-list-number li::before{content:counter(pxl,decimal-leading-zero);position:absolute;left:0;top:.1em;font:600 .8em var(--f-mono);color:var(--c-accent)}.px-list-number li{padding-left:2.2em}
.px-quote{margin:0;display:flex;flex-direction:column;gap:10px;border-left:3px solid var(--c-accent);padding-left:20px}.px-quote blockquote{margin:0;font-size:1.2rem;line-height:1.45}.px-quote p{margin:0}.px-quote figcaption{color:var(--c-muted);font-size:.9rem}
.px-divider{width:100%;border:0;border-top:1px solid var(--c-line);margin:0}.px-spacer{width:100%}
.px-nav{background:var(--c-bg);border-bottom:1px solid var(--c-line);z-index:20}
.px-nav-in{max-width:1120px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;gap:20px;position:relative}
.px-brand{display:flex;align-items:center;gap:10px;font:700 1.1rem/1 var(--f-head);color:var(--c-text);text-decoration:none;margin-right:auto}.px-brand img{height:32px;width:auto}
.px-nav-links{display:flex;gap:22px;flex-wrap:wrap}.px-nav-links a{color:var(--c-muted);text-decoration:none;font-weight:500}.px-nav-links a:hover,.px-nav-links a[aria-current=page]{color:var(--c-text)}.px-nav-links a[aria-current=page]{box-shadow:0 2px 0 var(--c-accent)}
.px-nav-check{position:absolute;opacity:0;pointer-events:none;width:1px;height:1px}
.px-nav-toggle{display:none;width:40px;height:40px;align-items:center;justify-content:center;border:1px solid var(--c-line);border-radius:var(--radius);cursor:pointer}
.px-nav-toggle span,.px-nav-toggle span::before,.px-nav-toggle span::after{display:block;width:18px;height:2px;background:var(--c-text);content:"";position:relative}.px-nav-toggle span::before{position:absolute;top:-6px}.px-nav-toggle span::after{position:absolute;top:6px}
.px-nav-check:focus-visible+.px-nav-toggle{outline:2px solid var(--c-accent)}
@media (max-width:700px){.px-nav-toggle{display:inline-flex}.px-nav-links{display:none;position:absolute;top:100%;left:0;right:0;flex-direction:column;gap:14px;background:var(--c-bg);padding:16px 24px 20px;border-bottom:1px solid var(--c-line)}.px-nav-check:checked~.px-nav-links{display:flex}}
.px-footer{border-top:1px solid var(--c-line);padding:32px 24px;color:var(--c-muted)}.px-footer-in{max-width:1120px;margin:0 auto;display:flex;flex-wrap:wrap;gap:16px 32px;justify-content:space-between;align-items:center}.px-footer-text{margin:0}.px-footer nav{display:flex;gap:20px;flex-wrap:wrap}.px-footer a{color:var(--c-text)}`;

  PX.EDIT_CSS = `html{scroll-behavior:auto}body{min-height:100vh}
.px-hover{outline:1px dashed rgba(0,212,170,.75);outline-offset:-1px}
.px-inner:empty::before,.px-columns:empty::before,.px-stack:empty::before,.px-card:empty::before{content:'Empty — add components here';display:block;padding:22px;border:1px dashed rgba(0,212,170,.55);color:#8C8A9C;font:12px ui-monospace,Consolas,monospace;text-align:center}
[data-edit][contenteditable]{outline:2px solid #00D4AA;outline-offset:2px;cursor:text;min-width:1ch}
#px-ov{position:absolute;pointer-events:none;border:2px solid #00D4AA;z-index:99998;display:none;box-sizing:border-box}
#px-ov i{position:absolute;width:9px;height:9px;background:#07070A;border:2px solid #00D4AA;box-sizing:border-box}
#px-ov i:nth-child(1){left:-6px;top:-6px}#px-ov i:nth-child(2){right:-6px;top:-6px}#px-ov i:nth-child(3){left:-6px;bottom:-6px}#px-ov i:nth-child(4){right:-6px;bottom:-6px}
#px-ov b{position:absolute;left:-2px;top:-23px;background:#00D4AA;color:#07070A;font:600 11px/1 ui-monospace,Consolas,monospace;padding:5px 7px;white-space:nowrap;letter-spacing:.04em}
#px-ov.in b{top:2px;left:2px}
#px-drop{position:absolute;pointer-events:none;z-index:99999;display:none;background:#00D4AA;box-shadow:0 0 0 1px #07070A}
#px-drop.box{background:rgba(0,212,170,.12);border:2px dashed #00D4AA;box-shadow:none}
body.px-dragging *{cursor:grabbing !important}`;

  function declsFor(n, bp, d) {
    const st = (n.style && n.style[bp]) || {};
    const own = [], inner = [];
    Object.keys(st).forEach((k) => {
      const def = S[k]; if (!def || !def.css) return;
      const v = st[k]; if (v === '' || v == null) return;
      const c = def.css(v); if (!c) return;
      ((d.inner || []).includes(k) ? inner : own).push(c);
    });
    return { own, inner, st };
  }

  PX.buildCss = function (project, ctx) {
    const t = project.tokens || {};
    const c = t.colors || {};
    const f = t.fonts || {};
    const stack = (k, fb) => (FONT_STACKS[k] || FONT_STACKS[fb])[1];
    let css = `:root{--c-bg:${safeColor(c.bg) || '#ffffff'};--c-surface:${safeColor(c.surface) || '#f5f5f5'};--c-text:${safeColor(c.text) || '#111111'};--c-muted:${safeColor(c.muted) || '#666666'};--c-accent:${safeColor(c.accent) || '#0a7'};--c-accent-text:${safeColor(c.accentText) || '#ffffff'};--c-line:${safeColor(c.line) || '#dddddd'};--f-head:${stack(f.head, 'system')};--f-body:${stack(f.body, 'system')};--f-mono:${stack(f.mono, 'mono')};--radius:${num(t.radius) != null ? num(t.radius) : 8}px;--base-size:${num(t.baseSize) || 16}px}\n` + BASE_CSS + '\n';
    const out = { base: [], tablet: [], mobile: [] };
    const visit = (n) => {
      const d = T[n.type]; if (!d) return;
      BPS.forEach((bp) => {
        const { own, inner, st } = declsFor(n, bp, d);
        const sel = '.n-' + n.id;
        if (bp === 'base' && d.propCss) { const p = d.propCss(n); if (p) own.push(p); }
        if (n.type === 'image' && bp !== 'base' && st.h == null) { /* keep ratio */ }
        if (n.type === 'image' && st.h != null && st.h !== '') own.push('aspect-ratio:auto');
        if (d.blockText && st.align) {
          own.push(st.align === 'center' ? 'margin-left:auto;margin-right:auto' : st.align === 'right' ? 'margin-left:auto;margin-right:0' : 'margin-left:0;margin-right:auto');
        }
        if (d.flex && st.align && !st.alignItems) {
          own.push('align-items:' + ({ left: 'flex-start', center: 'center', right: 'flex-end' }[st.align]));
          out[bp].push(`${sel}>.px-btn,${sel}>.px-link{align-self:${{ left: 'flex-start', center: 'center', right: 'flex-end' }[st.align]}}`);
        }
        if (n.type === 'section' && st.align) {
          const ai = { left: 'flex-start', center: 'center', right: 'flex-end' }[st.align];
          inner.push('align-items:' + ai);
          out[bp].push(`${sel}>.px-inner>.px-btn,${sel}>.px-inner>.px-link{align-self:${ai}}`);
        }
        if (n.type === 'section' && bp === 'base' && n.style.base.bgImage) { /* handled below */ }
        const bgId = st.bgImage;
        if (n.type === 'section' && bgId && ctx && ctx.assetUrl) {
          const u = ctx.assetUrl(bgId);
          if (u) own.push(`background-image:url("${String(u).replace(/"/g, '%22')}");background-size:cover;background-position:center`);
        }
        if (own.length) out[bp].push(`${sel}{${own.join(';')}}`);
        if (inner.length) out[bp].push(`${sel}>.px-inner{${inner.join(';')}}`);
      });
      (n.children || []).forEach(visit);
    };
    (project.pages || []).forEach((p) => (p.nodes || []).forEach(visit));
    css += out.base.join('\n') + '\n';
    ['tablet', 'mobile'].forEach((bp) => { if (out[bp].length) css += `@media ${BP_MEDIA[bp]}{\n${out[bp].join('\n')}\n}\n`; });
    return css;
  };

  /* All asset ids referenced by a node tree (props + style) */
  PX.assetRefs = function (n, acc) {
    acc = acc || [];
    if (n.props) { if (n.props.assetId) acc.push({ id: n.props.assetId, node: n }); if (n.props.logoAsset) acc.push({ id: n.props.logoAsset, node: n }); }
    BPS.forEach((bp) => { const v = n.style && n.style[bp] && n.style[bp].bgImage; if (v) acc.push({ id: v, node: n }); });
    (n.children || []).forEach((c) => PX.assetRefs(c, acc));
    return acc;
  };
  PX.walk = function (nodes, fn, parent, depth) {
    depth = depth || 0;
    (nodes || []).forEach((n) => { fn(n, parent || null, depth); PX.walk(n.children, fn, n, depth + 1); });
  };
  PX.clone = (o) => JSON.parse(JSON.stringify(o));
  PX.cloneTree = function (n) {
    const c = PX.clone(n);
    (function re(x) { x.id = PX.uid(); (x.children || []).forEach(re); })(c);
    return c;
  };
})();
