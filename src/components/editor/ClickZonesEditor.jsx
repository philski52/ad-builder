import { useProjectStore } from '../../stores/projectStore'
import { hasFeature } from '../../templates'

function ClickZonesEditor() {
  const config = useProjectStore((state) => state.config)
  const currentTemplate = useProjectStore((state) => state.currentTemplate)
  const updateConfig = useProjectStore((state) => state.updateConfig)

  const hasISI = hasFeature(currentTemplate, 'isi')
  const zones = config.clickZones || []

  const presetZones = [
    { id: 'clickTag1', label: 'Main Click Area' },
    { id: 'pi-isi', label: 'Prescribing Info (PI)' },
    { id: 'mg-isi', label: 'Medication Guide (MG)' },
    { id: 'fda', label: 'FDA Link' },
  ]

  const addZone = (preset = null) => {
    const newZone = preset ? {
      id: preset.id,
      url: 'https://education.patientpoint.com/failsafe-page/',
      top: preset.id === 'clickTag1' ? 0 : 100,
      left: preset.id === 'clickTag1' ? 0 : 50,
      width: preset.id === 'clickTag1' ? config.dimensions.width : 200,
      height: preset.id === 'clickTag1' ? (config.isiTop || 600) : 30,
      inISI: preset.id !== 'clickTag1'
    } : {
      id: `zone-${Date.now()}`,
      url: 'https://',
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

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Click Zones</h2>
      </div>

      <p className="text-sm text-gray-600">
        Define clickable areas and their destination URLs. Zones marked "In ISI" will scroll with the ISI content.
      </p>

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
          <div key={zone.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <input
                type="text"
                value={zone.id}
                onChange={(e) => updateZone(index, 'id', e.target.value)}
                className="font-medium text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={() => removeZone(index)}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Remove
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">URL</label>
                <input
                  type="url"
                  value={zone.url}
                  onChange={(e) => updateZone(index, 'url', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  placeholder="https://..."
                />
              </div>

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
