# Reverse Engineering the Ad Refactor Pipeline — Focus Platform

This document is a handoff guide for building the **Focus** ad refactoring rules. It explains the approach we used for IXR Interact ads so you can replicate it for Focus ads with different specs.

**Hand this file to Claude Code** and let it drive the process. The methodology is the same — only the device specs, folder paths, and detection rules change.

---

## What This Project Does

The Ad Builder app (`/app/src/`) imports pre-built HTML ad packages (ZIPs from agencies like Havas, FCB, Digitas), analyzes them for patterns that won't work on our target devices, auto-fixes what it can, and exports a refactored package. For anything it can't auto-fix, it generates a `CLAUDE.md` AI context file with targeted guidance so another Claude Code session can finish the work in VS Code.

### The Two Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `app/src/utils/adImporter.js` | Core refactoring engine — parses ZIP, detects features, applies auto-fix steps, generates manual tasks | ~5800 |
| `app/src/components/refactor/exportUtils.js` | Generates the CLAUDE.md AI context file with warnings, checklists, device specs, and step-by-step guides | ~1300 |

### Platform Selection (Already Built)

The app now asks "IXR Interact or Focus?" when the user clicks Import Ad. The selection is stored as `adPlatform` (`'ixr'` or `'focus'`) and threaded through the entire pipeline:

- `parseAdZip(file, { platform: 'focus' })` — stored as `result.adPlatform`
- `refactorStore.adPlatform` — available to all UI components
- `importResult.adPlatform` — available to exportUtils.js

**Your job:** Fill in the Focus-specific rules wherever you see `TODO: Focus` in the codebase. Search for that string — there are placeholder spots in `exportUtils.js` ready for you.

---

## The Methodology (How We Built IXR Rules)

We didn't guess at what patterns exist. We reverse-engineered them from ~300 real ads on Egnyte. Here's the process:

### Step 1: Get Access to Real Ads

For IXR, the ads live on an Egnyte mount at:
```
/Users/Philip.Kowalski/Library/CloudStorage/Egnyte-patientpoint/Shared/creative/root/02_Ads/Digital/IXR_Interact/
```

**You need to provide the equivalent path for Focus ads.** This is the READ-ONLY source folder where agency-submitted ads and dev-refactored versions live.

The IXR folder structure per ad is:
```
BrandName/
  brandname_2026_IXR_IADS-XXXX_campaignname_type/
    2_Assets/          ← Original agency HTML (pre-refactoring)
    4_Routing/
      R1/HTML/         ← First dev refactored version
      R2/HTML/         ← Second revision (if exists)
      R[highest]/HTML/ ← Latest refactored version (this is what shipped)
```

**Question for you:** What is the folder structure for Focus ads? Same pattern? Different? Where are the originals vs. the refactored versions?

### Step 2: Run the Analyzer

We built `refactor_analyzer.py` (935 lines, in the project root) to bulk-scan all IXR ads and generate a report. It:

1. Walks the Egnyte mount finding all IADS-7000+ job folders
2. For each ad, reads both the **original** (2_Assets) and **refactored** (4_Routing/R[highest]/HTML) versions
3. Compares them to discover:
   - What dimensions are used (CP=1080x1733, MR=300x250, INT=1000x1600)
   - What click handling patterns exist (exits(), Enabler.exit(), window.open(), onclick, etc.)
   - What ISI structures are used (image vs live text, standard vs alternative)
   - What animation libraries appear (GSAP 3.x, TweenMax, CSS, GWD, jQuery.animate)
   - What ES6+ syntax needs conversion
   - What unusual patterns appear (iframes, modals, polite loaders, scroll libraries, CDN deps)
   - What the dev changed during manual refactoring (diff between original and refactored)
4. Generates a `REFACTOR_ANALYSIS.md` report with statistics and pattern frequency tables

**You should fork/adapt this analyzer for Focus ads.** Change:
- `BASE_DIR` to point to the Focus folder
- `MIN_IADS` if Focus uses a different numbering scheme
- Folder structure assumptions (2_Assets, 4_Routing, etc.) if different
- Detection patterns if Focus devices have different requirements

### Step 3: Pick Diverse Test Ads

From the analyzer report, we picked ads covering different pattern combinations. For IXR we tested 19 ads across these categories:

- iScroll, GSAP 3.x CDN, `<a href>` links, live HTML ISI, Typekit
- Custom Scroller class, dynamic CDN, polite loader chain
- `javascript:void(window.open())` patterns
- `exits(event)` with switch/case, expandable ISI
- GWD (Google Web Designer) with Enabler.js
- CreateJS/Canvas (Adobe Animate CC)
- Image maps (`<map>`/`<area>`)
- Modal ads (requestModalAdView)
- SVG-based ads
- CSS-only animation
- JS-injected ISI (`ISIText()` function pattern)

**You should do the same for Focus.** Run the analyzer, look at what patterns are most common, and pick ~10-15 diverse ads to test against.

### Step 4: Iterative Detection & Fix Development

For each test ad:

