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
      inISI: false,
      pauseVideo: false
    })),
    jobId: '',
    dimensions
  }

  // Generate new ad.js and clicks.css using existing generators
  const adJs = generateAdJS(config)
  const clicksCss = generateClicksCSS(config)

  // Generate click zone HTML divs
  const zoneHTML = clickZones
    .map(z => `        <div id="${z.id}" class="click-zone"></div>`)
    .join('\n')

  // Find the original HTML file
  let htmlFilename = null
  for (const filename of Object.keys(originalZip.files)) {
    if (filename.toLowerCase().endsWith('.html') || filename.toLowerCase().endsWith('.htm')) {
      htmlFilename = filename
      break
    }
  }

  if (htmlFilename) {
    let html = await originalZip.file(htmlFilename).async('string')

    // Remove any existing click-zone divs
    html = html.replace(/<div[^>]*class=["']click-zone["'][^>]*><\/div>\s*/gi, '')

    // Inject click zone divs before closing </div> of container
    // Try common container patterns
    const containerEndPatterns = [
      '</div>\n</body>',
      '</div>\r\n</body>',
      '</div>\n    </body>',
      '</div>\r\n    </body>'
    ]

    let injected = false
    for (const pattern of containerEndPatterns) {
      if (html.includes(pattern)) {
        html = html.replace(pattern, `${zoneHTML}\n    </div>\n</body>`)
        injected = true
        break
      }
    }

    // Fallback: inject before </body>
    if (!injected) {
      html = html.replace('</body>', `${zoneHTML}\n</body>`)
    }

    // Add clicks.css link if not already present
    if (!html.includes('clicks.css')) {
      html = html.replace('</head>', '    <link rel="stylesheet" href="css/clicks.css">\n</head>')
    }

    // Add ad.js script if not already present, or replace existing
    const hasAdJs = html.includes('script/ad.js') || html.includes('ad.js')
    if (!hasAdJs) {
      html = html.replace('</body>', '    <script src="script/ad.js"></script>\n</body>')
    }

    // Add jQuery if not present (needed by ad.js)
    if (!html.includes('jquery')) {
      html = html.replace('</head>', '    <script src="https://code.jquery.com/jquery-2.1.4.min.js"></script>\n</head>')
    }

    newZip.file(htmlFilename, html)
  }

  // Write generated files
  // Determine folder structure — check if original has css/ or script/ folders
  const hasCssFolder = Object.keys(originalZip.files).some(f => f.startsWith('css/') || f.includes('/css/'))
  const hasScriptFolder = Object.keys(originalZip.files).some(f => f.startsWith('script/') || f.includes('/script/'))

  const cssPath = hasCssFolder ? 'css/clicks.css' : 'clicks.css'
  const jsPath = hasScriptFolder ? 'script/ad.js' : 'ad.js'

  newZip.file(cssPath, clicksCss)
  newZip.file(jsPath, adJs)

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
