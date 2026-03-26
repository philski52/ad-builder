import { useMemo, useState, useRef } from 'react'
import { useClickZoneToolStore } from '../../stores/clickZoneToolStore'

function ClickZoneToolPreview() {
  const htmlContent = useClickZoneToolStore((s) => s.htmlContent)
  const files = useClickZoneToolStore((s) => s.files)
  const dimensions = useClickZoneToolStore((s) => s.dimensions)
  const clickZones = useClickZoneToolStore((s) => s.clickZones)
  const selectedZoneIndex = useClickZoneToolStore((s) => s.selectedZoneIndex)
  const setSelectedZone = useClickZoneToolStore((s) => s.setSelectedZone)
  const updateZonePosition = useClickZoneToolStore((s) => s.updateZonePosition)

  const [scale, setScale] = useState(0.4)
  const [key, setKey] = useState(0)

  // Drag/resize state — reuses same pattern as PreviewIframe non-ISI zones
  const [isZoneDragging, setIsZoneDragging] = useState(false)
  const [zoneResizeMode, setZoneResizeMode] = useState(null)
  const [zoneDragStart, setZoneDragStart] = useState({ x: 0, y: 0, top: 0, left: 0, width: 0, height: 0 })
  const [zoneDragOffset, setZoneDragOffset] = useState({ top: 0, left: 0, width: 0, height: 0 })

  // Build preview HTML with inlined assets
  const previewHTML = useMemo(() => {
    if (!htmlContent) return ''
    let html = htmlContent

    // Replace asset paths with data URLs
    for (const [filename, file] of Object.entries(files)) {
      if (!file.dataUrl) continue
      const basename = filename.split('/').pop()
      // Build all possible path variations the HTML might reference
      const patterns = [basename]
      // Add with each parent folder: img/bg.jpg, ./img/bg.jpg, images/bg.jpg, etc.
      const parts = filename.split('/')
      for (let i = 0; i < parts.length; i++) {
        const subpath = parts.slice(i).join('/')
        if (subpath && !patterns.includes(subpath)) patterns.push(subpath)
        if (subpath && !patterns.includes('./' + subpath)) patterns.push('./' + subpath)
      }
      for (const pattern of patterns) {
        html = html.split(`src="${pattern}"`).join(`src="${file.dataUrl}"`)
        html = html.split(`src='${pattern}'`).join(`src='${file.dataUrl}'`)
        html = html.split(`href="${pattern}"`).join(`href="${file.dataUrl}"`)
        html = html.split(`url("${pattern}")`).join(`url("${file.dataUrl}")`)
        html = html.split(`url('${pattern}')`).join(`url('${file.dataUrl}')`)
        html = html.split(`url(${pattern})`).join(`url(${file.dataUrl})`)
      }
    }

    // Disable click handlers so they don't interfere with overlay
    html = html.replace(/onclick="[^"]*"/gi, 'onclick="event.preventDefault()"')
    html = html.replace(/onclick='[^']*'/gi, "onclick='event.preventDefault()'")

    // Strip external script tags — we don't need animation/click JS for the click zone preview
    // This prevents errors from AppHost, GSAP CDN, Enabler.js, etc.
    html = html.replace(/<script[^>]*src=["'][^"']*["'][^>]*><\/script>/gi, '<!-- script removed for preview -->')
    // Strip inline scripts (except style-related ones)
    html = html.replace(/<script(?![^>]*type=["']text\/css["'])[^>]*>[\s\S]*?<\/script>/gi, '<!-- script removed for preview -->')

    // Force all elements visible — agencies hide content until JS runs via:
    // visibility:hidden, display:none, opacity:0, autoAlpha (visibility+opacity)
    html = html.replace(/<\/head>/i, `<style>
      * { visibility: visible !important; opacity: 1 !important; }
      .banner, #banner, #adHolder, #ad, #container, #viewport, #designContainer,
      .gwd-page, .gwd-pagedeck, [id*="frame"], [class*="frame"],
      [id*="slide"], [class*="slide"], .not-visible, .gwd-inactive,
      .hidden, .js-bnfy { display: block !important; }
      body { overflow: visible !important; margin: 0; padding: 0; }
      html, body { width: 100%; height: 100%; }
      /* Allow ISI to scroll — remove overflow clipping but keep positioning intact */
      #outerMostDiv, #innerMostDiv, #isi-container, #isi-con,
      [id*="isi"], [class*="isi"] { overflow: visible !important; }
      #isi-controls, .scroller, .isiLineNoArrows, .scrollbar_bottom,
      .knob, .knob-arrange, .scroller-container { display: none !important; }
    </style></head>`)

    // Also strip inline visibility:hidden and display:none from style attributes
    html = html.replace(/style="[^"]*visibility:\s*hidden[^"]*"/gi, function(match) {
      return match.replace(/visibility:\s*hidden\s*;?/gi, 'visibility:visible;')
    })
    html = html.replace(/style="[^"]*display:\s*none[^"]*"/gi, function(match) {
      return match.replace(/display:\s*none\s*;?/gi, 'display:block;')
    })

    return html
  }, [htmlContent, files])

  // Zone mouse handlers — same pattern as PreviewIframe
  const handleZoneMouseDown = (e, index, mode) => {
    e.stopPropagation()
    const zone = clickZones[index]
    if (!zone) return
    setSelectedZone(index)
    setZoneDragStart({
      x: e.clientX,
      y: e.clientY,
      top: zone.top,
      left: zone.left,
      width: zone.width,
      height: zone.height
    })
    setZoneDragOffset({ top: 0, left: 0, width: 0, height: 0 })
    if (mode === 'move') {
      setIsZoneDragging(true)
    } else {
      setZoneResizeMode(mode)
    }
  }

  const handleMouseMove = (e) => {
    if (!isZoneDragging && !zoneResizeMode) return
    if (selectedZoneIndex === null) return
    const zone = clickZones[selectedZoneIndex]
    if (!zone) return

    const deltaX = (e.clientX - zoneDragStart.x) / scale
    const deltaY = (e.clientY - zoneDragStart.y) / scale
    const maxWidth = dimensions.width
    const maxHeight = dimensions.height
    let offset = { top: 0, left: 0, width: 0, height: 0 }

    if (isZoneDragging) {
      const newTop = Math.max(0, Math.min(maxHeight - zoneDragStart.height, zoneDragStart.top + deltaY))
      const newLeft = Math.max(0, Math.min(maxWidth - zoneDragStart.width, zoneDragStart.left + deltaX))
      offset = { top: newTop - zoneDragStart.top, left: newLeft - zoneDragStart.left, width: 0, height: 0 }
    } else if (zoneResizeMode === 'top') {
      const newTop = Math.max(0, zoneDragStart.top + deltaY)
      const newHeight = Math.max(20, zoneDragStart.height - deltaY)
      if (newTop >= 0 && newTop + newHeight <= maxHeight) {
        offset = { top: newTop - zoneDragStart.top, left: 0, width: 0, height: newHeight - zoneDragStart.height }
      }
    } else if (zoneResizeMode === 'bottom') {
      const newHeight = Math.max(20, zoneDragStart.height + deltaY)
      if (zoneDragStart.top + newHeight <= maxHeight) {
        offset = { top: 0, left: 0, width: 0, height: newHeight - zoneDragStart.height }
      }
    } else if (zoneResizeMode === 'left') {
      const newLeft = Math.max(0, zoneDragStart.left + deltaX)
      const newWidth = Math.max(20, zoneDragStart.width - deltaX)
      if (newLeft >= 0 && newLeft + newWidth <= maxWidth) {
        offset = { top: 0, left: newLeft - zoneDragStart.left, width: newWidth - zoneDragStart.width, height: 0 }
      }
    } else if (zoneResizeMode === 'right') {
      const newWidth = Math.max(20, zoneDragStart.width + deltaX)
      if (zoneDragStart.left + newWidth <= maxWidth) {
        offset = { top: 0, left: 0, width: newWidth - zoneDragStart.width, height: 0 }
      }
    }

    setZoneDragOffset(offset)
  }

  const handleMouseUp = () => {
    if ((isZoneDragging || zoneResizeMode) && selectedZoneIndex !== null) {
      const zone = clickZones[selectedZoneIndex]
      if (zone) {
        updateZonePosition(selectedZoneIndex, {
          top: Math.round(zone.top + zoneDragOffset.top),
          left: Math.round(zone.left + zoneDragOffset.left),
          width: Math.round(zone.width + zoneDragOffset.width),
          height: Math.round(zone.height + zoneDragOffset.height)
        })
      }
    }
    setIsZoneDragging(false)
    setZoneResizeMode(null)
    setZoneDragOffset({ top: 0, left: 0, width: 0, height: 0 })
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      setSelectedZone(null)
    }
  }

  const frameWidth = dimensions.width * scale + 2
  const frameHeight = dimensions.height * scale + 2

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm text-gray-600">Scale:</span>
        <input type="range" min="0.2" max="1" step="0.1" value={scale} onChange={e => setScale(parseFloat(e.target.value))} className="w-32" />
        <span className="text-sm text-gray-500">{Math.round(scale * 100)}%</span>
        <button onClick={() => setKey(k => k + 1)} className="ml-auto text-sm text-blue-600 hover:text-blue-800">
          Refresh Preview
        </button>
      </div>

      <div className="inline-block">
        <div
          className="border border-gray-300 rounded-lg overflow-hidden shadow-lg bg-white"
          style={{ width: frameWidth, height: frameHeight }}
        >
          <div
            style={{
              width: dimensions.width * scale,
              height: dimensions.height * scale,
              overflow: 'hidden',
              background: 'white',
              position: 'relative'
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleOverlayClick}
          >
            <iframe
              key={key}
              srcDoc={previewHTML}
              style={{
                width: dimensions.width,
                height: dimensions.height,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                border: 'none',
                pointerEvents: (isZoneDragging || zoneResizeMode) ? 'none' : 'auto'
              }}
              title="Ad Preview"
              sandbox="allow-scripts allow-same-origin"
            />

            {/* Click Zone Overlays — same pattern as PreviewIframe non-ISI zones */}
            {clickZones.map((zone, idx) => {
              const isBeingDragged = (isZoneDragging || zoneResizeMode) && selectedZoneIndex === idx
              const effectiveTop = zone.top + (isBeingDragged ? zoneDragOffset.top : 0)
              const effectiveLeft = zone.left + (isBeingDragged ? zoneDragOffset.left : 0)
              const effectiveWidth = zone.width + (isBeingDragged ? zoneDragOffset.width : 0)
              const effectiveHeight = zone.height + (isBeingDragged ? zoneDragOffset.height : 0)
              const isSelected = selectedZoneIndex === idx
              const baseColor = zone.detected ? '#f59e0b' : '#3b82f6'

              return (
                <div
                  key={zone.id + '-' + idx}
                  style={{
                    position: 'absolute',
                    left: effectiveLeft * scale,
                    top: effectiveTop * scale,
                    width: effectiveWidth * scale,
                    height: effectiveHeight * scale,
                    border: isSelected ? `2px solid ${baseColor}` : `2px dashed ${baseColor}`,
                    backgroundColor: isSelected ? `${baseColor}15` : 'transparent',
                    boxSizing: 'border-box',
                    pointerEvents: 'none',
                    transition: (isZoneDragging || zoneResizeMode) ? 'none' : 'all 0.15s ease'
                  }}
                >
                  {/* Move handle / label */}
                  <div
                    onClick={(e) => { e.stopPropagation(); setSelectedZone(idx) }}
                    onMouseDown={(e) => handleZoneMouseDown(e, idx, 'move')}
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: 2,
                      backgroundColor: baseColor,
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'auto',
                      cursor: isZoneDragging && selectedZoneIndex === idx ? 'grabbing' : 'grab',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                    }}
                    title="Drag to move zone"
                  >
                    {zone.detected ? '* ' : ''}
                    {zone.id}
                  </div>

                  {/* Resize handles when selected */}
                  {isSelected && (
                    <>
                      <div onMouseDown={(e) => handleZoneMouseDown(e, idx, 'top')} style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 30, height: 8, backgroundColor: baseColor, borderRadius: 4, cursor: 'ns-resize', pointerEvents: 'auto' }} />
                      <div onMouseDown={(e) => handleZoneMouseDown(e, idx, 'bottom')} style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 30, height: 8, backgroundColor: baseColor, borderRadius: 4, cursor: 'ns-resize', pointerEvents: 'auto' }} />
                      <div onMouseDown={(e) => handleZoneMouseDown(e, idx, 'left')} style={{ position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)', width: 8, height: 30, backgroundColor: baseColor, borderRadius: 4, cursor: 'ew-resize', pointerEvents: 'auto' }} />
                      <div onMouseDown={(e) => handleZoneMouseDown(e, idx, 'right')} style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', width: 8, height: 30, backgroundColor: baseColor, borderRadius: 4, cursor: 'ew-resize', pointerEvents: 'auto' }} />
                      <div style={{ position: 'absolute', bottom: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '1px 4px', borderRadius: 2, fontSize: 8, pointerEvents: 'none' }}>
                        {Math.round(effectiveWidth)}x{Math.round(effectiveHeight)} @ ({Math.round(effectiveLeft)}, {Math.round(effectiveTop)})
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400">
        {dimensions.width} x {dimensions.height}px
        {clickZones.some(z => z.detected) && (
          <span className="ml-2 text-amber-500">* = detected from original ad</span>
        )}
      </p>
    </div>
  )
}

export default ClickZoneToolPreview
