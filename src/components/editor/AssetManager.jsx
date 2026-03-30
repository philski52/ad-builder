import { useProjectStore } from '../../stores/projectStore'
import { hasFeature } from '../../templates'
import AssetUploader from './AssetUploader'

function AssetManager() {
  const currentTemplate = useProjectStore((state) => state.currentTemplate)
  const assets = useProjectStore((state) => state.assets)
  const setAsset = useProjectStore((state) => state.setAsset)

  if (!currentTemplate) return null

  const hasISI = hasFeature(currentTemplate, 'isi')
  const hasVideo = hasFeature(currentTemplate, 'video')
  const hasBackground = hasFeature(currentTemplate, 'background')

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-lg font-semibold">Assets</h2>

      {/* Background Image */}
      {(!hasVideo || hasBackground) && (
        <AssetUploader
          label="Background Image"
          description={`Upload main background (${currentTemplate.dimensions.width}x${currentTemplate.dimensions.height})`}
          accept="image/*"
          currentAsset={assets.background}
          onUpload={(result) => setAsset('background', result)}
          onRemove={() => setAsset('background', null)}
        />
      )}

      {/* ISI Image */}
      {hasISI && (
        <AssetUploader
          label="ISI Content Image"
          description="Upload rasterized ISI text image (or use ISI Editor to generate)"
          accept="image/*"
          currentAsset={assets.isiImage}
          onUpload={(result) => setAsset('isiImage', result)}
          onRemove={() => setAsset('isiImage', null)}
        />
      )}

      {/* Video */}
      {hasVideo && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Video File</label>
          <p className="text-xs text-gray-500 mb-2">
            Upload optimized MP4 video (H.264 codec required)
          </p>
          {assets.video ? (
            <div className="relative">
              <video
                src={assets.video.dataUrl}
                className="w-full rounded-lg"
                controls
              />
              <button
                onClick={() => setAsset('video', null)}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <label className="block">
              <div className="drop-zone cursor-pointer hover:border-primary-400">
                <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-500">Drop video or click to upload</p>
                <p className="text-xs text-gray-400 mt-1">MP4 format only</p>
              </div>
              <input
                type="file"
                accept="video/mp4"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = (e) => {
                      setAsset('video', {
                        name: file.name,
                        dataUrl: e.target.result
                      })
                    }
                    reader.readAsDataURL(file)
                  }
                }}
              />
            </label>
          )}
        </div>
      )}

      {/* Video Thumbnail */}
      {hasBackground && hasVideo && (
        <AssetUploader
          label="Video Thumbnail"
          description="Poster image shown before video plays"
          accept="image/*"
          currentAsset={assets.thumbnail}
          onUpload={(result) => setAsset('thumbnail', result)}
          onRemove={() => setAsset('thumbnail', null)}
        />
      )}

      {/* Play Button */}
      {hasBackground && hasVideo && (
        <AssetUploader
          label="Play Button"
          description="Image shown to trigger video playback"
          accept="image/*"
          currentAsset={assets.playButton}
          onUpload={(result) => setAsset('playButton', result)}
          onRemove={() => setAsset('playButton', null)}
        />
      )}

      {/* Asset Requirements */}
      <div className="bg-gray-50 rounded-lg p-3 mt-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Requirements</h4>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>• Dimensions: {currentTemplate.dimensions.width}x{currentTemplate.dimensions.height}px</li>
          <li>• Formats: PNG, JPG (no SVG)</li>
          {hasVideo && <li>• Video: MP4 (H.264), optimized for device</li>}
          {hasISI && <li>• ISI: Rasterized text as image</li>}
        </ul>
      </div>
    </div>
  )
}

export default AssetManager
