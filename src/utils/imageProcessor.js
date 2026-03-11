// Image processing utilities
// Handles SVG detection, conversion to PNG, and validation

/**
 * Check if a file is an SVG
 */
export function isSvg(file) {
  return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
}

/**
 * Check if a file is an accepted image format
 */
export function isValidImage(file) {
  const acceptedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
  return acceptedTypes.includes(file.type) || isSvg(file)
}

/**
 * Convert SVG file to PNG using canvas
 * @param {File} svgFile - The SVG file to convert
 * @param {Object} options - Conversion options
 * @param {number} options.width - Target width (optional, uses SVG native)
 * @param {number} options.height - Target height (optional, uses SVG native)
 * @param {number} options.scale - Scale factor (default: 1)
 * @returns {Promise<Blob>} PNG blob
 */
export async function svgToPng(svgFile, options = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const svgData = e.target.result
      const img = new Image()

      img.onload = () => {
        const scale = options.scale || 1
        const width = (options.width || img.width) * scale
        const height = (options.height || img.height) * scale

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to convert SVG to PNG'))
            }
          },
          'image/png',
          1.0
        )
      }

      img.onerror = () => {
        reject(new Error('Failed to load SVG image'))
      }

      // Create a blob URL from the SVG data
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml' })
      img.src = URL.createObjectURL(svgBlob)
    }

    reader.onerror = () => {
      reject(new Error('Failed to read SVG file'))
    }

    reader.readAsText(svgFile)
  })
}

/**
 * Read file as data URL
 */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Get image dimensions from a file
 */
export function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      resolve({ width: img.width, height: img.height })
      URL.revokeObjectURL(img.src)
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
      URL.revokeObjectURL(img.src)
    }

    img.src = URL.createObjectURL(file)
  })
}

/**
 * Process uploaded image - handles SVG detection and returns processing options
 */
export async function processImage(file) {
  if (!isValidImage(file)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload PNG, JPG, GIF, or WebP images.'
    }
  }

  if (isSvg(file)) {
    return {
      valid: true,
      isSvg: true,
      file,
      message: 'SVG files are not supported on target devices.',
      options: [
        { id: 'convert', label: 'Convert to PNG', description: 'Auto-convert SVG to PNG format' },
        { id: 'reject', label: 'Upload Different File', description: 'Cancel and upload a PNG/JPG instead' }
      ]
    }
  }

  // Regular image - just get dimensions and return
  try {
    const dimensions = await getImageDimensions(file)
    const dataUrl = await fileToDataUrl(file)

    return {
      valid: true,
      isSvg: false,
      file,
      dataUrl,
      dimensions
    }
  } catch (error) {
    return {
      valid: false,
      error: `Failed to process image: ${error.message}`
    }
  }
}

/**
 * Convert SVG and return processed result
 */
export async function convertSvgAndProcess(svgFile, targetDimensions = null) {
  try {
    const pngBlob = await svgToPng(svgFile, targetDimensions ? {
      width: targetDimensions.width,
      height: targetDimensions.height
    } : {})

    // Create a File object from the blob
    const pngFile = new File(
      [pngBlob],
      svgFile.name.replace(/\.svg$/i, '.png'),
      { type: 'image/png' }
    )

    const dimensions = await getImageDimensions(pngFile)
    const dataUrl = await fileToDataUrl(pngFile)

    return {
      valid: true,
      isSvg: false,
      converted: true,
      file: pngFile,
      dataUrl,
      dimensions
    }
  } catch (error) {
    return {
      valid: false,
      error: `Failed to convert SVG: ${error.message}`
    }
  }
}