1. **Read the original ad code** (READ-ONLY on Egnyte — never modify)
2. **Compare what the importer detects** vs what actually exists in the ad
3. **Fix gaps** in detection flags, auto-fix steps, and CLAUDE.md guidance
4. **Verify syntax** with `node --check` (we can't run builds — npm is blocked)

This is an iterative loop. Each ad you test will reveal patterns the importer doesn't handle yet. Fix them, test the next ad, repeat.

---

## What Exists Today (IXR Rules)

### Feature Detection Flags (~40 flags in `detectFeatures()`)

These boolean flags tell the pipeline what's in the ad:
- Animation: `hasGreenSock`, `hasTimeline`, `hasTweens`, `hasGWDCSSAnimations`, `hasAnimation`
- ISI: `hasISI`, `hasStandardISI`, `hasAlternativeISI`, `hasExpandableISI`, `hasLiveISIText`, `hasJSInjectedISI`
- Click handling: `hasExitsHandler`, `hasExitsFunctionWithWindowOpen`, `hasAnchorHrefLinks`, `hasDataExitClicks`, `hasGwdExitElements`
- Libraries: `hasEnabler`, `hasCreateJS`, `hasMCustomScrollbar`, `hasScrollLibrary`, `hasCustomScrollerClass`
- Compatibility: `hasCDNScripts`, `hasDynamicCDN`, `hasGoogleFonts`, `hasPoliteLoader`, `hasIframe`
- Fonts: `hasCustomFonts`, `detectedFonts[]`, `hasLocalFontFiles`

### Auto-Fix Steps (22 steps in the refactoring pipeline)

These run automatically when an ad is imported:
1. AppHost integration injection
2. ES6→ES5 conversion (const/let→var, arrow functions, template literals, .includes())
3. `javascript:void()` click handler conversion
4. `exits()` function parsing with brace-counting
5. `window.open()` conversion to appHost handlers
6. `<a href>` link conversion
7. CDN script tag removal (GSAP, jQuery, Typekit, iScroll, CreateJS)
8. Google Fonts CDN removal
9. GSAP 3.x → TweenMax 2.0.1 conversion
10. GWD element conversion (custom elements → standard HTML)
11. ISI scroller structure injection
12. Console silencing
13. Tracking pixel removal
14. ...and more

### CLAUDE.md Guidance Sections

For patterns that can't be auto-fixed, the exported CLAUDE.md includes:
- Warnings (GWD rebuild, dead Enabler.js code, JS-injected ISI, CDN deps, etc.)
- Pre-implementation checklist
- Click zone & URL mapping table
- Animation details (library, type, complexity, timeline labels, linearization guide)
- ISI details (structure type, replacement steps)
- Scroll library replacement guide
- Modal ad guide
- Iframe removal guide
- Device specifications (ES5, TweenMax, appHost, click handler pattern, ISI scroller structure)

---

## What You Need to Do for Focus

### 1. Provide the Focus ad folder path

The Egnyte mount path where Focus ads live. Same structure question as above — where are originals vs refactored versions?

### 2. Provide Focus device specifications

For IXR, the constraints are:
- Chrome 69 (offline, no internet)
- ES5 only
- TweenMax 2.0.1 (no modern GSAP)
- jQuery 2.1.4
- appHost integration for clicks/PDFs
- outerMostDiv/innerMostDiv ISI scroller
- onWallboardIdleSlideDisplay wrapper for CP animations

**What are the Focus equivalents?** Specifically:
- What browser/version do Focus devices run?
- What JavaScript features are supported?
- What animation library is used?
- How do click handlers work? (appHost? Different API?)
- How does ISI scrolling work?
- What dimensions are Focus ads? (1080x1733, 300x250, other?)
- Are Focus devices offline or online?
- Any Focus-specific libraries or patterns?

### 3. Adapt the analyzer

Fork `refactor_analyzer.py`, point it at the Focus folder, and run it. The report will tell you what patterns Focus ads use and how they differ from IXR.

### 4. Fill in the Focus code paths

Search for `TODO: Focus` in the codebase. Current placeholder locations:

**`exportUtils.js`:**
- `buildAdContext()` — Focus device description
- `buildDeviceSpecs()` — Focus device specifications section (the big reference block)
- `buildImportantNotes()` — Focus-specific testing/compatibility notes

**`adImporter.js`:**
- `result.adPlatform` is already set to `'focus'` when selected
- Add Focus-specific detection in `detectFeatures()` if Focus ads have unique patterns
- Gate any IXR-only auto-fix steps behind `platform === 'ixr'` if they'd break Focus ads
- Add Focus-specific auto-fix steps gated behind `platform === 'focus'`

### 5. Test iteratively

Same loop: pick diverse Focus ads from Egnyte → read the code → compare detection vs reality → fix gaps → repeat.

---

## Key Principles

- **READ-ONLY on Egnyte.** Never modify files on the mount.
- **Minimal refactor philosophy.** Least code necessary to make device-ready. Don't clean up chaotic imported code.
- **No npm.** Registry is blocked on this machine. All validation is `node --check` only.
- **Fonts are sacred.** Never swap brand fonts for web-safe. Localize font files or convert text to images.
- **Another agent may be working simultaneously.** The IXR pipeline is actively being improved. Coordinate on shared files (`adImporter.js`, `exportUtils.js`, `refactorStore.js`).

---

## Quick Start for Claude Code

Hand Claude Code this document along with these instructions:

> Read `reverse_refactor.md` in the project root. I need you to help me build the Focus platform refactoring rules for the Ad Builder app. First, I need to answer the questions in the doc (folder path, device specs, dimensions). Then we'll adapt the analyzer, scan real Focus ads, and iteratively build detection + auto-fix + CLAUDE.md guidance — the same way the IXR rules were built.
