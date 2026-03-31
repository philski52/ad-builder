import { useRef, useState } from 'react'
import { parseAdZip, parseAdFolder } from '../../utils/adImporter'
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
  {
    id: 'ipro',
    name: 'iPro Interact',
    description: 'Professional waiting room ads (1488x837, Chrome 69, offline)',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9h8M8 11h5" />
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

function ImportAdButton({ dropZone }) {
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pickerStep, setPickerStep] = useState(null) // null | 'platform' | 'adType' | 'uploadType'
  const [selectedPlatform, setSelectedPlatform] = useState(null)
  const [selectedAdType, setSelectedAdType] = useState(null)
  const [droppedFile, setDroppedFile] = useState(null) // File dropped before platform selection
  const [isDragging, setIsDragging] = useState(false)
  const startRefactor = useRefactorStore((s) => s.startRefactor)

  const handleImportClick = () => {
    setPickerStep('platform')
  }

  const handlePlatformSelect = (platformId) => {
    setSelectedPlatform(platformId)
    if (platformId === 'ixr') {
      setPickerStep('adType')
    } else {
      setSelectedAdType(null)
      // If a file was dropped, skip upload type and process directly
      if (droppedFile) {
        processDroppedFile(platformId, null)
      } else {
        setPickerStep('uploadType')
      }
    }
  }

  const handleAdTypeSelect = (adTypeId) => {
    setSelectedAdType(adTypeId)
    // If a file was dropped, skip upload type and process directly
    if (droppedFile) {
      processDroppedFile(selectedPlatform, adTypeId)
    } else {
      setPickerStep('uploadType')
    }
  }

  const handleUploadType = (type) => {
    setPickerStep(null)
    if (type === 'zip') {
      fileInputRef.current?.click()
    } else {
      folderInputRef.current?.click()
    }
  }

  // Called from parent via onDrop — stores file, opens platform picker
  const handleDrop = (file) => {
    setDroppedFile(file)
    setPickerStep('platform')
  }

  // After platform/adType selected with a dropped file, skip upload type and process directly
  const processDroppedFile = async (platform, adType) => {
    if (!droppedFile) return
    setPickerStep(null)
    setError(null)
    setIsLoading(true)

    try {
      const result = await parseAdZip(droppedFile, { platform, adType })
      await startRefactor(result, droppedFile, platform, adType)
    } catch (err) {
      setError(`Failed to parse: ${err.message}`)
    } finally {
      setIsLoading(false)
      setSelectedPlatform(null)
      setSelectedAdType(null)
      setDroppedFile(null)
    }
  }

  const handleCancel = () => {
    setPickerStep(null)
    setSelectedPlatform(null)
    setSelectedAdType(null)
    setDroppedFile(null)
  }

  const handleBack = () => {
    if (pickerStep === 'uploadType') {
      if (selectedPlatform === 'ixr') {
        setPickerStep('adType')
      } else {
        setPickerStep('platform')
      }
    } else if (pickerStep === 'adType') {
      setPickerStep('platform')
      setSelectedAdType(null)
    }
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
      setError(`Failed to parse: ${err.message}`)
    } finally {
      setIsLoading(false)
      setSelectedPlatform(null)
      setSelectedAdType(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFolderSelect = async (e) => {
    const files = e.target.files
    if (!files || files.length === 0) {
      setSelectedPlatform(null)
      setSelectedAdType(null)
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const result = await parseAdFolder(files, {
        platform: selectedPlatform,
        adType: selectedAdType
      })
      await startRefactor(result, files[0], selectedPlatform, selectedAdType)
    } catch (err) {
      setError(`Failed to parse folder: ${err.message}`)
    } finally {
      setIsLoading(false)
      setSelectedPlatform(null)
      setSelectedAdType(null)
      if (folderInputRef.current) folderInputRef.current.value = ''
    }
  }

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave = (e) => { e.preventDefault(); setIsDragging(false) }
  const onDropFile = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleDrop(file)
    }
  }

  return (
    <>
      {/* Drop zone mode — rendered as a card in the landing page */}
      {dropZone ? (
        <div
          className={'group p-8 bg-white rounded-xl border-2 transition-all text-left cursor-pointer ' + (isDragging ? 'border-green-500 bg-green-50 shadow-lg' : 'border-gray-200 hover:border-green-500 hover:shadow-lg')}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDropFile}
          onClick={handleImportClick}
        >
          <div className={'w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-colors ' + (isDragging ? 'bg-green-200' : 'bg-green-100 group-hover:bg-green-200')}>
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          {isLoading ? (
            <>
              <div className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Analyzing...
              </div>
            </>
          ) : isDragging ? (
            <>
              <div className="font-semibold text-green-700 text-lg">Drop here</div>
              <p className="text-sm text-green-600 mt-1">Release to import this ad</p>
            </>
          ) : (
            <>
              <div className="font-semibold text-gray-900 text-lg">Import & Refactor</div>
              <p className="text-sm text-gray-500 mt-1">Drop a ZIP here, or click to upload a ZIP or folder</p>
            </>
          )}
        </div>
      ) : (
        /* Button mode — used in headers and other compact layouts */
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
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".zip" onChange={handleFileSelect} className="hidden" />
      <input ref={folderInputRef} type="file" webkitdirectory="" directory="" onChange={handleFolderSelect} className="hidden" />

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

            {/* Step 3: Upload type — ZIP or Folder */}
            {pickerStep === 'uploadType' && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <button onClick={handleBack} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h2 className="text-lg font-semibold text-gray-900">Upload Ad</h2>
                </div>
                <p className="text-sm text-gray-500 mb-4">How would you like to upload?</p>
                <div className="space-y-3">
                  <button
                    onClick={() => handleUploadType('zip')}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="text-gray-600 flex-shrink-0">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">ZIP File</div>
                      <div className="text-sm text-gray-500">Upload a .zip archive</div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleUploadType('folder')}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="text-gray-600 flex-shrink-0">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Folder</div>
                      <div className="text-sm text-gray-500">Select an ad folder from your computer</div>
                    </div>
                  </button>
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
