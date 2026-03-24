import { useRef, useState } from 'react'
import { parseAdZip } from '../../utils/adImporter'
import { useRefactorStore } from '../../stores/refactorStore'

const AD_PLATFORMS = [
  {
    id: 'ixr',
    name: 'IXR Interact',
    description: 'Exam room wallboard ads (BrightSign, Chrome 69, offline)',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'focus',
    name: 'Focus',
    description: 'Focus display ads (specs TBD)',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
]

const IXR_AD_TYPES = [
  {
    id: 'cp',
    name: 'CP (Exam Room)',
    description: '1080x1733 — uses onWallboardIdleSlideDisplay for animation',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 15h16" />
      </svg>
    ),
  },
  {
    id: 'mr',
    name: 'MR (Rectangle)',
    description: '300x250 — uses $(document).ready, includes autoScroll.js',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a1 1 0 011-1h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V6z" />
      </svg>
    ),
  },
]

function ImportAdButton() {
  const fileInputRef = useRef(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pickerStep, setPickerStep] = useState(null) // null | 'platform' | 'adType'
  const [selectedPlatform, setSelectedPlatform] = useState(null)
  const [selectedAdType, setSelectedAdType] = useState(null)
  const startRefactor = useRefactorStore((s) => s.startRefactor)

  const handleImportClick = () => {
    setPickerStep('platform')
  }

  const handlePlatformSelect = (platformId) => {
    setSelectedPlatform(platformId)
    if (platformId === 'ixr') {
      // IXR needs ad type sub-selection
      setPickerStep('adType')
    } else {
      // Focus (and future platforms) go straight to file picker
      setSelectedAdType(null)
      setPickerStep(null)
      fileInputRef.current?.click()
    }
  }

  const handleAdTypeSelect = (adTypeId) => {
    setSelectedAdType(adTypeId)
    setPickerStep(null)
    fileInputRef.current?.click()
  }

  const handleCancel = () => {
    setPickerStep(null)
    setSelectedPlatform(null)
    setSelectedAdType(null)
  }

  const handleBack = () => {
    setPickerStep('platform')
    setSelectedAdType(null)
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) {
      setSelectedPlatform(null)
      setSelectedAdType(null)
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const result = await parseAdZip(file, {
        platform: selectedPlatform,
        adType: selectedAdType
      })
      await startRefactor(result, file, selectedPlatform, selectedAdType)
    } catch (err) {
      setError(`Failed to parse ZIP: ${err.message}`)
    } finally {
      setIsLoading(false)
      setSelectedPlatform(null)
      setSelectedAdType(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleImportClick}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
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
              Import Ad
            </>
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Selection modal */}
      {pickerStep && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">

            {/* Step 1: Platform selection */}
            {pickerStep === 'platform' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Select Ad Platform</h2>
                <p className="text-sm text-gray-500 mb-4">Which platform is this ad for?</p>
                <div className="space-y-3">
                  {AD_PLATFORMS.map((platform) => (
                    <button
                      key={platform.id}
                      onClick={() => handlePlatformSelect(platform.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                    >
                      <div className="text-gray-600 flex-shrink-0">{platform.icon}</div>
                      <div>
                        <div className="font-medium text-gray-900">{platform.name}</div>
                        <div className="text-sm text-gray-500">{platform.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={handleCancel} className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  Cancel
                </button>
              </>
            )}

            {/* Step 2: IXR ad type selection */}
            {pickerStep === 'adType' && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <button onClick={handleBack} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h2 className="text-lg font-semibold text-gray-900">IXR Ad Type</h2>
                </div>
                <p className="text-sm text-gray-500 mb-4">What type of IXR ad is this?</p>
                <div className="space-y-3">
                  {IXR_AD_TYPES.map((adType) => (
                    <button
                      key={adType.id}
                      onClick={() => handleAdTypeSelect(adType.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                    >
                      <div className="text-gray-600 flex-shrink-0">{adType.icon}</div>
                      <div>
                        <div className="font-medium text-gray-900">{adType.name}</div>
                        <div className="text-sm text-gray-500">{adType.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={handleCancel} className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  Cancel
                </button>
              </>
            )}

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
    </>
  )
}

export default ImportAdButton
