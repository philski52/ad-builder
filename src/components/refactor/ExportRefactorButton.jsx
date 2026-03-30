import { useState, useRef, useEffect } from 'react'
import JSZip from 'jszip'
import { useRefactorStore } from '../../stores/refactorStore'
import { buildContextFile } from './exportUtils'

function ExportRefactorButton() {
  const files = useRefactorStore((s) => s.files)
  const assetFiles = useRefactorStore((s) => s.assetFiles)
  const adMeta = useRefactorStore((s) => s.adMeta)
  const tasks = useRefactorStore((s) => s.tasks)
  const importResult = useRefactorStore((s) => s.importResult)
  const [isExporting, setIsExporting] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMenu])

  const doExport = async (includeContext) => {
    if (Object.keys(files).length === 0) return

    setIsExporting(true)
    setShowMenu(false)
    try {
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
      if (includeContext) {
        const contextContent = buildContextFile(files, tasks, adMeta, importResult)
        zip.file('CLAUDE.md', contextContent)
      }

      // Generate and download
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      })

      const suffix = includeContext ? '-with-context' : ''
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${adMeta.projectName || 'refactored-ad'}${suffix}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
      alert(`Export failed: ${err.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const noFiles = Object.keys(files).length === 0

  return (
    <div className="relative" ref={menuRef}>
      <div className="flex items-center">
        {/* Main export button */}
        <button
          onClick={() => doExport(false)}
          disabled={isExporting || noFiles}
          className="px-4 py-1.5 bg-green-600 text-white rounded-l-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm font-medium"
        >
          {isExporting ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </>
          )}
        </button>

        {/* Dropdown arrow */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          disabled={isExporting || noFiles}
          className="px-2 py-1.5 bg-green-600 text-white rounded-r-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-l border-green-500"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Dropdown menu */}
      {showMenu && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
          <button
            onClick={() => doExport(false)}
            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            <p className="text-sm font-medium text-gray-900">Export Ad</p>
            <p className="text-xs text-gray-500 mt-0.5">Download the refactored ad files only</p>
          </button>
          <button
            onClick={() => doExport(true)}
            className="w-full px-4 py-3 text-left hover:bg-purple-50 transition-colors"
          >
            <p className="text-sm font-medium text-purple-900 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Export with AI Context
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Includes CLAUDE.md with specs, completed work, and remaining tasks — open in VS Code with Claude Code to continue
            </p>
          </button>
        </div>
      )}
    </div>
  )
}

export default ExportRefactorButton
