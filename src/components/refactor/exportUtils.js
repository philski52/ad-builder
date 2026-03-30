import JSZip from 'jszip'

// Known pharma brand/company names for logo detection in asset filenames
const KNOWN_BRANDS = [
  'abbvie', 'abrysvo', 'acoramidis', 'adhulem', 'afrezza', 'afrin', 'aimovig', 'airsupra',
  'aklief', 'allegra', 'amitiza', 'amvuttra', 'anzupgo', 'astepro', 'auryxia', 'austedo',
  'aveeno', 'ayvakit', 'bayer', 'beeline', 'belsomra', 'benlysta', 'beyfortus', 'bimzelx',
  'biogen', 'biooil', 'boiron', 'breyanzi', 'breztri', 'brovana', 'brukinsa', 'calquence',
  'camzyos', 'caplyta', 'capvaxive', 'carnation', 'carvykti', 'cerave', 'cheerios', 'cimzia',
  'claritin', 'cobenfy', 'comirnaty', 'contrave', 'cosentyx', 'crenessity', 'darzalex',
  'dayvigo', 'descovy', 'dexilant', 'doptelet', 'dulcolax', 'dupixent', 'ebglyss', 'elahere',
  'elecare', 'elililly', 'eliquis', 'elranatamab', 'elrexfio', 'enbrel', 'enhertu', 'ensure',
  'entresto', 'entyvio', 'epclusa', 'epidiolex', 'epiduo', 'erleada', 'eucerin', 'eucrisa',
  'evenity', 'evusheld', 'eylea', 'farxiga', 'filspari', 'flumist', 'fluzone', 'fotivda',
  'fruzaqla', 'gardasil', 'gatorade', 'gemtesa', 'genentech', 'goodrx', 'heartmate',
  'hizentra', 'humira', 'ianalumab', 'ibrance', 'iclusig', 'imbruvica', 'imdelltra',
  'imfinzi', 'inbrija', 'ingrezza', 'intrarosa', 'iptacopan', 'iqvia', 'isbrela', 'izervay',
  'jakafi', 'januvia', 'jardiance', 'jatenzo', 'jergens', 'jnj', 'karxt', 'kesimpta',
  'kevzara', 'keytruda', 'kisqali', 'klysiri', 'krazati', 'kroger', 'kyprolis', 'lenvima',
  'leqembi', 'leqvio', 'levemir', 'libtayo', 'litfulo', 'lokelma', 'lonhala', 'lynparza',
  'mavacomten', 'mavyret', 'mayzent', 'merck', 'metamucil', 'miralax', 'mirena', 'mounjaro',
  'mycapssa', 'myfembree', 'myrbetriq', 'nasacort', 'naturemade', 'nervive', 'neulasta',
  'neutrogena', 'nexium', 'nexletol', 'nexplanon', 'novartis', 'novolog', 'nubeca', 'nubeqa',
  'nucala', 'nuplazid', 'nurtec', 'ocrevus', 'omnipod', 'oneaday', 'opdivo', 'opzelura',
  'oracea', 'oralb', 'orgovyx', 'oriahnn', 'osteobiflex', 'otezla', 'ozempic', 'pedialyte',
  'perjeta', 'pfizer', 'phesgo', 'piqray', 'pluvicto', 'pneumovax', 'polivy', 'pradaxa',
  'premierprotein', 'prevnar', 'prilosec', 'prolia', 'proquad', 'qulipta', 'qutenza',
  'reblozyl', 'remibrutinib', 'repatha', 'resmed', 'restylane', 'rexulti', 'rezdiffra',
  'rhapsido', 'rinvoq', 'riteaid', 'rubraca', 'rybelsus', 'rystiggo', 'sandostatin',
  'saphnelo', 'sapien', 'saxenda', 'scemblix', 'shingrix', 'singlecare', 'skinceuticals',
  'skyrizi', 'soliqua', 'soolantra', 'sotyktu', 'spiriva', 'splenda', 'steglatro', 'steglujan',
  'stelara', 'sublocade', 'talvey', 'tecentriq', 'tecvayli', 'tepezza', 'tezspire', 'toujeo',
  'trelegy', 'tremfya', 'tresiba', 'trintellix', 'trodelvy', 'truqap', 'truvada', 'tukysa',
  'tzield', 'vabysmo', 'vaccineconfidence', 'valtoco', 'vaqta', 'velsipity', 'venclexta',
  'veozah', 'verquvo', 'verzenio', 'vicks', 'victoza', 'voquezna', 'vtama', 'vyloy',
  'vyndamax', 'vyvgart', 'wainua', 'walgreens', 'wegovy', 'welireg', 'xcopri', 'xeljanz',
  'xiaflex', 'xifaxan', 'xiidra', 'xofluza', 'xolair', 'xtandi', 'xultophy', 'xyosted',
  'xyzal', 'yeztugo', 'yupelri', 'zarbees', 'zavzpret', 'zejula', 'zepbound', 'zeposia',
  'zetia', 'zostavax', 'zurzuvae', 'zyrtec', 'roche', 'cvs', 'centrum'
]

// Check if a filename contains a known brand name
function containsBrandName(filename) {
  const lower = filename.toLowerCase()
  return KNOWN_BRANDS.some(brand => lower.includes(brand))
}

export function buildContextFile(files, tasks, adMeta, importResult) {
  const hasRealAnimation = adMeta?.hasAnimation && !importResult?.animationAnalysis?.isUIOnly
  const pendingTasks = tasks.filter(t => {
    if (t.status === 'done') return false
    // Don't show "Add Animation Frames" task if ad has no real animation or uses CSS-only animation
    if (t.id === 'add-frames' && (!hasRealAnimation || importResult?.animationAnalysis?.type === 'css')) return false
    return true
  })
  const doneTasks = tasks.filter(t => t.status === 'done')
  const appliedFixes = importResult?.appliedFixes || []
  const features = importResult?.features || {}
  const config = importResult?.config || {}
  const allAssets = importResult?.allAssets || []
  const detectedUrls = importResult?.detectedUrls || []
  const animAnalysis = importResult?.animationAnalysis || {}
  const adPlatform = importResult?.adPlatform || 'ixr'
  const adType = importResult?.adType || adMeta?.templateType || null
  const sceneStructure = importResult?.sceneStructure || {}
  const fixes = importResult?.fixes || []

  // Rewrite app-specific actions into code-level instructions for VS Code / AI context
  const rewriteAction = (action) => {
    if (!action) return null
    return action
      .replace(/Use the Assets panel to drag and drop unmapped assets into the correct slots/g,
        'Review the asset files in the ad folder and reference them correctly in index.html')
      .replace(/Use the Animation Editor to recreate the animation sequence with device-compatible settings/g,
        'Rebuild the animation using TweenMax 2.0.1 TimelineMax syntax in the ad JavaScript')
      .replace(/Select the ISI content image from unmapped assets/g,
        'Identify the ISI content image in the assets folder and set it as the src in the ISI container')
      .replace(/Upload or select frame images from unmapped assets, or use Animation Editor for element-based animation/g,
        'Identify the animation frame images in the assets folder and wire them into the TweenMax timeline')
      .replace(/Use the Assets panel/g, 'Check the asset files in the ad folder')
      .replace(/Use the Animation Editor/g, 'Edit the JavaScript directly')
  }

  // --- Remaining Tasks ---
  const taskList = pendingTasks.length > 0
    ? pendingTasks.map((t, i) => {
        let entry = `${i + 1}. **[${t.priority.toUpperCase()}] ${t.title}**\n   ${t.description}`
        const action = rewriteAction(t.action)
        if (action) entry += `\n   **Action:** ${action}`
        if (t.context) entry += `\n   **Context:** ${t.context}`
        return entry
      }).join('\n\n')
    : 'None — all tasks have been completed.'

  // --- Completed Tasks ---
  const completedList = doneTasks.length > 0
    ? doneTasks.map(t => `- ~~${t.title}~~`).join('\n')
    : 'None yet.'

  // --- Applied Fixes ---
  const appliedFixList = appliedFixes.length > 0
    ? appliedFixes.map(f => `- ${f.description}${f.details ? ` (${Array.isArray(f.details) ? f.details.join(', ') : f.details})` : ''}`).join('\n')
    : 'None.'

  // --- Code Files ---
  const codeFiles = Object.keys(files).map(f => `- \`${f}\` (code)`)

  // --- Asset Files with categories (filter __MACOSX junk) ---
  const cleanAssets = allAssets.filter(a => {
    const p = a.path || a.filename || ''
    return !p.startsWith('__MACOSX') && !p.includes('/__MACOSX')
  })
  const assetPaths = cleanAssets.length > 0
    ? cleanAssets.map(a => `- \`${a.path || a.filename}\` (${a.type || 'asset'})`)
    : []
  const fileList = [...codeFiles, ...assetPaths].join('\n')

  const width = adMeta.dimensions?.width || 1080
  const height = adMeta.dimensions?.height || 1733

  // ===== BUILD ENRICHED SECTIONS =====

  // --- Asset Inventory & Mapping (filter __MACOSX junk) ---
  const assetInventory = buildAssetInventory(cleanAssets, importResult?.assets, sceneStructure)

  // --- Click Zone / URL Mapping ---
  const clickMapping = buildClickMapping(detectedUrls, config, adMeta)

  // Focus ads get minimal CLAUDE.md — skip IXR-specific sections
  const isFocusPlatform = adPlatform === 'focus'

  // --- Animation Context (IXR/iPro only) ---
  const animationContext = isFocusPlatform ? '' : buildAnimationContext(animAnalysis, sceneStructure, features, config)

  // --- Feature Detection Summary (IXR/iPro only) ---
  const featureSummary = isFocusPlatform ? '' : buildFeatureSummary(features)

  // --- Detected Issues ---
  const issuesList = isFocusPlatform ? '' : buildIssuesList(fixes)

  // --- ISI Details (IXR/iPro only — Focus leaves ISI as-is) ---
  const isiDetails = isFocusPlatform ? '' : buildISIDetails(features, config, adMeta)

  // --- Scroll Library Replacement Guide (IXR/iPro only) ---
  const scrollGuide = isFocusPlatform ? '' : buildScrollLibraryGuide(features)

  // --- Modal / Polite Loader Guide (IXR/iPro only) ---
  const modalGuide = isFocusPlatform ? '' : buildModalPoliteGuide(features)

  // --- Iframe Removal Guide (IXR/iPro only) ---
  const iframeGuide = isFocusPlatform ? '' : buildIframeGuide(features)

  // --- Warnings & Contradictions ---
  const warnings = buildWarnings(features, animAnalysis, adMeta, config, files, adPlatform)

  // --- Pre-Implementation Checklist (IXR/iPro only) ---
  const checklist = isFocusPlatform ? '' : buildChecklist(features, animAnalysis, adMeta, allAssets, config)

  return `# Ad Refactoring Context

This file was auto-generated by the Ad Builder refactoring tool. It provides full context for an AI assistant (Claude Code, Copilot, etc.) to continue refactoring work on this ad.

**IMPORTANT:** Read ALL files in this folder before starting work. The code files (index.html, js/, css/) contain the actual implementation. This document provides context about what has been done and what remains.

## Ad Information
- **Platform:** ${adPlatform === 'ixr' ? 'IXR Interact' : adPlatform === 'focus' ? 'Focus' : adPlatform === 'ipro' ? 'iPro Interact' : adPlatform}
- **Ad Type:** ${adType === 'cp' ? 'CP (Exam Room — 1080x1733)' : adType === 'mr' ? 'MR (Rectangle — 300x250)' : adMeta.templateType?.toUpperCase() || 'Unknown'}
- **Dimensions:** ${width}x${height}
- **GWD Ad:** ${adMeta.isGWD ? 'Yes — requires complete manual rebuild (Web Components, custom elements, GWD runtime all removed)' : 'No'}
- **Has ISI:** ${adMeta.hasISI ? 'Yes' : 'No'}
- **Has Animation:** ${adMeta.hasAnimation ? (animAnalysis.isUIOnly ? 'UI-only (' + (adMeta.animationType || 'unknown') + ' used for expand/collapse transitions only — no ad content animation)' : 'Yes (' + (adMeta.animationType || 'unknown type') + ')') : 'No'}
- **Has Video:** ${features.hasVideo ? 'Yes' : 'No'}
- **Has Expandable ISI:** ${features.hasExpandableISI ? 'Yes' : 'No'}
- **Has Modal Content:** ${features.hasModalAd ? 'Yes' : 'No'}
- **Has Iframes:** ${features.hasIframe ? 'Yes (' + (features.iframeCount || '?') + ') — MUST be removed, not supported on devices' : 'No'}
- **Has Tracking Pixels:** ${features.hasTrackingPixels ? 'Yes — removed from HTML, check JS for dynamic pixel creation' : 'No'}
- **Has imagesLoaded Preloader:** ${features.hasImagesLoaded ? 'Yes — keep for asset preloading, but verify it works offline' : 'No'}
- **Has CreateJS/Canvas:** ${features.hasCreateJS ? 'Yes — Adobe Animate CC export, requires COMPLETE rebuild as DOM-based ad' : 'No'}

${buildAdContext(adPlatform)}

${warnings}## All Files in This Ad
${fileList}

${assetInventory}
${clickMapping}
${animationContext}
${isiDetails}
${scrollGuide}
${modalGuide}
${iframeGuide}
${featureSummary}
## What Has Already Been Done (Auto-Refactored)
The following fixes were applied automatically by the app:
${appliedFixList}

${issuesList}
## Completed Tasks
${completedList}

## Remaining Tasks (NEEDS YOUR HELP)
${taskList}

${buildDeviceSpecs(adPlatform, adType, width, height)}

${buildImportantNotes(adPlatform)}

${checklist}## IMPORTANT: Delete This File When Done
**This CLAUDE.md file is for AI-assisted development only and must NOT be shipped with the final ad.**

When the user indicates they are finished with refactoring (e.g. "we're done", "that's it", "finished", "ready to ship", "all tasks complete"), you MUST:
1. Confirm all remaining tasks have been addressed
2. Ask the user: "All tasks are complete. Should I delete the CLAUDE.md file so the ad is ready to ship?"
3. Upon confirmation, delete this CLAUDE.md file from the project directory

Do NOT delete this file until the user explicitly confirms they are done.
`
}

