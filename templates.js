/* PixelProTech Pixel App — templates.js
   Five structurally distinct Business templates. Each differs in page structure, component arrangement,
   content hierarchy and responsive strategy (not just colours). Contact targets are intentionally left empty:
   Pixel Preflight reports them until the real phone/email is entered. */
(function () {
  'use strict';
  const PX = (window.PX = window.PX || {});
  const { H, P, B, SEC, COLS, STACK, CARD } = PX.DSL;
  const N = PX.N;
  const L = (label, href) => ({ label, href });
  const NAV = (brand, links, style) => N('nav', { brand, links, sticky: true }, style);
  const FOOT = (text, links) => N('footer', { text, links: links || [] });
  const LIST = (items, marker) => N('list', { items, marker: marker || 'check' });
  const tokens = (c, f, radius, baseSize) => ({ colors: c, fonts: f, radius, baseSize: baseSize || 16 });
  const page = (id, title, slug, nodes) => ({ id, title, slug, nodes });
  const proj = (name, tpl, tk, pages) => ({ v: 1, name, category: 'business', templateId: tpl, tokens: tk, pages, settings: { lang: 'en', description: '' } });
  const rowCols = (cols, kids, tablet, mobile) => COLS(cols, kids, { tablet: { cols: tablet || cols }, mobile: { cols: mobile || '1' } });

  /* 1 — Field Crew: trades & field services. Split hero + checklist card, 3-up services, 4-step process, dense single page. */
  function fieldCrew() {
    const home = PX.uid();
    const tk = tokens({ bg: '#111315', surface: '#1A1D20', text: '#F2EFE8', muted: '#A39F94', accent: '#F5B301', accentText: '#141414', line: '#2B2F33' }, { head: 'impact', body: 'system', mono: 'mono' }, 4);
    return proj('Field Crew', 'biz-field', tk, [page(home, 'Home', 'home', [
      NAV('Your Trade Co.', [L('Services', '#services'), L('How it works', '#process'), L('Areas', '#area'), L('Get a quote', '#contact')]),
      SEC('Hero', { base: { padY: 96 } }, [
        rowCols('2fr 1fr', [
          STACK([P('Local crew · Add your trade', 'eyebrow'), H('Fast, dependable work on your property.', 1),
            P('Say what you fix, build or install, and how quickly people can expect a response.', 'lead', { base: { maxW: 560 } }),
            STACK([B('Request a quote', '#contact', 'solid'), B('See services', '#services', 'outline')], { base: { direction: 'row', gap: 12 } }, 'Buttons'),
            LIST('Add a qualification or licence you hold\nAdd a service guarantee you can honour\nAdd the areas you cover', 'check')], { base: { gap: 18 } }, 'Hero copy'),
          CARD([P('Before you call', 'eyebrow'), H('Have these ready', 3), LIST('A clear photo of the problem\nThe address of the job\nYour preferred time window', 'number')], {}, 'Checklist'),
        ], '1', '1')], { anchor: 'top' }),
      SEC('Services', { base: { bg: '#1A1D20' } }, [P('What we do', 'eyebrow'), H('Services', 2),
        COLS('3', [1, 2, 3].map((i) => CARD([H('Service ' + i, 3), P('Describe what is included, in plain language.'), LIST('Typical job one\nTypical job two', 'dot')], { base: { bg: '#111315' } })))], { anchor: 'services' }),
      SEC('Process', {}, [H('How a job works', 2),
        COLS('4', ['Request', 'Quote', 'Work', 'Sign-off'].map((s, i) => STACK([P('0' + (i + 1), 'eyebrow'), H(s, 3), P('One sentence on this step.', 'small')])), { tablet: { cols: '2' }, mobile: { cols: '1' } })], { anchor: 'process' }),
      SEC('Service area', { base: { bg: '#1A1D20' } }, [
        rowCols('2fr 1fr', [STACK([H('Where we work', 2), P('List the towns, suburbs or regions you cover and how far you will travel.'), LIST('Area one\nArea two\nArea three', 'dot')]), CARD([P('Hours', 'eyebrow'), LIST('Weekdays: add hours\nSaturday: add hours\nEmergencies: add policy', 'none')], { base: { bg: '#111315' } })], '1')], { anchor: 'area' }),
      SEC('Quote request', { base: { bg: '#F2EFE8', color: '#141414', align: 'center', padY: 72 } }, [
        H('Tell us about the job', 2), P('Give people one way to reach you today.', 'body', { base: { maxW: 520 } }),
        STACK([B('Call us', '', 'solid'), B('Email us', '', 'outline', { base: { color: '#141414' } })], { base: { direction: 'row', justify: 'center', gap: 12 } }, 'Contact buttons')], { anchor: 'contact' }),
      FOOT('Your Trade Co. All rights reserved.', [L('Services', '#services'), L('Areas', '#area')]),
    ])]);
  }

  /* 2 — Authority Brief: consultancy / expert practice. Centred editorial hero, figures band, alternating method rows. */
  function authorityBrief() {
    const home = PX.uid();
    const tk = tokens({ bg: '#F6F3EC', surface: '#FFFFFF', text: '#1B1B1F', muted: '#5E5B55', accent: '#0B5C4B', accentText: '#FFFFFF', line: '#D9D4C7' }, { head: 'serif', body: 'system', mono: 'mono' }, 2, 17);
    const fig = () => STACK([H('00', 2, { base: { fontSize: 56, color: '#0B5C4B' } }), P('Add the figure you can prove', 'small')], { base: { align: 'center', alignItems: 'center', gap: 4 } }, 'Figure');
    return proj('Authority Brief', 'biz-authority', tk, [page(home, 'Home', 'home', [
      N('nav', { brand: 'Your Practice', sticky: false, links: [L('Method', '#method'), L('Contact', '#contact')] }),
      SEC('Hero', { base: { align: 'center', padY: 120, gap: 20 }, mobile: { padY: 64 } }, [
        P('Independent advisory', 'eyebrow'), H('A measured argument for why people should trust you.', 1, { base: { maxW: 820 } }),
        P('Write the problem you solve and the outcome clients get, in two sentences.', 'lead', { base: { maxW: 640 } }), B('Start a conversation', '#contact', 'solid')]),
      SEC('Figures', { base: { bg: '#FFFFFF', padY: 56 } }, [COLS('4', [fig(), fig(), fig(), fig()], { tablet: { cols: '2' }, mobile: { cols: '2', gap: 16 } })]),
      SEC('Method', { base: { gap: 48 } }, [H('How the work runs', 2),
        rowCols('1fr 1fr', [STACK([H('1. Diagnose', 3), P('Describe how you establish the facts before recommending anything.')]), CARD([LIST('What you review\nWhat you ask the client for\nWhat the client receives', 'number')], {}, 'Deliverables')], '1'),
        rowCols('1fr 1fr', [CARD([LIST('How decisions are made\nWho is involved\nHow progress is reported', 'number')], {}, 'Cadence'), STACK([H('2. Advise', 3), P('Describe how recommendations are delivered and defended.')])], '1')], { anchor: 'method' }),
      SEC('Client notes', { base: { bg: '#FFFFFF' } }, [H('In clients’ words', 2), COLS('2', [CARD([N('quote', { text: 'Replace with a real quotation you have permission to use.', cite: 'Client name, role' })]), CARD([N('quote', { text: 'Replace with a second real quotation.', cite: 'Client name, role' })])], { mobile: { cols: '1' } })]),
      SEC('Contact', {}, [rowCols('2fr 1fr', [STACK([H('Begin with a conversation', 2), P('State how long you take to reply and what a first call covers.')]), CARD([P('Reach us', 'eyebrow'), N('link', { text: 'Email', href: '' }), N('link', { text: 'Phone', href: '' })])], '1')], { anchor: 'contact' }),
      FOOT('Your Practice. All rights reserved.'),
    ])]);
  }

  /* 3 — Counter: local storefront. Announcement strip, "today" card, price-row list, find-us pair. */
  function counter() {
    const home = PX.uid();
    const tk = tokens({ bg: '#FFF9F0', surface: '#FFFFFF', text: '#2B1D14', muted: '#7A6656', accent: '#C2410C', accentText: '#FFFFFF', line: '#EBDCC8' }, { head: 'humanist', body: 'humanist', mono: 'mono' }, 14);
    const row = (n) => rowCols('3fr 1fr', [STACK([H('Item or service ' + n, 3), P('A short line describing it.', 'small')], { base: { gap: 2 } }), P('Price', 'body', { base: { align: 'right', fontWeight: '600' }, mobile: { align: 'left' } })], '3fr 1fr', '1');
    return proj('Counter', 'biz-counter', tk, [page(home, 'Home', 'home', [
      SEC('Announcement', { base: { padY: 10, bg: '#C2410C', color: '#FFFFFF', align: 'center' } }, [P('Announce today’s offer, closure or event here', 'small', { base: { color: '#FFFFFF' } })]),
      NAV('Your Shop', [L('Offer', '#offer'), L('Find us', '#find')]),
      SEC('Hero', { base: { padY: 72 } }, [rowCols('3fr 2fr', [
        STACK([H('The place on your street for what you need.', 1), P('Say what you sell and what makes people come back.', 'lead'), B('Find us', '#find', 'solid')], { base: { gap: 18 } }, 'Hero copy'),
        CARD([P('Today', 'eyebrow'), H('Open now?', 3), LIST('Opening hours: add\nAddress: add\nPhone: add', 'none')], { base: { bg: '#FFFFFF' } }, 'Today card')], '1')]),
      SEC('Offer', { base: { gap: 12 } }, [H('What we offer', 2), row(1), N('divider'), row(2), N('divider'), row(3), N('divider'), row(4), N('divider'), row(5)], { anchor: 'offer' }),
      SEC('Find us', { base: { bg: '#FFFFFF' } }, [H('Find us', 2), COLS('2', [CARD([H('Address', 3), P('Street, suburb, city.\nLandmarks that help people find you.'), B('Get directions', '', 'outline')], {}, 'Address'), CARD([H('Opening hours', 3), LIST('Monday–Friday: add\nSaturday: add\nSunday: add', 'none')], {}, 'Hours')], { mobile: { cols: '1' } })], { anchor: 'find' }),
      FOOT('Your Shop. All rights reserved.'),
    ])]);
  }

  /* 4 — Practice: multi-page professional practice (Home / Services / Contact), shared nav + footer. */
  function practice() {
    const pHome = PX.uid(), pServ = PX.uid(), pCont = PX.uid();
    const tk = tokens({ bg: '#FFFFFF', surface: '#F1F5F9', text: '#0F172A', muted: '#475569', accent: '#1D4ED8', accentText: '#FFFFFF', line: '#E2E8F0' }, { head: 'system', body: 'system', mono: 'mono' }, 8);
    const nav = () => NAV('Your Practice', [L('Home', 'page:' + pHome), L('Services', 'page:' + pServ), L('Contact', 'page:' + pCont)]);
    const foot = () => FOOT('Your Practice. All rights reserved.', [L('Services', 'page:' + pServ), L('Contact', 'page:' + pCont)]);
    const service = (n) => rowCols('1fr 2fr', [STACK([P('Service 0' + n, 'eyebrow'), H('Service name', 2)]), STACK([P('Explain what the service is, who it is for and what the client receives.'), LIST('Included item one\nIncluded item two\nIncluded item three', 'check'), B('Enquire about this', 'page:' + pCont, 'outline')], { base: { gap: 16 } })], '1');
    return proj('Practice', 'biz-practice', tk, [
      page(pHome, 'Home', 'home', [nav(),
        SEC('Hero', { base: { bg: '#F1F5F9', padY: 96 } }, [rowCols('3fr 2fr', [STACK([P('Professional practice', 'eyebrow'), H('Plain advice from people who answer the phone.', 1), P('Say who you help and where you work.', 'lead'), B('Our services', 'page:' + pServ, 'solid')], { base: { gap: 18 } }, 'Hero copy'),
          CARD([H('Why clients stay', 3), LIST('Add a reason that you can prove\nAdd a second reason\nAdd a third reason', 'check')], { base: { bg: '#FFFFFF' } }, 'Reasons')], '1')]),
        SEC('Services at a glance', {}, [H('Services at a glance', 2), COLS('3', [1, 2, 3].map((i) => CARD([H('Service ' + i, 3), P('One sentence on what this service solves.'), N('link', { text: 'Learn more', href: 'page:' + pServ })])))]),
        SEC('Next step', { base: { align: 'center', bg: '#0F172A', color: '#FFFFFF', padY: 64 } }, [H('Ready to talk?', 2), B('Contact us', 'page:' + pCont, 'solid')]),
        foot()]),
      page(pServ, 'Services', 'services', [nav(),
        SEC('Page header', { base: { padY: 64, bg: '#F1F5F9' } }, [H('Services', 1), P('Introduce your services in a sentence.', 'lead', { base: { maxW: 600 } })]),
        SEC('Service list', { base: { gap: 48 } }, [service(1), N('divider'), service(2), N('divider'), service(3)]),
        foot()]),
      page(pCont, 'Contact', 'contact', [nav(),
        SEC('Page header', { base: { padY: 64, bg: '#F1F5F9' } }, [H('Contact', 1), P('Tell people the fastest way to reach you.', 'lead', { base: { maxW: 600 } })]),
        SEC('Contact details', {}, [rowCols('2fr 1fr', [STACK([H('What happens next', 2), LIST('You send us your details\nWe reply within the time you state here\nWe agree the next step', 'number')]), CARD([P('Reach us', 'eyebrow'), N('link', { text: 'Email', href: '' }), N('link', { text: 'Phone', href: '' }), P('Hours: add', 'small')])], '1')], { anchor: 'contact' }),
        foot()]),
    ]);
  }

  /* 5 — Launch Sheet: one-page offer. Centred hero, alternating feature rows, 3-tier pricing, FAQ stack, final CTA. */
  function launchSheet() {
    const home = PX.uid();
    const tk = tokens({ bg: '#0A1020', surface: '#121B33', text: '#EAF0FF', muted: '#93A0C0', accent: '#38BDF8', accentText: '#04121F', line: '#223055' }, { head: 'system', body: 'system', mono: 'mono' }, 12);
    const feat = (n, flip) => { const a = STACK([P('Feature 0' + n, 'eyebrow'), H('What it does for the customer', 3), P('Explain the benefit, then the mechanism.'), LIST('Proof point one\nProof point two', 'check')], { base: { gap: 12 } }, 'Copy'); const b = CARD([P('Describe the visual or proof point for this feature.', 'small')], { base: { padY: 64 } }, 'Proof'); return rowCols('1fr 1fr', flip ? [b, a] : [a, b], '1'); };
    const tier = (name, hot) => CARD([P(name, 'eyebrow'), H('Add price', 2), P('Describe who this tier is for.', 'small'), LIST('Included item one\nIncluded item two\nIncluded item three', 'check'), B('Choose ' + name, '', hot ? 'solid' : 'outline')], hot ? { base: { border: 'accent' } } : {}, name + ' tier');
    return proj('Launch Sheet', 'biz-launch', tk, [page(home, 'Home', 'home', [
      NAV('Your Offer', [L('Features', '#features'), L('Pricing', '#pricing'), L('FAQ', '#faq')]),
      SEC('Hero', { base: { align: 'center', padY: 112, gap: 20 }, mobile: { padY: 64 } }, [P('Now available', 'eyebrow'), H('One sharp sentence that sells the offer.', 1, { base: { maxW: 860 } }), P('Name the customer, the problem and the result.', 'lead', { base: { maxW: 620 } }),
        STACK([N('button', { label: 'Get started', href: '#pricing', variant: 'solid', size: 'lg' }), B('See features', '#features', 'outline')], { base: { direction: 'row', justify: 'center', gap: 12 } }, 'Buttons'), P('Add a reassurance line you can stand behind', 'small')]),
      SEC('Features', { base: { gap: 56 } }, [feat(1, false), feat(2, true), feat(3, false)], { anchor: 'features' }),
      SEC('Pricing', { base: { bg: '#121B33' } }, [H('Pricing', 2, { base: { align: 'center' } }), COLS('3', [tier('Starter', false), tier('Standard', true), tier('Pro', false)], { tablet: { cols: '1' } })], { anchor: 'pricing' }),
      SEC('FAQ', { base: { maxW: 760 } }, [H('Questions', 2), STACK([1, 2, 3, 4].map((i) => CARD([H('Question ' + i, 4), P('Answer ' + i + ' goes here.')], { base: { padY: 20 } })), { base: { gap: 12 } }, 'Questions')], { anchor: 'faq' }),
      SEC('Final call', { base: { align: 'center', padY: 80 } }, [H('Make the last step easy', 2), B('Get started', '#pricing', 'solid')]),
      FOOT('Your Offer. All rights reserved.', [L('Features', '#features'), L('Pricing', '#pricing')]),
    ])]);
  }

  const defs = [
    { id: 'biz-field', name: 'Field Crew', pitch: 'Trades & field services', structure: 'Split hero with checklist card, 3-up services, 4-step process, service-area split, solid quote band.', responsive: 'Hero and area splits stack; process drops 4→2→1 columns.', build: fieldCrew },
    { id: 'biz-authority', name: 'Authority Brief', pitch: 'Consultancy & expert practice', structure: 'Centred editorial hero, figures band, alternating method rows, paired client notes.', responsive: 'Figures drop 4→2 columns; method rows stack; serif headings.', build: authorityBrief },
    { id: 'biz-counter', name: 'Counter', pitch: 'Local shop or storefront', structure: 'Announcement strip, "today" card, price-row list, address + hours pair.', responsive: 'Price rows keep 2 columns on tablet, stack on mobile with left-aligned price.', build: counter },
    { id: 'biz-practice', name: 'Practice', pitch: 'Multi-page professional practice', structure: 'Three pages (Home, Services, Contact) with shared navigation and footer, page-to-page links.', responsive: 'Nav collapses to a menu; side-by-side rows stack.', build: practice },
    { id: 'biz-launch', name: 'Launch Sheet', pitch: 'One-page offer with pricing', structure: 'Centred hero, alternating feature rows, 3-tier pricing, FAQ stack, final call-to-action.', responsive: 'Pricing goes 3→1 column at tablet; feature rows stack.', build: launchSheet },
  ];
  PX.Blueprints.get('business').templates = defs;

  /* Structure map used by the template picker (generated from the real node tree, not an image). */
  PX.schematic = function (project) {
    const W = 100; let y = 0; const out = [];
    const rect = (x, yy, w, h, cls) => out.push(`<rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${Math.max(w, .5).toFixed(1)}" height="${h.toFixed(1)}" class="${cls}"/>`);
    function colsOf(n) { const c = String((n.style.base && n.style.base.cols) || '1'); if (/^\d$/.test(c)) return Array(+c).fill(1); const m = c.match(/^(\d)fr (\d)fr$/); return m ? [+m[1], +m[2]] : [1]; }
    function lay(n, x, w) {
      switch (n.type) {
        case 'nav': rect(x, y, w, 5, 'sn'); rect(x + 3, y + 1.8, 14, 1.4, 'sa'); y += 6; return;
        case 'footer': rect(x, y + 2, w, 5, 'sn'); y += 9; return;
        case 'heading': rect(x, y, w * (n.props.level === 1 ? .75 : .5), n.props.level === 1 ? 4 : 2.6, 'sa'); y += (n.props.level === 1 ? 4 : 2.6) + 2; return;
        case 'text': rect(x, y, w * .9, 1.5, 'sl'); rect(x, y + 2.6, w * .6, 1.5, 'sl'); y += 6; return;
        case 'list': for (let i = 0; i < 3; i++) { rect(x, y + i * 2.6, 1.4, 1.4, 'sa'); rect(x + 3, y + i * 2.6, w * .6, 1.4, 'sl'); } y += 8.5; return;
        case 'button': rect(x, y, Math.min(w, 16), 3.8, 'sb'); y += 6; return;
        case 'link': rect(x, y, 10, 1.4, 'sa'); y += 3; return;
        case 'quote': rect(x, y, .8, 6, 'sa'); rect(x + 2.5, y, w * .7, 1.5, 'sl'); rect(x + 2.5, y + 2.8, w * .5, 1.5, 'sl'); y += 8; return;
        case 'image': rect(x, y, w, 9, 'si'); y += 11; return;
        case 'spacer': y += 3; return;
        case 'divider': rect(x, y, w, .4, 'sl'); y += 2.4; return;
        case 'section': {
          const y0 = y; const bg = n.style.base && n.style.base.bg; y += 3;
          const start = out.length; (n.children || []).forEach((c) => lay(c, x + 4, w - 8)); y += 2;
          out.splice(start, 0, `<rect x="${x}" y="${y0}" width="${w}" height="${(y - y0).toFixed(1)}" class="${bg ? 'ss2' : 'ss'}"/>`); return;
        }
        case 'card': {
          const y0 = y; y += 2.5; const start = out.length; (n.children || []).forEach((c) => lay(c, x + 2.5, w - 5)); y += 1;
          out.splice(start, 0, `<rect x="${x}" y="${y0}" width="${w}" height="${(y - y0).toFixed(1)}" class="sc"/>`); return;
        }
        case 'columns': case 'stack': {
          if (n.type === 'stack') { (n.children || []).forEach((c) => lay(c, x, w)); return; }
          const rs = colsOf(n); const tot = rs.reduce((a, b) => a + b, 0); const gap = 2; let cx = x; const y0 = y; let maxY = y; const kidsArr = n.children || [];
          const nc = Math.max(rs.length, 1);
          for (let i = 0; i < kidsArr.length; i += nc) {
            y = maxY; const rowY = y; maxY = rowY; cx = x;
            for (let j = 0; j < nc && i + j < kidsArr.length; j++) { const cw = (w - gap * (nc - 1)) * (rs[j] / tot); y = rowY; lay(kidsArr[i + j], cx, cw); maxY = Math.max(maxY, y); cx += cw + gap; }
            maxY += 1;
          }
          y = Math.max(maxY, y0); return;
        }
        default: y += 2;
      }
    }
    const pg = project.pages[0];
    (pg.nodes || []).forEach((n) => lay(n, 0, W));
    const h = Math.max(y, 20);
    return `<svg viewBox="0 0 ${W} ${Math.min(h, 140).toFixed(0)}" preserveAspectRatio="xMidYMin slice" aria-hidden="true">${out.join('')}</svg>`;
  };
})();
