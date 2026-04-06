# Ad Builder — Technical Overview

## What It Is

A React single-page application that solves two problems for PatientPoint's digital ad operations:

1. **Build new ads from scratch** — Guided wizard generates device-ready HTML ad packages using the correct tech stack (TweenMax 2.0.1, jQuery 2.1.4, ES5, appHost API).
2. **Import and refactor agency ads** — Agencies deliver ads built with modern web tech (GSAP 3, Google Web Designer, ES6+, CDN dependencies) that can't run on the target devices. The app auto-detects problems, auto-fixes what it can, and generates an AI context file (`CLAUDE.md`) that a Claude Code session in VS Code uses to finish the remaining work — with zero hand-written code in our tests.

---

## Target Devices

All ads run on **BrightSign media players** in doctor office waiting rooms and exam rooms. The devices run **Chrome 69** (2018), are **always offline** (no internet), and communicate with a host application via an `appHost` JavaScript API.

| Platform | Dimensions | Use Case |
|----------|-----------|----------|
| IXR Interact (CP) | 1080x1733 | Exam room wallboard — portrait, animated, ISI scroller |
| IXR Interact (MR) | 300x250 | Small rectangle banner |
| iPro Interact | 1488x837 | Professional waiting room — landscape, animated, ISI scroller |
| Focus | TBD | Future platform |

The Chrome 69 constraint dictates everything: **ES5 only** (no `const`, `let`, arrow functions, template literals, Promises, `fetch`, `async/await`, classes, destructuring, spread operators), **no CSS Grid**, **no CSS custom properties**, **no Web Components**, and all assets must be local (no CDN scripts or fonts).

---

## Tech Stack & Dependencies

```json
{
  "react": "^18.2.0",
  "zustand": "^4.4.7",
  "jszip": "^3.10.1",
  "acorn": "^8.16.0",
  "vite": "^5.0.8",
  "tailwindcss": "^3.4.0"
}
```

**Why these choices:**

- **React 18 + Vite** — Fast dev server, no heavy bundler config. Vite's ESM-native approach means near-instant HMR. We chose Vite over CRA because CRA is deprecated and Vite is significantly faster.
- **Zustand** — Minimal state management (no Redux boilerplate). Two stores: `projectStore` for building new ads, `refactorStore` for the import/refactor workspace. Both use Zustand's `persist` middleware to survive page reloads via `localStorage`.
- **JSZip** — Client-side ZIP reading/writing. Ads are uploaded as ZIPs, parsed entirely in the browser, and exported as ZIPs. No server needed.
- **Acorn** — Lightweight JavaScript AST parser (~50KB, zero dependencies). Used for reliable ES6→ES5 conversion, GSAP 3→TweenMax syntax transformation, and click handler extraction. Replaced the fragile regex+brace-counting approach in the most complex parsing functions.
- **Tailwind CSS** — Utility-first CSS. Fast to iterate on UI without writing custom CSS files. All styling is inline in JSX.
- **No backend** — The entire app runs client-side. No server, no database, no auth. This was deliberate — the app is deployed on Railway as a static site. No server-side runtime required.

**npm Registry:** npm packages are installed via **JFrog Artifactory** (`outcomehealth.jfrog.io`), which acts as a corporate npm proxy. The `.npmrc` is configured with the Artifactory registry URL and an auth token.

**What we intentionally did NOT use:**
- No TypeScript — Faster iteration during rapid prototyping. The codebase is ~12,000 lines across 9 key files. Type safety would help at scale but wasn't worth the overhead for a single-developer internal tool.
- No test framework (yet) — Validation is done via `node --check` syntax verification and manual testing against real ads. Now that npm is available via JFrog, Vitest could be added for snapshot regression tests.
- No router — Single-page with conditional rendering. The app has two modes (build vs. refactor) toggled by Zustand state, not URL routes.

---

## Architecture

### File Map

