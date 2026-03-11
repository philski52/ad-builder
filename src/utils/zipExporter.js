// Zip Export Utility
// Creates downloadable ad package

import JSZip from 'jszip'
import { generateTemplateCode, generateMainJS } from './templateGenerator'
import { hasFeature } from '../templates'

/**
 * Convert data URL to blob
 */
function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',')
  const mime = parts[0].match(/:(.*?);/)[1]
  const bstr = atob(parts[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }

  return new Blob([u8arr], { type: mime })
}

/**
 * Export ad as zip file
 */
export async function exportAdZip(template, config, assets, projectName, animations = []) {
  const zip = new JSZip()

  // Generate code using the unified generator
  const code = generateTemplateCode(template, config, assets, animations)

  // Add HTML
  zip.file('index.html', code.html)

  // Add CSS folder
  const cssFolder = zip.folder('css')
  cssFolder.file('main.css', code.css)

  if (code.scrollerCss) {
    cssFolder.file('scroller.css', code.scrollerCss)
  }

  if (code.buttonsCss) {
    cssFolder.file('buttons.css', code.buttonsCss)
  }

  if (code.clicksCss) {
    cssFolder.file('clicks.css', code.clicksCss)
  }

  // Add script folder
  const scriptFolder = zip.folder('script')
  scriptFolder.file('ad.js', code.js)

  if (code.mainJs) {
    scriptFolder.file('main.js', code.mainJs)
  }

  // Add assets folder
  const assetsFolder = zip.folder('assets')

  // Add background
  if (assets.background?.dataUrl) {
    const blob = dataUrlToBlob(assets.background.dataUrl)
    assetsFolder.file('background.png', blob)
  }

  // Add frames
  if (assets.frames) {
    assets.frames.forEach((frame, i) => {
      if (frame?.dataUrl) {
        const blob = dataUrlToBlob(frame.dataUrl)
        assetsFolder.file(`frame${i + 1}.png`, blob)
      }
    })
  }

  // Add ISI image
  if (assets.isiImage?.dataUrl) {
    const blob = dataUrlToBlob(assets.isiImage.dataUrl)
    assetsFolder.file('isi.png', blob)
  }

  // Add video
  if (assets.video?.dataUrl) {
    const blob = dataUrlToBlob(assets.video.dataUrl)
    assetsFolder.file('video.mp4', blob)
  }

  // Generate zip blob
  const blob = await zip.generateAsync({ type: 'blob' })

  // Trigger download
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${projectName || 'ad-export'}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return true
}