// ===== HELPER: Ad Context (platform-specific) =====
function buildAdContext(adPlatform) {
  // Shared context for all platforms
  let section = '## Ad Context\n'
  section += '- **Industry:** Pharmaceutical / Healthcare — these are point-of-care ads displayed on kiosk devices in medical waiting rooms (doctor offices, hospitals, clinics)\n'
  section += '- **ISI (Important Safety Information):** Legally required regulatory content. It MUST NOT be removed, truncated, or modified. ISI must scroll and remain fully readable.\n'
  section += '- **PDF Links:** Typically link to Prescribing Information (PI) and Medication Guides (MG) — these are regulatory documents that open in the device\'s PDF viewer\n'
  section += '- **Asset Naming Conventions:** `F1`, `F2`, `F3`, etc. = animation frames/scenes. `_back` or `_hero` = background image. `_copy` = text overlay. `_logo` = brand logo. `cta` = call-to-action button. `isi` = safety information content.\n'
  section += '- **Spanish Language Ads:** Many ads are in Spanish. Animation timing variables may use Spanish number words (uno=1, dos=2, tres=3, cuatro=4, cinco=5, seis=6, siete=7, ocho=8, nueve=9, diez=10, once=11, doce=12) — treat these as numeric timing values when rebuilding animations\n'

  if (adPlatform === 'ixr') {
    section += '- **Devices:** BrightSign media players and PatientPoint wallboard displays running Chrome 69 — always offline, no internet access\n'
  } else if (adPlatform === 'focus') {
    section += '- **Devices:** Focus precision display ads (300x250) — served via ad server, browser-based\n'
  } else if (adPlatform === 'ipro') {
    section += '- **Devices:** BrightSign media players and PatientPoint wallboard displays running Chrome 69 — always offline, no internet access (same hardware as IXR)\n'
  }

  return section
}

// ===== HELPER: Device Specifications (platform-specific) =====
function buildDeviceSpecs(adPlatform, adType, width, height) {
  if (adPlatform === 'ixr') {
    return buildIXRDeviceSpecs(adType, width, height)
  } else if (adPlatform === 'focus') {
    return buildFocusDeviceSpecs(width, height)
  } else if (adPlatform === 'ipro') {
    return buildIProDeviceSpecs(width, height)
  }
  return ''
}

function buildIXRDeviceSpecs(adType, width, height) {
  let s = '## Device Specifications (Chrome 69 / BrightSign)\n\n'
  s += '### MUST Follow\n'
  s += '- **ES5 ONLY** — No const/let, arrow functions, template literals, async/await, destructuring, spread operators, classes, Promises, or any ES6+ syntax\n'
  s += '- **TweenMax 2.0.1** — Use `TimelineMax` and `TweenMax` syntax. Do NOT use modern `gsap.timeline()` or `gsap.to()`\n'
  s += '- **jQuery 2.1.4** — Available globally as `$` and `jQuery`\n'
  s += '- **No CDN scripts** — Devices are offline. All scripts must be local files\n'
  s += '- **No Web Components** — Chrome 69 has limited/broken support\n'
  s += '- **No Promises, fetch, async/await** — Use XMLHttpRequest or jQuery.ajax if needed\n'
  s += '- **No CSS Grid** — Use flexbox or absolute positioning\n'
  s += '- **No CSS custom properties (variables)** — Use literal values\n\n'

  s += '### appHost Integration (Required)\n'
  s += 'All ads must include device communication:\n'
  s += '```javascript\n'
  s += 'var appHost = window.appHost = new window.top.AppHost(this);\n'
  s += '```\n\n'

  s += '### Click Handlers (Required Pattern)\n'
  s += '```javascript\n'
  s += '$(document).ready(function () {\n\n'
  s += '    //External Link\n'
  s += '    function openExternalLinkFull(e, linkUrl) {\n'
  s += '        if (typeof appHost !== \'undefined\') {\n'
  s += '            appHost.requestFullscreenBrowserView(linkUrl);\n'
  s += '        } else {\n'
  s += '            window.open(linkUrl);\n'
  s += '        }\n'
  s += '    }\n\n'
  s += '    //External PDF\n'
  s += '    function openExternalPDF(e, pdfUrl) {\n'
  s += '        if (typeof appHost !== \'undefined\') {\n'
  s += '            appHost.requestPDFView(pdfUrl);\n'
  s += '        } else {\n'
  s += '            window.open(pdfUrl);\n'
  s += '        }\n'
  s += '    }\n\n'
  s += '    var clickTag1 = "https://education.patientpoint.com/failsafe-page/"\n'
  s += '    var clickTag2 = "https://education.patientpoint.com/failsafe-page/"\n\n'
  s += '    function assignClickHandlers() {\n'
  s += '        //LINK — use openExternalLinkFull for websites\n'
  s += '        $(\'#clickZoneId\')[0].addEventListener("click", function (e) {\n'
  s += '            openExternalLinkFull(e, clickTag1);\n'
  s += '        }, false);\n'
  s += '        //PDF — use openExternalPDF for PDF documents\n'
  s += '        $(\'#pdfZoneId\')[0].addEventListener("click", function (e) {\n'
  s += '            openExternalPDF(e, clickTag2);\n'
  s += '        }, false);\n'
  s += '    }\n\n'
  s += '    assignClickHandlers();\n'
  s += '});\n'
  s += '```\n'
  s += '**How to decide:** If the URL ends in `.pdf`, use `openExternalPDF()`. Everything else uses `openExternalLinkFull()`. Functions are defined INSIDE `$(document).ready()` and click handlers use the `$(\'#id\')[0].addEventListener("click", fn, false)` pattern.\n\n'

  s += '### ISI Scroller Structure (Required for ISI ads)\n'
  s += '```html\n'
  s += '<div id="outerMostDiv">\n'
  s += '  <div id="innerMostDiv">\n'
  s += '    <img src="isi-content.png" />\n'
  s += '  </div>\n'
  s += '  <div id="isi-controls">\n'
  s += '    <div class="scroller"></div>\n'
  s += '    <div class="isiLineNoArrows"></div>\n'
  s += '  </div>\n'
  s += '</div>\n'
  s += '```\n'
  s += 'Do NOT use native CSS scrollbars, iScroll, OverlayScrollbars, mCustomScrollbar, or any scroll library. The standard scroller JS handles everything.\n\n'

  // Show the correct animation pattern based on ad type
  if (adType === 'cp') {
    s += '### CP Animation Pattern (REQUIRED)\n'
    s += 'CP ads MUST use this exact animation structure. Do NOT use `$(document).ready()` for animation on CP ads:\n'
    s += '```javascript\n'
    s += 'var firstPlay = true;\n'
    s += 'var tl = new TimelineMax({});\n\n'
    s += 'function createAnimation() {\n'
    s += '    // ALL animation tweens go here\n'
    s += '    // Frame 1\n'
    s += '    tl.to("#f1", 0.5, { autoAlpha: 1 }, 0);       // 0s\n'
    s += '    tl.to("#f1", 0.5, { autoAlpha: 0 }, 3);       // 3s\n'
    s += '    // Frame 2\n'
    s += '    tl.to("#f2", 0.5, { autoAlpha: 1 }, 3.5);     // 3.5s\n'
    s += '    tl.to("#f2", 0.5, { autoAlpha: 0 }, 6.5);     // 6.5s\n'
    s += '}\n\n'
    s += 'function onWallboardIdleSlideDisplay() {\n'
    s += '    // Reset ISI scroll position (comment out if no ISI)\n'
    s += '    document.getElementById("innerMostDiv").scrollTop = 0;\n'
    s += '    if (firstPlay === true) {\n'
    s += '        createAnimation(false);\n'
    s += '        tl.play();\n'
    s += '        firstPlay = false;\n'
    s += '    } else {\n'
    s += '        tl.seek(0);\n'
    s += '        tl.play();\n'
    s += '    }\n'
    s += '}\n\n'
    s += '// Fallback for browser testing (device calls onWallboardIdleSlideDisplay automatically)\n'
    s += 'if (typeof appHost === \'undefined\') {\n'
    s += '    onWallboardIdleSlideDisplay();\n'
    s += '}\n'
    s += '```\n'
    s += '**Key rules:** `tl` and `firstPlay` are declared globally. `createAnimation()` builds the timeline once. `onWallboardIdleSlideDisplay()` is called by the device each time the ad should play — first time it creates + plays, subsequent times it seeks to 0 and replays. The `appHost === \'undefined\'` check fires the animation in browser for testing.\n\n'
  } else if (adType === 'mr') {
    s += '### MR Animation Pattern\n'
    s += 'MR ads use `$(document).ready()` — do NOT use `onWallboardIdleSlideDisplay()`:\n'
    s += '```javascript\n'
    s += '$(document).ready(function () {\n'
    s += '    var tl = new TimelineMax({delay: 0});\n\n'
    s += '    // Frame 1 — starts at 0s\n'
    s += '    tl.to("#f1", 0.5, { autoAlpha: 1 }, 0);       // 0s\n'
    s += '    tl.to("#f1", 0.5, { autoAlpha: 0 }, 3);       // 3s\n\n'
    s += '    // Frame 2 — starts at 3.5s\n'
    s += '    tl.to("#f2", 0.5, { autoAlpha: 1 }, 3.5);     // 3.5s\n'
    s += '});\n'
    s += '```\n'
    s += '**Key rules:** Animation and click handlers all go inside `$(document).ready()`. The timeline plays immediately on page load. `autoScroll.js` handles ISI auto-scrolling.\n\n'
  } else {
    // Fallback — show both patterns
    s += '### CP Ads (1080x1733) — Animation Wrapper\n'
    s += 'CP ads must use `onWallboardIdleSlideDisplay()` with `firstPlay`/`createAnimation()` pattern. See template for details.\n\n'
    s += '### MR Ads (300x250) — Animation\n'
    s += 'MR ads use `$(document).ready()` — animation plays on page load.\n\n'
  }

  s += '### Console Silencing (Required for Production)\n'
  s += '```javascript\n'
  s += 'console.log = console.info = console.warn = console.error = function() {};\n'
  s += '```\n\n'

  s += '### Ad Size Meta Tag (Required)\n'
  s += '```html\n'
  s += '<meta name="ad.size" content="width=' + width + ',height=' + height + '">\n'
  s += '```\n\n'

  s += '### Image Maps — DO NOT USE\n'
  s += '`<map>`/`<area>` tags do NOT work on devices. Convert to positioned div click zones:\n'
  s += '```html\n'
  s += '<div class="invisibleButton" id="clickZone1"\n'
  s += '     style="position:absolute; left:737px; top:1209px; width:196px; height:31px; cursor:pointer;">\n'
  s += '</div>\n'
  s += '```\n\n'

  s += '### TweenMax 2.0.1 Quick Reference\n'
  s += '```javascript\n'
  s += '// Timeline creation\n'
  s += 'var tl = new TimelineMax({ paused: true });\n'
  s += 'var tl = new TimelineMax({ repeat: -1 }); // infinite loop\n\n'
  s += '// Tweens\n'
  s += 'TweenMax.to("#elem", 1, { autoAlpha: 1, x: 100, ease: Power2.easeOut });\n'
  s += 'TweenMax.set("#elem", { autoAlpha: 0 }); // instant set, no animation\n\n'
  s += '// Timeline methods\n'
  s += 'tl.to("#elem", 1, { autoAlpha: 1 }, 0);      // absolute time\n'
  s += 'tl.to("#elem", 1, { autoAlpha: 1 }, "+=0.5"); // relative offset\n'
  s += 'tl.addLabel("frame2", 3);                     // label at 3 seconds\n'
  s += 'tl.to("#elem", 1, { autoAlpha: 1 }, "frame2");// tween at label\n\n'
  s += '// Common properties\n'
  s += '// autoAlpha (opacity + visibility), x, y, scale, scaleX, scaleY,\n'
  s += '// rotation, width, height, top, left, backgroundColor,\n'
  s += '// delay, ease, onComplete, onStart, repeat, yoyo\n\n'
  s += '// Easing options\n'
  s += '// Power0.easeNone, Power1.easeIn/Out/InOut, Power2, Power3, Power4\n'
  s += '// Bounce.easeOut, Elastic.easeOut, Back.easeOut\n'
  s += '```\n'

  return s
}

