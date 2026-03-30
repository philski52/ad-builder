import { create } from 'zustand'

export const useClickZoneToolStore = create((set, get) => ({
  isActive: false,
  // Original ZIP contents
  files: {},         // filename -> { content, dataUrl } for assets
  htmlContent: '',   // original index.html content
  cssContent: '',    // combined CSS content
  jsContent: '',     // combined JS content
  originalZipFile: null,
  // Ad metadata
  adName: '',
  dimensions: { width: 1000, height: 1600 },
  // Click zones (detected + user-added)
  clickZones: [],
  // UI state
  selectedZoneIndex: null,

  activate: () => set({ isActive: true }),
  close: () => set({
    isActive: false,
    files: {},
    htmlContent: '',
    cssContent: '',
    jsContent: '',
    originalZipFile: null,
    adName: '',
    dimensions: { width: 1000, height: 1600 },
    clickZones: [],
    selectedZoneIndex: null
  }),

  setAdData: ({ files, htmlContent, cssContent, jsContent, adName, dimensions, clickZones, originalZipFile }) => set({
    files,
    htmlContent,
    cssContent,
    jsContent,
    adName: adName || '',
    dimensions: dimensions || { width: 1000, height: 1600 },
    clickZones: clickZones || [],
    originalZipFile
  }),

  setSelectedZone: (index) => set({ selectedZoneIndex: index }),

  addZone: (zone) => set((state) => ({
    clickZones: [...state.clickZones, {
      id: zone.id || `zone-${Date.now()}`,
      url: zone.url || 'https://',
      linkType: zone.linkType || 'url',
      jobId: zone.jobId || '',
      top: zone.top ?? 100,
      left: zone.left ?? 50,
      width: zone.width ?? 200,
      height: zone.height ?? 50,
      detected: false,
      ...zone
    }],
    selectedZoneIndex: state.clickZones.length
  })),

  updateZone: (index, field, value) => set((state) => {
    const newZones = [...state.clickZones]
    newZones[index] = { ...newZones[index], [field]: value }
    return { clickZones: newZones }
  }),

  updateZonePosition: (index, pos) => set((state) => {
    const newZones = [...state.clickZones]
    newZones[index] = { ...newZones[index], ...pos }
    return { clickZones: newZones }
  }),

  removeZone: (index) => set((state) => ({
    clickZones: state.clickZones.filter((_, i) => i !== index),
    selectedZoneIndex: state.selectedZoneIndex === index ? null : state.selectedZoneIndex
  }))
}))
