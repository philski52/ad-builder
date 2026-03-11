import { useState, useCallback } from 'react'
import { processImage, convertSvgAndProcess } from '../../utils/imageProcessor'

function AssetUploader({
  label,
  description,
  accept = 'image/*',
  currentAsset,
  onUpload,
  onRemove,
  compact = false
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [svgPrompt, setSvgPrompt] = useState(null)
  const [error, setError] = useState(null)

  const handleFile = useCallback(async (file) => {
    setError(null)
    setIsProcessing(true)

    try {
      const result = await processImage(file)

      if (!result.valid) {
        setError(result.error)
        setIsProcessing(false)
        return
      }

      if (result.isSvg) {
        // Show SVG conversion prompt
        setSvgPrompt({ file, result })
        setIsProcessing(false)
        return
      }

      // Regular image - upload directly
      onUpload(result)
      setIsProcessing(false)
    } catch (err) {
      setError('Failed to process file')
      setIsProcessing(false)
    }
  }, [onUpload])

  const handleSvgChoice = useCallback(async (choice) => {
    if (choice === 'convert') {
      setIsProcessing(true)
      const result = await convertSvgAndProcess(svgPrompt.file)

      if (result.valid) {
        onUpload(result)
      } else {
        setError(result.error)
      }
      setIsProcessing(false)
    }

    setSvgPrompt(null)
  }, [svgPrompt, onUpload])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  // SVG Conversion Prompt Modal
  if (svgPrompt) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h4 className="font-medium text-yellow-800">SVG File Detected</h4>
              <p className="text-sm text-yellow-700 mt-1">
                SVG files are not supported on target devices. Would you like to convert it to PNG?
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleSvgChoice('convert')}
                  className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                >
                  Convert to PNG
                </button>
                <button
                  onClick={() => handleSvgChoice('reject')}
                  className="px-3 py-1.5 bg-white border border-yellow-300 text-yellow-700 text-sm rounded hover:bg-yellow-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Current asset preview
  if (currentAsset) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">{label}</label>
          <button
            onClick={onRemove}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Remove
          </button>
        </div>
        <div className="relative">
          <img
            src={currentAsset.dataUrl}
            alt={label}
            className={`w-full rounded-lg border border-gray-200 ${compact ? 'h-20 object-cover' : ''}`}
          />
          {currentAsset.converted && (
            <span className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded">
              Converted from SVG
            </span>
          )}
          {currentAsset.dimensions && (
            <span className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded">
              {currentAsset.dimensions.width}x{currentAsset.dimensions.height}
            </span>
          )}
        </div>
      </div>
    )
  }

  // Upload zone
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {description && <p className="text-xs text-gray-500">{description}</p>}

      <label
        className={`block cursor-pointer ${isProcessing ? 'pointer-events-none opacity-50' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className={`drop-zone ${isDragging ? 'active' : ''} ${compact ? 'py-4' : ''}`}>
          {isProcessing ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin h-6 w-6 text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="ml-2 text-sm text-gray-500">Processing...</span>
            </div>
          ) : (
            <>
              <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-500">Drop image or click to upload</p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG (SVG will be converted)</p>
            </>
          )}
        </div>
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
      </label>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}

export default AssetUploader
