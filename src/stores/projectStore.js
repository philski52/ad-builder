import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Default button configuration
const DEFAULT_BUTTONS = [
  { text: 'Button 1', bgColor: '#2e8e95', textColor: '#ffffff', borderRadius: 16, width: 984, height: 99.5, top: 0, left: 0, showVideoControls: true },
  { text: 'Button 2', bgColor: '#2e8e95', textColor: '#ffffff', borderRadius: 16, width: 984, height: 99.5, top: 0, left: 0, showVideoControls: true },
  { text: 'Button 3',   bgColor: '#2e8e95', textColor: '#ffffff', borderRadius: 16, width: 984, height: 99.5, top: 0, left: 0, showVideoControls: true },
  { text: 'Button 4',   bgColor: '#2e8e95', textColor: '#ffffff', borderRadius: 16, width: 984, height: 99.5, top: 0, left: 0, showVideoControls: true },
];

// Default ISI dimensions per brand/size
const ISI_DEFAULTS = {
  cp: { isiWidth: 1080, isiHeight: 540, isiTop: 1193, isiLeft: 0 },
  mr: { isiWidth: 300, isiHeight: 100, isiTop: 150, isiLeft: 0 },
  int: { isiWidth: 1080, isiHeight: 540, isiTop: 1193, isiLeft: 0 },
};

