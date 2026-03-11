import { useState } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { hasFeature } from '../../templates'
import AssetUploader from './AssetUploader'

const EASING_OPTIONS = [
  { value: 'none', label: 'Linear' },
  { value: 'Power1.easeOut', label: 'Ease Out' },
  { value: 'Power1.easeIn', label: 'Ease In' },
  { value: 'Power1.easeInOut', label: 'Ease In/Out' },
  { value: 'Power2.easeOut', label: 'Strong Ease Out' },
  { value: 'Power2.easeIn', label: 'Strong Ease In' },
  { value: 'Power2.easeInOut', label: 'Strong Ease In/Out' },
  { value: 'Back.easeOut', label: 'Back Out (overshoot)' },
  { value: 'Bounce.easeOut', label: 'Bounce Out' },
  { value: 'Elastic.easeOut', label: 'Elastic Out' },
]

const EFFECT_TYPES = [
  { value: 'autoAlpha', label: 'Fade (autoAlpha)', step: 0.1 },
  { value: 'x', label: 'Move X (horizontal)', step: 1 },
  { value: 'y', label: 'Move Y (vertical)', step: 1 },
  { value: 'rotation', label: 'Rotate (degrees)', step: 1 },
  { value: 'scale', label: 'Scale', step: 0.1 },
]

// Preset animation patterns
const PRESETS = [
  {
    id: 'fade-in',
    label: 'Fade In',
    type: 'in',
    effects: { autoAlpha: { from: 0, to: 1 } },
    easing: 'Power1.easeOut',
  },
  {
    id: 'fade-out',
    label: 'Fade Out',
    type: 'out',
    effects: { autoAlpha: { from: 1, to: 0 } },
    easing: 'Power1.easeIn',
  },
  {
    id: 'slide-in-right',
    label: 'Slide In from Right',
    type: 'in',
    effects: { autoAlpha: { from: 0, to: 1 }, x: { from: '__WIDTH__', to: 0 } },
    easing: 'Power2.easeOut',
  },
  {
    id: 'slide-out-left',
    label: 'Slide Out to Left',
    type: 'out',
    effects: { autoAlpha: { from: 1, to: 0 }, x: { from: 0, to: '-__WIDTH__' } },
    easing: 'Power2.easeIn',
  },
  {
    id: 'slide-in-left',
    label: 'Slide In from Left',
    type: 'in',
    effects: { autoAlpha: { from: 0, to: 1 }, x: { from: '-__WIDTH__', to: 0 } },
    easing: 'Power2.easeOut',
  },
  {
    id: 'slide-out-right',
    label: 'Slide Out to Right',
    type: 'out',
    effects: { autoAlpha: { from: 1, to: 0 }, x: { from: 0, to: '__WIDTH__' } },
    easing: 'Power2.easeIn',
  },
  {
    id: 'slide-in-bottom',
    label: 'Slide In from Bottom',
    type: 'in',
    effects: { autoAlpha: { from: 0, to: 1 }, y: { from: '__HEIGHT__', to: 0 } },
    easing: 'Power2.easeOut',
  },
  {
    id: 'slide-up-out',
    label: 'Slide Up & Out',
    type: 'out',
    effects: { autoAlpha: { from: 1, to: 0 }, y: { from: 0, to: '-__HEIGHT__' } },
    easing: 'Power2.easeIn',
  },
  {
    id: 'rotate-in-right-to-left',
    label: 'Rotate 90 + Move R to L',
    type: 'out',
    effects: { autoAlpha: { from: 1, to: 0 }, x: { from: 0, to: '-__WIDTH__' }, rotation: { from: 0, to: -90 } },
    easing: 'Power2.easeInOut',
  },
  {
    id: 'scale-in',
    label: 'Scale Up In',
    type: 'in',
    effects: { autoAlpha: { from: 0, to: 1 }, scale: { from: 0.5, to: 1 } },
    easing: 'Back.easeOut',
  },
  {
    id: 'scale-out',
    label: 'Scale Down Out',
    type: 'out',
    effects: { autoAlpha: { from: 1, to: 0 }, scale: { from: 1, to: 0.5 } },
    easing: 'Power1.easeIn',
  },
  {
    id: 'isi-slide-up',
    label: 'ISI Slide Up',
    type: 'in',
    forISI: true,
    effects: { autoAlpha: { from: 0, to: 1 }, y: { from: 200, to: 0 } },
    easing: 'Power2.easeOut',
  },
  {
    id: 'isi-fade-in',
    label: 'ISI Fade In',
    type: 'in',
    forISI: true,
    effects: { autoAlpha: { from: 0, to: 1 } },
    easing: 'Power1.easeOut',
  },
]

