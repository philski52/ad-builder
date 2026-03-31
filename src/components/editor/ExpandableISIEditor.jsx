import { useProjectStore } from '../../stores/projectStore'
import { hasFeature } from '../../templates'
import AssetUploader from './AssetUploader'

function ExpandableISIEditor() {
  const currentTemplate = useProjectStore((state) => state.currentTemplate)
  const config = useProjectStore((state) => state.config)
  const assets = useProjectStore((state) => state.assets)
  const updateConfig = useProjectStore((state) => state.updateConfig)
  const setAsset = useProjectStore((state) => state.setAsset)

  if (!currentTemplate) return null

  const hasExpandable = hasFeature(currentTemplate, 'expandable')

  if (!hasExpandable) {
    return (
      <div className="p-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-gray-500">Expandable ISI is not available for this template type.</p>
          <p className="text-sm text-gray-400 mt-1">Select a template with the "expandable" feature.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Expandable ISI</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.expandableEnabled || false}
            onChange={(e) => updateConfig('expandableEnabled', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">Enable</span>
        </label>
      </div>

      {!config.expandableEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-700">Enable expandable ISI to configure the expand/collapse functionality.</p>
        </div>
      )}

      {config.expandableEnabled && (
        <>
          {/* Collapsed State */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 border-b pb-2">Collapsed State (Initial)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">ISI Height</label>
                <input
                  type="number"
                  value={config.expandableCollapsedHeight || 450}
                  onChange={(e) => updateConfig('expandableCollapsedHeight', parseInt(e.target.value) || 450)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Height when collapsed</p>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">ISI Top Position</label>
                <input
                  type="number"
                  value={config.expandableCollapsedTop || 1100}
                  onChange={(e) => updateConfig('expandableCollapsedTop', parseInt(e.target.value) || 1100)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Top position when collapsed</p>
              </div>
            </div>
          </div>

          {/* Expanded State */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 border-b pb-2">Expanded State</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">ISI Height</label>
                <input
                  type="number"
                  value={config.expandableExpandedHeight || 1742}
                  onChange={(e) => updateConfig('expandableExpandedHeight', parseInt(e.target.value) || 1742)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Height when expanded</p>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">ISI Top Position</label>
                <input
                  type="number"
                  value={config.expandableExpandedTop || 42}
                  onChange={(e) => updateConfig('expandableExpandedTop', parseInt(e.target.value) || 42)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Top position when expanded</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Controls Height %</label>
                <input
                  type="number"
                  value={config.expandableControlsHeightPercent || 84}
                  onChange={(e) => updateConfig('expandableControlsHeightPercent', parseInt(e.target.value) || 84)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  min="50"
                  max="100"
                />
                <p className="text-xs text-gray-400 mt-1">Scroller controls height when expanded</p>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Animation Duration</label>
                <input
                  type="number"
                  value={config.expandableDuration || 1}
                  onChange={(e) => updateConfig('expandableDuration', parseFloat(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  min="0.1"
                  max="3"
                  step="0.1"
                />
                <p className="text-xs text-gray-400 mt-1">seconds</p>
              </div>
            </div>
          </div>

          {/* Expand Button */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 border-b pb-2">Expand Button</h3>

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => updateConfig('expandButtonMode', 'text')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  config.expandButtonMode !== 'image'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                Text
              </button>
              <button
                onClick={() => updateConfig('expandButtonMode', 'image')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  config.expandButtonMode === 'image'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                Image
              </button>
            </div>

            {config.expandButtonMode === 'image' ? (
              <AssetUploader
                label="Expand Button Image"
                accept="image/*"
                currentAsset={assets.expandButtonImage}
                onUpload={(result) => setAsset('expandButtonImage', result)}
                onRemove={() => setAsset('expandButtonImage', null)}
              />
            ) : (
              <>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Button Text</label>
                  <input
                    type="text"
                    value={config.expandButtonText || ''}
                    onChange={(e) => updateConfig('expandButtonText', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Background Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={config.expandButtonBgColor || '#532f87'}
                        onChange={(e) => updateConfig('expandButtonBgColor', e.target.value)}
                        className="w-10 h-9 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={config.expandButtonBgColor || '#532f87'}
                        onChange={(e) => updateConfig('expandButtonBgColor', e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Text Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={config.expandButtonTextColor || '#ffffff'}
                        onChange={(e) => updateConfig('expandButtonTextColor', e.target.value)}
                        className="w-10 h-9 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={config.expandButtonTextColor || '#ffffff'}
                        onChange={(e) => updateConfig('expandButtonTextColor', e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Font Size</label>
                    <input
                      type="number"
                      value={config.expandButtonFontSize || 16}
                      onChange={(e) => updateConfig('expandButtonFontSize', parseInt(e.target.value) || 16)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      min="8"
                      max="48"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Border Radius</label>
                    <input
                      type="number"
                      value={config.expandButtonBorderRadius || 50}
                      onChange={(e) => updateConfig('expandButtonBorderRadius', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Top</label>
                <input
                  type="number"
                  value={config.expandButtonTop || 1040}
                  onChange={(e) => updateConfig('expandButtonTop', parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Left</label>
                <input
                  type="number"
                  value={config.expandButtonLeft || 0}
                  onChange={(e) => updateConfig('expandButtonLeft', parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Width</label>
                <input
                  type="number"
                  value={config.expandButtonWidth || 1080}
                  onChange={(e) => updateConfig('expandButtonWidth', parseInt(e.target.value) || 100)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Height</label>
                <input
                  type="number"
                  value={config.expandButtonHeight || 41}
                  onChange={(e) => updateConfig('expandButtonHeight', parseInt(e.target.value) || 41)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
          </div>

          {/* Collapse Button */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 border-b pb-2">Collapse Button</h3>

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => updateConfig('collapseButtonMode', 'text')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  config.collapseButtonMode !== 'image'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                Text
              </button>
              <button
                onClick={() => updateConfig('collapseButtonMode', 'image')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  config.collapseButtonMode === 'image'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                Image
              </button>
            </div>

            {config.collapseButtonMode === 'image' ? (
              <AssetUploader
                label="Collapse Button Image"
                accept="image/*"
                currentAsset={assets.collapseButtonImage}
                onUpload={(result) => setAsset('collapseButtonImage', result)}
                onRemove={() => setAsset('collapseButtonImage', null)}
              />
            ) : (
              <>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Button Text</label>
                  <input
                    type="text"
                    value={config.collapseButtonText || ''}
                    onChange={(e) => updateConfig('collapseButtonText', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Background Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={config.collapseButtonBgColor || '#532f87'}
                        onChange={(e) => updateConfig('collapseButtonBgColor', e.target.value)}
                        className="w-10 h-9 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={config.collapseButtonBgColor || '#532f87'}
                        onChange={(e) => updateConfig('collapseButtonBgColor', e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Text Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={config.collapseButtonTextColor || '#ffffff'}
                        onChange={(e) => updateConfig('collapseButtonTextColor', e.target.value)}
                        className="w-10 h-9 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={config.collapseButtonTextColor || '#ffffff'}
                        onChange={(e) => updateConfig('collapseButtonTextColor', e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Font Size</label>
                    <input
                      type="number"
                      value={config.collapseButtonFontSize || 16}
                      onChange={(e) => updateConfig('collapseButtonFontSize', parseInt(e.target.value) || 16)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      min="8"
                      max="48"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Border Radius</label>
                    <input
                      type="number"
                      value={config.collapseButtonBorderRadius || 50}
                      onChange={(e) => updateConfig('collapseButtonBorderRadius', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Top</label>
                <input
                  type="number"
                  value={config.collapseButtonTop || 0}
                  onChange={(e) => updateConfig('collapseButtonTop', parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Left</label>
                <input
                  type="number"
                  value={config.collapseButtonLeft || 0}
                  onChange={(e) => updateConfig('collapseButtonLeft', parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Width</label>
                <input
                  type="number"
                  value={config.collapseButtonWidth || 1080}
                  onChange={(e) => updateConfig('collapseButtonWidth', parseInt(e.target.value) || 100)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Height</label>
                <input
                  type="number"
                  value={config.collapseButtonHeight || 41}
                  onChange={(e) => updateConfig('collapseButtonHeight', parseInt(e.target.value) || 41)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
          </div>

          {/* Preview hint */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              The expand/collapse buttons will be positioned relative to the ad container.
              Click zones for the buttons will be automatically created based on their dimensions.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

export default ExpandableISIEditor
