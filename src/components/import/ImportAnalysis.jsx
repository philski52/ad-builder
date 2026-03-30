import { useState, useRef } from 'react'
import { getImportSummary, getRefactorSummary, exportRefactoredAd } from '../../utils/adImporter'

function ImportAnalysis({ result, onConfirm, onCancel, originalFile }) {
  const summary = getImportSummary(result)
  const refactorSummary = getRefactorSummary(result)
  const hasErrors = result.errors.length > 0
  const [activeTab, setActiveTab] = useState('overview')
  const [isExporting, setIsExporting] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Import Analysis</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {summary.totalAssetCount} assets found • {summary.manualTaskCount} tasks require attention
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <nav className="flex gap-6" aria-label="Tabs">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'refactor', label: `Refactor (${refactorSummary.totalFixes})`, highlight: refactorSummary.totalFixes > 0 },
              { id: 'assets', label: `Assets (${summary.totalAssetCount})` },
              { id: 'tasks', label: `To Do (${summary.manualTaskCount})`, alert: summary.manualTaskCount > 0 }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.alert && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-amber-500 rounded-full">
                    {summary.manualTaskCount}
                  </span>
                )}
                {tab.highlight && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-green-500 rounded-full">
                    {refactorSummary.totalFixes}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <OverviewTab result={result} summary={summary} />
          )}
          {activeTab === 'refactor' && (
            <RefactorTab
              result={result}
              refactorSummary={refactorSummary}
              originalFile={originalFile}
              isExporting={isExporting}
              setIsExporting={setIsExporting}
            />
          )}
          {activeTab === 'assets' && (
            <AssetsTab result={result} summary={summary} />
          )}
          {activeTab === 'tasks' && (
            <TasksTab result={result} summary={summary} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="text-sm text-gray-500">
            {hasErrors ? (
              <span className="text-red-600 font-medium">Fix errors before proceeding</span>
            ) : refactorSummary.totalFixes > 0 ? (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {refactorSummary.totalFixes} auto-fix(es) applied — use Refactor tab to export
              </span>
            ) : summary.manualTaskCount > 0 ? (
              <span>Import now, then complete {summary.manualTaskCount} manual task(s) in the editor</span>
            ) : (
              <span>Ready to import</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={hasErrors}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Import & Edit
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function OverviewTab({ result, summary }) {
  return (
    <div className="space-y-6">
      {/* Template Detection */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500">Detected Template</p>
            <p className="font-semibold text-gray-900">{summary.templateName}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Dimensions:</span>
            <span className="ml-2 font-medium">{summary.dimensions}</span>
          </div>
          <div>
            <span className="text-gray-500">URLs Found:</span>
            <span className="ml-2 font-medium">{summary.detectedUrlCount}</span>
          </div>
          <div>
            <span className="text-gray-500">Assets:</span>
            <span className="ml-2 font-medium">{summary.mappedAssetCount} mapped, {summary.unmappedAssetCount} need mapping</span>
          </div>
        </div>

        {/* Feature badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          {summary.isGWD && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
              GWD Ad
            </span>
          )}
          {summary.hasISI && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
              ISI Detected
            </span>
          )}
          {summary.hasAnimation && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
              {summary.animationType === 'gsap3' ? 'GSAP 3.x' :
               summary.animationType === 'tweenmax' ? 'TweenMax' :
               summary.animationType === 'gwd' ? 'GWD Animation' :
               summary.animationType === 'css' ? 'CSS Animation' : 'Animated'}
            </span>
          )}
          {summary.svgAssetCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
              {summary.svgAssetCount} SVG(s)
            </span>
          )}
        </div>
      </div>

      {/* Animation Info */}
      {result.animationAnalysis?.hasAnimations && (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <h3 className="text-sm font-medium text-green-900 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Animation Detected
          </h3>
          <div className="text-sm text-green-800 space-y-1">
            <p><strong>Library:</strong> {result.animationAnalysis.libraryUsed}</p>
            {result.animationAnalysis.details.map((detail, i) => (
              <p key={i} className="text-green-700">• {detail}</p>
            ))}
            <p className="mt-2 p-2 bg-green-100 rounded text-green-900 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{result.animationAnalysis.recommendation}</span>
            </p>
          </div>
        </div>
      )}

      {/* Timeline Structure */}
      {result.sceneStructure?.timeline?.labels?.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Timeline Structure ({result.sceneStructure.timeline.labels.length} scenes)
          </h3>
          <div className="flex flex-wrap gap-2 mt-2">
            {result.sceneStructure.timeline.labels.map((label, i) => (
              <div
                key={i}
                className="bg-white px-3 py-1.5 rounded-lg border border-blue-200 text-sm"
              >
                <span className="font-medium text-blue-800">{label.name}</span>
                <span className="text-blue-500 ml-2 text-xs">
                  {label.offset !== '0' ? label.offset : 'start'}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-blue-600 mt-2">
            Total duration: ~{result.sceneStructure.timeline.totalDuration?.toFixed(1)}s
          </p>
        </div>
      )}

      {/* Detected URLs */}
      {result.detectedUrls?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Detected URLs ({result.detectedUrls.length})</h3>
          <div className="bg-gray-50 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
            {result.detectedUrls.map((urlInfo, i) => (
              <div key={i} className="text-sm flex items-start gap-2">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                  urlInfo.type === 'pdf' ? 'bg-red-100 text-red-700' :
                  urlInfo.type === 'external-link' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {urlInfo.type === 'pdf' ? 'PDF' : urlInfo.type === 'external-link' ? 'Link' : urlInfo.type}
                </span>
                <span className="text-gray-600 truncate flex-1" title={urlInfo.url}>
                  {urlInfo.element && <span className="text-gray-400">{urlInfo.element} → </span>}
                  {urlInfo.url}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {result.errors.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Errors ({result.errors.length})
          </h3>
          <div className="space-y-2">
            {result.errors.map((err, i) => (
              <div key={i} className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {err.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings (collapsed by default) */}
      {result.warnings.length > 0 && (
        <details className="group">
          <summary className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-2 cursor-pointer list-none">
            <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Warnings ({result.warnings.length})
          </summary>
          <div className="space-y-2 mt-2">
            {result.warnings.map((warn, i) => (
              <div
                key={i}
                className={`rounded-lg px-3 py-2 text-sm ${
                  warn.level === 'error'
                    ? 'bg-red-50 border border-red-200 text-red-700'
                    : warn.level === 'warn'
                    ? 'bg-amber-50 border border-amber-200 text-amber-700'
                    : 'bg-blue-50 border border-blue-200 text-blue-700'
                }`}
              >
                {warn.message}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function AssetsTab({ result, summary }) {
  const [viewMode, setViewMode] = useState('scenes') // 'scenes' or 'list'
  const mappedAssets = result.allAssets?.filter(a => a.mapped) || []
  const unmappedAssets = result.allAssets?.filter(a => !a.mapped) || []
  const scenes = result.sceneStructure?.scenes || []

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      {scenes.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('scenes')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                viewMode === 'scenes'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              By Scene
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Assets
            </button>
          </div>
          {result.sceneStructure?.timeline && (
            <span className="text-xs text-gray-500">
              Timeline: ~{result.sceneStructure.timeline.totalDuration?.toFixed(1)}s
            </span>
          )}
        </div>
      )}

      {/* Scene View */}
      {viewMode === 'scenes' && scenes.length > 0 && (
        <div className="space-y-4">
          {scenes.map((scene, i) => (
            <div key={scene.name} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <h4 className="font-medium text-gray-900">
                    {scene.name === 'ungrouped' ? 'Other Assets' : scene.name}
                  </h4>
                </div>
                {scene.timing && (
                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                    {scene.timing.offset !== '0' ? `@ ${scene.timing.offset}` : 'Start'}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {scene.assets.map((asset, j) => {
                  const fullAsset = result.allAssets?.find(a => a.filename === asset.filename)
                  return fullAsset ? (
                    <AssetThumbnail key={j} asset={fullAsset} showContext compact />
                  ) : (
                    <div key={j} className="text-xs text-gray-500 p-2 bg-white rounded">
                      {asset.filename}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {(viewMode === 'list' || scenes.length === 0) && (
        <>
          {/* Auto-Mapped Assets */}
          {mappedAssets.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-green-700 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Auto-Mapped ({mappedAssets.length})
              </h3>
              <div className="grid grid-cols-4 gap-3">
                {mappedAssets.map((asset, i) => (
                  <AssetThumbnail key={i} asset={asset} showSlot />
                ))}
              </div>
            </div>
          )}

          {/* Unmapped Assets */}
          {unmappedAssets.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-amber-700 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Needs Manual Mapping ({unmappedAssets.length})
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                These assets were found but couldn't be automatically assigned. You'll map them in the editor after import.
              </p>
              <div className="grid grid-cols-4 gap-3">
                {unmappedAssets.map((asset, i) => (
                  <AssetThumbnail key={i} asset={asset} showSuggestion />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {result.allAssets?.length === 0 && (
        <p className="text-sm text-gray-500 italic text-center py-8">No assets found in ZIP</p>
      )}
    </div>
  )
}

function AssetThumbnail({ asset, showSlot, showSuggestion, showContext, compact }) {
  const isVideo = asset.type === 'mp4'
  const isSvg = asset.isSvg

  return (
    <div className={`relative rounded-lg overflow-hidden border ${
      isSvg ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'
    }`}>
      <div className={`${compact ? 'aspect-square' : 'aspect-square'} flex items-center justify-center p-1`}>
        {isVideo ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-200 rounded">
            <svg className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} text-gray-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        ) : (
          <img
            src={asset.dataUrl}
            alt={asset.filename}
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>
      <div className={`${compact ? 'p-1' : 'p-1.5'} bg-white border-t border-gray-100`}>
        <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-gray-700 truncate`} title={asset.filename}>
          {asset.filename}
        </p>
        {showSlot && asset.suggestedSlot !== 'unknown' && (
          <p className="text-xs text-green-600 font-medium">→ {asset.suggestedSlot}</p>
        )}
        {showSuggestion && asset.suggestedSlot !== 'unknown' && (
          <p className="text-xs text-amber-600">Suggested: {asset.suggestedSlot}</p>
        )}
        {showContext && asset.element && (
          <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-blue-600`}>.{asset.element}</p>
        )}
        {isSvg && (
          <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-amber-600 font-medium`}>⚠ SVG</p>
        )}
      </div>
    </div>
  )
}

function RefactorTab({ result, refactorSummary, originalFile, isExporting, setIsExporting }) {
  const [exportError, setExportError] = useState(null)
  const [exportSuccess, setExportSuccess] = useState(false)

  const handleExport = async () => {
    if (!originalFile || !result.refactoredFiles?.html) {
      setExportError('Cannot export: refactored files not available')
      return
    }

    setIsExporting(true)
    setExportError(null)
    setExportSuccess(false)

    try {
      const projectName = `refactored-${result.template?.id || 'ad'}`
      const exportResult = await exportRefactoredAd(originalFile, result, projectName)

      if (exportResult.success) {
        setExportSuccess(true)
        setTimeout(() => setExportSuccess(false), 3000)
      } else {
        setExportError('Export failed')
      }
    } catch (err) {
      setExportError(`Export failed: ${err.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const appliedFixes = result.appliedFixes || []
  const fixes = result.fixes || []

  return (
    <div className="space-y-6">
      {/* Export Section */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-green-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Refactored Ad
            </h3>
            <p className="text-sm text-green-700 mt-1">
              Download the ad with all auto-fixes applied, ready for device deployment
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting || !refactorSummary.canExport}
            className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export ZIP
              </>
            )}
          </button>
        </div>

        {exportError && (
          <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
            {exportError}
          </div>
        )}
        {exportSuccess && (
          <div className="mt-3 p-2 bg-green-100 border border-green-300 rounded text-green-700 text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Refactored ad exported successfully!
          </div>
        )}
      </div>

      {/* Compatibility Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className={`p-4 rounded-lg border ${
          refactorSummary.hasAnimationWrapper ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-center gap-2">
            {refactorSummary.hasAnimationWrapper ? (
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            <span className={`font-medium ${refactorSummary.hasAnimationWrapper ? 'text-green-800' : 'text-amber-800'}`}>
              onWallboardIdleSlideDisplay
            </span>
          </div>
          <p className="text-xs mt-1 text-gray-600">
            {refactorSummary.hasAnimationWrapper ? 'Wrapper present for device compatibility' : 'Not detected - may need manual addition'}
          </p>
        </div>

        <div className={`p-4 rounded-lg border ${
          refactorSummary.hasAppHost ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-2">
            {refactorSummary.hasAppHost ? (
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9v6a1 1 0 102 0V9a1 1 0 10-2 0z" clipRule="evenodd" />
              </svg>
            )}
            <span className={`font-medium ${refactorSummary.hasAppHost ? 'text-green-800' : 'text-gray-600'}`}>
              appHost Integration
            </span>
          </div>
          <p className="text-xs mt-1 text-gray-600">
            {refactorSummary.hasAppHost ? 'Device API integration present' : 'Not detected (optional)'}
          </p>
        </div>
      </div>

      {/* Applied Fixes */}
      {appliedFixes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Auto-Fixes Applied ({appliedFixes.length})
          </h3>
          <div className="space-y-2">
            {appliedFixes.map((fix, i) => (
              <div key={fix.id || i} className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="font-medium text-green-800 text-sm">{fix.description}</p>
                {fix.details && (
                  <p className="text-xs text-green-600 mt-1">
                    {Array.isArray(fix.details) ? fix.details.join(', ') : fix.details}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detected Issues (from analysis) */}
      {fixes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Compatibility Fixes ({fixes.length})
          </h3>
          <div className="space-y-2">
            {fixes.map((fix, i) => (
              <div key={fix.id || i} className={`rounded-lg p-3 ${
                fix.action === 'auto'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-amber-50 border border-amber-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        fix.action === 'auto'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {fix.action === 'auto' ? 'Auto-fixed' : 'Manual'}
                      </span>
                      <span className="text-xs text-gray-500">{fix.category}</span>
                    </div>
                    <p className="font-medium text-gray-800 text-sm mt-1">{fix.issue}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{fix.reason}</p>
                    <p className={`text-xs mt-1 ${fix.action === 'auto' ? 'text-green-600' : 'text-amber-600'}`}>
                      → {fix.resolution}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SVG Warning */}
      {refactorSummary.svgCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-medium text-amber-800 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {refactorSummary.svgCount} SVG Asset(s) Detected
          </h4>
          <p className="text-sm text-amber-700 mt-1">
            SVG files may not render correctly on all devices. Consider converting to PNG for better compatibility.
          </p>
        </div>
      )}

      {appliedFixes.length === 0 && fixes.length === 0 && (
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-600">No compatibility issues detected!</p>
          <p className="text-sm text-gray-500 mt-1">This ad appears to be device-ready.</p>
        </div>
      )}
    </div>
  )
}

function TasksTab({ result, summary }) {
  const manualTasks = result.manualTasks || []
  const autoFixes = result.fixes?.filter(f => f.action === 'auto') || []
  const manualFixes = result.fixes?.filter(f => f.action === 'manual') || []

  return (
    <div className="space-y-6">
      {/* Priority Tasks */}
      {manualTasks.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            After Import, You'll Need To:
          </h3>
          <div className="space-y-3">
            {manualTasks.map((task, i) => (
              <div key={task.id || i} className={`rounded-lg p-4 ${
                task.priority === 'high' ? 'bg-red-50 border border-red-200' :
                task.priority === 'medium' ? 'bg-amber-50 border border-amber-200' :
                'bg-gray-50 border border-gray-200'
              }`}>
                <div className="flex items-start gap-3">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold ${
                    task.priority === 'high' ? 'bg-red-200 text-red-800' :
                    task.priority === 'medium' ? 'bg-amber-200 text-amber-800' :
                    'bg-gray-200 text-gray-800'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{task.title}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{task.description}</p>
                    <p className="text-sm text-blue-600 mt-2 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      {task.action}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto Fixes */}
      {autoFixes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-green-700 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Will Be Auto-Fixed ({autoFixes.length})
          </h3>
          <div className="bg-green-50 rounded-lg p-3 space-y-2">
            {autoFixes.map((fix, i) => (
              <div key={fix.id || i} className="text-sm">
                <span className="text-green-800 font-medium">{fix.issue}</span>
                <span className="text-green-600 ml-2">→ {fix.resolution}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Fixes */}
      {manualFixes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-amber-700 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            May Need Manual Review ({manualFixes.length})
          </h3>
          <div className="bg-amber-50 rounded-lg p-3 space-y-2">
            {manualFixes.map((fix, i) => (
              <div key={fix.id || i} className="text-sm">
                <span className="text-amber-800 font-medium">{fix.issue}</span>
                <span className="text-amber-600 block text-xs mt-0.5">{fix.resolution}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {manualTasks.length === 0 && autoFixes.length === 0 && manualFixes.length === 0 && (
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-600">No tasks required - ready to import!</p>
        </div>
      )}
    </div>
  )
}

export default ImportAnalysis
