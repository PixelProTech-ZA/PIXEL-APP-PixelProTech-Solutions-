/* PixelProTech Pixel App — blueprints.js
   Category blueprints: which components a category leans on, layout conventions, and the validation rules
   Pixel Preflight runs for that category. Only categories that have complete, tested templates are "ready". */
(function () {
  'use strict';
  const PX = (window.PX = window.PX || {});
  const N = PX.N;

  const H = (text, level, style) => N('heading', { text, level }, style);
  const P = (text, variant, style) => N('text', { text, variant }, style);
  const B = (label, href, variant, style) => N('button', { label, href, variant }, style);
  const SEC = (label, style, kids, props) => N('section', Object.assign({ label }, props || {}), style, kids);
  const COLS = (cols, kids, style) => {
    style = style || {};
    const hasBp = ['base', 'tablet', 'mobile'].some((k) => style[k]);
    const st = hasBp ? Object.assign({}, style, { base: Object.assign({ cols }, style.base) }) : { base: Object.assign({ cols }, style) };
    return N('columns', { label: 'Columns' }, st, kids);
  };
  const STACK = (kids, style, label) => N('stack', { label: label || 'Stack' }, style, kids);
  const CARD = (kids, style, label) => N('card', { label: label || 'Card' }, style, kids);
  PX.DSL = { H, P, B, SEC, COLS, STACK, CARD };

  /* Reusable blocks (real subtrees dropped into the page, not pictures) */
  const blocks = [
    { id: 'hero-center', name: 'Hero — centred', build: () => SEC('Hero', { base: { align: 'center', padY: 96 } }, [
      P('Short label', 'eyebrow'), H('A clear promise in one line', 1, { base: { maxW: 820 } }),
      P('Explain who this is for and what happens next in two sentences.', 'lead', { base: { maxW: 640 } }),
      STACK([B('Primary action', '', 'solid'), B('Secondary action', '', 'outline')], { base: { direction: 'row', justify: 'center', gap: 12 } }, 'Buttons')]) },
    { id: 'feature-trio', name: 'Feature trio', build: () => SEC('Features', {}, [
      H('What you get', 2), COLS('3', [1, 2, 3].map((i) => CARD([P('0' + i, 'eyebrow'), H('Feature ' + i, 3), P('One or two sentences describing this feature.')]))),
    ]) },
    { id: 'cta-band', name: 'Call-to-action band', build: () => SEC('Call to action', { base: { align: 'center', padY: 64, bg: '#111111', color: '#ffffff' } }, [
      H('Ready when you are', 2), P('One sentence that makes the next step obvious.', 'body'), B('Get in touch', '', 'solid')]) },
    { id: 'testimonial-pair', name: 'Testimonial pair', build: () => SEC('Testimonials', {}, [
      COLS('2', [CARD([N('quote', { text: 'A short quotation from a customer.', cite: 'Name, role' })]), CARD([N('quote', { text: 'A second short quotation.', cite: 'Name, role' })])])]) },
    { id: 'contact-details', name: 'Contact details', build: () => SEC('Contact', { base: {} }, [
      COLS('2fr 1fr', [STACK([H('Get in touch', 2), P('Tell visitors how and when you reply.')]), CARD([P('Contact', 'eyebrow'), N('link', { text: 'Email us', href: '' }), N('link', { text: 'Call us', href: '' })])])], { anchor: 'contact' }) },
    { id: 'faq-list', name: 'FAQ list', build: () => SEC('FAQ', { base: { maxW: 760 } }, [
      H('Questions people ask', 2), STACK([1, 2, 3].map((i) => CARD([H('Question ' + i, 4), P('Answer ' + i + ' goes here.')])), { base: { gap: 12 } }, 'Questions')]) },
  ];

  const categories = [
    { id: 'business', name: 'Business', status: 'ready',
      summary: 'Service businesses, practices, shops and local operators that need to be found, trusted and contacted.',
      components: ['nav', 'section', 'columns', 'card', 'heading', 'text', 'list', 'button', 'quote', 'footer'],
      conventions: ['Navigation first, contact route reachable from every page', 'One primary call-to-action per screen', 'Content grouped in sections with #anchors for the navigation'],
      rules: ['biz-contact', 'biz-cta', 'biz-nav'], templates: [] },
    { id: 'creative', name: 'Creative', status: 'planned', summary: 'Portfolios, studios, artists and showreels. Planned — no templates built yet.', components: ['image', 'columns', 'quote'], conventions: [], rules: [], templates: [] },
    { id: 'commerce', name: 'Commerce', status: 'planned', summary: 'Catalogues and storefronts. Planned — no templates built yet.', components: ['card', 'image', 'button'], conventions: [], rules: [], templates: [] },
    { id: 'publishing', name: 'Publishing', status: 'planned', summary: 'Blogs, newsletters and documentation. Planned — no templates built yet.', components: ['heading', 'text', 'quote'], conventions: [], rules: [], templates: [] },
    { id: 'personal', name: 'Personal', status: 'planned', summary: 'CVs, personal sites and link pages. Planned — no templates built yet.', components: ['heading', 'text', 'link'], conventions: [], rules: [], templates: [] },
  ];

  PX.Blueprints = {
    categories, blocks,
    get: (id) => categories.find((c) => c.id === id),
  };
})();
