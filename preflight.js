/* PixelProTech Pixel App — preflight.js
   Pixel Preflight: detectable-problem verification before export.
   Each check reports PASS / ISSUE / NOT TESTABLE with an explanation and a corrective action.
   A PASS means only "this specific check found nothing". It is not a claim of accessibility, SEO,
   security or browser compatibility. */
(function () {
  'use strict';
  const PX = (window.PX = window.PX || {});

  const MAX_ASSET = 1.5 * 1024 * 1024, MAX_TOTAL = 8 * 1024 * 1024;
  const TOKEN_KEYS = ['bg', 'surface', 'text', 'muted', 'accent', 'accentText', 'line'];
  const kb = (b) => (b / 1024 >= 1024 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB');

  function nodesOf(project) { const out = []; project.pages.forEach((p) => PX.walk(p.nodes, (n, parent) => out.push({ n, p, parent }))); return out; }
  function links(project) {
    const out = [];
    nodesOf(project).forEach(({ n, p }) => {
      if (n.type === 'button' || n.type === 'link') out.push({ href: n.props.href || '', label: n.props.label || n.props.text || '', n, p, kind: n.type });
      if (n.type === 'nav' || n.type === 'footer') (n.props.links || []).forEach((l) => out.push({ href: l.href || '', label: l.label || '', n, p, kind: n.type + ' link', empty: !(l.label || '').trim() }));
    });
    return out;
  }
  const anchorsOf = (page) => { const a = []; PX.walk(page.nodes, (n) => { if (n.type === 'section' && n.props.anchor) a.push(n.props.anchor); }); return a; };
  const issue = (message, action, n, p) => ({ kind: 'issue', message, action, nodeId: n && n.id, pageId: p && p.id });
  const nt = (message, action) => ({ kind: 'nt', message, action });

  function measure(html, width) {
    return new Promise((resolve) => {
      if (typeof document === 'undefined' || !document.body) return resolve({ ok: false, error: 'No browser layout engine available' });
      const f = document.createElement('iframe');
      f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
      f.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px;height:900px;border:0;visibility:hidden;pointer-events:none`;
      let done = false;
      const finish = (r) => { if (done) return; done = true; clearTimeout(t); f.remove(); resolve(r); };
      const t = setTimeout(() => finish({ ok: false, error: 'Layout measurement timed out' }), 6000);
      f.onload = () => {
        try {
          const d = f.contentDocument, de = d.documentElement, vw = de.clientWidth; const offenders = [];
          d.body.querySelectorAll('*').forEach((el) => {
            const r = el.getBoundingClientRect(); if (!r.width && !r.height) return;
            if (r.right > vw + 1 || r.left < -1) {
              let e = el, id = null; while (e && !id) { const m = /\bn-([a-z0-9]+)/i.exec(e.getAttribute && e.getAttribute('class') || ''); if (m) id = m[1]; e = e.parentElement; }
              offenders.push({ id, tag: el.tagName.toLowerCase(), over: Math.round(Math.max(r.right - vw, -r.left)) });
            }
          });
          finish({ ok: true, vw, scrollW: de.scrollWidth, overflow: de.scrollWidth > vw + 1, offenders });
        } catch (e) { finish({ ok: false, error: e.message }); }
      };
      f.srcdoc = html; document.body.appendChild(f);
    });
  }

  const checks = [
    { id: 'P01', title: 'Required project data', covers: 'Project name, at least one page, page slugs valid and unique, language code, design tokens present.',
      run(c) {
        const { project: pr } = c, it = [];
        if (!String(pr.name || '').trim()) it.push(issue('Project has no name.', 'Set a project name in the top bar.'));
        if (!pr.pages || !pr.pages.length) it.push(issue('Project has no pages.', 'Add a page.'));
        if (!/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test((pr.settings && pr.settings.lang) || '')) it.push(issue('Site language code is missing or invalid.', 'Set a language such as "en" under Site settings.'));
        TOKEN_KEYS.forEach((k) => { if (!pr.tokens || !pr.tokens.colors || !pr.tokens.colors[k]) it.push(issue(`Design token colour "${k}" is missing.`, 'Set it under Design tokens.')); });
        const slugs = {};
        (pr.pages || []).forEach((p, i) => {
          if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug || '')) it.push(issue(`Page "${p.title || '(untitled)'}" has an invalid file name "${p.slug}".`, 'Use lowercase letters, digits and dashes.', null, p));
          if (i > 0 && p.slug === 'index') it.push(issue(`Page "${p.title}" uses the reserved name "index".`, 'Rename the page file; "index" is the home page.', null, p));
          (slugs[p.slug] = slugs[p.slug] || []).push(p);
        });
        Object.keys(slugs).forEach((s) => { if (slugs[s].length > 1) it.push(issue(`Pages share the file name "${s}".`, 'Give each page a unique file name.', null, slugs[s][1])); });
        return it;
      } },
    { id: 'P02', title: 'Page titles', covers: 'Every page has a non-empty title (used as the browser tab title).',
      run(c) { return c.project.pages.filter((p) => !String(p.title || '').trim()).map((p) => issue(`Page "${p.slug}" has an empty title.`, 'Enter a title in the page settings.', null, p)); } },
    { id: 'P03', title: 'Local assets present', covers: 'Every image, logo and background image points to an asset stored in the project; image slots have a source.',
      run(c) {
        const it = [];
        nodesOf(c.project).forEach(({ n, p }) => {
          PX.assetRefs({ props: n.props, style: n.style, children: [] }).forEach((r) => { const a = c.assets[r.id]; if (!a || !a.dataUrl) it.push(issue(`${PX.describe(n)} references an asset that is missing from the project.`, 'Re-upload the image or choose another one.', n, p)); });
          if (n.type === 'image' && !n.props.assetId && !n.props.src) it.push(issue('An image slot is empty.', 'Upload an image or remove the slot.', n, p));
        });
        return it;
      } },
    { id: 'P04', title: 'Internal references', covers: 'Page links point to existing pages; #anchor links point to a section anchor on the same page; anchors are unique.',
      run(c) {
        const it = [];
        links(c.project).forEach((l) => {
          const k = PX.linkKind(l.href);
          if (k === 'page' && !c.project.pages.some((x) => x.id === l.href.slice(5))) it.push(issue(`${l.kind} "${l.label}" links to a page that no longer exists.`, 'Choose an existing page.', l.n, l.p));
          if (k === 'anchor' && !anchorsOf(l.p).includes(l.href.slice(1))) it.push(issue(`${l.kind} "${l.label}" links to ${l.href}, but no section on "${l.p.title}" has that anchor id.`, 'Set the anchor id on the target section or change the link.', l.n, l.p));
        });
        c.project.pages.forEach((p) => { const a = anchorsOf(p); a.forEach((x, i) => { if (a.indexOf(x) !== i) it.push(issue(`Anchor id "${x}" is used more than once on "${p.title}".`, 'Anchor ids must be unique per page.', null, p)); if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(x)) it.push(issue(`Anchor id "${x}" is not a valid id.`, 'Start with a letter; use letters, digits and dashes.', null, p)); }); });
        return it;
      } },
    { id: 'P05', title: 'Navigation & link targets', covers: 'Navigation entries, buttons and links have a label and a syntactically valid target (page, #anchor, http(s) URL, mailto:, tel:). Reachability of external sites is not tested.',
      run(c) {
        const it = [];
        links(c.project).forEach((l) => {
          if (l.empty) it.push(issue(`A ${l.kind} has no label.`, 'Enter a label.', l.n, l.p));
          const k = PX.linkKind(l.href);
          if (k === 'none') it.push(issue(`${l.kind} "${l.label}" has no target.`, 'Choose a page, section, URL, email or phone number.', l.n, l.p));
          else if (k === 'invalid') it.push(issue(`${l.kind} "${l.label}" has an unrecognised target "${l.href}".`, 'Use a page, #anchor, https:// URL, mailto: or tel:.', l.n, l.p));
          else if (k === 'url') { let ok = true; try { const u = new URL(l.href); ok = !!u.hostname && (u.hostname.includes('.') || u.hostname === 'localhost'); } catch (e) { ok = false; } if (!ok) it.push(issue(`${l.kind} "${l.label}" has a malformed URL.`, 'Check the address.', l.n, l.p)); }
          else if (k === 'mail' && !/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(l.href)) it.push(issue(`${l.kind} "${l.label}" has an incomplete email address.`, 'Enter a full address.', l.n, l.p));
          else if (k === 'tel' && !/^tel:\+?[\d\s()-]{5,}$/i.test(l.href)) it.push(issue(`${l.kind} "${l.label}" has an incomplete phone number.`, 'Enter the full number.', l.n, l.p));
        });
        return it;
      } },
    { id: 'P06', title: 'Responsive overflow (375 px and 768 px)', covers: 'Each page is laid out in a real hidden browser frame at phone and tablet widths; reports horizontal overflow. Heights and visual quality are not judged.', async: true,
      async run(c) {
        const it = [];
        for (const p of c.project.pages) {
          const html = PX.Exporter.renderPageInline(c.project, c.assets, p);
          for (const w of [375, 768]) {
            const r = await measure(html, w);
            if (!r.ok) { it.push(nt(`Page "${p.title}" at ${w}px could not be measured: ${r.error}.`, 'Run Preflight in a desktop browser tab.')); continue; }
            if (r.overflow || r.offenders.length) {
              const ids = [...new Set(r.offenders.map((o) => o.id).filter(Boolean))];
              const first = ids[0] ? nodesOf(c.project).find((x) => x.n.id === ids[0]) : null;
              it.push({ kind: 'issue', message: `"${p.title}" overflows horizontally at ${w}px (content ${r.scrollW}px wide in a ${r.vw}px viewport${ids.length ? '; ' + ids.length + ' element(s) extend past the edge' : ''}).`, action: 'Reduce padding, switch columns to 1 at this size, or lower fixed widths for this breakpoint.', nodeId: first ? first.n.id : null, pageId: p.id });
            }
          }
        }
        return it;
      } },
    { id: 'P07', title: 'Oversized local media', covers: `Single image above ${kb(MAX_ASSET)} or total used media above ${kb(MAX_TOTAL)}. Externally hosted images cannot be sized.`,
      run(c) {
        const it = []; const used = new Set(); let ext = 0, total = 0;
        nodesOf(c.project).forEach(({ n }) => { PX.assetRefs({ props: n.props, style: n.style, children: [] }).forEach((r) => used.add(r.id)); if (n.type === 'image' && !n.props.assetId && n.props.src) ext++; });
        used.forEach((id) => { const a = c.assets[id]; if (!a) return; total += a.size || 0; if ((a.size || 0) > MAX_ASSET) it.push(issue(`Image "${a.name}" is ${kb(a.size)}.`, 'Resize or compress it (aim for well under 500 KB for web use).')); });
        if (total > MAX_TOTAL) it.push(issue(`Local media totals ${kb(total)}.`, 'Compress or remove images; large sites load slowly on mobile data.'));
        if (ext) it.push(nt(`${ext} image(s) use an external URL; their size and availability cannot be tested here.`, 'Upload the image to keep the site self-contained.'));
        return it;
      } },
    { id: 'P08', title: 'Required export files', covers: 'A dry-run export contains index.html, site.css, site.js, one HTML file per page and every used asset.',
      run(c) {
        const b = PX.Exporter.build(c.project, c.assets); const it = [];
        if (!b.ok) return b.errors.map((e) => issue('Export generation failed: ' + e, 'Fix the reported problem and run Preflight again.'));
        const names = new Set(b.files.map((f) => f.name));
        ['index.html', 'site.css', 'site.js'].forEach((n) => { if (!names.has(n)) it.push(issue(`Export is missing ${n}.`, 'This is an engine fault; report it.')); });
        c.project.pages.forEach((p, i) => { const fn = i === 0 ? 'index.html' : p.slug + '.html'; if (!names.has(fn)) it.push(issue(`Export has no file for page "${p.title}" (${fn}).`, 'Check the page file name.', null, p)); });
        b.warnings.forEach((w) => it.push(issue(w, 'Re-upload the asset.')));
        return it;
      } },
    { id: 'P09', title: 'Relative asset and page paths', covers: 'In the generated HTML/CSS, every local reference is a bare file name in the same folder (no leading "/", no "../", no backslashes, no file:// or drive paths).',
      run(c) {
        const b = PX.Exporter.build(c.project, c.assets); if (!b.ok) return [nt('Export could not be generated, so paths cannot be inspected.', 'Resolve P08 first.')];
        const it = []; const bad = (u) => /^(\/(?!\/)|\.\.\/|\.\/|[a-z]:\\|file:)/i.test(u) || u.includes('\\') || /localhost|127\.0\.0\.1/.test(u);
        b.files.filter((f) => f.name.endsWith('.html')).forEach((f) => {
          const d = new DOMParser().parseFromString(f.text, 'text/html');
          d.querySelectorAll('[href],[src]').forEach((el) => { const u = el.getAttribute('href') || el.getAttribute('src') || ''; if (u && !/^(https?:|mailto:|tel:|#|data:)/i.test(u) && bad(u)) it.push(issue(`${f.name} contains the non-relative path "${u}".`, 'Use files in the same folder only.')); });
        });
        const css = b.files.find((f) => f.name === 'site.css'); const re = /url\(\s*["']?([^"')]+)["']?\s*\)/g; let m;
        while (css && (m = re.exec(css.text))) if (!/^(data:|https?:)/.test(m[1]) && bad(m[1])) it.push(issue(`site.css contains the non-relative path "${m[1]}".`, 'Use files in the same folder only.'));
        return it;
      } },
    { id: 'P10', title: 'Export completeness', covers: 'Every local reference in the generated site resolves to a file inside the export; no file is empty; in-page anchors exist. External sites are not contacted.',
      run(c) { const b = PX.Exporter.build(c.project, c.assets); if (!b.ok) return [nt('Export could not be generated; completeness cannot be verified.', 'Resolve P08 first.')]; return PX.Exporter.verify(b.files).problems.map((p) => issue(`${p.file}: ${p.message}`, 'Fix the underlying link or asset in the editor.')); } },
    { id: 'P11', title: 'Image alt text present', covers: 'Presence of an alt attribute value on images that have a source. This does not judge whether the text is good, and is not an accessibility audit.',
      run(c) { const it = []; nodesOf(c.project).forEach(({ n, p }) => { if (n.type === 'image' && (n.props.assetId || n.props.src) && !String(n.props.alt || '').trim()) it.push(issue('An image has no alt text.', 'Describe the image, or leave it empty only if it is purely decorative.', n, p)); }); return it; } },
    { id: 'P12', title: 'Category rules — Business', covers: 'Business blueprint: a contact route (tel:, mailto: or a Contact page/anchor), a primary call-to-action button with a target, and navigation on every page.',
      run(c) {
        if (c.project.category !== 'business') return [nt(`No blueprint rules exist yet for category "${c.project.category}".`, 'Only the Business category has rules in this release.')];
        const it = []; const ls = links(c.project);
        const contact = ls.some((l) => { const k = PX.linkKind(l.href); if (k === 'tel') return /\d{5,}/.test(l.href); if (k === 'mail') return /@/.test(l.href); if (k === 'anchor') return /contact/i.test(l.href); if (k === 'page') { const t = c.project.pages.find((x) => x.id === l.href.slice(5)); return !!t && /contact/i.test(t.slug + ' ' + t.title); } return false; });
        if (!contact) it.push(issue('No working contact route found (no complete tel:/mailto: link, and no link to a Contact page or #contact section).', 'Add your phone number or email address to a button or link.'));
        const cta = ls.some((l) => l.kind === 'button' && PX.linkKind(l.href) !== 'none' && PX.linkKind(l.href) !== 'invalid');
        if (!cta) it.push(issue('No button with a target found, so there is no primary call-to-action.', 'Give at least one button a target.'));
        c.project.pages.forEach((p) => { if (!p.nodes.some((n) => n.type === 'nav')) it.push(issue(`Page "${p.title}" has no navigation.`, 'Add a Navigation component.', null, p)); });
        return it;
      } },
  ];

  function stateOf(items) { return items.some((i) => i.kind === 'issue') ? 'ISSUE' : items.some((i) => i.kind === 'nt') ? 'NOT TESTABLE' : 'PASS'; }

  async function run(project, assets, opts) {
    const results = []; const c = { project, assets: assets || {}, opts: opts || {} };
    for (const ch of checks) {
      let items;
      try { items = await ch.run(c); } catch (e) { items = [nt(`The check could not run: ${e && e.message || e}`, 'Report this fault.')]; }
      results.push({ id: ch.id, title: ch.title, covers: ch.covers, state: stateOf(items), items });
    }
    const summary = { pass: 0, issue: 0, nt: 0, issues: 0 };
    results.forEach((r) => { if (r.state === 'PASS') summary.pass++; else if (r.state === 'ISSUE') { summary.issue++; summary.issues += r.items.filter((i) => i.kind === 'issue').length; } else summary.nt++; });
    return { results, summary, at: Date.now(), total: results.length };
  }

  PX.Preflight = { run, checks, measure };
})();
