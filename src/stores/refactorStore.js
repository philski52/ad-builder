import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useRefactorStore = create(
  persist(
    (set, get) => ({
      // Whether the refactor workspace is active
      isActive: false,

      // Current step in the workflow
      currentStep: 'overview', // 'overview' | 'refactor' | 'tasks' | 'editor'

      // Raw import result from adImporter.js
      importResult: null,

      // In-memory file system: { 'index.html': '...', 'js/ad.js': '...', ... }
      files: {},

      // Original files for diff comparison
      originalFiles: {},

      // Asset data URLs extracted from the ZIP (images, videos, etc.)
      assetFiles: {},

      // Tasks generated from import analysis
      // Each: { id, title, description, action, priority, status, category, context }
      tasks: [],

      // AI chat history
      // Each: { id, role: 'user'|'assistant', content, timestamp }
      chatHistory: [],

      // Whether AI chat panel is open
      isChatOpen: false,

      // AI provider and key (persisted)
      aiProvider: 'anthropic', // 'anthropic' | 'openai'
      apiKey: '',

      // AI model preference (persisted)
      aiModel: 'claude-sonnet-4-20250514',

      // Currently selected file in the editor
      activeFile: null,

      // Ad platform type: 'ixr' | 'focus' (determines which rule set to apply)
      adPlatform: null,

      // Ad metadata from import
      adMeta: {
        templateType: null, // 'cp' | 'mr' | 'int'
        dimensions: null,
        projectName: '',
        isGWD: false,
        hasISI: false,
        hasAnimation: false,
        animationType: null,
        detectedUrls: [],
      },

      // --- Actions ---

      // Initialize workspace from an import result
      startRefactor: async (importResult, originalFile, platform) => {
        const files = {}
        const originalFiles = {}
        const assetFiles = {}

        // Detect the root folder prefix from asset paths (e.g. "6853/" from "6853/assets/images/foo.png")
        let rootPrefix = ''
        if (importResult.allAssets?.length > 0) {
          const firstAssetPath = importResult.allAssets[0].path || importResult.allAssets[0].filename || ''
          const slashIndex = firstAssetPath.indexOf('/')
          if (slashIndex > 0) {
            const candidate = firstAssetPath.substring(0, slashIndex + 1)
            // Verify most assets share this prefix
            const matchCount = importResult.allAssets.filter(a =>
              (a.path || a.filename || '').startsWith(candidate)
            ).length
            if (matchCount > importResult.allAssets.length / 2) {
              rootPrefix = candidate
            }
          }
        }

        // Populate files from refactored content, using original ZIP paths
        const paths = importResult.filePaths || {}
        if (importResult.refactoredFiles) {
          if (importResult.refactoredFiles.html) {
            files[paths.html || (rootPrefix + 'index.html')] = importResult.refactoredFiles.html
          }
          if (importResult.refactoredFiles.adJs) {
            files[paths.adJs || (rootPrefix + 'js/ad.js')] = importResult.refactoredFiles.adJs
          }
          if (importResult.refactoredFiles.mainJs) {
            files[paths.mainJs || (rootPrefix + 'js/main.js')] = importResult.refactoredFiles.mainJs
          }
          if (importResult.refactoredFiles.scrollerJs) {
            files[rootPrefix + 'script/scroller.js'] = importResult.refactoredFiles.scrollerJs
          }
          // Additional JS files
          if (importResult.refactoredFiles.additionalJs) {
            for (const [name, content] of Object.entries(importResult.refactoredFiles.additionalJs)) {
              files[rootPrefix + `js/${name}`] = content
            }
          }
        }

        // Include CSS files (not refactored, just preserved)
        if (importResult.originalFiles) {
          if (importResult.originalFiles.scrollerCss && paths.scrollerCss) {
            files[paths.scrollerCss] = importResult.originalFiles.scrollerCss
          }
          if (importResult.originalFiles.clicksCss && paths.clicksCss) {
            files[paths.clicksCss] = importResult.originalFiles.clicksCss
          }
          if (importResult.originalFiles.mainCss && paths.mainCss) {
            files[paths.mainCss] = importResult.originalFiles.mainCss
          }
          // Include vendor JS/CSS files (jQuery, TweenMax, etc.) at their original paths
          if (importResult.originalFiles.otherFiles && paths.otherFiles) {
            for (const [fullPath, filename] of Object.entries(paths.otherFiles)) {
              if (importResult.originalFiles.otherFiles[filename]) {
                files[fullPath] = importResult.originalFiles.otherFiles[filename]
              }
            }
          }
        }

        // Store originals for diff (use same paths as refactored files)
        if (importResult.originalFiles) {
          if (importResult.originalFiles.html) {
            originalFiles[paths.html || (rootPrefix + 'index.html')] = importResult.originalFiles.html
          }
          if (importResult.originalFiles.adJs) {
            originalFiles[paths.adJs || (rootPrefix + 'js/ad.js')] = importResult.originalFiles.adJs
          }
          if (importResult.originalFiles.mainJs) {
            originalFiles[paths.mainJs || (rootPrefix + 'js/main.js')] = importResult.originalFiles.mainJs
          }
          if (importResult.originalFiles.additionalJs) {
            for (const [name, content] of Object.entries(importResult.originalFiles.additionalJs)) {
              originalFiles[rootPrefix + `js/${name}`] = content
            }
          }
        }

        // Extract asset data URLs
        if (importResult.allAssets) {
          for (const asset of importResult.allAssets) {
            if (asset.dataUrl) {
              assetFiles[asset.path || asset.filename] = asset.dataUrl
            }
          }
        }

        // Build tasks from manual tasks + manual fixes
        const tasks = []
        if (importResult.manualTasks) {
          for (const task of importResult.manualTasks) {
            tasks.push({
              id: task.id || `task-${tasks.length}`,
              title: task.title,
              description: task.description,
              action: task.action,
              priority: task.priority || 'medium',
              status: 'pending', // 'pending' | 'in-progress' | 'done'
              category: task.category || 'general',
              context: task.context || null,
            })
          }
        }

        // Build ad metadata
        const summary = importResult.template || {}
        const adMeta = {
          templateType: summary.brand || null,
          dimensions: importResult.config?.dimensions || summary.dimensions || null,
          projectName: `refactor-${summary.id || 'ad'}-${Date.now()}`,
          isGWD: importResult.isGWD || false,
          hasISI: summary.features?.includes('isi') || false,
          hasAnimation: importResult.animationAnalysis?.hasAnimations || false,
          animationType: importResult.animationAnalysis?.libraryUsed || null,
          detectedUrls: importResult.detectedUrls || [],
        }

        // --- Bundle standard device libraries ---
        // Check which libraries are already present in the imported files
        const allFilePaths = Object.keys(files).map(p => p.toLowerCase())
        const hasJquery = allFilePaths.some(p => p.includes('jquery'))
        const hasAutoScroll = allFilePaths.some(p => p.includes('autoscroll'))
        const hasScrollerCss = allFilePaths.some(p => p.includes('scroller.css'))
        const templateBrand = (summary.brand || '').toLowerCase()
        const hasISI = summary.features?.includes('isi') || false
        const isMrOrInt = templateBrand === 'mr' || templateBrand === 'int'

        // Helper to fetch a device library file from public/device-libs/
        const fetchLib = async (libPath) => {
          try {
            const resp = await fetch(`/device-libs/${libPath}`)
            if (resp.ok) return await resp.text()
          } catch (e) { /* silently skip if unavailable */ }
          return null
        }

        // jQuery 2.1.4 — required for ALL ads
        if (!hasJquery) {
          const jqueryContent = await fetchLib('js/jquery-2.1.4.min.js')
          if (jqueryContent) {
            files[rootPrefix + 'js/jquery-2.1.4.min.js'] = jqueryContent
          }
        }

        // autoScroll.js — required for MR and INT ads only (NOT CP)
        if (isMrOrInt && !hasAutoScroll) {
          const autoScrollContent = await fetchLib('js/autoScroll.js')
          if (autoScrollContent) {
            files[rootPrefix + 'js/autoScroll.js'] = autoScrollContent
          }
        }

        // scroller.css — required for MR and INT ISI ads
        if (isMrOrInt && hasISI && !hasScrollerCss) {
          const scrollerContent = await fetchLib('css/scroller.css')
          if (scrollerContent) {
            files[rootPrefix + 'css/scroller.css'] = scrollerContent
          }
        }

        // Ensure script/link tags exist in index.html for bundled libraries
        const htmlPath = paths.html || (rootPrefix + 'index.html')
        if (files[htmlPath]) {
          let html = files[htmlPath]
          const htmlLower = html.toLowerCase()

          // Add jQuery script tag if not already referenced
          if (!hasJquery && !htmlLower.includes('jquery')) {
            // Insert before the first existing <script> tag or before </head>
            const insertPoint = html.search(/<script[\s>]/i)
            if (insertPoint !== -1) {
              html = html.slice(0, insertPoint) +
                '<script type="text/javascript" src="js/jquery-2.1.4.min.js"></script>\n    ' +
                html.slice(insertPoint)
            }
          }

          // Add autoScroll.js script tag for MR/INT ads if not referenced
          if (isMrOrInt && !hasAutoScroll && !htmlLower.includes('autoscroll')) {
            // Insert before </body> so it loads after other scripts
            const bodyClose = html.lastIndexOf('</body>')
            if (bodyClose !== -1) {
              html = html.slice(0, bodyClose) +
                '<script type="text/javascript" src="js/autoScroll.js"></script>\n' +
                html.slice(bodyClose)
            }
          }

          // Add scroller.css link tag for MR/INT ISI ads if not referenced
          if (isMrOrInt && hasISI && !hasScrollerCss && !htmlLower.includes('scroller.css')) {
            const headClose = html.indexOf('</head>')
            if (headClose !== -1) {
              html = html.slice(0, headClose) +
                '    <link rel="stylesheet" href="css/scroller.css">\n' +
                html.slice(headClose)
            }
          }

          files[htmlPath] = html
        }

        // Determine initial active file
        const activeFile = files['index.html'] ? 'index.html'
          : Object.keys(files)[0] || null

        // Store platform in importResult so exportUtils can access it
        importResult.adPlatform = platform || 'ixr'

        set({
          isActive: true,
          currentStep: 'overview',
          importResult,
          adPlatform: platform || 'ixr',
          files,
          originalFiles,
          assetFiles,
          tasks,
          chatHistory: [],
          isChatOpen: false,
          activeFile,
          adMeta,
        })
      },

      // Close workspace and return to template grid
      closeRefactor: () => set({
        isActive: false,
        currentStep: 'overview',
        importResult: null,
        adPlatform: null,
        files: {},
        originalFiles: {},
        assetFiles: {},
        tasks: [],
        chatHistory: [],
        isChatOpen: false,
        activeFile: null,
        adMeta: {
          templateType: null,
          dimensions: null,
          projectName: '',
          isGWD: false,
          hasISI: false,
          hasAnimation: false,
          animationType: null,
          detectedUrls: [],
        },
      }),

      // Navigation
      setStep: (step) => set({ currentStep: step }),

      // File operations
      updateFile: (path, content) => set((state) => ({
        files: { ...state.files, [path]: content }
      })),

      setActiveFile: (path) => set({ activeFile: path }),

      // Task operations
      updateTaskStatus: (taskId, status) => set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId ? { ...t, status } : t
        )
      })),

      // Chat operations
      toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

      addChatMessage: (role, content) => set((state) => ({
        chatHistory: [...state.chatHistory, {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role,
          content,
          timestamp: Date.now(),
        }]
      })),

      clearChat: () => set({ chatHistory: [] }),

      // API key, provider & model
      setAiProvider: (provider) => set({ aiProvider: provider }),
      setApiKey: (key) => set({ apiKey: key }),
      setAiModel: (model) => set({ aiModel: model }),
    }),
    {
      name: 'ad-refactor-workspace',
      partialize: (state) => ({
        // Only persist the API key and chat preference across sessions
        // Don't persist file content or import results (too large, stale)
        aiProvider: state.aiProvider,
        apiKey: state.apiKey,
        aiModel: state.aiModel,
      })
    }
  )
)
