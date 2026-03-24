import { useState, useRef } from 'react'
import JSZip from 'jszip'
import { useClickZoneToolStore } from '../../stores/clickZoneToolStore'
import { detectClickZones } from '../../utils/clickZoneDetector'
import ClickZoneToolPreview from './ClickZoneToolPreview'
import ClickZoneToolPanel from './ClickZoneToolPanel'
import { exportClickZoneAd } from './clickZoneExporter'

function ClickZoneToolWorkspace() {
  const close = useClickZoneToolStore((s) => s.close)
  const setAdData = useClickZoneToolStore((s) => s.setAdData)
  const htmlContent = useClickZoneToolStore((s) => s.htmlContent)
  const adName = useClickZoneToolStore((s) => s.adName)
  const files = useClickZoneToolStore((s) => s.files)
  const clickZones = useClickZoneToolStore((s) => s.clickZones)
  const dimensions = useClickZoneToolStore((s) => s.dimensions)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setIsLoading(true)

    try {
      const zip = await JSZip.loadAsync(file)
      const fileMap = {}
      let htmlFile = null
      let htmlContent = ''
      let combinedCSS = ''
      let combinedJS = ''

      // Extract all files
      for (const [filename, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue
        const lowerName = filename.toLowerCase()

        if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
          htmlContent = await zipEntry.async('string')
          htmlFile = filename
        } else if (lowerName.endsWith('.css')) {
          const cssText = await zipEntry.async('string')
          combinedCSS += `/* ${filename} */\n${cssText}\n`
        } else if (lowerName.endsWith('.js') && !lowerName.includes('jquery') && !lowerName.includes('tweenmax') && !lowerName.includes('gsap')) {
          const jsText = await zipEntry.async('string')
          combinedJS += `/* ${filename} */\n${jsText}\n`
        }

        // Store all files for preview and export
        if (lowerName.match(/\.(png|jpg|jpeg|gif|svg|mp4|webm|webp)$/)) {
          const blob = await zipEntry.async('blob')
          const dataUrl = await blobToDataUrl(blob)
          fileMap[filename] = { content: blob, dataUrl }
        } else {
          const text = await zipEntry.async('string')
          fileMap[filename] = { content: text }
        }
      }

      if (!htmlContent) {
        throw new Error('No HTML file found in ZIP')
      }

      // Also extract inline CSS and JS from the HTML
      const inlineCSS = extractInlineCSS(htmlContent)
      const inlineJS = extractInlineJS(htmlContent)
      combinedCSS = inlineCSS + '\n' + combinedCSS
      combinedJS = inlineJS + '\n' + combinedJS

      // Detect existing click zones
      const { zones, dimensions } = detectClickZones(htmlContent, combinedCSS, combinedJS)

      // Derive ad name from zip filename
      const adName = file.name.replace('.zip', '')

      setAdData({
        files: fileMap,
        htmlContent,
        cssContent: combinedCSS,
        jsContent: combinedJS,
        adName,
        dimensions,
        clickZones: zones,
        originalZipFile: file
      })
    } catch (err) {
      setError(`Failed to parse ZIP: ${err.message}`)
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleExport = async () => {
    try {
      await exportClickZoneAd()
    } catch (err) {
      setError(`Export failed: ${err.message}`)
    }
  }

  const hasAd = !!htmlContent

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={close}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
          <div className="border-l border-gray-300 pl-4">
            <h1 className="text-lg font-semibold text-gray-900">Click Zone Tool</h1>
            {adName && <p className="text-sm text-gray-500">{adName}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!hasAd ? (
            <>
              <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-2 transition-colors">
                {isLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload Ad ZIP
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isLoading}
                />
              </label>
            </>
          ) : (
            <>
              <span className="text-sm text-gray-500">
                {clickZones.length} zone{clickZones.length !== 1 ? 's' : ''} | {dimensions.width}x{dimensions.height}
              </span>
              <label className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 cursor-pointer transition-colors">
                Upload New
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      {hasAd ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Panel */}
          <div className="w-96 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
            <ClickZoneToolPanel />
          </div>
          {/* Preview */}
          <div className="flex-1 overflow-auto p-6">
            <ClickZoneToolPreview />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Upload an Ad</h2>
            <p className="text-gray-500 mb-6">Upload a ZIP file to detect and edit click zones</p>
            <label className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer inline-flex items-center gap-2 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Choose ZIP File
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="hover:opacity-80">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })
}

function extractInlineCSS(html) {
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
  let css = ''
  let match
  while ((match = styleRegex.exec(html)) !== null) {
    css += match[1] + '\n'
  }
  return css
}

function extractInlineJS(html) {
  const scriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi
  let js = ''
  let match
  while ((match = scriptRegex.exec(html)) !== null) {
    // Skip console override scripts
    if (match[1].includes('console.log = console.info')) continue
    // Skip appHost initialization
    if (match[1].trim().startsWith('var appHost')) continue
    js += match[1] + '\n'
  }
  return js
}

export default ClickZoneToolWorkspace
