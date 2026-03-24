// Template registry - defines all available ad templates
// Based on /ad_templates folder structure

export const TEMPLATE_CATEGORIES = {
  static: 'Static',
  animated: 'Animated',
  video: 'Video',
  modal: 'Modal'
}

export const BRAND_PREFIXES = {
  cp: 'CP (1080x1733)',
  int: 'INT (1000x1600)',
  mr: 'MR (300x250)'
}

export const templates = [
  // Static Templates
  {
    id: 'cp-static',
    name: 'CP Static',
    category: 'static',
    brand: 'cp',
    description: 'Single image static ad with click handler',
    dimensions: { width: 1080, height: 1733 },
    features: [],
    requiredAssets: ['background'],
    configFields: ['clickTag1', 'clickTag2'],
    thumbnail: null
  },
  {
    id: 'int-static',
    name: 'INT Static',
    category: 'static',
    brand: 'int',
    description: 'Single image static ad with click handler',
    dimensions: { width: 1000, height: 1600 },
    features: [],
    requiredAssets: ['background'],
    configFields: ['clickTag1', 'clickTag2'],
    thumbnail: null
  },
  {
    id: 'mr-static',
    name: 'MR Static',
    category: 'static',
    brand: 'mr',
    description: 'Small format static ad',
    dimensions: { width: 300, height: 250 },
    features: [],
    requiredAssets: ['background'],
    configFields: ['clickTag1', 'clickTag2'],
    thumbnail: null
  },

  // Static + ISI Templates
  {
    id: 'cp-static-isi',
    name: 'CP Static + ISI',
    category: 'static',
    brand: 'cp',
    description: 'Static ad with scrollable Important Safety Information',
    dimensions: { width: 1080, height: 1733 },
    features: ['isi'],
    requiredAssets: ['background', 'isiImage'],
    configFields: ['clickTag1', 'clickTag2', 'clickTag3', 'clickTag4', 'autoScrollSpeed', 'scrollStep'],
    thumbnail: null
  },

  // Animated + ISI Templates
  {
    id: 'cp-animated-isi',
    name: 'CP Animated + ISI',
    category: 'animated',
    brand: 'cp',
    description: 'Multi-frame animated ad with ISI',
    dimensions: { width: 1080, height: 1733 },
    features: ['isi', 'animation'],
    requiredAssets: ['background', 'frames', 'isiImage'],
    configFields: ['clickTag1', 'clickTag2', 'clickTag3', 'clickTag4', 'frameDuration', 'frameDelay', 'autoScrollSpeed'],
    thumbnail: null
  },
  {
    id: 'int-animated-isi',
    name: 'INT Animated + ISI',
    category: 'animated',
    brand: 'int',
    description: 'Multi-frame animated ad with ISI',
    dimensions: { width: 1000, height: 1600 },
    features: ['isi', 'animation'],
    requiredAssets: ['background', 'frames', 'isiImage'],
    configFields: ['clickTag1', 'clickTag2', 'clickTag3', 'clickTag4', 'frameDuration', 'frameDelay', 'autoScrollSpeed'],
    thumbnail: null
  },
  {
    id: 'mr-animated-isi',
    name: 'MR Animated + ISI',
    category: 'animated',
    brand: 'mr',
    description: 'Small format animated ad with ISI',
    dimensions: { width: 300, height: 250 },
    features: ['isi', 'animation'],
    requiredAssets: ['background', 'frames', 'isiImage'],
    configFields: ['clickTag1', 'clickTag2', 'clickTag3', 'clickTag4', 'frameDuration', 'frameDelay'],
    thumbnail: null
  },

  // Expandable ISI
  {
    id: 'cp-animated-isi-expandable',
    name: 'CP Animated + Expandable ISI',
    category: 'animated',
    brand: 'cp',
    description: 'Animated ad with expandable/collapsible ISI section',
    dimensions: { width: 1080, height: 1733 },
    features: ['isi', 'animation', 'expandable'],
    requiredAssets: ['background', 'frames', 'isiImage'],
    configFields: ['clickTag1', 'clickTag2', 'clickTag3', 'clickTag4', 'expandedHeight', 'collapseDuration'],
    thumbnail: null
  },

  // Background + Embedded Video Templates
  {
    id: 'int-bg-video-embedded',
    name: 'INT Background + Video',
    category: 'video',
    brand: 'int',
    description: 'Background image with embedded video player and play/pause toggle',
    dimensions: { width: 1000, height: 1600 },
    features: ['video', 'background'],
    requiredAssets: ['background', 'video', 'thumbnail', 'playButton'],
    configFields: ['videoTop', 'videoLeft', 'videoWidth', 'videoHeight', 'playBtnTop', 'playBtnLeft', 'playBtnWidth'],
    thumbnail: null
  },

  // Video Templates
  {
    id: 'int-mod-video-0-buttons',
    name: 'INT Video (No Buttons)',
    category: 'video',
    brand: 'int',
    description: 'Video ad with no CTA buttons',
    dimensions: { width: 1000, height: 750 },
    features: ['video'],
    requiredAssets: ['video'],
    configFields: ['videoHeight', 'showVideoControls'],
    thumbnail: null
  },
  {
    id: 'int-mod-video-1-2-buttons',
    name: 'INT Video (1-2 Buttons)',
    category: 'video',
    brand: 'int',
    description: 'Video ad with 1-2 CTA buttons (PI, MG)',
    dimensions: { width: 1000, height: 750 },
    features: ['video', 'buttons'],
    requiredAssets: ['video'],
    configFields: ['clickTag3', 'clickTag4', 'videoHeight', 'showVideoControls'],
    thumbnail: null
  },
  {
    id: 'int-mod-video-3-4-buttons',
    name: 'INT Video (3-4 Buttons)',
    category: 'video',
    brand: 'int',
    description: 'Video ad with 3-4 CTA buttons',
    dimensions: { width: 1000, height: 750 },
    features: ['video', 'buttons'],
    requiredAssets: ['video'],
    configFields: ['clickTag1', 'clickTag2', 'clickTag3', 'clickTag4', 'videoHeight', 'showVideoControls'],
    thumbnail: null
  },

  // Modal Templates
  {
    id: 'cp-static-open-mod',
    name: 'CP Static + Modal',
    category: 'modal',
    brand: 'cp',
    description: 'Static ad that opens a modal secondary ad',
    dimensions: { width: 1080, height: 1733 },
    features: ['modal'],
    requiredAssets: ['background'],
    configFields: ['clickTag1'],
    thumbnail: null
  },
  {
    id: 'mr-static-open-mod',
    name: 'MR Static + Modal',
    category: 'modal',
    brand: 'mr',
    description: 'Small static ad that opens a modal',
    dimensions: { width: 300, height: 250 },
    features: ['modal'],
    requiredAssets: ['background'],
    configFields: ['clickTag1'],
    thumbnail: null
  }
]

// Helper functions
export function getTemplateById(id) {
  return templates.find(t => t.id === id)
}

export function getTemplatesByCategory(category) {
  return templates.filter(t => t.category === category)
}

export function getTemplatesByBrand(brand) {
  return templates.filter(t => t.brand === brand)
}

export function hasFeature(template, feature) {
  return template?.features?.includes(feature) || false
}
