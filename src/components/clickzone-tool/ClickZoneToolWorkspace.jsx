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
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)

  // Process a JSZip object (shared by both ZIP and folder uploads)
  // zipFile: original File object (for ZIP uploads) or null (for folder/drop)
  const processZip = async (zip, name, zipFile) => {
    const fileMap = {}
    let htmlFile = null
    let htmlContent = ''
    let combinedCSS = ''
    let combinedJS = ''

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
      throw new Error('No HTML file found')
    }

    const inlineCSS = extractInlineCSS(htmlContent)
    const inlineJS = extractInlineJS(htmlContent)
    combinedCSS = inlineCSS + '\n' + combinedCSS
    combinedJS = inlineJS + '\n' + combinedJS

    const { zones, dimensions } = detectClickZones(htmlContent, combinedCSS, combinedJS)

    setAdData({
      files: fileMap,
      htmlContent,
      cssContent: combinedCSS,
      jsContent: combinedJS,
      adName: name,
      dimensions,
      clickZones: zones,
      // Use original file if available, otherwise generate a blob from the JSZip
      originalZipFile: zipFile || await zip.generateAsync({ type: 'blob' })
    })
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setIsLoading(true)

    try {
      const zip = await JSZip.loadAsync(file)
      await processZip(zip, file.name.replace('.zip', ''), file)
    } catch (err) {
      setError(`Failed to parse ZIP: ${err.message}`)
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFolderUpload = async (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setError(null)
    setIsLoading(true)

    try {
      const zip = new JSZip()
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const path = file.webkitRelativePath || file.name
        if (path.includes('__MACOSX') || path.includes('.DS_Store') || path.includes('Thumbs.db')) continue
        const content = await file.arrayBuffer()
        zip.file(path, content)
      }

      // Derive name from folder path
      const firstPath = files[0].webkitRelativePath || files[0].name
      const folderName = firstPath.split('/')[0] || 'ad'

      await processZip(zip, folderName)
    } catch (err) {
      setError(`Failed to parse folder: ${err.message}`)
    } finally {
      setIsLoading(false)
      if (folderInputRef.current) folderInputRef.current.value = ''
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragging(false)

    const items = e.dataTransfer.items
    if (!items || items.length === 0) return

    setError(null)
    setIsLoading(true)

    try {
      // Check if it's a folder (DataTransferItem with webkitGetAsEntry)
      const firstItem = items[0]
      const entry = firstItem.webkitGetAsEntry ? firstItem.webkitGetAsEntry() : null

      if (entry && entry.isDirectory) {
        // Folder drop — read all files recursively
        const fileList = await readDirectoryEntry(entry)
        const zip = new JSZip()
        for (const file of fileList) {
          if (file.path.includes('__MACOSX') || file.path.includes('.DS_Store')) continue
          const content = await file.file.arrayBuffer()
          zip.file(file.path, content)
        }
        await processZip(zip, entry.name)
      } else {
        // File drop — assume ZIP
        const file = e.dataTransfer.files[0]
        if (!file) throw new Error('No file dropped')
        if (!file.name.toLowerCase().endsWith('.zip')) {
          throw new Error('Please drop a ZIP file or a folder')
        }
        const zip = await JSZip.loadAsync(file)
        await processZip(zip, file.name.replace('.zip', ''), file)
      }
    } catch (err) {
      setError(`Drop failed: ${err.message}`)
    } finally {
      setIsLoading(false)
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
                    </svg>
                    Upload ZIP
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
              <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-2 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Upload Folder
                <input
                  ref={folderInputRef}
                  type="file"
                  webkitdirectory=""
                  directory=""
                  onChange={handleFolderUpload}
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
          <div className="w-96 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
            <ClickZoneToolPanel />
          </div>
          <div className="flex-1 overflow-auto p-6">
            <ClickZoneToolPreview />
          </div>
        </div>
      ) : (
        <div
          className={'flex-1 flex items-center justify-center transition-colors ' + (isDragging ? 'bg-blue-50' : '')}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-center">
            {isDragging ? (
              <>
                <svg className="w-16 h-16 mx-auto text-blue-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                <h2 className="text-xl font-semibold text-blue-600 mb-2">Drop here</h2>
                <p className="text-blue-500">ZIP file or ad folder</p>
              </>
            ) : (
              <>
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <h2 className="text-xl font-semibold text-gray-700 mb-2">Upload an Ad</h2>
                <p className="text-gray-500 mb-6">Drag & drop a ZIP or folder, or use the buttons below</p>
              </>
            )}
            <div className="flex items-center justify-center gap-4">
              <label className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer inline-flex items-center gap-2 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
                </svg>
                Choose ZIP
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <label className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer inline-flex items-center gap-2 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Choose Folder
                <input
                  ref={folderInputRef}
                  type="file"
                  webkitdirectory=""
                  directory=""
                  onChange={handleFolderUpload}
                  className="hidden"
                />
              </label>
            </div>
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
    if (match[1].includes('console.log = console.info')) continue
    if (match[1].trim().startsWith('var appHost')) continue
    js += match[1] + '\n'
  }
  return js
}

// Recursively read all files from a dropped directory entry
async function readDirectoryEntry(dirEntry, basePath) {
  basePath = basePath || dirEntry.name
  var files = []
  var reader = dirEntry.createReader()

  var readBatch = function() {
    return new Promise(function(resolve) {
      reader.readEntries(function(entries) { resolve(entries) })
    })
  }

  var entries = await readBatch()
  while (entries.length > 0) {
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i]
      if (entry.isFile) {
        var file = await new Promise(function(resolve) { entry.file(resolve) })
        files.push({ path: basePath + '/' + entry.name, file: file })
      } else if (entry.isDirectory) {
        var subFiles = await readDirectoryEntry(entry, basePath + '/' + entry.name)
        files = files.concat(subFiles)
      }
    }
    entries = await readBatch()
  }

  return files
}

export default ClickZoneToolWorkspace