function buildFocusDeviceSpecs(width, height) {
  let s = '## Device Specifications (Focus)\n\n'
  s += '### Key Differences from IXR\n'
  s += '- **No appHost** — Focus ads do NOT use appHost integration\n'
  s += '- **No ad.js** — click handlers are inline `<script>` at the bottom of the HTML\n'
  s += '- **No ISI restructuring** — leave scrollbars and ISI structure as-is\n'
  s += '- **No scroller.js** — do not add the standard ISI scroller\n\n'

  s += '### Click Handlers (Required Pattern)\n'
  s += 'Focus ads use inline click handlers with `getParameterByName` URL parameter fallback:\n'
  s += '```javascript\n'
  s += '<script>\n'
  s += '    var clickTag1 = \'https://www.example.com\';\n'
  s += '    var clickTag2 = \'https://www.example.com/pi.pdf\';\n\n'
  s += '    function getParameterByName(name) {\n'
  s += '        var match = RegExp(\'[?&]\' + name + \'=([^&]*)\').exec(window.location.search);\n'
  s += '        return match && decodeURIComponent(match[1].replace(/\\+/g, \' \'));\n'
  s += '    }\n\n'
  s += '    document.getElementById("mainClick").addEventListener("click", function(){\n'
  s += '        window.open(getParameterByName(\'clickTag1\')||clickTag1);\n'
  s += '    });\n'
  s += '    document.getElementById("piLink").addEventListener("click", function(){\n'
  s += '        window.open(getParameterByName(\'clickTag2\')||clickTag2);\n'
  s += '    });\n'
  s += '</script>\n'
  s += '```\n'
  s += '**Key rules:** This script goes inline before `</body>`. `getParameterByName` checks the URL for override values (used by the ad server), falling back to the hardcoded clickTag variables. All links use `window.open()` — no appHost, no openExternalLinkFull.\n\n'

  s += '### Still Required\n'
  s += '- **ES5 ONLY** — No const/let, arrow functions, template literals, etc.\n'
  s += '- **No CDN scripts** — All scripts must be local files\n'
  s += '- **GWD elements must be converted** to standard HTML\n'
  s += '- **Enabler.js must be removed**\n\n'

  s += '### Console Silencing (Required)\n'
  s += '```javascript\n'
  s += 'console.log = console.info = console.warn = console.error = function() {};\n'
  s += '```\n\n'

  s += '### Ad Size Meta Tag\n'
  s += '```html\n'
  s += '<meta name="ad.size" content="width=' + width + ',height=' + height + '">\n'
  s += '```\n'

  return s
}

function buildIProDeviceSpecs(width, height) {
  let s = '## Device Specifications (Chrome 69 / BrightSign — iPro)\n\n'
  s += '### MUST Follow\n'
  s += '- **ES5 ONLY** — No const/let, arrow functions, template literals, async/await, destructuring, spread operators, classes, Promises, or any ES6+ syntax\n'
  s += '- **TweenMax 2.0.1** — Use `TimelineMax` and `TweenMax` syntax. Do NOT use modern `gsap.timeline()` or `gsap.to()`\n'
  s += '- **jQuery 2.1.4** — Available globally as `$` and `jQuery`\n'
  s += '- **No CDN scripts** — Devices are offline. All scripts must be local files\n'
  s += '- **No Web Components** — Chrome 69 has limited/broken support\n'
  s += '- **No Promises, fetch, async/await** — Use XMLHttpRequest or jQuery.ajax if needed\n'
  s += '- **No CSS Grid** — Use flexbox or absolute positioning\n'
  s += '- **No CSS custom properties (variables)** — Use literal values\n\n'

  s += '### appHost Integration (Required)\n'
  s += 'All ads must include device communication:\n'
  s += '```javascript\n'
  s += 'var appHost = window.appHost = new window.top.AppHost(this);\n'
  s += '```\n\n'

  s += '### Click Handlers (Required Pattern)\n'
  s += '```javascript\n'
  s += '$(document).ready(function () {\n\n'
  s += '    //External Link\n'
  s += '    function openExternalLinkFull(e, linkUrl) {\n'
  s += '        if (typeof appHost !== \'undefined\') {\n'
  s += '            appHost.requestFullscreenBrowserView(clickTag);\n'
  s += '        } else {\n'
  s += '            window.open(linkUrl);\n'
  s += '        }\n'
  s += '    }\n\n'
  s += '    //External PDF\n'
  s += '    function openExternalPDF(e, pdfUrl) {\n'
  s += '        if (typeof appHost !== \'undefined\') {\n'
  s += '            appHost.requestPDFView(pdfUrl);\n'
  s += '        } else {\n'
  s += '            window.open(pdfUrl);\n'
  s += '        }\n'
  s += '    }\n\n'
  s += '    //Open Modal Ad\n'
  s += '    function openMod(jobId) {\n'
  s += '        if (typeof appHost !== \'undefined\') {\n'
  s += '            appHost.requestModalAdView("mod/index.html");\n'
  s += '        } else {\n'
  s += '            window.open("https://patientpointdemo.com/banner_review/IADS-" + jobId + "/index.html");\n'
  s += '        }\n'
  s += '    }\n\n'
  s += '    var clickTag1 = "https://education.patientpoint.com/failsafe-page/"\n'
  s += '    var clickTag2 = "https://education.patientpoint.com/failsafe-page/"\n\n'
  s += '    function assignClickHandlers() {\n'
  s += '        //LINK — use openExternalLinkFull for websites\n'
  s += '        $(\'#clickTag1\')[0].addEventListener("click", function (e) {\n'
  s += '            openExternalLinkFull(e, clickTag1);\n'
  s += '        }, false);\n'
  s += '        //PDF — use openExternalPDF for PDF documents\n'
  s += '        $(\'#pi-isi\')[0].addEventListener("click", function (e) {\n'
  s += '            openExternalPDF(e, clickTag2);\n'
  s += '        }, false);\n'
  s += '    }\n\n'
  s += '    assignClickHandlers();\n'
  s += '});\n'
  s += '```\n'
  s += '**How to decide:** If the URL ends in `.pdf`, use `openExternalPDF()`. For websites, use `openExternalLinkFull()`. For modal sub-ads, use `openMod()`. All platforms use `appHost.requestFullscreenBrowserView()` for links and `appHost.requestPDFView()` for PDFs.\n\n'

  s += '### ISI Scroller Structure (Required for ISI ads)\n'
  s += '```html\n'
  s += '<div id="outerMostDiv">\n'
  s += '  <div id="innerMostDiv">\n'
  s += '    <img src="isi-content.png" />\n'
  s += '  </div>\n'
  s += '  <div id="isi-controls">\n'
  s += '    <div class="scroller"></div>\n'
  s += '    <div class="isiLineNoArrows"></div>\n'
  s += '  </div>\n'
  s += '</div>\n'
  s += '```\n'
  s += 'Do NOT use native CSS scrollbars, iScroll, OverlayScrollbars, mCustomScrollbar, or any scroll library. The standard scroller JS handles everything.\n\n'

  s += '### iPro Animation Pattern (REQUIRED)\n'
  s += 'iPro ads use the same CP-style animation wrapper as IXR. Do NOT use `$(document).ready()` for animation:\n'
  s += '```javascript\n'
  s += 'var firstPlay = true;\n'
  s += 'var tl = new TimelineMax({});\n\n'
  s += 'function createAnimation() {\n'
  s += '    // ALL animation tweens go here\n'
  s += '    // Frame 1\n'
  s += '    tl.to("#f1", 0.5, { autoAlpha: 1 }, 0);       // 0s\n'
  s += '    tl.to("#f1", 0.5, { autoAlpha: 0 }, 3);       // 3s\n'
  s += '    // Frame 2\n'
  s += '    tl.to("#f2", 0.5, { autoAlpha: 1 }, 3.5);     // 3.5s\n'
  s += '    tl.to("#f2", 0.5, { autoAlpha: 0 }, 6.5);     // 6.5s\n'
  s += '}\n\n'
  s += 'function onWallboardIdleSlideDisplay() {\n'
  s += '    // Reset ISI scroll position\n'
  s += '    document.getElementById("outerMostDiv").scrollTop = 0;\n'
  s += '    if (firstPlay === true) {\n'
  s += '        createAnimation();\n'
  s += '        tl.play();\n'
  s += '        firstPlay = false;\n'
  s += '    } else {\n'
  s += '        tl.seek(0);\n'
  s += '        tl.play();\n'
  s += '    }\n'
  s += '}\n\n'
  s += '// Fallback for browser testing (device calls onWallboardIdleSlideDisplay automatically)\n'
  s += 'if (typeof appHost === \'undefined\') {\n'
  s += '    onWallboardIdleSlideDisplay();\n'
  s += '}\n'
  s += '```\n'
  s += '**Key rules:** `tl` and `firstPlay` are declared globally. `createAnimation()` builds the timeline once. `onWallboardIdleSlideDisplay()` is called by the device each time the ad should play — first time it creates + plays, subsequent times it seeks to 0 and replays. The `appHost === \'undefined\'` check fires the animation in browser for testing.\n\n'

  s += '### Expandable ISI (if present)\n'
  s += 'Some iPro ads have an expandable ISI that expands/collapses on click. Use TweenMax (NOT gsap.timeline) for the expand/collapse animation:\n'
  s += '```javascript\n'
  s += 'var isiExpanded = false;\n'
  s += 'var expandTl = new TimelineMax({ paused: true });\n'
  s += 'expandTl.to("#outerMostDiv", 1, { height: 795, top: 42 }, 0);\n'
  s += 'expandTl.to("#collapse", 1, { top: 0, autoAlpha: 1 }, 0);\n'
  s += 'expandTl.to("#expand", 1, { autoAlpha: 0 }, 0);\n\n'
  s += '$("#expand")[0].addEventListener("click", function () {\n'
  s += '    expandTl.play();\n'
  s += '    isiExpanded = true;\n'
  s += '}, false);\n'
  s += '$("#collapse")[0].addEventListener("click", function () {\n'
  s += '    expandTl.reverse();\n'
  s += '    isiExpanded = false;\n'
  s += '}, false);\n'
  s += '```\n\n'

  s += '### Console Silencing (Required for Production)\n'
  s += '```javascript\n'
  s += 'console.log = console.info = console.warn = console.error = function() {};\n'
  s += '```\n\n'

  s += '### Ad Size Meta Tag (Required)\n'
  s += '```html\n'
  s += '<meta name="ad.size" content="width=' + width + ',height=' + height + '">\n'
  s += '```\n\n'

  s += '### Image Maps — DO NOT USE\n'
  s += '`<map>`/`<area>` tags do NOT work on devices. Convert to positioned div click zones:\n'
  s += '```html\n'
  s += '<div class="invisibleButton" id="clickZone1"\n'
  s += '     style="position:absolute; left:737px; top:209px; width:196px; height:31px; cursor:pointer;">\n'
  s += '</div>\n'
  s += '```\n\n'

  s += '### TweenMax 2.0.1 Quick Reference\n'
  s += '```javascript\n'
  s += '// Timeline creation\n'
  s += 'var tl = new TimelineMax({ paused: true });\n'
  s += 'var tl = new TimelineMax({ repeat: -1 }); // infinite loop\n\n'
  s += '// Tweens\n'
  s += 'TweenMax.to("#elem", 1, { autoAlpha: 1, x: 100, ease: Power2.easeOut });\n'
  s += 'TweenMax.set("#elem", { autoAlpha: 0 }); // instant set, no animation\n\n'
  s += '// Timeline methods\n'
  s += 'tl.to("#elem", 1, { autoAlpha: 1 }, 0);      // absolute time\n'
  s += 'tl.to("#elem", 1, { autoAlpha: 1 }, "+=0.5"); // relative offset\n'
  s += 'tl.addLabel("frame2", 3);                     // label at 3 seconds\n'
  s += 'tl.to("#elem", 1, { autoAlpha: 1 }, "frame2");// tween at label\n\n'
  s += '// Common properties\n'
  s += '// autoAlpha (opacity + visibility), x, y, scale, scaleX, scaleY,\n'
  s += '// rotation, width, height, top, left, backgroundColor,\n'
  s += '// delay, ease, onComplete, onStart, repeat, yoyo\n\n'
  s += '// Easing options\n'
  s += '// Power0.easeNone, Power1.easeIn/Out/InOut, Power2, Power3, Power4\n'
  s += '// Bounce.easeOut, Elastic.easeOut, Back.easeOut\n'
  s += '```\n'

  return s
}

