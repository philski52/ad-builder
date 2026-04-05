// Ad Import & Refactor Utility
// Parses pre-built ad ZIP files, analyzes them, and applies automated fixes
// Philosophy: REFACTOR, don't rebuild. Preserve original structure, fix compatibility issues.

import JSZip from 'jszip'
import { templates, getTemplateById } from '../templates'
import { generateScrollerJS } from './templateGenerator'

/**
 * Parse an uploaded ad ZIP file and extract all configuration
 * @param {File} zipFile - The uploaded ZIP file
 * @param {Object} options - Import options
 * @param {string} options.platform - Ad platform: 'ixr' | 'focus' | 'ipro'
 * @returns {Promise<ImportResult>}
 */
export async function parseAdFolder(fileList, options) {
  // Convert a folder's FileList into a JSZip object, then run the normal pipeline
  var zip = new JSZip()
  for (var i = 0; i < fileList.length; i++) {
    var file = fileList[i]
    var path = file.webkitRelativePath || file.name
    // Skip OS junk files
    if (path.includes('__MACOSX') || path.includes('.DS_Store') || path.includes('Thumbs.db')) continue
    var content = await file.arrayBuffer()
    zip.file(path, content)
  }
  // Generate a zip blob and pass to parseAdZip
  var blob = await zip.generateAsync({ type: 'blob' })
  var zipFile = new File([blob], 'folder-upload.zip', { type: 'application/zip' })
  return parseAdZip(zipFile, options)
}

export async function parseAdZip(zipFile, options) {
  var platform = (options && options.platform) || 'ixr'
  var adType = (options && options.adType) || null // 'cp' | 'mr' | null (auto-detect)

  const result = {
    success: false,
    template: null,
    config: {},
    assets: {},
    // ALL assets found in ZIP with data URLs for preview
    allAssets: [],
    warnings: [],
    errors: [],
    isGWD: false,
    gwdConversions: [],
    // Ad platform type (determines which rule set to apply)
    adPlatform: platform,
    // Ad type: 'cp' | 'mr' — user-selected, skips template guessing
    adType: adType,
    // Structured list of fixes needed/applied
    fixes: [],
    // Things that need manual rebuild (can't be auto-fixed)
    manualTasks: [],
    // Detected URLs from click handlers
    detectedUrls: [],
    // Animation analysis
    animationAnalysis: null,

    // === REFACTOR MODE DATA ===
    // Original source files (preserved)
    originalFiles: {
      html: null,
      adJs: null,
      mainJs: null,
      scrollerCss: null,
      clicksCss: null,
      mainCss: null,
      otherFiles: {}
    },
    // Refactored versions (with fixes applied)
    refactoredFiles: {
      html: null,
      adJs: null,
      mainJs: null
    },
    // List of auto-fixes that were applied
    appliedFixes: [],
    // Can this ad be refactored (vs needs full rebuild)?
    canRefactor: true,
    refactorMode: true
  }

  try {
    // Load ZIP
    const zip = await JSZip.loadAsync(zipFile)
    const files = Object.keys(zip.files)

    // Find and read key files
    // Prefer index.html, but fall back to any .html file (some agencies use custom names)
    var htmlFile = files.find(f => /index\.html$/i.test(f))
    if (!htmlFile) {
      // Find any .html file that's not in a subdirectory like mod/
      var htmlCandidates = files.filter(f => /\.html$/i.test(f) && !zip.files[f].dir)
      if (htmlCandidates.length > 0) {
        // Prefer files at root level (fewer path separators)
        htmlCandidates.sort(function(a, b) {
          return (a.split('/').length) - (b.split('/').length)
        })
        htmlFile = htmlCandidates[0]
      }
    }
    const adJsFile = files.find(f => /ad\.js$/i.test(f))
    const scrollerCssFile = files.find(f => /scroller\.css$/i.test(f))
    const clicksCssFile = files.find(f => /clicks\.css$/i.test(f))
    const mainCssFile = files.find(f => /main\.css$/i.test(f))

    if (!htmlFile) {
      result.errors.push({ level: 'error', message: 'No HTML file found in ZIP (looked for index.html and any .html file)' })
      return result
    }

    let html = await zip.file(htmlFile).async('string')
    const adJs = adJsFile ? await zip.file(adJsFile).async('string') : ''
    const mainJsFile = files.find(f => /main\.js$/i.test(f) && !/node_modules/i.test(f))
    const mainJs = mainJsFile ? await zip.file(mainJsFile).async('string') : ''
    const scrollerCss = scrollerCssFile ? await zip.file(scrollerCssFile).async('string') : ''
    const clicksCss = clicksCssFile ? await zip.file(clicksCssFile).async('string') : ''
    const mainCss = mainCssFile ? await zip.file(mainCssFile).async('string') : ''

    // === STORE ORIGINAL FILES (before any transformations) ===
    result.originalFiles = {
      html: html,
      adJs: adJs,
      mainJs: mainJs,
      scrollerCss: scrollerCss,
      clicksCss: clicksCss,
      mainCss: mainCss,
      otherFiles: {}
    }

    // Store original file paths from the ZIP so we can preserve folder structure on export
    result.filePaths = {
      html: htmlFile,
      adJs: adJsFile || null,
      mainJs: mainJsFile || null,
      scrollerCss: scrollerCssFile || null,
      clicksCss: clicksCssFile || null,
      mainCss: mainCssFile || null,
      otherFiles: {}
    }

    // Store other JS/CSS files (with FULL ZIP paths)
    var htmlFilename = htmlFile.split('/').pop()
    var knownFiles = [htmlFilename.toLowerCase(), 'ad.js', 'main.js', 'scroller.css', 'clicks.css', 'main.css']
    for (const filePath of files) {
      if (/\.(js|css)$/i.test(filePath) && !zip.files[filePath].dir) {
        const filename = filePath.split('/').pop()
        if (!knownFiles.includes(filename.toLowerCase())) {
          try {
            const content = await zip.file(filePath).async('string')
            result.originalFiles.otherFiles[filename] = content
            result.filePaths.otherFiles[filePath] = filename
          } catch (e) {
            // Skip files that can't be read
          }
        }
      }
    }

    // Build combined JS code from ALL .js files for comprehensive detection
    // Excludes known libraries (jQuery, TweenMax, createjs, etc.) to avoid false positives
    var libraryPattern = /jquery|tweenmax|tweenlite|timelinemax|timelinelite|gsap|createjs|iscroll|webcomponents|enabler/i
    var otherJsCode = ''
    for (var otherFilename in result.originalFiles.otherFiles) {
      if (/\.js$/i.test(otherFilename) && !libraryPattern.test(otherFilename)) {
        otherJsCode += '\n' + result.originalFiles.otherFiles[otherFilename]
      }
    }

    // Check for GWD (Google Web Designer) ads — convert for all platforms
    const gwdDetection = detectGWD(html)
    if (gwdDetection.isGWD) {
      result.isGWD = true

      result.fixes.push({
        id: 'gwd-elements',
        category: 'GWD Conversion',
        issue: 'Google Web Designer custom elements detected',
        reason: 'GWD elements like <gwd-image> are not supported by target devices',
        action: 'auto',
        resolution: 'Converting to standard HTML elements (<img>, <div>, etc.)'
      })

      // Convert GWD elements to standard HTML
      const conversion = convertGWDToStandard(html)
      html = conversion.html
      result.gwdConversions = conversion.conversions

      // Add gwd-exit extracted URLs to detectedUrls and config
      if (conversion.gwdExitUrls && conversion.gwdExitUrls.length > 0) {
        if (!result.detectedUrls) result.detectedUrls = []
        conversion.gwdExitUrls.forEach(function(exitUrl, i) {
          result.detectedUrls.push(exitUrl)
          // Also populate clickTag variables in result.config for convenience
          var tagKey = 'clickTag' + (i + 1)
          if (!result.config[tagKey]) {
            result.config[tagKey] = exitUrl.url
          }
        })
      }

      conversion.conversions.forEach(conv => {
        result.fixes.push({
          id: `gwd-convert-${conv.from.substring(0, 20)}`,
          category: 'GWD Conversion',
          issue: conv.from,
          reason: 'Non-standard element',
          action: 'auto',
          resolution: conv.to
        })
      })
    }

    // Detect and convert CSS animations to TweenMax (IXR/iPro only — Focus keeps CSS animations)
    if (platform !== 'focus') {
      const cssAnimResult = detectAndConvertCSSAnimations(html)
      html = cssAnimResult.html
      if (cssAnimResult.animations.length > 0) {
        result.fixes.push({
          id: 'css-animations',
          category: 'Animation',
          issue: `${cssAnimResult.animations.length} CSS animation(s) detected`,
          reason: 'CSS animations are less reliable on target devices than TweenMax',
          action: 'auto',
          resolution: 'Converting to TweenMax animations for better device compatibility'
        })
        result.cssAnimationsConverted = cssAnimResult.animations
      }
    }

    // Remove custom scroll implementations (IXR/iPro only — Focus leaves scrollbars as-is)
    const scrollDetection = platform !== 'focus' ? detectScrollImplementations(html, adJs) : []
    if (scrollDetection.length > 0) {
      scrollDetection.forEach(scroll => {
        result.fixes.push({
          id: `scroll-${scroll.message.substring(0, 20)}`,
          category: 'Scrolling',
          issue: scroll.message.replace(' - will be removed (devices use standard ISI scroller)', '').replace(' - may conflict with device scroller', ''),
          reason: 'Devices use a standard ISI scroller - custom implementations cause conflicts',
          action: scroll.level === 'error' ? 'auto' : 'manual',
          resolution: scroll.level === 'error' ? 'Removing custom scroll implementation' : 'Review and remove if causing issues'
        })
      })
    }

    const htmlBeforeScrollRemoval = html
    if (platform !== 'focus') html = removeScrollImplementations(html)
    if (html !== htmlBeforeScrollRemoval) {
      result.fixes.push({
        id: 'scroll-removed',
        category: 'Scrolling',
        issue: 'Custom scroll libraries found in code',
        reason: 'Conflicts with device ISI scroller',
        action: 'auto',
        resolution: 'Scroll library scripts and initializations removed'
      })
    }

    // 1. Extract dimensions
    const dimensions = extractDimensions(html)
    if (dimensions) {
      result.config.dimensions = dimensions
    } else {
      result.warnings.push({ level: 'warn', message: 'Could not detect ad dimensions' })
    }

    // 2. Detect features (scan ALL JS files so animation/ISI detection catches code in any file)
    const features = detectFeatures(html, adJs, mainJs, otherJsCode)
    result.features = features  // Store for use in manual tasks and refactoring

    // 3. Determine template type
    // If user selected an ad type (cp/mr), use that directly instead of guessing
    if (adType) {
      var adTypeDimensions = adType === 'cp' ? { width: 1080, height: 1733 } : { width: 300, height: 250 }
      // Use detected dimensions if available, otherwise use type defaults
      var templateDims = dimensions || adTypeDimensions
      result.template = detectTemplate(templateDims, features)
      if (!result.template) {
        result.template = getBestGuessTemplate(templateDims, features)
      }
      // Override the brand to match user selection
      if (result.template) {
        result.template = Object.assign({}, result.template, { brand: adType })
      }
      // Set dimensions from user selection if not detected
      if (!dimensions) {
        result.config.dimensions = adTypeDimensions
      }
    } else {
      result.template = detectTemplate(dimensions, features)
      if (!result.template) {
        result.warnings.push({ level: 'warn', message: 'Could not match to known template, using closest match' })
        result.template = getBestGuessTemplate(dimensions, features)
      }
    }

    // 4. Extract clickTags from ad.js (handles multiple patterns)
    const clickTagResult = extractClickTags(adJs, html)
    Object.assign(result.config, clickTagResult.clickTags)
    // Merge with any URLs already detected (e.g. from GWD exit elements)
    var existingUrls = result.detectedUrls || []
    result.detectedUrls = existingUrls.concat(clickTagResult.allUrls.filter(function(newUrl) {
      // Avoid duplicates by URL
      return !existingUrls.some(function(existing) { return existing.url === newUrl.url })
    }))

    // 5. Extract ISI configuration from CSS
    if (features.hasISI) {
      const isiConfig = extractISIConfig(scrollerCss, mainCss, html)
      Object.assign(result.config, isiConfig)
    }

    // 6. Extract click zones
    const clickZones = extractClickZones(clicksCss, adJs, clickTagResult.clickTags)
    if (clickZones.length > 0) {
      result.config.clickZones = clickZones
    }

    // 7. Extract and map assets (includes ALL assets for manual mapping)
    const assetResult = await extractAssets(zip, files, html, features)
    result.assets = assetResult.assets
    result.allAssets = assetResult.allAssets
    result.warnings.push(...assetResult.warnings)

    // 8. Check for compatibility issues (scan all JS files)
    const compatWarnings = platform !== 'focus' ? checkCompatibility(html, adJs, result.template?.brand, otherJsCode) : []
    result.warnings.push(...compatWarnings)

    // 9. Detect animation library used (scan all JS files)
    const animationLibrary = detectAnimationLibrary(html, adJs, otherJsCode)
    if (animationLibrary) {
      result.animationLibrary = animationLibrary
      // No fix needed - animations are preserved in refactored export
    }

    // 10. Check for animation wrapper (CP only, IXR/iPro only)
    if (platform !== 'focus') {
      var resolvedBrand = adType || result.template?.brand
      const hasOnWallboardIdle = html.includes('onWallboardIdleSlideDisplay') || adJs.includes('onWallboardIdleSlideDisplay')
      if (animationLibrary && !hasOnWallboardIdle && resolvedBrand === 'cp') {
        result.fixes.push({
          id: 'animation-wrapper',
          category: 'Device Compatibility',
          issue: 'Missing onWallboardIdleSlideDisplay wrapper',
          reason: 'CP ads require this function for devices to trigger animation playback',
          action: 'auto',
          resolution: 'Will wrap existing animation code in device callback'
        })
      }
    }

    // 11. Analyze animation complexity (IXR/iPro only — Focus keeps animations as-is)
    if (platform !== 'focus') {
      result.animationAnalysis = analyzeAnimations(html, adJs, mainJs, otherJsCode)
    }

    // 12. Parse scene structure to understand asset relationships
    const sceneStructure = parseSceneStructure(html, adJs)
    result.sceneStructure = sceneStructure

    // Update allAssets with scene context
    if (result.allAssets && sceneStructure.assetUsage) {
      result.allAssets.forEach(asset => {
        const usage = sceneStructure.assetUsage[asset.filename]
        if (usage) {
          asset.scene = usage.scene
          asset.element = usage.element
          asset.context = usage.context
        }
      })
    }

    // 12. Build manual tasks list (things user MUST do)
    result.manualTasks = buildManualTasksList(result, html, adJs)

    // 13. Add fixes for compatibility issues
    if (platform !== 'focus') addCompatibilityFixes(result, html, adJs)

    // 14. === APPLY REFACTORING ===
    // Generate refactored versions of the files with all auto-fixes applied
    const refactored = applyRefactoring(result, html, adJs, mainJs, result.originalFiles.otherFiles)
    result.refactoredFiles = refactored.files
    result.appliedFixes = refactored.appliedFixes

    // Store original versions of other JS files that were refactored (for diff view)
    if (refactored.files.additionalJs) {
      result.originalFiles.additionalJs = {}
      for (var fname in refactored.files.additionalJs) {
        if (result.originalFiles.otherFiles[fname]) {
          result.originalFiles.additionalJs[fname] = result.originalFiles.otherFiles[fname]
        }
      }
    }

    result.success = true

  } catch (error) {
    result.errors.push({ level: 'error', message: `Parse error: ${error.message}` })
  }

  return result
}

/**
 * Extract dimensions from HTML meta tag
 */
