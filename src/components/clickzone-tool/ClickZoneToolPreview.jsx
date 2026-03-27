import { useMemo, useState, useRef, useEffect } from 'react'
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
  const iframeRef = useRef(null)

  // Listen for ISI zone position updates from the iframe
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data && e.data.type === 'isiZoneUpdate') {
        updateZonePosition(e.data.zoneIndex, {
          top: e.data.top,
          left: e.data.left,
          width: e.data.width,
          height: e.data.height
        })
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [updateZonePosition])

  // Inject ISI zones directly into iframe DOM (more reliable than postMessage)
  const injectISIZones = () => {
    try {
      const iframe = iframeRef.current
      if (!iframe || !iframe.contentDocument) return

      const doc = iframe.contentDocument

      // Remove old zones
      doc.querySelectorAll('.czt-isi-zone').forEach(z => z.remove())

      const isiZones = clickZones.filter(z => z.inISI)
      if (isiZones.length === 0) return

      // Find ISI container — prioritized search
      let target = null
      const ids = ['innerMostDiv', 'outerMostDiv', 'isi-container', 'isi-con', 'isi-copy', 'isi_container', 'isi-content-wrapper', 'scrollbar1', 'scrollable_ssi', 'isi']
      for (let i = 0; i < ids.length && !target; i++) {
        target = doc.getElementById(ids[i])
      }
      if (!target) {
        const cls = ['isi-content', 'isi-wrapper', 'isi-copy', 'ssiall', 'ssi_content']
        for (let j = 0; j < cls.length && !target; j++) {
          target = doc.querySelector('.' + cls[j])
        }
      }
      if (!target) {
        const wild = doc.querySelectorAll('[id*="isi"],[id*="ISI"],[class*="isi"],[class*="ISI"]')
        for (let k = wild.length - 1; k >= 0 && !target; k--) {
          if (wild[k].offsetHeight > 30) target = wild[k]
        }
      }
      if (!target) target = doc.body

      target.style.position = 'relative'

      // Make ISI containers scrollable so user can scroll to place zones
      // The scroller.js is stubbed, so we need native overflow scroll
      var outerDiv = doc.getElementById('outerMostDiv')
      var innerDiv = doc.getElementById('innerMostDiv')
      if (innerDiv) {
        innerDiv.style.overflowY = 'auto'
        innerDiv.style.overflowX = 'hidden'
      }
      if (outerDiv && !innerDiv) {
        outerDiv.style.overflowY = 'auto'
        outerDiv.style.overflowX = 'hidden'
      }
      // Also try agency patterns
      var isiCon = doc.getElementById('isi-container') || doc.getElementById('isi-con') || doc.getElementById('isi_container')
      if (isiCon && !innerDiv) {
        isiCon.style.overflowY = 'auto'
        isiCon.style.overflowX = 'hidden'
      }

      // Helper to report zone position back to parent
      const reportZone = (el, idx) => {
        window.postMessage({
          type: 'isiZoneUpdate',
          zoneIndex: idx,
          top: parseInt(el.style.top) || 0,
          left: parseInt(el.style.left) || 0,
          width: parseInt(el.style.width) || 0,
          height: parseInt(el.style.height) || 0
        }, '*')
      }

      // Helper to add drag/resize behavior to a handle element
      const addDragHandler = (handle, el, idx, mode) => {
        handle.addEventListener('mousedown', function(ev) {
          ev.preventDefault()
          ev.stopPropagation()
          var startX = ev.clientX, startY = ev.clientY
          var sL = parseInt(el.style.left) || 0, sT = parseInt(el.style.top) || 0
          var sW = parseInt(el.style.width) || 0, sH = parseInt(el.style.height) || 0

          var scrollContainer = innerDiv || target.closest('#outerMostDiv') || target
          var autoScrollId = null
          var scrollOffset = 0 // Track cumulative scroll during drag

          // Listen for wheel scroll while dragging — move zone with scroll
          function onWheel(we) {
            if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
              scrollContainer.scrollTop += we.deltaY
              scrollOffset += we.deltaY
              // Move/resize the zone to follow the scroll
              if (mode === 'move') {
                var curTop = parseInt(el.style.top) || 0
                el.style.top = Math.max(0, curTop + we.deltaY) + 'px'
              }
            }
          }

          function onMove(me) {
            var dx = me.clientX - startX, dy = me.clientY - startY
            if (mode === 'move') {
              el.style.left = Math.max(0, sL + dx) + 'px'
              el.style.top = Math.max(0, sT + dy + scrollOffset) + 'px'
            } else if (mode === 'right') {
              el.style.width = Math.max(20, sW + dx) + 'px'
            } else if (mode === 'bottom') {
              el.style.height = Math.max(20, sH + dy) + 'px'
            } else if (mode === 'left') {
              var newW = Math.max(20, sW - dx)
              el.style.left = Math.max(0, sL + (sW - newW)) + 'px'
              el.style.width = newW + 'px'
            } else if (mode === 'top') {
              var newH = Math.max(20, sH - dy)
              el.style.top = Math.max(0, sT + (sH - newH)) + 'px'
              el.style.height = newH + 'px'
            } else if (mode === 'bottom-right') {
              el.style.width = Math.max(20, sW + dx) + 'px'
              el.style.height = Math.max(20, sH + dy) + 'px'
            }

            // Auto-scroll ISI when dragging near edges (gentle)
            if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
              var rect = scrollContainer.getBoundingClientRect()
              if (autoScrollId) clearInterval(autoScrollId)
              if (me.clientY > rect.bottom - 30) {
                autoScrollId = setInterval(function() {
                  scrollContainer.scrollTop += 3
                  scrollOffset += 3
                  if (mode === 'move') {
                    var ct = parseInt(el.style.top) || 0
                    el.style.top = (ct + 3) + 'px'
                  }
                }, 50)
              } else if (me.clientY < rect.top + 30) {
                autoScrollId = setInterval(function() {
                  if (scrollContainer.scrollTop > 0) {
                    scrollContainer.scrollTop -= 3
                    scrollOffset -= 3
                    if (mode === 'move') {
                      var ct = parseInt(el.style.top) || 0
                      el.style.top = Math.max(0, ct - 3) + 'px'
                    }
                  }
                }, 50)
              }
            }
          }
          function onUp() {
            if (autoScrollId) clearInterval(autoScrollId)
            doc.removeEventListener('mousemove', onMove)
            doc.removeEventListener('mouseup', onUp)
            doc.removeEventListener('wheel', onWheel)
            reportZone(el, idx)
          }
          doc.addEventListener('mousemove', onMove)
          doc.addEventListener('mouseup', onUp)
          doc.addEventListener('wheel', onWheel, { passive: true })
        })
      }

      isiZones.forEach(z => {
        const idx = clickZones.indexOf(z)
        const el = doc.createElement('div')
        el.className = 'czt-isi-zone'
        el.setAttribute('data-zone-index', idx)
        el.style.cssText = 'position:absolute;top:' + z.top + 'px;left:' + z.left + 'px;width:' + z.width + 'px;height:' + z.height + 'px;border:2px dashed rgba(16,185,129,0.8);background:rgba(16,185,129,0.15);box-sizing:border-box;cursor:grab;z-index:100;'

        // Label
        var label = doc.createElement('div')
        label.style.cssText = 'position:absolute;top:2px;left:2px;background:#10b981;color:white;padding:2px 6px;border-radius:3px;font-size:9px;font-weight:bold;white-space:nowrap;pointer-events:none;'
        label.textContent = z.id
        el.appendChild(label)

        // Move handle (full area)
        var moveHandle = doc.createElement('div')
        moveHandle.style.cssText = 'position:absolute;inset:0;cursor:grab;'
        el.appendChild(moveHandle)
        addDragHandler(moveHandle, el, idx, 'move')

        // Resize handles
        var handles = [
          { mode: 'right', css: 'position:absolute;top:0;right:-4px;width:8px;height:100%;cursor:ew-resize;' },
          { mode: 'bottom', css: 'position:absolute;bottom:-4px;left:0;width:100%;height:8px;cursor:ns-resize;' },
          { mode: 'left', css: 'position:absolute;top:0;left:-4px;width:8px;height:100%;cursor:ew-resize;' },
          { mode: 'top', css: 'position:absolute;top:-4px;left:0;width:100%;height:8px;cursor:ns-resize;' },
          { mode: 'bottom-right', css: 'position:absolute;bottom:-4px;right:-4px;width:12px;height:12px;cursor:nwse-resize;background:#10b981;border-radius:2px;' }
        ]
        handles.forEach(function(h) {
          var handle = doc.createElement('div')
          handle.style.cssText = h.css
          el.appendChild(handle)
          addDragHandler(handle, el, idx, h.mode)
        })

        target.appendChild(el)
      })
    } catch (err) {
      // Cross-origin or iframe not ready — silently ignore
    }
  }

  // Only re-inject ISI zones when membership changes (add/remove/inISI toggle),
  // NOT on every position update — position changes are handled inside the iframe DOM
  const isiZoneSignature = clickZones.filter(z => z.inISI).map(z => z.id).join(',')
  const isiZoneCount = clickZones.filter(z => z.inISI).length

  useEffect(() => {
    // Retry injection — iframe needs time to load and render
    const t1 = setTimeout(injectISIZones, 500)
    const t2 = setTimeout(injectISIZones, 1500)
    const t3 = setTimeout(injectISIZones, 3000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [isiZoneSignature, isiZoneCount, key])

  // Drag/resize state — reuses same pattern as PreviewIframe non-ISI zones
  const [isZoneDragging, setIsZoneDragging] = useState(false)
  const [zoneResizeMode, setZoneResizeMode] = useState(null)
  const [zoneDragStart, setZoneDragStart] = useState({ x: 0, y: 0, top: 0, left: 0, width: 0, height: 0 })
  const [zoneDragOffset, setZoneDragOffset] = useState({ top: 0, left: 0, width: 0, height: 0 })

  // Build preview HTML with inlined assets
  const previewHTML = useMemo(() => {
    if (!htmlContent) return ''
    let html = htmlContent

    // Build a lookup of all file content by every possible path variation
    const fileLookup = {} // path → { content, dataUrl, isText }
    for (const [filename, file] of Object.entries(files)) {
      const basename = filename.split('/').pop()
      const parts = filename.split('/')
      const paths = [basename]
      for (let i = 0; i < parts.length; i++) {
        const subpath = parts.slice(i).join('/')
        if (subpath && !paths.includes(subpath)) paths.push(subpath)
        if (subpath && !paths.includes('./' + subpath)) paths.push('./' + subpath)
      }
      for (const p of paths) {
        fileLookup[p] = file
      }
    }

    // Inline CSS <link> tags — replace with <style> containing the file content
    html = html.replace(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*\/?>/gi, function(match, href) {
      const file = fileLookup[href]
      if (file && typeof file.content === 'string') {
        return '<style>/* ' + href + ' */\n' + file.content + '</style>'
      }
      return match
    })
    // Also match <link rel="stylesheet" href="..."> (rel before href)
    html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi, function(match, href) {
      const file = fileLookup[href]
      if (file && typeof file.content === 'string') {
        return '<style>/* ' + href + ' */\n' + file.content + '</style>'
      }
      return match
    })

    // Inline local JS <script src="..."> tags — replace with inline <script>
    html = html.replace(/<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi, function(match, src) {
      // Skip CDN scripts — let them load normally
      if (/^https?:\/\//i.test(src)) return match
      const file = fileLookup[src]
      if (file && typeof file.content === 'string') {
        return '<script>/* ' + src + ' */\n' + file.content + '<\/script>'
      }
      return match
    })

    // Replace image/media asset paths with data URLs
    for (const [filename, file] of Object.entries(files)) {
      if (!file.dataUrl) continue
      const basename = filename.split('/').pop()
      const parts = filename.split('/')
      const patterns = [basename]
      for (let i = 0; i < parts.length; i++) {
        const subpath = parts.slice(i).join('/')
        if (subpath && !patterns.includes(subpath)) patterns.push(subpath)
        if (subpath && !patterns.includes('./' + subpath)) patterns.push('./' + subpath)
      }
      for (const pattern of patterns) {
        html = html.split(`src="${pattern}"`).join(`src="${file.dataUrl}"`)
        html = html.split(`src='${pattern}'`).join(`src='${file.dataUrl}'`)
        html = html.split(`url("${pattern}")`).join(`url("${file.dataUrl}")`)
        html = html.split(`url('${pattern}')`).join(`url('${file.dataUrl}')`)
        html = html.split(`url(${pattern})`).join(`url(${file.dataUrl})`)
      }
    }

    // Also replace image URLs inside inlined CSS (the CSS we just inlined may reference images)
    for (const [filename, file] of Object.entries(files)) {
      if (!file.dataUrl) continue
      const basename = filename.split('/').pop()
      // CSS often uses relative paths like ../images/bg.jpg or just bg.jpg
      html = html.split(`url("${basename}")`).join(`url("${file.dataUrl}")`)
      html = html.split(`url('${basename}')`).join(`url('${file.dataUrl}')`)
      html = html.split(`url(${basename})`).join(`url(${file.dataUrl})`)
    }

    // Disable click handlers so they don't interfere with overlay
    html = html.replace(/onclick="[^"]*"/gi, 'onclick="event.preventDefault()"')
    html = html.replace(/onclick='[^']*'/gi, "onclick='event.preventDefault()'")

    // Instead of stripping scripts, inject stubs for APIs that don't exist in the preview
    // This lets the ad's own JS run (animation, layout, visibility) while preventing crashes
    html = html.replace(/<head[^>]*>/i, `$&
    <script>
      // Stub AppHost so ads don't crash trying to access it
      window.top.AppHost = window.top.AppHost || function() { return { requestFullscreenBrowserView: function(){}, requestPDFView: function(){}, requestModalAdView: function(){}, dismissModalAdView: function(){} }; };
      // Stub Enabler for GWD ads
      window.Enabler = window.Enabler || { isInitialized: function(){ return true; }, isPageLoaded: function(){ return true; }, exit: function(){}, addEventListener: function(){}, removeEventListener: function(){}, loadModule: function(m,cb){ if(cb)cb(); }, isVisible: function(){ return true; }, isServingInLiveEnvironment: function(){ return false; }, counter: function(){}, startTimer: function(){}, stopTimer: function(){}, reportManualClose: function(){}, setResponsiveExpanding: function(){}, queryFullscreenSupport: function(){}, requestExpand: function(){}, requestCollapse: function(){}, finishExpand: function(){}, finishCollapse: function(){}, requestFullscreenExpand: function(){}, finishFullscreenExpand: function(){}, requestFullscreenCollapse: function(){}, finishFullscreenCollapse: function(){}, setRushSimulatedLocalEvents: function(){}, setResponsiveSize: function(){}, exitOverride: function(){}, dynamicExit: function(){}, getParameter: function(){ return ''; } };
      window.studio = window.studio || { events: { StudioEvent: { INIT: 'init', VISIBLE: 'visible', FULLSCREEN_SUPPORT: 'fs', HOSTPAGE_SCROLL: 'scroll', EXIT: 'exit' } }, module: { ModuleId: { GDN: 'gdn', VIDEO: 'video' } }, video: { Reporter: { attach: function(){} } }, sdk: { gdn: { getConfig: function(){ return { isInCreativeToolsetContext: function(){ return false; }, isInterstitial: function(cb){ if(cb)cb(false); } }; } } } };
      // Prevent window.open from actually opening windows
      window.open = function() {};
      // Prevent console silencing so we can debug
      // (some ads override console — we want to keep it)
    </script>`)

    // Strip CDN scripts that will fail to load — replace with local stubs or remove
    // Only strip external CDN scripts, keep local scripts
    html = html.replace(/<script[^>]*src=["'](https?:\/\/[^"']*(?:Enabler|enabler)[^"']*)["'][^>]*><\/script>/gi, '<!-- Enabler.js stubbed above -->')
    html = html.replace(/<script[^>]*src=["'](https?:\/\/[^"']*(?:webcomponents)[^"']*)["'][^>]*><\/script>/gi, '<!-- webcomponents not needed -->')

    // Keep GSAP/TweenMax/jQuery CDN scripts — they'll load and run the animation
    // Keep local scripts — they contain the ad's layout and animation logic

    // ISI zone injection is handled directly via iframe DOM access (see injectISIZones effect)
    // No script injection needed in the HTML

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
        <input type="range" min="0.2" max="3" step="0.1" value={scale} onChange={e => setScale(parseFloat(e.target.value))} className="w-32" />
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
              ref={iframeRef}
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

            {/* Click Zone Overlays — non-ISI zones only (ISI zones are inside the iframe) */}
            {clickZones.filter(z => !z.inISI).map((zone, idx) => {
              idx = clickZones.indexOf(zone) // use actual index, not filtered index
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
