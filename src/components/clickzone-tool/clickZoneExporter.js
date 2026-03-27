/**
 * Click Zone Tool Exporter
 * Re-packs the original ad ZIP with updated click zones.
 * Reuses generateAdJS() and generateClicksCSS() from templateGenerator.
 */

import JSZip from 'jszip'
import { useClickZoneToolStore } from '../../stores/clickZoneToolStore'
import { generateAdJS, generateClicksCSS } from '../../utils/templateGenerator'

export async function exportClickZoneAd() {
  const state = useClickZoneToolStore.getState()
  const { originalZipFile, clickZones, dimensions, adName } = state

  if (!originalZipFile) {
    throw new Error('No original ZIP file loaded')
  }

  // Load original ZIP
  const originalZip = await JSZip.loadAsync(originalZipFile)
  const newZip = new JSZip()
  const allPaths = Object.keys(originalZip.files).filter(f => !originalZip.files[f].dir)

  // Detect root prefix — e.g. "html/" or "7896/" from paths like "html/index.html"
  let rootPrefix = ''
  const htmlFile = allPaths.find(f => /index\.html$/i.test(f)) || allPaths.find(f => /\.html$/i.test(f))
  if (htmlFile && htmlFile.includes('/')) {
    // Everything before the last path component's parent
    const parts = htmlFile.split('/')
    if (parts.length > 1) {
      rootPrefix = parts.slice(0, -1).join('/') + '/'
    }
  }

  // Detect JS and CSS folder names relative to the root prefix
  var jsFolder = 'script'
  var cssFolder = 'css'
  for (var i = 0; i < allPaths.length; i++) {
    var relPath = allPaths[i].replace(rootPrefix, '')
    if (/^js\//i.test(relPath)) { jsFolder = 'js'; break }
    if (/^script\//i.test(relPath)) { jsFolder = 'script'; break }
    if (/^scripts\//i.test(relPath)) { jsFolder = 'scripts'; break }
  }
  for (var j = 0; j < allPaths.length; j++) {
    var relCssPath = allPaths[j].replace(rootPrefix, '')
    if (/^css\//i.test(relCssPath)) { cssFolder = 'css'; break }
    if (/^styles\//i.test(relCssPath)) { cssFolder = 'styles'; break }
  }

  // Copy all original files
  for (const [filename, entry] of Object.entries(originalZip.files)) {
    if (entry.dir) continue
    const content = await entry.async('uint8array')
    newZip.file(filename, content)
  }

  // Build config object compatible with generateAdJS / generateClicksCSS
  const config = {
    clickZones: clickZones.map(z => ({
      id: z.id,
      url: z.url || 'https://',
      linkType: z.linkType || 'url',
      jobId: z.jobId || '',
      top: z.top,
      left: z.left,
      width: z.width,
      height: z.height,
      inISI: z.inISI || false,
      pauseVideo: false
    })),
    jobId: '',
    dimensions
  }

  // Generate new ad.js and clicks.css
  const adJs = generateAdJS(config)
  const clicksCss = generateClicksCSS(config)

  // Generate click zone HTML divs (non-ISI zones only — ISI zones go inside ISI container)
  const nonIsiZones = clickZones.filter(z => !z.inISI)
  const isiZones = clickZones.filter(z => z.inISI)

  const zoneHTML = nonIsiZones
    .map(z => `        <div id="${z.id}" class="click-zone"></div>`)
    .join('\n')

  const isiZoneHTML = isiZones
    .map(z => `            <div id="${z.id}" class="click-zone" style="position:absolute; top:${z.top}px; left:${z.left}px; width:${z.width}px; height:${z.height}px;"></div>`)
    .join('\n')

  // Relative paths for script/link tags (relative to the HTML file)
  var adJsRelPath = jsFolder + '/ad.js'
  var clicksCssRelPath = cssFolder + '/clicks.css'

  // Full paths in the ZIP (including root prefix)
  var adJsZipPath = rootPrefix + adJsRelPath
  var clicksCssZipPath = rootPrefix + clicksCssRelPath

  if (htmlFile) {
    let html = await originalZip.file(htmlFile).async('string')

    // Remove any existing click-zone divs
    html = html.replace(/<div[^>]*class=["']click-zone["'][^>]*><\/div>\s*/gi, '')

    // Inject non-ISI click zone divs before </body>
    if (zoneHTML) {
      html = html.replace(/<\/body>/i, zoneHTML + '\n</body>')
    }

    // Inject ISI click zone divs inside the ISI container
    if (isiZoneHTML) {
      var isiContainerIds = ['innerMostDiv', 'isi-content-wrapper', 'isi-copy', 'isi', 'isi-container', 'isi-con']
      var isiInjected = false
      for (var ci = 0; ci < isiContainerIds.length && !isiInjected; ci++) {
        var containerId = isiContainerIds[ci]
        var containerPattern = new RegExp('(<[^>]*id=["\']' + containerId + '["\'][^>]*>)', 'i')
        if (containerPattern.test(html)) {
          html = html.replace(containerPattern, '$1\n' + isiZoneHTML)
          isiInjected = true
        }
      }
      // Fallback: put ISI zones before </body> too
      if (!isiInjected) {
        html = html.replace(/<\/body>/i, isiZoneHTML + '\n</body>')
      }
    }

    // Add clicks.css link if not already present
    if (!html.includes('clicks.css')) {
      html = html.replace(/<\/head>/i, '    <link rel="stylesheet" href="' + clicksCssRelPath + '">\n</head>')
    }

    // Add ad.js script if not already present — replace existing or add new
    var hasAdJs = /src=["'][^"']*ad\.js["']/i.test(html)
    if (hasAdJs) {
      // Replace existing ad.js with our generated version
      newZip.file(adJsZipPath, adJs)
    }
    if (!hasAdJs) {
      html = html.replace(/<\/body>/i, '    <script src="' + adJsRelPath + '"></script>\n</body>')
    }

    // Add jQuery if not present
    if (!/jquery/i.test(html)) {
      html = html.replace(/<\/head>/i, '    <script src="https://code.jquery.com/jquery-2.1.4.min.js"></script>\n</head>')
    }

    newZip.file(htmlFile, html)
  }

  // Write generated files at the correct paths
  newZip.file(adJsZipPath, adJs)
  newZip.file(clicksCssZipPath, clicksCss)

  // Generate and download
  const blob = await newZip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${adName || 'ad-export'}-clickzones.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return true
}