function AnimationEditor() {
  const currentTemplate = useProjectStore((state) => state.currentTemplate)
  const assets = useProjectStore((state) => state.assets)
  const animations = useProjectStore((state) => state.animations)
  const config = useProjectStore((state) => state.config)
  const setAsset = useProjectStore((state) => state.setAsset)
  const addFrame = useProjectStore((state) => state.addFrame)
  const removeFrame = useProjectStore((state) => state.removeFrame)
  const updateConfig = useProjectStore((state) => state.updateConfig)
  const addAnimation = useProjectStore((state) => state.addAnimation)
  const updateAnimation = useProjectStore((state) => state.updateAnimation)
  const removeAnimation = useProjectStore((state) => state.removeAnimation)
  const generateDefaultAnimations = useProjectStore((state) => state.generateDefaultAnimations)
  const [expandedId, setExpandedId] = useState(null)
  const [showPresets, setShowPresets] = useState(null) // target name or null

  if (!currentTemplate) return null

  const hasISI = hasFeature(currentTemplate, 'isi')
  const frameCount = assets.frames?.length || 0
  const adWidth = config.dimensions.width
  const adHeight = config.dimensions.height

  // Build target options: frames + ISI container
  const targetOptions = []
  for (let i = 0; i < frameCount; i++) {
    targetOptions.push({ value: `frame${i + 1}`, label: `Frame ${i + 1}` })
  }
  if (hasISI) {
    targetOptions.push({ value: 'outerMostDiv', label: 'ISI Container' })
  }

  // Sort animations by startTime for display
  const sortedAnimations = [...animations].sort((a, b) => a.startTime - b.startTime)

  // Calculate total timeline duration
  const totalDuration = animations.reduce((max, a) => Math.max(max, a.startTime + a.duration), 0)

  // Resolve preset placeholders with actual ad dimensions
  const resolveValue = (val) => {
    if (typeof val !== 'string') return val
    const replacements = { '__WIDTH__': adWidth, '__HEIGHT__': adHeight }
    for (const [placeholder, dim] of Object.entries(replacements)) {
      if (val === placeholder) return dim
      if (val === `-${placeholder}`) return -dim
    }
    return parseFloat(val) || 0
  }

  const resolvePresetEffects = (effects) => {
    const resolved = {}
    for (const [key, val] of Object.entries(effects)) {
      resolved[key] = { from: resolveValue(val.from), to: resolveValue(val.to) }
    }
    return resolved
  }

  const handleAddFromPreset = (preset, target) => {
    const lastAnim = sortedAnimations[sortedAnimations.length - 1]
    const nextStart = lastAnim ? lastAnim.startTime + lastAnim.duration : 0

    addAnimation({
      target,
      type: preset.type,
      effects: resolvePresetEffects(preset.effects),
      duration: config.frameDuration || 0.5,
      startTime: nextStart,
      easing: preset.easing,
    })
    setShowPresets(null)
  }

  const handleAddBlank = () => {
    const lastAnim = sortedAnimations[sortedAnimations.length - 1]
    const nextStart = lastAnim ? lastAnim.startTime + lastAnim.duration : 0
    const defaultTarget = targetOptions[0]?.value || 'frame1'

    addAnimation({
      target: defaultTarget,
      type: 'in',
      effects: { autoAlpha: { from: 0, to: 1 } },
      duration: config.frameDuration || 0.5,
      startTime: nextStart,
      easing: 'Power1.easeOut',
    })
  }

  const handleEffectToggle = (animId, effectKey, enabled, anim) => {
    const newEffects = { ...anim.effects }
    if (enabled) {
      const defaults = {
        autoAlpha: { from: 0, to: 1 },
        x: { from: 0, to: 0 },
        y: { from: 0, to: 0 },
        rotation: { from: 0, to: 0 },
        scale: { from: 1, to: 1 },
      }
      newEffects[effectKey] = defaults[effectKey]
    } else {
      delete newEffects[effectKey]
    }
    updateAnimation(animId, { effects: newEffects })
  }

  const handleEffectValueChange = (animId, effectKey, prop, value, anim) => {
    const newEffects = { ...anim.effects }
    newEffects[effectKey] = { ...newEffects[effectKey], [prop]: parseFloat(value) || 0 }
    updateAnimation(animId, { effects: newEffects })
  }

  return (
    <div className="p-4 space-y-4">
      {/* ===== FRAME MANAGEMENT ===== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Animation Frames</h2>
          <span className="text-xs text-gray-500">{frameCount} frame(s)</span>
        </div>

        {assets.frames.map((frame, index) => (
          <div key={index}>
            <AssetUploader
              label={`Frame ${index + 1}`}
              accept="image/*"
              currentAsset={frame}
              onUpload={(result) => {
                const newFrames = [...assets.frames]
                newFrames[index] = result
                setAsset('frames', newFrames)
              }}
              onRemove={() => removeFrame(index)}
              compact
            />
          </div>
        ))}

        <button
          onClick={() => addFrame(null)}
          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors text-sm"
        >
          + Add Frame
        </button>
      </div>

      {/* Default Timing (used by Auto-Generate) */}
      {frameCount > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Default Duration</label>
            <input
              type="number"
              value={config.frameDuration}
              onChange={(e) => updateConfig('frameDuration', parseFloat(e.target.value) || 0.5)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              min="0.1"
              max="5"
              step="0.1"
            />
            <p className="text-xs text-gray-400 mt-0.5">seconds (tween)</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Default Delay</label>
            <input
              type="number"
              value={config.frameDelay}
              onChange={(e) => updateConfig('frameDelay', parseFloat(e.target.value) || 1)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              min="0.5"
              max="10"
              step="0.5"
            />
            <p className="text-xs text-gray-400 mt-0.5">seconds between frames</p>
          </div>
        </div>
      )}

      {/* Divider */}
      <hr className="border-gray-200" />

      {/* ===== ANIMATION TIMELINE ===== */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Timeline</h2>
        {totalDuration > 0 && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {totalDuration.toFixed(1)}s total
          </span>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        {frameCount > 0 && (
          <button
            onClick={generateDefaultAnimations}
            className="flex-1 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            title="Generate fade in/out for all frames using current frame duration/delay settings"
          >
            Auto-Generate Fades
          </button>
        )}
        <button
          onClick={handleAddBlank}
          className="flex-1 px-3 py-2 text-sm bg-primary-600 text-white hover:bg-primary-700 rounded-lg transition-colors"
          disabled={targetOptions.length === 0}
        >
          + Add Step
        </button>
      </div>

      {/* Preset Quick-Add */}
      {targetOptions.length > 0 && (
        <div className="space-y-1">
          <label className="block text-xs text-gray-500 font-medium">Add from preset:</label>
          <div className="flex flex-wrap gap-1">
            {targetOptions.map(target => (
              <button
                key={target.value}
                onClick={() => setShowPresets(showPresets === target.value ? null : target.value)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  showPresets === target.value
                    ? 'bg-primary-100 border-primary-400 text-primary-700'
                    : 'bg-white border-gray-300 text-gray-600 hover:border-primary-300'
                }`}
              >
                {target.label}
              </button>
            ))}
          </div>

          {/* Preset Dropdown */}
          {showPresets && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 space-y-1">
              <div className="text-xs text-gray-400 font-medium mb-1">
                Presets for {targetOptions.find(t => t.value === showPresets)?.label}
              </div>

              {/* Frame presets */}
              {!showPresets.startsWith('outer') && (
                <>
                  <div className="text-xs text-gray-400 mt-1 mb-0.5">Fades</div>
                  {PRESETS.filter(p => !p.forISI && (p.id === 'fade-in' || p.id === 'fade-out')).map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleAddFromPreset(preset, showPresets)}
                      className="w-full text-left px-2 py-1.5 text-sm hover:bg-primary-50 rounded transition-colors flex items-center gap-2"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${preset.type === 'in' ? 'bg-green-500' : 'bg-red-500'}`} />
                      {preset.label}
                    </button>
                  ))}
                  <div className="text-xs text-gray-400 mt-1 mb-0.5">Slides</div>
                  {PRESETS.filter(p => !p.forISI && p.id.startsWith('slide')).map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleAddFromPreset(preset, showPresets)}
                      className="w-full text-left px-2 py-1.5 text-sm hover:bg-primary-50 rounded transition-colors flex items-center gap-2"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${preset.type === 'in' ? 'bg-green-500' : 'bg-red-500'}`} />
                      {preset.label}
                    </button>
                  ))}
                  <div className="text-xs text-gray-400 mt-1 mb-0.5">Scale & Rotate</div>
                  {PRESETS.filter(p => !p.forISI && (p.id.startsWith('scale') || p.id.startsWith('rotate'))).map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleAddFromPreset(preset, showPresets)}
                      className="w-full text-left px-2 py-1.5 text-sm hover:bg-primary-50 rounded transition-colors flex items-center gap-2"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${preset.type === 'in' ? 'bg-green-500' : 'bg-red-500'}`} />
                      {preset.label}
                    </button>
                  ))}
                </>
              )}

              {/* ISI-specific presets */}
              {showPresets.startsWith('outer') && (
                <>
                  <div className="text-xs text-gray-400 mt-1 mb-0.5">ISI Entrance</div>
                  {PRESETS.filter(p => p.forISI).map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleAddFromPreset(preset, showPresets)}
                      className="w-full text-left px-2 py-1.5 text-sm hover:bg-primary-50 rounded transition-colors flex items-center gap-2"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${preset.type === 'in' ? 'bg-green-500' : 'bg-red-500'}`} />
                      {preset.label}
                    </button>
                  ))}
                  {/* Also show generic fades for ISI */}
                  <div className="text-xs text-gray-400 mt-1 mb-0.5">General</div>
                  {PRESETS.filter(p => !p.forISI && (p.id === 'fade-in' || p.id === 'fade-out')).map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleAddFromPreset(preset, showPresets)}
                      className="w-full text-left px-2 py-1.5 text-sm hover:bg-primary-50 rounded transition-colors flex items-center gap-2"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${preset.type === 'in' ? 'bg-green-500' : 'bg-red-500'}`} />
                      {preset.label}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {targetOptions.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-700">Add animation frames above to start building your timeline.</p>
        </div>
      )}

      {/* Timeline Visual Bar */}
      {animations.length > 0 && totalDuration > 0 && (
        <div className="bg-gray-900 rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>0s</span>
            <span>{totalDuration.toFixed(1)}s</span>
          </div>
          {targetOptions.map(target => {
            const targetAnims = sortedAnimations.filter(a => a.target === target.value)
            if (targetAnims.length === 0) return null
            return (
              <div key={target.value} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16 truncate">{target.label}</span>
                <div className="flex-1 h-5 bg-gray-800 rounded relative">
                  {targetAnims.map(anim => {
                    const left = (anim.startTime / totalDuration) * 100
                    const width = Math.max((anim.duration / totalDuration) * 100, 1)
                    const hasMovement = anim.effects.x || anim.effects.y
                    const hasRotation = anim.effects.rotation
                    const hasScale = anim.effects.scale
                    // Color-code by effect type
                    let bgColor = anim.type === 'in' ? 'bg-green-500' : 'bg-red-500'
                    if (hasMovement) bgColor = anim.type === 'in' ? 'bg-blue-500' : 'bg-orange-500'
                    if (hasRotation) bgColor = 'bg-purple-500'
                    if (hasScale) bgColor = anim.type === 'in' ? 'bg-teal-500' : 'bg-pink-500'

                    return (
                      <div
                        key={anim.id}
                        className={`absolute h-full rounded cursor-pointer ${bgColor} bg-opacity-80 ${
                          expandedId === anim.id ? 'ring-2 ring-white' : ''
                        }`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        onClick={() => setExpandedId(expandedId === anim.id ? null : anim.id)}
                        title={`${target.label} ${anim.type} @ ${anim.startTime}s (${anim.duration}s)`}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
          <div className="flex flex-wrap gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-2 h-2 rounded bg-green-500 inline-block" /> Fade In
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-2 h-2 rounded bg-red-500 inline-block" /> Fade Out
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-2 h-2 rounded bg-blue-500 inline-block" /> Move In
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-2 h-2 rounded bg-orange-500 inline-block" /> Move Out
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-2 h-2 rounded bg-purple-500 inline-block" /> Rotate
            </span>
          </div>
        </div>
      )}

      {/* Animation List */}
      <div className="space-y-2">
        {sortedAnimations.map((anim) => {
          const isExpanded = expandedId === anim.id
          const targetLabel = targetOptions.find(t => t.value === anim.target)?.label || anim.target
          const effectNames = Object.keys(anim.effects).map(k =>
            EFFECT_TYPES.find(e => e.value === k)?.label?.split(' ')[0] || k
          ).join(' + ')

          return (
            <div
              key={anim.id}
              className={`border rounded-lg transition-colors ${
                isExpanded ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-white'
              }`}
            >
              {/* Collapsed Header */}
              <div
                className="flex items-center gap-2 p-3 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : anim.id)}
              >
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  anim.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {anim.type === 'in' ? 'IN' : 'OUT'}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{targetLabel}</span>
                  <span className="text-xs text-gray-400 ml-1">{effectNames}</span>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  @{anim.startTime}s / {anim.duration}s
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-gray-200 pt-3">
                  {/* Target & Type */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Target</label>
                      <select
                        value={anim.target}
                        onChange={(e) => updateAnimation(anim.id, { target: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      >
                        {targetOptions.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Direction</label>
                      <select
                        value={anim.type}
                        onChange={(e) => updateAnimation(anim.id, { type: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      >
                        <option value="in">In (appear)</option>
                        <option value="out">Out (disappear)</option>
                      </select>
                    </div>
                  </div>

                  {/* Timing */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Start Time (s)</label>
                      <input
                        type="number"
                        value={anim.startTime}
                        onChange={(e) => updateAnimation(anim.id, { startTime: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                        min="0"
                        step="0.1"
                      />
                      <p className="text-xs text-gray-400 mt-0.5">Position on the timeline</p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Duration (s)</label>
                      <input
                        type="number"
                        value={anim.duration}
                        onChange={(e) => updateAnimation(anim.id, { duration: parseFloat(e.target.value) || 0.1 })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                        min="0.1"
                        step="0.1"
                      />
                      <p className="text-xs text-gray-400 mt-0.5">Tween duration</p>
                    </div>
                  </div>

                  {/* Easing */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Easing</label>
                    <select
                      value={anim.easing}
                      onChange={(e) => updateAnimation(anim.id, { easing: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    >
                      {EASING_OPTIONS.map(e => (
                        <option key={e.value} value={e.value}>{e.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Effects */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Effects</label>
                    <div className="space-y-2">
                      {EFFECT_TYPES.map(effect => {
                        const isActive = anim.effects[effect.value] !== undefined
                        const effectData = anim.effects[effect.value]

                        return (
                          <div key={effect.value} className="bg-gray-50 rounded p-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => handleEffectToggle(anim.id, effect.value, e.target.checked, anim)}
                                className="rounded border-gray-300 text-primary-600"
                              />
                              <span className="text-sm">{effect.label}</span>
                            </div>

                            {isActive && (
                              <div className="grid grid-cols-2 gap-2 mt-2 ml-6">
                                <div>
                                  <label className="block text-xs text-gray-400">From</label>
                                  <input
                                    type="number"
                                    value={effectData.from}
                                    onChange={(e) => handleEffectValueChange(anim.id, effect.value, 'from', e.target.value, anim)}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                    step={effect.step}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-400">To</label>
                                  <input
                                    type="number"
                                    value={effectData.to}
                                    onChange={(e) => handleEffectValueChange(anim.id, effect.value, 'to', e.target.value, anim)}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                    step={effect.step}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Duplicate & Delete */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const { id, ...rest } = anim
                        addAnimation({ ...rest, startTime: anim.startTime + anim.duration })
                      }}
                      className="flex-1 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => {
                        removeAnimation(anim.id)
                        setExpandedId(null)
                      }}
                      className="flex-1 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Help Text */}
      {animations.length === 0 && targetOptions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <p className="text-sm text-blue-800 font-medium">Getting Started</p>
          <ul className="text-xs text-blue-700 space-y-1">
            <li><strong>Auto-Generate Fades</strong> — quick fade in/out for all frames.</li>
            <li><strong>Presets</strong> — click a target above to pick from slide, rotate, scale, and ISI presets.</li>
            <li><strong>+ Add Step</strong> — blank animation step for full manual control.</li>
            <li>Each step has a <strong>start time</strong> (when it fires) and <strong>duration</strong> (how long). Combine effects freely.</li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default AnimationEditor