// ===== HELPER: Important Notes (platform-specific) =====
function buildImportantNotes(adPlatform) {
  let s = '## Important Notes\n'
  s += '- **MINIMAL CHANGES ONLY.** The goal is the least amount of code necessary to make this ad device-ready. Do not refactor for style, do not reorganize, do not "improve" working code. Every imported ad is different and chaotic — that\'s expected. Preserve the original structure wherever possible.\n'
  s += '- **PRESERVE GLOBAL CSS.** When removing dead code (polite loaders, loader spinners, GWD runtime, etc.), check if the same inline `<style>` block or CSS file contains global layout rules the ad depends on (e.g. `div { position: absolute; }`, `* { margin: 0; }`, `.banner { display: none; }`). Move these rules to `style.css` before deleting the dead code.\n'
  s += '- **IDENTIFY ASSETS VISUALLY, NOT BY CODE.** SVG files cannot be identified by reading their XML/path data — it\'s just coordinates. Use filenames, CSS positioning (top/left values), dimensions (width/height), and context in the HTML to determine what each asset is. When rebuilding, open the original ad in a browser to visually confirm which frames/elements appear and in what order. If you cannot determine what an asset is, **ask the user**.\n'
  s += '- **CHECK FOR TEXT ELEMENTS WITHOUT ASSET FILES.** Some ad builders (Creatopy, GWD) render disclaimers, fine print, and other text as styled HTML — not images. These won\'t appear in the asset inventory. Look for `<span>`, `<p>`, or `<div>` elements with text content in the original HTML and recreate them in the rebuilt ad.\n'

  if (adPlatform === 'ixr') {
    s += '- Test all changes against Chrome 69 compatibility.\n'
    s += '- When modifying JavaScript, ensure ALL code is ES5 compliant.\n'
    s += '- When handling click events, determine if the URL is a PDF (use `openExternalPDF`) or website (use `openExternalLinkFull`).\n'
    s += '- SVGs are hit-or-miss on Chrome 69/BrightSign. If an SVG doesn\'t render, convert it to PNG.\n'
    s += '- All fonts must be local (no Google Fonts CDN). Do NOT replace brand fonts with web-safe alternatives. Use `@font-face` with local font files, or if font files are unavailable, convert text elements to images.\n'
  } else if (adPlatform === 'focus') {
    s += '- When modifying JavaScript, ensure ALL code is ES5 compliant.\n'
    s += '- Click handlers use `window.open()` with `getParameterByName()` fallback — no appHost.\n'
    s += '- Do NOT add appHost, ad.js, scroller.js, or ISI restructuring — Focus does not use these.\n'
    s += '- Leave ISI scrollbars as-is — do not replace with standard scroller pattern.\n'
  } else if (adPlatform === 'ipro') {
    s += '- Test all changes against Chrome 69 compatibility.\n'
    s += '- When modifying JavaScript, ensure ALL code is ES5 compliant.\n'
    s += '- When handling click events, determine if the URL is a PDF (use `openExternalPDF`), website (use `openExternalLinkFull`), or modal sub-ad (use `openMod`).\n'
    s += '- Click handlers use `appHost.requestFullscreenBrowserView(linkUrl)` for websites and `appHost.requestPDFView(pdfUrl)` for PDFs.\n'
    s += '- SVGs are hit-or-miss on Chrome 69/BrightSign. If an SVG doesn\'t render, convert it to PNG.\n'
    s += '- All fonts must be local (no Google Fonts CDN). Do NOT replace brand fonts with web-safe alternatives. Use `@font-face` with local font files, or if font files are unavailable, convert text elements to images.\n'
    s += '- iPro dimensions are 1488x837 (landscape). Verify all positioning is within these bounds.\n'
  }

  return s
}

// ===== HELPER: Asset Inventory =====
function buildAssetInventory(allAssets, mappedAssets, sceneStructure) {
  if (!allAssets || allAssets.length === 0) return ''

  const assetUsage = sceneStructure?.assetUsage || {}

  // Categorize assets
  const categories = {
    frames: [],
    backgrounds: [],
    logos: [],
    ctas: [],
    isi: [],
    text: [],
    icons: [],
    other: []
  }

  for (const asset of allAssets) {
    const name = (asset.filename || asset.path || '').toLowerCase()
    const slot = asset.suggestedSlot || 'unknown'
    const usage = assetUsage[asset.filename] || null

    const entry = {
      path: asset.path || asset.filename,
      type: asset.type || 'unknown',
      isSvg: asset.isSvg || false,
      mapped: asset.mapped || false,
      suggestedSlot: slot,
      element: usage?.element || asset.element || null,
      scene: usage?.scene || asset.scene || null,
      context: usage?.context || asset.context || null
    }

    // Skip __MACOSX resource fork files
    if ((asset.path || asset.filename || '').startsWith('__MACOSX')) continue

    if (slot === 'frame' || /^(\d+)\.(svg|png|jpg|gif)$/i.test(name) || /frame\d/i.test(name) || /sprite_?\d/i.test(name)) {
      categories.frames.push(entry)
    } else if (slot === 'background' || /bg|background|_back\.|back_|backup|fallback|patient|hero|actor|main_image|sprite\.(?:png|jpg)/i.test(name)) {
      categories.backgrounds.push(entry)
    } else if (slot === 'logo' || /logo/i.test(name) || containsBrandName(name)) {
      categories.logos.push(entry)
    } else if (slot === 'cta' || /cta|button/i.test(name)) {
      categories.ctas.push(entry)
    } else if (slot === 'isiImage' || (/isi|safety/i.test(name) && !/expand|collapse|bar|button|arrow/i.test(name))) {
      categories.isi.push(entry)
    } else if (/text|copy|headline|title|legal|disclaimer/i.test(name)) {
      categories.text.push(entry)
    } else if (/icon|arrow|chevron|close|expand|collapse|bar_collapse|bar_expand|scroller|scrollbar|scrollerbar/i.test(name)) {
      categories.icons.push(entry)
    } else {
      categories.other.push(entry)
    }
  }

  // Count SVGs (already filtered for __MACOSX)
  const svgCount = allAssets.filter(a => a.isSvg || (a.type || '').toLowerCase() === 'svg').length
  const mappedCount = allAssets.filter(a => a.mapped).length
  const totalCount = allAssets.length

  let section = `## Asset Inventory (${totalCount} total, ${mappedCount} auto-mapped, ${totalCount - mappedCount} unmapped)\n\n`

  if (svgCount > 0) {
    section += `> **SVG Warning:** ${svgCount} SVG file(s) found. SVGs are hit-or-miss on Chrome 69/BrightSign. If any SVG fails to render, convert it to PNG.\n\n`
  }

  const formatEntry = (entry) => {
    let line = `| \`${entry.path}\` | ${entry.type.toUpperCase()} | ${entry.mapped ? 'Yes' : '**No**'} |`
    if (entry.element) {
      line += ` Used by \`${entry.element}\``
      if (entry.scene) line += ` in scene \`${entry.scene}\``
    } else if (entry.scene) {
      line += ` In scene \`${entry.scene}\``
    } else {
      line += ` —`
    }
    line += ' |'
    return line
  }

  const tableHeader = '| File | Type | Mapped | Usage in HTML |\n|------|------|--------|---------------|\n'

  if (categories.frames.length > 0) {
    // Sort frames numerically if possible
    categories.frames.sort((a, b) => {
      const numA = parseInt((a.path || '').match(/(\d+)\.\w+$/)?.[1] || '999')
      const numB = parseInt((b.path || '').match(/(\d+)\.\w+$/)?.[1] || '999')
      return numA - numB
    })
    section += `### Animation Frames (${categories.frames.length} files)\n`
    section += `These appear to be sequential animation frames. Wire them into a TweenMax \`TimelineMax\` sequence.\n\n`
    section += tableHeader
    section += categories.frames.map(formatEntry).join('\n') + '\n\n'
  }

  if (categories.backgrounds.length > 0) {
    section += `### Backgrounds (${categories.backgrounds.length} files)\n`
    section += tableHeader
    section += categories.backgrounds.map(formatEntry).join('\n') + '\n\n'
  }

  if (categories.logos.length > 0) {
    section += `### Logos (${categories.logos.length} files)\n`
    section += tableHeader
    section += categories.logos.map(formatEntry).join('\n') + '\n\n'
  }

  if (categories.ctas.length > 0) {
    section += `### CTA / Buttons (${categories.ctas.length} files)\n`
    section += tableHeader
    section += categories.ctas.map(formatEntry).join('\n') + '\n\n'
  }

  if (categories.isi.length > 0) {
    section += `### ISI Content (${categories.isi.length} files)\n`
    section += `These are ISI (Important Safety Information) assets. The ISI content image should be set as the \`src\` inside \`#innerMostDiv\`.\n\n`
    section += tableHeader
    section += categories.isi.map(formatEntry).join('\n') + '\n\n'
  }

  if (categories.text.length > 0) {
    section += `### Text / Copy Overlays (${categories.text.length} files)\n`
    section += tableHeader
    section += categories.text.map(formatEntry).join('\n') + '\n\n'
  }

  if (categories.icons.length > 0) {
    section += `### Icons / UI Elements (${categories.icons.length} files)\n`
    section += tableHeader
    section += categories.icons.map(formatEntry).join('\n') + '\n\n'
  }

  if (categories.other.length > 0) {
    section += `### Other Assets (${categories.other.length} files)\n`
    section += `These assets could not be automatically categorized. Review each and determine its purpose.\n\n`
    section += tableHeader
    section += categories.other.map(formatEntry).join('\n') + '\n\n'
  }

  return section
}

