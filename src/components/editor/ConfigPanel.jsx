import { useProjectStore } from '../../stores/projectStore';
import { hasFeature } from '../../templates';

function ConfigPanel() {
  const currentTemplate = useProjectStore((state) => state.currentTemplate);
  const config = useProjectStore((state) => state.config);
  const updateConfig = useProjectStore((state) => state.updateConfig);

  if (!currentTemplate) return null;

  const hasISI = hasFeature(currentTemplate, 'isi');
  const hasVideo = hasFeature(currentTemplate, 'video');
  const hasExpandable = hasFeature(currentTemplate, 'expandable');
  const hasAnimation = hasFeature(currentTemplate, 'animation');
  const maxButtonCount = currentTemplate.id === 'int-mod-video-1-2-buttons' ? 2 : 4;

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-lg font-semibold">Configuration</h2>

      {/* Dimensions (read-only) */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700 border-b pb-2">
          Dimensions
        </h3>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm text-gray-600">
            <span className="font-medium">{config.dimensions.width}</span> x{' '}
            <span className="font-medium">{config.dimensions.height}</span>{' '}
            pixels
          </p>
          <p className="text-xs text-gray-400 mt-1">Determined by template</p>
        </div>
      </div>

      {/* Animation Settings */}
      {hasAnimation && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700 border-b pb-2">
            Animation Timing
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Frame Duration
              </label>
              <input
                type="number"
                value={config.frameDuration}
                onChange={(e) =>
                  updateConfig(
                    'frameDuration',
                    parseFloat(e.target.value) || 0.5,
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0.1"
                max="5"
                step="0.1"
              />
              <p className="text-xs text-gray-400 mt-1">seconds</p>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Frame Delay
              </label>
              <input
                type="number"
                value={config.frameDelay}
                onChange={(e) =>
                  updateConfig('frameDelay', parseFloat(e.target.value) || 1)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0"
                max="10"
                step="0.1"
              />
              <p className="text-xs text-gray-400 mt-1">
                seconds between frames
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ISI Container Settings */}
      {hasISI && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700 border-b pb-2">
            ISI Container
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Width</label>
              <input
                type="number"
                value={config.isiWidth || config.dimensions.width}
                onChange={(e) =>
                  updateConfig(
                    'isiWidth',
                    parseInt(e.target.value) || config.dimensions.width,
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Height</label>
              <input
                type="number"
                value={config.isiHeight}
                onChange={(e) =>
                  updateConfig('isiHeight', parseInt(e.target.value) || 540)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Top Position
              </label>
              <input
                type="number"
                value={config.isiTop}
                onChange={(e) =>
                  updateConfig('isiTop', parseInt(e.target.value) || 0)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Left Position
              </label>
              <input
                type="number"
                value={config.isiLeft || 0}
                onChange={(e) =>
                  updateConfig('isiLeft', parseInt(e.target.value) || 0)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Background Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={config.isiBackgroundColor || '#ffffff'}
                onChange={(e) =>
                  updateConfig('isiBackgroundColor', e.target.value)
                }
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={config.isiBackgroundColor || '#ffffff'}
                onChange={(e) =>
                  updateConfig('isiBackgroundColor', e.target.value)
                }
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* ISI Scroller Settings */}
      {hasISI && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700 border-b pb-2">
            ISI Scroller
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Auto-scroll Speed
              </label>
              <input
                type="number"
                value={config.autoScrollSpeed}
                onChange={(e) =>
                  updateConfig(
                    'autoScrollSpeed',
                    parseInt(e.target.value) || 80,
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="10"
                max="200"
              />
              <p className="text-xs text-gray-400 mt-1">ms between steps</p>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Scroll Step
              </label>
              <input
                type="number"
                value={config.scrollStep}
                onChange={(e) =>
                  updateConfig('scrollStep', parseInt(e.target.value) || 5)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="1"
                max="20"
              />
              <p className="text-xs text-gray-400 mt-1">pixels per step</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Scroller Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={config.scrollerColor || '#798280'}
                  onChange={(e) =>
                    updateConfig('scrollerColor', e.target.value)
                  }
                  className="w-10 h-9 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={config.scrollerColor || '#798280'}
                  onChange={(e) =>
                    updateConfig('scrollerColor', e.target.value)
                  }
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Track Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={config.scrollerTrackColor || '#b8bebc'}
                  onChange={(e) =>
                    updateConfig('scrollerTrackColor', e.target.value)
                  }
                  className="w-10 h-9 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={config.scrollerTrackColor || '#b8bebc'}
                  onChange={(e) =>
                    updateConfig('scrollerTrackColor', e.target.value)
                  }
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Width</label>
              <input
                type="number"
                value={config.scrollerWidth || 12}
                onChange={(e) =>
                  updateConfig('scrollerWidth', parseInt(e.target.value) || 12)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="6"
                max="30"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Height</label>
              <input
                type="number"
                value={config.scrollerHeight || 35}
                onChange={(e) =>
                  updateConfig('scrollerHeight', parseInt(e.target.value) || 35)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="20"
                max="100"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Radius</label>
              <input
                type="number"
                value={config.scrollerBorderRadius || 50}
                onChange={(e) =>
                  updateConfig(
                    'scrollerBorderRadius',
                    parseInt(e.target.value) || 50,
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="0"
                max="50"
              />
            </div>
          </div>
        </div>
      )}

      {/* Expandable ISI Settings */}
      {hasExpandable && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700 border-b pb-2">
            Expandable ISI
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Expanded Height
              </label>
              <input
                type="number"
                value={config.expandedHeight}
                onChange={(e) =>
                  updateConfig(
                    'expandedHeight',
                    parseInt(e.target.value) || 1742,
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">pixels</p>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Animation Duration
              </label>
              <input
                type="number"
                value={config.collapseDuration}
                onChange={(e) =>
                  updateConfig(
                    'collapseDuration',
                    parseFloat(e.target.value) || 1,
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0.1"
                max="3"
                step="0.1"
              />
              <p className="text-xs text-gray-400 mt-1">seconds</p>
            </div>
          </div>
        </div>
      )}

      {/* Video Settings */}
      {hasVideo && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700 border-b pb-2">
            Video Settings
          </h3>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Video Height
            </label>
            <input
              type="number"
              value={config.videoHeight}
              onChange={(e) =>
                updateConfig('videoHeight', parseInt(e.target.value) || 562)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">pixels</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showVideoControls"
              checked={config.showVideoControls}
              onChange={(e) =>
                updateConfig('showVideoControls', e.target.checked)
              }
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label
              htmlFor="showVideoControls"
              className="text-sm text-gray-600"
            >
              Show video controls
            </label>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Button Count
            </label>
            <select
              value={Math.min(config.buttonCount || 0, maxButtonCount)}
              onChange={(e) =>
                updateConfig('buttonCount', parseInt(e.target.value))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={0}>No Buttons</option>
              <option value={1}>1 Button</option>
              <option value={2}>2 Buttons</option>
              {maxButtonCount >= 3 && <option value={3}>3 Buttons</option>}
              {maxButtonCount >= 4 && <option value={4}>4 Buttons</option>}
            </select>
          </div>

          {/* Button Configuration */}
          {config.buttonCount > 0 && (
            <div className="space-y-3 mt-4">
              <h4 className="text-sm font-medium text-gray-600">
                Button Settings
              </h4>
              {Array.from({ length: config.buttonCount }).map((_, i) => {
                const btn = config.buttons?.[i] || {};
                const updateButton = (field, value) => {
                  const newButtons = [...(config.buttons || [])];
                  newButtons[i] = { ...newButtons[i], [field]: value };
                  updateConfig('buttons', newButtons);
                };
                return (
                  <div
                    key={i}
                    className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                  >
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Button {i + 1}
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={btn.text || `Button ${i + 1}`}
                        onChange={(e) => updateButton('text', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                        placeholder="Button text"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={btn.bgColor || '#6cc04a'}
                            onChange={(e) =>
                              updateButton('bgColor', e.target.value)
                            }
                            className="w-8 h-8 rounded cursor-pointer"
                          />
                          <span className="text-xs text-gray-500">BG</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={btn.textColor || '#ffffff'}
                            onChange={(e) =>
                              updateButton('textColor', e.target.value)
                            }
                            className="w-8 h-8 rounded cursor-pointer"
                          />
                          <span className="text-xs text-gray-500">Text</span>
                        </div>
                      </div>
                      <div className="position-container">
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Left</label>
                            <input
                              type="number"
                              value={btn.left}
                              onChange={(e) =>
                                updateButton('left', parseInt(e.target.value))
                              }
                              className="px-2 py-1 border rounded text-xs w-full"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Top</label>
                            <input
                              type="number"
                              value={btn.top}
                              onChange={(e) =>
                                updateButton('top', parseInt(e.target.value))
                              }
                              className="px-2 py-1 border rounded text-xs w-full"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Width</label>
                            <input
                              type="number"
                              value={Math.abs(btn.width)}
                              onChange={(e) =>
                                updateButton('width', parseInt(e.target.value))
                              }
                              className="px-2 py-1 border rounded text-xs w-full"
                              placeholder="200"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Height</label>
                            <input
                              type="number"
                              value={Math.abs(btn.height)}
                              onChange={(e) =>
                                updateButton('height', parseInt(e.target.value))
                              }
                              className="px-2 py-1 border rounded text-xs w-full"
                              placeholder="50"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ConfigPanel;
