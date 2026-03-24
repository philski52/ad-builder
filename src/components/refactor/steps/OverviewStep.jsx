import { useRefactorStore } from '../../../stores/refactorStore'
import { getImportSummary } from '../../../utils/adImporter'

function OverviewStep() {
  const importResult = useRefactorStore((s) => s.importResult)
  const adMeta = useRefactorStore((s) => s.adMeta)
  const setStep = useRefactorStore((s) => s.setStep)

  if (!importResult) return null

  const summary = getImportSummary(importResult)

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Import Overview</h2>
          <p className="text-gray-500 mt-1">Review what was detected in the uploaded ad</p>
        </div>
        <button
          onClick={() => setStep('refactor')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          Next: Review Refactor
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard
          label="Assets"
          value={summary.totalAssetCount}
          detail={`${summary.mappedAssetCount} mapped, ${summary.unmappedAssetCount} unmapped`}
          color="blue"
        />
        <SummaryCard
          label="Auto-Fixes"
          value={importResult.appliedFixes?.length || 0}
          detail="Applied automatically"
          color="green"
        />
        <SummaryCard
          label="Manual Tasks"
          value={summary.manualTaskCount}
          detail="Need attention"
          color={summary.manualTaskCount > 0 ? 'amber' : 'green'}
        />
        <SummaryCard
          label="URLs Found"
          value={summary.detectedUrlCount}
          detail={`${summary.clickTagCount} clickTags`}
          color="blue"
        />
      </div>

      {/* Template Detection */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detected Template</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <span className="text-sm text-gray-500">Template</span>
            <p className="font-semibold text-gray-900 mt-0.5">{summary.templateName}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Dimensions</span>
            <p className="font-semibold text-gray-900 mt-0.5">{summary.dimensions}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Type</span>
            <p className="font-semibold text-gray-900 mt-0.5">{adMeta.templateType?.toUpperCase() || 'Unknown'}</p>
          </div>
        </div>

        {/* Feature badges */}
        <div className="flex flex-wrap gap-2 mt-4">
          {summary.isGWD && (
            <Badge color="orange">GWD Ad</Badge>
          )}
          {summary.hasISI && (
            <Badge color="green">ISI Detected</Badge>
          )}
          {summary.hasAnimation && (
            <Badge color="purple">
              {summary.animationType === 'gsap3' ? 'GSAP 3.x' :
               summary.animationType === 'tweenmax' ? 'TweenMax' :
               summary.animationType === 'gwd' ? 'GWD Animation' :
               summary.animationType === 'css' ? 'CSS Animation' : 'Animated'}
            </Badge>
          )}
          {summary.svgAssetCount > 0 && (
            <Badge color="amber">{summary.svgAssetCount} SVG(s)</Badge>
          )}
        </div>
      </div>

      {/* Animation Info */}
      {importResult.animationAnalysis?.hasAnimations && (
        <div className="bg-white rounded-xl border border-green-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Animation Detected
          </h3>
          <div className="text-sm text-gray-700 space-y-1">
            <p><strong>Library:</strong> {importResult.animationAnalysis.libraryUsed}</p>
            {importResult.animationAnalysis.details.map((detail, i) => (
              <p key={i} className="text-gray-600">• {detail}</p>
            ))}
            <p className="mt-3 p-3 bg-green-50 rounded-lg text-green-800 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {importResult.animationAnalysis.recommendation}
            </p>
          </div>
        </div>
      )}

      {/* Timeline Structure */}
      {importResult.sceneStructure?.timeline?.labels?.length > 0 && (
        <div className="bg-white rounded-xl border border-blue-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Timeline Structure ({importResult.sceneStructure.timeline.labels.length} scenes)
          </h3>
          <div className="flex flex-wrap gap-2">
            {importResult.sceneStructure.timeline.labels.map((label, i) => (
              <div key={i} className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 text-sm">
                <span className="font-medium text-blue-800">{label.name}</span>
                <span className="text-blue-500 ml-2 text-xs">
                  {label.offset !== '0' ? label.offset : 'start'}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Total duration: ~{importResult.sceneStructure.timeline.totalDuration?.toFixed(1)}s
          </p>
        </div>
      )}

      {/* Detected URLs */}
      {importResult.detectedUrls?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Detected URLs ({importResult.detectedUrls.length})
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {importResult.detectedUrls.map((urlInfo, i) => (
              <div key={i} className="text-sm flex items-start gap-2">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                  urlInfo.type === 'pdf' ? 'bg-red-100 text-red-700' :
                  urlInfo.type === 'external-link' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {urlInfo.type === 'pdf' ? 'PDF' : urlInfo.type === 'external-link' ? 'Link' : urlInfo.type}
                </span>
                <span className="text-gray-600 truncate" title={urlInfo.url}>
                  {urlInfo.element && <span className="text-gray-400">{urlInfo.element} → </span>}
                  {urlInfo.url}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {importResult.errors?.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <h3 className="text-lg font-semibold text-red-700 mb-3">Errors ({importResult.errors.length})</h3>
          <div className="space-y-2">
            {importResult.errors.map((err, i) => (
              <div key={i} className="bg-red-50 rounded-lg px-4 py-2 text-sm text-red-700">
                {err.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {importResult.warnings?.length > 0 && (
        <details className="bg-white rounded-xl border border-gray-200 p-6 group">
          <summary className="text-lg font-semibold text-gray-700 cursor-pointer list-none flex items-center gap-2">
            <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Warnings ({importResult.warnings.length})
          </summary>
          <div className="space-y-2 mt-4">
            {importResult.warnings.map((warn, i) => (
              <div key={i} className={`rounded-lg px-4 py-2 text-sm ${
                warn.level === 'error' ? 'bg-red-50 text-red-700' :
                warn.level === 'warn' ? 'bg-amber-50 text-amber-700' :
                'bg-blue-50 text-blue-700'
              }`}>
                {warn.message}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Assets Preview */}
      {importResult.allAssets?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Assets ({importResult.allAssets.length})
          </h3>
          <div className="grid grid-cols-6 gap-3">
            {importResult.allAssets.map((asset, i) => (
              <div key={i} className={`rounded-lg overflow-hidden border ${
                asset.isSvg ? 'border-amber-300' : asset.mapped ? 'border-green-200' : 'border-gray-200'
              }`}>
                <div className="aspect-square flex items-center justify-center p-1 bg-gray-50">
                  {asset.type === 'mp4' ? (
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <img
                      src={asset.dataUrl}
                      alt={asset.filename}
                      className="max-w-full max-h-full object-contain"
                    />
                  )}
                </div>
                <div className="p-1.5 bg-white border-t border-gray-100">
                  <p className="text-[10px] text-gray-700 truncate" title={asset.filename}>
                    {asset.filename}
                  </p>
                  {asset.mapped && (
                    <p className="text-[10px] text-green-600 font-medium">→ {asset.suggestedSlot}</p>
                  )}
                  {asset.isSvg && (
                    <p className="text-[10px] text-amber-600 font-medium">SVG</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, detail, color }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  }

  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      <p className="text-xs opacity-70 mt-1">{detail}</p>
    </div>
  )
}

function Badge({ children, color }) {
  const colors = {
    orange: 'bg-orange-100 text-orange-800',
    green: 'bg-green-100 text-green-800',
    purple: 'bg-purple-100 text-purple-800',
    amber: 'bg-amber-100 text-amber-800',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  )
}

export default OverviewStep