// ===== HELPER: Warnings & Contradictions =====
function buildWarnings(features, animAnalysis, adMeta, config, files, adPlatform) {
  const warnings = []
  var isFocusPlatform = adPlatform === 'focus'

  // Focus ads skip most warnings — they have internet, modern browser, keep GWD/GSAP/CSS as-is
  if (isFocusPlatform) {
    // Only show Enabler warning for Focus
    if (features?.hasEnabler) {
      warnings.push(
        '**Enabler.js Detected:** Remove Enabler.js and its initialization delay. Replace Enabler.exit() calls with the Focus click handler pattern (getParameterByName + window.open).'
      )
    }
    if (warnings.length === 0) return ''
    let section = '## WARNINGS — Read Before Starting\n\n'
    for (const w of warnings) {
      section += `> ${w}\n\n`
    }
    return section
  }

  // GSAP 3.x detected but device requires TweenMax 2.0.1
  if (animAnalysis?.type === 'gsap3' || (animAnalysis?.type === 'gwd' && animAnalysis?.details?.some(d => /GSAP 3/i.test(d)))) {
    warnings.push(
      '**GSAP 3.x vs TweenMax 2.0.1:** The code uses modern GSAP 3.x syntax (`gsap.to()`, `gsap.timeline()`), but the target device requires TweenMax 2.0.1 (`TweenMax.to()`, `new TimelineMax()`). You MUST convert all GSAP 3.x calls to TweenMax 2.0.1 syntax and replace the GSAP CDN script with a local `tweenmax_2.0.1_min.js` file.'
    )
  }

  // GWD ad — lots of things need rebuilding
  if (adMeta?.isGWD) {
    warnings.push(
      '**GWD Runtime Removed:** This was a Google Web Designer ad. All GWD custom elements (`<gwd-image>`, `<gwd-taparea>`, etc.) have been converted to standard HTML, and the GWD runtime scripts have been removed. However, animations that depended on the GWD runtime will NOT work and must be completely rebuilt using TweenMax 2.0.1.'
    )
  }

  // ISI detected from text only — no container structure
  if (features?.isiTextOnly) {
    warnings.push(
      '**ISI Detection Ambiguity:** ISI was flagged because the text "Important Safety Information" appears in the HTML, but no actual ISI scroller container (`outerMostDiv`/`innerMostDiv`) was found. Verify whether this ad needs a scrollable ISI section. If yes, you must build the container structure from scratch.'
    )
  }

  // Iframes — not supported on devices
  if (features?.hasIframe) {
    warnings.push(
      '**Iframes NOT Supported:** This ad contains ' + (features.iframeCount || 1) + ' `<iframe>` element(s). Iframes do NOT work on BrightSign/device players. You MUST inline the iframe content directly into the main HTML. If the iframe loads local content (e.g. `mod/index.html`), copy that HTML into the main page as a hidden `<div>` and toggle visibility with JavaScript. If it loads external content, download it and inline it. Remove all `<iframe>` tags and update any JS that references `iframe.contentWindow` or `iframe.contentDocument` to target the inlined elements instead.'
    )
  }

  // CDN scripts still in code
  if (features?.hasCDNScripts) {
    // Check if GSAP CDN specifically
    const codeContent = Object.values(files).join('\n')
    const gsapCdn = /src=["']https?:\/\/[^"']*gsap[^"']*["']/i.test(codeContent)
    if (gsapCdn) {
      warnings.push(
        '**CDN GSAP Script:** The HTML still loads GSAP from a CDN URL. Devices are offline and cannot reach CDNs. Download `tweenmax_2.0.1_min.js` (NOT the modern GSAP), save it locally in the `js/` folder, and update the `<script>` tag to reference the local file.'
      )
    }
  }

  // Dynamic CDN script loading (createElement('script') with CDN src)
  if (features?.hasDynamicCDN) {
    warnings.push(
      '**Dynamic CDN Script Loading:** JavaScript code dynamically creates `<script>` elements that load from CDN URLs (e.g. `createElement("script"); s.src = "https://cdn..."`). Devices are offline and cannot reach CDNs. Find these dynamic script loaders in the JS files, download the scripts locally, and change the `src` to a local path. Common culprit: GSAP/TweenMax loaded via a polite-loader or chained `include()` pattern.'
    )
  }

  // Enabler.js references remaining in code
  if (features?.hasEnabler) {
    const codeContent = Object.values(files).join('\n')
    if (/Enabler\.exit/i.test(codeContent)) {
      warnings.push(
        '**Dead Enabler.js Code:** The Enabler.js library has been removed, but function(s) referencing `Enabler.exit()` remain in the code. These are dead code and will throw errors if called. Remove these functions and replace their click handling with `openExternalLinkFull()` or `openExternalPDF()` using the clickTag URLs.'
      )
    }
  }

  // Tracking pixels created dynamically in JS (pixel_images, show_doubleclick, etc.)
  if (features?.hasTrackingPixels) {
    const codeContent = Object.values(files).join('\n')
    if (/pixel_images|show_doubleclick|show_owens|adtaginformer|ad\.doubleclick\.net/i.test(codeContent)) {
      warnings.push(
        '**Dynamic Tracking Pixels in JS:** JavaScript code dynamically creates tracking/impression `<img>` elements that phone home to ad servers (e.g. `adtaginformer.com`, `ad.doubleclick.net`). These fail on offline devices and cause console errors. Find and remove these functions (commonly named `pixel_images()`, `show_doubleclick()`, `show_owens()`) and any `setTimeout` calls that invoke them. Also remove any `interactiveLog.js` script imports.'
      )
    }
  }

  // data-exit click handling pattern
  if (features?.hasDataExitClicks) {
    warnings.push(
      '**data-exit Click Pattern:** This ad uses `data-exit` attributes on elements and a `clickTagLoader()` function that queries `[data-exit]` elements to handle clicks via `window.open()`. You must convert this to use device-compatible handlers: replace the `clickTagLoader()` logic with direct `openExternalLinkFull()` / `openExternalPDF()` calls in `assignClickHandlers()`. Remove the `data-exit` attributes and the `clickTagLoader` function.'
    )
  }

  // CreateJS / Adobe Animate CC — canvas-based rendering
  if (features?.hasCreateJS) {
    warnings.push(
      '**CreateJS / Adobe Animate CC Ad:** This ad renders entirely on a `<canvas>` element using the CreateJS framework (Animate CC export). The animation is frame-based with sprite sheets and vector path data — it CANNOT be auto-converted to DOM/TweenMax. You must completely rebuild this ad: extract the visual design from the canvas frames, recreate the layout using positioned `<div>`/`<img>` elements, and rewrite animations using TweenMax 2.0.1. Keep the existing `ad.js` click handlers and device detection code. Remove `createjs.min.js`, the generated `.js` file (e.g. `728x90.js`), and the `<canvas>` element.'
    )
  }

  // Local GSAP 3.x file alongside TweenMax — likely unused
  if (features?.hasLocalGsap3File && features?.hasGreenSock) {
    warnings.push(
      '**Unused Local GSAP 3.x File:** This ad loads a local GSAP 3.x file (e.g. `gsap3.8.0.js`) alongside TweenMax 2.0.1. If the animation code only uses TweenMax syntax (`TweenMax.to()`, `new TimelineMax()`), the GSAP 3.x file is unused dead weight. Remove the GSAP 3.x `<script>` tag and its file. If the code ALSO uses `gsap.to()` syntax, convert those calls to TweenMax first, then remove GSAP 3.x.'
    )
  }

  // Lottie/Bodymovin animation — test on device
  if (features?.hasLottie) {
    warnings.push(
      '**Lottie/Bodymovin Animation:** This ad uses Lottie (`lottie.loadAnimation()`) to render vector animation from JSON data. Lottie **may** work on IXR devices if it uses the SVG renderer (the default), but this must be tested on an actual device. If the animation fails to render:\n> 1. Export key frames as PNG images from the Lottie JSON (use lottiefiles.com or After Effects)\n> 2. Rebuild the animation using TweenMax 2.0.1 with positioned `<div>`/`<img>` elements\n> 3. Remove `lottie.min.js` and the embedded JSON animation data'
    )
  }

  // Creatopy ad — requires complete rebuild
  if (features?.hasCreatopy) {
    warnings.push(
      '**Creatopy Ad (Critical):** This ad was built with Creatopy (formerly Bannersnack). It uses a proprietary runtime (`creatopyEmbed`) with styled-components (hashed CSS classes), a custom event-driven animation engine, and `bsOpenURL` click handling. **The entire ad must be rebuilt from scratch.**\n' +
      '>\n' +
      '> **Rebuild steps:**\n' +
      '> 1. Extract frame images from the `media/` folder\n' +
      '> 2. **Do NOT rely on the `designData.animations` JSON for timing** — Creatopy\'s slide/element system has complex show/hide logic (hiddenOnSlides arrays, duration limits, slide-level element copies) that does not translate 1:1 to TweenMax. Instead, open the original ad in a browser and visually observe the animation to determine frame order, timing, and which elements persist across slides.\n' +
      '> 3. **SVG assets cannot be identified by reading their XML paths** — SVGs are vector data that looks like coordinates, not recognizable content. Use filenames, CSS positioning (top/left values tell you where it appears), dimensions (width/height tell you if it\'s a logo vs. text), and context in the HTML to determine what each asset is. When in doubt, **ask the user** what the asset is.\n' +
      '> 4. **Check for text elements that have no asset file** — Creatopy renders some content as styled HTML text (e.g. disclaimers, fine print) using web fonts. These will NOT have a corresponding image file in the media folder. Look for `<span>`, `<p>`, or `<div>` elements with text content in the original HTML and recreate them as positioned text elements in the rebuilt ad.\n' +
      '> 5. Create standard HTML with positioned `<div>`/`<img>` elements, rebuild animations with TweenMax 2.0.1, and add standard ad.js click handlers.'
    )
  }

  // Webpack/bundled ad — requires complete rebuild
  if (features?.hasWebpackBundle) {
    warnings.push(
      '**Webpack-Bundled Ad (Critical):** This ad was built with a JavaScript bundler (webpack/Vite/Rollup). The code is minified, tree-shaken, and uses ES6+ module syntax (`__webpack_modules__`, arrow functions as module wrappers). **The bundled code CANNOT be auto-converted to ES5 or have GSAP calls extracted.** The ad must be completely rebuilt:\n> 1. Extract the visual design intent from the assets and HTML structure\n> 2. Rebuild the ad as a standard HTML/CSS/JS structure with ES5 code\n> 3. Replace GSAP CDN with local `tweenmax_2.0.1_min.js`\n> 4. Recreate animations using TweenMax 2.0.1 syntax\n> 5. Add standard `ad.js` with click handlers and appHost integration'
    )
  }

  // GWD delayed init — Enabler.isInitialized / DOMContentLoaded wrapping GWD init
  if (features?.hasGWDDelayedInit) {
    warnings.push(
      '**GWD Delayed Initialization:** This ad uses a GWD/Enabler initialization pattern (`Enabler.isInitialized()`, `Enabler.addEventListener(studio.events.StudioEvent.INIT, ...)`, or `DOMContentLoaded` wrapping GWD setup). The Enabler runtime has been removed, so this init logic is dead code. Remove the Enabler init check and let the ad render immediately — either on `$(document).ready()` or (for CP ads) inside `onWallboardIdleSlideDisplay()`.'
    )
  }

  // Inline @font-face with CDN URLs — won't work offline
  if (features?.hasInlineCDNFontFace) {
    warnings.push(
      '**Inline @font-face with CDN URLs:** This ad has `@font-face` declarations with `src: url(https://fonts.gstatic.com/...)` or other CDN URLs. These fonts will NOT load on offline devices. You must either:\n> 1. **Download the font files** (`.woff2`/`.woff`) locally and update the `src` URLs to local paths\n> 2. **Remove the `@font-face` blocks** if the font files cannot be obtained, and convert text elements that use these fonts to images'
    )
  }

  // JS-injected ISI — entire ISI mechanism must be replaced
  if (features?.hasJSInjectedISI) {
    warnings.push(
      '**JS-Injected ISI (Critical):** This ad uses an `ISIText()` JavaScript function (typically in `isiText.js`) that constructs the entire ISI as an HTML string and injects it via `innerHTML`. This ISI framework includes its own scroll engine, CSS, and auto-scroll logic — **none of which work on devices**. You MUST:\n> 1. Remove the `isiText.js` file and its `<script>` tag\n> 2. Remove the ISI scroll framework (`isi.js` or similar) and its `<script>` tag\n> 3. Remove the ISI holder container element (e.g. `#isiHolder`)\n> 4. Render the ISI text content as a **pre-rendered PNG image**\n> 5. Add the ISI image into the standard `outerMostDiv`/`innerMostDiv`/`isi-controls` scroller structure\n> 6. Wire up any ISI links (Prescribing Information, Medication Guide) as positioned click zones with `openExternalPDF()` / `openExternalLinkFull()` handlers'
    )
  }

  // Custom fonts without local @font-face — may need text-to-image conversion
  if (features?.hasCustomFonts && !features?.hasLocalFontFiles) {
    const fontList = (features.detectedFonts || []).join('`, `')
    warnings.push(
      '**Custom Fonts Without Local Files:** This ad uses custom fonts (`' + fontList + '`) but no `@font-face` declarations were found. The device is offline and cannot load fonts from CDNs. You have two options:\n> 1. **Localize fonts:** Obtain the `.woff2`/`.woff`/`.ttf` files, add them to the package, and add `@font-face` rules in CSS.\n> 2. **Convert text to images:** If font files are unavailable, render the styled text as PNG images and replace the text elements with `<img>` tags. This is common practice for brand-specific typography.'
    )
  }

  if (warnings.length === 0) return ''

  let section = '## WARNINGS — Read Before Starting\n\n'
  for (const w of warnings) {
    section += `> ${w}\n\n`
  }
  return section
}

// ===== HELPER: Pre-Implementation Checklist =====
function buildChecklist(features, animAnalysis, adMeta, allAssets, config) {
  const items = []
  const width = adMeta?.dimensions?.width || 1080
  const height = adMeta?.dimensions?.height || 1733

  // Always verify dimensions
  items.push(`Verify all image assets are sized correctly for ${width}x${height} ad dimensions`)

  // Asset verification
  const svgAssets = allAssets.filter(a => a.isSvg || (a.type || '').toLowerCase() === 'svg')
  if (svgAssets.length > 0) {
    items.push(`Test ${svgAssets.length} SVG file(s) in Chrome 69 — if any fail to render, convert to PNG`)
  }

  const unmappedAssets = allAssets.filter(a => !a.mapped)
  if (unmappedAssets.length > 0) {
    items.push(`Identify the purpose of ${unmappedAssets.length} unmapped asset(s) before referencing them in code`)
  }

  // Animation checks
  if (animAnalysis?.hasAnimations && !animAnalysis.isUIOnly) {
    if (animAnalysis.type === 'gwd') {
      items.push('Visually inspect sprite sheets / assets to understand the original animation intent before rebuilding')
      items.push('Determine total animation duration and whether it loops or plays once')
      items.push('Verify all animation frames have both entrance AND exit animations (fade in AND fade out)')
    } else if (animAnalysis.type === 'gsap3') {
      items.push('Verify all `gsap.to()` / `gsap.timeline()` calls are converted to TweenMax 2.0.1 syntax')
    }
    if (adMeta?.templateType === 'cp' || config?.adType === 'cp') {
      items.push('Confirm animation uses the CP pattern: `firstPlay` + `createAnimation()` + `onWallboardIdleSlideDisplay()` + `appHost === undefined` fallback')
    } else {
      items.push('Confirm animation is inside `$(document).ready()` and plays on page load')
    }
  }

  // ISI checks
  if (features?.hasISI) {
    if (features.hasJSInjectedISI) {
      items.push('Remove ISIText()/isi.js framework files and their `<script>` tags')
      items.push('Render ISI text content as a pre-rendered PNG image')
      items.push('Build standard `outerMostDiv`/`innerMostDiv`/`isi-controls` scroller with ISI image')
      items.push('Add click zones over ISI links (Prescribing Info, Med Guide) with appHost handlers')
    } else if (features.isiTextOnly) {
      items.push('Clarify with user: Does this ad actually need a scrollable ISI section?')
    } else {
      items.push('Verify ISI scroller uses standard `outerMostDiv`/`innerMostDiv`/`isi-controls` structure')
      items.push('Confirm ISI content image is correctly referenced in the `#innerMostDiv` container')
    }
  }

  // Click handling
  const hasClickTags = config?.clickTag1
  if (hasClickTags) {
    items.push('Verify all click zones have event listeners wired to the correct clickTag URL')
    items.push('Confirm PDFs use `openExternalPDF()` and websites use `openExternalLinkFull()`')
  } else {
    items.push('Identify all clickable areas and confirm destination URLs with the user')
  }

  // CDN
  if (features?.hasCDNScripts) {
    items.push('Download all CDN scripts locally and update `<script>` tags to reference local files')
  }

  // Enabler
  if (features?.hasEnabler) {
    items.push('Remove all remaining `Enabler.exit()` references and dead code')
  }

  // Scroll libraries
  if (features?.hasScrollLibrary || features?.hasMCustomScrollbar) {
    items.push('Replace third-party scroll library with standard ISI scroller (`outerMostDiv`/`innerMostDiv`/`isi-controls`)')
  }

  // Modal
  if (features?.hasModalAd) {
    items.push('Verify modal content (`mod/index.html`) is device-compatible — has appHost, uses ES5, no CDN, has dismiss button')
  }

  // Polite loader
  if (features?.hasPoliteLoader) {
    items.push('Remove polite loader pattern — download CDN scripts locally, load synchronously in `<head>`')
  }

  // Iframes
  if (features?.hasIframe) {
    items.push('Remove all `<iframe>` elements — inline their content directly into the main HTML')
  }

  // ES5
  items.push('Run a final check: no `const`, `let`, arrow functions, template literals, or other ES6+ syntax')

  // appHost
  items.push('Verify `appHost` integration is present and click handlers use appHost methods')

  let section = '## Pre-Implementation Checklist\n\n'
  section += 'Verify the following BEFORE making code changes:\n\n'
  for (const item of items) {
    section += `- [ ] ${item}\n`
  }
  section += '\n'
  return section
}

// ===== HELPER: Click Zone / URL Mapping =====
function buildClickMapping(detectedUrls, config, adMeta) {
  const adMetaUrls = adMeta?.detectedUrls || []
  const allUrls = [...(detectedUrls || []), ...adMetaUrls.filter(u => !detectedUrls?.some(d => d.url === u.url))]

  if (allUrls.length === 0 && (!config?.clickZones || config.clickZones.length === 0) && !config?.clickTag1) {
    return ''
  }

  let section = '## Click Zone & URL Mapping\n\n'

  // clickTag variables
  const clickTags = []
  for (let i = 1; i <= 10; i++) {
    const key = 'clickTag' + i
    if (config[key]) {
      const url = config[key]
      const isPdf = /\.pdf(\b|$)/i.test(url)
      clickTags.push({
        variable: key,
        url: url,
        type: isPdf ? 'PDF' : 'Website',
        handler: isPdf ? 'openExternalPDF' : 'openExternalLinkFull'
      })
    }
  }

  if (clickTags.length > 0) {
    section += '### Click Tag Variables\n'
    section += '| Variable | URL | Type | Handler to Use |\n'
    section += '|----------|-----|------|----------------|\n'
    for (const ct of clickTags) {
      section += `| \`${ct.variable}\` | ${ct.url} | ${ct.type} | \`${ct.handler}()\` |\n`
    }
    section += '\n'
  }

  // Click zones from config
  if (config?.clickZones?.length > 0) {
    section += '### Click Zones (Positioned Elements)\n'
    section += '| Element | URL / Target | Link Type | Position |\n'
    section += '|---------|-------------|-----------|----------|\n'
    for (const zone of config.clickZones) {
      const pos = (zone.top != null && zone.left != null)
        ? `top:${zone.top}px, left:${zone.left}px, ${zone.width}x${zone.height}`
        : '—'
      section += `| \`#${zone.id}\` | ${zone.url || zone.jobId || '—'} | ${zone.linkType || '—'} | ${pos} |\n`
    }
    section += '\n'
  }

  // Additional detected URLs not in clickTags — filter out garbled/invalid URLs and non-click resources
  const isCleanUrl = (url) => {
    if (!url) return false
    if (!url.startsWith('http')) return false
    if (/[\n\r\t]/.test(url)) return false
    if (url.length > 300) return false
    if (/[);}\s]/.test(url.replace(/https?:\/\//, ''))) return false
    return true
  }
  // Filter out CDN/resource URLs that are not click targets
  const isResourceUrl = (url) => {
    if (!url) return false
    return /fonts\.googleapis\.com/i.test(url) ||
           /fonts\.gstatic\.com/i.test(url) ||
           /cdn\.jsdelivr\.net/i.test(url) ||
           /cdnjs\.cloudflare\.com/i.test(url) ||
           /s0\.2mdn\.net/i.test(url) ||
           /ajax\.googleapis\.com/i.test(url) ||
           /use\.typekit\.net/i.test(url) ||
           /code\.jquery\.com/i.test(url) ||
           /code\.createjs\.com/i.test(url)
  }
  const clickTagUrls = new Set(clickTags.map(ct => ct.url))
  const additionalUrls = allUrls.filter(u => u.url && !clickTagUrls.has(u.url) && isCleanUrl(u.url) && !isResourceUrl(u.url))

  // Deduplicate by URL — keep first occurrence, note all element sources
  const deduped = []
  const seenUrls = new Set()
  for (const u of additionalUrls) {
    if (!seenUrls.has(u.url)) {
      seenUrls.add(u.url)
      const allSources = additionalUrls.filter(a => a.url === u.url).map(a => a.id || a.element || '—')
      deduped.push({ ...u, sources: [...new Set(allSources)] })
    }
  }

  if (deduped.length > 0) {
    section += '### Other Detected URLs\n'
    section += '| Elements | URL | Type | Handler to Use |\n'
    section += '|----------|-----|------|----------------|\n'
    for (const u of deduped) {
      const isPdf = /\.pdf(\b|$)/i.test(u.url)
      const handler = isPdf ? 'openExternalPDF' : 'openExternalLinkFull'
      const sources = u.sources.map(s => '`' + s + '`').join(', ')
      section += `| ${sources} | ${u.url} | ${isPdf ? 'PDF' : 'Website'} | \`${handler}()\` |\n`
    }
    section += '\n'
  }

  return section
}

// ===== HELPER: Animation Context =====
function buildAnimationContext(animAnalysis, sceneStructure, features, config) {
  // If no animation detected but there are frame assets, guide Claude to build one
  if (!animAnalysis?.hasAnimations) {
    // Check if frame-like assets exist (f1, f2, frame1, etc.)
    const hasFrameAssets = sceneStructure?.scenes?.length > 1 || features?.frameCount > 0
    if (!hasFrameAssets) return ''

    let section = '## Animation (Needs to be Built)\n\n'
    section += 'No animation code was detected in this ad, but frame assets are present. The animation timeline needs to be **written from scratch** using TweenMax 2.0.1.\n\n'
    section += '### Required Format\n'
    section += 'Write a single linear `TimelineMax` with absolute time positions. Every tween gets an explicit time (in seconds) as the last argument:\n\n'
    section += '```javascript\n'
    section += 'var tl = new TimelineMax({ paused: false });\n\n'
    section += '// Frame 1 — starts at 0s\n'
    section += 'tl.to(\'#f1_copy\', 0.5, { autoAlpha: 1, ease: Power2.easeOut }, 0);     // 0s\n'
    section += 'tl.to(\'#f1_copy\', 0.5, { autoAlpha: 0 }, 3.0);                         // 3.0s\n\n'
    section += '// Frame 2 — starts at 3.5s\n'
    section += 'tl.to(\'#f2_bg\', 0.5, { autoAlpha: 1 }, 3.5);                           // 3.5s\n'
    section += 'tl.to(\'#f2_copy\', 0.5, { autoAlpha: 1, ease: Power2.easeOut }, 4.0);   // 4.0s\n'
    section += 'tl.to([\'#f2_bg\', \'#f2_copy\'], 0.5, { autoAlpha: 0 }, 6.5);           // 6.5s\n\n'
    section += '// End frame — starts at 7.0s\n'
    section += 'tl.to(\'#cta\', 0.5, { autoAlpha: 1, ease: Power4.easeOut }, 7.0);       // 7.0s\n'
    section += '```\n\n'
    section += '### Rules\n'
    section += '- Use `autoAlpha` (not `opacity`) for fade in/out — it also controls `visibility`\n'
    section += '- Add a comment with the absolute time next to each tween\n'
    section += '- Group tweens by frame with a comment header (`// Frame 1 — starts at Xs`)\n'
    section += '- Typical frame duration: 2-4 seconds visible, 0.3-0.5s for transitions\n'
    section += '- Do NOT use `addLabel`, `delayedCall`, or separate per-frame functions\n'
    section += '- Place the `<script>` containing the timeline inline at the bottom of the HTML, before `</body>`\n'
    section += '- Review each image asset to determine frame order and visual flow\n\n'
    return section
  }

  // UI-only animation — keep it short, don't generate misleading questions
  if (animAnalysis.isUIOnly) {
    let section = '## Animation Details\n\n'
    section += `- **Library:** ${animAnalysis.libraryUsed || 'Unknown'}\n`
    section += `- **Usage:** UI transitions only (expand/collapse, click effects) — **not** ad content animation\n`
    section += `- **Recommendation:** ${animAnalysis.recommendation}\n\n`
    section += 'No ad-level animation sequence exists. The animation library is used only for ISI expand/collapse transitions or button effects. Do NOT add frame-based animation unless explicitly requested.\n\n'
    return section
  }

  let section = '## Animation Details\n\n'

  // Library info
  section += `- **Library:** ${animAnalysis.libraryUsed || 'Unknown'}\n`
  section += `- **Type:** ${animAnalysis.type || 'unknown'}\n`
  if (animAnalysis.complexity) {
    section += `- **Complexity:** ${animAnalysis.complexity}\n`
  }
  if (animAnalysis.canAutoExtract !== undefined) {
    section += `- **Auto-extractable:** ${animAnalysis.canAutoExtract ? 'Yes' : 'No — requires manual rebuild'}\n`
  }
  if (animAnalysis.recommendation) {
    section += `- **Recommendation:** ${animAnalysis.recommendation}\n`
  }
  section += '\n'

  // Animation details from analysis
  if (animAnalysis.details?.length > 0) {
    section += '### What Was Detected\n'
    for (const detail of animAnalysis.details) {
      section += `- ${detail}\n`
    }
    section += '\n'
  }

  // CSS transitions note
  if (features?.hasCSSTransitions) {
    section += '### CSS Transitions (Preserved)\n'
    section += 'This ad uses CSS `transition` properties for animation (e.g. `transition-property: transform, opacity`). '
    section += 'CSS transitions **work on IXR devices** and have been preserved as-is. '
    section += 'The dev will decide whether to keep the CSS transition approach or rebuild with TweenMax. '
    section += 'If the transitions are working correctly, leave them alone.\n\n'
  }

  // Config timing
  if (config?.frameDuration || config?.frameDelay) {
    section += '### Timing Configuration\n'
    if (config.frameDuration) section += `- **Frame Duration:** ${config.frameDuration}ms\n`
    if (config.frameDelay) section += `- **Frame Delay:** ${config.frameDelay}ms\n`
    section += '\n'
  }

  // Scene structure
  if (sceneStructure?.scenes?.length > 0) {
    section += '### Scene / Frame Structure\n'
    section += 'The ad appears to have the following scenes/frames:\n\n'
    section += '| Scene | Assets | Timeline Label | Timing |\n'
    section += '|-------|--------|---------------|--------|\n'
    for (const scene of sceneStructure.scenes) {
      const assetCount = scene.assets?.length || 0
      const assetNames = (scene.assets || []).slice(0, 3).map(a => a.filename).join(', ')
      const more = assetCount > 3 ? ` +${assetCount - 3} more` : ''
      const label = scene.timing?.label || '—'
      const time = scene.timing?.startTime != null ? scene.timing.startTime + 's' :
                   scene.timing?.offset || '—'
      section += `| ${scene.name || '(unnamed)'} | ${assetNames}${more} | ${label} | ${time} |\n`
    }
    section += '\n'
  }

  // Timeline labels
  if (sceneStructure?.timeline?.labels?.length > 0) {
    section += '### Timeline Labels\n'
    section += 'These labels were detected in the animation timeline. Use them as reference when rebuilding:\n\n'
    for (const label of sceneStructure.timeline.labels) {
      section += `- \`${label.name}\` at ${label.time != null ? label.time + 's' : label.offset || '?'}\n`
    }
    section += '\n'
  }

  // Timeline linearization guidance (when complex label/delay patterns detected)
  if (animAnalysis.hasComplexTimeline) {
    const tc = animAnalysis.timelineComplexity || {}
    section += '### Timeline Linearization (IMPORTANT)\n\n'
    section += 'This ad uses a complex timeline structure'
    if (tc.labels > 0) section += ` with ${tc.labels} label(s)`
    if (tc.delayedCalls > 0) section += `, ${tc.delayedCalls} delayedCall(s)`
    if (tc.hasRelativePositions) section += ', relative position offsets (\'+=X\')'
    section += '. **Rewrite the animation as a single linear timeline with absolute time positions** for maintainability and easier timing adjustments.\n\n'

    section += '**How to linearize:**\n'
    section += '1. Read through the existing animation code and map out every tween with its resolved start time\n'
    section += '2. Calculate absolute times: resolve `addLabel` offsets, `delayedCall` delays, and `\'+=X\'` relative positions into seconds from timeline start\n'
    section += '3. Rewrite as a flat `TimelineMax` with absolute position parameters:\n\n'

    section += '```javascript\n'
    section += 'var tl = new TimelineMax({delay: 0});\n\n'
    section += '// Frame 1 — starts at 0s\n'
    section += 'tl.set(\'#f1_bg\', {autoAlpha: 1});\n'
    section += 'tl.to(\'#f1_copy\', 0.5, {autoAlpha: 1}, 0);        // 0s\n'
    section += 'tl.to(\'#f1_copy\', 0.5, {autoAlpha: 0}, 2);        // 2s\n\n'
    section += '// Frame 2 — starts at 2.5s\n'
    section += 'tl.to(\'#f2_bg\', 0.5, {autoAlpha: 1}, 2.5);        // 2.5s\n'
    section += 'tl.to(\'#f2_copy\', 0.5, {autoAlpha: 1}, 3);        // 3s\n'
    section += 'tl.to(\'#f2_copy\', 0.5, {autoAlpha: 0}, 5.5);      // 5.5s\n'
    section += '```\n\n'

    section += '**Rules:**\n'
    section += '- Remove ALL `addLabel()`, `delayedCall()`, and label position references\n'
    section += '- Every `.to()` / `.from()` / `.set()` gets an absolute time (in seconds) as the last argument\n'
    section += '- Add a comment with the absolute time next to each tween for easy scanning\n'
    section += '- Group tweens by frame/scene with a comment header (`// Frame 1 — starts at Xs`)\n'
    section += '- Keep `delay` property only for stagger-within-frame effects, NOT for frame sequencing\n'
    section += '- If the original uses separate functions per frame (e.g. `frameOne()`, `frameTwo()`), collapse them into the single timeline\n\n'
  }

  // Key questions for the AI
  section += '### Animation Questions to Resolve\n'
  section += '1. Does the animation auto-play on load or wait for a trigger?\n'
  if (features?.frameCount > 0) {
    section += `2. Are the ${features.frameCount} frames sequential (play once) or looping?\n`
  }
  section += `${features?.frameCount > 0 ? '3' : '2'}. What is the total animation duration?\n`
  section += `${features?.frameCount > 0 ? '4' : '3'}. Are there entrance/exit animations for text overlays?\n`
  if (features?.hasISI) {
    section += `${features?.frameCount > 0 ? '5' : '4'}. Does the ISI scroll trigger any animation state changes?\n`
  }
  section += '\n'

  return section
}

// ===== HELPER: Feature Detection Summary =====
function buildFeatureSummary(features) {
  if (!features || Object.keys(features).length === 0) return ''

  const activeFeatures = []
  const activeIssues = []

  // Group features into informational vs issues
  if (features.hasGreenSock) activeFeatures.push('GreenSock/GSAP' + (features.gsapVersion ? ' ' + features.gsapVersion : ''))
  if (features.hasTimeline) activeFeatures.push('Timeline animations')
  if (features.hasTweens) activeFeatures.push('Individual tweens')
  if (features.hasISI) activeFeatures.push('ISI (Important Safety Information)')
  if (features.hasStandardISI) activeFeatures.push('Standard ISI structure (outerMostDiv/innerMostDiv)')
  if (features.hasJSInjectedISI) activeFeatures.push('JS-injected ISI (ISIText() function — requires image conversion)')
  if (features.hasVideo) activeFeatures.push('Video content')
  if (features.hasExpandableISI) activeFeatures.push('Expandable ISI (tap to expand)')
  if (features.hasModalAd) activeFeatures.push('Modal ad content (requestModalAdView)')
  if (features.hasImagesLoaded) activeFeatures.push('imagesLoaded preloader library')
  if (features.hasDataExitClicks) activeFeatures.push('data-exit click handling pattern')
  if (features.hasCanvas) activeFeatures.push('Canvas element')
  if (features.hasCSSTransitions) activeFeatures.push('CSS transitions (preserved — works on devices)')

  if (features.hasWebpackBundle) activeIssues.push('**Webpack-bundled ad** — Minified bundle with ES6+ module system. Cannot be auto-converted. Requires complete rebuild')
  if (features.hasCreatopy) activeIssues.push('**Creatopy ad** — Proprietary creatopyEmbed runtime with styled-components. Cannot be auto-converted. Requires complete rebuild')
  if (features.hasLottie) activeIssues.push('**Lottie/Bodymovin animation** — Vector animation rendered from JSON data. May work on devices if using SVG renderer — must test on actual device. If it fails, rebuild as TweenMax DOM animation')
  if (features.hasBannerify) activeIssues.push('**Bannerify framework** — CSS class-based animation (bnfy-enter/bnfy-exit). Remove Bannerify and rebuild animations with TweenMax if needed')
  if (features.hasTinyScrollbar) activeIssues.push('**jQuery TinyScrollbar** — Scroll library for ISI. Must replace with standard ISI scroller')
  if (features.hasZepto) activeIssues.push('**Zepto.js** — Lightweight jQuery alternative loaded from CDN. Replace with local jQuery 2.1.4 (API-compatible)')
  if (features.hasSwiper) activeIssues.push('**Swiper.js** — Touch slider library. Must be removed and functionality rebuilt with TweenMax or CSS')
  if (features.hasCreateJS) activeIssues.push('**CreateJS / Adobe Animate CC** — Canvas-based rendering. Cannot be auto-converted. Requires complete rebuild as DOM-based ad with TweenMax animations')
  if (features.hasEnabler) activeIssues.push('**Enabler.js detected** — Google Ad Manager SDK, requires complete rebuild')
  if (features.hasCDNScripts) activeIssues.push('**CDN scripts (' + (features.cdnScriptCount || '?') + ')** — Devices are offline, scripts must be local')
  if (features.hasGoogleFonts) activeIssues.push('**Google Fonts CDN** — CDN links removed (offline). Font files must be localized via @font-face, or text converted to images')
  if (features.hasCustomFonts) activeIssues.push('**Custom fonts detected: ' + (features.detectedFonts || []).join(', ') + '** — These are NOT web-safe. Verify font files (.woff2/.woff/.ttf) are included locally. If not available, text using these fonts may need to be converted to images')
  if (features.hasWebFontLoader) activeIssues.push('**WebFontLoader CDN** — Remove entirely, use local fonts')
  if (features.hasImageMaps) activeIssues.push('**Image maps (' + (features.imageMapAreas || '?') + ' areas)** — Must convert to positioned div click zones')
  if (features.emptyImgSrcs > 0) activeIssues.push('**Empty img src (' + features.emptyImgSrcs + ')** — Images with no source need assets assigned')
  if (features.hasEmptyClickTag) activeIssues.push('**Empty clickTag** — Main click URL is missing, needs configuration')
  if (features.hasLiveISIText) activeIssues.push('**Live ISI text** — HTML-based ISI should be verified or converted to image')
  if (features.hasScrollLibrary) activeIssues.push('**Scroll library detected** — Must use standard ISI scroller, not third-party libraries')
  if (features.hasMCustomScrollbar) activeIssues.push('**mCustomScrollbar** — Must be replaced with standard ISI scroller')
  if (features.hasPoliteLoader) activeIssues.push('**Polite loader pattern** — Chained script loading needs complete restructure')
  if (features.hasChainedArrows) activeIssues.push('**Chained arrow functions** — Could not auto-convert, needs manual ES5 conversion')
  if (features.hasGWDCSSAnimations) activeIssues.push('**GWD CSS animations** — .gwd-play-animation trigger removed, animations need TweenMax rebuild')
  if (features.hasBrowserDetection) activeIssues.push('**Browser detection code** — Unnecessary on devices (always Chrome 69), safe to remove')
  if (features.isiNeedsRestructure) activeIssues.push('**ISI needs restructuring** — ISI exists but is not in standard outerMostDiv/innerMostDiv format')
  if (features.hasExitsFunctionWithWindowOpen) activeIssues.push('**exits() uses window.open()** — Must convert to appHost methods (openExternalPDF / openExternalLinkFull)')
  if (features.hasIframe) activeIssues.push('**Iframe(s) detected (' + (features.iframeCount || '?') + ')** — Iframes do NOT work on BrightSign devices. Content must be inlined into main HTML')
  if (features.hasDynamicCDN) activeIssues.push('**Dynamic CDN loading** — Scripts loaded via createElement("script") with CDN URLs, must be localized')
  if (features.hasCustomScrollerClass) activeIssues.push('**Custom Scroller class** — Bespoke scroll widget (Havas/Beyfortus pattern), must replace with standard ISI scroller')
  if (features.hasTrackingPixels) activeIssues.push('**Tracking/impression pixels** — Network requests to ad servers fail offline. Auto-removed if found in HTML; check JS for dynamic pixel creation')
  if (features.hasJSInjectedISI) activeIssues.push('**JS-injected ISI (ISIText())** — ISI content is a JavaScript string injected via innerHTML, not in the HTML. The entire ISI mechanism (isiText.js, isi.js, scroll framework) must be removed and replaced with a standard ISI image scroller')
  if (features.hasInlineCDNFontFace) activeIssues.push('**Inline @font-face with CDN URLs** — Font files loaded from fonts.gstatic.com or other CDNs. Must download locally or remove and convert text to images')
  if (features.hasGWDDelayedInit) activeIssues.push('**GWD/Enabler delayed init** — Enabler.isInitialized or DOMContentLoaded wrapping GWD setup. Remove dead init logic, let ad render directly')

  if (activeFeatures.length === 0 && activeIssues.length === 0) return ''

  let section = '## Feature Detection Summary\n\n'

  if (activeFeatures.length > 0) {
    section += '### Features Present\n'
    for (const f of activeFeatures) {
      section += `- ${f}\n`
    }
    section += '\n'
  }

  if (activeIssues.length > 0) {
    section += '### Known Issues / Incompatibilities\n'
    section += 'These were detected during import analysis. Some may have been auto-fixed (see "Auto-Refactored" section above), others require manual attention:\n\n'
    for (const issue of activeIssues) {
      section += `- ${issue}\n`
    }
    section += '\n'
  }

  return section
}

// ===== HELPER: All Detected Issues =====
function buildIssuesList(fixes) {
  if (!fixes || fixes.length === 0) return ''

  const autoFixes = fixes.filter(f => f.action === 'auto')
  const manualFixes = fixes.filter(f => f.action === 'manual')

  let section = '## All Detected Issues\n\n'

  if (autoFixes.length > 0) {
    section += '### Auto-Fixed Issues\n'
    section += '| Category | Issue | Resolution |\n'
    section += '|----------|-------|------------|\n'
    for (const fix of autoFixes) {
      section += `| ${fix.category || '—'} | ${fix.issue || '—'} | ${fix.resolution || '—'} |\n`
    }
    section += '\n'
  }

  if (manualFixes.length > 0) {
    section += '### Issues Requiring Manual Fix\n'
    section += '| Category | Issue | Why |\n'
    section += '|----------|-------|-----|\n'
    for (const fix of manualFixes) {
      section += `| ${fix.category || '—'} | ${fix.issue || '—'} | ${fix.reason || '—'} |\n`
    }
    section += '\n'
  }

  return section
}

// ===== HELPER: ISI Details =====
function buildISIDetails(features, config, adMeta) {
  if (!features?.hasISI && !adMeta?.hasISI) return ''

  let section = '## ISI (Important Safety Information) Details\n\n'

  // ISI expected (template says yes) but not detected in code
  if (!features?.hasISI && adMeta?.hasISI) {
    section += '> **Note:** This ad is configured as an ISI ad, but no ISI container structure was detected in the HTML. The ISI scroller structure (`outerMostDiv`/`innerMostDiv`/`isi-controls`) must be added, along with an ISI content image.\n\n'
    return section
  }

  if (features.hasJSInjectedISI) {
    section += '- **Structure:** JS-Injected ISI — **requires complete replacement**\n'
    section += '- **Pattern:** `ISIText()` function in `isiText.js` (or similar) constructs ISI as HTML string, injected via `innerHTML`\n'
    section += '- **Problem:** The ISI framework (scroll engine, CSS, auto-scroll) does NOT work on devices\n\n'
    section += '### JS-Injected ISI Replacement Steps\n\n'
    section += '1. **Remove the ISI framework files:**\n'
    section += '   - `isiText.js` (or `isitext.js`) — contains the `ISIText()` function with ISI HTML string\n'
    section += '   - `isi.js` (or `isi.min.js`) — the ISI scroll/render framework\n'
    section += '   - Remove their `<script>` tags from the HTML\n'
    section += '2. **Remove the ISI holder element** (e.g. `<div id="isiHolder">`) from the HTML\n'
    section += '3. **Remove ISI-related JavaScript:**\n'
    section += '   - `addISITreatment()` calls\n'
    section += '   - `isi.startAutoscroll()` and related event listeners\n'
    section += '   - `bannerID` / `isiID` / `isiVer` variable declarations\n'
    section += '   - Any `ISI_AUTOSCROLL_COMPLETE` / `ISI_START_AUTOSCROLL` event handlers\n'
    section += '4. **Render ISI content as a PNG image:**\n'
    section += '   - The ISI text is inside the `ISIText().body` property\n'
    section += '   - Render it at the correct width for this ad size and save as a tall PNG\n'
    section += '5. **Add standard ISI scroller:**\n'
    section += '   - Create `outerMostDiv` / `innerMostDiv` / `isi-controls` structure\n'
    section += '   - Place the ISI PNG as an `<img>` inside `innerMostDiv`\n'
    section += '   - The standard `scroller.js` handles scrolling automatically\n'
    section += '6. **Recreate ISI click zones:**\n'
    section += '   - The original ISI contains links (Prescribing Information, Medication Guide, etc.) using `clickTag100`, `clickTag101`, etc.\n'
    section += '   - Add positioned click zone `<div>`s over the corresponding areas of the ISI image\n'
    section += '   - Wire them to `openExternalPDF()` or `openExternalLinkFull()` handlers\n\n'
  } else if (features.isiTextOnly) {
    section += '> **WARNING:** ISI was detected from the text "Important Safety Information" in the HTML, but NO actual ISI scroller container structure was found. You must determine if this ad needs a scrollable ISI section. If yes, create the standard `outerMostDiv`/`innerMostDiv`/`isi-controls` structure from scratch.\n\n'
  } else if (features.hasStandardISI) {
    section += '- **Structure:** Standard (`outerMostDiv`/`innerMostDiv`) — ready to use\n'
  } else if (features.hasAlternativeISI) {
    section += '- **Structure:** Alternative pattern detected — may need conversion to standard structure\n'
  } else if (features.hasScrollTjPattern) {
    section += '- **Structure:** Uses `scroll_tj`/`text_tj` pattern — works if `isi-controls` is present\n'
  } else if (features.isiNeedsRestructure) {
    section += '- **Structure:** Needs restructuring into standard `outerMostDiv`/`innerMostDiv` format\n'
  }

  if (features.hasCustomScrollDiv) {
    section += '- **Scroll Implementation:** Custom scroll div detected — verify it works on devices or replace with standard\n'
  }

  if (features.hasLiveISIText) {
    section += '- **Content Type:** Live HTML text (not an image) — verify rendering on devices, consider converting to pre-rendered image\n'
  }

  if (features.hasExpandableISI) {
    section += '- **Expandable:** Yes — ISI has an expand/collapse bar that allows users to view full ISI content\n'
    section += '  - Required assets: `ISI_ExpandBar.png` (expand button), `ISI_ExpandBar_collapse.png` (collapse button)\n'
    section += '  - Requires `toggleExpansion()` function that resizes `outerMostDiv` height on tap\n'
    section += '  - Collapsed height: typically matches the ISI strip height at bottom of ad\n'
    section += '  - Expanded height: full ad height (e.g. 250px for MR, 1733px for CP)\n'
    section += '  - **Option A (TweenMax):** `TweenMax.to("#outerMostDiv", 0.3, { height: expandedHeight })` for smooth animation\n'
    section += '  - **Option B (Direct style):** `document.getElementById("outerMostDiv").style.height = expandedHeight + "px"` — simpler, no animation dependency\n'
    section += '  - Both approaches are valid. Use TweenMax if the ad already loads it; use direct style if not.\n'
  }

  if (config?.autoScrollSpeed) {
    section += `- **Auto-scroll Speed:** ${config.autoScrollSpeed}\n`
  }
  if (config?.scrollStep) {
    section += `- **Scroll Step:** ${config.scrollStep}px\n`
  }

  // Show extracted scroller styling from the original ad so Claude can match it
  const hasScrollerConfig = config?.scrollerColor || config?.scrollerWidth || config?.isiHeight || config?.scrollerTrackColor
  if (hasScrollerConfig) {
    section += '\n### Original Scroller Styling (from imported ad)\n'
    section += 'These values were auto-extracted from the original ad\'s CSS. Apply them to `scroller.css` so the refactored ad matches the original design:\n\n'
    if (config.isiTop != null) section += `- **ISI container top:** ${config.isiTop}px\n`
    if (config.isiHeight) section += `- **ISI container height:** ${config.isiHeight}px\n`
    if (config.isiWidth) section += `- **ISI container width:** ${config.isiWidth}px\n`
    if (config.isiBackgroundColor) section += `- **ISI background:** ${config.isiBackgroundColor}\n`
    if (config.scrollerColor) section += `- **Scroller thumb color:** ${config.scrollerColor}\n`
    if (config.scrollerWidth) section += `- **Scroller thumb width:** ${config.scrollerWidth}px\n`
    if (config.scrollerHeight) section += `- **Scroller thumb height:** ${config.scrollerHeight}px\n`
    if (config.scrollerBorderRadius != null) section += `- **Scroller border-radius:** ${config.scrollerBorderRadius}px\n`
    if (config.scrollerTrackColor) section += `- **Track color:** ${config.scrollerTrackColor}\n`
    if (config.scrollerTrackWidth) section += `- **Track width:** ${config.scrollerTrackWidth}px\n`
    if (config.isiControlsRight) section += `- **Scrollbar position (right):** ${config.isiControlsRight}\n`
    if (config.isiControlsTop) section += `- **Scrollbar position (top):** ${config.isiControlsTop}\n`
    var sources = []
    if (config.scrollerThumbSelector) sources.push('thumb: `' + config.scrollerThumbSelector + '`')
    if (config.scrollerTrackSelector) sources.push('track: `' + config.scrollerTrackSelector + '`')
    if (config.isiContainerSelector) sources.push('container: `' + config.isiContainerSelector + '`')
    if (sources.length > 0) section += `- **Extracted from:** ${sources.join(', ')}\n`
  }

  section += '\n'
  return section
}

// ===== HELPER: Scroll Library Replacement Guide =====
function buildScrollLibraryGuide(features) {
  if (!features?.hasScrollLibrary && !features?.hasMCustomScrollbar) return ''

  const libs = []
  if (features.hasMCustomScrollbar) libs.push('mCustomScrollbar')
  if (features.hasCustomScrollerClass) libs.push('custom Scroller class (Havas/Beyfortus)')
  if (features.hasScrollLibrary && !features.hasMCustomScrollbar && !features.hasCustomScrollerClass) libs.push('third-party scroll library')

  let section = '## Scroll Library Replacement Guide\n\n'
  section += `**Detected:** ${libs.join(', ')}\n\n`
  section += 'Third-party scroll libraries (iScroll, mCustomScrollbar, OverlayScrollbars, SimpleBar) and custom scroll classes (e.g. Havas/Beyfortus `Scroller` class) do NOT work reliably on BrightSign devices. You MUST replace them with the standard ISI scroller pattern.\n\n'

  section += '### Step-by-Step Replacement\n\n'
  section += '1. **Remove the library:**\n'
  section += '   - Delete `<script>` tags loading the scroll library JS\n'
  section += '   - Delete `<link>` tags loading the scroll library CSS\n'
  section += '   - Remove any `$.mCustomScrollbar()`, `new IScroll()`, `OverlayScrollbars()`, `new SimpleBar()`, or `new Scroller()` initialization calls\n'
  section += '   - Remove library-specific wrapper divs (e.g. `mCSB_container`, `mCSB_dragger`, `iScrollVerticalScrollbar`)\n\n'

  section += '2. **Remove custom scrollbar CSS:**\n'
  section += '   - Delete any `::-webkit-scrollbar`, `::-webkit-scrollbar-thumb`, `::-webkit-scrollbar-track` rules\n'
  section += '   - These custom scrollbar styles will not work on devices\n\n'

  section += '3. **Restructure ISI HTML to standard pattern:**\n'
  section += '```html\n'
  section += '<div id="outerMostDiv" style="position:absolute; bottom:0; left:0; width:100%; height:XXXpx; overflow:hidden;">\n'
  section += '  <div id="innerMostDiv">\n'
  section += '    <img src="images/isi-content.png" width="100%" />\n'
  section += '  </div>\n'
  section += '  <div id="isi-controls">\n'
  section += '    <div class="scroller"></div>\n'
  section += '    <div class="isiLineNoArrows"></div>\n'
  section += '  </div>\n'
  section += '</div>\n'
  section += '```\n\n'

  section += '4. **Add standard scroller CSS and JS:**\n'
  section += '   - Link `css/scroller.css` in `<head>`\n'
  section += '   - Link `script/scroller.js` after jQuery\n'
  section += '   - The standard scroller handles all touch scrolling, scroll position tracking, and scrollbar display\n\n'

  section += '5. **Customize scroller.css to match the ad\'s design:**\n'
  section += '   The included `scroller.css` has default styling. You MUST customize these values to match the original ad\'s scroller appearance:\n'
  section += '   - `.scroller` — `background-color` should match the ad\'s brand/accent color, `width` and `height` should match the original scrollbar thumb size\n'
  section += '   - `.isiLineNoArrows` — `background-color` should match the original track color, `width` should match the track width\n'
  section += '   - `#isi-controls` — `right`, `top`, `height`, `width` should position the scrollbar where the original had it\n'
  section += '   - `#outerMostDiv` — `top`/`bottom`, `height`, `width` must match the original ISI container position and size\n'
  section += '   - Look at the original ad\'s CSS or the removed scroll library\'s styling for these values\n\n'

  section += '6. **Preserve ISI content:**\n'
  section += '   - If the ISI is live HTML text, keep the original text content inside `#innerMostDiv` (do NOT rewrite the CSS, it was carefully crafted to fit)\n'
  section += '   - If the ISI is an image, set it as `<img src="..." width="100%" />` inside `#innerMostDiv`\n\n'

  return section
}

// ===== HELPER: Modal / Polite Loader Guide =====
function buildModalPoliteGuide(features) {
  const hasModal = features?.hasModalAd
  const hasPolite = features?.hasPoliteLoader
  if (!hasModal && !hasPolite) return ''

  let section = ''

  if (hasModal) {
    section += '## Modal Ad Guide\n\n'
    section += 'This ad uses modal content (`requestModalAdView`). Modal ads open a secondary view (usually a full-screen overlay or PDF) when a user taps a button.\n\n'
    section += '### How Modal Ads Work on Devices\n'
    section += '- The `appHost.requestModalAdView(path)` method opens a separate HTML page as a modal overlay\n'
    section += '- The modal content lives in a separate folder (typically `mod/index.html`)\n'
    section += '- The modal page needs its own appHost initialization and close button\n\n'
    section += '### Implementation Pattern\n'
    section += '```javascript\n'
    section += '// In main ad — open modal\n'
    section += '$("#modalButton")[0].addEventListener("click", function(e) {\n'
    section += '    if (typeof appHost !== "undefined") {\n'
    section += '        appHost.requestModalAdView("mod/index.html");\n'
    section += '    }\n'
    section += '}, false);\n'
    section += '```\n'
    section += '```javascript\n'
    section += '// In mod/index.html — close modal\n'
    section += '$("#closeButton")[0].addEventListener("click", function(e) {\n'
    section += '    if (typeof appHost !== "undefined") {\n'
    section += '        appHost.dismissModalAdView();\n'
    section += '    }\n'
    section += '}, false);\n'
    section += '```\n\n'
    section += '### Checklist\n'
    section += '- [ ] Verify `mod/index.html` exists and is device-compatible (ES5, no CDN, local assets)\n'
    section += '- [ ] Modal page has its own `appHost` initialization\n'
    section += '- [ ] Modal page has a working close/dismiss button using `appHost.dismissModalAdView()`\n'
    section += '- [ ] All assets in the modal folder are local (no CDN references)\n\n'
  }

  if (hasPolite) {
    section += '## Polite Loader Removal Guide\n\n'
    section += 'This ad uses a "polite loader" pattern — it chains CDN script loading before showing content. This pattern does NOT work on offline devices.\n\n'
    section += '### What to Do\n'
    section += '1. **Remove the loader entirely:**\n'
    section += '   - Delete `politeInit()`, `onLoaderReady()`, and any `checkInitLoadScripts()` functions\n'
    section += '   - Delete the loading spinner/animation element (e.g. `#loader` div)\n'
    section += '   - Remove `document.createElement("script")` dynamic loading\n'
    section += '   - **IMPORTANT:** If the inline `<style>` block that contains the loader CSS ALSO contains global layout rules (e.g. `div { position: absolute; }`, `* { margin: 0; padding: 0; }`, `.banner { display: none; }`), you MUST preserve those global rules. Move them to `style.css` before deleting the inline block.\n\n'
    section += '2. **Load scripts directly in `<head>`:**\n'
    section += '   - Download all CDN scripts locally\n'
    section += '   - Add `<script src="js/filename.js"></script>` tags directly in the `<head>`\n'
    section += '   - Order: jQuery first, then TweenMax, then ad-specific JS\n\n'
    section += '3. **Trigger animation on document ready:**\n'
    section += '   - Wrap animation start in `$(document).ready(function() { ... })` or `onWallboardIdleSlideDisplay()` for CP ads\n'
    section += '   - Do NOT wait for external script load events\n\n'
  }

  return section
}

// ===== HELPER: Iframe Removal Guide =====
function buildIframeGuide(features) {
  if (!features?.hasIframe) return ''

  let section = '## Iframe Removal Guide (CRITICAL)\n\n'
  section += '**Iframes do NOT work on BrightSign/device players.** All `<iframe>` content must be inlined.\n\n'

  section += '### Common Iframe Patterns in Ads\n\n'

  section += '**1. Modal content iframe** (e.g. `<iframe src="mod/index.html">`)\n'
  section += '- Instead of loading via iframe, use `appHost.requestModalAdView("mod/index.html")` to open as a device modal\n'
  section += '- Or inline the modal HTML as a hidden `<div>` and toggle visibility\n\n'

  section += '**2. ISI content iframe** (e.g. `<iframe src="isi.html">`)\n'
  section += '- Copy the ISI HTML content directly into `#innerMostDiv`\n'
  section += '- Ensure all CSS from the iframe page is merged into the main page\n\n'

  section += '**3. External content iframe** (e.g. `<iframe src="https://...">`)\n'
  section += '- Download the external content and inline it\n'
  section += '- Or replace with a click handler that opens the URL via `openExternalLinkFull()`\n\n'

  section += '### Step-by-Step\n'
  section += '1. Identify each `<iframe>` and what it loads\n'
  section += '2. Copy the iframe source HTML into the main page as a `<div>`\n'
  section += '3. Merge any CSS from the iframe page into the main stylesheet\n'
  section += '4. Merge any JS from the iframe page into the main JS\n'
  section += '5. Remove the `<iframe>` tag entirely\n'
  section += '6. Update any JS that references `iframe.contentWindow` or `iframe.contentDocument`\n\n'

  return section
}

export async function exportWithContext(files, assetFiles, tasks, adMeta, importResult) {
  if (Object.keys(files).length === 0) return

  const zip = new JSZip()

  // Add code files
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content)
  }

  // Add asset files (convert data URLs back to binary)
  for (const [path, dataUrl] of Object.entries(assetFiles)) {
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    zip.file(path, blob)
  }

  // Add AI context file
  const contextContent = buildContextFile(files, tasks, adMeta, importResult)
  zip.file('CLAUDE.md', contextContent)

  // Generate and download
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${adMeta.projectName || 'refactored-ad'}-with-context.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
