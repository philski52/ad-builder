import { useState } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { hasFeature } from '../../templates'

const LINK_TYPES = [
  { value: 'url', label: 'Open URL', description: 'Opens external webpage in fullscreen browser' },
  { value: 'pdf', label: 'Open PDF', description: 'Opens PDF in native viewer' },
  { value: 'mod', label: 'Open Mod', description: 'Opens modal ad (secondary HTML)' }
]

function ClickZonesEditor() {
  const config = useProjectStore((state) => state.config)
  const currentTemplate = useProjectStore((state) => state.currentTemplate)
  const updateConfig = useProjectStore((state) => state.updateConfig)

  const hasISI = hasFeature(currentTemplate, 'isi')
  const hasVideo = hasFeature(currentTemplate, 'video')
  const zones = config.clickZones || []

  const presetZones = [
    { id: 'clickTag1', label: 'Main Click Area', defaultLinkType: 'url' },
    { id: 'pi-isi', label: 'Prescribing Info (PI)', defaultLinkType: 'pdf' },
    { id: 'mg-isi', label: 'Medication Guide (MG)', defaultLinkType: 'pdf' },
    { id: 'fda', label: 'FDA Link', defaultLinkType: 'url' },
  ]

  const addZone = (preset = null) => {
    const newZone = preset ? {
      id: preset.id,
      url: 'https://education.patientpoint.com/failsafe-page/',
      linkType: preset.defaultLinkType || 'url',
      jobId: '',
      top: preset.id === 'clickTag1' ? 0 : 100,
      left: preset.id === 'clickTag1' ? 0 : 50,
      width: preset.id === 'clickTag1' ? (hasISI ? config.dimensions.width : 200) : 200,
      height: preset.id === 'clickTag1' ? (hasISI ? (config.isiTop || 600) : 50) : 30,
      inISI: hasISI && preset.id !== 'clickTag1'
    } : {
      id: `zone-${Date.now()}`,
      url: 'https://',
      linkType: 'url',
      jobId: '',
      top: 100,
      left: 50,
      width: 200,
      height: 50,
      inISI: false
    }

    updateConfig('clickZones', [...zones, newZone])
  }

  const updateZone = (index, field, value) => {
    const newZones = [...zones]
    newZones[index] = { ...newZones[index], [field]: value }
    updateConfig('clickZones', newZones)
  }

  const removeZone = (index) => {
    const newZones = zones.filter((_, i) => i !== index)
    updateConfig('clickZones', newZones)
  }

  const availablePresets = presetZones.filter(p => !zones.some(z => z.id === p.id))

  // Local text state to avoid re-rendering the preview on every keystroke
  // Keys are `${index}_${field}`. Cleared on blur after syncing to store.
  const [localText, setLocalText] = useState({})

  const getLocalText = (index, field, fallback) =>
    localText[`${index}_${field}`] ?? fallback

  const setLocal = (index, field, value) =>
    setLocalText((prev) => ({ ...prev, [`${index}_${field}`]: value }))

  const commitLocal = (index, field) => {
    const key = `${index}_${field}`
    if (localText[key] !== undefined) {
      updateZone(index, field, localText[key])
      setLocalText((prev) => { const next = { ...prev }; delete next[key]; return next })
    }
  }

  const [localJobId, setLocalJobId] = useState(null)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Click Zones</h2>
      </div>

      <p className="text-sm text-gray-600">
        Define clickable areas, their link types, and destination URLs.
      </p>

      {/* Global Job ID for mod fallback */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <label className="block text-sm font-medium text-blue-800 mb-1">
          Job ID (for Mod fallback)
        </label>
        <input
          type="text"
          value={localJobId ?? config.jobId ?? ''}
          onChange={(e) => setLocalJobId(e.target.value)}
          onBlur={(e) => { updateConfig('jobId', e.target.value); setLocalJobId(null) }}
          className="w-full px-3 py-2 border border-blue-300 rounded text-sm"
          placeholder="e.g., 1234"
        />
        <p className="text-xs text-blue-600 mt-1">
          Used in fallback URL: patientpointdemo.com/banner_review/IADS-[jobId]/...
        </p>
      </div>

      {/* Add Zone Buttons */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {availablePresets.map(preset => (
            <button
              key={preset.id}
              onClick={() => addZone(preset)}
              className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 border border-blue-200"
            >
              + {preset.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => addZone(null)}
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          + Custom Zone
        </button>
      </div>

      {/* Zone List */}
      <div className="space-y-3">
        {zones.map((zone, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <input
                type="text"
                value={getLocalText(index, 'id', zone.id)}
                onChange={(e) => setLocal(index, 'id', e.target.value)}
                onBlur={() => commitLocal(index, 'id')}
                className="font-medium text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={() => removeZone(index)}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Remove
              </button>
            </div>

            <div className="space-y-3">
              {/* Link Type Selector */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Link Type</label>
                <div className="flex gap-1">
                  {LINK_TYPES.map(lt => (
                    <button
                      key={lt.value}
                      onClick={() => updateZone(index, 'linkType', lt.value)}
                      className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
                        zone.linkType === lt.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                      }`}
                      title={lt.description}
                    >
                      {lt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* URL Field */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  {zone.linkType === 'mod' ? 'Modal Path' : zone.linkType === 'pdf' ? 'PDF URL' : 'URL'}
                </label>
                <input
                  type="text"
                  value={getLocalText(index, 'url', zone.url)}
                  onChange={(e) => setLocal(index, 'url', e.target.value)}
                  onBlur={() => commitLocal(index, 'url')}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  placeholder={zone.linkType === 'mod' ? 'mod/index.html' : 'https://...'}
                />
              </div>

              {/* Job ID Override (for mod type) */}
              {zone.linkType === 'mod' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Job ID Override <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={getLocalText(index, 'jobId', zone.jobId || '')}
                    onChange={(e) => setLocal(index, 'jobId', e.target.value)}
                    onBlur={() => commitLocal(index, 'jobId')}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    placeholder={`Uses global: ${config.jobId || '(not set)'}`}
                  />
                </div>
              )}

              {hasISI && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={zone.inISI || false}
                    onChange={(e) => updateZone(index, 'inISI', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span>In ISI</span>
                  <span className="text-xs text-gray-500">(scrolls with ISI content)</span>
                </label>
              )}

              {hasVideo && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={zone.pauseVideo || false}
                    onChange={(e) => updateZone(index, 'pauseVideo', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span>Pause Video</span>
                  <span className="text-xs text-gray-500">(pauses video when clicked)</span>
                </label>
              )}

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Left</label>
                  <input
                    type="number"
                    value={zone.left}
                    onChange={(e) => updateZone(index, 'left', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Top</label>
                  <input
                    type="number"
                    value={zone.top}
                    onChange={(e) => updateZone(index, 'top', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Width</label>
                  <input
                    type="number"
                    value={zone.width}
                    onChange={(e) => updateZone(index, 'width', parseInt(e.target.value) || 100)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Height</label>
                  <input
                    type="number"
                    value={zone.height}
                    onChange={(e) => updateZone(index, 'height', parseInt(e.target.value) || 30)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>

              <div className="text-xs text-gray-400 mt-1">
                {zone.inISI ? 'Position relative to ISI content' : 'Position relative to ad container'}
              </div>
            </div>
          </div>
        ))}

        {zones.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p>No click zones defined</p>
            <p className="text-sm">Add zones using the buttons above</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ClickZonesEditor