function extractDimensions(html) {
  // Try meta tag first: <meta name="ad.size" content="width=1080,height=1733">
  const metaMatch = html.match(/name=["']ad\.size["']\s+content=["']width=(\d+),height=(\d+)["']/i)
  if (metaMatch) {
    return { width: parseInt(metaMatch[1]), height: parseInt(metaMatch[2]) }
  }

  // Try container CSS in inline styles
  const containerMatch = html.match(/#container[^}]*width:\s*(\d+)px[^}]*height:\s*(\d+)px/i)
  if (containerMatch) {
    return { width: parseInt(containerMatch[1]), height: parseInt(containerMatch[2]) }
  }

  // Try reverse order
  const containerMatch2 = html.match(/#container[^}]*height:\s*(\d+)px[^}]*width:\s*(\d+)px/i)
  if (containerMatch2) {
    return { width: parseInt(containerMatch2[2]), height: parseInt(containerMatch2[1]) }
  }

  return null
}

/**
 * Detect features present in the ad
 */
function detectFeatures(html, adJs, mainJs, otherJsCode) {
  adJs = adJs || ''
  mainJs = mainJs || ''
  otherJsCode = otherJsCode || ''
  var allCode = html + '\n' + adJs + '\n' + mainJs + '\n' + otherJsCode

  // Detect animation - check for any GreenSock usage
  var hasGreenSock = /gsap\.|TweenMax|TweenLite|TimelineMax|TimelineLite/i.test(allCode)
  var hasTimeline = /\.timeline\s*\(|new\s+TimelineMax|new\s+TimelineLite/i.test(allCode)
  var hasTweens = /\.to\s*\(|\.from\s*\(|\.fromTo\s*\(/i.test(allCode)
  var hasFrameIds = (html.match(/id=["']frame\d+["']/gi) || []).length > 0
  var hasAnimationClasses = /class=["'][^"']*(?:frame|scene|slide|animation)[^"']*["']/i.test(html)

  // Detect ISI - check for standard structure AND alternative patterns
  var hasStandardISI = html.includes('id="outerMostDiv"') || html.includes('id="isi-controls"') || html.includes('innerMostDiv')
  // Alternative ISI patterns (jQuery scrollbar, custom scrollers, etc.)
  var hasAlternativeISI = /class=["'][^"']*(?:scrollbar-external|ssi_content|ssiall|isi-content|isi-wrapper|isi-copy)[^"']*["']/i.test(html) ||
                          /id=["'](?:scrollable_ssi|isi-container|isi-wrapper|isi-copy)[^"']*["']/i.test(html) ||
                          /Important\s+Safety\s+Information/i.test(html)
  // Check if using a scroll library (indicates ISI needs conversion)
  // Also catches custom Scroller class (Havas/Beyfortus bespoke scroll widget)
  var hasScrollLibrary = /jquery\.scrollbar|jquery\.tinyscrollbar|OverlayScrollbars|iScroll|perfect-scrollbar|enscroll|SimpleBar/i.test(html) ||
                          /new\s+Scroller\s*\(|Scroller\.prototype|function\s+Scroller\s*\(/i.test(allCode)

  // Detect Enabler.js (Google Ad Manager / DoubleClick Studio)
  var hasEnabler = /Enabler\.js|Enabler\.exit|Enabler\.isInitialized|studio\.events\.StudioEvent/i.test(allCode)

  // Detect CDN scripts (won't work offline on devices)
  var cdnScriptMatches = html.match(/<script[^>]*src=["'](https?:\/\/[^"']+)["'][^>]*>/gi) || []
  var hasCDNScripts = cdnScriptMatches.length > 0

  // Detect dynamically loaded CDN scripts (createElement('script') with CDN URL)
  var hasDynamicCDN = /createElement\s*\(\s*["']script["']\s*\)[\s\S]{0,200}(?:src\s*=\s*["']https?:\/\/|\.src\s*=\s*["']https?:\/\/)/i.test(allCode)

  // Detect live ISI text (HTML-based ISI that should be converted to image)
  var hasLiveISIText = /<div[^>]*(?:id|class)=["'][^"']*isi[^"']*["'][^>]*>[\s\S]*?<(?:ul|ol|p)[^>]*>/i.test(html) ||
                       /class=["'][^"']*isi-content[^"']*["'][^>]*>[\s\S]*?<ul/i.test(html)

  // Detect if ISI was matched only by text content (no structural elements)
  var isiTextOnly = !hasStandardISI &&
    !/class=["'][^"']*(?:scrollbar-external|ssi_content|ssiall|isi-content|isi-wrapper|isi-copy)[^"']*["']/i.test(html) &&
    !/id=["'](?:scrollable_ssi|isi-container|isi-wrapper|isi-copy)[^"']*["']/i.test(html) &&
    /Important\s+Safety\s+Information/i.test(html)

  // JS-injected ISI: ISIText() function pattern (isiText.js files that inject ISI via innerHTML)
  var hasJSInjectedISI = /function\s+ISIText\s*\(|var\s+isiText\s*=|isiID\s*=\s*["']/i.test(allCode)

  var hasISI = hasStandardISI || hasAlternativeISI || hasJSInjectedISI
  // Track if ISI needs restructuring (has ISI content but not standard structure)
  var isiNeedsRestructure = (hasAlternativeISI || hasJSInjectedISI) && !hasStandardISI

  // Detect image maps (problematic on devices)
  var hasImageMaps = /<map[^>]*name=["'][^"']+["'][^>]*>/i.test(html) && /<area[^>]*>/i.test(html)
  var imageMapAreas = hasImageMaps ? (html.match(/<area[^>]*>/gi) || []).length : 0

  // Detect images with empty src (need fixing)
  var emptyImgSrcs = (html.match(/<img[^>]*src=["']\s*["'][^>]*>/gi) || []).length

  // Detect expandable ISI pattern (ISI_header with expand/collapse)
  var hasExpandableISI = /ISI_header|ISI_ExpandBar|toggleExpansion|expandISI/i.test(html + '\n' + adJs)

  // Detect inline onclick="window.open(...)" handlers (different from javascript:void())
  var hasInlineOnclickOpen = /onclick=["'][^"']*window\.open\s*\([^)]*\)/i.test(html)

  // Detect inline onMouseOver/onMouseOut handlers (won't work reliably on devices)
  var hasInlineMouseHandlers = /onMouseOver=["']|onMouseOut=["']|onmouseover=["']|onmouseout=["']/i.test(html)

  // Detect alternative ISI container patterns (scroll_tj/text_tj style)
  var hasScrollTjPattern = /id=["']scroll_tj["']|id=["']text_tj["']/i.test(html)

  // Detect CSS webkit-scrollbar custom styles (won't work on devices)
  var hasWebkitScrollbarStyles = /::-webkit-scrollbar(?:-button|-thumb|-track)?/i.test(html)

  // Detect custom scrollDiv auto-scroll implementation
  var hasCustomScrollDiv = /function\s+scrollDiv\s*\(|scrollDiv_init|startScroll\s*\(\)/i.test(allCode)

  // Detect polite loader pattern (chained script loading, CDN dependencies)
  var hasPoliteLoader = /politeInit|onLoaderReady|\.onload\s*=\s*(?:\(\s*\)\s*=>|function)/i.test(allCode) &&
                        /include\s*\(|createElement\s*\(\s*["']script["']\s*\)/i.test(allCode)

  // Detect chained arrow function assignments (problematic for ES6 conversion)
  var hasChainedArrows = /=>\s*[^{]*=>/m.test(allCode)

  // Detect Google Fonts CDN (won't work offline)
  var hasGoogleFonts = /fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(html)

  // Detect WebFontLoader CDN (another way to load fonts)
  var hasWebFontLoader = /webfont\.js|WebFontConfig/i.test(allCode)

  // Detect custom (non-web-safe) fonts used in the ad
  var webSafeFonts = /^(arial|helvetica|verdana|georgia|times new roman|times|courier new|courier|impact|comic sans ms|trebuchet ms|palatino linotype|palatino|lucida sans unicode|lucida grande|lucida console|tahoma|geneva|sans-serif|serif|monospace|cursive|fantasy|inherit|initial|unset)$/i
  var detectedFonts = []
  var fontFamilyMatches = allCode.match(/font-family\s*:\s*([^;}\n]+)/gi) || []
  fontFamilyMatches.forEach(function(m) {
    var value = m.replace(/font-family\s*:\s*/i, '').trim()
    // Split on comma and check each font
    var fonts = value.split(',')
    fonts.forEach(function(f) {
      var cleaned = f.trim().replace(/^["']|["']$/g, '').trim()
      if (cleaned && !webSafeFonts.test(cleaned) && detectedFonts.indexOf(cleaned) === -1) {
        detectedFonts.push(cleaned)
      }
    })
  })
  // Also check @font-face declarations for local font files
  var hasLocalFontFiles = /@font-face/i.test(allCode)

  // Detect onclick="exits(event)" pattern (calls shared exits function)
  var hasExitsHandler = /onclick=["']exits\s*\(\s*event\s*\)["']/i.test(html)

  // Detect exits() function in JS that uses window.open() - needs conversion to appHost methods
  var hasExitsFunctionWithWindowOpen = /function\s+exits\s*\([^)]*\)\s*\{[\s\S]*?window\.open/i.test(allCode)

  // Detect addEventListener with exits as handler (different from inline onclick)
  var hasExitsEventListener = /addEventListener\s*\(\s*["']click["']\s*,\s*exits\s*\)/i.test(allCode)

  // Detect modal ad pattern (requestModalAdView)
  var hasModalAd = /requestModalAdView|openMod\s*\(/i.test(allCode)

  // Detect GWD CSS animations (@keyframes with .gwd-play-animation trigger class)
  var hasGWDCSSAnimations = /\.gwd-play-animation\s+\.gwd-gen-|@keyframes\s+gwd-gen-/i.test(html)

  // Detect gwd-exit elements (URL definitions in GWD ads)
  var hasGwdExitElements = /<gwd-exit[^>]*metric=["'][^"']+["'][^>]*url=["'][^"']+["']/i.test(html)
  var gwdExitCount = (html.match(/<gwd-exit[^>]*>/gi) || []).length

  // Detect mCustomScrollbar library (needs replacement with standard scroller)
  var hasMCustomScrollbar = /mCustomScrollbar|mCSB_container|jquery\.mcustomscrollbar/i.test(allCode)

  // Detect custom Scroller class (Havas/Beyfortus pattern — bespoke scroll widget, NOT a standard library)
  var hasCustomScrollerClass = /new\s+Scroller\s*\(|Scroller\.prototype|function\s+Scroller\s*\(/i.test(allCode)

  // Detect browser detection code (Mac/Chrome/Safari/Firefox class additions - not needed on devices)
  var hasBrowserDetection = /navigator\.userAgent.*Mac OS X|navigator\.userAgent.*safari|isChrome|isFirefox|isSafari/i.test(allCode)

  return {
    hasISI: hasISI,
    hasStandardISI: hasStandardISI,
    isiNeedsRestructure: isiNeedsRestructure,
    isiTextOnly: isiTextOnly,
    hasScrollLibrary: hasScrollLibrary,
    hasVideo: html.includes('<video') || html.includes('id="videoId"'),
    hasExpandable: html.includes('id="expandable"') || html.includes('id="expand"'),
    hasExpandableISI: hasExpandableISI,
    hasModal: html.includes('requestModalAdView') || html.includes('openMod'),
    frameCount: (html.match(/id=["']frame\d+["']/gi) || []).length,
    // Animation is detected by GreenSock usage, not just frame IDs
    hasAnimation: hasGreenSock || hasTimeline || hasTweens || hasFrameIds || hasAnimationClasses,
    hasGreenSock: hasGreenSock,
    gsapVersion: /gsap\./i.test(allCode) ? '3.x' : (hasGreenSock ? '2.x' : null),
    // Problematic patterns that need conversion
    hasImageMaps: hasImageMaps,
    imageMapAreas: imageMapAreas,
    emptyImgSrcs: emptyImgSrcs,
    // Ad platform patterns requiring manual rebuild
    hasEnabler: hasEnabler,
    hasCDNScripts: hasCDNScripts,
    hasDynamicCDN: hasDynamicCDN,
    cdnScriptCount: cdnScriptMatches.length,
    hasLiveISIText: hasLiveISIText,
    // Click handling issues
    hasEmptyClickTag: /var\s+clickTag\s*=\s*["']\s*["']/i.test(allCode),
    hasJavascriptVoidClick: /javascript:\s*void\s*\(/i.test(html),
    hasJavascriptWindowOpen: /javascript:\s*(?:window\.)?open\s*\(/i.test(html),
    // New patterns from 7554
    hasInlineOnclickOpen: hasInlineOnclickOpen,
    hasInlineMouseHandlers: hasInlineMouseHandlers,
    hasScrollTjPattern: hasScrollTjPattern,
    hasWebkitScrollbarStyles: hasWebkitScrollbarStyles,
    hasCustomScrollDiv: hasCustomScrollDiv,
    // New patterns from 7567
    hasPoliteLoader: hasPoliteLoader,
    hasChainedArrows: hasChainedArrows,
    hasGoogleFonts: hasGoogleFonts,
    // New patterns from 7672
    hasWebFontLoader: hasWebFontLoader,
    hasExitsHandler: hasExitsHandler,
    hasModalAd: hasModalAd,
    // New patterns from 7790
    hasGWDCSSAnimations: hasGWDCSSAnimations,
    hasGwdExitElements: hasGwdExitElements,
    gwdExitCount: gwdExitCount,
    hasMCustomScrollbar: hasMCustomScrollbar,
    hasBrowserDetection: hasBrowserDetection,
    hasCustomScrollerClass: hasCustomScrollerClass,
    // New patterns from 7896
    hasExitsFunctionWithWindowOpen: hasExitsFunctionWithWindowOpen,
    hasExitsEventListener: hasExitsEventListener,
    // Anchor href links (external URLs in <a> tags that need device handler conversion)
    hasAnchorHrefLinks: /<a\s[^>]*href=["']https?:\/\/[^"']+["'][^>]*>/i.test(html),
    // Iframe detection (iframes do NOT work on BrightSign/device)
    hasIframe: /<iframe[\s>]/i.test(html),
    iframeCount: (html.match(/<iframe[\s>]/gi) || []).length,
    // Preloader library (imagesloaded)
    hasImagesLoaded: /imagesloaded|imagesLoaded/i.test(allCode),
    // Tracking pixels (impression trackers that won't work offline)
    hasTrackingPixels: /adtaginformer|2mdn\.net\/ads|doubleclick\.net|googlesyndication|impression.*\.gif|pixel_images|ad\.doubleclick/i.test(allCode),
    // data-exit click pattern (used by some ad platforms)
    hasDataExitClicks: /data-exit/i.test(html),
    // CreateJS / Adobe Animate CC (canvas-based ads — completely different rendering paradigm)
    hasCreateJS: /createjs|easeljs|tweenjs\.min/i.test(allCode) || /AdobeAn/i.test(allCode) || (/<canvas\s/i.test(html) && /createjs|cjs\.|easeljs|tweenjs/i.test(allCode)),
    hasCanvas: /<canvas\s/i.test(html),
    // Local GSAP 3.x file loaded (not CDN) — may be unused if TweenMax also present
    hasLocalGsap3File: /<script[^>]*src=["'][^"']*gsap[_.]?3[^"']*\.js["']/i.test(html),
    // Font detection
    detectedFonts: detectedFonts,
    hasCustomFonts: detectedFonts.length > 0,
    hasLocalFontFiles: hasLocalFontFiles,
    // Webpack/bundled ad (hashed filenames, __webpack_modules__ — can't be auto-converted)
    hasWebpackBundle: /__webpack_modules__|__webpack_require__|webpackJsonp/i.test(allCode) ||
                      /<script[^>]*src=["'][^"']*_[a-f0-9]{8,}\.js["']/i.test(html),
    // Creatopy ad builder (creatopyEmbed runtime — can't be auto-converted)
    hasCreatopy: /creatopyEmbed|window\.creatopyEmbed/i.test(allCode),
    // Lottie / Bodymovin animation (vector animation from JSON data — test on device)
    hasLottie: /lottie\.loadAnimation|bodymovin\.loadAnimation|lottie\.min\.js|bodymovin/i.test(allCode),
    // Bannerify ad framework (CSS class-based animation — bnfy-enter/bnfy-exit)
    hasBannerify: /bannerify|bnfy-enter|bnfy-exit/i.test(allCode),
    // TinyScrollbar (jQuery plugin for ISI scrolling)
    hasTinyScrollbar: /tinyscrollbar/i.test(allCode),
    // Zepto.js (lightweight jQuery alternative — must be replaced with jQuery 2.1.4)
    hasZepto: /zepto\.js|zepto\.min\.js/i.test(html),
    // Swiper.js (touch slider library)
    hasSwiper: /swiper/i.test(allCode),
    // CSS transitions used for animation (class-swap driven, works on devices — preserved as-is)
    hasCSSTransitions: /transition-property\s*:|transition\s*:(?![^;]*none)/i.test(html),
    // Inline @font-face with CDN src URLs (won't work offline)
    hasInlineCDNFontFace: /@font-face[\s\S]*?src\s*:\s*url\s*\(\s*https?:\/\//i.test(html),
    // GWD onload/delay loading pattern (DOMContentLoaded, window.onload wrapping init)
    hasGWDDelayedInit: /DOMContentLoaded.*gwd|gwd.*DOMContentLoaded|window\.onload.*gwd|Enabler\.isInitialized|Enabler\.addEventListener.*INIT/i.test(allCode),
    // JS-injected ISI (ISIText() function that returns HTML string — common agency pattern)
    // These ads store entire ISI content as a JS string in isiText.js and inject via innerHTML
    hasJSInjectedISI: hasJSInjectedISI
  }
}

/**
 * Match to a known template based on dimensions and features
 * Prioritizes CP and MR templates
 */
function detectTemplate(dimensions, features) {
  if (!dimensions) return null

  const { width, height } = dimensions
  const { hasISI, hasVideo, hasExpandable, hasAnimation } = features

  // CP Templates (1080x1733) - Most common
  if (width === 1080 && height === 1733) {
    if (hasExpandable && hasISI) {
      return getTemplateById('cp-animated-isi-expandable')
    }
    if (hasAnimation && hasISI) {
      return getTemplateById('cp-animated-isi')
    }
    if (hasISI) {
      return getTemplateById('cp-static-isi')
    }
    return getTemplateById('cp-static')
  }

  // MR Templates (300x250) - Second most common
  if (width === 300 && height === 250) {
    if (hasAnimation && hasISI) {
      return getTemplateById('mr-animated-isi')
    }
    if (hasISI) {
      return getTemplateById('mr-animated-isi') // MR usually has ISI
    }
    return getTemplateById('mr-static')
  }

  // INT Templates (1000x1600) - Less common
  if (width === 1000 && height === 1600) {
    if (hasAnimation && hasISI) {
      return getTemplateById('int-animated-isi')
    }
    return getTemplateById('int-static')
  }

  // INT Video (1000x750)
  if (width === 1000 && height === 750 && hasVideo) {
    return getTemplateById('int-mod-video-0-buttons')
  }

  return null
}

/**
 * Best guess template when exact match not found
 */
function getBestGuessTemplate(dimensions, features) {
  if (!dimensions) {
    // Default to CP static ISI as safest option
    return getTemplateById('cp-static-isi')
  }

  const { width, height } = dimensions

  // Guess based on aspect ratio
  const ratio = width / height

  if (ratio < 0.7) {
    // Tall/portrait - likely CP
    return features.hasISI ? getTemplateById('cp-static-isi') : getTemplateById('cp-static')
  } else if (ratio > 1.2) {
    // Wide/landscape - likely MR or video
    return getTemplateById('mr-static')
  } else {
    // Square-ish - could be INT
    return getTemplateById('int-static')
  }
}

/**
 * Extract clickTag URLs from ad.js - handles multiple patterns
 */
function extractClickTags(adJs, html = '') {
  const clickTags = {}
  const allUrls = []
  const allCode = adJs + '\n' + html

  // Helper: decode HTML entities in URLs extracted from HTML source
  const decodeUrl = (url) => url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')

  // Pattern 1: var clickTag1 = "https://..."
  const varPattern = /var\s+(clickTag\d)\s*=\s*["']([^"']+)["']/gi
  let match
  while ((match = varPattern.exec(allCode)) !== null) {
    const url = decodeUrl(match[2])
    clickTags[match[1].toLowerCase()] = url
    allUrls.push({
      id: match[1],
      url: url,
      type: 'variable',
      element: null
    })
  }

  // Pattern 2: jQuery click handler - $('#element').addEventListener("click", function(e) { openExternalLinkFull(e, "url") }
  const jqueryClickPattern = /\$\s*\(\s*['"]#([^'"]+)['"]\s*\)[^}]*?(?:addEventListener|click)\s*\([^}]*?(?:openExternalLinkFull|openExternalLink|requestFullscreenBrowserView)\s*\([^,]*,\s*["']([^"']+)["']/gi
  while ((match = jqueryClickPattern.exec(allCode)) !== null) {
    allUrls.push({
      id: match[1],
      url: match[2],
      type: 'external-link',
      element: `#${match[1]}`
    })
    // Map to clickTag if it looks like a main click area
    if (match[1].toLowerCase().includes('click') && !clickTags.clicktag1) {
      clickTags.clicktag1 = match[2]
    }
  }

  // Pattern 3: openExternalPDF handler
  const pdfPattern = /\$\s*\(\s*['"]#([^'"]+)['"]\s*\)[^}]*?(?:addEventListener|click)\s*\([^}]*?openExternalPDF\s*\([^,]*,\s*["']([^"']+)["']/gi
  while ((match = pdfPattern.exec(allCode)) !== null) {
    allUrls.push({
      id: match[1],
      url: match[2],
      type: 'pdf',
      element: `#${match[1]}`
    })
  }

  // Pattern 4: Direct appHost calls
  const appHostPattern = /appHost\.(?:openExternalLinkFull|requestFullscreenBrowserView|requestPDFView)\s*\(\s*["']([^"']+)["']\s*\)/gi
  while ((match = appHostPattern.exec(allCode)) !== null) {
    const url = match[1]
    if (!allUrls.find(u => u.url === url)) {
      allUrls.push({
        id: 'appHost-call',
        url: url,
        type: url.includes('.pdf') ? 'pdf' : 'external-link',
        element: null
      })
    }
  }

  // Pattern 5: href attributes
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi
  while ((match = hrefPattern.exec(allCode)) !== null) {
    const url = match[1]
    if (url.startsWith('http') && !allUrls.find(u => u.url === url)) {
      allUrls.push({
        id: 'href',
        url: url,
        type: 'href',
        element: null
      })
    }
  }

  return { clickTags, allUrls }
}

/**
 * Extract ISI configuration from CSS
 */
function extractISIConfig(scrollerCss, mainCss, html) {
  var css = scrollerCss + '\n' + mainCss
  // Also scan inline <style> blocks in the HTML for ISI/scroller styling
  if (html) {
    var inlineStyles = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []
    inlineStyles.forEach(function(block) {
      var content = block.replace(/<\/?style[^>]*>/gi, '')
      css += '\n' + content
    })
  }
  var config = {}

  // Helper to extract CSS value from any matching selector block
  var getValue = function(selector, prop, source) {
    var escaped = selector.replace(/[#.:[\]()]/g, '\\$&')
    var selectorRegex = new RegExp(escaped + '\\s*\\{([^}]+)\\}', 'gi')
    var match
    while ((match = selectorRegex.exec(source)) !== null) {
      var propRegex = new RegExp(prop + ':\\s*([^;]+)', 'i')
      var propMatch = match[1].match(propRegex)
      if (propMatch) return propMatch[1].trim()
    }
    return null
  }

  // ISI container dimensions — check standard and common agency patterns
  var isiContainerSelectors = ['#outerMostDiv', '#isi-container', '#isi-con', '#scrollbar1', '.isi-wrapper', '#isi_container']
  for (var i = 0; i < isiContainerSelectors.length; i++) {
    var sel = isiContainerSelectors[i]
    if (!config.isiHeight) {
      var h = getValue(sel, 'height', css)
      if (h) { config.isiHeight = parseInt(h); config.isiContainerSelector = sel }
    }
    if (!config.isiTop) {
      var t = getValue(sel, 'top', css)
      if (t) config.isiTop = parseInt(t)
    }
    if (!config.isiWidth) {
      var w = getValue(sel, 'width', css)
      if (w) config.isiWidth = parseInt(w)
    }
    if (!config.isiBackgroundColor) {
      var bg = getValue(sel, 'background-color', css) || getValue(sel, 'background', css)
      if (bg && !/url\(|none|transparent/i.test(bg)) config.isiBackgroundColor = bg
    }
  }

  // Scroller thumb styling — check standard and agency patterns
  // Standard: .scroller | TinyScrollbar: #thumb | mCustomScrollbar: .mCSB_dragger_bar | OverlayScrollbars: .os-scrollbar-handle | Havas: .knob
  var thumbSelectors = ['.scroller', '#thumb', '.mCSB_dragger_bar', '.os-scrollbar-handle', '.knob']
  for (var j = 0; j < thumbSelectors.length; j++) {
    var thumbSel = thumbSelectors[j]
    if (!config.scrollerColor) {
      var c = getValue(thumbSel, 'background-color', css) || getValue(thumbSel, 'background', css)
      if (c && !/url\(|none|transparent/i.test(c)) { config.scrollerColor = c; config.scrollerThumbSelector = thumbSel }
    }
    if (!config.scrollerWidth) {
      var sw = getValue(thumbSel, 'width', css)
      if (sw) config.scrollerWidth = parseInt(sw)
    }
    if (!config.scrollerHeight) {
      var sh = getValue(thumbSel, 'height', css)
      if (sh) config.scrollerHeight = parseInt(sh)
    }
    if (!config.scrollerBorderRadius) {
      var sr = getValue(thumbSel, 'border-radius', css)
      if (sr) config.scrollerBorderRadius = parseInt(sr)
    }
  }

  // Scroller track styling — check standard and agency patterns
  // Standard: .isiLineNoArrows | TinyScrollbar: #track | mCustomScrollbar: .mCSB_draggerRail | OverlayScrollbars: .os-scrollbar-track | Havas: .knob-arrange
  var trackSelectors = ['.isiLineNoArrows', '#track', '.mCSB_draggerRail', '.os-scrollbar-track', '.knob-arrange']
  for (var k = 0; k < trackSelectors.length; k++) {
    var trackSel = trackSelectors[k]
    if (!config.scrollerTrackColor) {
      var tc = getValue(trackSel, 'background-color', css) || getValue(trackSel, 'background', css)
      if (tc && !/url\(|none|transparent/i.test(tc)) { config.scrollerTrackColor = tc; config.scrollerTrackSelector = trackSel }
    }
    if (!config.scrollerTrackWidth) {
      var tw = getValue(trackSel, 'width', css)
      if (tw) config.scrollerTrackWidth = parseInt(tw)
    }
  }

  // Also check webkit-scrollbar pseudo-elements (some agencies use native scrollbar styling)
  var webkitThumbColor = getValue('::-webkit-scrollbar-thumb', 'background-color', css) || getValue('::-webkit-scrollbar-thumb', 'background', css)
  if (webkitThumbColor && !config.scrollerColor && !/url\(|none|transparent/i.test(webkitThumbColor)) {
    config.scrollerColor = webkitThumbColor
    config.scrollerThumbSelector = '::-webkit-scrollbar-thumb'
  }
  var webkitTrackColor = getValue('::-webkit-scrollbar-track', 'background-color', css) || getValue('::-webkit-scrollbar-track', 'background', css)
  if (webkitTrackColor && !config.scrollerTrackColor && !/url\(|none|transparent/i.test(webkitTrackColor)) {
    config.scrollerTrackColor = webkitTrackColor
  }
  var webkitWidth = getValue('::-webkit-scrollbar', 'width', css)
  if (webkitWidth && !config.scrollerWidth) {
    config.scrollerWidth = parseInt(webkitWidth)
  }

  // ISI controls positioning (standard pattern)
  var controlsRight = getValue('#isi-controls', 'right', css)
  if (controlsRight) config.isiControlsRight = controlsRight
  var controlsHeight = getValue('#isi-controls', 'height', css)
  if (controlsHeight) config.isiControlsHeight = controlsHeight

  // Scroller container positioning (Havas pattern)
  if (!config.isiControlsRight) {
    var containerRight = getValue('.scroller-container', 'right', css)
    if (containerRight) config.isiControlsRight = containerRight
    var containerTop = getValue('.scroller-container', 'top', css)
    if (containerTop) config.isiControlsTop = containerTop
  }

  return config
}

/**
 * Extract click zones from CSS and JS
 */
function extractClickZones(clicksCss, adJs, clickTags) {
  const zones = []

  // Parse zones from CSS
  const zonePattern = /#(clickTag\d+)\s*\{([^}]+)\}/gi
  let match
  while ((match = zonePattern.exec(clicksCss)) !== null) {
    const id = match[1]
    const props = match[2]

    const zone = {
      id,
      url: clickTags[id.toLowerCase()] || 'https://education.patientpoint.com/failsafe-page/',
      linkType: 'url',
      jobId: '',
      top: 0,
      left: 0,
      width: 100,
      height: 100,
      inISI: false
    }

    // Extract positioning
    const topMatch = props.match(/top:\s*(\d+)/i)
    if (topMatch) zone.top = parseInt(topMatch[1])

    const leftMatch = props.match(/left:\s*(\d+)/i)
    if (leftMatch) zone.left = parseInt(leftMatch[1])

    const widthMatch = props.match(/width:\s*(\d+)/i)
    if (widthMatch) zone.width = parseInt(widthMatch[1])

    const heightMatch = props.match(/height:\s*(\d+)/i)
    if (heightMatch) zone.height = parseInt(heightMatch[1])

    zones.push(zone)
  }

  // Detect link types from ad.js
  zones.forEach(zone => {
    const id = zone.id
    // Check if this zone uses PDF
    if (adJs.includes(`openExternalPDF`) && adJs.includes(`#${id}`)) {
      zone.linkType = 'pdf'
    }
    // Check if this zone opens modal
    if (adJs.includes(`openMod`) && adJs.includes(`#${id}`)) {
      zone.linkType = 'mod'
      // Try to extract job ID
      const modMatch = adJs.match(/openMod\s*\(\s*["'](\d+)["']\s*\)/)
      if (modMatch) zone.jobId = modMatch[1]
    }
  })

  // Check for ISI zones (pi-isi, mg-isi, fda)
  const isiZoneIds = ['pi-isi', 'mg-isi', 'fda']
  isiZoneIds.forEach(isiId => {
    if (adJs.includes(`#${isiId}`)) {
      // Find the URL this zone uses
      let url = 'https://education.patientpoint.com/failsafe-page/'
      let linkType = 'url'

      // Check which clickTag variable it uses
      const handlerMatch = adJs.match(new RegExp(`#${isiId}[^}]*(?:openExternalLinkFull|openExternalPDF)\\s*\\([^,]+,\\s*(clickTag\\d+)`, 'i'))
      if (handlerMatch) {
        url = clickTags[handlerMatch[1].toLowerCase()] || url
      }

      if (adJs.includes(`openExternalPDF`) && adJs.match(new RegExp(`#${isiId}[^}]*openExternalPDF`))) {
        linkType = 'pdf'
      }

      zones.push({
        id: isiId,
        url,
        linkType,
        jobId: '',
        top: 0,
        left: 0,
        width: 100,
        height: 50,
        inISI: true
      })
    }
  })

  return zones
}

/**
 * Extract and map assets from ZIP
 * Returns both auto-mapped assets AND all assets for manual mapping
 */
async function extractAssets(zip, files, html, features) {
  const assets = {}
  const allAssets = []
  const warnings = []

  // Find all image/video files (including SVG for display)
  const assetFiles = files.filter(f =>
    /\.(png|jpg|jpeg|gif|webp|mp4|svg)$/i.test(f) && !zip.files[f].dir
  )

  // Convert all to data URLs and build allAssets array
  const assetDataUrls = {}
  for (const path of assetFiles) {
    try {
      const data = await zip.file(path).async('base64')
      const ext = path.split('.').pop().toLowerCase()
      const filename = path.split('/').pop()

      let mime
      if (ext === 'mp4') mime = 'video/mp4'
      else if (ext === 'svg') mime = 'image/svg+xml'
      else if (ext === 'gif') mime = 'image/gif'
      else mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`

      const dataUrl = `data:${mime};base64,${data}`
      assetDataUrls[filename] = dataUrl

      // Determine likely purpose based on filename
      let suggestedSlot = 'unknown'
      let isSvg = ext === 'svg'

      if (/background|^bg\./i.test(filename)) suggestedSlot = 'background'
      else if (/isi.*\d{3,}x\d{3,}/i.test(filename)) suggestedSlot = 'isiImage' // ISI with dimensions like 547x4465
      else if (/isi|safety/i.test(filename) && !/_title|_mg|_pi|expand|collapse|bar/i.test(filename)) suggestedSlot = 'isiImage'
      else if (/frame\d/i.test(filename)) suggestedSlot = 'frame'
      else if (/\.mp4$/i.test(filename)) suggestedSlot = 'video'
      else if (/logo|merck|brand/i.test(filename)) suggestedSlot = 'logo'
      else if (/cta|button/i.test(filename)) suggestedSlot = 'cta'
      else if (/footer/i.test(filename)) suggestedSlot = 'footer'
      else if (/timer|clock|countdown/i.test(filename)) suggestedSlot = 'timer'
      else if (/title|header/i.test(filename)) suggestedSlot = 'title'

      allAssets.push({
        filename,
        path,
        dataUrl,
        type: ext,
        isSvg,
        suggestedSlot,
        mapped: false
      })
    } catch (e) {
      warnings.push({ level: 'warn', message: `Could not read asset: ${path}` })
    }
  }

  const filenames = Object.keys(assetDataUrls)

  // Map to asset slots using heuristics (best-effort auto-mapping)
  // Background - look for background, bg, main (exclude SVG)
  // Also look for frame*bg patterns which are often background elements
  const bgFile = filenames.find(f =>
    (/background|^bg\.|_bg\.|main_bg/i.test(f) ||
     /frame\d*bg|bg_?\d*\./i.test(f)) &&
    !/\.svg$/i.test(f)
  )
  if (bgFile) {
    assets.background = { dataUrl: assetDataUrls[bgFile], name: bgFile }
    const asset = allAssets.find(a => a.filename === bgFile)
    if (asset) asset.mapped = true
  }

  // ISI image - look for ISI with large dimensions (the main scrolling content)
  const isiFile = filenames.find(f =>
    /isi.*\d{3,}x\d{3,}/i.test(f) && !/\.svg$/i.test(f)
  ) || filenames.find(f =>
    /isi|safety/i.test(f) && !/\.svg$/i.test(f) && !/_title|_mg|_pi/i.test(f)
  )
  if (isiFile && features.hasISI) {
    assets.isiImage = { dataUrl: assetDataUrls[isiFile], name: isiFile }
    const asset = allAssets.find(a => a.filename === isiFile)
    if (asset) asset.mapped = true
  }

  // Video
  const videoFile = filenames.find(f => /\.mp4$/i.test(f))
  if (videoFile && features.hasVideo) {
    assets.video = { dataUrl: assetDataUrls[videoFile], name: videoFile }
    const asset = allAssets.find(a => a.filename === videoFile)
    if (asset) asset.mapped = true
  }

  // Animation frames (only if named with simple frame pattern AND not SVG)
  const frameFiles = filenames
    .filter(f => /^frame\d+\.(png|jpg|jpeg|gif)$/i.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.match(/frame(\d+)/i)?.[1] || '0')
      const numB = parseInt(b.match(/frame(\d+)/i)?.[1] || '0')
      return numA - numB
    })

  if (frameFiles.length > 0) {
    assets.frames = frameFiles.map(f => {
      const asset = allAssets.find(a => a.filename === f)
      if (asset) asset.mapped = true
      return { dataUrl: assetDataUrls[f], name: f }
    })
  }

  // Count unmapped and SVG assets
  const unmappedCount = allAssets.filter(a => !a.mapped).length
  const svgCount = allAssets.filter(a => a.isSvg).length

  if (unmappedCount > 0) {
    warnings.push({
      level: 'info',
      message: `${unmappedCount} asset(s) need manual mapping - see Assets section below`
    })
  }

  if (svgCount > 0) {
    warnings.push({
      level: 'warn',
      message: `${svgCount} SVG file(s) found - SVGs may not work on all devices (hit or miss)`
    })
  }

  return { assets, allAssets, warnings }
}

/**
 * Check for compatibility issues
 */
function checkCompatibility(html, adJs, brand, otherJsCode) {
  const warnings = []
  var allJs = (adJs || '') + '\n' + (otherJsCode || '')

  // SVG detection
  if (html.includes('<svg') || html.includes('.svg')) {
    warnings.push({ level: 'error', message: 'SVG elements detected - devices do not support SVG' })
  }

  // Modern JS features
  if (allJs.includes('fetch(') || allJs.includes('async ') || allJs.includes('=>')) {
    warnings.push({ level: 'error', message: 'Modern JS features detected (fetch/async/arrow functions) - may not work on Chrome 69' })
  }

  // ES6+ features
  if (allJs.includes('const ') || allJs.includes('let ')) {
    warnings.push({ level: 'warn', message: 'ES6 variable declarations (const/let) detected - consider using var' })
  }

  // AppHost integration
  if (!html.includes('appHost') && !allJs.includes('appHost')) {
    warnings.push({ level: 'warn', message: 'AppHost integration not detected - device features may not work' })
  }

  // Template literals
  if (allJs.includes('`')) {
    warnings.push({ level: 'warn', message: 'Template literals detected - may not work on older browsers' })
  }

  // Check for custom scrolling implementations (must be removed)
  const scrollIssues = detectScrollImplementations(html, adJs)
  if (scrollIssues.length > 0) {
    scrollIssues.forEach(issue => {
      warnings.push(issue)
    })
  }

  // Check for proper animation wrapper (CP requirement)
  var allCode = html + '\n' + allJs
  const hasOnWallboardIdle = allCode.includes('onWallboardIdleSlideDisplay')
  const hasCreateAnimation = allCode.includes('createAnimation')
  const hasGsapTimeline = allCode.includes('gsap.timeline')
  const hasTweenMax = allCode.includes('TweenMax') || allCode.includes('TimelineMax')
  const hasGwdTimeline = html.includes('gwd.') || html.includes('gwd-')

  if (hasGwdTimeline) {
    warnings.push({
      level: 'error',
      message: 'GWD timeline animations detected - these must be rebuilt using the Animation Editor'
    })
  }

  // Only CP ads need the onWallboardIdleSlideDisplay wrapper - MR ads play animations directly
  if ((hasGsapTimeline || hasTweenMax) && !hasOnWallboardIdle && brand === 'cp') {
    warnings.push({
      level: 'warn',
      message: 'Animation code found but missing onWallboardIdleSlideDisplay wrapper - animations may not play on CP devices'
    })
  }

  // Note: We preserve existing animations as-is, no need to suggest rebuilding

  return warnings
}

/**
 * Detect which animation library is used (for informational purposes)
 * Animations are preserved as-is in refactored export - no parsing/rebuilding needed
 */
function detectAnimationLibrary(html, adJs, otherJsCode) {
  const allCode = html + '\n' + (adJs || '') + '\n' + (otherJsCode || '')

  // Check for GSAP 3.x (modern syntax)
  if (/gsap\s*\.\s*timeline/i.test(allCode) || /gsap\s*\.\s*to/i.test(allCode) || /gsap\s*\.\s*from/i.test(allCode)) {
    return { name: 'GSAP 3.x', type: 'gsap3' }
  }

  // Check for TweenMax/TimelineMax (GSAP 2.x)
  if (/TimelineMax|TweenMax/i.test(allCode)) {
    return { name: 'TweenMax (GSAP 2.x)', type: 'tweenmax' }
  }

  // Check for TweenLite/TimelineLite
  if (/TweenLite|TimelineLite/i.test(allCode)) {
    return { name: 'TweenLite (GSAP 2.x)', type: 'tweenlite' }
  }

  // Check for GWD animations
  if (/gwd\s*\.\s*|gwd-/i.test(allCode) && /timeline|animation/i.test(allCode)) {
    return { name: 'Google Web Designer', type: 'gwd' }
  }

  // Check for CSS animations
  if (/@keyframes/i.test(allCode)) {
    return { name: 'CSS Animations', type: 'css' }
  }

  return null
}

/**
 * Extract animation data from HTML/JS if possible (for Animation Editor import)
 * Note: For refactor mode, animations are preserved as-is - this is only used for full editor import
 */
/**
 * Extract animations from all GreenSock variants (GSAP 3.x, TweenMax, TweenLite, TimelineMax)
 */
export function extractAnimationInfo(html, adJs = '') {
  const animations = []
  const allCode = html + '\n' + (adJs || '')

  // Track timeline labels for calculating start times
  const labels = {}
  let currentTime = 0

  // Extract timeline labels first
  const labelPattern = /\.addLabel\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*['"]?([^'")\s]+)['"]?)?\s*\)/gi
  let labelMatch
  while ((labelMatch = labelPattern.exec(allCode)) !== null) {
    const labelName = labelMatch[1]
    const offset = labelMatch[2] || '0'

    let timeOffset = 0
    if (offset.startsWith('+=')) {
      timeOffset = parseFloat(offset.substring(2)) || 0
    } else if (offset.startsWith('-=')) {
      timeOffset = -(parseFloat(offset.substring(2)) || 0)
    } else if (!isNaN(parseFloat(offset))) {
      timeOffset = parseFloat(offset)
    }

    currentTime += timeOffset
    labels[labelName] = currentTime
  }

  // Pattern 1: GSAP 3.x syntax - tl.to('.selector', { duration: 0.5, opacity: 1 }, 'label')
  // Also matches gsap.to()
  const gsap3Pattern = /(?:tl|gsap|timeline)\s*\.\s*(to|from|fromTo|set)\s*\(\s*['"]([^'"]+)['"]\s*,\s*\{([^}]+)\}(?:\s*,\s*['"]?([^'")\s,]+)['"]?)?\s*\)/gi

  let match
  while ((match = gsap3Pattern.exec(allCode)) !== null) {
    const method = match[1] // to, from, fromTo, set
    const target = match[2] // selector
    const propsStr = match[3]
    const position = match[4] // label name or time

    const anim = parseGSAPProps(propsStr, target, method, position, labels)
    if (anim) {
      animations.push(anim)
    }
  }

  // Pattern 2: TweenMax/TweenLite 2.x syntax - TweenMax.to('#element', duration, { props })
  const tweenMaxPattern = /(?:TweenMax|TweenLite|gsap)\s*\.\s*(to|from|fromTo|set)\s*\(\s*['"]([^'"]+)['"]\s*,\s*([\d.]+)\s*,\s*\{([^}]+)\}\s*\)/gi

  while ((match = tweenMaxPattern.exec(allCode)) !== null) {
    const method = match[1]
    const target = match[2]
    const duration = parseFloat(match[3])
    const propsStr = match[4]

    const anim = parseTweenMaxProps(propsStr, target, method, duration)
    if (anim) {
      animations.push(anim)
    }
  }

  // Pattern 3: Timeline method syntax (GSAP 2.x) - tl.to('#element', duration, { props }, position)
  const timelinePattern = /tl\s*\.\s*(to|from|fromTo|set)\s*\(\s*['"]([^'"]+)['"]\s*,\s*([\d.]+)\s*,\s*\{([^}]+)\}(?:\s*,\s*['"]?([^'")\s]+)['"]?)?\s*\)/gi

  while ((match = timelinePattern.exec(allCode)) !== null) {
    const method = match[1]
    const target = match[2]
    const duration = parseFloat(match[3])
    const propsStr = match[4]
    const position = match[5]

    const anim = parseTweenMaxProps(propsStr, target, method, duration, position, labels)
    if (anim) {
      animations.push(anim)
    }
  }

  // Remove duplicates (same target + similar timing)
  const uniqueAnimations = []
  const seen = new Set()
  for (const anim of animations) {
    const key = `${anim.target}-${anim.startTime.toFixed(2)}-${anim.type}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueAnimations.push(anim)
    }
  }

  // Sort by start time
  uniqueAnimations.sort((a, b) => a.startTime - b.startTime)

  return uniqueAnimations
}

/**
 * Parse GSAP 3.x style properties (duration inside vars object)
 */
function parseGSAPProps(propsStr, target, method, position, labels) {
  const effects = {}

  // Extract duration from inside the vars
  const durationMatch = propsStr.match(/duration\s*:\s*([\d.]+)/)
  const duration = durationMatch ? parseFloat(durationMatch[1]) : 0.5

  // Parse common effects
  parseEffectsFromString(propsStr, effects)

  // Extract easing - GSAP 3.x uses lowercase like 'power2.out'
  const easeMatch = propsStr.match(/ease\s*:\s*['"]?([^'",}]+)['"]?/)
  let easing = easeMatch ? easeMatch[1].trim() : 'power1.out'

  // Convert GSAP 3.x easing to TweenMax format for consistency
  easing = convertEasingToTweenMax(easing)

  // Calculate start time from position
  let startTime = 0
  if (position) {
    if (labels[position] !== undefined) {
      startTime = labels[position]
    } else if (position.startsWith('+=')) {
      startTime = parseFloat(position.substring(2)) || 0
    } else if (position.startsWith('-=')) {
      startTime = -(parseFloat(position.substring(2)) || 0)
    } else if (!isNaN(parseFloat(position))) {
      startTime = parseFloat(position)
    }
  }

  // Determine animation type
  let type = method === 'from' ? 'in' : 'in'
  if (effects.autoAlpha !== undefined && effects.autoAlpha.to === 0) {
    type = 'out'
  } else if (effects.opacity !== undefined && effects.opacity.to === 0) {
    type = 'out'
  }
  if (method === 'set') {
    type = 'set'
  }

  // Clean up target (remove . or # prefix for our internal format)
  const cleanTarget = target.replace(/^[.#]/, '')

  return {
    target: cleanTarget,
    originalSelector: target,
    type,
    effects,
    duration,
    startTime,
    easing,
    gsapVersion: '3.x'
  }
}

/**
 * Parse TweenMax/GSAP 2.x style properties (duration as separate param)
 */
function parseTweenMaxProps(propsStr, target, method, duration, position, labels = {}) {
  const effects = {}

  // Parse common effects
  parseEffectsFromString(propsStr, effects)

  // Extract easing
  const easeMatch = propsStr.match(/ease\s*:\s*([^,}]+)/)
  let easing = easeMatch ? easeMatch[1].trim() : 'Power1.easeOut'

  // Calculate start time
  let startTime = 0
  if (position) {
    if (labels[position] !== undefined) {
      startTime = labels[position]
    } else if (position.startsWith('+=')) {
      startTime = parseFloat(position.substring(2)) || 0
    } else if (position.startsWith('-=')) {
      startTime = -(parseFloat(position.substring(2)) || 0)
    } else if (!isNaN(parseFloat(position))) {
      startTime = parseFloat(position)
    }
  }

  // Determine animation type
  let type = method === 'from' ? 'in' : 'in'
  if (effects.autoAlpha !== undefined && effects.autoAlpha.to === 0) {
    type = 'out'
  } else if (effects.opacity !== undefined && effects.opacity.to === 0) {
    type = 'out'
  }
  if (method === 'set') {
    type = 'set'
  }

  // Clean up target
  const cleanTarget = target.replace(/^[.#]/, '')

  return {
    target: cleanTarget,
    originalSelector: target,
    type,
    effects,
    duration,
    startTime,
    easing,
    gsapVersion: '2.x'
  }
}

/**
 * Parse effect properties from a vars string
 */
function parseEffectsFromString(propsStr, effects) {
  // autoAlpha
  const autoAlphaMatch = propsStr.match(/autoAlpha\s*:\s*([\d.]+)/)
  if (autoAlphaMatch) {
    effects.autoAlpha = { to: parseFloat(autoAlphaMatch[1]) }
  }

  // opacity
  const opacityMatch = propsStr.match(/opacity\s*:\s*([\d.]+)/)
  if (opacityMatch) {
    effects.opacity = { to: parseFloat(opacityMatch[1]) }
  }

  // x position
  const xMatch = propsStr.match(/\bx\s*:\s*(-?[\d.]+)/)
  if (xMatch) {
    effects.x = { to: parseFloat(xMatch[1]) }
  }

  // y position
  const yMatch = propsStr.match(/\by\s*:\s*(-?[\d.]+)/)
  if (yMatch) {
    effects.y = { to: parseFloat(yMatch[1]) }
  }

  // scale
  const scaleMatch = propsStr.match(/scale\s*:\s*([\d.]+)/)
  if (scaleMatch) {
    effects.scale = { to: parseFloat(scaleMatch[1]) }
  }

  // scaleX
  const scaleXMatch = propsStr.match(/scaleX\s*:\s*([\d.]+)/)
  if (scaleXMatch) {
    effects.scaleX = { to: parseFloat(scaleXMatch[1]) }
  }

  // scaleY
  const scaleYMatch = propsStr.match(/scaleY\s*:\s*([\d.]+)/)
  if (scaleYMatch) {
    effects.scaleY = { to: parseFloat(scaleYMatch[1]) }
  }

  // rotation
  const rotationMatch = propsStr.match(/rotation\s*:\s*(-?[\d.]+)/)
  if (rotationMatch) {
    effects.rotation = { to: parseFloat(rotationMatch[1]) }
  }

  // height
  const heightMatch = propsStr.match(/height\s*:\s*(-?[\d.]+)/)
  if (heightMatch) {
    effects.height = { to: parseFloat(heightMatch[1]) }
  }

  // width
  const widthMatch = propsStr.match(/width\s*:\s*(-?[\d.]+)/)
  if (widthMatch) {
    effects.width = { to: parseFloat(widthMatch[1]) }
  }

  // left
  const leftMatch = propsStr.match(/left\s*:\s*(-?[\d.]+)/)
  if (leftMatch) {
    effects.left = { to: parseFloat(leftMatch[1]) }
  }

  // top
  const topMatch = propsStr.match(/top\s*:\s*(-?[\d.]+)/)
  if (topMatch) {
    effects.top = { to: parseFloat(topMatch[1]) }
  }
}

/**
 * Convert GSAP 3.x easing names to TweenMax format
 */
function convertEasingToTweenMax(easing) {
  // GSAP 3.x uses lowercase: 'power2.out', 'power2.inOut'
  // TweenMax uses: 'Power2.easeOut', 'Power2.easeInOut'

  const easingMap = {
    'power1.out': 'Power1.easeOut',
    'power1.in': 'Power1.easeIn',
    'power1.inout': 'Power1.easeInOut',
    'power2.out': 'Power2.easeOut',
    'power2.in': 'Power2.easeIn',
    'power2.inout': 'Power2.easeInOut',
    'power3.out': 'Power3.easeOut',
    'power3.in': 'Power3.easeIn',
    'power3.inout': 'Power3.easeInOut',
    'power4.out': 'Power4.easeOut',
    'power4.in': 'Power4.easeIn',
    'power4.inout': 'Power4.easeInOut',
    'back.out': 'Back.easeOut',
    'back.in': 'Back.easeIn',
    'back.inout': 'Back.easeInOut',
    'elastic.out': 'Elastic.easeOut',
    'elastic.in': 'Elastic.easeIn',
    'elastic.inout': 'Elastic.easeInOut',
    'bounce.out': 'Bounce.easeOut',
    'bounce.in': 'Bounce.easeIn',
    'bounce.inout': 'Bounce.easeInOut',
    'circ.out': 'Circ.easeOut',
    'circ.in': 'Circ.easeIn',
    'circ.inout': 'Circ.easeInOut',
    'expo.out': 'Expo.easeOut',
    'expo.in': 'Expo.easeIn',
    'expo.inout': 'Expo.easeInOut',
    'sine': 'Sine.easeOut',
    'sine.out': 'Sine.easeOut',
    'sine.in': 'Sine.easeIn',
    'sine.inout': 'Sine.easeInOut',
    'none': 'Linear.easeNone',
    'linear': 'Linear.easeNone'
  }

  // Also handle bare class references like Sine.ease → Sine.easeOut
  var bareEaseMatch = easing.match(/^(Sine|Power[0-4]|Back|Elastic|Bounce|Circ|Expo|Linear)\.ease$/i)
  if (bareEaseMatch) {
    var name = bareEaseMatch[1].charAt(0).toUpperCase() + bareEaseMatch[1].slice(1).toLowerCase()
    if (name.match(/^Power\d$/)) name = 'Power' + name.charAt(5)
    return name + '.easeOut'
  }

  const lower = easing.toLowerCase().replace(/\s/g, '')
  return easingMap[lower] || easing
}

/**
 * Parse HTML to extract scene structure and asset relationships
 * Returns scenes with their contained assets and animation info
 */
function parseSceneStructure(html, adJs) {
  const scenes = []
  const assetUsage = {} // Maps filename to where it's used

  // Find all img tags and their context
  const imgPattern = /<(?:img|image)[^>]*(?:src|source)=["']([^"']+)["'][^>]*>/gi
  let imgMatch

  while ((imgMatch = imgPattern.exec(html)) !== null) {
    const src = imgMatch[1]
    const filename = src.split('/').pop()
    const fullMatch = imgMatch[0]
    const position = imgMatch.index

    // Find the containing elements by looking backwards in HTML
    const htmlBefore = html.substring(0, position)

    // Find parent containers (look for class or id attributes)
    const containerPatterns = [
      // Common frame/scene container patterns
      /class=["'][^"']*\b(frame\d*|unoFrame|dosFrame|tresFrame|cuatroFrame|cincoFrame|seisFrame|scene\d*|slide\d*)\b[^"']*["']/gi,
      /id=["']([^"']+Frame|frame\d+|scene\d+|slide\d+)["']/gi,
      // Element-level containers
      /class=["'][^"']*\b(back_?\d*|copy_?\d*|icon_?\d*|logo|cta|button|header|footer|title|bg)\b[^"']*["']/gi
    ]

    let parentScene = null
    let parentElement = null

    // Search backwards for containing elements
    for (const pattern of containerPatterns) {
      pattern.lastIndex = 0
      let containerMatch
      let lastMatch = null

      while ((containerMatch = pattern.exec(htmlBefore)) !== null) {
        lastMatch = containerMatch
      }

      if (lastMatch) {
        const containerName = lastMatch[1]
        if (/frame|scene|slide|uno|dos|tres|cuatro|cinco|seis/i.test(containerName)) {
          parentScene = containerName
        } else {
          parentElement = containerName
        }
      }
    }

    assetUsage[filename] = {
      filename,
      src,
      scene: parentScene,
      element: parentElement,
      context: parentElement || parentScene || 'unknown'
    }
  }

  // Now extract animation timeline to get scene timing
  const timeline = extractTimelineInfo(adJs)

  // Group assets by scene
  const sceneGroups = {}
  Object.values(assetUsage).forEach(asset => {
    const sceneName = asset.scene || 'ungrouped'
    if (!sceneGroups[sceneName]) {
      sceneGroups[sceneName] = {
        name: sceneName,
        assets: [],
        timing: null
      }
    }
    sceneGroups[sceneName].assets.push(asset)
  })

  // Match timeline labels to scenes
  timeline.labels.forEach(label => {
    const matchingScene = Object.keys(sceneGroups).find(scene =>
      scene.toLowerCase().includes(label.name.toLowerCase()) ||
      label.name.toLowerCase().includes(scene.toLowerCase().replace('frame', ''))
    )
    if (matchingScene && sceneGroups[matchingScene]) {
      sceneGroups[matchingScene].timing = {
        label: label.name,
        startTime: label.time,
        offset: label.offset
      }
    }
  })

  // Convert to array and sort by timing
  const sortedScenes = Object.values(sceneGroups)
    .sort((a, b) => {
      if (a.timing && b.timing) return (a.timing.startTime || 0) - (b.timing.startTime || 0)
      if (a.timing) return -1
      if (b.timing) return 1
      return 0
    })

  return {
    scenes: sortedScenes,
    assetUsage,
    timeline
  }
}

/**
 * Extract timeline labels and timing from GSAP code
 */
function extractTimelineInfo(adJs) {
  const labels = []
  const tweens = []

  // Find timeline labels: tl.addLabel('labelName') or tl.addLabel('labelName', '+=3')
  const labelPattern = /\.addLabel\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*['"]?([^'")\s]+)['"]?)?\s*\)/gi
  let labelMatch
  let currentTime = 0

  while ((labelMatch = labelPattern.exec(adJs)) !== null) {
    const name = labelMatch[1]
    const offset = labelMatch[2] || '0'

    // Parse offset (could be "+=3", "-=1", or just a number)
    let timeOffset = 0
    if (offset.startsWith('+=')) {
      timeOffset = parseFloat(offset.substring(2)) || 0
    } else if (offset.startsWith('-=')) {
      timeOffset = -(parseFloat(offset.substring(2)) || 0)
    } else {
      timeOffset = parseFloat(offset) || 0
    }

    currentTime += timeOffset

    labels.push({
      name,
      offset,
      time: currentTime
    })
  }

  // Find tweens: tl.to('.selector', { duration: X, ... }, 'label')
  const tweenPattern = /\.(?:to|from|fromTo)\s*\(\s*['"]([^'"]+)['"][^)]+duration\s*:\s*([\d.]+)/gi
  let tweenMatch

  while ((tweenMatch = tweenPattern.exec(adJs)) !== null) {
    tweens.push({
      target: tweenMatch[1],
      duration: parseFloat(tweenMatch[2]) || 0
    })
  }

  // Calculate total duration estimate
  const totalDuration = labels.length > 0
    ? Math.max(...labels.map(l => l.time)) + 2 // Add buffer for last animations
    : tweens.reduce((sum, t) => sum + t.duration, 0)

  return {
    labels,
    tweens,
    totalDuration,
    labelCount: labels.length,
    tweenCount: tweens.length
  }
}

/**
 * Analyze animation in the ad (informational only)
 * Animations are preserved as-is in refactored export - no rebuilding needed
 */
function analyzeAnimations(html, adJs, mainJs, otherJsCode) {
  const allCode = html + '\n' + adJs + '\n' + (mainJs || '') + '\n' + (otherJsCode || '')

  const analysis = {
    hasAnimations: false,
    type: 'none',
    libraryUsed: null,
    details: [],
    recommendation: 'Animations will be preserved as-is in the refactored export'
  }

  // Check for GSAP 3.x (modern syntax) — must be actual calls, not just script tag references
  const gsap3Calls = /gsap\s*\.\s*(?:timeline|to|from|set|fromTo)\s*\(/i.test(allCode)
  if (gsap3Calls) {
    analysis.hasAnimations = true
    analysis.type = 'gsap3'
    analysis.libraryUsed = 'GSAP 3.x'
    analysis.details.push('Uses GSAP 3.x timeline/tween syntax')
  }

  // Check for TweenMax/TimelineMax (GSAP 2.x) — must be actual calls, not just script tag src
  const tweenMaxCalls = /(?:TweenMax|TimelineMax)\s*[.(]/i.test(allCode) ||
                        /new\s+TimelineMax/i.test(allCode)
  if (tweenMaxCalls) {
    analysis.hasAnimations = true
    analysis.type = 'tweenmax'
    analysis.libraryUsed = 'TweenMax/TimelineMax'
    analysis.details.push('Uses GreenSock TweenMax/TimelineMax')
  }

  // Check for TweenLite/TimelineLite — must be actual calls
  const tweenLiteCalls = /(?:TweenLite|TimelineLite)\s*[.(]/i.test(allCode) ||
                         /new\s+TimelineLite/i.test(allCode)
  if (tweenLiteCalls) {
    analysis.hasAnimations = true
    analysis.type = 'tweenlite'
    analysis.libraryUsed = 'TweenLite/TimelineLite'
    analysis.details.push('Uses GreenSock TweenLite/TimelineLite')
  }

  // Determine if animation is real ad animation vs UI-only (expand/collapse/click)
  if (analysis.hasAnimations && analysis.type !== 'gwd' && analysis.type !== 'css') {
    // Look for tween calls - collect the function contexts they appear in
    const tweenCallPattern = /(?:TweenMax|TimelineMax|TweenLite|TimelineLite|gsap)\s*\.\s*(?:to|from|set|fromTo|timeline)\s*\(/gi
    const tweenCalls = allCode.match(tweenCallPattern) || []
    const newTimelinePattern = /new\s+(?:TimelineMax|TimelineLite)\s*\(/gi
    const newTimelines = allCode.match(newTimelinePattern) || []
    const totalCalls = tweenCalls.length + newTimelines.length

    if (totalCalls > 0) {
      // Check if tween calls only appear inside UI interaction functions
      // UI functions: toggleExpansion, expandISI, collapseISI, onClick, click handler, toggle, expand, collapse
      const uiContextPattern = /function\s+(?:toggle|expand|collapse|onClick|handleClick|ISI_toggle|toggleISI|expandISI|collapseISI)\s*\([^)]*\)\s*\{[^}]*(?:TweenMax|TimelineMax|TweenLite|TimelineLite|gsap)\s*\./gi
      const clickHandlerPattern = /(?:addEventListener\s*\(\s*["']click["']|\.click\s*\(|\.on\s*\(\s*["']click["'])\s*[^}]*(?:TweenMax|TimelineMax|TweenLite|TimelineLite|gsap)\s*\./gi

      const uiMatches = (allCode.match(uiContextPattern) || []).length +
                        (allCode.match(clickHandlerPattern) || []).length

      // Check for ad-level animation contexts
      const adAnimContextPattern = /function\s+(?:onWallboardIdleSlideDisplay|startAnimation|initAnimation|animate|playAnimation|init)\s*\([^)]*\)\s*\{[^}]*(?:TweenMax|TimelineMax|TweenLite|TimelineLite|gsap)\s*\./gi
      const topLevelTimeline = /(?:^|\n)\s*var\s+\w*[Tt]l\w*\s*=\s*new\s+(?:TimelineMax|TimelineLite)/m.test(allCode)
      const documentReady = /\$\s*\(\s*(?:document|function)\s*\)[^}]*(?:TweenMax|TimelineMax|gsap)\s*\.\s*(?:to|from|set)/gi

      const adMatches = (allCode.match(adAnimContextPattern) || []).length +
                        (allCode.match(documentReady) || []).length +
                        (topLevelTimeline ? 1 : 0)

      if (uiMatches > 0 && adMatches === 0) {
        // All tween calls are inside UI interaction functions only
        analysis.isUIOnly = true
        analysis.details.push('Animation is UI-only (expand/collapse/click transitions) — not ad content animation')
        analysis.recommendation = 'TweenMax is used only for UI interactions (ISI expand/collapse, button transitions). No ad-level animation sequence exists. No animation rebuild needed.'
      } else if (adMatches > 0 && uiMatches > 0) {
        analysis.details.push('Has both ad animation and UI transition animations')
      }
    }
  }

  // Check for GWD animations
  if (/gwd\s*\.\s*|gwd-/i.test(allCode) && /timeline|animation/i.test(allCode)) {
    analysis.hasAnimations = true
    analysis.type = 'gwd'
    analysis.libraryUsed = 'Google Web Designer'
    analysis.details.push('Uses GWD animation runtime')
  }

  // Check for CSS animations
  if (/@keyframes/i.test(allCode)) {
    analysis.hasAnimations = true
    if (!analysis.libraryUsed) {
      analysis.type = 'css'
      analysis.libraryUsed = 'CSS Animations'
    }
    analysis.details.push('Contains CSS @keyframes')
  }

  // Count timeline labels (scenes/frames) and detect complex timeline patterns
  if (analysis.hasAnimations) {
    const labelCount = (allCode.match(/\.addLabel\s*\(/gi) || []).length
    const labelRefCount = (allCode.match(/,\s*['"][a-zA-Z]\w*['"]\s*\)/gi) || []).length  // .to(sel, props, 'label')
    const delayedCallCount = (allCode.match(/delayedCall\s*\(/gi) || []).length
    const hasRelativePositions = /['"][\+\-]=[\d.]+['"]/i.test(allCode)  // '+=3' style offsets

    if (labelCount > 0) {
      analysis.details.push(`${labelCount} timeline label(s) detected`)
    }
    // Flag complex timeline patterns that should be linearized
    analysis.hasComplexTimeline = labelCount >= 2 || (delayedCallCount >= 3) || hasRelativePositions
    if (analysis.hasComplexTimeline) {
      analysis.timelineComplexity = {
        labels: labelCount,
        labelReferences: labelRefCount,
        delayedCalls: delayedCallCount,
        hasRelativePositions: hasRelativePositions
      }
      analysis.details.push('Complex timeline structure — recommend linearizing for maintainability')
    }

    // GWD animations require complete rebuild — the GWD runtime was removed
    if (analysis.type === 'gwd') {
      analysis.recommendation = 'GWD animation runtime has been removed. Animations MUST be completely rebuilt using TweenMax 2.0.1 TimelineMax syntax. The original GSAP 3.x CDN script must also be replaced with local TweenMax 2.0.1.'
      analysis.complexity = 'high'
      analysis.canAutoExtract = false
    }
    // GSAP 3.x needs conversion to TweenMax 2.0.1
    else if (analysis.type === 'gsap3') {
      analysis.recommendation = 'GSAP 3.x detected — must be converted to TweenMax 2.0.1 syntax (gsap.to() → TweenMax.to(), gsap.timeline() → new TimelineMax()). CDN script must be replaced with local TweenMax 2.0.1 file.'
      analysis.complexity = 'high'
    }
    // TweenMax/TweenLite already work on devices
    else if (analysis.type === 'tweenmax' || analysis.type === 'tweenlite') {
      analysis.recommendation = 'GreenSock animations work on devices - code will be preserved as-is'
    }
  }

  return analysis
}

/**
 * Build list of manual tasks the user must complete
 */
function buildManualTasksList(result, html, adJs) {
  const tasks = []
  var isFocusPlatform = result.adPlatform === 'focus'

  // Focus ads only need: Enabler removal + click conversion — skip all IXR tasks
  if (isFocusPlatform) {
    if (result.features?.hasEnabler) {
      tasks.push({
        id: 'remove-enabler-focus',
        priority: 'high',
        title: 'Remove Enabler.js Loading Delay',
        description: 'This ad uses Enabler.js with an initialization delay. Remove the Enabler script, its DOMContentLoaded/isInitialized checks, and let the ad render immediately.',
        action: '1) Remove Enabler.js <script> tag, 2) Remove Enabler.addEventListener and isInitialized checks, 3) Remove any WebComponentsReady or DOMContentLoaded wrappers that gate ad display'
      })
    }
    if (!result.detectedUrls || result.detectedUrls.length === 0) {
      tasks.push({
        id: 'add-focus-clicks',
        priority: 'high',
        title: 'Add Focus Click Handlers',
        description: 'No click URLs were auto-detected. Add inline click handlers with getParameterByName fallback.',
        action: 'Identify clickable elements, add var clickTag1/2/3 declarations with URLs, add getParameterByName function, add addEventListener handlers before </body>'
      })
    }
    return tasks
  }

  // Check for unmapped assets
  const unmappedAssets = result.allAssets?.filter(a => !a.mapped) || []
  if (unmappedAssets.length > 0) {
    tasks.push({
      id: 'map-assets',
      priority: 'high',
      title: 'Map Assets to Slots',
      description: `${unmappedAssets.length} asset(s) need to be manually assigned to template slots (background, frames, etc.)`,
      action: 'Use the Assets panel to drag and drop unmapped assets into the correct slots'
    })
  }

  // Check for GWD ads that require complete manual rebuild
  if (result.isGWD) {
    tasks.push({
      id: 'rebuild-gwd',
      priority: 'critical',
      title: 'MANUAL REBUILD REQUIRED: Google Web Designer Ad',
      description: 'This ad was built with Google Web Designer which uses Web Components. Web Components do NOT work on IXR devices (Chrome 69). The entire ad must be manually rebuilt.',
      action: '1) Extract all visual assets (images, backgrounds), 2) Create simple HTML structure with proper element IDs, 3) Recreate animations using TweenMax/GSAP, 4) Add proper click zones with appHost handlers, 5) Test thoroughly on device'
    })
  }

  // Check for Enabler.js (Google Ad Manager / DoubleClick Studio) ads
  if (result.features?.hasEnabler) {
    tasks.push({
      id: 'rebuild-enabler',
      priority: 'critical',
      title: 'MANUAL REBUILD REQUIRED: Google Ad Manager / DoubleClick Ad',
      description: 'This ad uses Enabler.js (Google Ad Manager/DoubleClick Studio). Enabler.exit() click handlers and studio events do NOT work on IXR devices.',
      action: '1) Remove Enabler.js script, 2) Replace Enabler.exit() calls with appHost.requestFullscreenBrowserView() or appHost.requestPDFView(), 3) Remove studio.events listeners, 4) Add proper click zones with appHost handlers'
    })
  }

  // Check for Creatopy ads (require complete rebuild)
  if (result.features?.hasCreatopy) {
    tasks.push({
      id: 'rebuild-creatopy',
      priority: 'critical',
      title: 'MANUAL REBUILD REQUIRED: Creatopy Ad',
      description: 'This ad was built with Creatopy (formerly Bannersnack). It uses a proprietary animation runtime (creatopyEmbed) with styled-components, custom event system, and setTimeout-based slide orchestration. The code cannot be auto-converted.',
      action: '1) Extract visual assets from the media/ folder (background, frame images), 2) Create standard HTML with positioned elements, 3) Rebuild animations using TweenMax 2.0.1, 4) Replace bsOpenURL/clickTag with standard ad.js click handlers, 5) Add appHost integration'
    })
  }

  // Check for webpack-bundled ads (require complete rebuild)
  if (result.features?.hasWebpackBundle) {
    tasks.push({
      id: 'rebuild-webpack',
      priority: 'critical',
      title: 'MANUAL REBUILD REQUIRED: Webpack-Bundled Ad',
      description: 'This ad was built with a JavaScript bundler (webpack/Vite/Rollup). The bundled code uses ES6+ module syntax and cannot be auto-converted to ES5 or have GSAP calls safely extracted. The ad must be completely rebuilt as a standard HTML/CSS/JS structure.',
      action: '1) Extract visual assets and design intent from the bundled ad, 2) Create standard HTML with positioned elements, 3) Write ES5 animation code using TweenMax 2.0.1, 4) Replace CDN scripts with local files, 5) Add standard ad.js with click handlers and appHost integration'
    })
  }

  // Check for CDN scripts (won't work offline)
  if (result.features?.hasCDNScripts) {
    tasks.push({
      id: 'localize-cdn-scripts',
      priority: 'high',
      title: 'Download CDN Scripts Locally',
      description: 'Found ' + (result.features.cdnScriptCount || 0) + ' script(s) loaded from CDN. CDN scripts will NOT work offline on IXR devices.',
      action: '1) Download each CDN script locally, 2) Update script src paths to local files, 3) Remove any Google Fonts CDN links (localize font files or convert text to images)'
    })
  }

  // Check for live ISI text - we now auto-wrap in structure, but may need manual verification
  // Only show task if auto-wrapping may not have worked (no isi-copy container found)
  if (result.features?.hasLiveISIText && !result.features?.hasStandardISI) {
    // Check if we'll be able to auto-wrap (isi-copy or isi-content exists)
    var hasWrappableContainer = /<div[^>]*(?:id=["']isi-copy["']|class=["'][^"']*isi-content[^"']*["'])[^>]*>/i.test(result.originalFiles?.html || '')

    if (!hasWrappableContainer) {
      tasks.push({
        id: 'wrap-live-isi-manual',
        priority: 'high',
        title: 'Wrap Live ISI Text in Standard Structure',
        description: 'This ad has live HTML ISI text but no standard container was found for auto-wrapping.',
        action: '1) Find the ISI content container in HTML, 2) Wrap content in outerMostDiv/innerMostDiv structure, 3) Add isi-controls sibling div, 4) Verify click handlers work for ISI links'
      })
    } else {
      // Auto-wrapping will work, but add informational task to verify
      tasks.push({
        id: 'verify-live-isi',
        priority: 'low',
        title: 'Verify Live ISI Auto-Wrapping',
        description: 'Live ISI text was auto-wrapped in standard scroller structure. Verify scrolling and click handlers work correctly.',
        action: 'Test ISI scrolling on device, verify any links within ISI text work correctly'
      })
    }
  }

  // Check for SVGs that need replacement
  const svgAssets = result.allAssets?.filter(a => a.isSvg) || []
  if (svgAssets.length > 0) {
    tasks.push({
      id: 'replace-svgs',
      priority: 'medium',
      title: 'Evaluate SVG Assets',
      description: `${svgAssets.length} SVG file(s) found. SVGs are hit-or-miss on devices.`,
      action: 'Test on actual device. If SVGs don\'t render, replace with PNG equivalents'
    })
  }

  // Check for complex animations
  if (result.animationAnalysis?.complexity === 'high' || result.animationAnalysis?.type === 'gwd') {
    tasks.push({
      id: 'rebuild-animation',
      priority: 'high',
      title: 'Rebuild Animations',
      description: result.animationAnalysis.recommendation,
      action: 'Use the Animation Editor to recreate the animation sequence with device-compatible settings'
    })
  } else if (result.animationAnalysis?.hasAnimations && !result.animationAnalysis?.canAutoExtract) {
    tasks.push({
      id: 'review-animation',
      priority: 'medium',
      title: 'Review Animations',
      description: result.animationAnalysis.recommendation,
      action: 'Check Animation Editor and verify timing/effects after import'
    })
  }

  // Check for missing background
  if (!result.assets.background && unmappedAssets.length > 0) {
    tasks.push({
      id: 'set-background',
      priority: 'high',
      title: 'Set Background Image',
      description: 'No background image was auto-detected',
      action: 'Select an image from the unmapped assets to use as background'
    })
  }

  // Check for missing ISI image when ISI is detected
  var hasISI = result.template?.features?.includes('isi') || result.features?.hasISI
  if (hasISI && !result.assets.isiImage) {
    tasks.push({
      id: 'set-isi-image',
      priority: 'high',
      title: 'Set ISI Content Image',
      description: 'ISI container detected but no ISI content image was auto-mapped',
      action: 'Select the ISI content image from unmapped assets'
    })
  }

  // Check for live ISI text that should be converted to image
  var hasLiveISIText = /class=["'][^"']*(?:ssiall|isi-content|isi-copy)[^"']*["']/i.test(html) ||
                       /<ul[^>]*class=["'][^"']*results[^"']*["'][^>]*>/i.test(html)
  var hasISIImage = /(?:isi|safety).*\.(?:png|jpg)/i.test(html) || result.assets?.isiImage

  if (hasISI && hasLiveISIText && !hasISIImage) {
    tasks.push({
      id: 'convert-isi-to-image',
      priority: 'high',
      title: 'Convert ISI Text to Image',
      description: 'Live ISI text detected. For consistent rendering on devices, consider converting ISI to a pre-rendered image.',
      action: 'Screenshot the ISI text, save as PNG, and use as ISI content image. Add click zone overlays for any links in the ISI.'
    })
  }

  // Check for JS-injected ISI (ISIText() function pattern — ISI content is a JS string, not in HTML)
  if (result.features?.hasJSInjectedISI) {
    tasks.push({
      id: 'convert-js-injected-isi',
      priority: 'critical',
      title: 'Replace JS-Injected ISI with ISI Image',
      description: 'This ad uses an ISIText() JavaScript function (typically in isiText.js) that injects ISI content as an HTML string via innerHTML. This entire ISI mechanism — the JS file, its scroll framework, and its CSS — must be removed and replaced with a standard ISI image in the outerMostDiv/innerMostDiv scroller structure.',
      action: '1) Identify the isiText.js (or similar) file and remove its <script> tag, 2) Remove the ISI scroll framework JS (isi.js or similar), 3) Remove all ISI-related CSS injected by the framework, 4) Render the ISI content as a pre-rendered PNG image, 5) Add the ISI image to the standard outerMostDiv/innerMostDiv/isi-controls scroller structure, 6) Wire up any ISI links (Prescribing Information, Medication Guide) as click zones with appHost handlers'
    })
  }

  // Check for ISI that needs restructuring (uses scroll library but not standard structure)
  if (result.features?.isiNeedsRestructure) {
    tasks.push({
      id: 'restructure-isi',
      priority: 'high',
      title: 'Restructure ISI Container',
      description: 'ISI uses a custom scroll library that has been removed. The ISI container needs to be restructured with outerMostDiv/innerMostDiv/isi-controls pattern.',
      action: 'Wrap ISI content in: <div id="outerMostDiv"><div id="innerMostDiv">[content]</div><div id="isi-controls"></div></div>'
    })
  }

  // Check for click zones with no URLs
  if (result.detectedUrls?.length === 0 && result.config.clickZones?.length === 0) {
    tasks.push({
      id: 'configure-clicks',
      priority: 'medium',
      title: 'Configure Click Zones',
      description: 'No click URLs were detected in the ad',
      action: 'Set up click zones and URLs in the Click Zones editor'
    })
  }

  // Check for image maps that need conversion to click zones
  var hasImageMaps = /<map[^>]*name=["'][^"']+["'][^>]*>/i.test(html) && /<area[^>]*>/i.test(html)
  if (hasImageMaps) {
    // Count the number of areas
    var areaMatches = html.match(/<area[^>]*>/gi) || []
    tasks.push({
      id: 'convert-image-maps',
      priority: 'high',
      title: 'Convert Image Maps to Click Zones',
      description: 'Found ' + areaMatches.length + ' image map area(s). HTML image maps (<map>/<area>) do not work reliably on IXR devices.',
      action: '1) Remove <map> and <area> tags, 2) Create positioned div elements with class="invisibleButton" for each click zone, 3) Add click event handlers using appHost.requestFullscreenBrowserView() or appHost.requestPDFView()'
    })
  }

  // Check for images with empty src attributes
  var emptyImgSrcMatches = html.match(/<img[^>]*src=["']\s*["'][^>]*>/gi) || []
  if (emptyImgSrcMatches.length > 0) {
    // Try to extract IDs of empty images
    var emptyImageIds = emptyImgSrcMatches.map(function(img) {
      var idMatch = img.match(/id=["']([^"']+)["']/i)
      return idMatch ? idMatch[1] : 'unnamed'
    }).join(', ')
    tasks.push({
      id: 'fix-empty-img-src',
      priority: 'high',
      title: 'Fix Images with Empty src',
      description: 'Found image(s) with empty src attribute: ' + emptyImageIds,
      action: 'Add the correct image source paths or remove unused image elements'
    })
  }

  // Check for missing animation frames (if animated template)
  const isAnimatedTemplate = result.template?.features?.includes('animation')
  if (isAnimatedTemplate && (!result.assets.frames || result.assets.frames.length === 0)) {
    tasks.push({
      id: 'add-frames',
      priority: 'high',
      title: 'Add Animation Frames',
      description: 'Animated template selected but no frame images were auto-detected',
      action: 'Upload or select frame images from unmapped assets, or use Animation Editor for element-based animation'
    })
  }

  // Check for empty clickTag (no destination URL)
  if (result.features?.hasEmptyClickTag) {
    tasks.push({
      id: 'configure-clicktag',
      priority: 'high',
      title: 'Configure Click Destination URL',
      description: 'The clickTag variable is empty. No destination URL is configured for the main click action.',
      action: 'Set the clickTag URL to the appropriate destination (e.g., var clickTag = "https://...")'
    })
  }

  // Check for javascript:void() click handlers - we now auto-convert these
  // Only show verification task if auto-conversion was applied
  if (result.features?.hasJavascriptVoidClick) {
    tasks.push({
      id: 'verify-void-clicks',
      priority: 'low',
      title: 'Verify Click Handler Conversion',
      description: 'javascript:void() click handlers were auto-converted to device-compatible handlers.',
      action: 'Test all clickable links to verify they open correctly in the device browser'
    })
  }

  // Check for polite loader pattern (requires complete restructure)
  if (result.features?.hasPoliteLoader) {
    tasks.push({
      id: 'rebuild-polite-loader',
      priority: 'critical',
      title: 'MANUAL REBUILD REQUIRED: Polite Loader Pattern',
      description: 'This ad uses a polite loader pattern with chained CDN script loading. This pattern does not work offline and requires complete restructuring.',
      action: '1) Remove polite loader (onLoaderReady, politeInit functions), 2) Download and localize all CDN scripts, 3) Load scripts synchronously in <head>, 4) Remove loader animation element, 5) Trigger animation on document ready instead'
    })
  }

  // Check for chained arrow functions (ES6 conversion skipped)
  if (result.features?.hasChainedArrows) {
    tasks.push({
      id: 'convert-chained-arrows',
      priority: 'high',
      title: 'Manually Convert Chained Arrow Functions',
      description: 'Found chained arrow function assignments (x = () => y = () => z). Auto-conversion was skipped to prevent syntax errors.',
      action: 'Manually convert arrow functions to ES5 function expressions, or restructure the code to avoid chained assignments'
    })
  }

  // Check for Google Fonts CDN (won't work offline)
  if (result.features?.hasGoogleFonts) {
    tasks.push({
      id: 'localize-google-fonts',
      priority: 'high',
      title: 'Localize or Remove Google Fonts',
      description: 'This ad uses Google Fonts via CDN which will not work offline on devices.',
      action: '1) Download the font files (.woff2) from Google Fonts, 2) Add @font-face rules in CSS with local paths, 3) Remove <link> tags to fonts.googleapis.com. Do NOT replace brand fonts with web-safe alternatives — if font files cannot be obtained, convert text elements to images instead'
    })
  }

  // Check for WebFontLoader CDN (another font loading method)
  if (result.features?.hasWebFontLoader) {
    tasks.push({
      id: 'remove-webfontloader',
      priority: 'high',
      title: 'Remove WebFontLoader CDN',
      description: 'This ad uses WebFontLoader (webfont.js) to load fonts via CDN which will not work offline.',
      action: '1) Remove WebFontConfig object, 2) Remove webfont.js script include, 3) Download fonts locally or use system fonts (Arial, sans-serif)'
    })
  }

  // Check for onclick="exits(event)" pattern - we now auto-convert these
  if (result.features?.hasExitsHandler) {
    tasks.push({
      id: 'verify-exits-handlers',
      priority: 'medium',
      title: 'Verify exits() Handler Conversion',
      description: 'onclick="exits(event)" handlers were auto-converted. URLs are guessed based on element IDs but need verification.',
      action: '1) Check original exits() function for URL mappings, 2) Update clickTag variables in ad.js to match, 3) Test all clickable elements'
    })
  }

  // Check for exits() function with window.open() - needs manual conversion to appHost
  if (result.features?.hasExitsFunctionWithWindowOpen) {
    tasks.push({
      id: 'convert-exits-window-open',
      priority: 'high',
      title: 'Convert exits() Function to Use appHost',
      description: 'The exits() function uses window.open() directly. Must convert to use openExternalLinkFull() for URLs and openExternalPDF() for PDF links.',
      action: '1) Identify which clickTags are PDFs (check URLs for .pdf extension), 2) Replace window.open(clickTagX) with openExternalPDF(clickTagX) for PDFs, 3) Replace window.open(clickTagX) with openExternalLinkFull(clickTagX) for websites, 4) Test all click handlers'
    })
  }

  // Check for addEventListener with exits - elements use JS event binding instead of inline onclick
  if (result.features?.hasExitsEventListener && !result.features?.hasExitsHandler) {
    tasks.push({
      id: 'convert-exits-event-listeners',
      priority: 'high',
      title: 'Convert addEventListener exits() References',
      description: 'Elements use addEventListener("click", exits) in JavaScript. The exits() function must be updated to use appHost methods.',
      action: '1) Locate all addEventListener("click", exits) calls in JS, 2) Update exits() function to use openExternalLinkFull/openExternalPDF instead of window.open(), 3) OR replace addEventListener calls with individual handlers'
    })
  }

  // Check for duplicate click handler systems (exits() + addEventListener in same ad)
  if (result.features?.hasExitsFunctionWithWindowOpen && /addEventListener\s*\(\s*["']click["']/i.test((result.originalFiles?.adJs || '') + '\n' + (result.originalFiles?.mainJs || ''))) {
    tasks.push({
      id: 'deduplicate-click-handlers',
      priority: 'medium',
      title: 'Deduplicate Click Handler Systems',
      description: 'This ad has TWO click handler systems: exits() in main.js AND addEventListener handlers in ad.js. Both may fire for the same elements, causing duplicate actions.',
      action: '1) Compare click targets in exits() vs ad.js addEventListener handlers, 2) Choose ONE system (ad.js addEventListener is preferred), 3) Remove the other, 4) Verify all click zones still work'
    })
  }

  // Check for modal ad pattern
  if (result.features?.hasModalAd) {
    tasks.push({
      id: 'verify-modal-ad',
      priority: 'high',
      title: 'Verify Modal Ad Configuration',
      description: 'This ad uses modal ad functionality (requestModalAdView). The modal content page must be fully device-compatible.',
      action: '1) Verify mod/index.html exists, 2) Ensure modal page has appHost initialization, 3) Add appHost.dismissModalAdView() to close/dismiss button, 4) Remove any CDN scripts from modal page, 5) Convert modal page JS to ES5, 6) Ensure all modal assets are local'
    })
  }

  // Check for GWD CSS animations (require manual rebuild)
  if (result.features?.hasGWDCSSAnimations) {
    tasks.push({
      id: 'rebuild-gwd-css-animations',
      priority: 'critical',
      title: 'Rebuild GWD CSS Animations',
      description: 'This ad uses GWD CSS keyframe animations triggered by .gwd-play-animation class. The GWD runtime that triggers these animations has been removed.',
      action: '1) Extract animation timing from @keyframes rules, 2) Recreate animations using TweenMax/TimelineMax, 3) Remove CSS @keyframes rules and .gwd-play-animation references, 4) Trigger animations on document ready or onWallboardIdleSlideDisplay()'
    })
  }

  // Check for gwd-exit elements (URL extraction)
  if (result.features?.hasGwdExitElements) {
    tasks.push({
      id: 'extract-gwd-exits',
      priority: 'high',
      title: 'Extract URLs from gwd-exit Elements',
      description: 'Found ' + (result.features.gwdExitCount || 0) + ' gwd-exit elements with URL definitions. These define click destinations.',
      action: '1) Find all <gwd-exit metric="..." url="..."> elements, 2) Map URLs to corresponding click zones, 3) Add appHost handlers for each exit link'
    })
  }

  // Check for mCustomScrollbar (needs replacement with standard scroller)
  if (result.features?.hasMCustomScrollbar) {
    tasks.push({
      id: 'replace-mcustomscrollbar',
      priority: 'high',
      title: 'Replace mCustomScrollbar with Standard ISI Scroller',
      description: 'This ad uses mCustomScrollbar library for ISI scrolling. This library does not work on devices.',
      action: '1) Remove mCustomScrollbar JS and CSS files, 2) Remove $.mCustomScrollbar() calls, 3) Remove mCSB_container/mCSB_dragger wrapper divs, 4) Remove ::-webkit-scrollbar CSS rules, 5) Restructure ISI HTML: outerMostDiv > innerMostDiv + isi-controls, 6) Add scroller.css and scroller.js, 7) Keep ISI content (text or image) inside innerMostDiv unchanged'
    })
  } else if (result.features?.hasScrollLibrary && !result.features?.hasMCustomScrollbar) {
    tasks.push({
      id: 'replace-scroll-library',
      priority: 'high',
      title: 'Replace Scroll Library with Standard ISI Scroller',
      description: 'This ad uses a third-party scroll library (iScroll, OverlayScrollbars, SimpleBar, etc.) that does not work on devices.',
      action: '1) Remove the scroll library JS/CSS files, 2) Remove library initialization code, 3) Remove library-specific wrapper elements, 4) Remove ::-webkit-scrollbar CSS rules, 5) Restructure ISI HTML: outerMostDiv > innerMostDiv + isi-controls, 6) Add scroller.css and scroller.js'
    })
  }

  // Check for iframes (do NOT work on BrightSign devices)
  if (result.features?.hasIframe) {
    tasks.push({
      id: 'remove-iframes',
      priority: 'critical',
      title: 'Remove All Iframes — NOT Supported on Devices',
      description: 'Found ' + (result.features.iframeCount || 1) + ' <iframe> element(s). Iframes do NOT work on BrightSign/device players. The iframe content must be inlined directly into the main HTML or rebuilt.',
      action: '1) Identify what each iframe loads (external page, modal content, ISI, etc.), 2) If iframe loads local content (e.g. mod/index.html), inline that content directly into the main page as a hidden div, 3) If iframe loads external content, download and inline it, 4) Remove all <iframe> tags, 5) Update any JavaScript that targets iframe content to target the inlined elements instead'
    })
  }

  // Check for expandable ISI (needs manual rebuild of expand/collapse behavior)
  if (result.features?.hasExpandableISI) {
    tasks.push({
      id: 'rebuild-expandable-isi',
      priority: 'high',
      title: 'Rebuild Expandable ISI Toggle',
      description: 'This ad has an expandable ISI (tap to expand/collapse). The expand/collapse mechanism must use TweenMax and appHost-compatible event handling.',
      action: '1) Ensure ISI_ExpandBar.png and ISI_ExpandBar_collapse.png assets are present, 2) Create toggleExpansion() function that animates outerMostDiv height between collapsed (ISI strip height) and expanded (full ad height) using TweenMax.to("#outerMostDiv", 0.3, {height: expandedHeight}), 3) Wire tap event on expand bar element, 4) Toggle expand bar image between expand/collapse states, 5) Ensure ISI scroller reinitializes after expansion'
    })
  }

  // Check for browser detection code (not needed on devices)
  if (result.features?.hasBrowserDetection) {
    tasks.push({
      id: 'remove-browser-detection',
      priority: 'low',
      title: 'Remove Browser Detection Code (Optional)',
      description: 'This ad has browser detection code (Mac/Chrome/Safari/Firefox classes). IXR devices always use Chrome 69, so this code is unnecessary.',
      action: 'Remove browser detection code and any browser-specific CSS classes if they are not needed'
    })
  }

  return tasks
}

/**
 * Get summary of import analysis
 */
/**
 * Export refactored ad as a ZIP file
 * Takes the original ZIP and replaces modified files with refactored versions
 */
export async function exportRefactoredAd(originalZipFile, result, projectName) {
  const zip = await JSZip.loadAsync(originalZipFile)
  const files = Object.keys(zip.files)

  // Find the HTML file and replace with refactored version
  const htmlFile = files.find(f => /index\.html$/i.test(f))
  if (htmlFile && result.refactoredFiles.html) {
    zip.file(htmlFile, result.refactoredFiles.html)
  }

  // Find and replace ad.js
  const adJsFile = files.find(f => /ad\.js$/i.test(f))
  if (adJsFile && result.refactoredFiles.adJs) {
    zip.file(adJsFile, result.refactoredFiles.adJs)
  }

  // Find and replace main.js if modified (imported ad's own main.js)
  const mainJsFile = files.find(f => /main\.js$/i.test(f) && !/node_modules/i.test(f))
  if (mainJsFile && result.refactoredFiles.mainJs) {
    zip.file(mainJsFile, result.refactoredFiles.mainJs)
  }

  // Always add scroller.js — the standard ISI scroller that works on devices
  // Placed alongside ad.js in the script/ folder
  var scrollerContent = generateScrollerJS({})
  var scriptDir = ''
  if (adJsFile) {
    scriptDir = adJsFile.substring(0, adJsFile.lastIndexOf('/') + 1)
  } else if (htmlFile) {
    scriptDir = htmlFile.substring(0, htmlFile.lastIndexOf('/') + 1) + 'script/'
  }
  zip.file(scriptDir + 'scroller.js', scrollerContent)

  // Generate the refactored ZIP
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  })

  // Create download
  const filename = `${projectName || 'refactored-ad'}_refactored.zip`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return { success: true, filename }
}

/**
 * Get a summary of what was refactored
 */
export function getRefactorSummary(result) {
  return {
    totalFixes: result.appliedFixes?.length || 0,
    autoFixesApplied: result.appliedFixes || [],
    manualReviewNeeded: result.manualTasks?.length || 0,
    svgCount: result.allAssets?.filter(a => a.isSvg)?.length || 0,
    canExport: result.success && result.refactoredFiles?.html,
    hasAnimationWrapper: result.refactoredFiles?.html?.includes('onWallboardIdleSlideDisplay'),
    hasAppHost: result.refactoredFiles?.html?.includes('appHost')
  }
}

export function getImportSummary(result) {
  const mappedAssets = result.allAssets?.filter(a => a.mapped) || []
  const unmappedAssets = result.allAssets?.filter(a => !a.mapped) || []
  const svgAssets = result.allAssets?.filter(a => a.isSvg) || []

  return {
    templateName: result.template?.name || 'Unknown',
    dimensions: result.config.dimensions
      ? `${result.config.dimensions.width} x ${result.config.dimensions.height}`
      : 'Unknown',
    // Asset counts
    totalAssetCount: result.allAssets?.length || 0,
    mappedAssetCount: mappedAssets.length,
    unmappedAssetCount: unmappedAssets.length,
    svgAssetCount: svgAssets.length,
    // Legacy count for backward compat
    assetCount: mappedAssets.length,
    // URLs
    clickTagCount: Object.keys(result.config).filter(k => k.startsWith('clicktag')).length,
    detectedUrlCount: result.detectedUrls?.length || 0,
    // Status
    warningCount: result.warnings.length,
    errorCount: result.errors.length,
    manualTaskCount: result.manualTasks?.length || 0,
    // Features
    hasISI: result.template?.features?.includes('isi') || false,
    hasAnimation: result.animationAnalysis?.hasAnimations || false,
    animationType: result.animationAnalysis?.type || 'none',
    animationLibrary: result.animationAnalysis?.libraryUsed || null,
    // GWD
    isGWD: result.isGWD || false,
    gwdConversionCount: result.gwdConversions?.length || 0
  }
}

/**
 * Detect and convert CSS animations to TweenMax format
 */
function detectAndConvertCSSAnimations(html) {
  const animations = []
  let convertedHtml = html

  // Find all @keyframes definitions
  const keyframesPattern = /@keyframes\s+([a-zA-Z0-9_-]+)\s*\{([\s\S]*?)\}/gi
  const keyframes = {}
  let keyframeMatch

  while ((keyframeMatch = keyframesPattern.exec(html)) !== null) {
    const name = keyframeMatch[1]
    const content = keyframeMatch[2]
    keyframes[name] = parseKeyframes(content)
  }

  // Find elements using CSS animations
  // Pattern: animation: name duration timing-function delay iteration-count direction fill-mode;
  const animationPattern = /([#.][a-zA-Z0-9_-]+)\s*\{[^}]*animation\s*:\s*([^;]+);[^}]*\}/gi
  let animMatch

  while ((animMatch = animationPattern.exec(html)) !== null) {
    const selector = animMatch[1]
    const animValue = animMatch[2].trim()

    // Parse animation shorthand
    const parsed = parseAnimationShorthand(animValue)

    if (parsed.name && keyframes[parsed.name]) {
      const kf = keyframes[parsed.name]
      const target = selector.replace(/^[#.]/, '')

      // Convert keyframes to TweenMax animation
      const tweenAnim = convertKeyframesToTween(target, kf, parsed)
      if (tweenAnim) {
        animations.push(tweenAnim)
      }
    }
  }

  // Also check for animation-name property separately
  const animNamePattern = /([#.][a-zA-Z0-9_-]+)\s*\{[^}]*animation-name\s*:\s*([^;]+);[^}]*\}/gi
  while ((animMatch = animNamePattern.exec(html)) !== null) {
    const selector = animMatch[1]
    const animName = animMatch[2].trim()

    if (keyframes[animName]) {
      const target = selector.replace(/^[#.]/, '')

      // Look for duration
      const durationMatch = html.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^}]*animation-duration\\s*:\\s*([\\d.]+)s?`, 'i'))
      const duration = durationMatch ? parseFloat(durationMatch[1]) : 1

      const tweenAnim = convertKeyframesToTween(target, keyframes[animName], { duration })
      if (tweenAnim) {
        animations.push(tweenAnim)
      }
    }
  }

  // Comment out CSS animations (but keep them for reference)
  if (animations.length > 0) {
    // Comment out @keyframes blocks
    convertedHtml = convertedHtml.replace(/@keyframes\s+[a-zA-Z0-9_-]+\s*\{[\s\S]*?\}/gi, (match) => {
      return `/* CSS Animation converted to TweenMax:\n${match}\n*/`
    })

    // Comment out animation properties
    convertedHtml = convertedHtml.replace(/(\s*)animation\s*:[^;]+;/gi, '$1/* animation converted to TweenMax */')
    convertedHtml = convertedHtml.replace(/(\s*)animation-name\s*:[^;]+;/gi, '$1/* animation-name converted to TweenMax */')
    convertedHtml = convertedHtml.replace(/(\s*)animation-duration\s*:[^;]+;/gi, '$1/* animation-duration converted to TweenMax */')
    convertedHtml = convertedHtml.replace(/(\s*)animation-timing-function\s*:[^;]+;/gi, '$1/* animation-timing-function converted to TweenMax */')
    convertedHtml = convertedHtml.replace(/(\s*)animation-delay\s*:[^;]+;/gi, '$1/* animation-delay converted to TweenMax */')
    convertedHtml = convertedHtml.replace(/(\s*)animation-iteration-count\s*:[^;]+;/gi, '$1/* animation-iteration-count converted to TweenMax */')
    convertedHtml = convertedHtml.replace(/(\s*)animation-fill-mode\s*:[^;]+;/gi, '$1/* animation-fill-mode converted to TweenMax */')
  }

  return { html: convertedHtml, animations }
}

/**
 * Parse @keyframes content into structured data
 */
function parseKeyframes(content) {
  const frames = {}

  // Match percentage or from/to keywords
  const framePattern = /([\d]+%|from|to)\s*\{([^}]+)\}/gi
  let frameMatch

  while ((frameMatch = framePattern.exec(content)) !== null) {
    let percent = frameMatch[1].toLowerCase()
    if (percent === 'from') percent = '0%'
    if (percent === 'to') percent = '100%'

    const props = {}
    const propsStr = frameMatch[2]

    // Parse individual properties
    const propPattern = /([a-zA-Z-]+)\s*:\s*([^;]+)/g
    let propMatch
    while ((propMatch = propPattern.exec(propsStr)) !== null) {
      props[propMatch[1].trim()] = propMatch[2].trim()
    }

    frames[percent] = props
  }

  return frames
}

/**
 * Parse CSS animation shorthand
 */
function parseAnimationShorthand(value) {
  const parts = value.split(/\s+/)
  const result = {
    name: null,
    duration: 1,
    timing: 'ease',
    delay: 0,
    iterations: 1,
    direction: 'normal',
    fillMode: 'none'
  }

  parts.forEach(part => {
    // Duration (ends with 's' or 'ms')
    if (/^[\d.]+m?s$/.test(part)) {
      if (result.duration === 1) {
        result.duration = part.endsWith('ms') ? parseFloat(part) / 1000 : parseFloat(part)
      } else {
        result.delay = part.endsWith('ms') ? parseFloat(part) / 1000 : parseFloat(part)
      }
    }
    // Timing function
    else if (/^(ease|ease-in|ease-out|ease-in-out|linear|cubic-bezier)/.test(part)) {
      result.timing = part
    }
    // Iteration count
    else if (/^[\d]+$/.test(part) || part === 'infinite') {
      result.iterations = part === 'infinite' ? -1 : parseInt(part)
    }
    // Direction
    else if (/^(normal|reverse|alternate|alternate-reverse)$/.test(part)) {
      result.direction = part
    }
    // Fill mode
    else if (/^(none|forwards|backwards|both)$/.test(part)) {
      result.fillMode = part
    }
    // Animation name (anything else)
    else if (!result.name && /^[a-zA-Z]/.test(part)) {
      result.name = part
    }
  })

  return result
}

/**
 * Convert parsed keyframes to TweenMax animation object
 */
function convertKeyframesToTween(target, keyframes, options) {
  const duration = options.duration || 1
  const delay = options.delay || 0

  // Get start and end states
  const startFrame = keyframes['0%'] || {}
  const endFrame = keyframes['100%'] || {}

  const effects = {}

  // Map CSS properties to TweenMax properties
  const propertyMap = {
    'opacity': 'autoAlpha',
    'transform': null, // Special handling
    'left': 'x',
    'top': 'y',
    'width': 'width',
    'height': 'height'
  }

  // Process end frame properties
  Object.entries(endFrame).forEach(([cssProp, value]) => {
    if (cssProp === 'opacity') {
      const fromVal = startFrame.opacity !== undefined ? parseFloat(startFrame.opacity) : 1
      const toVal = parseFloat(value)
      effects.autoAlpha = { from: fromVal, to: toVal }
    }
    else if (cssProp === 'transform') {
      // Parse transform values
      const translateMatch = value.match(/translate[XY]?\s*\(\s*(-?[\d.]+)(?:px|%)?\s*(?:,\s*(-?[\d.]+)(?:px|%)?)?\s*\)/)
      const scaleMatch = value.match(/scale\s*\(\s*([\d.]+)\s*\)/)
      const rotateMatch = value.match(/rotate\s*\(\s*(-?[\d.]+)deg\s*\)/)

      if (translateMatch) {
        const startTransform = startFrame.transform || ''
        const startTranslate = startTransform.match(/translate[XY]?\s*\(\s*(-?[\d.]+)/)
        effects.x = { from: startTranslate ? parseFloat(startTranslate[1]) : 0, to: parseFloat(translateMatch[1]) }
        if (translateMatch[2]) {
          effects.y = { from: 0, to: parseFloat(translateMatch[2]) }
        }
      }

      if (scaleMatch) {
        const startScale = startFrame.transform?.match(/scale\s*\(\s*([\d.]+)\s*\)/)
        effects.scale = { from: startScale ? parseFloat(startScale[1]) : 1, to: parseFloat(scaleMatch[1]) }
      }

      if (rotateMatch) {
        const startRotate = startFrame.transform?.match(/rotate\s*\(\s*(-?[\d.]+)deg\s*\)/)
        effects.rotation = { from: startRotate ? parseFloat(startRotate[1]) : 0, to: parseFloat(rotateMatch[1]) }
      }
    }
  })

  if (Object.keys(effects).length === 0) {
    return null
  }

  // Determine animation type
  let type = 'in'
  if (effects.autoAlpha && effects.autoAlpha.to < effects.autoAlpha.from) {
    type = 'out'
  }

  // Map CSS timing to GSAP easing
  const easingMap = {
    'ease': 'Power1.easeInOut',
    'ease-in': 'Power1.easeIn',
    'ease-out': 'Power1.easeOut',
    'ease-in-out': 'Power1.easeInOut',
    'linear': 'Linear.easeNone'
  }

  return {
    target,
    type,
    effects,
    duration,
    startTime: delay,
    easing: easingMap[options.timing] || 'Power1.easeOut',
    convertedFrom: 'CSS'
  }
}

/**
 * Detect custom scrolling implementations that need to be removed
 */
function detectScrollImplementations(html, js) {
  const warnings = []
  const allCode = html + '\n' + js

  // Common scroll libraries
  const scrollLibraries = [
    { pattern: /iscroll/i, name: 'iScroll' },
    { pattern: /scrolltrap/i, name: 'ScrollTrap' },
    { pattern: /perfect-scrollbar/i, name: 'Perfect Scrollbar' },
    { pattern: /simplebar/i, name: 'SimpleBar' },
    { pattern: /smooth-scroll/i, name: 'Smooth Scroll' },
    { pattern: /locomotive-scroll/i, name: 'Locomotive Scroll' },
    { pattern: /scrollmagic/i, name: 'ScrollMagic' },
    { pattern: /skrollr/i, name: 'Skrollr' },
    { pattern: /nicescroll/i, name: 'NiceScroll' },
    { pattern: /mCustomScrollbar/i, name: 'mCustomScrollbar' },
    { pattern: /overlayscrollbars/i, name: 'OverlayScrollbars' },
    { pattern: /new\s+Scroller\s*\(/i, name: 'Custom Scroller class (Havas/Beyfortus)' },
    { pattern: /\.scrollTo\s*\(/i, name: 'Custom scrollTo' },
    { pattern: /scrollIntoView/i, name: 'scrollIntoView' }
  ]

  scrollLibraries.forEach(lib => {
    if (lib.pattern.test(allCode)) {
      warnings.push({
        level: 'error',
        message: `${lib.name} detected - will be removed (devices use standard ISI scroller)`
      })
    }
  })

  // Custom scroll event handlers
  const scrollHandlerPatterns = [
    { pattern: /addEventListener\s*\(\s*['"]scroll['"]/gi, name: 'scroll event listener' },
    { pattern: /addEventListener\s*\(\s*['"]wheel['"]/gi, name: 'wheel event listener' },
    { pattern: /addEventListener\s*\(\s*['"]mousewheel['"]/gi, name: 'mousewheel event listener' },
    { pattern: /addEventListener\s*\(\s*['"]DOMMouseScroll['"]/gi, name: 'DOMMouseScroll event listener' },
    { pattern: /\.on\s*\(\s*['"]scroll['"]/gi, name: 'jQuery scroll handler' },
    { pattern: /onscroll\s*=/gi, name: 'onscroll attribute' },
    { pattern: /onwheel\s*=/gi, name: 'onwheel attribute' }
  ]

  scrollHandlerPatterns.forEach(handler => {
    const matches = allCode.match(handler.pattern)
    if (matches && matches.length > 0) {
      // Check if it's our standard ISI scroller (which is OK)
      const isStandardScroller = allCode.includes('moveScroller') || allCode.includes('isiWheel')
      if (!isStandardScroller) {
        warnings.push({
          level: 'warn',
          message: `Custom ${handler.name} found - may conflict with device scroller`
        })
      }
    }
  })

  // Touch scroll handlers
  if (/addEventListener\s*\(\s*['"]touchmove['"]/i.test(allCode) ||
      /addEventListener\s*\(\s*['"]touchstart['"]/i.test(allCode)) {
    warnings.push({
      level: 'warn',
      message: 'Touch scroll handlers detected - may conflict with device touch handling'
    })
  }

  // CSS scroll-behavior
  if (/scroll-behavior\s*:\s*smooth/i.test(allCode)) {
    warnings.push({
      level: 'info',
      message: 'CSS smooth scroll detected - will be overridden by device scroller'
    })
  }

  // Overflow scroll on non-ISI elements
  if (/overflow\s*:\s*scroll/i.test(allCode) || /overflow-y\s*:\s*scroll/i.test(allCode)) {
    warnings.push({
      level: 'info',
      message: 'CSS overflow:scroll detected - ensure only ISI container has scrolling'
    })
  }

  return warnings
}

/**
 * Remove custom scroll implementations from HTML/JS
 */
export function removeScrollImplementations(html) {
  let cleaned = html

  // Remove iScroll script tags
  cleaned = cleaned.replace(/<script[^>]*iscroll[^>]*>[\s\S]*?<\/script>/gi, '<!-- iScroll removed -->')

  // Remove scrolltrap script tags
  cleaned = cleaned.replace(/<script[^>]*scrolltrap[^>]*>[\s\S]*?<\/script>/gi, '<!-- ScrollTrap removed -->')

  // Remove perfect-scrollbar
  cleaned = cleaned.replace(/<script[^>]*perfect-scrollbar[^>]*>[\s\S]*?<\/script>/gi, '<!-- PerfectScrollbar removed -->')
  cleaned = cleaned.replace(/<link[^>]*perfect-scrollbar[^>]*>/gi, '<!-- PerfectScrollbar CSS removed -->')

  // Remove simplebar
  cleaned = cleaned.replace(/<script[^>]*simplebar[^>]*>[\s\S]*?<\/script>/gi, '<!-- SimpleBar removed -->')
  cleaned = cleaned.replace(/<link[^>]*simplebar[^>]*>/gi, '<!-- SimpleBar CSS removed -->')

  // Remove smooth-scroll
  cleaned = cleaned.replace(/<script[^>]*smooth-scroll[^>]*>[\s\S]*?<\/script>/gi, '<!-- SmoothScroll removed -->')

  // Remove nicescroll
  cleaned = cleaned.replace(/<script[^>]*nicescroll[^>]*>[\s\S]*?<\/script>/gi, '<!-- NiceScroll removed -->')

  // Remove mCustomScrollbar
  cleaned = cleaned.replace(/<script[^>]*mcustomscrollbar[^>]*>[\s\S]*?<\/script>/gi, '<!-- mCustomScrollbar removed -->')
  cleaned = cleaned.replace(/<link[^>]*mcustomscrollbar[^>]*>/gi, '<!-- mCustomScrollbar CSS removed -->')

  // Comment out inline scroll initializations
  // Pattern: new IScroll(...) or IScroll.init(...) etc.
  cleaned = cleaned.replace(/new\s+IScroll\s*\([^)]*\)\s*;?/gi, '/* IScroll init removed */')
  cleaned = cleaned.replace(/\$\([^)]*\)\.mCustomScrollbar\s*\([^)]*\)\s*;?/gi, '/* mCustomScrollbar init removed */')
  // Also remove mCustomScrollbar.defaults assignments
  cleaned = cleaned.replace(/\$\.mCustomScrollbar\.defaults\.[^;]+;?/gi, '/* mCustomScrollbar defaults removed */')
  // Also remove mCustomScrollbar method calls like .mCustomScrollbar("update")
  cleaned = cleaned.replace(/\.mCustomScrollbar\s*\(\s*["'][^"']*["']\s*\)/gi, '/* mCustomScrollbar call removed */')
  cleaned = cleaned.replace(/new\s+PerfectScrollbar\s*\([^)]*\)\s*;?/gi, '/* PerfectScrollbar init removed */')
  cleaned = cleaned.replace(/SimpleBar\.init\s*\([^)]*\)\s*;?/gi, '/* SimpleBar init removed */')
  // Remove custom Scroller class init (Havas/Beyfortus bespoke scroll widget)
  cleaned = cleaned.replace(/(?:var\s+\w+\s*=\s*)?new\s+Scroller\s*\(\s*\{[\s\S]*?\}\s*\)\s*;?/gi, '/* Custom Scroller init removed */')

  // Remove scroll-behavior: smooth from inline styles
  cleaned = cleaned.replace(/scroll-behavior\s*:\s*smooth\s*;?/gi, '')

  return cleaned
}

/**
 * Apply all refactoring fixes to the original files
 * Returns refactored versions ready for export
 */
function applyRefactoring(result, html, adJs, mainJs, otherFiles) {
  const appliedFixes = []
  let refactoredHtml = html
  let refactoredAdJs = adJs
  let refactoredMainJs = mainJs
  var refactoredOtherJs = {} // Will hold refactored versions of other JS files

  // Detect which JS folder convention the ad uses (js/, script/, scripts/, or root)
  // Used when generating ad.js for ads that don't have one
  var jsFolder = 'js' // default
  var existingScriptSrc = html.match(/<script[^>]*src=["']([^"']*\/)[^"']+\.js["']/i)
  if (existingScriptSrc) {
    var folderPath = existingScriptSrc[1]
    // Strip leading ./ or root prefix
    folderPath = folderPath.replace(/^\.\//, '')
    // Get just the folder name (e.g. "script/" from "7758/script/")
    var parts = folderPath.split('/')
    var lastFolder = parts[parts.length - 2] || parts[parts.length - 1]
    if (lastFolder && /^(js|script|scripts|lib)$/i.test(lastFolder)) {
      jsFolder = lastFolder
    }
  }
  // Also check the original ad.js path
  if (result.filePaths?.adJs) {
    var adJsFolder = result.filePaths.adJs.split('/').slice(-2, -1)[0]
    if (adJsFolder && /^(js|script|scripts|lib)$/i.test(adJsFolder)) {
      jsFolder = adJsFolder
    }
  }
  // Store for use by other functions
  result.jsFolder = jsFolder

  // 1. Ensure required meta tags are present
  var metaChanges = []

  // charset
  if (!/charset/i.test(refactoredHtml)) {
    var charsetMeta = '<meta charset="UTF-8">'
    refactoredHtml = refactoredHtml.replace(/<head[^>]*>/i, '$&\n    ' + charsetMeta)
    metaChanges.push('Added charset meta')
  }

  // ad.size
  var hasAdSizeMeta = /name=["']ad\.size["']/i.test(refactoredHtml)
  if (!hasAdSizeMeta && result.config?.dimensions) {
    var adSizeMeta = '<meta name="ad.size" content="width=' + result.config.dimensions.width + ',height=' + result.config.dimensions.height + '">'
    if (refactoredHtml.includes('charset=')) {
      refactoredHtml = refactoredHtml.replace(/(<meta[^>]*charset[^>]*>)/i, '$1\n    ' + adSizeMeta)
    } else {
      refactoredHtml = refactoredHtml.replace(/<head[^>]*>/i, '$&\n    ' + adSizeMeta)
    }
    metaChanges.push('Added ad.size meta')
  }

  // Cache-Control, Pragma, Expires, viewport — required for ALL ad types
  {
    if (!/Cache-Control/i.test(refactoredHtml)) {
      var cacheMeta = '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">'
      cacheMeta += '\n    <meta http-equiv="Pragma" content="no-cache">'
      cacheMeta += '\n    <meta http-equiv="Expires" content="0">'
      // Insert after ad.size or charset
      if (/name=["']ad\.size["']/i.test(refactoredHtml)) {
        refactoredHtml = refactoredHtml.replace(/(<meta[^>]*ad\.size[^>]*>)/i, '$1\n    ' + cacheMeta)
      } else {
        refactoredHtml = refactoredHtml.replace(/(<meta[^>]*charset[^>]*>)/i, '$1\n    ' + cacheMeta)
      }
      metaChanges.push('Added Cache-Control, Pragma, Expires meta tags')
    }

    if (!/maximum-scale/i.test(refactoredHtml)) {
      var viewportMeta = '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">'
      // Insert after Expires or ad.size
      if (/Expires/i.test(refactoredHtml)) {
        refactoredHtml = refactoredHtml.replace(/(<meta[^>]*Expires[^>]*>)/i, '$1\n    ' + viewportMeta)
      } else if (/name=["']ad\.size["']/i.test(refactoredHtml)) {
        refactoredHtml = refactoredHtml.replace(/(<meta[^>]*ad\.size[^>]*>)/i, '$1\n    ' + viewportMeta)
      }
      metaChanges.push('Added viewport meta (maximum-scale=1.0, user-scalable=0)')
    }
  }

  if (metaChanges.length > 0) {
    appliedFixes.push({
      id: 'add-meta-tags',
      description: 'Added required meta tags',
      details: metaChanges
    })
  }

  // 2. Remove custom scroll implementations from HTML
  const scrollScriptsRemoved = removeScrollScripts(refactoredHtml)
  if (scrollScriptsRemoved.changed) {
    refactoredHtml = scrollScriptsRemoved.html
    appliedFixes.push({
      id: 'remove-scroll-scripts',
      description: 'Removed custom scroll library scripts',
      details: scrollScriptsRemoved.removed
    })
  }

  // 3. Remove scroll initialization from JS
  const scrollJsRemoved = removeScrollFromJs(refactoredAdJs)
  if (scrollJsRemoved.changed) {
    refactoredAdJs = scrollJsRemoved.js
    appliedFixes.push({
      id: 'remove-scroll-js',
      description: 'Removed scroll initialization code from ad.js',
      details: scrollJsRemoved.removed
    })
  }

  // 4. Remove inline scroll code from HTML
  const inlineScrollRemoved = removeInlineScrollCode(refactoredHtml)
  if (inlineScrollRemoved.changed) {
    refactoredHtml = inlineScrollRemoved.html
    appliedFixes.push({
      id: 'remove-inline-scroll',
      description: 'Removed inline scroll code from HTML',
      details: inlineScrollRemoved.removed
    })
  }

  // 5. Add onWallboardIdleSlideDisplay wrapper for CP ads only (MR ads don't need it)
  // Check dimensions directly as fallback if template not detected
  // Use user-selected adType if available, otherwise detect from template/dimensions
  var isCPAd = result.adType === 'cp' ||
               (!result.adType && (result.template?.brand === 'cp' ||
               (result.config?.dimensions?.width === 1080 && result.config?.dimensions?.height === 1733) ||
               /width[=:]\s*1080.*height[=:]\s*1733|1080px.*1733px/i.test(refactoredHtml)))

  if (isCPAd) {
    var hasWrapper = refactoredHtml.includes('onWallboardIdleSlideDisplay') ||
                     (refactoredAdJs && refactoredAdJs.includes('onWallboardIdleSlideDisplay'))

    // Check for any animation indicators (GWD, GSAP, TweenMax, CSS animations, etc.)
    var hasAnyAnimation = result.animationAnalysis?.hasAnimations ||
                          result.isGWD ||
                          /gwd-|TimelineMax|TweenMax|gsap\.|@keyframes|animation-name/i.test(refactoredHtml) ||
                          (refactoredAdJs && /TimelineMax|TweenMax|gsap\./i.test(refactoredAdJs))

    if (!hasWrapper && hasAnyAnimation) {
      var wrapperAdded = addAnimationWrapper(refactoredHtml, refactoredAdJs)
      refactoredHtml = wrapperAdded.html
      refactoredAdJs = wrapperAdded.adJs
      appliedFixes.push({
        id: 'add-animation-wrapper',
        description: 'Added onWallboardIdleSlideDisplay wrapper for device compatibility',
        details: 'Animation will now trigger when device displays the ad'
      })
    }
  }

  // 6. Add appHost integration if missing (IXR/iPro only — Focus doesn't use appHost)
  var isIxrOrIpro = result.adPlatform === 'ixr' || result.adPlatform === 'ipro'
  var isFocus = result.adPlatform === 'focus'
  if (isIxrOrIpro && !refactoredHtml.includes('appHost') && !refactoredAdJs.includes('appHost')) {
    const appHostAdded = addAppHostIntegration(refactoredHtml)
    refactoredHtml = appHostAdded.html
    appliedFixes.push({
      id: 'add-apphost',
      description: 'Added appHost integration',
      details: 'Device features (click tracking, PDF viewer, etc.) now available'
    })
  }

  // Helper: detect if JS content is a bundled/runtime file (unsafe to auto-convert)
  var isUnsafeBundledCode = function(content) {
    return /__webpack_modules__|__webpack_require__|webpackJsonp|creatopyEmbed/i.test(content)
  }

  // 7. Convert ES6 to ES5 for better device compatibility (IXR/iPro only)
  if (isIxrOrIpro && !isUnsafeBundledCode(refactoredAdJs)) {
    var es6Converted = convertES6ToES5(refactoredAdJs)
    if (es6Converted.changed) {
      refactoredAdJs = es6Converted.js
      appliedFixes.push({
        id: 'convert-es6-adjs',
        description: 'Converted ES6 syntax to ES5 in ad.js',
        details: es6Converted.changes
      })
    }
  }

  // 7b. Convert ES6 to ES5 in main.js (IXR/iPro only)
  if (isIxrOrIpro && refactoredMainJs && !isUnsafeBundledCode(refactoredMainJs)) {
    var mainJsEs6Converted = convertES6ToES5(refactoredMainJs)
    if (mainJsEs6Converted.changed) {
      refactoredMainJs = mainJsEs6Converted.js
      appliedFixes.push({
        id: 'convert-es6-mainjs',
        description: 'Converted ES6 syntax to ES5 in main.js',
        details: mainJsEs6Converted.changes
      })
    }
  }

  // 7c. Convert window.open(clickTagX) in main.js to device-compatible calls (IXR/iPro only)
  if (isIxrOrIpro && refactoredMainJs && /window\.open\s*\(\s*(?:window\.)?(clickTag\w*)/i.test(refactoredMainJs)) {
    // Pass adJs so we can skip injecting helper functions if ad.js already has them
    var mainJsWindowOpenConverted = convertWindowOpenInJS(refactoredMainJs, refactoredAdJs)
    if (mainJsWindowOpenConverted.changed) {
      refactoredMainJs = mainJsWindowOpenConverted.js
      appliedFixes.push({
        id: 'convert-window-open-mainjs',
        description: 'Converted window.open() calls in main.js to device-compatible handlers',
        details: mainJsWindowOpenConverted.changes
      })
    }
  }

  // 7d. Convert GSAP 3.x to TweenMax 2.0.1 in ad.js (IXR/iPro only — Focus has internet, GSAP 3 works)
  var gsap3Converted = (isIxrOrIpro && !isUnsafeBundledCode(refactoredAdJs)) ? convertGsap3ToTweenMax(refactoredAdJs) : { js: refactoredAdJs, changed: false, changes: [] }
  if (gsap3Converted.changed) {
    refactoredAdJs = gsap3Converted.js
    appliedFixes.push({
      id: 'convert-gsap3-adjs',
      description: 'Converted GSAP 3.x to TweenMax 2.0.1 in ad.js',
      details: gsap3Converted.changes
    })
  }

  // 7e. Convert GSAP 3.x to TweenMax 2.0.1 in main.js (IXR/iPro only)
  if (isIxrOrIpro && refactoredMainJs && !isUnsafeBundledCode(refactoredMainJs)) {
    var mainJsGsap3Converted = convertGsap3ToTweenMax(refactoredMainJs)
    if (mainJsGsap3Converted.changed) {
      refactoredMainJs = mainJsGsap3Converted.js
      appliedFixes.push({
        id: 'convert-gsap3-mainjs',
        description: 'Converted GSAP 3.x to TweenMax 2.0.1 in main.js',
        details: mainJsGsap3Converted.changes
      })
    }
  }

  // 7f. Process ALL other JS files (ES6→ES5, GSAP 3→TweenMax) — IXR/iPro only
  var libraryPattern = /jquery|tweenmax|tweenlite|timelinemax|timelinelite|gsap[\._-]|createjs|iscroll|webcomponents|enabler|imagesloaded/i
  if (isIxrOrIpro && otherFiles) {
    for (var otherFilename in otherFiles) {
      if (!/\.js$/i.test(otherFilename)) continue
      if (libraryPattern.test(otherFilename)) continue
      // Skip .min.js files — they're vendor libraries
      if (/\.min\.js$/i.test(otherFilename)) continue

      var otherContent = otherFiles[otherFilename]

      // Skip webpack bundles — unsafe to auto-convert
      if (isUnsafeBundledCode(otherContent)) continue

      var otherChanged = false
      var otherChanges = []

      // ES6 → ES5
      var otherEs6 = convertES6ToES5(otherContent)
      if (otherEs6.changed) {
        otherContent = otherEs6.js
        otherChanged = true
        otherChanges = otherChanges.concat(otherEs6.changes)
      }

      // GSAP 3 → TweenMax (IXR/iPro only — Focus has internet, GSAP 3 works)
      if (isIxrOrIpro) {
        var otherGsap = convertGsap3ToTweenMax(otherContent)
        if (otherGsap.changed) {
          otherContent = otherGsap.js
          otherChanged = true
          otherChanges = otherChanges.concat(otherGsap.changes)
        }
      }

      if (otherChanged) {
        refactoredOtherJs[otherFilename] = otherContent
        appliedFixes.push({
          id: 'convert-other-js-' + otherFilename.replace(/[^a-z0-9]/gi, '-'),
          description: 'Converted ES6/GSAP 3.x in ' + otherFilename,
          details: otherChanges
        })
      }
    }
  }

  // 8. Convert ES6 in inline scripts (IXR/iPro only)
  const inlineEs6Converted = isIxrOrIpro ? convertInlineES6(refactoredHtml) : { html: refactoredHtml, changed: false, changes: [] }
  if (inlineEs6Converted.changed) {
    refactoredHtml = inlineEs6Converted.html
    appliedFixes.push({
      id: 'convert-inline-es6',
      description: 'Converted ES6 syntax in inline scripts',
      details: inlineEs6Converted.changes
    })
  }

  // 8b. Convert window.open(clickTag) in inline <script> blocks (IXR/iPro only — Focus uses window.open natively)
  if (isIxrOrIpro) {
  var inlineWindowOpenPattern = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi
  var inlineWindowOpenChanges = []
  refactoredHtml = refactoredHtml.replace(inlineWindowOpenPattern, function(fullMatch, scriptContent) {
    // Build clickTag lookup from this script block AND from any earlier script blocks
    var localClickTagLookup = {}
    var tagVarPattern = /var\s+(clickTag\w*)\s*=\s*["']([^"']+)["']/gi
    var tv
    // Scan the full HTML for clickTag variables (they may be in a different script block)
    var allTagVars = /var\s+(clickTag\w*)\s*=\s*["']([^"']+)["']/gi
    while ((tv = allTagVars.exec(refactoredHtml)) !== null) {
      localClickTagLookup[tv[1]] = tv[2].replace(/&amp;/g, '&')
    }

    // Replace window.open(clickTag) or window.open(window.clickTag) with appHost handler
    var windowOpenInScript = /window\.open\s*\(\s*(?:window\.)?(clickTag\w*)\s*(?:,\s*["'][^"']*["']\s*)?\)/gi
    if (!windowOpenInScript.test(scriptContent)) return fullMatch

    windowOpenInScript.lastIndex = 0
    var newScript = scriptContent.replace(windowOpenInScript, function(m, varName) {
      var url = localClickTagLookup[varName] || ''
      var isPdf = /\.pdf(\b|$)/i.test(url)
      var handler = isPdf ? 'openExternalPDF' : 'openExternalLinkFull'
      inlineWindowOpenChanges.push('Converted inline window.open(' + varName + ') to ' + handler)
      return handler + '(e, ' + varName + ')'
    })

    return fullMatch.replace(scriptContent, newScript)
  })
  if (inlineWindowOpenChanges.length > 0) {
    appliedFixes.push({
      id: 'convert-inline-window-open',
      description: 'Converted window.open() calls in inline scripts to device-compatible handlers',
      details: inlineWindowOpenChanges
    })
  }
  } // end isIxrOrIpro block for step 8b

  // 9. Add ISI scroller if ISI is detected (IXR/iPro only — Focus leaves scrollbars as-is)
  const hasISI = result.template?.features?.includes('isi') ||
                 refactoredHtml.includes('id="outerMostDiv"') ||
                 refactoredHtml.includes('id="innerMostDiv"') ||
                 refactoredHtml.includes('id="isi-controls"')

  if (isIxrOrIpro && hasISI) {
    const isiScrollerAdded = addISIScroller(refactoredHtml, refactoredAdJs, result.config || {})
    if (isiScrollerAdded.changed) {
      refactoredHtml = isiScrollerAdded.html
      refactoredAdJs = isiScrollerAdded.adJs
      appliedFixes.push({
        id: 'add-isi-scroller',
        description: 'Added dynamic ISI scroller for device compatibility',
        details: isiScrollerAdded.changes
      })
    }
  }

  // 10. Add console silencing for production
  if (!refactoredHtml.includes('console.log = console.info')) {
    var consoleSilenced = addConsoleSilencing(refactoredHtml)
    if (consoleSilenced.changed) {
      refactoredHtml = consoleSilenced.html
      appliedFixes.push({
        id: 'add-console-silencing',
        description: 'Added console silencing for production',
        details: 'Console output suppressed for cleaner device logs'
      })
    }
  }

  // 11-17.5: IXR/iPro click handler conversions — Focus handles clicks differently (inline getParameterByName)
  if (isIxrOrIpro) {

  // 11. Add device-compatible click handlers
  var clickHandlersConverted = convertClickHandlers(refactoredHtml, refactoredAdJs)
  if (clickHandlersConverted.changed) {
    refactoredHtml = clickHandlersConverted.html
    refactoredAdJs = clickHandlersConverted.adJs
    appliedFixes.push({
      id: 'convert-click-handlers',
      description: 'Added device-compatible click handler functions',
      details: clickHandlersConverted.changes
    })
  }

  // 12. Wrap live ISI text in standard structure
  // This keeps live text (accessibility) while enabling proper scrolling
  var hasLiveISI = result.features?.hasLiveISIText && !result.features?.hasStandardISI
  if (hasLiveISI) {
    var isiWrapped = wrapLiveISIInStructure(refactoredHtml)
    if (isiWrapped.changed) {
      refactoredHtml = isiWrapped.html
      appliedFixes.push({
        id: 'wrap-live-isi',
        description: 'Wrapped live ISI text in standard scroller structure',
        details: isiWrapped.changes
      })
    }
  }

  // 13. Convert javascript:void() click handlers to proper event handlers
  var hasJsVoidClicks = result.features?.hasJavascriptVoidClick
  if (hasJsVoidClicks) {
    var jsVoidConverted = convertJavascriptVoidClicks(refactoredHtml, refactoredAdJs)
    if (jsVoidConverted.changed) {
      refactoredHtml = jsVoidConverted.html
      refactoredAdJs = jsVoidConverted.adJs
      appliedFixes.push({
        id: 'convert-void-clicks',
        description: 'Converted javascript:void() links to device-compatible handlers',
        details: jsVoidConverted.changes
      })
    }
  }

  // 14. Convert inline onclick="window.open()" handlers to device-compatible handlers
  if (result.features?.hasInlineOnclickOpen) {
    var onclickConverted = convertInlineOnclickHandlers(refactoredHtml, refactoredAdJs)
    if (onclickConverted.changed) {
      refactoredHtml = onclickConverted.html
      refactoredAdJs = onclickConverted.adJs
      appliedFixes.push({
        id: 'convert-inline-onclick',
        description: 'Converted inline onclick window.open() to device-compatible handlers',
        details: onclickConverted.changes
      })
    }
  }

  // 15. Remove inline onMouseOver/onMouseOut handlers (unreliable on devices)
  if (result.features?.hasInlineMouseHandlers) {
    var mouseHandlersRemoved = removeInlineMouseHandlers(refactoredHtml)
    if (mouseHandlersRemoved.changed) {
      refactoredHtml = mouseHandlersRemoved.html
      appliedFixes.push({
        id: 'remove-mouse-handlers',
        description: 'Removed inline onMouseOver/onMouseOut handlers',
        details: mouseHandlersRemoved.changes
      })
    }
  }

  // 16. Remove webkit-scrollbar CSS styles (don't work on devices)
  if (result.features?.hasWebkitScrollbarStyles) {
    var scrollbarStylesRemoved = removeWebkitScrollbarStyles(refactoredHtml)
    if (scrollbarStylesRemoved.changed) {
      refactoredHtml = scrollbarStylesRemoved.html
      appliedFixes.push({
        id: 'remove-scrollbar-styles',
        description: 'Removed webkit-scrollbar CSS styles (replaced by JS scroller)',
        details: scrollbarStylesRemoved.changes
      })
    }
  }

  // 17. Convert onclick="exits(event)" handlers to device-compatible handlers
  if (result.features?.hasExitsHandler) {
    var exitsConverted = convertExitsHandlers(refactoredHtml, refactoredAdJs)
    if (exitsConverted.changed) {
      refactoredHtml = exitsConverted.html
      refactoredAdJs = exitsConverted.adJs
      appliedFixes.push({
        id: 'convert-exits-handlers',
        description: 'Converted onclick="exits(event)" to device-compatible handlers',
        details: exitsConverted.changes
      })
    }
  }

  // 17.5. Convert <a href="https://..."> links to device-compatible click handlers
  if (result.features?.hasAnchorHrefLinks) {
    var anchorConverted = convertAnchorHrefLinks(refactoredHtml, refactoredAdJs, jsFolder)
    if (anchorConverted.changed) {
      refactoredHtml = anchorConverted.html
      refactoredAdJs = anchorConverted.adJs
      appliedFixes.push({
        id: 'convert-anchor-hrefs',
        description: 'Converted <a href> links to device-compatible click handlers',
        details: anchorConverted.changes
      })
    }
  }

  } // end isIxrOrIpro click handler block

  // 18. Generate click handlers for GWD ads with extracted exit URLs
  // IXR/iPro: generate ad.js file | Focus: generate inline script with getParameterByName
  if (!refactoredAdJs && result.detectedUrls && result.detectedUrls.length > 0 && isFocus) {
    // Focus: inline click handlers with getParameterByName fallback
    var focusExitUrls = result.detectedUrls.filter(function(u) {
      return u.type === 'pdf' || u.type === 'gwd-exit'
    })
    if (focusExitUrls.length > 0) {
      var focusScript = '\n<script>\n'
      // clickTag declarations
      focusExitUrls.forEach(function(exitUrl, i) {
        focusScript += '    var clickTag' + (i + 1) + ' = \'' + exitUrl.url + '\';\n'
      })
      focusScript += '\n'
      // getParameterByName function
      focusScript += '    function getParameterByName(name) {\n'
      focusScript += '        var match = RegExp(\'[?&]\' + name + \'=([^&]*)\').exec(window.location.search);\n'
      focusScript += '        return match && decodeURIComponent(match[1].replace(/\\+/g, \' \'));\n'
      focusScript += '    }\n\n'
      // addEventListener handlers
      var focusChanges = []
      focusExitUrls.forEach(function(exitUrl, i) {
        var varName = 'clickTag' + (i + 1)
        focusScript += '    document.getElementById("' + exitUrl.id + '").addEventListener("click", function(){ window.open(getParameterByName(\'' + varName + '\')||' + varName + '); });\n'
        focusChanges.push('Added Focus click handler for #' + exitUrl.id + ' → ' + varName)
      })
      focusScript += '</script>\n'
      // Inject before </body>
      refactoredHtml = refactoredHtml.replace(/<\/body>/i, focusScript + '</body>')
      appliedFixes.push({
        id: 'generate-focus-clicks',
        description: 'Generated inline Focus click handlers with getParameterByName fallback',
        details: focusChanges
      })
    }
  } else if (!refactoredAdJs && result.detectedUrls && result.detectedUrls.length > 0) {
    var exitUrls = result.detectedUrls.filter(function(u) {
      return u.type === 'pdf' || u.type === 'gwd-exit'
    })
    if (exitUrls.length > 0) {
      var adJsLines = []
      adJsLines.push('$(document).ready(function () {')

      // Emit clickTag variable declarations with actual URLs
      exitUrls.forEach(function(exitUrl, i) {
        var varName = 'clickTag' + (i + 1)
        adJsLines.push('    var ' + varName + ' = "' + exitUrl.url + '"')
      })
      adJsLines.push('')

      // Add handler functions
      adJsLines.push('    //External Link')
      adJsLines.push('    function openExternalLinkFull(e, linkUrl) {')
      adJsLines.push('        if (typeof appHost !== \'undefined\') {')
      adJsLines.push('            appHost.requestFullscreenBrowserView(linkUrl);')
      adJsLines.push('        } else {')
      adJsLines.push('            window.open(linkUrl);')
      adJsLines.push('        }')
      adJsLines.push('    }')
      adJsLines.push('')
      adJsLines.push('    //External PDF')
      adJsLines.push('    function openExternalPDF(e, pdfUrl) {')
      adJsLines.push('        if (typeof appHost !== \'undefined\') {')
      adJsLines.push('            appHost.requestPDFView(pdfUrl);')
      adJsLines.push('        } else {')
      adJsLines.push('            window.open(pdfUrl);')
      adJsLines.push('        }')
      adJsLines.push('    }')
      adJsLines.push('')

      // Build assignClickHandlers
      adJsLines.push('    function assignClickHandlers() {')
      var changes = []
      exitUrls.forEach(function(exitUrl, i) {
        var varName = 'clickTag' + (i + 1)
        var isPdf = /\.pdf(\b|$)/i.test(exitUrl.url)
        var handlerFn = isPdf ? 'openExternalPDF' : 'openExternalLinkFull'
        var comment = isPdf ? '//PDF' : '//LINK'
        adJsLines.push('        ' + comment)
        adJsLines.push('        $(\'#' + exitUrl.id + '\')[0].addEventListener("click", function (e) {')
        adJsLines.push('            ' + handlerFn + '(e, ' + varName + ');')
        adJsLines.push('        }, false);')
        changes.push('Added click handler for #' + exitUrl.id + ' → ' + handlerFn + '(' + varName + ')')
      })
      adJsLines.push('    }')
      adJsLines.push('')
      adJsLines.push('    assignClickHandlers();')
      adJsLines.push('')
      adJsLines.push('});')

      refactoredAdJs = adJsLines.join('\n')

      // Add ad.js script tag to HTML if not present
      var adJsScriptPath = jsFolder + '/ad.js'
      if (!/src=["'][^"']*ad\.js["']/i.test(refactoredHtml)) {
        // Insert after jQuery script tag, or before </body>
        var jqueryTagEnd = refactoredHtml.search(/<script[^>]*jquery[^>]*><\/script>/i)
        if (jqueryTagEnd !== -1) {
          var insertAfter = refactoredHtml.indexOf('</script>', jqueryTagEnd) + '</script>'.length
          refactoredHtml = refactoredHtml.slice(0, insertAfter) +
            '\n    <script type="text/javascript" src="' + adJsScriptPath + '"></script>' +
            refactoredHtml.slice(insertAfter)
        } else {
          var bodyClose = refactoredHtml.lastIndexOf('</body>')
          if (bodyClose !== -1) {
            refactoredHtml = refactoredHtml.slice(0, bodyClose) +
              '<script type="text/javascript" src="' + adJsScriptPath + '"></script>\n' +
              refactoredHtml.slice(bodyClose)
          }
        }
      }

      // Store the generated ad.js path so the store knows where to put it
      result.filePaths.generatedAdJsFolder = jsFolder

      appliedFixes.push({
        id: 'generate-gwd-adjs',
        description: 'Generated ad.js with device-compatible click handlers from GWD/Enabler exit URLs',
        details: changes
      })
    }
  }

  // 19-21: CDN and font removal (IXR/iPro only — Focus has internet access)
  if (isIxrOrIpro) {
    // 19. Remove Google Fonts CDN links (won't work offline on devices)
    if (result.features?.hasGoogleFonts) {
      var fontsRemoved = removeGoogleFontsCDN(refactoredHtml)
      if (fontsRemoved.changed) {
        refactoredHtml = fontsRemoved.html
        appliedFixes.push({
          id: 'remove-google-fonts',
          description: 'Removed Google Fonts CDN links (devices are offline)',
          details: fontsRemoved.changes
        })
      }
    }

    // 19b. Remove inline @font-face blocks with CDN src URLs (won't load offline)
    if (result.features?.hasInlineCDNFontFace) {
      var fontFaceRemoved = removeInlineCDNFontFace(refactoredHtml)
      if (fontFaceRemoved.changed) {
        refactoredHtml = fontFaceRemoved.html
        appliedFixes.push({
          id: 'remove-inline-cdn-fontface',
          description: 'Removed inline @font-face blocks with CDN URLs (devices are offline)',
          details: fontFaceRemoved.changes
        })
      }
    }

    // 20. Remove CSS custom properties / variables (not supported in Chrome 69)
    var cssVarResult = convertCSSVariables(refactoredHtml)
    if (cssVarResult.changed) {
      refactoredHtml = cssVarResult.html
      appliedFixes.push({
        id: 'convert-css-variables',
        description: 'Resolved CSS custom properties to literal values (Chrome 69 compatibility)',
        details: cssVarResult.changes
      })
    }

    // 21. Remove known CDN script/link tags (devices are offline)
    var cdnRemoved = removeKnownCDNTags(refactoredHtml)
    if (cdnRemoved.changed) {
      refactoredHtml = cdnRemoved.html
      appliedFixes.push({
        id: 'remove-cdn-tags',
        description: 'Removed CDN script/link tags (devices are offline)',
        details: cdnRemoved.changes
      })
    }
  }

  // 22. Remove tracking pixels and impression tags (devices are offline, these cause errors)
  var trackingRemoved = removeTrackingPixels(refactoredHtml)
  if (trackingRemoved.changed) {
    refactoredHtml = trackingRemoved.html
    appliedFixes.push({
      id: 'remove-tracking-pixels',
      description: 'Removed tracking/impression pixels (devices are offline)',
      details: trackingRemoved.changes
    })
  }

  // 23. Remove overflow:hidden from html/body (never used in our ads, prevents browser scrolling)
  {
    var overflowResult = removeBodyOverflowHidden(refactoredHtml)
    if (overflowResult.changed) {
      refactoredHtml = overflowResult.html
      appliedFixes.push({
        id: 'remove-body-overflow-hidden',
        description: 'Removed overflow:hidden from html/body (not used in our ads)',
        details: overflowResult.changes
      })
    }
  }

  return {
    files: {
      html: refactoredHtml,
      adJs: refactoredAdJs,
      mainJs: refactoredMainJs,
      scrollerJs: generateScrollerJS({}),
      additionalJs: Object.keys(refactoredOtherJs).length > 0 ? refactoredOtherJs : null
    },
    appliedFixes: appliedFixes
  }
}

/**
 * Remove overflow:hidden from html and body CSS rules (all ad types)
 * We never use overflow:hidden on body in our ads — it prevents browser scrolling during testing.
 */
function removeBodyOverflowHidden(html) {
  var changes = []
  var result = html

  // Match overflow:hidden (or overflow: hidden) in rules that target html or body
  // Strategy: find overflow:hidden inside style blocks and remove it from html/body rules
  // We use a two-pass approach:
  // 1. Remove overflow:hidden property from html,body / html / body selectors
  // 2. Also handle combined rules like html,body{...overflow:hidden...}

  // Pattern: remove overflow:hidden or overflow: hidden from inline styles and style blocks
  // Only target html and body selectors, not other elements
  var styleBlockPattern = /<style[^>]*>([\s\S]*?)<\/style>/gi
  result = result.replace(styleBlockPattern, function(fullMatch, cssContent) {
    var newCss = cssContent

    // Remove overflow:hidden from rules targeting html, body, or html,body
    // Matches: html,body{...overflow:hidden...} or body{...overflow:hidden...} etc.
    var rulePattern = /((?:html|body)(?:\s*,\s*(?:html|body))*\s*\{)([^}]*)(})/gi
    newCss = newCss.replace(rulePattern, function(ruleMatch, selector, props, closeBrace) {
      if (/overflow\s*:\s*hidden/i.test(props)) {
        var newProps = props.replace(/\s*overflow\s*:\s*hidden\s*;?/gi, '')
        changes.push('Removed overflow:hidden from ' + selector.trim().replace(/\s*\{/, ''))
        return selector + newProps + closeBrace
      }
      return ruleMatch
    })

    return fullMatch.replace(cssContent, newCss)
  })

  // Also handle inline style on body tag: <body style="overflow:hidden">
  result = result.replace(/<body([^>]*?)style=["']([^"']*)["']/gi, function(match, before, style) {
    if (/overflow\s*:\s*hidden/i.test(style)) {
      var newStyle = style.replace(/\s*overflow\s*:\s*hidden\s*;?/gi, '').trim()
      changes.push('Removed overflow:hidden from body inline style')
      if (newStyle) {
        return '<body' + before + 'style="' + newStyle + '"'
      }
      return '<body' + before
    }
    return match
  })

  return {
    html: result,
    changed: changes.length > 0,
    changes: changes
  }
}

/**
 * Remove Google Fonts CDN <link> tags and @import rules
 * Font files must be local — brands have specific fonts that should NOT be replaced with web-safe alternatives.
 * If font files aren't available locally, text may need to be converted to images.
 */
function removeGoogleFontsCDN(html) {
  var changes = []
  var result = html

  // Remove <link> tags for Google Fonts
  var linkPattern = /<link[^>]*href=["'][^"']*fonts\.googleapis\.com[^"']*["'][^>]*\/?>/gi
  result = result.replace(linkPattern, function(match) {
    changes.push('Removed Google Fonts <link>: ' + match.trim().substring(0, 80))
    return ''
  })

  // Remove <link> tags for Google Fonts static files (preconnect, etc.)
  var gstaticPattern = /<link[^>]*href=["'][^"']*fonts\.gstatic\.com[^"']*["'][^>]*\/?>/gi
  result = result.replace(gstaticPattern, function(match) {
    changes.push('Removed fonts.gstatic.com preconnect link')
    return ''
  })

  // Remove @import url("https://fonts.googleapis.com/...") from inline styles
  var importPattern = /@import\s+url\s*\(\s*["']?[^"')]*fonts\.googleapis\.com[^"')]*["']?\s*\)\s*;?/gi
  result = result.replace(importPattern, function(match) {
    changes.push('Removed @import for Google Fonts')
    return ''
  })

  // Remove WebFontLoader script tags
  var webFontPattern = /<script[^>]*src=["'][^"']*webfont\.js[^"']*["'][^>]*><\/script>/gi
  result = result.replace(webFontPattern, function(match) {
    changes.push('Removed WebFontLoader script')
    return ''
  })

  // Remove WebFontConfig blocks (inline scripts that configure WebFontLoader)
  var webFontConfigPattern = /<script[^>]*>\s*WebFontConfig\s*=[\s\S]*?<\/script>/gi
  result = result.replace(webFontConfigPattern, function(match) {
    changes.push('Removed WebFontConfig script block')
    return ''
  })

  return {
    html: result,
    changed: changes.length > 0,
    changes: changes
  }
}

/**
 * Remove inline @font-face blocks whose src references CDN URLs (fonts.gstatic.com, etc.)
 * These won't load on offline devices. Keeps @font-face blocks with local src paths.
 */
function removeInlineCDNFontFace(html) {
  var changes = []
  var result = html

  // Match @font-face blocks that contain CDN URLs in their src
  // Uses a two-pass approach: find @font-face blocks, then check if src has CDN URL
  var fontFacePattern = /@font-face\s*\{[^}]*\}/gi
  result = result.replace(fontFacePattern, function(match) {
    // Only remove if src contains a CDN URL
    if (/src\s*:\s*url\s*\(\s*["']?https?:\/\//i.test(match)) {
      // Extract font-family name for logging
      var familyMatch = match.match(/font-family\s*:\s*["']?([^"';]+)/i)
      var fontName = familyMatch ? familyMatch[1].trim() : 'unknown'
      var weightMatch = match.match(/font-weight\s*:\s*(\d+)/i)
      var weight = weightMatch ? weightMatch[1] : ''
      changes.push('Removed @font-face for ' + fontName + (weight ? ' (' + weight + ')' : '') + ' — CDN src URL')
      return '/* @font-face removed — CDN font URL not available offline */'
    }
    return match // Keep local @font-face blocks
  })

  return {
    html: result,
    changed: changes.length > 0,
    changes: changes
  }
}

/**
 * Resolve CSS custom properties (variables) to their literal values
 * Chrome 69 does not support CSS custom properties
 */
function convertCSSVariables(html) {
  var changes = []
  var result = html

  // Check if any CSS variables exist
  if (!/var\(--/i.test(result)) {
    return { html: result, changed: false, changes: [] }
  }

  // Extract variable definitions from :root or any selector
  var varMap = {}
  var defPattern = /(--[\w-]+)\s*:\s*([^;}\n]+)/g
  var defMatch
  while ((defMatch = defPattern.exec(result)) !== null) {
    var varName = defMatch[1].trim()
    var varValue = defMatch[2].trim()
    varMap[varName] = varValue
  }

  if (Object.keys(varMap).length === 0) {
    return { html: result, changed: false, changes: [] }
  }

  // Replace var(--name) and var(--name, fallback) with resolved values
  var replacements = 0
  result = result.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\s*\)/g, function(match, varName, fallback) {
    var resolved = varMap[varName.trim()]
    if (resolved) {
      replacements++
      return resolved
    } else if (fallback) {
      replacements++
      return fallback.trim()
    }
    return match // leave as-is if no value found
  })

  if (replacements > 0) {
    changes.push('Resolved ' + replacements + ' CSS variable(s) to literal values')

    // Remove :root { --var: value; } blocks that only contain variable definitions
    result = result.replace(/:root\s*\{([^}]*)\}/g, function(match, body) {
      var cleaned = body.replace(/\s*--[\w-]+\s*:[^;]*;?\s*/g, '')
      if (cleaned.trim() === '') {
        changes.push('Removed empty :root block')
        return ''
      }
      return ':root {' + cleaned + '}'
    })
  }

  return {
    html: result,
    changed: changes.length > 0,
    changes: changes
  }
}

/**
 * Remove scroll library script tags from HTML
 */
function removeScrollScripts(html) {
  var removed = []
  var result = html

  // Patterns for scroll library scripts (including jQuery scrollbar, enscroll)
  var scrollScriptPatterns = [
    /<script[^>]*src=["'][^"']*(?:iscroll|scrolltrap|perfect-scrollbar|smoothscroll|overscroll)[^"']*["'][^>]*><\/script>/gi,
    /<script[^>]*src=["'][^"']*ScrollToPlugin[^"']*["'][^>]*><\/script>/gi,
    /<script[^>]*src=["'][^"']*jquery\.scrollbar[^"']*["'][^>]*><\/script>/gi,
    /<script[^>]*src=["'][^"']*OverlayScrollbars[^"']*["'][^>]*><\/script>/gi,
    /<script[^>]*src=["'][^"']*enscroll[^"']*["'][^>]*><\/script>/gi
  ]

  for (var i = 0; i < scrollScriptPatterns.length; i++) {
    var pattern = scrollScriptPatterns[i]
    var matches = result.match(pattern) || []
    matches.forEach(function(match) {
      removed.push(match.substring(0, 100) + '...')
    })
    result = result.replace(pattern, '<!-- Removed scroll library -->')
  }

  // Also remove jQuery scrollbar CSS link
  var scrollCssPattern = /<link[^>]*href=["'][^"']*(?:jquery\.scrollbar|OverlayScrollbars)[^"']*["'][^>]*>/gi
  var cssMatches = result.match(scrollCssPattern) || []
  cssMatches.forEach(function(match) {
    removed.push('Scroll library CSS: ' + match.substring(0, 60) + '...')
  })
  result = result.replace(scrollCssPattern, '<!-- Removed scroll library CSS -->')

  return { html: result, changed: removed.length > 0, removed }
}

/**
 * Remove scroll initialization code from JS
 */
function removeScrollFromJs(js) {
  if (!js) return { js, changed: false, removed: [] }

  const removed = []
  let result = js

  // Remove iScroll initialization
  const iscrollPattern = /(?:var\s+)?(?:myScroll|iscroll|scroll)\s*=\s*new\s+IScroll\s*\([^)]+\)[^;]*;?/gi
  if (iscrollPattern.test(result)) {
    removed.push('IScroll initialization')
    result = result.replace(iscrollPattern, '/* IScroll removed - using device scroller */')
  }

  // Remove pageScroll function calls
  const pageScrollPattern = /(?:setTimeout\s*\(\s*function\s*\(\)\s*\{[^}]*pageScroll\s*\(\)[^}]*\}[^)]*\)[^;]*;?|pageScroll\s*\(\s*\)[^;]*;?)/gi
  if (pageScrollPattern.test(result)) {
    removed.push('pageScroll() calls')
    result = result.replace(pageScrollPattern, '/* pageScroll removed - using device scroller */')
  }

  // Remove scrollTop manipulation in intervals/timeouts
  const scrollTopPattern = /(?:setInterval|setTimeout)\s*\([^)]*scrollTop[^)]+\)[^;]*;?/gi
  if (scrollTopPattern.test(result)) {
    removed.push('scrollTop interval/timeout')
    result = result.replace(scrollTopPattern, '/* scroll automation removed - device handles scrolling */')
  }

  return { js: result, changed: removed.length > 0, removed }
}

/**
 * Remove inline scroll code from HTML script tags
 */
function removeInlineScrollCode(html) {
  var removed = []
  var result = html

  // Find and process inline scripts with scroll code
  var scriptPattern = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi

  result = result.replace(scriptPattern, function(match, content) {
    var newContent = content

    // Remove pageScroll function definition
    var pageScrollDefPattern = /function\s+pageScroll\s*\(\)\s*\{[\s\S]*?\n\s*\}/gi
    if (pageScrollDefPattern.test(newContent)) {
      removed.push('pageScroll function definition')
      newContent = newContent.replace(pageScrollDefPattern, '/* pageScroll removed */')
    }

    // Remove setTimeout that calls pageScroll
    var setTimeoutScrollPattern = /setTimeout\s*\(\s*function\s*\(\)\s*\{[\s\S]*?pageScroll[\s\S]*?\}\s*,\s*\d+\s*\)\s*;?/gi
    if (setTimeoutScrollPattern.test(newContent)) {
      removed.push('setTimeout pageScroll call')
      newContent = newContent.replace(setTimeoutScrollPattern, '/* scroll timeout removed */')
    }

    // Remove jQuery scrollbar initialization
    var jqueryScrollbarPattern = /jQuery\s*\(\s*document\s*\)\s*\.ready\s*\(\s*function\s*\(\s*\)\s*\{[\s\S]*?\.scrollbar\s*\([\s\S]*?\}\s*\)\s*;?/gi
    if (jqueryScrollbarPattern.test(newContent)) {
      removed.push('jQuery scrollbar initialization')
      newContent = newContent.replace(jqueryScrollbarPattern, '/* jQuery scrollbar removed - using device scroller */')
    }

    // Also try alternate jQuery ready pattern
    var jqueryScrollbarPattern2 = /\$\s*\(\s*document\s*\)\s*\.ready\s*\(\s*function\s*\(\s*\)\s*\{[\s\S]*?\.scrollbar\s*\([\s\S]*?\}\s*\)\s*;?/gi
    if (jqueryScrollbarPattern2.test(newContent)) {
      removed.push('jQuery scrollbar initialization')
      newContent = newContent.replace(jqueryScrollbarPattern2, '/* jQuery scrollbar removed - using device scroller */')
    }

    // Remove jQuery(document).ready with scrollbar inside
    var readyScrollbarPattern = /jQuery\s*\([^)]*\)\s*\.ready\s*\(\s*function\s*\([^)]*\)\s*\{[^}]*scrollbar[^}]*\}\s*\)\s*;?/gi
    if (readyScrollbarPattern.test(newContent)) {
      removed.push('jQuery scrollbar ready handler')
      newContent = newContent.replace(readyScrollbarPattern, '/* jQuery scrollbar removed */')
    }

    if (newContent !== content) {
      return '<script>' + newContent + '</script>'
    }
    return match
  })

  return { html: result, changed: removed.length > 0, removed }
}

/**
 * Wrap live ISI text content in standard outerMostDiv/innerMostDiv/isi-controls structure
 * This preserves accessibility (selectable text) while enabling proper scrolling on devices
 */
function wrapLiveISIInStructure(html) {
  var changes = []
  var result = html

  // Skip if already has standard structure
  if (/id=["']outerMostDiv["']|id=["']innerMostDiv["']/i.test(result)) {
    return { html: result, changed: false, changes: [] }
  }

  // Find ISI content containers that have live text — use div depth counting
  // Looks for <div id="isi-copy"> and finds its matching closing </div>
  var isiCopyOpenPattern = /<div[^>]*id=["']isi-copy["'][^>]*>/i
  var isiCopyMatch = isiCopyOpenPattern.exec(result)
  if (isiCopyMatch) {
    var copyStartIdx = isiCopyMatch.index
    var copyOpenTag = isiCopyMatch[0]
    var copyAfterOpen = copyStartIdx + copyOpenTag.length
    var copyDepth = 1
    var copyPos = copyAfterOpen
    var copyDivOpen = /<div[\s>]/gi
    var copyDivClose = /<\/div>/gi
    while (copyDepth > 0 && copyPos < result.length) {
      copyDivOpen.lastIndex = copyPos
      copyDivClose.lastIndex = copyPos
      var cNextOpen = copyDivOpen.exec(result)
      var cNextClose = copyDivClose.exec(result)
      if (!cNextClose) break
      if (cNextOpen && cNextOpen.index < cNextClose.index) {
        copyDepth++
        copyPos = cNextOpen.index + cNextOpen[0].length
      } else {
        copyDepth--
        if (copyDepth === 0) {
          var copyContent = result.substring(copyAfterOpen, cNextClose.index)
          if (/<(?:ul|ol|p|h1|h2|h3|li)[^>]*>/i.test(copyContent)) {
            changes.push('Wrapped isi-copy content in outerMostDiv/innerMostDiv structure')
            var wrappedCopy = copyOpenTag +
              '\n              <div id="outerMostDiv">\n' +
              '                <div id="innerMostDiv">' +
              copyContent +
              '                </div>\n' +
              '                <div id="isi-controls"></div>\n' +
              '              </div>\n            ' +
              '</div>'
            result = result.substring(0, copyStartIdx) + wrappedCopy + result.substring(cNextClose.index + '</div>'.length)
          }
        } else {
          copyPos = cNextClose.index + cNextClose[0].length
        }
      }
    }
  }

  // Try isi-content pattern — use div depth counting to find the correct closing tag
  if (!changes.length) {
    var isiContentOpenPattern = /<div[^>]*(?:id|class)=["'][^"']*isi-content[^"']*["'][^>]*>/i
    var isiContentMatch = isiContentOpenPattern.exec(result)
    if (isiContentMatch) {
      var isiStartIdx = isiContentMatch.index
      var openTag = isiContentMatch[0]
      var afterOpen = isiStartIdx + openTag.length
      // Count div depth to find the matching closing </div>
      var depth = 1
      var pos = afterOpen
      var divOpenPattern = /<div[\s>]/gi
      var divClosePattern = /<\/div>/gi
      // Walk through the HTML character by character tracking div depth
      while (depth > 0 && pos < result.length) {
        divOpenPattern.lastIndex = pos
        divClosePattern.lastIndex = pos
        var nextOpen = divOpenPattern.exec(result)
        var nextClose = divClosePattern.exec(result)
        if (!nextClose) break // no more closing divs — malformed HTML
        if (nextOpen && nextOpen.index < nextClose.index) {
          depth++
          pos = nextOpen.index + nextOpen[0].length
        } else {
          depth--
          if (depth === 0) {
            // Found the matching </div> for the isi-content div
            var contentBetween = result.substring(afterOpen, nextClose.index)
            if (/<(?:ul|ol|p|h1|h2|h3|li)[^>]*>/i.test(contentBetween)) {
              changes.push('Wrapped isi-content in outerMostDiv/innerMostDiv structure')
              var wrapped = openTag +
                '\n        <div id="outerMostDiv">\n' +
                '          <div id="innerMostDiv">' +
                contentBetween +
                '          </div>\n' +
                '          <div id="isi-controls"></div>\n' +
                '        </div>\n      ' +
                '</div>'
              result = result.substring(0, isiStartIdx) + wrapped + result.substring(nextClose.index + '</div>'.length)
            }
          } else {
            pos = nextClose.index + nextClose[0].length
          }
        }
      }
    }
  }

  return { html: result, changed: changes.length > 0, changes: changes }
}

/**
 * Convert javascript:void(window.open(...)) click handlers to device-compatible handlers
 * Extracts click info and creates proper event handlers in ad.js
 */
function convertJavascriptVoidClicks(html, adJs) {
  var changes = []
  var resultHtml = html
  var resultAdJs = adJs || ''
  var clickHandlers = []

  // Pattern: href="javascript:void(window.open(window.clickTag, 'blank'))"
  // or href="javascript:void(window.open(window.clickTag1, 'blank'))"
  var voidClickPattern = /<a([^>]*?)href=["']javascript:\s*void\s*\(\s*(?:window\.)?open\s*\(\s*(?:window\.)?(\w+)\s*(?:,\s*["'][^"']*["'])?\s*\)\s*\)["']([^>]*)>/gi
  // Also catch: href="javascript:window.open(window.clickTag)" (without void wrapper)
  var directJsOpenPattern = /<a([^>]*?)href=["']javascript:\s*(?:window\.)?open\s*\(\s*(?:window\.)?(\w+)\s*(?:,\s*["'][^"']*["'])?\s*\)["']([^>]*)>/gi
  var autoVoidIdCounter = 1

  resultHtml = resultHtml.replace(voidClickPattern, function(match, before, clickVar, after) {
    var fullAttrs = before + after

    // Extract the element ID, or generate one
    var idMatch = fullAttrs.match(/id=["']([^"']+)["']/)
    var elementId = idMatch ? idMatch[1] : null

    if (!elementId) {
      // Try class name as fallback for ID generation
      var classMatch = fullAttrs.match(/class=["']([^"']+)["']/)
      var className = classMatch ? classMatch[1].split(' ')[0] : null
      elementId = className ? className.replace(/[^a-zA-Z0-9_-]/g, '') : ('autoVoidLink-' + autoVoidIdCounter)
      autoVoidIdCounter++
      // Inject the ID into the tag
      before = ' id="' + elementId + '"' + before
    }

    // Track this click handler for ad.js
    clickHandlers.push({
      elementId: elementId,
      clickVar: clickVar
    })
    changes.push('Removed javascript:void() from #' + elementId + ', will use ' + clickVar)

    // Remove the href, keep everything else
    return '<a' + before + after + '>'
  })

  // Also match javascript:window.open(...) without void() wrapper
  resultHtml = resultHtml.replace(directJsOpenPattern, function(match, before, clickVar, after) {
    var fullAttrs = before + after
    var idMatch = fullAttrs.match(/id=["']([^"']+)["']/)
    var elementId = idMatch ? idMatch[1] : null
    if (!elementId) {
      var classMatch = fullAttrs.match(/class=["']([^"']+)["']/)
      var className = classMatch ? classMatch[1].split(' ')[0] : null
      elementId = className ? className.replace(/[^a-zA-Z0-9_-]/g, '') : ('autoJsOpenLink-' + autoVoidIdCounter)
      autoVoidIdCounter++
      before = ' id="' + elementId + '"' + before
    }
    clickHandlers.push({ elementId: elementId, clickVar: clickVar })
    changes.push('Removed javascript:window.open() from #' + elementId + ', will use ' + clickVar)
    return '<a' + before + after + '>'
  })

  // If we found click handlers, resolve clickTag variables and generate ad.js
  if (clickHandlers.length > 0) {
    // Build a lookup of clickTag variable → URL from the source HTML + ad.js
    var allSource = resultHtml + '\n' + resultAdJs
    var clickTagLookup = {}
    // Decode HTML entities in URLs extracted from HTML source
    var decodeHtmlEntities = function(str) {
      return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    }
    var varDeclPattern = /var\s+(clickTag\w*)\s*=\s*["']([^"']+)["']/gi
    var varMatch
    while ((varMatch = varDeclPattern.exec(allSource)) !== null) {
      clickTagLookup[varMatch[1].toLowerCase()] = decodeHtmlEntities(varMatch[2])
    }
    // Also check Enabler.getParameter / gwd-ad exitUrls patterns
    var exitUrlPattern = /["'](clickTag\w*)["']\s*:\s*["'](https?:\/\/[^"']+)["']/gi
    while ((varMatch = exitUrlPattern.exec(allSource)) !== null) {
      if (!clickTagLookup[varMatch[1].toLowerCase()]) {
        clickTagLookup[varMatch[1].toLowerCase()] = decodeHtmlEntities(varMatch[2])
      }
    }

    var handlersJs = '\n// Click handlers converted from javascript:void() patterns\n'
    handlersJs += '$(document).ready(function () {\n\n'
    handlersJs += '    //External Link\n'
    handlersJs += '    function openExternalLinkFull(e, linkUrl) {\n'
    handlersJs += '        if (typeof appHost !== \'undefined\') {\n'
    handlersJs += '            appHost.requestFullscreenBrowserView(linkUrl);\n'
    handlersJs += '        } else {\n'
    handlersJs += '            window.open(linkUrl);\n'
    handlersJs += '        }\n'
    handlersJs += '    }\n\n'
    handlersJs += '    //External PDF\n'
    handlersJs += '    function openExternalPDF(e, pdfUrl) {\n'
    handlersJs += '        if (typeof appHost !== \'undefined\') {\n'
    handlersJs += '            appHost.requestPDFView(pdfUrl);\n'
    handlersJs += '        } else {\n'
    handlersJs += '            window.open(pdfUrl);\n'
    handlersJs += '        }\n'
    handlersJs += '    }\n\n'

    // Emit clickTag variable declarations with resolved URLs
    clickHandlers.forEach(function(handler, i) {
      var resolvedUrl = clickTagLookup[handler.clickVar.toLowerCase()] || ''
      var varName = handler.clickVar
      handler.resolvedUrl = resolvedUrl
      handler.varName = varName
      handler.isPdf = /\.pdf(\b|$)/i.test(resolvedUrl)
      if (resolvedUrl) {
        handlersJs += '    var ' + varName + ' = "' + resolvedUrl + '"\n'
      } else {
        handlersJs += '    var ' + varName + ' = "" // TODO: set correct URL\n'
      }
    })
    handlersJs += '\n'

    handlersJs += '    function assignClickHandlers() {\n'

    clickHandlers.forEach(function(handler) {
      var handlerFn = handler.isPdf ? 'openExternalPDF' : 'openExternalLinkFull'
      var comment = handler.isPdf ? '//PDF' : '//LINK'

      handlersJs += '        ' + comment + '\n'
      handlersJs += '        $(\'#' + handler.elementId + '\')[0].addEventListener("click", function (e) {\n'
      handlersJs += '            e.preventDefault();\n'
      handlersJs += '            ' + handlerFn + '(e, ' + handler.varName + ');\n'
      handlersJs += '        }, false);\n'
    })

    handlersJs += '    }\n\n'
    handlersJs += '    assignClickHandlers();\n'
    handlersJs += '});\n'

    resultAdJs = resultAdJs + handlersJs
    changes.push('Added ' + clickHandlers.length + ' click handler(s) to ad.js with resolved URLs')
  }

  return {
    html: resultHtml,
    adJs: resultAdJs,
    changed: changes.length > 0,
    changes: changes
  }
}

/**
 * Convert inline onclick="window.open(...)" handlers to device-compatible handlers
 * Extracts click info and creates proper event handlers in ad.js
 */
function convertInlineOnclickHandlers(html, adJs) {
  var changes = []
  var resultHtml = html
  var resultAdJs = adJs || ''
  var clickHandlers = []

  // Pattern: onclick="window.open(window.clickTag1); void(0);" or onclick="window.open(window.clickTag1)"
  // Also handles: onclick="window.open(clickTag1)"
  var onclickPattern = /<([a-z]+)([^>]*?)onclick=["'](?:window\.)?open\s*\(\s*(?:window\.)?(\w+)\s*(?:,\s*["'][^"']*["'])?\s*\)[^"']*["']([^>]*)>/gi

  resultHtml = resultHtml.replace(onclickPattern, function(match, tag, before, clickVar, after) {
    // Extract the element ID if present
    var idMatch = (before + after).match(/id=["']([^"']+)["']/)
    var elementId = idMatch ? idMatch[1] : null

    // Extract class if present (for targeting without ID)
    var classMatch = (before + after).match(/class=["']([^"']+)["']/)
    var elementClass = classMatch ? classMatch[1].split(' ')[0] : null

    var selector = elementId ? '#' + elementId : (elementClass ? '.' + elementClass : null)

    if (selector) {
      // Track this click handler for ad.js
      clickHandlers.push({
        selector: selector,
        clickVar: clickVar,
        tag: tag
      })
      changes.push('Removed onclick from ' + selector + ', will use ' + clickVar)
    }

    // Remove the onclick, keep everything else
    return '<' + tag + before + after + '>'
  })

  // If we found click handlers, add them to ad.js
  if (clickHandlers.length > 0) {
    var handlersJs = '\n// Click handlers converted from inline onclick patterns\n'
    handlersJs += '$(document).ready(function () {\n\n'
    handlersJs += '    //External Link\n'
    handlersJs += '    function openExternalLinkFull(e, linkUrl) {\n'
    handlersJs += '        if (typeof appHost !== \'undefined\') {\n'
    handlersJs += '            appHost.requestFullscreenBrowserView(linkUrl);\n'
    handlersJs += '        } else {\n'
    handlersJs += '            window.open(linkUrl);\n'
    handlersJs += '        }\n'
    handlersJs += '    }\n\n'
    handlersJs += '    //External PDF\n'
    handlersJs += '    function openExternalPDF(e, pdfUrl) {\n'
    handlersJs += '        if (typeof appHost !== \'undefined\') {\n'
    handlersJs += '            appHost.requestPDFView(pdfUrl);\n'
    handlersJs += '        } else {\n'
    handlersJs += '            window.open(pdfUrl);\n'
    handlersJs += '        }\n'
    handlersJs += '    }\n\n'

    // Build clickTag lookup from the full source (HTML + adJs) to resolve actual URLs
    var allSource = resultHtml + '\n' + resultAdJs
    var clickTagLookup = {}
    var decodeEntities = function(s) { return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') }
    var varDeclPattern = /(?:var\s+)?(clickTag\w*)\s*=\s*["']([^"']+)["']/gi
    var vMatch
    while ((vMatch = varDeclPattern.exec(allSource)) !== null) {
      clickTagLookup[vMatch[1]] = decodeEntities(vMatch[2])
    }

    // Emit clickTag variable declarations — resolve from lookup or placeholder
    var seenVars = {}
    clickHandlers.forEach(function(handler) {
      if (!seenVars[handler.clickVar]) {
        var resolvedUrl = clickTagLookup[handler.clickVar] || ''
        handler.resolvedUrl = resolvedUrl
        handler.isPdf = /\.pdf(\b|$)/i.test(resolvedUrl)
        if (resolvedUrl) {
          handlersJs += '    var ' + handler.clickVar + ' = "' + resolvedUrl + '"\n'
        } else {
          handlersJs += '    var ' + handler.clickVar + ' = "" // TODO: set correct URL\n'
        }
        seenVars[handler.clickVar] = true
      }
    })
    handlersJs += '\n'

    handlersJs += '    function assignClickHandlers() {\n'

    clickHandlers.forEach(function(handler) {
      var handlerFn = handler.isPdf ? 'openExternalPDF' : 'openExternalLinkFull'
      var comment = handler.isPdf ? '//PDF' : '//LINK'
      handlersJs += '        ' + comment + '\n'
      handlersJs += '        $(\'' + handler.selector + '\')[0].addEventListener("click", function (e) {\n'
      handlersJs += '            ' + handlerFn + '(e, ' + handler.clickVar + ');\n'
      handlersJs += '        }, false);\n'
    })

    handlersJs += '    }\n\n'
    handlersJs += '    assignClickHandlers();\n'
    handlersJs += '});\n'

    resultAdJs = resultAdJs + handlersJs
    changes.push('Added ' + clickHandlers.length + ' click handler(s) to ad.js')
  }

  return {
    html: resultHtml,
    adJs: resultAdJs,
    changed: changes.length > 0,
    changes: changes
  }
}

/**
 * Remove inline onMouseOver/onMouseOut handlers (unreliable on devices)
 */
function removeInlineMouseHandlers(html) {
  var changes = []
  var result = html

  // Remove onMouseOver handlers
  var mouseOverPattern = /\s*onMouseOver=["'][^"']*["']/gi
  if (mouseOverPattern.test(result)) {
    changes.push('Removed onMouseOver handlers')
    result = result.replace(mouseOverPattern, '')
  }

  // Remove onMouseOut handlers
  var mouseOutPattern = /\s*onMouseOut=["'][^"']*["']/gi
  if (mouseOutPattern.test(result)) {
    changes.push('Removed onMouseOut handlers')
    result = result.replace(mouseOutPattern, '')
  }

  // Also handle lowercase versions
  var mouseOverLower = /\s*onmouseover=["'][^"']*["']/gi
  if (mouseOverLower.test(result)) {
    changes.push('Removed onmouseover handlers')
    result = result.replace(mouseOverLower, '')
  }

  var mouseOutLower = /\s*onmouseout=["'][^"']*["']/gi
  if (mouseOutLower.test(result)) {
    changes.push('Removed onmouseout handlers')
    result = result.replace(mouseOutLower, '')
  }

  return {
    html: result,
    changed: changes.length > 0,
    changes: changes
  }
}

/**
 * Convert onclick="exits(event)" handlers to device-compatible handlers
 * Parses the exits() function body to extract element→URL mappings
 */
function convertExitsHandlers(html, adJs) {
  var changes = []
  var resultHtml = html
  var resultAdJs = adJs || ''
  var clickHandlers = []
  var autoExitIdCounter = 1

  // Pattern: onclick="exits(event)" on any element
  var exitsPattern = /<([a-z]+)([^>]*?)onclick=["']exits\s*\(\s*event\s*\)["']([^>]*)>/gi

  resultHtml = resultHtml.replace(exitsPattern, function(match, tag, before, after) {
    var fullAttrs = before + after
    var idMatch = fullAttrs.match(/id=["']([^"']+)["']/)
    var elementId = idMatch ? idMatch[1] : null

    if (!elementId) {
      // Generate ID from class name or auto-increment
      var classMatch = fullAttrs.match(/class=["']([^"']+)["']/)
      var className = classMatch ? classMatch[1].split(' ')[0] : null
      elementId = className ? className.replace(/[^a-zA-Z0-9_-]/g, '') : ('autoExitLink-' + autoExitIdCounter)
      autoExitIdCounter++
      before = ' id="' + elementId + '"' + before
    }

    clickHandlers.push({
      elementId: elementId,
      tag: tag
    })
    changes.push('Removed onclick="exits(event)" from #' + elementId)

    return '<' + tag + before + after + '>'
  })

  // Parse the exits() function body to extract element→URL mappings
  var exitsMappings = {}
  var allSource = resultHtml + '\n' + resultAdJs
  var exitsFuncMatch = allSource.match(/function\s+exits\s*\([^)]*\)\s*\{/)
  if (exitsFuncMatch) {
    var funcBodyStart = allSource.indexOf(exitsFuncMatch[0]) + exitsFuncMatch[0].length
    // Use brace-depth counting to extract full function body
    var depth = 1
    var pos = funcBodyStart
    while (depth > 0 && pos < allSource.length) {
      if (allSource[pos] === '{') depth++
      else if (allSource[pos] === '}') depth--
      pos++
    }
    var funcBody = allSource.substring(funcBodyStart, pos - 1)

    // Extract if/else-if blocks mapping element IDs to URLs
    // Pattern: if (e.target.id == "elementId") { window.open(clickTagVar) }
    var ifPattern = /(?:e\.target\.id|event\.target\.id|this\.id|e\.currentTarget\.id)\s*(?:===?|==)\s*["']([^"']+)["'][^}]*?(?:window\.open|open)\s*\(\s*(?:window\.)?(\w+)/gi
    var ifMatch
    while ((ifMatch = ifPattern.exec(funcBody)) !== null) {
      exitsMappings[ifMatch[1]] = ifMatch[2]
    }

    // Also try: case "elementId": window.open(clickTagVar)
    var casePattern = /case\s+["']([^"']+)["']\s*:[^}]*?(?:window\.open|open)\s*\(\s*(?:window\.)?(\w+)/gi
    var caseMatch
    while ((caseMatch = casePattern.exec(funcBody)) !== null) {
      if (!exitsMappings[caseMatch[1]]) {
        exitsMappings[caseMatch[1]] = caseMatch[2]
      }
    }
  }

  // Build clickTag variable → URL lookup from source
  var clickTagLookup = {}
  var decodeEntities = function(s) { return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') }
  var varDeclPattern = /var\s+(clickTag\w*)\s*=\s*["']([^"']+)["']/gi
  var varMatch
  while ((varMatch = varDeclPattern.exec(allSource)) !== null) {
    clickTagLookup[varMatch[1].toLowerCase()] = decodeEntities(varMatch[2])
  }

  if (clickHandlers.length > 0) {
    var handlersJs = '\n// Click handlers converted from exits(event) pattern\n'
    handlersJs += '$(document).ready(function () {\n\n'
    handlersJs += '    //External Link\n'
    handlersJs += '    function openExternalLinkFull(e, linkUrl) {\n'
    handlersJs += '        if (typeof appHost !== \'undefined\') {\n'
    handlersJs += '            appHost.requestFullscreenBrowserView(linkUrl);\n'
    handlersJs += '        } else {\n'
    handlersJs += '            window.open(linkUrl);\n'
    handlersJs += '        }\n'
    handlersJs += '    }\n\n'
    handlersJs += '    //External PDF\n'
    handlersJs += '    function openExternalPDF(e, pdfUrl) {\n'
    handlersJs += '        if (typeof appHost !== \'undefined\') {\n'
    handlersJs += '            appHost.requestPDFView(pdfUrl);\n'
    handlersJs += '        } else {\n'
    handlersJs += '            window.open(pdfUrl);\n'
    handlersJs += '        }\n'
    handlersJs += '    }\n\n'

    // Resolve URLs: exits() mapping → clickTag variable → actual URL
    var clickTagCounter = 1
    clickHandlers.forEach(function(handler) {
      var clickVarName = exitsMappings[handler.elementId]
      var resolvedUrl = ''
      if (clickVarName) {
        resolvedUrl = clickTagLookup[clickVarName.toLowerCase()] || ''
      }
      var varName = clickVarName || ('clickTag' + clickTagCounter)
      handler.varName = varName
      handler.resolvedUrl = resolvedUrl
      handler.isPdf = /\.pdf(\b|$)/i.test(resolvedUrl)
      if (!clickVarName) {
        // Fallback: guess from element ID
        handler.isPdf = /pi|prescribing|pdf|patient|fpi/i.test(handler.elementId) && !/logo/i.test(handler.elementId)
      }
      clickTagCounter++
    })

    // Emit clickTag variable declarations with resolved URLs
    clickHandlers.forEach(function(handler) {
      if (handler.resolvedUrl) {
        handlersJs += '    var ' + handler.varName + ' = "' + handler.resolvedUrl + '"\n'
      } else {
        handlersJs += '    var ' + handler.varName + ' = "" // TODO: set correct URL\n'
      }
    })
    handlersJs += '\n'

    handlersJs += '    function assignClickHandlers() {\n'

    clickHandlers.forEach(function(handler) {
      var handlerFn = handler.isPdf ? 'openExternalPDF' : 'openExternalLinkFull'
      var comment = handler.isPdf ? '//PDF' : '//LINK'

      handlersJs += '        ' + comment + '\n'
      handlersJs += '        $(\'#' + handler.elementId + '\')[0].addEventListener("click", function (e) {\n'
      handlersJs += '            ' + handlerFn + '(e, ' + handler.varName + ');\n'
      handlersJs += '        }, false);\n'
    })

    handlersJs += '    }\n\n'
    handlersJs += '    assignClickHandlers();\n'
    handlersJs += '});\n'

    resultAdJs = resultAdJs + handlersJs
    var resolvedCount = clickHandlers.filter(function(h) { return h.resolvedUrl }).length
    changes.push('Added ' + clickHandlers.length + ' click handler(s) to ad.js (' + resolvedCount + ' URLs resolved from exits() function)')
  }

  return {
    html: resultHtml,
    adJs: resultAdJs,
    changed: changes.length > 0,
    changes: changes
  }
}

/**
 * Convert <a href="https://..."> links to device-compatible click handlers
 * Strips href, assigns IDs if needed, generates ad.js click handlers
 * Skips: javascript: hrefs, anchor (#) links, mailto:, already-converted elements
 */
function convertAnchorHrefLinks(html, adJs, jsFolder) {
  jsFolder = jsFolder || 'js'
  var changes = []
  var resultHtml = html
  var resultAdJs = adJs || ''
  var clickHandlers = []
  var autoIdCounter = 1

  // Skip if ad.js already has assignClickHandlers (already converted by another step)
  if (/assignClickHandlers/i.test(resultAdJs)) {
    return { html: resultHtml, adJs: resultAdJs, changed: false, changes: [] }
  }

  // Match <a> tags with http/https href (not javascript:, not #, not mailto:)
  var anchorPattern = /<a\s([^>]*?)href=["'](https?:\/\/[^"']+)["']([^>]*)>/gi

  resultHtml = resultHtml.replace(anchorPattern, function(match, before, url, after) {
    var fullAttrs = before + after

    // Skip if this <a> also has onclick (handled by other converters)
    if (/onclick=/i.test(fullAttrs)) {
      return match
    }

    // Extract existing ID, or generate one
    var idMatch = fullAttrs.match(/id=["']([^"']+)["']/)
    var elementId = idMatch ? idMatch[1] : null

    if (!elementId) {
      elementId = 'autoLink-' + autoIdCounter
      autoIdCounter++
      // Insert the generated ID into the tag
      before = ' id="' + elementId + '"' + before
    }

    // Decode HTML entities in URL (e.g. &amp; → &)
    var decodedUrl = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')

    // Track for ad.js generation
    var isPdf = /\.pdf(\b|$)/i.test(decodedUrl)
    clickHandlers.push({
      elementId: elementId,
      url: decodedUrl,
      isPdf: isPdf
    })

    changes.push('Converted <a href> #' + elementId + ' → ' + url)

    // Remove the href attribute, keep everything else (element becomes a div-like click zone)
    return '<a ' + before + after + '>'
  })

  // Generate ad.js click handler block
  if (clickHandlers.length > 0) {
    var handlersJs = '\n// Click handlers converted from <a href> links\n'
    handlersJs += '$(document).ready(function () {\n\n'
    handlersJs += '    //External Link\n'
    handlersJs += '    function openExternalLinkFull(e, linkUrl) {\n'
    handlersJs += '        if (typeof appHost !== \'undefined\') {\n'
    handlersJs += '            appHost.requestFullscreenBrowserView(linkUrl);\n'
    handlersJs += '        } else {\n'
    handlersJs += '            window.open(linkUrl);\n'
    handlersJs += '        }\n'
    handlersJs += '    }\n\n'
    handlersJs += '    //External PDF\n'
    handlersJs += '    function openExternalPDF(e, pdfUrl) {\n'
    handlersJs += '        if (typeof appHost !== \'undefined\') {\n'
    handlersJs += '            appHost.requestPDFView(pdfUrl);\n'
    handlersJs += '        } else {\n'
    handlersJs += '            window.open(pdfUrl);\n'
    handlersJs += '        }\n'
    handlersJs += '    }\n\n'

    // Emit clickTag variable declarations with actual URLs
    clickHandlers.forEach(function(handler, i) {
      var varName = 'clickTag' + (i + 1)
      handler.varName = varName
      handlersJs += '    var ' + varName + ' = "' + handler.url + '"\n'
    })
    handlersJs += '\n'

    handlersJs += '    function assignClickHandlers() {\n'

    clickHandlers.forEach(function(handler) {
      var handlerFn = handler.isPdf ? 'openExternalPDF' : 'openExternalLinkFull'
      var comment = handler.isPdf ? '//PDF' : '//LINK'

      handlersJs += '        ' + comment + '\n'
      handlersJs += '        $(\'#' + handler.elementId + '\')[0].addEventListener("click", function (e) {\n'
      handlersJs += '            e.preventDefault();\n'
      handlersJs += '            ' + handlerFn + '(e, ' + handler.varName + ');\n'
      handlersJs += '        }, false);\n'
    })

    handlersJs += '    }\n\n'
    handlersJs += '    assignClickHandlers();\n'
    handlersJs += '});\n'

    resultAdJs = resultAdJs + handlersJs

    // Add ad.js script tag to HTML if not present
    var adJsPath = jsFolder + '/ad.js'
    if (!/src=["'][^"']*ad\.js["']/i.test(resultHtml)) {
      var jqueryTagEnd = resultHtml.search(/<script[^>]*jquery[^>]*><\/script>/i)
      if (jqueryTagEnd !== -1) {
        var insertAfter = resultHtml.indexOf('</script>', jqueryTagEnd) + '</script>'.length
        resultHtml = resultHtml.slice(0, insertAfter) +
          '\n    <script type="text/javascript" src="' + adJsPath + '"></script>' +
          resultHtml.slice(insertAfter)
      } else {
        var bodyClose = resultHtml.lastIndexOf('</body>')
        if (bodyClose !== -1) {
          resultHtml = resultHtml.slice(0, bodyClose) +
            '<script type="text/javascript" src="' + adJsPath + '"></script>\n' +
            resultHtml.slice(bodyClose)
        }
      }
    }

    changes.push('Added ' + clickHandlers.length + ' click handler(s) to ad.js from <a href> links')
  }

  return {
    html: resultHtml,
    adJs: resultAdJs,
    changed: changes.length > 0,
    changes: changes
  }
}

/**
 * Remove webkit-scrollbar CSS styles from inline styles
 * These don't work on devices - replaced by JS scroller
 */
function removeWebkitScrollbarStyles(html) {
  var changes = []
  var result = html

  // Pattern to find and comment out webkit-scrollbar CSS rules in style tags
  var styleTagPattern = /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi

  result = result.replace(styleTagPattern, function(match, openTag, cssContent, closeTag) {
    var modifiedCss = cssContent

    // Comment out ::-webkit-scrollbar rules
    var scrollbarRulePattern = /([^\n]*::-webkit-scrollbar(?:-button|-thumb|-track)?[^\{]*\{[^\}]*\})/gi
    var scrollbarMatches = modifiedCss.match(scrollbarRulePattern)

    if (scrollbarMatches && scrollbarMatches.length > 0) {
      changes.push('Commented out ' + scrollbarMatches.length + ' webkit-scrollbar rule(s)')
      modifiedCss = modifiedCss.replace(scrollbarRulePattern, '/* Removed - device uses JS scroller\n$1\n*/')
    }

    return openTag + modifiedCss + closeTag
  })

  return {
    html: result,
    changed: changes.length > 0,
    changes: changes
  }
}

/**
 * Add onWallboardIdleSlideDisplay wrapper around animation code
 */
function addAnimationWrapper(html, adJs) {
  let resultHtml = html
  let resultAdJs = adJs

  // Find the animation function call in HTML (inline script)
  const animCallPattern = /(<script(?![^>]*src=)[^>]*>[\s\S]*?)(animation\s*\(\s*\)\s*;?)([\s\S]*?<\/script>)/i

  if (animCallPattern.test(resultHtml)) {
    resultHtml = resultHtml.replace(animCallPattern, (match, before, animCall, after) => {
      // Replace direct animation() call with wrapper
      const wrappedCall = `
// Device animation trigger
window.onWallboardIdleSlideDisplay = function() {
  animation();
};
// Fallback for testing outside device
if (typeof window.top.AppHost === 'undefined') {
  animation();
}
`
      return before + wrappedCall + after
    })
  }

  return { html: resultHtml, adJs: resultAdJs }
}

/**
 * Add appHost integration to HTML
 */
function addAppHostIntegration(html) {
  var appHostScript = '<script type="text/javascript">\n' +
    '    var appHost = window.appHost = new window.top.AppHost(this);\n' +
    '  </script>'

  // Insert after <head> or at start of <body>
  var result = html
  if (result.includes('<head>')) {
    result = result.replace('<head>', '<head>\n  ' + appHostScript)
  } else if (result.includes('<body>')) {
    result = result.replace('<body>', '<body>\n  ' + appHostScript)
  }

  return { html: result }
}

/**
 * Add console silencing for production
 */
function addConsoleSilencing(html) {
  var consoleSilenceScript = '<script>console.log = console.info = console.warn = console.error = console.timeLog = console.timeEnd = function() {};</script>'

  var result = html
  // Add after appHost script or before </head>
  if (result.includes('</head>')) {
    result = result.replace('</head>', '  ' + consoleSilenceScript + '\n</head>')
  }

  return { html: result, changed: true }
}

/**
 * Detect window.open() calls that may need conversion.
 * NOTE: Does NOT inject handler functions into HTML. Handler functions belong in ad.js only.
 * The dedicated converters (convertJavascriptVoidClicks, convertExitsHandlers,
 * convertAnchorHrefLinks, convertInlineOnclickHandlers) handle the actual conversions
 * and add handlers to ad.js.
 */
function convertClickHandlers(html, adJs) {
  var changes = []
  var resultHtml = html
  var resultAdJs = adJs || ''

  // Detect unconverted window.open() patterns for informational logging
  if (/href=["']javascript:void\(window\.open/i.test(resultHtml)) {
    changes.push('Found window.open() calls - adding device-compatible handlers')
  }

  return {
    html: resultHtml,
    adJs: resultAdJs,
    changed: changes.length > 0,
    changes: changes
  }
}

/**
 * Convert ES6 syntax to ES5 in JavaScript
 */
function convertES6ToES5(js) {
  if (!js) return { js, changed: false, changes: [] }

  var changes = []
  var result = js

  // Convert const to var
  if (/\bconst\s+/.test(result)) {
    changes.push('const → var')
    result = result.replace(/\bconst\s+/g, 'var ')
  }

  // Convert let to var
  if (/\blet\s+/.test(result)) {
    changes.push('let → var')
    result = result.replace(/\blet\s+/g, 'var ')
  }

  // Identify lines with chained arrow assignments: x = () => y = () => z
  // These specific lines should be preserved, but other arrows can still be converted
  var chainedArrowPattern = /=>\s*[^{;\n]*\w+\s*=\s*[^=].*=>/
  var hasChainedArrows = chainedArrowPattern.test(result)
  var chainedLineMarkers = []

  if (hasChainedArrows) {
    // Split into lines, mark chained arrow lines with placeholders
    var lines = result.split('\n')
    var markerIndex = 0

    // Check multi-line chained arrows (accumulate lines until we have a complete statement)
    var accumulatedLines = []
    var lineStartIndices = []

    for (var i = 0; i < lines.length; i++) {
      accumulatedLines.push(lines[i])
      lineStartIndices.push(i - accumulatedLines.length + 1)
      var combined = accumulatedLines.join('\n')

      // Check if this accumulated block has chained arrows
      if (chainedArrowPattern.test(combined)) {
        // Check if we have a complete statement (ends with function call or semicolon-ish)
        var trimmed = combined.trim()
        var isComplete = /\)\s*$/.test(trimmed) || /;\s*$/.test(trimmed) ||
                        (trimmed.split('=>').length > 2 && /\w+\s*\([^)]*\)\s*$/.test(trimmed))

        if (isComplete) {
          // Replace these lines with a marker
          var marker = '___CHAINED_ARROW_' + markerIndex + '___'
          chainedLineMarkers.push({ marker: marker, content: combined })
          markerIndex++

          // Replace lines in the array
          var startIdx = lineStartIndices[0]
          lines[startIdx] = marker
          for (var j = startIdx + 1; j <= i; j++) {
            lines[j] = ''
          }
          accumulatedLines = []
          lineStartIndices = []
        }
      } else if (!/=>\s*$/.test(lines[i]) && !/\.onload\s*=\s*$/.test(lines[i])) {
        // Line doesn't look like it continues, reset accumulator
        accumulatedLines = []
        lineStartIndices = []
      }
    }

    result = lines.filter(function(line) { return line !== '' }).join('\n')
    changes.push('chained arrows: preserved (manual conversion needed)')
  }

  // Now convert remaining arrow functions (non-chained)
    // Convert arrow functions using multiple passes for nested arrows
    // First pass: convert expression arrows (no braces) - these are simple
    // Second pass: convert block arrows from innermost to outermost

    var maxPasses = 10 // Safety limit
    var passCount = 0
    var madeChanges = true

    while (madeChanges && passCount < maxPasses) {
      madeChanges = false
      passCount++

      // Pattern: (args) => simple_expression (no braces, no nested arrows)
      // This handles: x => x + 1, (a, b) => a + b, () => doSomething()
      var arrowExprPattern = /(\([\w\s,=]*\)|\w+)\s*=>\s*([^{},;\n][^,;\n]*)/g
      var exprResult = result.replace(arrowExprPattern, function(match, args, body) {
        // Skip if body contains => (would be handled in later pass)
        if (/=>/.test(body)) {
          return match
        }
        // Skip if this looks like it's inside a larger structure
        var trimmedBody = body.trim()
        if (!trimmedBody || trimmedBody.startsWith('{')) {
          return match
        }
        var cleanArgs = args.replace(/[()]/g, '').trim()
        madeChanges = true
        return 'function(' + cleanArgs + ') { return ' + trimmedBody + '; }'
      })
      result = exprResult

      // Pattern: (args) => { body } - arrow with block body
      // Use a function to find matching braces properly
      var arrowBlockMatch = result.match(/(\([\w\s,=]*\)|\w+)\s*=>\s*\{/)
      if (arrowBlockMatch) {
        var matchIndex = result.indexOf(arrowBlockMatch[0])
        var arrowIndex = result.indexOf('=>', matchIndex)
        var braceStart = result.indexOf('{', arrowIndex)

        if (braceStart !== -1) {
          // Find matching closing brace
          var braceCount = 1
          var braceEnd = braceStart + 1
          while (braceCount > 0 && braceEnd < result.length) {
            var char = result[braceEnd]
            if (char === '{') braceCount++
            else if (char === '}') braceCount--
            braceEnd++
          }

          if (braceCount === 0) {
            // Found matching brace - extract and convert
            var args = arrowBlockMatch[1]
            var body = result.substring(braceStart, braceEnd)
            var fullMatch = result.substring(matchIndex, braceEnd)

            var cleanArgs = args.replace(/[()]/g, '').trim()
            var replacement = 'function(' + cleanArgs + ') ' + body

            result = result.substring(0, matchIndex) + replacement + result.substring(braceEnd)
            madeChanges = true
          }
        }
      }
    }

  if (passCount > 1) {
    changes.push('arrow functions → regular functions (' + passCount + ' passes for nested arrows)')
  } else if (passCount === 1 && madeChanges) {
    changes.push('arrow functions → regular functions')
  }

  // Restore chained arrow markers with original content
  if (chainedLineMarkers && chainedLineMarkers.length > 0) {
    chainedLineMarkers.forEach(function(item) {
      result = result.replace(item.marker, item.content)
    })
  }

  // Convert .includes() to .indexOf() !== -1 (ES6 String/Array method not in Chrome 69)
  var includesPattern = /(\w+(?:\.\w+)*)\.includes\s*\(([^)]+)\)/g
  if (includesPattern.test(result)) {
    changes.push('.includes() → .indexOf() !== -1')
    includesPattern = /(\w+(?:\.\w+)*)\.includes\s*\(([^)]+)\)/g
    result = result.replace(includesPattern, function(match, obj, arg) {
      return obj + '.indexOf(' + arg + ') !== -1'
    })
  }

  // Convert template literals to string concatenation (simple cases)
  var templatePattern = /`([^`]*)`/g
  if (templatePattern.test(result)) {
    changes.push('template literals → string concatenation')
    // Reset regex
    templatePattern = /`([^`]*)`/g
    result = result.replace(templatePattern, function(match, content) {
      // Convert ${expr} to " + expr + "
      var converted = content.replace(/\$\{([^}]+)\}/g, '" + $1 + "')
      return '"' + converted + '"'
    })
  }

  return { js: result, changed: changes.length > 0, changes: changes }
}

/**
 * Convert ES6 in inline HTML scripts
 */
function convertInlineES6(html) {
  const changes = []
  let result = html

  // Find inline scripts and convert ES6
  const scriptPattern = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi

  result = result.replace(scriptPattern, (match, content) => {
    const converted = convertES6ToES5(content)
    if (converted.changed) {
      changes.push(...converted.changes)
      return match.replace(content, converted.js)
    }
    return match
  })

  return { html: result, changed: changes.length > 0, changes: [...new Set(changes)] }
}

/**
 * Add structured compatibility fixes based on detected issues
 */
function addCompatibilityFixes(result, html, adJs) {
  const allCode = html + '\n' + adJs

  // SVG detection
  if (html.includes('<svg') || html.includes('.svg')) {
    result.fixes.push({
      id: 'svg-elements',
      category: 'Compatibility',
      issue: 'SVG elements detected in ad',
      reason: 'Target devices (BrightSign/MW22/MW15) do not support SVG rendering',
      action: 'manual',
      resolution: 'Replace SVG graphics with PNG/JPG equivalents'
    })
  }

  // Modern JS features
  if (adJs.includes('fetch(')) {
    result.fixes.push({
      id: 'fetch-api',
      category: 'Compatibility',
      issue: 'fetch() API detected',
      reason: 'Devices run Chrome 69 which has limited fetch support',
      action: 'manual',
      resolution: 'Replace with XMLHttpRequest or remove if not needed'
    })
  }

  if (adJs.includes('async ') || adJs.includes('await ')) {
    result.fixes.push({
      id: 'async-await',
      category: 'Compatibility',
      issue: 'async/await syntax detected',
      reason: 'May not work reliably on Chrome 69',
      action: 'manual',
      resolution: 'Replace with Promise chains or callbacks'
    })
  }

  if (adJs.includes('=>')) {
    result.fixes.push({
      id: 'arrow-functions',
      category: 'Compatibility',
      issue: 'Arrow functions (=>) detected',
      reason: 'Can cause issues on older device browsers',
      action: 'auto',
      resolution: 'Will convert to traditional function syntax on export'
    })
  }

  // ES6+ variables
  if (adJs.includes('const ') || adJs.includes('let ')) {
    result.fixes.push({
      id: 'es6-variables',
      category: 'Compatibility',
      issue: 'ES6 variable declarations (const/let) detected',
      reason: 'var is more reliable across all target device browsers',
      action: 'auto',
      resolution: 'Will convert to var declarations on export'
    })
  }

  // Template literals
  if (adJs.includes('`')) {
    result.fixes.push({
      id: 'template-literals',
      category: 'Compatibility',
      issue: 'Template literals (backticks) detected',
      reason: 'May not work on older device browsers',
      action: 'auto',
      resolution: 'Will convert to string concatenation on export'
    })
  }

  // AppHost integration
  if (!html.includes('appHost') && !adJs.includes('appHost')) {
    result.fixes.push({
      id: 'apphost-missing',
      category: 'Device Integration',
      issue: 'AppHost integration not detected',
      reason: 'AppHost is required for device-specific features (click tracking, modal ads, etc.)',
      action: 'auto',
      resolution: 'Will add standard AppHost integration code on export'
    })
  }

  // GWD timeline animations
  if (html.includes('gwd.') || html.includes('gwd-') && (html.includes('timeline') || html.includes('animation'))) {
    result.fixes.push({
      id: 'gwd-timeline',
      category: 'Animation',
      issue: 'GWD timeline animations detected',
      reason: 'GWD animation runtime is not available on target devices',
      action: 'manual',
      resolution: 'Rebuild animations using the Animation Editor with TweenMax'
    })
  }
}

/**
 * Detect if HTML is from Google Web Designer
 */
function detectGWD(html) {
  const indicators = {
    hasGwdImage: /<gwd-image/i.test(html),
    hasGwdPage: /<gwd-page/i.test(html),
    hasGwdPagedeck: /<gwd-pagedeck/i.test(html),
    hasGwdTaparea: /<gwd-taparea/i.test(html),
    hasGwdVideo: /<gwd-video/i.test(html),
    hasGwdGenericAd: /<gwd-genericad/i.test(html),
    hasGwdDoubleclick: /<gwd-doubleclick/i.test(html),
    hasGwdAd: /<gwd-ad/i.test(html),
    hasGwdSwipyGallery: /<gwd-swipy-gallery/i.test(html),
    hasGwdCarousel: /<gwd-carousel/i.test(html),
    hasGwdRuntime: /gwd-[a-z]+_[a-z]+\.js/i.test(html) || /gwdid/i.test(html),
    hasWebComponents: /webcomponents/i.test(html)
  }

  const isGWD = Object.values(indicators).some(v => v)

  return {
    isGWD,
    indicators
  }
}

/**
 * Convert GWD elements to standard HTML
 */
function convertGWDToStandard(html) {
  const conversions = []
  let convertedHtml = html

  // Convert <gwd-image source="..."> to <img src="...">
  const gwdImagePattern = /<gwd-image([^>]*)><\/gwd-image>/gi
  const gwdImageMatches = html.match(gwdImagePattern) || []

  gwdImageMatches.forEach(match => {
    // Extract attributes
    const sourceMatch = match.match(/source=["']([^"']+)["']/i)
    const idMatch = match.match(/id=["']([^"']+)["']/i)
    const classMatch = match.match(/class=["']([^"']+)["']/i)
    const styleMatch = match.match(/style=["']([^"']+)["']/i)
    const scalingMatch = match.match(/scaling=["']([^"']+)["']/i)

    if (sourceMatch) {
      let imgTag = '<img'
      imgTag += ` src="${sourceMatch[1]}"`
      if (idMatch) imgTag += ` id="${idMatch[1]}"`
      if (classMatch) imgTag += ` class="${classMatch[1]}"`

      // Handle scaling attribute - convert to object-fit style
      let style = styleMatch ? styleMatch[1] : ''
      if (scalingMatch) {
        const scaling = scalingMatch[1]
        if (scaling === 'cover') style += '; object-fit: cover'
        else if (scaling === 'contain') style += '; object-fit: contain'
        else if (scaling === 'fill') style += '; object-fit: fill'
      }
      if (style) imgTag += ` style="${style.replace(/^;\s*/, '')}"`

      imgTag += '>'

      convertedHtml = convertedHtml.replace(match, imgTag)
      conversions.push({
        from: `<gwd-image source="${sourceMatch[1]}">`,
        to: `<img src="${sourceMatch[1]}">`
      })
    }
  })

  // Also handle self-closing gwd-image tags
  const gwdImageSelfClosing = /<gwd-image([^>]*)\/>/gi
  const selfClosingMatches = html.match(gwdImageSelfClosing) || []

  selfClosingMatches.forEach(match => {
    const sourceMatch = match.match(/source=["']([^"']+)["']/i)
    const idMatch = match.match(/id=["']([^"']+)["']/i)
    const classMatch = match.match(/class=["']([^"']+)["']/i)
    const styleMatch = match.match(/style=["']([^"']+)["']/i)

    if (sourceMatch) {
      let imgTag = '<img'
      imgTag += ` src="${sourceMatch[1]}"`
      if (idMatch) imgTag += ` id="${idMatch[1]}"`
      if (classMatch) imgTag += ` class="${classMatch[1]}"`
      if (styleMatch) imgTag += ` style="${styleMatch[1]}"`
      imgTag += '>'

      convertedHtml = convertedHtml.replace(match, imgTag)
      conversions.push({
        from: `<gwd-image source="${sourceMatch[1]}"/>`,
        to: `<img src="${sourceMatch[1]}">`
      })
    }
  })

  // Convert <gwd-video source="..."> to <video src="...">
  const gwdVideoPattern = /<gwd-video([^>]*)>(<\/gwd-video>)?/gi
  let videoMatch
  while ((videoMatch = gwdVideoPattern.exec(html)) !== null) {
    const attrs = videoMatch[1]
    const sourceMatch = attrs.match(/source=["']([^"']+)["']/i)
    const idMatch = attrs.match(/id=["']([^"']+)["']/i)

    if (sourceMatch) {
      let videoTag = '<video'
      videoTag += ` src="${sourceMatch[1]}"`
      if (idMatch) videoTag += ` id="${idMatch[1]}"`
      videoTag += ' autoplay></video>'

      convertedHtml = convertedHtml.replace(videoMatch[0], videoTag)
      conversions.push({
        from: `<gwd-video source="${sourceMatch[1]}">`,
        to: `<video src="${sourceMatch[1]}">`
      })
    }
  }

  // Convert <gwd-taparea> to <div> with click handler
  const gwdTapareaPattern = /<gwd-taparea([^>]*)>([\s\S]*?)<\/gwd-taparea>/gi
  let tapMatch
  while ((tapMatch = gwdTapareaPattern.exec(html)) !== null) {
    const attrs = tapMatch[1]
    const content = tapMatch[2]
    const idMatch = attrs.match(/id=["']([^"']+)["']/i)
    const classMatch = attrs.match(/class=["']([^"']+)["']/i)

    let divTag = '<div'
    if (idMatch) divTag += ` id="${idMatch[1]}"`
    divTag += ` class="click-zone${classMatch ? ' ' + classMatch[1] : ''}"`
    divTag += ` style="cursor: pointer;"`
    divTag += `>${content}</div>`

    convertedHtml = convertedHtml.replace(tapMatch[0], divTag)
    conversions.push({
      from: `<gwd-taparea${idMatch ? ` id="${idMatch[1]}"` : ''}>`,
      to: `<div class="click-zone">`
    })
  }

  // Remove GWD script tags with src attribute (they won't work outside GWD)
  const gwdScriptPattern = /<script[^>]*src=["'][^"']*gwd[^"']*["'][^>]*><\/script>/gi
  const gwdScripts = convertedHtml.match(gwdScriptPattern) || []
  gwdScripts.forEach(script => {
    convertedHtml = convertedHtml.replace(script, '')
    conversions.push({
      from: script.substring(0, 50) + '...',
      to: '(removed - GWD runtime not needed)'
    })
  })

  // Remove INLINE GWD scripts with data-source attribute (these contain the GWD runtime code)
  // Pattern matches: <script data-source="gwdimage_min.js" ...>...</script>
  const inlineGwdScriptPattern = /<script[^>]*data-source=["'][^"']*gwd[^"']*["'][^>]*>[\s\S]*?<\/script>/gi
  const inlineGwdScripts = convertedHtml.match(inlineGwdScriptPattern) || []
  inlineGwdScripts.forEach(script => {
    convertedHtml = convertedHtml.replace(script, '')
    var dataSourceMatch = script.match(/data-source=["']([^"']+)["']/i)
    conversions.push({
      from: 'inline GWD script: ' + (dataSourceMatch ? dataSourceMatch[1] : 'unknown'),
      to: '(removed - GWD runtime code)'
    })
  })

  // Remove Enabler.js (Google Ad Manager/DoubleClick Studio)
  const enablerPattern = /<script[^>]*src=["'][^"']*Enabler\.js[^"']*["'][^>]*><\/script>/gi
  const enablerScripts = convertedHtml.match(enablerPattern) || []
  enablerScripts.forEach(script => {
    convertedHtml = convertedHtml.replace(script, '')
    conversions.push({
      from: 'Enabler.js',
      to: '(removed - Google Ad Manager runtime)'
    })
  })

  // Remove webcomponents scripts (both src and inline)
  const webcompPattern = /<script[^>]*src=["'][^"']*webcomponents[^"']*["'][^>]*><\/script>/gi
  const webcompScripts = convertedHtml.match(webcompPattern) || []
  webcompScripts.forEach(script => {
    convertedHtml = convertedHtml.replace(script, '')
    conversions.push({
      from: 'webcomponents script',
      to: '(removed - not needed)'
    })
  })

  // Remove inline webcomponents scripts
  const inlineWebcompPattern = /<script[^>]*data-source=["'][^"']*webcomponents[^"']*["'][^>]*>[\s\S]*?<\/script>/gi
  const inlineWebcompScripts = convertedHtml.match(inlineWebcompPattern) || []
  inlineWebcompScripts.forEach(script => {
    convertedHtml = convertedHtml.replace(script, '')
    conversions.push({
      from: 'inline webcomponents script',
      to: '(removed - not needed)'
    })
  })

  // Remove GWD event scripts (support, handlers, registration)
  // These contain GWD runtime code that doesn't work on devices
  const gwdEventScriptPattern = /<script[^>]*gwd-events=["'][^"']*["'][^>]*>[\s\S]*?<\/script>/gi
  const gwdEventScripts = convertedHtml.match(gwdEventScriptPattern) || []
  gwdEventScripts.forEach(script => {
    convertedHtml = convertedHtml.replace(script, '')
    var eventTypeMatch = script.match(/gwd-events=["']([^"']+)["']/i)
    conversions.push({
      from: 'GWD event script: ' + (eventTypeMatch ? eventTypeMatch[1] : 'unknown'),
      to: '(removed - GWD runtime code)'
    })
  })

  // Remove gwd-metric-configuration and gwd-metric-event elements
  const gwdMetricPattern = /<gwd-metric-configuration[^>]*>[\s\S]*?<\/gwd-metric-configuration>/gi
  const gwdMetrics = convertedHtml.match(gwdMetricPattern) || []
  gwdMetrics.forEach(element => {
    convertedHtml = convertedHtml.replace(element, '')
    conversions.push({
      from: 'gwd-metric-configuration',
      to: '(removed - GWD analytics not needed)'
    })
  })

  // Remove standalone gwd-metric-event elements (if any outside configuration)
  convertedHtml = convertedHtml.replace(/<gwd-metric-event[^>]*\/?>/gi, '')

  // Extract and remove gwd-exit elements (URL definitions in GWD ads)
  const gwdExitUrls = []
  const gwdExitExtractPattern = /<gwd-exit[^>]*metric=["']([^"']+)["'][^>]*url=["']([^"']+)["'][^>]*\/?>/gi
  let gwdExitMatch
  while ((gwdExitMatch = gwdExitExtractPattern.exec(convertedHtml)) !== null) {
    gwdExitUrls.push({
      id: gwdExitMatch[1],
      url: gwdExitMatch[2],
      type: /\.pdf(\b|$)/i.test(gwdExitMatch[2]) ? 'pdf' : 'gwd-exit',
      element: gwdExitMatch[1]
    })
  }
  const gwdExitPattern = /<gwd-exit[^>]*\/?>/gi
  const gwdExits = convertedHtml.match(gwdExitPattern) || []
  gwdExits.forEach(element => {
    convertedHtml = convertedHtml.replace(element, '')
    conversions.push({
      from: 'gwd-exit element',
      to: '(removed - URL extracted to clickTag)'
    })
  })
  // Also remove orphaned </gwd-exit> closing tags
  convertedHtml = convertedHtml.replace(/<\/gwd-exit>/gi, '')

  // Remove gwd-admetadata script (contains component list, not needed after conversion)
  const gwdAdmetadataPattern = /<script[^>]*type=["']text\/gwd-admetadata["'][^>]*>[\s\S]*?<\/script>/gi
  convertedHtml = convertedHtml.replace(gwdAdmetadataPattern, '')

  // Remove dclk-quick-preview scripts (DoubleClick preview mode)
  const dclkPreviewPattern = /<script[^>]*data-exports-type=["']dclk-quick-preview["'][^>]*>[\s\S]*?<\/script>/gi
  convertedHtml = convertedHtml.replace(dclkPreviewPattern, '')

  // Extract Enabler.exit() URL mappings from StudioExports/gwd-studio-registration scripts
  const studioRegPattern = /<script[^>]*data-exports-type=["']gwd-studio-registration["'][^>]*>([\s\S]*?)<\/script>/gi
  let studioMatch
  while ((studioMatch = studioRegPattern.exec(convertedHtml)) !== null) {
    const scriptContent = studioMatch[1]
    const enablerExitPattern = /Enabler\.exit\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/g
    let exitMatch
    while ((exitMatch = enablerExitPattern.exec(scriptContent)) !== null) {
      // Only add if not already captured from gwd-exit elements
      const alreadyCaptured = gwdExitUrls.some(function(e) { return e.id === exitMatch[1] })
      if (!alreadyCaptured) {
        gwdExitUrls.push({
          id: exitMatch[1],
          url: exitMatch[2],
          type: /\.pdf(\b|$)/i.test(exitMatch[2]) ? 'pdf' : 'gwd-exit',
          element: exitMatch[1]
        })
      }
    }
  }
  // Remove StudioExports / gwd-studio-registration scripts (dead code)
  convertedHtml = convertedHtml.replace(/<script[^>]*data-exports-type=["']gwd-studio-registration["'][^>]*>[\s\S]*?<\/script>/gi, '')
  conversions.push({ from: 'StudioExports / Enabler.exit() script', to: '(removed - URLs extracted to ad.js)' })

  // IMPORTANT: Convert gwd-pagedeck BEFORE gwd-page (gwd-pagedeck starts with "gwd-page")
  // Convert gwd-pagedeck to div
  convertedHtml = convertedHtml.replace(/<gwd-pagedeck([^>]*)>/gi, '<div$1>')
  convertedHtml = convertedHtml.replace(/<\/gwd-pagedeck>/gi, '</div>')

  // Convert gwd-page to div (after gwd-pagedeck to avoid partial match)
  convertedHtml = convertedHtml.replace(/<gwd-page([^>]*)>/gi, '<div$1>')
  convertedHtml = convertedHtml.replace(/<\/gwd-page>/gi, '</div>')

  // Convert gwd-genericad/gwd-ad/gwd-google-ad to div
  convertedHtml = convertedHtml.replace(/<gwd-genericad([^>]*)>/gi, '<div$1>')
  convertedHtml = convertedHtml.replace(/<\/gwd-genericad>/gi, '</div>')
  convertedHtml = convertedHtml.replace(/<gwd-google-ad([^>]*)>/gi, '<div$1>')
  convertedHtml = convertedHtml.replace(/<\/gwd-google-ad>/gi, '</div>')
  convertedHtml = convertedHtml.replace(/<gwd-ad([^>]*)>/gi, '<div$1>')
  convertedHtml = convertedHtml.replace(/<\/gwd-ad>/gi, '</div>')

  return {
    html: convertedHtml,
    conversions,
    gwdExitUrls
  }
}

/**
 * Convert GSAP 3.x syntax to TweenMax 2.x syntax
 * GSAP 3.x: gsap.to('#el', { duration: 1, opacity: 1, ease: "power2.out" })
 * TweenMax: tl.to('#el', 1, { opacity: 1, ease: "power2.out" })
 */
function convertGsap3ToTweenMax(js) {
  if (!js) return { js, changed: false, changes: [] }

  const changes = []
  let result = js

  // Check if this is GSAP 3.x code
  const isGsap3 = /gsap\s*\.\s*(to|from|fromTo|set|timeline)/i.test(js)
  if (!isGsap3) {
    return { js, changed: false, changes: [] }
  }

  // Convert gsap.timeline({config}) to new TimelineMax({config})
  // Handles: gsap.timeline(), gsap.timeline({}), gsap.timeline({delay:1}), etc.
  if (/gsap\s*\.\s*timeline\s*\(/i.test(result)) {
    // With config object: gsap.timeline({delay:1}) → new TimelineMax({delay:1})
    result = result.replace(/gsap\s*\.\s*timeline\s*\(\s*\{([^}]*)\}\s*\)/gi, function(match, config) {
      var configStr = config.trim()
      if (configStr === '') {
        return 'new TimelineMax()'
      }
      return 'new TimelineMax({' + configStr + '})'
    })
    // Empty parens: gsap.timeline() → new TimelineMax()
    result = result.replace(/gsap\s*\.\s*timeline\s*\(\s*\)/gi, 'new TimelineMax()')
    changes.push('gsap.timeline() → new TimelineMax()')
  }

  // Always use TweenMax for standalone gsap.set()/gsap.to()/gsap.from() calls.
  // Even when gsap.timeline() is present, standalone gsap.to() calls are NOT on the timeline —
  // they're fire-and-forget tweens. TweenMax.to() is the correct TweenMax 2.0.1 equivalent.
  var standalonePrefix = 'TweenMax'

  // Convert gsap.set(selector, {...}) to TweenMax.set()/tl.set()
  // Supports both string selectors '#el' and array selectors ['#el', '#el2']
  result = result.replace(/gsap\s*\.\s*set\s*\(/gi, standalonePrefix + '.set(')
  if (/gsap\s*\.\s*set/.test(js)) {
    changes.push('gsap.set() → ' + standalonePrefix + '.set()')
  }

  // Convert gsap.delayedCall(time, fn) → TweenMax.delayedCall(time, fn)
  // delayedCall is always TweenMax (it's a static utility, not a timeline method)
  result = result.replace(/gsap\s*\.\s*delayedCall\s*\(/gi, 'TweenMax.delayedCall(')
  if (/gsap\s*\.\s*delayedCall/.test(js)) {
    changes.push('gsap.delayedCall() → TweenMax.delayedCall()')
  }

  // Convert gsap.to/from/fromTo calls using brace-counting to handle nested objects
  // Handles: gsap.to(sel, {scrollTo: {y: 100}, duration: 1, onComplete: fn})
  var gsapCallMethods = ['to', 'from', 'fromTo']
  for (var mi = 0; mi < gsapCallMethods.length; mi++) {
    var method = gsapCallMethods[mi]
    var methodPattern = new RegExp('gsap\\s*\\.\\s*' + method + '\\s*\\(', 'gi')
    var methodMatch
    // Process from end to start so indices don't shift
    var methodMatches = []
    while ((methodMatch = methodPattern.exec(result)) !== null) {
      methodMatches.push({ index: methodMatch.index, matchLen: methodMatch[0].length })
    }
    for (var mmi = methodMatches.length - 1; mmi >= 0; mmi--) {
      var mInfo = methodMatches[mmi]
      var afterOpen = mInfo.index + mInfo.matchLen // position right after the '('
      // Find the matching closing ')' using brace/paren counting
      var fullCallEnd = findMatchingClose(result, afterOpen - 1, '(', ')')
      if (fullCallEnd === -1) continue
      var argsStr = result.substring(afterOpen, fullCallEnd)
      var converted = convertGsapFullCall(method, argsStr, standalonePrefix)
      if (converted !== null) {
        result = result.substring(0, mInfo.index) + converted + result.substring(fullCallEnd + 1)
      }
    }
    if (new RegExp('gsap\\s*\\.\\s*' + method, 'i').test(js)) {
      changes.push('gsap.' + method + '() → ' + standalonePrefix + '.' + method + '()')
    }
  }

  // Convert gsap.defaults({...}) → removed (TweenMax doesn't have global defaults)
  if (/gsap\s*\.\s*defaults\s*\(/i.test(result)) {
    result = result.replace(/gsap\s*\.\s*defaults\s*\([^)]*\)\s*;?/gi, '/* gsap.defaults() removed — set defaults per-tween */')
    changes.push('gsap.defaults() removed (not available in TweenMax 2.0.1)')
  }

  // Convert timeline .to(selector, { props }, 'label') calls using brace-counting
  // These are chained calls like tl.to('.el', { opacity: 1 }, 'frame1')
  // In TweenMax: tl.to('.el', duration, { opacity: 1 }, 'frame1')
  var tlMethods = ['to', 'from', 'fromTo']
  for (var tmi = 0; tmi < tlMethods.length; tmi++) {
    var tlMethod = tlMethods[tmi]
    // Match: .to( or .from( — but NOT gsap.to( (already handled) or TweenMax.to( (already correct)
    var tlCallPattern = new RegExp('(?<!gsap\\s*)\\.\\s*' + tlMethod + '\\s*\\(', 'gi')
    var tlCallMatch
    var tlCallMatches = []
    while ((tlCallMatch = tlCallPattern.exec(result)) !== null) {
      // Skip if preceded by TweenMax or gsap
      var precedingChars = result.substring(Math.max(0, tlCallMatch.index - 10), tlCallMatch.index)
      if (/TweenMax\s*$/i.test(precedingChars) || /gsap\s*$/i.test(precedingChars)) continue
      tlCallMatches.push({ index: tlCallMatch.index, matchLen: tlCallMatch[0].length })
    }
    for (var tci = tlCallMatches.length - 1; tci >= 0; tci--) {
      var tcInfo = tlCallMatches[tci]
      var tcAfterOpen = tcInfo.index + tcInfo.matchLen
      var tcCallEnd = findMatchingClose(result, tcAfterOpen - 1, '(', ')')
      if (tcCallEnd === -1) continue
      var tcArgsStr = result.substring(tcAfterOpen, tcCallEnd).trim()
      // Only convert if the first argument is followed by { (GSAP 3 format)
      // Skip if already in TweenMax format: .to(sel, duration, {props})
      var tcCommaIdx = -1
      if (tcArgsStr[0] === "'" || tcArgsStr[0] === '"' || tcArgsStr[0] === '`') {
        var tcQ = tcArgsStr.indexOf(tcArgsStr[0], 1)
        if (tcQ !== -1) tcCommaIdx = tcArgsStr.indexOf(',', tcQ)
      } else if (tcArgsStr[0] === '[') {
        var tcBracket = findMatchingClose(tcArgsStr, 0, '[', ']')
        if (tcBracket !== -1) tcCommaIdx = tcArgsStr.indexOf(',', tcBracket)
      } else {
        tcCommaIdx = tcArgsStr.indexOf(',')
      }
      if (tcCommaIdx === -1) continue
      var tcRest = tcArgsStr.substring(tcCommaIdx + 1).trim()
      // Only convert if rest starts with { (GSAP 3 object format, not numeric duration)
      if (tcRest[0] !== '{') continue
      var tcSelector = tcArgsStr.substring(0, tcCommaIdx).trim()
      var tcBraceEnd = findMatchingClose(tcRest, 0, '{', '}')
      if (tcBraceEnd === -1) continue
      var tcPropsInner = tcRest.substring(1, tcBraceEnd)
      var tcAfterProps = tcRest.substring(tcBraceEnd + 1).trim()
      var tcExtracted = extractDurationFromPropsTopLevel(tcPropsInner)
      var tcPositionArg = ''
      if (tcAfterProps.length > 0 && tcAfterProps[0] === ',') {
        tcPositionArg = tcAfterProps
      }
      var tcPrefix = result.substring(tcInfo.index, tcAfterOpen - 1) // e.g. ".to"
      var tcReplacement = tcPrefix + '(' + tcSelector + ', ' + tcExtracted.duration + ', {' + tcExtracted.otherProps + '}' + tcPositionArg + ')'
      result = result.substring(0, tcInfo.index) + tcReplacement + result.substring(tcCallEnd + 1)
    }
  }

  // Post-process: convert bare GSAP 3 ease references to TweenMax format
  // Sine.ease → Sine.easeOut, Power2.ease → Power2.easeOut, etc.
  // These are GSAP 3 shorthand that doesn't exist in TweenMax 2.0.1
  result = result.replace(/\b(Sine|Power[0-4]|Back|Elastic|Bounce|Circ|Expo)\.ease\b/g, function(match, name) {
    changes.push(match + ' → ' + name + '.easeOut')
    return name + '.easeOut'
  })

  var changed = result !== js
  return { js: result, changed: changed, changes: changes }
}

/**
 * Helper to convert a single gsap.to/from call to TweenMax format
 */
function convertGsapCallToTweenMax(method, selector, propsStr, prefix) {
  prefix = prefix || 'TweenMax'
  var extracted = extractDurationFromProps(propsStr)
  return prefix + '.' + method + '(' + selector + ', ' + extracted.duration + ', {' + extracted.otherProps + '})'
}

/**
 * Find the index of the matching closing bracket/paren, handling nesting.
 * startIdx should point to the opening bracket/paren.
 * Returns the index of the matching close, or -1 if not found.
 */
function findMatchingClose(str, startIdx, openChar, closeChar) {
  var depth = 0
  var inString = false
  var stringChar = ''
  for (var i = startIdx; i < str.length; i++) {
    var ch = str[i]
    if (inString) {
      if (ch === stringChar && str[i - 1] !== '\\') inString = false
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inString = true
      stringChar = ch
      continue
    }
    if (ch === openChar) depth++
    else if (ch === closeChar) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Convert a full gsap.to/from/fromTo call's arguments to TweenMax format.
 * Uses brace-counting to properly handle nested objects like scrollTo: {y: 100}.
 *
 * gsap.to(selector, {duration: 1, scrollTo: {y: 100}, ease: "none"})
 * → TweenMax.to(selector, 1, {scrollTo: {y: 100}, ease: "none"})
 *
 * gsap.to(selector, 0.5, {props}) — hybrid format, just prefix swap
 * → TweenMax.to(selector, 0.5, {props})
 */
function convertGsapFullCall(method, argsStr, prefix) {
  prefix = prefix || 'TweenMax'
  // argsStr is everything between the outer parens: selector, {props} or selector, duration, {props}

  // Find the first argument (selector) — could be a string, variable, or array
  var trimmed = argsStr.trim()

  // Find the comma after the selector
  var selectorEnd = -1
  if (trimmed[0] === "'" || trimmed[0] === '"' || trimmed[0] === '`') {
    // String selector — find closing quote then comma
    var quoteChar = trimmed[0]
    var closeQuote = trimmed.indexOf(quoteChar, 1)
    if (closeQuote === -1) return null
    selectorEnd = trimmed.indexOf(',', closeQuote)
  } else if (trimmed[0] === '[') {
    // Array selector — find matching ]
    var closeBracket = findMatchingClose(trimmed, 0, '[', ']')
    if (closeBracket === -1) return null
    selectorEnd = trimmed.indexOf(',', closeBracket)
  } else {
    // Variable reference (e.g. isiScroller) — find first comma
    selectorEnd = trimmed.indexOf(',')
  }

  if (selectorEnd === -1) return null

  var selector = trimmed.substring(0, selectorEnd).trim()
  var rest = trimmed.substring(selectorEnd + 1).trim()

  // Check if rest starts with a number (hybrid format: gsap.to(sel, 0.5, {props}))
  if (/^[\d.]/.test(rest)) {
    // Hybrid format — just swap the prefix, keep everything as-is
    return prefix + '.' + method + '(' + selector + ', ' + rest + ')'
  }

  // Check if rest starts with { (standard GSAP 3 format with props object)
  if (rest[0] === '{') {
    // Find the matching closing brace using brace-counting
    // rest includes everything from { to the end of argsStr
    var propsContent = rest.substring(1) // skip the opening {
    // Find matching } for the outer props object
    var braceEnd = findMatchingClose(rest, 0, '{', '}')
    if (braceEnd === -1) return null

    var propsInner = rest.substring(1, braceEnd) // content between outer { }
    var afterProps = rest.substring(braceEnd + 1).trim()

    // Extract duration from props (handles nested objects by only matching top-level duration)
    var extracted = extractDurationFromPropsTopLevel(propsInner)

    // For fromTo, we have two objects: gsap.fromTo(sel, {from}, {to})
    // The first object has no duration, second has duration
    if (method === 'fromTo') {
      // rest is: {fromProps}, {toProps}  or  {fromProps}, duration, {toProps}
      var fromEnd = findMatchingClose(rest, 0, '{', '}')
      if (fromEnd === -1) return null
      var fromProps = rest.substring(0, fromEnd + 1)
      var afterFrom = rest.substring(fromEnd + 1).trim()
      if (afterFrom[0] === ',') afterFrom = afterFrom.substring(1).trim()
      if (afterFrom[0] === '{') {
        var toEnd = findMatchingClose(afterFrom, 0, '{', '}')
        if (toEnd === -1) return null
        var toInner = afterFrom.substring(1, toEnd)
        var afterTo = afterFrom.substring(toEnd + 1).trim()
        var toExtracted = extractDurationFromPropsTopLevel(toInner)
        return prefix + '.' + method + '(' + selector + ', ' + toExtracted.duration + ', ' + fromProps + ', {' + toExtracted.otherProps + '}' + afterTo + ')'
      }
      return null
    }

    // Check for trailing position argument (timeline labels): .to(sel, {props}, 'label')
    var positionArg = ''
    if (afterProps.length > 0 && afterProps[0] === ',') {
      positionArg = afterProps // includes the leading comma
    }

    return prefix + '.' + method + '(' + selector + ', ' + extracted.duration + ', {' + extracted.otherProps + '}' + positionArg + ')'
  }

  return null
}

/**
 * Extract duration from top-level props only (ignores nested objects).
 * Handles: "duration: 1, scrollTo: {y: 100, autoKill: true}, ease: 'none'"
 * Returns: { duration: '1', otherProps: "scrollTo: {y: 100, autoKill: true}, ease: 'none'" }
 */
function extractDurationFromPropsTopLevel(propsStr) {
  var duration = '0.5' // default
  var otherProps = propsStr

  // Match duration at top level. Supports:
  //   duration: 1.5                   — numeric
  //   duration: frameDelay            — variable
  //   duration: frameDelay + 0.5      — expression
  //   duration: ISI_CONFIG.scrollDuration — dotted property access
  var durationValuePattern = '(?:' +
    '[\\d.]+(?:\\s*[+\\-*/]\\s*[\\d.]+)?' +                     // numeric or numeric expression
    '|' +
    '[a-zA-Z_$][\\w$]*(?:\\.[a-zA-Z_$][\\w$]*)*' +              // variable or dotted property access
    '(?:\\s*[+\\-*/]\\s*[\\d.a-zA-Z_$][\\w$.]*)*' +             // optional arithmetic with variable
    ')'
  var durationMatch = propsStr.match(new RegExp('(?:^|,)\\s*duration\\s*:\\s*(' + durationValuePattern + ')'))
  if (durationMatch) {
    duration = durationMatch[1].trim()
    // Remove duration key-value from props
    otherProps = propsStr.replace(new RegExp('(?:^|,)\\s*duration\\s*:\\s*' + durationValuePattern + '\\s*(?=,|$)'), '').trim()
    otherProps = otherProps.replace(/^,\s*/, '').replace(/,\s*$/, '').trim()
    otherProps = otherProps.replace(/,\s*,/g, ',').trim()
  }

  return { duration: duration, otherProps: otherProps }
}

/**
 * Extract duration from GSAP 3.x props object and return remaining props
 * Input: "duration: 1.5, opacity: 1, ease: 'power2.out'"
 * Output: { duration: '1.5', otherProps: "opacity: 1, ease: 'power2.out'" }
 */
function extractDurationFromProps(propsStr) {
  var duration = '0.5' // default
  var otherProps = propsStr

  // Extract duration: X — supports numeric, variable, dotted property access, and expressions
  var durationMatch = propsStr.match(/duration\s*:\s*([\d.]+(?:\s*[+\-*\/]\s*[\d.]+)?|[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*(?:\s*[+\-*\/]\s*[\d.a-zA-Z_$][\w$.]*)*)/)
  if (durationMatch) {
    duration = durationMatch[1].trim()
    otherProps = propsStr.replace(/,?\s*duration\s*:\s*(?:[\d.]+(?:\s*[+\-*\/]\s*[\d.]+)?|[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*(?:\s*[+\-*\/]\s*[\d.a-zA-Z_$][\w$.]*)*)\s*,?/g, ',').replace(/^,|,$/g, '').trim()
  }

  // Clean up any double commas or leading/trailing commas
  otherProps = otherProps.replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').trim()

  return { duration, otherProps }
}

/**
 * Replace GSAP 3.x CDN scripts with local TweenMax
 */
function replaceGsapCdnWithLocal(html) {
  let result = html
  const changes = []

  // Patterns for GSAP CDN scripts
  const gsapCdnPatterns = [
    /<script[^>]*src=["'][^"']*gsap[^"']*\.js["'][^>]*><\/script>/gi,
    /<script[^>]*src=["'][^"']*2mdn\.net[^"']*gsap[^"']*["'][^>]*><\/script>/gi,
    /<script[^>]*src=["'][^"']*cdnjs\.cloudflare\.com[^"']*gsap[^"']*["'][^>]*><\/script>/gi,
    /<script[^>]*src=["'][^"']*ScrollToPlugin[^"']*["'][^>]*><\/script>/gi
  ]

  for (const pattern of gsapCdnPatterns) {
    if (pattern.test(result)) {
      result = result.replace(pattern, '<!-- GSAP CDN removed - using local TweenMax -->')
      changes.push('Removed GSAP CDN script')
    }
  }

  // Remove OverlayScrollbars CSS and JS
  const overlayScrollbarPatterns = [
    /<link[^>]*href=["'][^"']*overlayscrollbars[^"']*\.css["'][^>]*>/gi,
    /<script[^>]*src=["'][^"']*overlayscrollbars[^"']*\.js["'][^>]*><\/script>/gi
  ]

  for (const pattern of overlayScrollbarPatterns) {
    if (pattern.test(result)) {
      result = result.replace(pattern, '<!-- OverlayScrollbars removed - not needed -->')
      changes.push('Removed OverlayScrollbars')
    }
  }

  // Add local TweenMax script if not present and GSAP was removed
  if (changes.length > 0 && !result.includes('tweenmax') && !result.includes('TweenMax')) {
    // Find where to insert - before </body> or before closing </head>
    const tweenMaxScript = '<script src="js/tweenmax_2.0.1_min.js"></script>'

    if (result.includes('</body>')) {
      // Insert before any inline scripts at end of body, or before </body>
      const lastScriptMatch = result.match(/<script(?![^>]*src=)[^>]*>[\s\S]*?<\/script>\s*<\/body>/i)
      if (lastScriptMatch) {
        result = result.replace(lastScriptMatch[0], tweenMaxScript + '\n    ' + lastScriptMatch[0])
      } else {
        result = result.replace('</body>', '    ' + tweenMaxScript + '\n</body>')
      }
    }
    changes.push('Added local TweenMax script')
  }

  return { html: result, changed: changes.length > 0, changes }
}

/**
 * Remove external dependencies that aren't needed on devices
 */
function removeExternalDependencies(html, js) {
  let resultHtml = html
  let resultJs = js
  const changes = []

  // Remove ScrollToPlugin check from JS
  if (resultJs && /window\.ScrollToPlugin/.test(resultJs)) {
    // Replace the dependency check with a simpler version
    resultJs = resultJs.replace(
      /window\.ScrollToPlugin\s*&&\s*window\.OverlayScrollbars\s*\?\s*init\(\)\s*:\s*setTimeout\(checkInitLoadScripts,\s*\d+\);?/gi,
      'init();'
    )
    resultJs = resultJs.replace(
      /window\.ScrollToPlugin\s*&&\s*window\.OverlayScrollbars/gi,
      'true'
    )
    changes.push('Removed ScrollToPlugin dependency check')
  }

  // Remove OverlayScrollbars initialization
  if (resultJs && /OverlayScrollbars/i.test(resultJs)) {
    resultJs = resultJs.replace(/OverlayScrollbars\s*\([^)]+\)\s*;?/gi, '/* OverlayScrollbars removed */')
    changes.push('Removed OverlayScrollbars initialization')
  }

  return { html: resultHtml, js: resultJs, changed: changes.length > 0, changes }
}

/**
 * Wrap animation code in createAnimation() function and add onWallboardIdleSlideDisplay wrapper
 * This transforms the prebuilt pattern to the device-compatible pattern
 */
function wrapAnimationForDevice(html, js, brand) {
  let resultHtml = html
  let resultJs = js
  const changes = []

  // Only apply to CP ads - MR ads don't need the wrapper
  if (brand !== 'cp') {
    return { html: resultHtml, js: resultJs, changed: false, changes: [] }
  }

  // Check if already has onWallboardIdleSlideDisplay
  if (resultHtml.includes('onWallboardIdleSlideDisplay') || (resultJs && resultJs.includes('onWallboardIdleSlideDisplay'))) {
    return { html: resultHtml, js: resultJs, changed: false, changes: [] }
  }

  // Find inline script with animation code
  const inlineScriptPattern = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi

  resultHtml = resultHtml.replace(inlineScriptPattern, (match, scriptContent) => {
    // Check if this script has animation code (gsap, tl.to, timeline, etc.)
    if (/gsap|\.to\s*\(|\.from\s*\(|timeline|TweenMax|TimelineMax/i.test(scriptContent)) {
      // Transform the animation code
      const transformed = transformAnimationScript(scriptContent)
      if (transformed.changed) {
        changes.push(...transformed.changes)
        return `<script>${transformed.script}</script>`
      }
    }
    return match
  })

  // If we have external JS with animation, transform it too
  if (resultJs && /gsap|\.to\s*\(|\.from\s*\(|timeline|TweenMax|TimelineMax/i.test(resultJs)) {
    const transformed = transformAnimationScript(resultJs)
    if (transformed.changed) {
      resultJs = transformed.script
      changes.push(...transformed.changes)
    }
  }

  return { html: resultHtml, js: resultJs, changed: changes.length > 0, changes }
}

/**
 * Transform animation script to use createAnimation() and onWallboardIdleSlideDisplay pattern
 */
function transformAnimationScript(script) {
  const changes = []
  let result = script

  // Check if there's a startAnimation function or similar
  const hasStartAnimation = /function\s+startAnimation\s*\(|const\s+startAnimation\s*=|let\s+startAnimation\s*=|var\s+startAnimation\s*=/i.test(script)

  // Check if there's a timeline being created and played
  const hasTimelinePlay = /tl\s*\.\s*play\s*\(|timeline\s*\.\s*play\s*\(/i.test(script)
  const hasGsapTimeline = /gsap\s*\.\s*timeline|new\s+TimelineMax|new\s+TimelineLite/i.test(script)

  if (!hasGsapTimeline && !hasStartAnimation) {
    return { script, changed: false, changes: [] }
  }

  // If there's a startAnimation function, we need to rename it and wrap it
  if (hasStartAnimation) {
    // Find the startAnimation function and rename to createAnimation
    result = result.replace(
      /(function\s+)startAnimation(\s*\()/gi,
      '$1createAnimation$2'
    )
    result = result.replace(
      /(const|let|var)(\s+)startAnimation(\s*=)/gi,
      '$1$2createAnimation$3'
    )
    changes.push('Renamed startAnimation to createAnimation')

    // Remove direct calls to startAnimation (they'll be replaced with wrapper)
    result = result.replace(/setTimeout\s*\(\s*startAnimation\s*,\s*\d+\s*\)\s*;?/gi, '/* Animation triggered by device */')
    result = result.replace(/startAnimation\s*\(\s*\)\s*;?/gi, '/* Animation triggered by device */')

    // Add the wrapper at the end of the script
    const wrapper = `

var firstPlay = true;
function onWallboardIdleSlideDisplay() {
    if (firstPlay === true) {
        createAnimation();
        tl.play();
        firstPlay = false;
    } else {
        tl.seek(0);
        tl.play();
    }
}

// Fallback for testing outside device
if (typeof appHost === 'undefined' || appHost === null) {
    createAnimation();
    tl.play();
}
`
    result = result + wrapper
    changes.push('Added onWallboardIdleSlideDisplay wrapper')
    changes.push('Added device fallback for testing')
  }

  return { script: result, changed: changes.length > 0, changes }
}

/**
 * Remove the init() and checkInitLoadScripts pattern used in prebuilt ads
 * and simplify to direct execution
 */
function simplifyInitPattern(js) {
  if (!js) return { js, changed: false, changes: [] }

  const changes = []
  let result = js

  // Remove DOMContentLoaded wrapper if it just calls init
  const domLoadedPattern = /document\.addEventListener\s*\(\s*['"]DOMContentLoaded['"]\s*,\s*\([^)]*\)\s*=>\s*\{[\s\S]*?window\.onload\s*=\s*\(\s*\)\s*=>\s*checkInitLoadScripts\s*\(\s*\)\s*;?\s*\}\s*\)\s*;?/gi
  if (domLoadedPattern.test(result)) {
    result = result.replace(domLoadedPattern, '/* DOMContentLoaded - handled by device */')
    changes.push('Removed DOMContentLoaded wrapper')
  }

  // Remove checkInitLoadScripts function
  const checkInitPattern = /const\s+checkInitLoadScripts\s*=\s*\(\s*\)\s*=>\s*\{[\s\S]*?\}\s*;?/gi
  if (checkInitPattern.test(result)) {
    result = result.replace(checkInitPattern, '/* checkInitLoadScripts removed */')
    changes.push('Removed checkInitLoadScripts function')
  }

  // Simplify init function to createAnimation
  const initFuncPattern = /const\s+init\s*=\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*;?/gi
  const initMatch = result.match(initFuncPattern)
  if (initMatch) {
    // Extract what init does and incorporate into createAnimation
    changes.push('Simplified init function')
  }

  return { js: result, changed: changes.length > 0, changes }
}

/**
 * Generate ISI Scroller JavaScript code
 * This creates the dynamic scroller that works on IXR devices
 * (Native CSS scrollbars do NOT work on these devices)
 */
function generateISIScrollerJS() {
  return `
// === ISI Scroller ===
// Dynamic scroller for device compatibility (native scrollbars don't work on IXR)
var _isiText,
    _container,
    _isiControls,
    _scrollerBeingDragged = false,
    _scroller,
    _scrollerbg,
    _scrollerline,
    _normalizedPosition,
    _contentPosition = 0,
    _textScrollHeight;

function initScroller() {
    _isiText = document.getElementById('innerMostDiv');
    _container = document.getElementById('outerMostDiv');
    _isiControls = document.getElementById('isi-controls');

    if (!_isiText || !_container || !_isiControls) return;

    createScroll(false, true);
}

function createScroll(hasArrows, hasScroller) {
    hasArrows = typeof hasArrows !== 'undefined' ? hasArrows : true;
    hasScroller = typeof hasScroller !== 'undefined' ? hasScroller : true;

    if (hasScroller) {
        _scrollerline = document.createElement('div');
        _scrollerline.className = hasArrows ? 'isiLineWithArrows' : 'isiLineNoArrows';
        _isiControls.appendChild(_scrollerline);

        _scroller = document.createElement('div');
        _scrollerbg = document.createElement('div');
        _scroller.className = 'scroller';
        _scrollerbg.className = 'scrollerbg';
        _scrollerline.appendChild(_scroller);
        _scrollerline.appendChild(_scrollerbg);
    }

    if (hasScroller) {
        _isiText.addEventListener('scroll', moveScroller, false);
        _scroller.addEventListener('mousedown', startDrag, false);
        _scrollerbg.addEventListener('mousedown', startDrag, false);
        _scrollerline.addEventListener('click', seekTo, false);
        window.addEventListener('mousemove', scrollBarScroll, false);
    }

    _isiText.addEventListener('wheel', isiWheel, false);
    window.addEventListener('mouseup', stopDrag, false);
}

function moveScroller(evt) {
    evt.preventDefault();
    _textScrollHeight = _isiText.scrollHeight - _container.offsetHeight;
    var remainOffsetHeight = _textScrollHeight - _isiText.scrollTop;
    var percentHeight = 1 - remainOffsetHeight / _textScrollHeight;
    _scroller.style.top = Math.abs((_scrollerline.offsetHeight - _scroller.offsetHeight) * percentHeight) + 'px';
    _scrollerbg.style.top = Math.abs((_scrollerline.offsetHeight - _scrollerbg.offsetHeight) * percentHeight) + 'px';
}

function seekTo(evt) {
    var normalPosition = (evt.pageY - _isiControls.offsetParent.offsetTop - _scrollerline.offsetTop) / _scrollerline.clientHeight;
    _textScrollHeight = _isiText.scrollHeight - _container.offsetHeight;
    _isiText.scrollTop = normalPosition * _textScrollHeight;
}

function startDrag(evt) {
    _normalizedPosition = evt.pageY - _scrollerline.scrollTop;
    _contentPosition = _isiText.scrollTop;
    _scrollerBeingDragged = true;
}

function stopDrag(evt) {
    _scrollerBeingDragged = false;
}

function scrollBarScroll(evt) {
    if (_scrollerBeingDragged === true) {
        evt.preventDefault();
        var mouseDifferential = evt.pageY - _normalizedPosition;
        var scrollEquivalent = mouseDifferential * (_isiText.scrollHeight / _scrollerline.clientHeight);
        _isiText.scrollTop = _contentPosition + scrollEquivalent;
    }
}

function isiWheel(evt) {
    // Can clear auto-scroll here if implemented
}

// Initialize scroller when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScroller);
} else {
    initScroller();
}
`
}

/**
 * Generate ISI Scroller CSS
 * Uses config values extracted from the original ad
 */
function generateISIScrollerCSS(config) {
  var scrollerColor = config.scrollerColor || '#009B77'
  var scrollerWidth = config.scrollerWidth || 12
  var scrollerHeight = config.scrollerHeight || 35
  var scrollerBorderRadius = config.scrollerBorderRadius || 50
  var trackColor = config.scrollerTrackColor || '#b8bebc'
  var trackWidth = config.scrollerTrackWidth || scrollerWidth

  return `
/* ISI Scroller Styles - Dynamic scroller for device compatibility */
#innerMostDiv::-webkit-scrollbar {
  display: none;
}

#isi-controls {
  position: absolute;
  right: 0;
  top: 0;
  height: inherit;
  width: ${trackWidth + 8}px;
}

.isiLineNoArrows {
  background-color: ${trackColor};
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: ${trackWidth}px;
  cursor: pointer;
  border-radius: ${scrollerBorderRadius}px;
}

.scroller {
  background-color: ${scrollerColor};
  position: absolute;
  cursor: pointer;
  width: ${scrollerWidth}px;
  height: ${scrollerHeight}px;
  top: 0;
  transition: top 0.08s;
  border-radius: ${scrollerBorderRadius}px;
}

.scrollerbg {
  width: ${scrollerWidth + 10}px;
  height: ${scrollerHeight}px;
  background: transparent;
  position: absolute;
  top: 0;
}

::-webkit-scrollbar {
  -webkit-appearance: none;
}
`
}

/**
 * Add ISI scroller to HTML and JavaScript
 * Ensures the proper structure exists and adds scroller code
 */
function addISIScroller(html, adJs, config) {
  var resultHtml = html
  var resultAdJs = adJs
  var changes = []

  // Check if ISI structure exists
  var hasOuterMostDiv = html.includes('id="outerMostDiv"')
  var hasInnerMostDiv = html.includes('id="innerMostDiv"')
  var hasIsiControls = html.includes('id="isi-controls"')

  // If no ISI structure exists but ISI is detected, we need to add a warning
  // The user will need to manually structure the ISI container
  if (!hasOuterMostDiv && !hasInnerMostDiv) {
    // Try to find existing ISI container patterns and add the structure
    var isiContainerPatterns = [
      /id=["']isi-container["']/i,
      /id=["']isi["']/i,
      /id=["']isi-copy["']/i,
      /class=["'][^"']*isi[^"']*["']/i
    ]

    var foundIsiContainer = false
    for (var i = 0; i < isiContainerPatterns.length; i++) {
      if (isiContainerPatterns[i].test(html)) {
        foundIsiContainer = true
        break
      }
    }

    if (foundIsiContainer) {
      changes.push('ISI container found but needs outerMostDiv/innerMostDiv structure - check manually')
    }
  }

  // Add isi-controls div if missing but outerMostDiv exists
  if (hasOuterMostDiv && !hasIsiControls) {
    // Add isi-controls inside outerMostDiv, after innerMostDiv
    resultHtml = resultHtml.replace(
      /(<div[^>]*id=["']outerMostDiv["'][^>]*>[\s\S]*?)(<\/div>\s*(?:<\/div>|\s*<div[^>]*id=["'](?!innerMostDiv)))/i,
      '$1\n      <div id="isi-controls"></div>\n    $2'
    )
    changes.push('Added isi-controls container')
  }

  // Check if scroller JS already exists
  var hasScrollerJS = /function\s+initScroller|function\s+moveScroller|createScroll\s*\(/i.test(html + adJs)

  // Always add scroller.js script tag — the file is always included in the export
  // Add before </body> if not already referenced
  if (!/scroller\.js/i.test(resultHtml)) {
    var scrollerTag = '<script type="text/javascript" src="script/scroller.js"></script>'
    if (resultHtml.includes('</body>')) {
      resultHtml = resultHtml.replace('</body>', scrollerTag + '\n</body>')
    } else if (resultHtml.includes('</html>')) {
      resultHtml = resultHtml.replace('</html>', scrollerTag + '\n</html>')
    } else {
      resultHtml = resultHtml + '\n' + scrollerTag
    }
    changes.push('Added scroller.js script reference')
  }

  // Check if scroller CSS exists
  var hasScrollerCSS = /\.scroller\s*\{|\.isiLineNoArrows\s*\{/i.test(html)

  if (!hasScrollerCSS && (hasOuterMostDiv || hasInnerMostDiv)) {
    // Add scroller CSS
    var scrollerCSS = generateISIScrollerCSS(config)

    // Add inline style before </head> or in existing <style> tag
    if (resultHtml.includes('</head>')) {
      var styleTag = '<style type="text/css">' + scrollerCSS + '</style>'
      resultHtml = resultHtml.replace('</head>', styleTag + '\n</head>')
      changes.push('Added ISI scroller CSS inline')
    }
  }

  return {
    html: resultHtml,
    adJs: resultAdJs,
    changed: changes.length > 0,
    changes: changes
  }
}

/**
 * Remove known CDN script and link tags that won't work offline on devices
 * Handles: GSAP CDN, jQuery CDN, Typekit, CreateJS, other common ad CDNs
 * Does NOT remove local scripts or scripts that were already handled by other steps
 */
function removeKnownCDNTags(html) {
  var changes = []
  var result = html

  // Known CDN patterns to remove (script tags)
  var cdnScriptPatterns = [
    // GSAP / GreenSock CDN (replaced by local tweenmax_2.0.1_min.js)
    { pattern: /<script[^>]*src=["'][^"']*cdnjs\.cloudflare\.com[^"']*gsap[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, name: 'GSAP CDN' },
    { pattern: /<script[^>]*src=["'][^"']*cdn\.jsdelivr\.net[^"']*gsap[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, name: 'GSAP CDN (jsdelivr)' },
    { pattern: /<script[^>]*src=["'][^"']*cdnjs\.cloudflare\.com[^"']*TweenMax[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, name: 'TweenMax CDN' },
    { pattern: /<script[^>]*src=["'][^"']*cdnjs\.cloudflare\.com[^"']*ScrollToPlugin[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, name: 'ScrollToPlugin CDN' },
    // jQuery CDN (local jquery-2.1.4.min.js already present)
    { pattern: /<script[^>]*src=["'][^"']*code\.jquery\.com[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, name: 'jQuery CDN' },
    { pattern: /<script[^>]*src=["'][^"']*ajax\.googleapis\.com[^"']*jquery[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, name: 'jQuery CDN (Google)' },
    { pattern: /<script[^>]*src=["'][^"']*cdnjs\.cloudflare\.com[^"']*jquery[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, name: 'jQuery CDN (Cloudflare)' },
    // CreateJS CDN
    { pattern: /<script[^>]*src=["'][^"']*code\.createjs\.com[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, name: 'CreateJS CDN' },
    // DoubleClick / Google Ad Manager
    { pattern: /<script[^>]*src=["'][^"']*s0\.2mdn\.net[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, name: 'DoubleClick CDN' },
    // Enabler.js
    { pattern: /<script[^>]*src=["'][^"']*enabler\.js[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, name: 'Enabler.js' },
    // iScroll CDN
    { pattern: /<script[^>]*src=["'][^"']*cdnjs\.cloudflare\.com[^"']*iscroll[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, name: 'iScroll CDN' },
    // Local GSAP 3.x file (redundant when TweenMax 2.0.1 is present)
    { pattern: /<script[^>]*src=["'][^"']*gsap[_.]?3[\d.]*[^"']*\.js["'][^>]*>[\s\S]*?<\/script>/gi, name: 'Local GSAP 3.x (redundant with TweenMax)' },
    // Local ScrollToPlugin (GSAP 3.x plugin, not needed with TweenMax)
    { pattern: /<script[^>]*src=["'][^"']*ScrollToPlugin[^"']*\.js["'][^>]*>[\s\S]*?<\/script>/gi, name: 'ScrollToPlugin (GSAP 3.x plugin)' },
    // Local imagesloaded (preloader — keep if needed, but flag)
    // Note: NOT removing imagesloaded, just GSAP/ScrollTo
  ]

  // Known CDN patterns to remove (link tags, excluding Google Fonts which is handled in step 19)
  var cdnLinkPatterns = [
    // Typekit (Adobe Fonts CDN)
    { pattern: /<link[^>]*href=["'][^"']*use\.typekit\.net[^"']*["'][^>]*\/?>/gi, name: 'Adobe Typekit CDN' },
    // Generic CDN stylesheets (but not Google Fonts — handled separately)
    { pattern: /<link[^>]*href=["'][^"']*cdnjs\.cloudflare\.com[^"']*["'][^>]*\/?>/gi, name: 'Cloudflare CDN stylesheet' },
    { pattern: /<link[^>]*href=["'][^"']*cdn\.jsdelivr\.net[^"']*["'][^>]*\/?>/gi, name: 'jsDelivr CDN stylesheet' },
  ]

  cdnScriptPatterns.forEach(function(entry) {
    var matches = result.match(entry.pattern)
    if (matches) {
      result = result.replace(entry.pattern, '<!-- ' + entry.name + ' removed -->')
      matches.forEach(function(m) {
        changes.push('Removed ' + entry.name + ': ' + m.trim().substring(0, 80))
      })
    }
  })

  cdnLinkPatterns.forEach(function(entry) {
    var matches = result.match(entry.pattern)
    if (matches) {
      result = result.replace(entry.pattern, '<!-- ' + entry.name + ' removed -->')
      matches.forEach(function(m) {
        changes.push('Removed ' + entry.name + ': ' + m.trim().substring(0, 80))
      })
    }
  })

  return {
    html: result,
    changed: changes.length > 0,
    changes: changes
  }
}

/**
 * Remove tracking pixels, impression tags, and analytics beacons that won't work offline
 * These cause network errors on BrightSign/MW devices with no internet
 */
function removeTrackingPixels(html) {
  var changes = []
  var result = html

  // Tracking/impression img tags (1x1 pixels, impression beacons)
  var trackingImgPatterns = [
    { pattern: /<img[^>]*src=["'][^"']*adtaginformer\.com[^"']*["'][^>]*\/?>/gi, name: 'adtaginformer tracking pixel' },
    { pattern: /<img[^>]*src=["'][^"']*2mdn\.net[^"']*["'][^>]*\/?>/gi, name: 'DoubleClick tracking pixel' },
    { pattern: /<img[^>]*src=["'][^"']*doubleclick\.net[^"']*["'][^>]*\/?>/gi, name: 'DoubleClick impression pixel' },
    { pattern: /<img[^>]*src=["'][^"']*googlesyndication\.com[^"']*["'][^>]*\/?>/gi, name: 'Google ad tracking pixel' },
    { pattern: /<img[^>]*src=["'][^"']*ad\.doubleclick\.net[^"']*["'][^>]*\/?>/gi, name: 'DoubleClick ad pixel' },
    { pattern: /<img[^>]*src=["'][^"']*pixel[^"']*["'][^>]*width=["']1["'][^>]*\/?>/gi, name: 'tracking pixel (1x1)' },
    { pattern: /<img[^>]*width=["']1["'][^>]*src=["'][^"']*pixel[^"']*["'][^>]*\/?>/gi, name: 'tracking pixel (1x1)' },
  ]

  // Tracking script tags
  var trackingScriptPatterns = [
    { pattern: /<script[^>]*src=["'][^"']*adtaginformer\.com[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, name: 'adtaginformer script' },
    { pattern: /<script[^>]*src=["'][^"']*googletag[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, name: 'Google tag script' },
  ]

  trackingImgPatterns.forEach(function(entry) {
    var matches = result.match(entry.pattern)
    if (matches) {
      result = result.replace(entry.pattern, '<!-- ' + entry.name + ' removed (offline) -->')
      changes.push('Removed ' + entry.name + ' (' + matches.length + ' instance' + (matches.length > 1 ? 's' : '') + ')')
    }
  })

  trackingScriptPatterns.forEach(function(entry) {
    var matches = result.match(entry.pattern)
    if (matches) {
      result = result.replace(entry.pattern, '<!-- ' + entry.name + ' removed (offline) -->')
      changes.push('Removed ' + entry.name)
    }
  })

  return {
    html: result,
    changed: changes.length > 0,
    changes: changes
  }
}

/**
 * Convert window.open(clickTagX) calls in JS files to device-compatible appHost calls
 * Handles: window.open(clickTag1), window.open(clickTag2), etc.
 * Replaces with openExternalPDF or openExternalLinkFull based on URL detection
 */
function convertWindowOpenInJS(js, adJs) {
  var changes = []
  var result = js

  // First, build a clickTag → URL lookup from the JS source itself
  var clickTagLookup = {}
  var varPattern = /var\s+(clickTag\w*)\s*=\s*["']([^"']+)["']/gi
  var m
  while ((m = varPattern.exec(js)) !== null) {
    clickTagLookup[m[1]] = m[2].replace(/&amp;/g, '&')
  }

  // Replace window.open(clickTagX) with the appropriate appHost call
  // Matches: window.open(clickTag1), window.open(window.clickTag1), etc.
  var openPattern = /window\.open\s*\(\s*(?:window\.)?(clickTag\w*)\s*(?:,\s*["'][^"']*["']\s*)?\)/gi
  result = result.replace(openPattern, function(match, varName) {
    var url = clickTagLookup[varName] || ''
    var isPdf = /\.pdf(\b|$)/i.test(url)

    changes.push('Converted window.open(' + varName + ') to ' + (isPdf ? 'openExternalPDF' : 'openExternalLinkFull'))

    if (isPdf) {
      return 'openExternalPDF(e, ' + varName + ')'
    } else {
      return 'openExternalLinkFull(e, ' + varName + ')'
    }
  })

  // If we made conversions, ensure the helper functions are defined somewhere
  // Skip if ad.js already has them (ad.js is the canonical location for handlers)
  var adJsHasHandlers = adJs && /function\s+openExternalLinkFull/i.test(adJs)
  if (changes.length > 0 && !/function\s+openExternalLinkFull/i.test(result) && !adJsHasHandlers) {
    var helpers = '\n// Device-compatible click handler functions (auto-injected)\n'
    helpers += 'function openExternalLinkFull(e, linkUrl) {\n'
    helpers += '    if (typeof appHost !== \'undefined\') {\n'
    helpers += '        appHost.requestFullscreenBrowserView(linkUrl);\n'
    helpers += '    } else {\n'
    helpers += '        window.open(linkUrl);\n'
    helpers += '    }\n'
    helpers += '}\n'
    helpers += 'function openExternalPDF(e, pdfUrl) {\n'
    helpers += '    if (typeof appHost !== \'undefined\') {\n'
    helpers += '        appHost.requestPDFView(pdfUrl);\n'
    helpers += '    } else {\n'
    helpers += '        window.open(pdfUrl);\n'
    helpers += '    }\n'
    helpers += '}\n'
    result = helpers + result
  }

  return {
    js: result,
    changed: changes.length > 0,
    changes: changes
  }
}
