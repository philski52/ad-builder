import { useState } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { exportAdZip } from '../../utils/zipExporter'

function ExportButton() {
  const [isExporting, setIsExporting] = useState(false)
  const [showValidation, setShowValidation] = useState(false)

  const currentTemplate = useProjectStore((state) => state.currentTemplate)
  const config = useProjectStore((state) => state.config)
  const assets = useProjectStore((state) => state.assets)
  const animations = useProjectStore((state) => state.animations)
  const projectName = useProjectStore((state) => state.projectName)

  const validateAssets = () => {
    const issues = []

    if (!currentTemplate) {
      issues.push({ type: 'error', message: 'No template selected' })
      return issues
    }

    // Check required assets
    const requiredAssets = currentTemplate.requiredAssets || []

    if (requiredAssets.includes('background') && !assets.background) {
      issues.push({ type: 'warning', message: 'Background image not uploaded' })
    }

    if (requiredAssets.includes('isiImage') && !assets.isiImage) {
      issues.push({ type: 'warning', message: 'ISI image not uploaded' })
    }

    if (requiredAssets.includes('video') && !assets.video) {
      issues.push({ type: 'warning', message: 'Video file not uploaded' })
    }

    if (requiredAssets.includes('frames') && (!assets.frames || assets.frames.length === 0)) {
      issues.push({ type: 'warning', message: 'No animation frames uploaded' })
    }

    // Check clickTags
    if (!config.clickTag1 || config.clickTag1.includes('failsafe')) {
      issues.push({ type: 'info', message: 'ClickTag1 uses default failsafe URL' })
    }

    return issues
  }

  const handleExport = async () => {
    const issues = validateAssets()
    const hasErrors = issues.some((i) => i.type === 'error')

    if (hasErrors) {
      setShowValidation(true)
      return
    }

    setIsExporting(true)

    try {
      await exportAdZip(currentTemplate, config, assets, projectName, animations)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed: ' + error.message)
    }

    setIsExporting(false)
  }

  const issues = validateAssets()

  return (
    <div className="relative">
      <button
        onClick={handleExport}
        disabled={isExporting || !currentTemplate}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
      >
        {isExporting ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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
            Export Ad
          </>
        )}
      </button>

      {/* Validation indicator */}
      {issues.length > 0 && (
        <button
          onClick={() => setShowValidation(!showValidation)}
          className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 text-yellow-900 rounded-full text-xs font-bold"
          title="Validation issues"
        >
          {issues.length}
        </button>
      )}

      {/* Validation dropdown */}
      {showValidation && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-3 border-b border-gray-100">
            <h4 className="font-medium text-gray-900">Validation</h4>
          </div>
          <div className="p-2 max-h-64 overflow-y-auto">
            {issues.length === 0 ? (
              <p className="text-sm text-green-600 p-2">All checks passed</p>
            ) : (
              <ul className="space-y-1">
                {issues.map((issue, i) => (
                  <li
                    key={i}
                    className={`text-sm p-2 rounded ${
                      issue.type === 'error'
                        ? 'bg-red-50 text-red-700'
                        : issue.type === 'warning'
                        ? 'bg-yellow-50 text-yellow-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={() => setShowValidation(false)}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExportButton
