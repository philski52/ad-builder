import { useRefactorStore } from '../../../stores/refactorStore'
import { getRefactorSummary } from '../../../utils/adImporter'

function RefactorStep() {
  const importResult = useRefactorStore((s) => s.importResult)
  const setStep = useRefactorStore((s) => s.setStep)

  if (!importResult) return null

  const refactorSummary = getRefactorSummary(importResult)
  const appliedFixes = importResult.appliedFixes || []
  const fixes = importResult.fixes || []
  const isCpAd = importResult.adType === 'cp' || importResult.template?.brand === 'cp'

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Auto-Refactor Results</h2>
          <p className="text-gray-500 mt-1">Review what was automatically fixed for device compatibility</p>
        </div>
        <button
          onClick={() => setStep('tasks')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          Next: Review Tasks
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>

      {/* Compatibility Status */}
      <div className="grid grid-cols-2 gap-4">
        {isCpAd && (
          <StatusCard
            label="onWallboardIdleSlideDisplay"
            description={refactorSummary.hasAnimationWrapper ? 'Wrapper present for device compatibility' : 'Not detected — may need manual addition'}
            ok={refactorSummary.hasAnimationWrapper}
          />
        )}
        <StatusCard
          label="appHost Integration"
          description={refactorSummary.hasAppHost ? 'Device API integration present' : 'Not detected (optional)'}
          ok={refactorSummary.hasAppHost}
        />
      </div>

      {/* Applied Fixes */}
      {appliedFixes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Auto-Fixes Applied ({appliedFixes.length})
          </h3>
          <div className="space-y-3">
            {appliedFixes.map((fix, i) => (
              <div key={fix.id || i} className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="font-medium text-green-800">{fix.description}</p>
                {fix.details && (
                  <p className="text-sm text-green-600 mt-1">
                    {Array.isArray(fix.details) ? fix.details.join(', ') : fix.details}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compatibility Fixes */}
      {fixes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Compatibility Fixes ({fixes.length})
          </h3>
          <div className="space-y-3">
            {fixes.map((fix, i) => (
              <div key={fix.id || i} className={`rounded-lg p-4 ${
                fix.action === 'auto'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-amber-50 border border-amber-200'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    fix.action === 'auto'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {fix.action === 'auto' ? 'Auto-fixed' : 'Manual'}
                  </span>
                  <span className="text-xs text-gray-500">{fix.category}</span>
                </div>
                <p className="font-medium text-gray-800">{fix.issue}</p>
                <p className="text-sm text-gray-500 mt-0.5">{fix.reason}</p>
                <p className={`text-sm mt-1 ${fix.action === 'auto' ? 'text-green-600' : 'text-amber-600'}`}>
                  → {fix.resolution}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SVG Warning */}
      {refactorSummary.svgCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h4 className="font-semibold text-amber-800">{refactorSummary.svgCount} SVG Asset(s) Detected</h4>
          <p className="text-sm text-amber-700 mt-1">
            SVG files may not render correctly on all devices. Consider converting to PNG.
          </p>
        </div>
      )}

      {/* No fixes state */}
      {appliedFixes.length === 0 && fixes.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg text-gray-600">No compatibility issues detected</p>
          <p className="text-sm text-gray-500 mt-1">This ad appears to be device-ready</p>
        </div>
      )}
    </div>
  )
}

function StatusCard({ label, description, ok }) {
  return (
    <div className={`rounded-xl border p-5 ${
      ok ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
    }`}>
      <div className="flex items-center gap-2">
        {ok ? (
          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )}
        <span className={`font-semibold ${ok ? 'text-green-800' : 'text-amber-800'}`}>
          {label}
        </span>
      </div>
      <p className="text-sm mt-1 text-gray-600">{description}</p>
    </div>
  )
}

export default RefactorStep
