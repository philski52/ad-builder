import { useMemo, useState, useEffect, useRef } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { hasFeature } from '../../templates'
import { generateHTML, generateCSS, generateScrollerCSS, generateMainJS, generateAdJS, generateClicksCSS, generateExpandableCSS, generateExpandCollapseJS } from '../../utils/templateGenerator'

function BrowserPreview({ dimensions, scale, children }) {
  const frameWidth = dimensions.width * scale + 2
  const frameHeight = dimensions.height * scale + 2

  return (
    <div className="inline-block">
      <div
        className="border border-gray-300 rounded-lg overflow-hidden shadow-lg bg-white"
        style={{ width: frameWidth, height: frameHeight }}
      >
        {children}
      </div>
    </div>
  )
}

function PreviewIframe() {
  const currentTemplate = useProjectStore((state) => state.currentTemplate)
  const config = useProjectStore((state) => state.config)
  const assets = useProjectStore((state) => state.assets)
  const animations = useProjectStore((state) => state.animations)
  const updateConfig = useProjectStore((state) => state.updateConfig)

  const [scale, setScale] = useState(0.4)
  const [key, setKey] = useState(0)
  const [isiSelected, setIsiSelected] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [resizeMode, setResizeMode] = useState(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, isiTop: 0, isiHeight: 0, isiWidth: 0, isiLeft: 0 })
  const [selectedZoneIndex, setSelectedZoneIndex] = useState(null)
  const [isZoneDragging, setIsZoneDragging] = useState(false)
  const [zoneResizeMode, setZoneResizeMode] = useState(null)
  const [zoneDragStart, setZoneDragStart] = useState({ x: 0, y: 0, top: 0, left: 0, width: 0, height: 0 })
  const [zoneDragOffset, setZoneDragOffset] = useState({ top: 0, left: 0, width: 0, height: 0 })

  const containerRef = useRef(null)
  const iframeRef = useRef(null)
  const isiScrollPosRef = useRef(0)

  // Handle ISI zone position updates from iframe
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data && e.data.type === 'zonePositionUpdate') {
        const { zoneIndex, top, left, width, height } = e.data
        const zones = config.clickZones || []
        if (zones[zoneIndex]) {
          try {
            const iframe = iframeRef.current
            if (iframe && iframe.contentWindow) {
              const innerDiv = iframe.contentWindow.document.getElementById('innerMostDiv')
              if (innerDiv) {
                isiScrollPosRef.current = innerDiv.scrollTop
              }
            }
          } catch (err) { /* ignore cross-origin errors */ }

          const newZones = [...zones]
          newZones[zoneIndex] = {
            ...newZones[zoneIndex],
            top: Math.round(top),
            left: Math.round(left),
            ...(width !== undefined && { width: Math.round(width) }),
            ...(height !== undefined && { height: Math.round(height) })
          }
          updateConfig('clickZones', newZones)
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [config.clickZones, updateConfig])

  // Restore scroll position after config updates
  const handleIframeLoad = () => {
    if (isiScrollPosRef.current > 0 && iframeRef.current) {
      setTimeout(() => {
        try {
          const innerDiv = iframeRef.current.contentWindow.document.getElementById('innerMostDiv')
          if (innerDiv) {
            innerDiv.scrollTop = isiScrollPosRef.current
          }
        } catch (err) { /* ignore */ }
      }, 100)
    }
  }

  const previewHTML = useMemo(() => {
    if (!currentTemplate) return ''

    const hasISI = hasFeature(currentTemplate, 'isi')
    const hasExpandable = hasFeature(currentTemplate, 'expandable') && config.expandableEnabled
    let html = generateHTML(currentTemplate, config, assets, animations)
    const css = generateCSS(config)
    const scrollerCss = hasISI ? generateScrollerCSS(config) : ''
    const mainJs = hasISI ? generateMainJS(config) : ''
    const adJs = generateAdJS(config)
    const clicksCss = generateClicksCSS(config)
    const expandableCss = hasExpandable ? generateExpandableCSS(config) : ''
    const expandCollapseJs = hasExpandable ? generateExpandCollapseJS(config) : ''

    // Inline CSS
    html = html.replace('<link rel="stylesheet" href="css/main.css">', `<style>${css}\n${scrollerCss}\n${clicksCss}\n${expandableCss}</style>`)
    html = html.replace(/<link rel="stylesheet" href="css\/[^"]+\.css">/g, '')

    // Inline ad.js
    html = html.replace('<script src="script/ad.js"></script>', `<script>${adJs}</script>`)

    // Inline main.js for ISI templates
    if (hasISI) {
      html = html.replace('<script src="script/main.js"></script>', `<script>${mainJs}</script>`)
    }

    // Inline expandCollapse.js for expandable templates
    if (hasExpandable) {
      html = html.replace('<script src="script/expandCollapse.js"></script>', `<script>${expandCollapseJs}</script>`)
    }

    // Remove external script refs
    html = html.replace(/<script src="script\/[^"]+\.js"><\/script>/g, '')
    html = html.replace(/<script src="controls\/[^"]+\.js"><\/script>/g, '')

    // Add ISI zone indicators with drag/resize script
    const hasISIZones = hasISI && (config.clickZones || []).some(z => z.inISI)
    if (hasISIZones) {
      const isiZones = (config.clickZones || []).filter(z => z.inISI)
      const zoneIndicatorsHTML = isiZones.map((z, i) => {
        const actualIndex = (config.clickZones || []).indexOf(z)
        return `<div class="zone-indicator in-isi" data-zone-index="${actualIndex}"
          style="position:absolute; top:${z.top}px; left:${z.left}px; width:${z.width}px; height:${z.height}px;
                 border:2px dashed rgba(16,185,129,0.8); background:rgba(16,185,129,0.1);
                 box-sizing:border-box; cursor:grab; z-index:100; transition: none;">
          <div style="position:absolute; top:2px; left:2px; background:#10b981; color:white; padding:2px 6px;
                      border-radius:3px; font-size:9px; font-weight:bold; white-space:nowrap; pointer-events:none;">
            ${z.id}
          </div>
          <div class="resize-handle" data-resize="move" style="position:absolute; inset:0; cursor:grab;"></div>
          <div class="resize-handle" data-resize="right" style="position:absolute; top:0; right:-4px; width:8px; height:100%; cursor:ew-resize;"></div>
          <div class="resize-handle" data-resize="bottom" style="position:absolute; bottom:-4px; left:0; width:100%; height:8px; cursor:ns-resize;"></div>
          <div class="resize-handle" data-resize="left" style="position:absolute; top:0; left:-4px; width:8px; height:100%; cursor:ew-resize;"></div>
          <div class="resize-handle" data-resize="top" style="position:absolute; top:-4px; left:0; width:100%; height:8px; cursor:ns-resize;"></div>
          <div class="resize-handle" data-resize="bottom-right" style="position:absolute; bottom:-4px; right:-4px; width:12px; height:12px; cursor:nwse-resize; background:#10b981; border-radius:2px;"></div>
        </div>`
      }).join('')

      // Insert zone indicators inside #isi-content-wrapper (before its closing tag)
      // so they scroll with the ISI content
      html = html.replace(
        '</div>\n            </div>\n            <div id="isi-controls">',
        `${zoneIndicatorsHTML}</div>\n            </div>\n            <div id="isi-controls">`
      )

      // Add drag/resize script for ISI zones
      const dragScript = `<script>
        (function() {
          var active = null;
          var mode = null;
          var startX = 0, startY = 0;
          var startLeft = 0, startTop = 0;
          var startWidth = 0, startHeight = 0;
          var autoScrollOffset = 0;
          var autoScrollInterval = null;
          var outerDiv = document.getElementById('outerMostDiv');
          var innerDiv = document.getElementById('innerMostDiv');
          var maxLeft = ${(config.isiWidth || config.dimensions.width) - 50};

          function selectZone(el) {
            document.querySelectorAll('.zone-indicator.in-isi').forEach(function(z) {
              z.style.border = '2px dashed rgba(16,185,129,0.8)';
              z.style.background = 'rgba(16,185,129,0.1)';
            });
            if (el) {
              el.style.border = '2px solid #10b981';
              el.style.background = 'rgba(16,185,129,0.2)';
            }
          }

          document.querySelectorAll('.zone-indicator.in-isi .resize-handle').forEach(function(handle) {
            handle.addEventListener('mousedown', function(e) {
              e.preventDefault();
              e.stopPropagation();
              var el = handle.closest('.zone-indicator.in-isi');
              if (!el) return;
              selectZone(el);
              active = el;
              mode = handle.getAttribute('data-resize');
              startX = e.clientX;
              startY = e.clientY;
              startLeft = parseInt(el.style.left) || 0;
              startTop = parseInt(el.style.top) || 0;
              startWidth = parseInt(el.style.width) || 0;
              startHeight = parseInt(el.style.height) || 0;
              autoScrollOffset = 0;
              el.style.opacity = '0.8';
              el.style.zIndex = '1000';
            });
          });

          document.addEventListener('mousedown', function(e) {
            if (!e.target.closest('.zone-indicator.in-isi')) {
              selectZone(null);
            }
          });

          document.addEventListener('mousemove', function(e) {
            if (!active) return;
            e.preventDefault();
            var deltaX = e.clientX - startX;
            var deltaY = e.clientY - startY + autoScrollOffset;

            if (mode === 'move') {
              var newLeft = Math.max(0, Math.min(maxLeft, startLeft + deltaX));
              var newTop = Math.max(0, startTop + deltaY);
              active.style.left = newLeft + 'px';
              active.style.top = newTop + 'px';
            } else if (mode === 'right') {
              var newWidth = Math.max(20, startWidth + deltaX);
              var maxWidth = maxLeft - startLeft + 50;
              active.style.width = Math.min(newWidth, maxWidth) + 'px';
            } else if (mode === 'bottom') {
              active.style.height = Math.max(20, startHeight + deltaY) + 'px';
            } else if (mode === 'left') {
              var dw = Math.min(deltaX, startWidth - 20);
              var newLeftPos = Math.max(0, startLeft + dw);
              active.style.left = newLeftPos + 'px';
              active.style.width = (startWidth - (newLeftPos - startLeft)) + 'px';
            } else if (mode === 'top') {
              var dh = Math.min(deltaY, startHeight - 20);
              active.style.top = (startTop + dh) + 'px';
              active.style.height = (startHeight - dh) + 'px';
            } else if (mode === 'bottom-right') {
              active.style.width = Math.max(20, startWidth + deltaX) + 'px';
              active.style.height = Math.max(20, startHeight + deltaY) + 'px';
            }

            if (outerDiv && innerDiv) {
              var outerRect = outerDiv.getBoundingClientRect();
              var edgeSize = 60;
              var scrollSpeed = 15;
              if (autoScrollInterval) { clearInterval(autoScrollInterval); autoScrollInterval = null; }
              if (e.clientY > outerRect.bottom - edgeSize && e.clientY < outerRect.bottom + 40) {
                autoScrollInterval = setInterval(function() {
                  innerDiv.scrollTop += scrollSpeed;
                  autoScrollOffset += scrollSpeed;
                  if (mode === 'move') {
                    var ct = parseInt(active.style.top) || 0;
                    active.style.top = (ct + scrollSpeed) + 'px';
                  } else if (mode === 'bottom' || mode === 'bottom-right') {
                    var ch = parseInt(active.style.height) || 0;
                    active.style.height = (ch + scrollSpeed) + 'px';
                  }
                }, 20);
              } else if (e.clientY < outerRect.top + edgeSize && e.clientY > outerRect.top - 40) {
                autoScrollInterval = setInterval(function() {
                  if (innerDiv.scrollTop > 0) {
                    innerDiv.scrollTop -= scrollSpeed;
                    autoScrollOffset -= scrollSpeed;
                    if (mode === 'move') {
                      var ct = parseInt(active.style.top) || 0;
                      active.style.top = Math.max(0, ct - scrollSpeed) + 'px';
                    }
                  }
                }, 20);
              }
            }
          });

          document.addEventListener('mouseup', function(e) {
            if (!active) return;
            if (autoScrollInterval) { clearInterval(autoScrollInterval); autoScrollInterval = null; }
            var zoneIndex = parseInt(active.getAttribute('data-zone-index'));
            var newTop = parseInt(active.style.top) || 0;
            var newLeft = parseInt(active.style.left) || 0;
            var newWidth = parseInt(active.style.width) || 0;
            var newHeight = parseInt(active.style.height) || 0;
            active.style.cursor = 'grab';
            active.style.opacity = '1';
            active.style.zIndex = '100';
            window.parent.postMessage({
              type: 'zonePositionUpdate',
              zoneIndex: zoneIndex,
              top: newTop,
              left: newLeft,
              width: newWidth,
              height: newHeight
            }, '*');
            active = null;
            autoScrollOffset = 0;
          });
        })();
      <\/script>`
      html = html.replace('</body>', dragScript + '</body>')
    }

    // Replace asset paths with data URLs
    if (assets.background?.dataUrl) {
      html = html.replace('src="assets/background.png"', `src="${assets.background.dataUrl}"`)
    }
    if (assets.isiImage?.dataUrl) {
      html = html.replace('src="assets/isi.png"', `src="${assets.isiImage.dataUrl}"`)
    }
    if (assets.video?.dataUrl) {
      html = html.replace('src="assets/video.mp4"', `src="${assets.video.dataUrl}"`)
    }
    if (assets.frames) {
      assets.frames.forEach((frame, i) => {
        if (frame?.dataUrl) {
          html = html.replace(`src="assets/frame${i + 1}.png"`, `src="${frame.dataUrl}"`)
        }
      })
    }
    if (assets.expandButtonImage?.dataUrl) {
      html = html.replace('src="assets/expand-button.png"', `src="${assets.expandButtonImage.dataUrl}"`)
    }
    if (assets.collapseButtonImage?.dataUrl) {
      html = html.replace('src="assets/collapse-button.png"', `src="${assets.collapseButtonImage.dataUrl}"`)
    }

    return html
  }, [currentTemplate, config, assets, animations])

  if (!currentTemplate) {
    return <div className="text-gray-400 text-center p-8">Select a template</div>
  }

  const hasISI = hasFeature(currentTemplate, 'isi')

  const handleIsiMouseDown = (e, mode) => {
    e.stopPropagation()
    setIsiSelected(true)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      isiTop: config.isiTop,
      isiHeight: config.isiHeight,
      isiWidth: config.isiWidth || config.dimensions.width,
      isiLeft: config.isiLeft || 0
    })
    if (mode === 'move') {
      setIsDragging(true)
    } else {
      setResizeMode(mode)
    }
  }

  const handleMouseMove = (e) => {
    if (!isDragging && !resizeMode) return
    const deltaX = (e.clientX - dragStart.x) / scale
    const deltaY = (e.clientY - dragStart.y) / scale

    if (isDragging) {
      const newTop = Math.max(0, Math.min(config.dimensions.height - dragStart.isiHeight, dragStart.isiTop + deltaY))
      const newLeft = Math.max(0, Math.min(config.dimensions.width - dragStart.isiWidth, dragStart.isiLeft + deltaX))
      updateConfig('isiTop', Math.round(newTop))
      updateConfig('isiLeft', Math.round(newLeft))
    } else if (resizeMode === 'top') {
      const newTop = Math.max(0, dragStart.isiTop + deltaY)
      const newHeight = Math.max(100, dragStart.isiHeight - deltaY)
      if (newTop >= 0 && newTop + newHeight <= config.dimensions.height) {
        updateConfig('isiTop', Math.round(newTop))
        updateConfig('isiHeight', Math.round(newHeight))
      }
    } else if (resizeMode === 'bottom') {
      const newHeight = Math.max(100, dragStart.isiHeight + deltaY)
      if (dragStart.isiTop + newHeight <= config.dimensions.height) {
        updateConfig('isiHeight', Math.round(newHeight))
      }
    } else if (resizeMode === 'left') {
      const newLeft = Math.max(0, dragStart.isiLeft + deltaX)
      const newWidth = Math.max(100, dragStart.isiWidth - deltaX)
      if (newLeft >= 0 && newLeft + newWidth <= config.dimensions.width) {
        updateConfig('isiLeft', Math.round(newLeft))
        updateConfig('isiWidth', Math.round(newWidth))
      }
    } else if (resizeMode === 'right') {
      const newWidth = Math.max(100, dragStart.isiWidth + deltaX)
      if (dragStart.isiLeft + newWidth <= config.dimensions.width) {
        updateConfig('isiWidth', Math.round(newWidth))
      }
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setResizeMode(null)
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      setIsiSelected(false)
      setSelectedZoneIndex(null)
    }
  }

  // Click zone handlers for non-ISI zones
  const handleZoneMouseDown = (e, index, mode) => {
    e.stopPropagation()
    const zones = config.clickZones || []
    if (!zones[index]) return
    setSelectedZoneIndex(index)
    setIsiSelected(false)
    const zone = zones[index]
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

  const handleZoneMouseMove = (e) => {
    if (!isZoneDragging && !zoneResizeMode) return
    if (selectedZoneIndex === null) return
    const zones = config.clickZones || []
    if (!zones[selectedZoneIndex]) return

    const deltaX = (e.clientX - zoneDragStart.x) / scale
    const deltaY = (e.clientY - zoneDragStart.y) / scale
    const zone = zones[selectedZoneIndex]
    const maxWidth = zone.inISI ? (config.isiWidth || config.dimensions.width) : config.dimensions.width
    const maxHeight = zone.inISI ? 5000 : config.dimensions.height

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

  const handleZoneMouseUp = () => {
    if ((isZoneDragging || zoneResizeMode) && selectedZoneIndex !== null) {
      const zones = config.clickZones || []
      if (zones[selectedZoneIndex]) {
        const zone = zones[selectedZoneIndex]
        const newZones = [...zones]
        newZones[selectedZoneIndex] = {
          ...zone,
          top: Math.round(zone.top + zoneDragOffset.top),
          left: Math.round(zone.left + zoneDragOffset.left),
          width: Math.round(zone.width + zoneDragOffset.width),
          height: Math.round(zone.height + zoneDragOffset.height)
        }
        updateConfig('clickZones', newZones)
      }
    }
    setIsZoneDragging(false)
    setZoneResizeMode(null)
    setZoneDragOffset({ top: 0, left: 0, width: 0, height: 0 })
  }

  const handleCombinedMouseMove = (e) => {
    handleMouseMove(e)
    handleZoneMouseMove(e)
  }

  const handleCombinedMouseUp = () => {
    handleMouseUp()
    handleZoneMouseUp()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm text-gray-600">Scale:</span>
        <input type="range" min="0.2" max="1" step="0.1" value={scale} onChange={e => setScale(parseFloat(e.target.value))} className="w-32" />
        <span className="text-sm text-gray-500">{Math.round(scale * 100)}%</span>
        {hasISI && (
          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
            ISI zones: drag in preview, auto-scrolls at edges
          </span>
        )}
        <button onClick={() => setKey(k => k + 1)} className="ml-auto text-sm text-blue-600 hover:text-blue-800">
          Refresh Preview
        </button>
      </div>

      <BrowserPreview dimensions={config.dimensions} scale={scale}>
        <div
          ref={containerRef}
          style={{
            width: config.dimensions.width * scale,
            height: config.dimensions.height * scale,
            overflow: 'hidden',
            background: 'white',
            position: 'relative'
          }}
          onMouseMove={handleCombinedMouseMove}
          onMouseUp={handleCombinedMouseUp}
          onMouseLeave={handleCombinedMouseUp}
          onClick={handleOverlayClick}
        >
          <iframe
            ref={iframeRef}
            key={key}
            srcDoc={previewHTML}
            onLoad={handleIframeLoad}
            style={{
              width: config.dimensions.width,
              height: config.dimensions.height,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              border: 'none',
              pointerEvents: (isDragging || resizeMode || isZoneDragging || zoneResizeMode) ? 'none' : 'auto'
            }}
            title="Preview"
          />

          {/* ISI Container Overlay */}
          {hasISI && (
            <div
              style={{
                position: 'absolute',
                left: (config.isiLeft || 0) * scale,
                top: config.isiTop * scale,
                width: (config.isiWidth || config.dimensions.width) * scale,
                height: config.isiHeight * scale,
                border: isiSelected ? '2px solid #3b82f6' : '2px dashed rgba(59, 130, 246, 0.5)',
                backgroundColor: 'transparent',
                boxSizing: 'border-box',
                pointerEvents: 'none',
                transition: (isDragging || resizeMode) ? 'none' : 'all 0.15s ease'
              }}
            >
              {/* Move handle */}
              <div
                onClick={(e) => { e.stopPropagation(); setIsiSelected(true); setSelectedZoneIndex(null); }}
                onMouseDown={(e) => handleIsiMouseDown(e, 'move')}
                style={{
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  width: 28,
                  height: 28,
                  backgroundColor: isiSelected ? '#3b82f6' : 'rgba(59, 130, 246, 0.8)',
                  borderRadius: 4,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  pointerEvents: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 'bold',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                }}
                title="Drag to move ISI container"
              >
                ⊞
              </div>

              {/* Resize handles when selected */}
              {isiSelected && (
                <>
                  <div onMouseDown={(e) => handleIsiMouseDown(e, 'top')} style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 40, height: 8, backgroundColor: '#3b82f6', borderRadius: 4, cursor: 'ns-resize', pointerEvents: 'auto' }} />
                  <div onMouseDown={(e) => handleIsiMouseDown(e, 'bottom')} style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 40, height: 8, backgroundColor: '#3b82f6', borderRadius: 4, cursor: 'ns-resize', pointerEvents: 'auto' }} />
                  <div onMouseDown={(e) => handleIsiMouseDown(e, 'left')} style={{ position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)', width: 8, height: 40, backgroundColor: '#3b82f6', borderRadius: 4, cursor: 'ew-resize', pointerEvents: 'auto' }} />
                  <div onMouseDown={(e) => handleIsiMouseDown(e, 'right')} style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', width: 8, height: 40, backgroundColor: '#3b82f6', borderRadius: 4, cursor: 'ew-resize', pointerEvents: 'auto' }} />
                  <div style={{ position: 'absolute', top: 8, left: 38, backgroundColor: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 'bold', pointerEvents: 'none' }}>
                    ISI Container
                  </div>
                  <div style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 6px', borderRadius: 4, fontSize: 10, pointerEvents: 'none' }}>
                    {config.isiWidth || config.dimensions.width}x{config.isiHeight} @ ({config.isiLeft || 0}, {config.isiTop})
                  </div>
                </>
              )}
            </div>
          )}

          {/* Non-ISI Click Zone Overlays */}
          {(config.clickZones || []).filter(z => !z.inISI).map((zone, idx) => {
            const actualIndex = (config.clickZones || []).indexOf(zone)
            const isBeingDragged = (isZoneDragging || zoneResizeMode) && selectedZoneIndex === actualIndex
            const effectiveTop = zone.top + (isBeingDragged ? zoneDragOffset.top : 0)
            const effectiveLeft = zone.left + (isBeingDragged ? zoneDragOffset.left : 0)
            const effectiveWidth = zone.width + (isBeingDragged ? zoneDragOffset.width : 0)
            const effectiveHeight = zone.height + (isBeingDragged ? zoneDragOffset.height : 0)
            const isSelected = selectedZoneIndex === actualIndex
            const baseColor = '#f59e0b'

            return (
              <div
                key={zone.id}
                style={{
                  position: 'absolute',
                  left: effectiveLeft * scale,
                  top: effectiveTop * scale,
                  width: effectiveWidth * scale,
                  height: effectiveHeight * scale,
                  border: isSelected ? `2px solid ${baseColor}` : `2px dashed ${baseColor}`,
                  backgroundColor: 'transparent',
                  boxSizing: 'border-box',
                  pointerEvents: 'none',
                  transition: (isZoneDragging || zoneResizeMode) ? 'none' : 'all 0.15s ease'
                }}
              >
                <div
                  onClick={(e) => { e.stopPropagation(); setSelectedZoneIndex(actualIndex); setIsiSelected(false); }}
                  onMouseDown={(e) => handleZoneMouseDown(e, actualIndex, 'move')}
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
                    cursor: isZoneDragging && selectedZoneIndex === actualIndex ? 'grabbing' : 'grab',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}
                  title="Drag to move zone"
                >
                  ⊞ {zone.id}
                </div>

                {isSelected && (
                  <>
                    <div onMouseDown={(e) => handleZoneMouseDown(e, actualIndex, 'top')} style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 30, height: 8, backgroundColor: baseColor, borderRadius: 4, cursor: 'ns-resize', pointerEvents: 'auto' }} />
                    <div onMouseDown={(e) => handleZoneMouseDown(e, actualIndex, 'bottom')} style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 30, height: 8, backgroundColor: baseColor, borderRadius: 4, cursor: 'ns-resize', pointerEvents: 'auto' }} />
                    <div onMouseDown={(e) => handleZoneMouseDown(e, actualIndex, 'left')} style={{ position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)', width: 8, height: 30, backgroundColor: baseColor, borderRadius: 4, cursor: 'ew-resize', pointerEvents: 'auto' }} />
                    <div onMouseDown={(e) => handleZoneMouseDown(e, actualIndex, 'right')} style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', width: 8, height: 30, backgroundColor: baseColor, borderRadius: 4, cursor: 'ew-resize', pointerEvents: 'auto' }} />
                    <div style={{ position: 'absolute', bottom: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '1px 4px', borderRadius: 2, fontSize: 8, pointerEvents: 'none' }}>
                      {Math.round(effectiveWidth)}x{Math.round(effectiveHeight)} @ ({Math.round(effectiveLeft)}, {Math.round(effectiveTop)})
                    </div>
                  </>
                )}
              </div>
            )
          })}

          {/* ISI Zone handles (positioned outside ISI container) */}
          {(config.clickZones || []).filter(z => z.inISI).map((zone, idx) => {
            const actualIndex = (config.clickZones || []).indexOf(zone)
            const isSelected = selectedZoneIndex === actualIndex
            const baseColor = '#10b981'

            return (
              <div
                key={zone.id + '-handle'}
                onClick={(e) => { e.stopPropagation(); setSelectedZoneIndex(actualIndex); setIsiSelected(false); }}
                style={{
                  position: 'absolute',
                  left: ((config.isiLeft || 0) + (config.isiWidth || config.dimensions.width)) * scale + 4,
                  top: (config.isiTop + 4 + idx * 28) * scale,
                  backgroundColor: isSelected ? baseColor : 'rgba(16, 185, 129, 0.8)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  whiteSpace: 'nowrap'
                }}
                title={`ISI Zone: ${zone.id} @ (${zone.left}, ${zone.top}) - Drag in preview`}
              >
                {zone.id} <span style={{ opacity: 0.7, fontSize: 8 }}>↓{zone.top}px</span>
              </div>
            )
          })}
        </div>
      </BrowserPreview>

      <p className="text-center text-xs text-gray-400">{config.dimensions.width} x {config.dimensions.height}px</p>
    </div>
  )
}

export default PreviewIframe
