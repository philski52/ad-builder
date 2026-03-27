import { useClickZoneToolStore } from '../../stores/clickZoneToolStore'

const LINK_TYPES = [
  { value: 'url', label: 'Open URL', description: 'Opens external webpage in fullscreen browser' },
  { value: 'pdf', label: 'Open PDF', description: 'Opens PDF in native viewer' },
  { value: 'mod', label: 'Open Mod', description: 'Opens modal ad (secondary HTML)' }
]

const PRESET_ZONES = [
  { id: 'clickTag1', label: 'Main Click Area', defaultLinkType: 'url' },
  { id: 'pi-isi', label: 'Prescribing Info (PI)', defaultLinkType: 'pdf' },
  { id: 'mg-isi', label: 'Medication Guide (MG)', defaultLinkType: 'pdf' },
  { id: 'fda', label: 'FDA Link', defaultLinkType: 'url' },
]

function ClickZoneToolPanel() {
  const clickZones = useClickZoneToolStore((s) => s.clickZones)
  const dimensions = useClickZoneToolStore((s) => s.dimensions)
  const selectedZoneIndex = useClickZoneToolStore((s) => s.selectedZoneIndex)
  const addZone = useClickZoneToolStore((s) => s.addZone)
  const updateZone = useClickZoneToolStore((s) => s.updateZone)
  const removeZone = useClickZoneToolStore((s) => s.removeZone)
  const setSelectedZone = useClickZoneToolStore((s) => s.setSelectedZone)

  const handleAddPreset = (preset) => {
    addZone({
      id: preset.id,
      url: 'https://education.patientpoint.com/failsafe-page/',
      linkType: preset.defaultLinkType || 'url',
      top: preset.id === 'clickTag1' ? 0 : 100,
      left: preset.id === 'clickTag1' ? 0 : 50,
      width: preset.id === 'clickTag1' ? dimensions.width : 200,
      height: preset.id === 'clickTag1' ? dimensions.height : 30
    })
  }

  const handleAddCustom = () => {
    addZone({
      id: `zone-${Date.now()}`,
      url: 'https://',
      linkType: 'url',
      top: 100,
      left: 50,
      width: 200,
      height: 50
    })
  }

  const availablePresets = PRESET_ZONES.filter(p => !clickZones.some(z => z.id === p.id))

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Click Zones</h2>
        <span className="text-xs text-gray-400">{clickZones.length} zone{clickZones.length !== 1 ? 's' : ''}</span>
      </div>

      <p className="text-sm text-gray-600">
        Detected zones are shown in amber. Adjust positions or add new zones.
      </p>

      {/* Add Zone Buttons */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {availablePresets.map(preset => (
            <button
              key={preset.id}
              onClick={() => handleAddPreset(preset)}
              className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 border border-blue-200"
            >
              + {preset.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleAddCustom}
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          + Custom Zone
        </button>
      </div>

      {/* Zone List */}
      <div className="space-y-3">
        {clickZones.map((zone, index) => (
          <div
            key={zone.id + index}
            className={`border rounded-lg p-3 cursor-pointer transition-colors ${
              selectedZoneIndex === index
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
            }`}
            onClick={() => setSelectedZone(index)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {zone.detected && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">detected</span>
                )}
                <input
                  type="text"
                  value={zone.id}
                  onChange={(e) => updateZone(index, 'id', e.target.value)}
                  className="font-medium text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeZone(index) }}
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
                      onClick={(e) => { e.stopPropagation(); updateZone(index, 'linkType', lt.value) }}
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
                  value={zone.url}
                  onChange={(e) => updateZone(index, 'url', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  placeholder={zone.linkType === 'mod' ? 'mod/index.html' : 'https://...'}
                />
              </div>

              {/* Job ID Override (for mod type) */}
              {zone.linkType === 'mod' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Job ID <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={zone.jobId || ''}
                    onChange={(e) => updateZone(index, 'jobId', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    placeholder="e.g., 1234"
                  />
                </div>
              )}

              {/* In ISI toggle */}
              <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={zone.inISI || false}
                  onChange={(e) => updateZone(index, 'inISI', e.target.checked)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-xs text-gray-600">In ISI <span className="text-gray-400">(place inside scrollable ISI content)</span></span>
              </label>

              {/* Position & Size */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Left</label>
                  <input
                    type="number"
                    value={zone.left}
                    onChange={(e) => updateZone(index, 'left', parseInt(e.target.value) || 0)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Top</label>
                  <input
                    type="number"
                    value={zone.top}
                    onChange={(e) => updateZone(index, 'top', parseInt(e.target.value) || 0)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Width</label>
                  <input
                    type="number"
                    value={zone.width}
                    onChange={(e) => updateZone(index, 'width', parseInt(e.target.value) || 100)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Height</label>
                  <input
                    type="number"
                    value={zone.height}
                    onChange={(e) => updateZone(index, 'height', parseInt(e.target.value) || 30)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>

              <div className="text-xs text-gray-400 mt-1">
                Position relative to ad container
              </div>
            </div>
          </div>
        ))}

        {clickZones.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p>No click zones detected or added</p>
            <p className="text-sm">Add zones using the buttons above</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ClickZoneToolPanel
