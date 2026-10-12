# PixelProTech Pixel App — v0.1.0

Original, offline-capable website builder by PixelProTech Solutions. Flat folder, no frameworks, no CDNs, no external requests.

## Deploy
Upload every file in this folder to the root of a GitHub Pages repo (no subfolders needed). HTTPS is required for the service worker and install prompt. Locally: `python3 -m http.server` in this folder, then open http://localhost:8000.
Release rule: when any shell file changes, bump `VERSION` in `sw.js`, or browsers will keep serving the old cached shell.

## Files (24, all in the root)
| File | Purpose |
|---|---|
| index.html | Application shell |
| app.css | Locked palette (#07070A / #00D4AA / #F1EEFA), layout, components |
| components.js | Component registry: fields, defaults, renderers, CSS generation |
| blueprints.js | Categories, reusable blocks, per-category conventions |
| templates.js | 5 Business templates (distinct structures) |
| engine.js | Project model, selection, undo/redo, validation, pages, assets |
| storage.js | IndexedDB persistence, quota handling, project-file import/export |
| canvas.js | Editing canvas (iframe), selection overlay, breakpoints |
| panels.js | Add / Layers / Pages panels |
| inspector.js | Property inspector |
| dialogs.js | Projects, Preflight, Export, Settings dialogs |
| exporter.js | Site generator, reference verifier, ZIP writer |
| preflight.js | Pixel Preflight, 12 checks |
| app.js | Boot, autosave, shortcuts, install, service-worker status |
| sw.js, manifest.webmanifest, offline.html | PWA |
| icons.svg | Custom interface icon sprite |
| icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png | App icons |
| icon-maskable-src.svg | Source art for the maskable icon (not loaded at runtime) |

## Tested in this release (Chromium, headless, served over localhost)
- All 12 JS files parse; every `src`/`href`/manifest icon/service-worker cache entry resolves to a file in the root; no subfolders; no external URLs.
- All 5 Business templates: create, edit a heading, undo, redo, run Preflight, export. 5/5 succeeded, 0 console or page errors.
- Preflight on deliberately defective projects: empty project name (P01), empty page title (P02), broken page link (P04), broken anchor (P04, P10), malformed URL (P05), incomplete email (P05), 3 MB image (P07), deleted asset (P03, P08), each flagged by the expected check. A valid, fully-linked project produced 0 non-PASS results.
- P06 (overflow) detector: reports a 900 px element at 375 px as overflow, and a clean page as no overflow. Note: the generated CSS wraps long words, so a long unbroken heading does not overflow (correct behaviour).
- Export: ZIP integrity test passed; unzipped and opened over `file://` with no editor present; all internal page links resolve; 375 px view has no horizontal overflow; flat output (`index.html`, other pages, `site.css`, `site.js`).
- Real UI path: pick a template, click a canvas element, edit through the inspector (canvas updated), Undo reverted it, mobile preview switch, Preflight dialog, Export dialog downloaded `field-crew-site.zip`.
- Persistence: edit, autosave pill showed SAVED, page reload restored the edited project.
- Offline: service worker reached OFFLINE READY; with the network switched off, reload still loaded the app and restored the project.

## Not tested / known limitations
- Chromium only. Firefox, Safari, Edge and mobile browsers are untested.
- The install prompt (beforeinstallprompt) cannot fire in headless mode; installability itself was not tested.
- Interrupted-session recovery and storage-quota failure paths exist in code but were not forced in a test.
- Image upload through the file picker UI was not driven; asset logic was tested through the engine API.
- Drag-and-drop placement was not tested.
- Only the Business category is built. Creative, Commerce, Publishing and Personal are marked "planned" in the UI with no templates, by design (Stage 7).
- Preflight is a limited set of checks. It does not certify accessibility, SEO, security or browser compatibility.
- Minor visual defect: the Text colour swatch shows black while the value is "inherit".
- Exported ZIP is uncompressed (stored); exported site was only opened in Chromium.