export const useProjectStore = create(
  persist(
    (set, get) => ({
      // Current template selection
      currentTemplate: null,
      projectName: '',

      // Uploaded assets
      assets: {
        background: null,
        frames: [],
        isiImage: null,
        video: null,
        thumbnail: null,
        playButton: null,
        expandButtonImage: null,
        collapseButtonImage: null
      },

      // Unmapped assets from import (available for manual assignment)
      unmappedAssets: [],

      // Configuration values
      config: {
        clickTag1: 'https://education.patientpoint.com/failsafe-page/',
        clickTag2: 'https://education.patientpoint.com/failsafe-page/',
        clickTag3: 'https://education.patientpoint.com/failsafe-page/',
        clickTag4: 'https://education.patientpoint.com/failsafe-page/',
        dimensions: { width: 1080, height: 1733 },
        // ISI Container settings
        isiHeight: 540,
        isiTop: 1193,
        isiWidth: 1080,
        isiLeft: 0,
        isiBackgroundColor: '#ffffff',
        // ISI Image (ISI_guts) settings
        isiImageWidth: 1080,
        isiImageLeft: 0,
        isiImageTop: 0,
        // Scroller styling (the draggable thumb)
        scrollerColor: '#798280',
        scrollerWidth: 12,
        scrollerHeight: 35,
        scrollerBorderRadius: 50,
        // Scroller track (isiLineNoArrows) settings
        scrollerTrackColor: '#b8bebc',
        scrollerTrackWidth: 12,
        scrollerTrackRight: 0,
        scrollerTrackBorderRadius: 50,
        // Scroll behavior
        autoScrollSpeed: 80,
        scrollStep: 5,
        // Animation settings
        frameDuration: 0.5,
        frameDelay: 1,
        // Expandable ISI settings
        expandableEnabled: false,
        // Collapsed state (initial)
        expandableCollapsedHeight: 450,
        expandableCollapsedTop: 1100,
        // Expanded state
        expandableExpandedHeight: 1742,
        expandableExpandedTop: 42,
        expandableControlsHeightPercent: 84,
        // Animation
        expandableDuration: 1,
        // Expand button
        expandButtonMode: 'text', // 'text' or 'image'
        expandButtonText: 'CLICK HERE TO EXPAND SAFETY INFORMATION',
        expandButtonTop: 1040,
        expandButtonLeft: 0,
        expandButtonWidth: 1080,
        expandButtonHeight: 41,
        expandButtonBgColor: '#532f87',
        expandButtonTextColor: '#ffffff',
        expandButtonFontSize: 16,
        expandButtonBorderRadius: 50,
        // Collapse button
        collapseButtonMode: 'text', // 'text' or 'image'
        collapseButtonText: 'CLICK HERE TO COLLAPSE SAFETY INFORMATION',
        collapseButtonTop: 0,
        collapseButtonLeft: 0,
        collapseButtonWidth: 1080,
        collapseButtonHeight: 41,
        collapseButtonBgColor: '#532f87',
        collapseButtonTextColor: '#ffffff',
        collapseButtonFontSize: 16,
        collapseButtonBorderRadius: 50,
        // Video settings
        videoHeight: 562,
        videoTop: 134,
        videoLeft: 65,
        videoWidth: 876,
        playBtnTop: 432,
        playBtnLeft: 417,
        playBtnWidth: 150,
        showVideoControls: true,
        // Button settings (for INT templates)
        buttonCount: 2,
        buttons: DEFAULT_BUTTONS.map((button) => ({ ...button })),
        // Click Zones (for MR and CP templates)
        // linkType: 'url' | 'pdf' | 'mod'
        // jobId: string (for mod fallback URL)
        clickZones: [
          { id: 'clickTag1', url: 'https://education.patientpoint.com/failsafe-page/', linkType: 'url', jobId: '', top: 0, left: 0, width: 1080, height: 1193, inISI: false, pauseVideo: false }
        ],
        // Global job ID for mod fallback (used if zone doesn't specify one)
        jobId: '',
      },

      // ISI content (for text-to-image generation)
      isiContent: {
        mode: 'upload', // 'upload' or 'generate'
        text: '',
        fontFamily: 'Arial',
        fontSize: 14,
        lineHeight: 1.4,
      },

      // Animation timeline data
      // Each entry: { id, target, type, effects, duration, startTime, easing }
      animations: [],

      // Animation replay trigger
      animationReplayCount: 0,

      // Track if preview needs refresh
      isPreviewDirty: false,

      // Actions
      setTemplate: (template) => {
        const isiDefaults = ISI_DEFAULTS[template.brand] || ISI_DEFAULTS.cp;
        const hasISI = template.features?.includes('isi');
        set({
          currentTemplate: template,
          projectName: `${template.id}-${Date.now()}`,
          config: {
            ...get().config,
            dimensions: template.dimensions,
            ...(hasISI ? isiDefaults : {}),
            // Reset click zones to match new dimensions
            // Video-only templates (no buttons) don't use click zones
            clickZones: (template.features?.includes('video') && !template.features?.includes('buttons') && !template.features?.includes('background'))
              ? []
              : [
              {
                id: 'clickTag1',
                url: 'https://education.patientpoint.com/failsafe-page/',
                linkType: 'url',
                jobId: '',
                top: 0,
                left: 0,
                width: template.features?.includes('buttons') ? 200 : template.dimensions.width,
                height: template.features?.includes('buttons') ? 50 : (hasISI ? isiDefaults.isiTop : template.dimensions.height),
                inISI: false,
                pauseVideo: template.features?.includes('video') ? true : false
              }
            ],
            jobId: '',
            // Reset buttons and video controls to defaults when switching templates
            showVideoControls: true,
            buttons: DEFAULT_BUTTONS.map((button) => ({ ...button })),
            buttonCount: 0,
            // Reset bg-video play button position to defaults
            ...(template.features?.includes('background') && template.features?.includes('video') ? {
              playBtnTop: 432,
              playBtnLeft: 417,
              playBtnWidth: 150,
            } : {})
          },
        });
      },

      clearProject: () => set({
        currentTemplate: null,
        projectName: '',
        assets: {
          background: null,
          frames: [],
          isiImage: null,
          video: null,
          thumbnail: null,
          playButton: null
        },
        animations: [],
        isPreviewDirty: false
      }),

      setProjectName: (name) => set({ projectName: name }),

      setAsset: (key, value) =>
        set((state) => ({
          assets: { ...state.assets, [key]: value },
          isPreviewDirty: true,
        })),

      addFrame: (frame) =>
        set((state) => ({
          assets: {
            ...state.assets,
            frames: [...state.assets.frames, frame],
          },
          isPreviewDirty: true,
        })),

      removeFrame: (index) =>
        set((state) => ({
          assets: {
            ...state.assets,
            frames: state.assets.frames.filter((_, i) => i !== index),
          },
          isPreviewDirty: true,
        })),

      updateConfig: (key, value) =>
        set((state) => ({
          config: { ...state.config, [key]: value },
          isPreviewDirty: true,
        })),

      setIsiContent: (content) =>
        set((state) => ({
          isiContent: { ...state.isiContent, ...content },
          isPreviewDirty: true,
        })),

      markPreviewClean: () => set({ isPreviewDirty: false }),

      // Animation actions
      setAnimations: (animations) => set({ animations, isPreviewDirty: true }),

      addAnimation: (animation) =>
        set((state) => ({
          animations: [
            ...state.animations,
            {
              id: `anim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              ...animation,
            },
          ],
          isPreviewDirty: true,
        })),

      updateAnimation: (id, updates) =>
        set((state) => ({
          animations: state.animations.map((a) =>
            a.id === id ? { ...a, ...updates } : a,
          ),
          isPreviewDirty: true,
        })),

      removeAnimation: (id) =>
        set((state) => ({
          animations: state.animations.filter((a) => a.id !== id),
          isPreviewDirty: true,
        })),

      reorderAnimations: (animations) =>
        set({ animations, isPreviewDirty: true }),

      triggerAnimationReplay: () =>
        set((state) => ({
          animationReplayCount: (state.animationReplayCount || 0) + 1,
        })),

      // Generate default fade in/out animations for all current frames
      generateDefaultAnimations: () =>
        set((state) => {
          const frameCount = state.assets.frames?.length || 0;
          if (frameCount === 0) return {};

          const duration = state.config.frameDuration || 0.5;
          const delay = state.config.frameDelay || 1;
          const animations = [];
          let timePosition = 0;

          for (let i = 0; i < frameCount; i++) {
            const target = `frame${i + 1}`;
            // Fade in
            animations.push({
              id: `anim-default-in-${i}`,
              target,
              type: 'in',
              effects: { autoAlpha: { from: 0, to: 1 } },
              duration,
              startTime: timePosition,
              easing: 'Power1.easeOut',
            });
            timePosition += duration + delay;
            // Fade out (skip for last frame)
            if (i < frameCount - 1) {
              animations.push({
                id: `anim-default-out-${i}`,
                target,
                type: 'out',
                effects: { autoAlpha: { from: 1, to: 0 } },
                duration,
                startTime: timePosition,
                easing: 'Power1.easeIn',
              });
              timePosition += duration;
            }
          }
          return { animations, isPreviewDirty: true };
        }),

      // Export project as JSON for save/load
      exportProject: () => {
        const state = get();
        return {
          version: '1.0',
          projectName: state.projectName,
          currentTemplate: state.currentTemplate,
          config: state.config,
          isiContent: state.isiContent,
          animations: state.animations,
          // Note: assets are stored as data URLs
          assets: state.assets,
        };
      },

      importProject: (projectData) => {
        if (projectData.version !== '1.0') {
          console.warn('Project version mismatch');
        }
        set({
          projectName: projectData.projectName,
          currentTemplate: projectData.currentTemplate,
          config: projectData.config,
          isiContent: projectData.isiContent || get().isiContent,
          animations: projectData.animations || [],
          assets: projectData.assets,
          isPreviewDirty: true
        })
      },

      // Import from ad analysis result (parsed ZIP file)
      importFromAnalysis: (analysisResult) => {
        if (!analysisResult.template) {
          console.error('No template detected in import')
          return
        }

        const state = get()
        const template = analysisResult.template

        // Build assets object from analysis
        const assets = {
          background: analysisResult.assets.background || null,
          frames: analysisResult.assets.frames || [],
          isiImage: analysisResult.assets.isiImage || null,
          video: analysisResult.assets.video || null,
          thumbnail: analysisResult.assets.thumbnail || null,
          playButton: analysisResult.assets.playButton || null,
          expandButtonImage: analysisResult.assets.expandButtonImage || null,
          collapseButtonImage: analysisResult.assets.collapseButtonImage || null
        }

        // Store unmapped assets for manual assignment
        const unmappedAssets = (analysisResult.allAssets || [])
          .filter(a => !a.mapped)
          .map(a => ({
            filename: a.filename,
            dataUrl: a.dataUrl,
            type: a.type,
            isSvg: a.isSvg,
            suggestedSlot: a.suggestedSlot,
            scene: a.scene,
            element: a.element,
            context: a.context
          }))

        // Merge config - start with defaults from template, then overlay extracted values
        const isiDefaults = template.brand === 'cp' ? { isiWidth: 1080, isiHeight: 540, isiTop: 1193, isiLeft: 0 }
          : template.brand === 'mr' ? { isiWidth: 300, isiHeight: 100, isiTop: 150, isiLeft: 0 }
          : { isiWidth: 1080, isiHeight: 540, isiTop: 1193, isiLeft: 0 }

        const hasISI = template.features?.includes('isi')

        const config = {
          ...state.config,
          dimensions: analysisResult.config.dimensions || template.dimensions,
          ...(hasISI ? isiDefaults : {}),
          // Overlay all extracted config values
          ...Object.fromEntries(
            Object.entries(analysisResult.config).filter(([_, v]) => v !== null && v !== undefined)
          )
        }

        // Generate project name from template
        const projectName = `imported-${template.id}-${Date.now()}`

        // Import extracted animations with proper IDs and preserve original selector
        const animations = (analysisResult.animations || []).map((anim, i) => ({
          id: `anim-imported-${i}-${Date.now()}`,
          target: anim.target,
          originalSelector: anim.originalSelector,
          type: anim.type || 'in',
          effects: anim.effects || {},
          duration: anim.duration || 0.5,
          startTime: anim.startTime || 0,
          easing: anim.easing || 'Power1.easeOut'
        }))

        set({
          currentTemplate: template,
          projectName,
          assets,
          unmappedAssets,
          config,
          animations,
          isPreviewDirty: true
        })
      }
    }),
    {
      name: 'ad-builder-project',
      partialize: (state) => ({
        projectName: state.projectName,
        currentTemplate: state.currentTemplate,
        config: state.config,
        isiContent: state.isiContent,
        animations: state.animations,
        // Assets (data URLs) are excluded — they can be 50-100MB and blow the 5MB localStorage limit
      }),
    },
  ),
);