```
app/
  src/
    components/
      import/
        ImportAdButton.jsx       (531 lines) — Platform picker modal, drag-and-drop, file upload
      refactor/
        exportUtils.js           (1761 lines) — CLAUDE.md AI context file generation
      editor/                    — Code editor for refactor workspace
      preview/                   — Live iframe preview
      templates/                 — Template wizard + grid
      clickzone-tool/            — Visual click zone placement tool
      layout/                    — App shell, navigation
      export/                    — ZIP export UI
    stores/
      projectStore.js            (414 lines) — Build-new-ad state (Zustand + localStorage)
      refactorStore.js           (388 lines) — Import/refactor workspace state
    templates/
      index.js                   — Template registry (18 templates across CP/INT/MR)
    utils/
      adImporter.js              (6347 lines) — Core refactoring engine
      astUtils.js                (461 lines) — Acorn AST parsing helpers (ES6 conversion, GSAP, clicks)
      templateGenerator.js       (905 lines) — HTML/JS/CSS code generation
      zipExporter.js             (146 lines) — JSZip packaging
  refactor_analyzer.py           (935 lines) — Python bulk analysis tool
```

### Data Flow

```
[Agency ZIP] → ImportAdButton.jsx → adImporter.parseAdZip()
                                         │
                                         ├── Extract ZIP (JSZip)
                                         ├── Find HTML entry point
                                         ├── Scan all JS files
                                         ├── detectFeatures() → ~45 boolean flags
                                         ├── Apply ~23 auto-fix steps
                                         ├── Extract URLs, assets, metadata
                                         │
                                         ▼
                                    importResult {}
                                         │
                          ┌──────────────┼──────────────┐
                          ▼              ▼              ▼
                   refactorStore    exportUtils     Refactor UI
                   (workspace)     (CLAUDE.md)     (editor/tasks)
                                         │
                                         ▼
                                   [Export ZIP]
                                   containing refactored files
                                   + CLAUDE.md context file
                                         │
                                         ▼
                                   Claude Code in VS Code
                                   finishes manual tasks
```

---

## The Import/Refactor Pipeline (adImporter.js)

This is the heart of the application at 6,354 lines. It does three things:

### 1. Detection (~45 Feature Flags)

`detectFeatures()` scans all HTML and JS files in the ZIP and sets boolean flags:

| Category | Flags |
|----------|-------|
| **Frameworks** | `isGWD`, `hasEnabler`, `hasCreateJS`, `hasCroppyTemplate`, `hasBannerify`, `hasWebpack`, `hasLottie` |
| **Animation** | `hasTweenMax`, `hasGSAP3`, `hasCSSAnimation`, `hasTimelineMax` |
| **Click handling** | `hasEnablerExits`, `hasClickTagVars`, `hasWindowOpen`, `hasOnClick`, `hasExitsFunction`, `hasAreaTags`, `hasDataExit` |
| **ISI** | `hasISI`, `hasOuterMostDiv`, `hasIScroll`, `hasMCustomScrollbar`, `hasOverlayScrollbars`, `hasSwiperISI`, `hasCustomScroller`, `hasExpandableISI`, `hasISIText` |
| **Dependencies** | `hasGoogleFonts`, `hasCDNScripts`, `hasTracking`, `hasPoliteLoader`, `hasCSSVariables`, `hasCSSGrid`, `hasES6` |
| **Other** | `hasVideo`, `hasIframe`, `hasImageMap`, `hasModalAd`, `hasBrowserDetection` |

Detection is **platform-agnostic** — the same flags work for IXR, iPro, and Focus. What changes per platform is how those flags are acted upon.

### 2. Auto-Fix Steps (~23)

Each fix runs conditionally based on detected flags:

