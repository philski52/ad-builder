/**
 * Click Zone Detector
 * Parses HTML, CSS, and JS from an uploaded ad to detect existing click zones.
 */

/**
 * Detect click zones from ad files
 * @param {string} html - index.html content
 * @param {string} css - combined CSS content
 * @param {string} js - combined JS content
 * @returns {{ zones: Array, dimensions: { width, height } }}
 */
export function detectClickZones(html, css, js) {
  const dimensions = detectDimensions(html, css)
  const zones = []
  const seen = new Set()

  // 1. Detect from JS addEventListener patterns
  const jsZones = detectFromJS(js)
  for (const z of jsZones) {
    if (!seen.has(z.selector)) {
      seen.add(z.selector)
      const pos = findPosition(z.selector, css, html)
      zones.push({
        id: z.selector.replace(/[.#]/g, ''),
        url: z.url || 'https://',
        linkType: z.linkType || 'url',
        jobId: '',
        top: pos.top ?? 0,
        left: pos.left ?? 0,
        width: pos.width ?? 200,
        height: pos.height ?? 50,
        detected: true,
        originalSelector: z.selector
      })
    }
  }

  // 2. Detect from HTML onclick attributes
  const onclickZones = detectFromOnclick(html)
  for (const z of onclickZones) {
    if (!seen.has(z.selector)) {
      seen.add(z.selector)
      const pos = findPosition(z.selector, css, html)
      zones.push({
        id: z.selector.replace(/[.#]/g, ''),
        url: z.url || 'https://',
        linkType: z.linkType || 'url',
        jobId: '',
        top: pos.top ?? 0,
        left: pos.left ?? 0,
        width: pos.width ?? 200,
        height: pos.height ?? 50,
        detected: true,
        originalSelector: z.selector
      })
    }
  }

  // 3. Detect from CSS — elements that look like invisible click overlays
  const cssZones = detectFromCSS(css, seen)
  for (const z of cssZones) {
    zones.push({
      id: z.selector.replace(/[.#]/g, ''),
      url: 'https://',
      linkType: 'url',
      jobId: '',
      top: z.top ?? 0,
      left: z.left ?? 0,
      width: z.width ?? 200,
      height: z.height ?? 50,
      detected: true,
      originalSelector: z.selector
    })
  }

  return { zones, dimensions }
}

/**
 * Detect ad dimensions from meta tag or CSS
 */
function detectDimensions(html, css) {
  // Check meta tag: <meta name="ad.size" content="width=1000,height=1600">
  const metaMatch = html.match(/name=["']ad\.size["']\s+content=["']width=(\d+),\s*height=(\d+)["']/i)
  if (metaMatch) {
    return { width: parseInt(metaMatch[1]), height: parseInt(metaMatch[2]) }
  }

  // Check .container or #container CSS
  const containerMatch = css.match(/(?:\.container|#container)\s*\{[^}]*width:\s*(\d+)px[^}]*height:\s*(\d+)px/i)
  if (containerMatch) {
    return { width: parseInt(containerMatch[1]), height: parseInt(containerMatch[2]) }
  }

  return { width: 1000, height: 1600 }
}

/**
 * Detect click zones from JavaScript addEventListener / jQuery patterns
 */
function detectFromJS(js) {
  const zones = []

  // Pattern: $('.selector')[0].addEventListener("click", function(e) { openExternalLinkFull(e, varName); }
  // Also: document.getElementById('id').addEventListener('click', ...)
  // Also: $('.selector').click(function() { ... })
  // Also: $('#id')[0].addEventListener("click", ...)

  // jQuery selector patterns with addEventListener
  const jqClickRegex = /\$\(['"]([^'"]+)['"]\)(?:\[0\])?\.addEventListener\s*\(\s*["']click["']\s*,\s*function\s*\([^)]*\)\s*\{([^}]+)\}/g
  let match
  while ((match = jqClickRegex.exec(js)) !== null) {
    const selector = match[1]
    const body = match[2]
    zones.push({
      selector,
      ...extractLinkInfo(body, js)
    })
  }

  // document.getElementById patterns
  const getElRegex = /document\.getElementById\(['"]([^'"]+)['"]\)\.addEventListener\s*\(\s*["']click["']\s*,\s*function\s*\([^)]*\)\s*\{([^}]+)\}/g
  while ((match = getElRegex.exec(js)) !== null) {
    zones.push({
      selector: `#${match[1]}`,
      ...extractLinkInfo(match[2], js)
    })
  }

  // jQuery .click() patterns
  const jqClickFnRegex = /\$\(['"]([^'"]+)['"]\)\.click\s*\(\s*function\s*\([^)]*\)\s*\{([^}]+)\}/g
  while ((match = jqClickFnRegex.exec(js)) !== null) {
    zones.push({
      selector: match[1],
      ...extractLinkInfo(match[2], js)
    })
  }

  return zones
}

/**
 * Extract URL and link type from a click handler body
 */
function extractLinkInfo(handlerBody, fullJs) {
  // openExternalLinkFull(e, varName) or openExternalLinkFull(e, "url")
  let urlMatch = handlerBody.match(/openExternalLinkFull\s*\([^,]*,\s*["']([^'"]+)["']\)/)
  if (urlMatch) return { url: urlMatch[1], linkType: 'url' }

  // openExternalLinkFull(e, varName) — resolve variable
  urlMatch = handlerBody.match(/openExternalLinkFull\s*\([^,]*,\s*(\w+)\)/)
  if (urlMatch) {
    const resolved = resolveVariable(urlMatch[1], fullJs)
    if (resolved) return { url: resolved, linkType: 'url' }
  }

  // openExternalPDF(e, "url") or openExternalPDF(e, varName)
  urlMatch = handlerBody.match(/openExternalPDF\s*\([^,]*,\s*["']([^'"]+)["']\)/)
  if (urlMatch) return { url: urlMatch[1], linkType: 'pdf' }

  urlMatch = handlerBody.match(/openExternalPDF\s*\([^,]*,\s*(\w+)\)/)
  if (urlMatch) {
    const resolved = resolveVariable(urlMatch[1], fullJs)
    if (resolved) return { url: resolved, linkType: 'pdf' }
  }

  // requestPDFView
  urlMatch = handlerBody.match(/requestPDFView\s*\(\s*["']([^'"]+)["']\)/)
  if (urlMatch) return { url: urlMatch[1], linkType: 'pdf' }

  urlMatch = handlerBody.match(/requestPDFView\s*\(\s*(\w+)\)/)
  if (urlMatch) {
    const resolved = resolveVariable(urlMatch[1], fullJs)
    if (resolved) return { url: resolved, linkType: 'pdf' }
  }

  // requestFullscreenBrowserView
  urlMatch = handlerBody.match(/requestFullscreenBrowserView\s*\(\s*["']([^'"]+)["']\)/)
  if (urlMatch) return { url: urlMatch[1], linkType: 'url' }

  urlMatch = handlerBody.match(/requestFullscreenBrowserView\s*\(\s*(\w+)\)/)
  if (urlMatch) {
    const resolved = resolveVariable(urlMatch[1], fullJs)
    if (resolved) return { url: resolved, linkType: 'url' }
  }

  // requestModalAdView
  urlMatch = handlerBody.match(/requestModalAdView\s*\(/)
  if (urlMatch) return { url: '', linkType: 'mod' }

  // window.open("url")
  urlMatch = handlerBody.match(/window\.open\s*\(\s*["']([^'"]+)["']\)/)
  if (urlMatch) return { url: urlMatch[1], linkType: 'url' }

  return { url: 'https://', linkType: 'url' }
}

/**
 * Resolve a JS variable to its string value
 */
function resolveVariable(varName, js) {
  const varRegex = new RegExp(`var\\s+${varName}\\s*=\\s*["']([^"']+)["']`)
  const match = js.match(varRegex)
  if (match) return match[1]

  // Also try const/let
  const constRegex = new RegExp(`(?:const|let)\\s+${varName}\\s*=\\s*["']([^"']+)["']`)
  const constMatch = js.match(constRegex)
  if (constMatch) return constMatch[1]

  return null
}

/**
 * Detect click zones from onclick attributes in HTML
 */
function detectFromOnclick(html) {
  const zones = []
  // Match: <div class="fda" onclick="..."> or <div id="foo" onclick="...">
  const onclickRegex = /<(?:div|a|img|span)\s+[^>]*?(?:class=["']([^"']+)["']|id=["']([^"']+)["'])[^>]*?onclick=["']([^"']+)["'][^>]*>/gi
  let match
  while ((match = onclickRegex.exec(html)) !== null) {
    const className = match[1]
    const id = match[2]
    const selector = id ? `#${id}` : `.${className.split(/\s+/)[0]}`
    zones.push({ selector, url: 'https://', linkType: 'url' })
  }

  // Also match reversed attribute order: onclick before class/id
  const onclickRegex2 = /<(?:div|a|img|span)\s+[^>]*?onclick=["']([^"']+)["'][^>]*?(?:class=["']([^"']+)["']|id=["']([^"']+)["'])[^>]*>/gi
  while ((match = onclickRegex2.exec(html)) !== null) {
    const className = match[2]
    const id = match[3]
    const selector = id ? `#${id}` : `.${className.split(/\s+/)[0]}`
    zones.push({ selector, url: 'https://', linkType: 'url' })
  }

  return zones
}

/**
 * Detect click zones from CSS — elements with opacity:0 and absolute positioning
 * that look like invisible click overlays
 */
function detectFromCSS(css, alreadySeen) {
  const zones = []
  // Match CSS rules with opacity: 0 and position data
  const ruleRegex = /([.#][\w-]+)\s*\{([^}]+)\}/g
  let match
  while ((match = ruleRegex.exec(css)) !== null) {
    const selector = match[1]
    if (alreadySeen.has(selector)) continue

    const body = match[2]
    const hasOpacityZero = /opacity\s*:\s*0\b/.test(body)
    const hasPosition = /(?:top|left)\s*:\s*\d+px/.test(body)
    const hasSize = /(?:width|height)\s*:\s*\d+px/.test(body)
    const hasZIndex = /z-index\s*:\s*\d+/.test(body)

    // Likely a click overlay if invisible, positioned, and sized
    if (hasOpacityZero && hasPosition && hasSize && hasZIndex) {
      const pos = parseCSSPosition(body)
      if (pos.width > 0 && pos.height > 0) {
        alreadySeen.add(selector)
        zones.push({ selector, ...pos })
      }
    }
  }
  return zones
}

/**
 * Find the CSS position of an element by its selector
 */
function findPosition(selector, css, html) {
  // Try to find the CSS rule for this selector
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const ruleRegex = new RegExp(escaped + '\\s*\\{([^}]+)\\}', 'i')
  const match = css.match(ruleRegex)
  if (match) {
    return parseCSSPosition(match[1])
  }

  // For class selectors, try without the dot
  if (selector.startsWith('.')) {
    const className = selector.slice(1)
    const classRegex = new RegExp(`\\.${className}\\s*\\{([^}]+)\\}`, 'i')
    const classMatch = css.match(classRegex)
    if (classMatch) {
      return parseCSSPosition(classMatch[1])
    }
  }

  return { top: 0, left: 0, width: 200, height: 50 }
}

/**
 * Parse CSS properties to extract position values
 */
function parseCSSPosition(cssBody) {
  const topMatch = cssBody.match(/\btop\s*:\s*(\d+)px/)
  const leftMatch = cssBody.match(/\bleft\s*:\s*(\d+)px/)
  const widthMatch = cssBody.match(/\bwidth\s*:\s*(\d+)px/)
  const heightMatch = cssBody.match(/\bheight\s*:\s*(\d+)px/)

  return {
    top: topMatch ? parseInt(topMatch[1]) : 0,
    left: leftMatch ? parseInt(leftMatch[1]) : 0,
    width: widthMatch ? parseInt(widthMatch[1]) : 200,
    height: heightMatch ? parseInt(heightMatch[1]) : 50
  }
}
