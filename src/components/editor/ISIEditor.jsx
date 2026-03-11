import { useState, useRef } from 'react'
import { useProjectStore } from '../../stores/projectStore'

function ISIEditor() {
  const isiContent = useProjectStore((state) => state.isiContent)
  const setIsiContent = useProjectStore((state) => state.setIsiContent)
  const setAsset = useProjectStore((state) => state.setAsset)
  const assets = useProjectStore((state) => state.assets)
  const config = useProjectStore((state) => state.config)

  const canvasRef = useRef(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)

  const generateISIImage = async () => {
    if (!isiContent.text.trim()) return

    setIsGenerating(true)

    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      // Set canvas dimensions based on template
      const width = config.dimensions.width
      const padding = 40
      const lineHeight = isiContent.fontSize * isiContent.lineHeight

      // Measure text to determine height
      ctx.font = `${isiContent.fontSize}px ${isiContent.fontFamily}`

      const lines = wrapText(ctx, isiContent.text, width - padding * 2)
      const height = Math.max(lines.length * lineHeight + padding * 2, 500)

      canvas.width = width
      canvas.height = height

      // Fill background
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, width, height)

      // Draw text
      ctx.fillStyle = 'black'
      ctx.font = `${isiContent.fontSize}px ${isiContent.fontFamily}`
      ctx.textBaseline = 'top'

      let y = padding
      for (const line of lines) {
        ctx.fillText(line, padding, y)
        y += lineHeight
      }

      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/png')
      setPreviewUrl(dataUrl)

      // Create asset object
      const result = {
        dataUrl,
        dimensions: { width, height },
        generated: true
      }

      setAsset('isiImage', result)
    } catch (error) {
      console.error('Failed to generate ISI image:', error)
    }

    setIsGenerating(false)
  }

  // Helper function to wrap text
  function wrapText(ctx, text, maxWidth) {
    const paragraphs = text.split('\n')
    const lines = []

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        lines.push('')
        continue
      }

      const words = paragraph.split(' ')
      let currentLine = ''

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const metrics = ctx.measureText(testLine)

        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine)
          currentLine = word
        } else {
          currentLine = testLine
        }
      }

      if (currentLine) {
        lines.push(currentLine)
      }
    }

    return lines
  }

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-lg font-semibold">ISI Content</h2>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setIsiContent({ mode: 'upload' })}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            isiContent.mode === 'upload'
              ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
              : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
          }`}
        >
          Upload Image
        </button>
        <button
          onClick={() => setIsiContent({ mode: 'generate' })}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            isiContent.mode === 'generate'
              ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
              : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
          }`}
        >
          Generate from Text
        </button>
      </div>

      {isiContent.mode === 'upload' ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Upload a pre-rendered ISI image. This should be a PNG/JPG with the ISI text already rasterized.
          </p>

          {assets.isiImage ? (
            <div className="space-y-2">
              <img
                src={assets.isiImage.dataUrl}
                alt="ISI Content"
                className="w-full rounded-lg border border-gray-200 max-h-64 object-contain"
              />
              <button
                onClick={() => setAsset('isiImage', null)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Remove Image
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">
              Use the Assets panel to upload an ISI image
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Paste ISI text below and generate a rasterized image. Adjust font settings as needed.
          </p>

          {/* Font Settings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Font Family</label>
              <select
                value={isiContent.fontFamily}
                onChange={(e) => setIsiContent({ fontFamily: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Georgia">Georgia</option>
                <option value="Verdana">Verdana</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Font Size</label>
              <input
                type="number"
                value={isiContent.fontSize}
                onChange={(e) => setIsiContent({ fontSize: parseInt(e.target.value) || 14 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                min="8"
                max="32"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Line Height</label>
            <input
              type="number"
              value={isiContent.lineHeight}
              onChange={(e) => setIsiContent({ lineHeight: parseFloat(e.target.value) || 1.4 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              min="1"
              max="3"
              step="0.1"
            />
          </div>

          {/* Text Input */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">ISI Text Content</label>
            <textarea
              value={isiContent.text}
              onChange={(e) => setIsiContent({ text: e.target.value })}
              className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              placeholder="Paste Important Safety Information text here..."
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={generateISIImage}
            disabled={isGenerating || !isiContent.text.trim()}
            className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? 'Generating...' : 'Generate ISI Image'}
          </button>

          {/* Preview */}
          {previewUrl && (
            <div className="space-y-2">
              <label className="block text-sm text-gray-600">Preview</label>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <img src={previewUrl} alt="ISI Preview" className="w-full" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h4 className="text-sm font-medium text-blue-800 mb-1">Why rasterize ISI text?</h4>
        <p className="text-xs text-blue-700">
          Target display devices have limited font support. Converting ISI text to an image ensures
          consistent rendering across all BrightSign/MW devices.
        </p>
      </div>
    </div>
  )
}

export default ISIEditor
