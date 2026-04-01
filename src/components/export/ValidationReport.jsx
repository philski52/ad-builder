import { useProjectStore } from '../../stores/projectStore'
import { hasFeature } from '../../templates'

function ValidationReport() {
  const currentTemplate = useProjectStore((state) => state.currentTemplate)
  const config = useProjectStore((state) => state.config)
  const assets = useProjectStore((state) => state.assets)

  const validateProject = () => {
    const issues = []

    if (!currentTemplate) {
      issues.push({ type: 'error', message: 'No template selected' })
      return issues
    }

    // Check required assets
    const requiredAssets = currentTemplate.requiredAssets || []

    if (requiredAssets.includes('background') && !assets.background) {
      issues.push({ type: 'error', message: 'Background image not uploaded' })
    }

    if (requiredAssets.includes('isiImage') && !assets.isiImage) {
      issues.push({ type: 'error', message: 'ISI image not uploaded' })
    }

    if (requiredAssets.includes('video') && !assets.video) {
      issues.push({ type: 'error', message: 'Video file not uploaded' })
    }

    if (requiredAssets.includes('frames') && (!assets.frames || assets.frames.length === 0)) {
      issues.push({ type: 'warning', message: 'No animation frames uploaded' })
    }

    // Check click zones (skip for video-only templates that have no buttons)
    const zones = config.clickZones || []
    const isVideoOnly = hasFeature(currentTemplate, 'video') && !hasFeature(currentTemplate, 'buttons') && !hasFeature(currentTemplate, 'background')
    if (zones.length === 0 && !isVideoOnly) {
      issues.push({ type: 'warning', message: 'No click zones defined' })
    }

    zones.forEach(zone => {
      if (!zone.url || zone.url === 'https://' || zone.url.includes('failsafe')) {
        issues.push({ type: 'warning', message: `Zone "${zone.id}" uses default/invalid URL` })
      }
    })

    // Check ISI settings
    if (hasFeature(currentTemplate, 'isi')) {
      if (config.isiHeight > config.dimensions.height) {
        issues.push({ type: 'error', message: 'ISI height exceeds ad dimensions' })
      }
      if (config.isiTop + config.isiHeight > config.dimensions.height) {
        issues.push({ type: 'warning', message: 'ISI container extends beyond ad boundaries' })
      }
    }

    // All good
    if (issues.length === 0) {
      issues.push({ type: 'success', message: 'All checks passed! Ready to export.' })
    }

    return issues
  }

  const issues = validateProject()

  const getIcon = (type) => {
    switch (type) {
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Validation Report</h2>
      <p className="text-sm text-gray-600">
        Check your project for issues before exporting.
      </p>

      <div className="space-y-2">
        {issues.map((issue, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 p-3 rounded-lg ${
              issue.type === 'error' ? 'bg-red-50' :
              issue.type === 'warning' ? 'bg-yellow-50' :
              'bg-green-50'
            }`}
          >
            {getIcon(issue.type)}
            <span className={`text-sm ${
              issue.type === 'error' ? 'text-red-700' :
              issue.type === 'warning' ? 'text-yellow-700' :
              'text-green-700'
            }`}>
              {issue.message}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Project Summary</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>Template: {currentTemplate?.name || 'None'}</li>
          <li>Dimensions: {config.dimensions.width} x {config.dimensions.height}px</li>
          <li>Assets: {Object.values(assets).filter(a => a).length} uploaded</li>
          <li>Click Zones: {(config.clickZones || []).length} defined</li>
          {hasFeature(currentTemplate, 'animation') && (
            <li>Frames: {assets.frames?.length || 0} uploaded</li>
          )}
        </ul>
      </div>
    </div>
  )
}

export default ValidationReport