| Step | What It Does |
|------|-------------|
| GSAP 3 → TweenMax | Rewrites `gsap.timeline()` → `new TimelineMax({})`, `gsap.to()` → `TweenMax.to()`, etc. Uses Acorn AST parsing for call expression arguments (nested objects like `scrollTo: {y: 100}` handled natively by the parser), with brace-counting regex fallback for malformed code |
| CSS variable resolution | Parses `--custom-prop: value` declarations, replaces all `var(--custom-prop)` with literal values |
| Google Fonts removal | Strips `<link>` tags referencing `fonts.googleapis.com` and `@font-face` blocks with CDN URLs |
| Tracking pixel removal | Removes `<img>` tags with 1x1 dimensions or tracking domains |
| Meta tag injection | Adds missing `charset`, `Cache-Control`, `Pragma`, `Expires`, `viewport`, `ad.size` meta tags |
| Overflow fix (CP) | Removes `overflow:hidden` from `html`/`body` so ISI can scroll during browser testing |
| Enabler.js removal | Strips Enabler script tags and stub code |
| Console silencing | Adds `console.log = console.info = ... = function() {}` |
| Inline script extraction | Moves large inline `<script>` blocks to external `.js` files |

### 3. CLAUDE.md Generation (exportUtils.js)

The exported CLAUDE.md file is platform-gated and includes:

- **Device specs** — ES5 rules, TweenMax API reference, jQuery version, appHost integration pattern
- **Click handler template** — The exact code pattern for `openExternalLinkFull()`, `openExternalPDF()`, and `openMod()` with correct appHost methods per platform
- **Animation wrapper** — The `onWallboardIdleSlideDisplay` / `firstPlay` / `createAnimation()` pattern for CP/iPro, or `$(document).ready()` for MR
- **ISI scroller structure** — The `outerMostDiv`/`innerMostDiv` HTML pattern with scroller CSS
- **Remaining tasks** — Auto-generated checklist of what the AI agent still needs to do
- **Asset inventory** — Categorized list of all images with detected usage (frame, background, ISI, logo, CTA)

Three helper functions control platform-specific content:
- `buildAdContext(adPlatform)` — Device description
- `buildDeviceSpecs(adPlatform, adType, width, height)` — Full specifications block
- `buildImportantNotes(adPlatform)` — Testing and compatibility notes

Each routes to platform-specific builders: `buildIXRDeviceSpecs()`, `buildIProDeviceSpecs()`, with Focus as a TODO placeholder.

---

## The Build-New-Ad Pipeline

### Template System

18 templates across 3 brands (CP, INT, MR) and 4 categories (static, animated, video, modal). Each template defines:

```javascript
{
  id: 'cp-animated-isi',
  dimensions: { width: 1080, height: 1733 },
  features: ['isi', 'animation'],
  requiredAssets: ['background', 'frames', 'isiImage'],
  configFields: ['clickTag1', 'clickTag2', 'clickTag3', 'clickTag4']
}
```

### Code Generation (templateGenerator.js)

`generateHTML()`, `generateAdJS()`, `generateScrollerJS()`, `generateAnimationJS()`, and various CSS generators produce the full ad package. The animation system supports 13 presets (fadeIn, slideLeft, zoomIn, etc.) and generates TweenMax 2.0.1 `TimelineMax` code with absolute-time positioning.

### State Management (projectStore.js)

Zustand store with `persist` middleware. Holds:
- Template selection and project name
- Uploaded assets (background, frames, ISI image, video, etc.)
- Configuration (click URLs, ISI dimensions/positioning, scroller styling, animation sequences)
- Unmapped assets from imports

The `persist` middleware serializes to `localStorage`, which means **asset data URLs are stored in localStorage**. This is a known scaling concern (see below).

---

## The Python Analyzer (refactor_analyzer.py)

A standalone 935-line Python script that bulk-analyzes the Egnyte ad archive to identify patterns the pipeline needs to handle. It was used to iteratively build the detection rules by comparing agency originals against dev-refactored versions.

### How It Works

```
Egnyte (READ-ONLY)
  └── IXR_Interact/
       └── BrandName/
            └── brand_year_IXR_IADS-XXXX_campaign_type/
                 ├── 2_Assets/          ← Original agency HTML (what we analyze)
                 └── 4_Routing/
                      └── R[highest]/HTML/  ← Dev-refactored version (what shipped)
```

1. **`find_iads_jobs()`** — Walks the Egnyte mount, finds all IADS-7000+ folders that have HTML in `2_Assets/` AND a refactored version in `4_Routing/R[highest]/HTML/`. Returns a list of job dicts with paths.

2. **`analyze_ad(job)`** — For each job:
   - Reads the original HTML (prefers `index.html`, falls back to largest `.html` file)
   - Reads all original JS files from sibling/child directories (skips library files like jQuery, GSAP)
   - Reads the refactored HTML + `ad.js`
   - Extracts metadata: dimensions, brand type (CP/MR/INT), GWD detection, language (English/Spanish)
   - Extracts click handlers from both versions (7 patterns: `exits()`, `Enabler.exit()`, `window.open()`, `onclick`, `<a href>`, `<area>`, `clickTag` vars)
   - Extracts ISI structure (container IDs, image vs. text, expandable, outerMostDiv pattern)
   - Compares file inventories (added/removed files between original and refactored)
   - Detects ES6+ patterns (10 checks: `const`, `let`, arrow functions, template literals, etc.)
   - Flags unusual patterns (scroll libraries, video, modals, Google Fonts, CDN deps, CSS Grid, iframes, polite loaders, image maps)

3. **`generate_report(results)`** — Produces a `REFACTOR_ANALYSIS.md` with:
   - Per-ad detailed analysis (metadata, click mapping, ISI structure, file changes, ES6 patterns, unusual flags)
   - Summary tables: click pattern frequency, ISI type frequency, ES6 pattern frequency
   - **Recommended files to pull** — One ad per unique pattern category (GWD, Enabler exits, video, Spanish, each scroll library, expandable ISI, etc.) for targeted testing

### Key Design Decisions

- **Brace-counting parser** for `exits()` functions — Regex alone can't handle nested switch/case bodies. `extract_function_body()` tracks `{`/`}` depth to reliably extract the full function.
- **Multiple encoding fallbacks** — Agency files come in UTF-8, Latin-1, and CP1252. `read_file_safe()` tries all three.
- **Normalized file comparison** — Original assets are often nested in zip-extracted subfolders with random names. `normalize_file_path()` strips prefixes and maps files to `subdir/filename` for meaningful diff comparison.
- **Dry-run mode** (`--dry-run`) — Analyzes 5 diverse ads instead of all ~54. Picks one per brand type suffix (CP, MR, etc.) for representative coverage.

---

## Key Design Decisions & Trade-offs

### 1. Client-Side Only (No Server)

**Decision:** Everything runs in the browser. ZIP parsing, code transformation, AI context generation — all client-side JavaScript. Deployed on Railway as a static site.

**Why:** No server-side logic is needed. Each user uploads a ZIP, the browser processes it, and exports a ZIP. All computation is local to the browser session. Railway serves the static Vite build — no backend runtime.

**Trade-off:** No server means no shared state, no project history across users, no centralized logging. Each user's browser is an independent instance. This is fine for a 4-person team where each person works on different ads.

### 2. Zustand Over Redux

**Decision:** Zustand with `persist` middleware instead of Redux or React Context.

**Why:** Two independent state domains (build vs. refactor) with simple read/write patterns. Zustand's API is ~90% less boilerplate than Redux. The `persist` middleware gives us localStorage serialization for free, so users don't lose work on page refresh.

**Trade-off:** No Redux DevTools, no middleware chain, no time-travel debugging. For a single-user internal tool, this is fine.

### 3. String Concatenation for Code Generation

**Decision:** Both `templateGenerator.js` and `exportUtils.js` build output strings with `+=` concatenation rather than using a template engine (Handlebars, EJS, etc.).

**Why:** The generated code is highly conditional — platform-gated, feature-gated, ad-type-gated. A template engine would require complex partial logic that's harder to read than straight JavaScript conditionals. The `s += '...\n'` pattern is verbose but extremely explicit about what each line of output looks like.

**Trade-off:** The files are long (exportUtils is 1,761 lines, templateGenerator is 905 lines). Any formatting error in a string literal silently produces broken output. There's no compile-time validation of the generated code.

### 4. AST-First Parsing with Regex Fallback

**Decision:** `adImporter.js` uses Acorn AST parsing for structural JavaScript transformations (ES6→ES5 conversion, GSAP 3→TweenMax, click handler extraction) and regex for simple string-presence detection (`detectFeatures()` flags).

