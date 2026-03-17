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
      },

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
        // Scroller styling
        scrollerColor: '#798280',
        scrollerWidth: 12,
        scrollerHeight: 35,
        scrollerBorderRadius: 50,
        scrollerTrackColor: '#b8bebc',
        scrollerTrackWidth: 12,
        // Scroll behavior
        autoScrollSpeed: 80,
        scrollStep: 5,
        // Animation settings
        frameDuration: 0.5,
        frameDelay: 1,
        expandedHeight: 1742,
        collapseDuration: 1,
        // Video settings
        videoHeight: 562,
        showVideoControls: true,
        // Button settings (for INT templates)
        buttonCount: 2,
        buttons: DEFAULT_BUTTONS.map((button) => ({ ...button })),
        // Click Zones (for MR and CP templates)
        // linkType: 'url' | 'pdf' | 'mod'
        // jobId: string (for mod fallback URL)
        clickZones: [
          {
            id: 'clickTag1',
            url: 'https://education.patientpoint.com/failsafe-page/',
            linkType: 'url',
            jobId: '',
            top: 0,
            left: 0,
            width: 1080,
            height: 1193,
            inISI: false,
          },
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
            clickZones: [
              {
                id: 'clickTag1',
                url: 'https://education.patientpoint.com/failsafe-page/',
                linkType: 'url',
                jobId: '',
                top: 0,
                left: 0,
                width: template.dimensions.width,
                height: hasISI
                  ? isiDefaults.isiTop
                  : template.dimensions.height,
                inISI: false,
              },
            ],
            jobId: '',
            // Reset buttons and video controls to defaults when switching templates
            showVideoControls: true,
            buttons: DEFAULT_BUTTONS.map((button) => ({ ...button })),
            buttonCount: 0
          },
        });
      },

      clearProject: () =>
        set({
          currentTemplate: null,
          projectName: '',
          assets: {
            background: null,
            frames: [],
            isiImage: null,
            video: null,
          },
          animations: [],
          isPreviewDirty: false,
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
          isPreviewDirty: true,
        });
      },
    }),
    {
      name: 'ad-builder-project',
      partialize: (state) => ({
        projectName: state.projectName,
        currentTemplate: state.currentTemplate,
        config: state.config,
        isiContent: state.isiContent,
        animations: state.animations,
        assets: state.assets,
      }),
    },
  ),
);
