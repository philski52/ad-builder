import { useState, useCallback } from 'react'
import { useRefactorStore } from '../../../stores/refactorStore'

function EditorStep() {
  const files = useRefactorStore((s) => s.files)
  const originalFiles = useRefactorStore((s) => s.originalFiles)
  const activeFile = useRefactorStore((s) => s.activeFile)
  const setActiveFile = useRefactorStore((s) => s.setActiveFile)
  const updateFile = useRefactorStore((s) => s.updateFile)
  const [showDiff, setShowDiff] = useState(false)

  const filePaths = Object.keys(files)
  const currentContent = activeFile ? files[activeFile] : ''
  const originalContent = activeFile ? originalFiles[activeFile] : ''
  const hasOriginal = activeFile && originalFiles[activeFile] !== undefined

  const handleChange = useCallback((e) => {
    if (activeFile) {
      updateFile(activeFile, e.target.value)
    }
  }, [activeFile, updateFile])

  // Detect language from file extension
  const getLanguage = (path) => {
    if (!path) return 'text'
    if (path.endsWith('.html') || path.endsWith('.htm')) return 'html'
    if (path.endsWith('.js')) return 'javascript'
    if (path.endsWith('.css')) return 'css'
    return 'text'
  }

  return (
    <div className="h-full flex flex-col">
      {/* File tabs */}
      <div className="bg-gray-800 px-2 pt-2 flex items-center gap-1 flex-shrink-0">
        {filePaths.map((path) => (
          <button
            key={path}
            onClick={() => setActiveFile(path)}
            className={`px-3 py-1.5 text-sm rounded-t-lg transition-colors ${
              activeFile === path
                ? 'bg-gray-900 text-white'
                : 'bg-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-600'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <FileIcon language={getLanguage(path)} />
              {path.split('/').pop()}
            </span>
          </button>
        ))}

        {/* Diff toggle */}
        {hasOriginal && (
          <div className="ml-auto pr-2">
            <button
              onClick={() => setShowDiff(!showDiff)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                showDiff
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {showDiff ? 'Hide Original' : 'Show Original'}
            </button>
          </div>
        )}
      </div>

      {/* Editor area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Original (diff view) */}
        {showDiff && hasOriginal && (
          <div className="w-1/2 flex flex-col border-r border-gray-700">
            <div className="bg-gray-800 px-3 py-1 text-xs text-gray-400 border-b border-gray-700 flex-shrink-0">
              Original
            </div>
            <textarea
              value={originalContent}
              readOnly
              className="flex-1 w-full bg-gray-950 text-gray-400 font-mono text-sm p-4 resize-none outline-none"
              spellCheck={false}
            />
          </div>
        )}

        {/* Active editor */}
        <div className={`${showDiff && hasOriginal ? 'w-1/2' : 'w-full'} flex flex-col`}>
          {showDiff && (
            <div className="bg-gray-800 px-3 py-1 text-xs text-green-400 border-b border-gray-700 flex-shrink-0">
              Refactored
            </div>
          )}
          {activeFile ? (
            <textarea
              value={currentContent}
              onChange={handleChange}
              className="flex-1 w-full bg-gray-900 text-gray-100 font-mono text-sm p-4 resize-none outline-none leading-relaxed"
              spellCheck={false}
              placeholder="Select a file to edit..."
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-900 text-gray-500">
              <p>No files loaded</p>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-gray-800 px-4 py-1 text-xs text-gray-500 flex items-center justify-between flex-shrink-0 border-t border-gray-700">
        <span>{activeFile || 'No file selected'}</span>
        <span>
          {getLanguage(activeFile).toUpperCase()} • {currentContent.split('\n').length} lines
        </span>
      </div>
    </div>
  )
}

function FileIcon({ language }) {
  const colors = {
    html: 'text-orange-400',
    javascript: 'text-yellow-400',
    css: 'text-blue-400',
    text: 'text-gray-400',
  }

  return (
    <svg className={`w-3.5 h-3.5 ${colors[language]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

export default EditorStep