**Why:** The codebase originally used pure regex+brace-counting because npm was blocked. Once JFrog Artifactory access was configured, we added Acorn (~50KB, zero deps) and rewrote the three most fragile parsing systems to use AST. Regex remains for `detectFeatures()` because those checks are simple string-presence tests (e.g., "does this code contain `Enabler.js`?") where AST would be overkill.

**Architecture:** `astUtils.js` (461 lines) provides the AST layer. Each transformation tries AST first and falls back to the original regex approach if Acorn can't parse the code (common with malformed/partial agency JS). This means:
- Well-formed code gets correct AST-based transformation (no false positives from comments or strings)
- Malformed code still gets a best-effort regex conversion instead of failing silently

**Trade-off:** Two code paths to maintain (AST + regex fallback). The fallback path will gradually become less exercised as we validate more ads, but removing it entirely would risk regressions on edge-case agency code.

### 5. AI-Assisted Finish Instead of Full Automation

**Decision:** The pipeline auto-fixes ~23 patterns and generates a context file for an AI agent to finish the rest, rather than trying to automate everything.

**Why:** The long tail of agency code patterns is enormous. Some ads use CreateJS (canvas-based, requires complete rebuild), some use Webpack bundles (can't auto-unpack), some have deeply intertwined animation and click logic. Attempting to auto-fix everything would require an impractical amount of edge-case code. The AI agent approach handles the long tail naturally — the CLAUDE.md gives it enough context to make correct decisions about novel patterns.

**Trade-off:** Requires a Claude Code license and a human to review the AI's output. The quality of the AI's work depends entirely on the quality of the CLAUDE.md context file — if we miss a spec or give wrong guidance, the AI will faithfully produce wrong output.

### 6. `localStorage` for Persistence

**Decision:** Both stores persist to `localStorage` via Zustand's `persist` middleware.

**Why:** Simple, zero-config, works offline. No database to set up or maintain.

**Trade-off:** `localStorage` has a ~5-10MB limit depending on the browser. Asset data URLs (base64-encoded images) can easily exceed this. A large ad with many frames could hit the limit and silently fail to persist. IndexedDB or a file-system-based approach would be more robust.

---

## Potential Scaling Concerns

### 1. adImporter.js Size (6,354 lines)

The core engine is a single file. It's organized into sections (detection, auto-fix, URL extraction, asset mapping, metadata) but there's no module boundary between them. If the pattern library grows significantly (more platforms, more agency frameworks), this file will become unwieldy.

**Mitigation:** Could split into `detector.js`, `autoFixer.js`, `urlExtractor.js`, `assetMapper.js`. The functions are already relatively independent — the refactor would be mechanical.

### 2. localStorage Limits

Data URLs for images are base64 strings (~33% larger than the binary). A 1MB image becomes ~1.3MB of localStorage. An ad with 20 frames could consume 25MB+ of localStorage, exceeding browser limits.

**Mitigation:** Switch to IndexedDB for asset storage (keeps string config in localStorage, binary assets in IndexedDB). Or use the File System Access API for direct file I/O.

### 3. No Automated Tests (Yet)

Every change to `adImporter.js` or `exportUtils.js` is validated by:
1. `node --check` syntax verification
2. Manually importing a real ad ZIP and inspecting the output
3. Handing the exported CLAUDE.md to a Claude Code session and verifying it produces correct output

This works for one developer iterating quickly, but would not scale to a team. A regression in auto-fix step #14 might not be caught until someone imports a specific ad that exercises that code path.

**Mitigation (now unblocked):** npm is available via JFrog Artifactory. Next step is adding Vitest with snapshot tests — import known ZIPs, snapshot the `importResult`, and diff against expected output. The Python analyzer's dataset could also be adapted into a regression test suite. Acorn's `parse()` can also validate generated JS syntax before export.

### 4. Regex Fragility in Detection

The AST integration resolved the most fragile parsing (GSAP conversion, ES6 arrows, template literals), but `detectFeatures()` still uses regex for its ~45 boolean flags. Known edge cases:
- Minified code with no whitespace can cause regex patterns to match across statement boundaries
- String literals containing code-like text (e.g., error messages mentioning "function") trigger false detections
- Comments containing disabled code (`// gsap.timeline()`) are detected as if they were active

**Mitigation:** These are detection flags (boolean "does this pattern exist?"), not code transformations. False positives in detection are low-risk — they result in extra warnings in the CLAUDE.md, not broken auto-fixes. The high-risk code transformations (GSAP, ES6, click extraction) now use AST where possible.

### 5. Single-User Assumption

The app assumes one user on one machine. There's no concept of projects saved to a server, no collaboration, no version history. The refactor workspace holds one ad at a time.

**Mitigation:** If multi-user is needed: add a simple backend (Express + SQLite), replace localStorage with API calls, add project list/history. The Zustand stores are already structured as clean state + actions, so the refactor would primarily be swapping the persistence layer.

### 6. No Build Pipeline Verification

Generated code is never executed or syntax-checked before export. If `templateGenerator.js` produces invalid JavaScript (e.g., unclosed brace, typo in a TweenMax property), the user won't know until they open the exported ad in a browser.

**Mitigation (now possible):** Acorn is installed and could be used to validate generated JS syntax before export via `tryParse()`. This would catch syntax errors at export time rather than in the browser. Not yet implemented but straightforward to add.

### 7. Platform Proliferation

Currently three platforms (IXR, iPro, Focus) with two having full specs. Each platform adds branches to `buildAdContext()`, `buildDeviceSpecs()`, `buildImportantNotes()`, and potentially platform-specific auto-fix steps. If more platforms are added, the conditional branching becomes a maintenance burden.

**Mitigation:** Extract platform specs into a data-driven config object:
```javascript
const PLATFORMS = {
  ixr: { name: 'IXR Interact', devices: '...', clickMethod: 'openExternalLinkFull', ... },
  ipro: { name: 'iPro Interact', devices: '...', clickMethod: 'requestFullscreenBrowserView', ... },
}
```
Then `buildDeviceSpecs()` reads from config instead of branching.

---

## Questions an Engineering Team Might Ask

### Architecture

**Q: Why no TypeScript?**
A: Speed of iteration on a single-developer internal tool. The codebase is ~11K lines — small enough that a developer can hold the whole thing in their head. TypeScript would add value if the team grows or the codebase doubles in size.

**Q: Why is adImporter.js 6,000+ lines in one file?**
A: It grew organically through iterative testing against 54 real ads. Each new pattern discovered added a detection flag and/or auto-fix step. The functions within it are independent and could be split into modules — the single-file structure is a consequence of rapid iteration, not a deliberate architectural choice.

**Q: Why Zustand instead of Redux or React Context?**
A: Two isolated state domains with simple CRUD patterns. Redux would triple the boilerplate for no benefit. React Context would cause unnecessary re-renders across the component tree. Zustand gives us scoped subscriptions and built-in persistence with minimal code.

**Q: Why no routing?**
A: The app has two modes (build and refactor) with no deep-linking requirement. A router would add complexity for URL management that nobody needs — this runs locally, not as a shared web app.

### The Refactoring Pipeline

**Q: How reliable is the parsing?**
A: The three highest-risk transformations (GSAP 3 conversion, ES6→ES5, click extraction) now use Acorn AST parsing, which handles nested objects, arrow function scoping, and template literals correctly. The ~45 detection flags still use regex, but those are boolean presence checks where false positives are low-risk (they add extra warnings, not broken code). The AST layer falls back to the original regex approach if Acorn can't parse malformed agency code, so nothing silently breaks.

**Q: What happens when you encounter a completely new agency framework?**
A: Detection flags it as unknown, auto-fix skips it, and the CLAUDE.md lists it as a manual task. The AI agent receives enough device-spec context to figure out the conversion. This is the strength of the AI-assisted approach — it degrades gracefully on unknown patterns.

**Q: How do you validate that the auto-fixes don't break the ad?**
A: Manual testing. We import a real ad ZIP, inspect the auto-fix output in the refactor workspace editor, then export and open in a browser. The Python analyzer provides before/after comparison data to verify fixes match what human developers did historically. npm access is now available via JFrog Artifactory, so automated snapshot tests (Vitest) are the planned next step.

**Q: What's the GSAP 3 converter doing exactly?**
A: Rewrites modern GSAP 3 syntax to TweenMax 2.0.1 syntax:
- `gsap.timeline()` → `new TimelineMax({})`
- `gsap.to()` → `TweenMax.to()`
- `gsap.set()` → `TweenMax.set()`
- `duration` property inside tween objects → third positional argument
- Uses Acorn AST to parse call expression arguments, so nested objects like `scrollTo: {y: 100}` are handled natively by the parser. Falls back to the original brace-counting approach for code Acorn can't parse.

**Q: Why generate a CLAUDE.md instead of just auto-fixing everything?**
A: The long tail is too long. CreateJS ads need complete canvas-to-DOM rebuilds. Webpack bundles can't be auto-unpacked. Complex animation timelines with labels, callbacks, and conditional logic need semantic understanding. Auto-fixing the easy ~60% and giving AI the context for the remaining ~40% produces better results than trying to automate 100%.

### The Python Analyzer

**Q: Why Python and not JavaScript?**
A: It reads files from a mounted Egnyte network drive. Python's `pathlib` and `os.walk` are more natural for filesystem traversal than Node's `fs` module. It also runs independently of the React app — it's a one-off analysis tool, not part of the runtime.

**Q: How does it handle the variety of agency folder structures?**
A: `find_iads_jobs()` looks for the standardized PatientPoint folder convention (`2_Assets/` for originals, `4_Routing/R[n]/HTML/` for refactored). Within `2_Assets/`, `read_original_js_files()` searches for JS in multiple common subdirectories (`js/`, `script/`, `scripts/`, `lib/`). `normalize_file_path()` strips agency-specific folder nesting to enable meaningful file-level comparison.

**Q: What did the analyzer discover that you didn't expect?**
A: Several things that became pipeline features: JS-injected ISI (`ISIText.js` pattern), multiple scroll library variants (iScroll, mCustomScrollbar, OverlayScrollbars, Swiper, a custom Havas class), the `exits(event)` switch/case click handler pattern requiring brace-counting, Spanish-language ads with timing variables using Spanish number words, and agencies that put all code in a single monolithic HTML file (no external JS/CSS).

### Operations & Deployment

**Q: How is this deployed?**
A: Deployed on **Railway** as a static site. `vite build` produces a static bundle served by Railway — no server-side runtime required. Multiple users access it via the Railway URL, each with their own independent browser session.

**Q: What happens if localStorage gets corrupted?**
A: The app starts fresh. There's no migration or recovery mechanism. Since the app is a tool (not a database), losing localStorage means losing in-progress work but not any source of truth — the original ad ZIPs and Egnyte archive are the sources of truth.

**Q: Can multiple people use this simultaneously?**
A: Yes. The app is deployed on Railway and supports multiple concurrent users. Each person's browser has independent localStorage — no shared state, no conflicts. Currently used by a team of 4.

---

## File Reference

| File | Lines | Purpose |
|------|-------|---------|
| `adImporter.js` | 6,347 | Core refactoring engine — ZIP parsing, 45 detections, 23 auto-fixes |
| `exportUtils.js` | 1,761 | CLAUDE.md AI context file generation, platform-gated device specs |
| `refactor_analyzer.py` | 935 | Python bulk analysis of Egnyte ad archive |
| `templateGenerator.js` | 905 | HTML/JS/CSS code generation for new ads |
| `ImportAdButton.jsx` | 531 | Platform picker, drag-and-drop, ZIP/folder upload |
| `astUtils.js` | 461 | Acorn AST parsing helpers — ES6 conversion, GSAP, click extraction |
| `projectStore.js` | 414 | Zustand store for build-new-ad workflow |
| `refactorStore.js` | 388 | Zustand store for import/refactor workspace |
| `zipExporter.js` | 146 | JSZip packaging for export |
| `templates/index.js` | ~100 | Template registry (18 templates) |
