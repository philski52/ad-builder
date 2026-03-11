import { useRef } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import ExportButton from '../export/ExportButton'

function Header() {
  const projectName = useProjectStore((state) => state.projectName)
  const setProjectName = useProjectStore((state) => state.setProjectName)
  const clearProject = useProjectStore((state) => state.clearProject)
  const currentTemplate = useProjectStore((state) => state.currentTemplate)
  const exportProject = useProjectStore((state) => state.exportProject)
  const importProject = useProjectStore((state) => state.importProject)

  const fileInputRef = useRef(null)

  const handleSaveProject = () => {
    const projectData = exportProject()
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName || 'ad-project'}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleLoadProject = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const projectData = JSON.parse(e.target.result)
        importProject(projectData)
      } catch (error) {
        alert('Failed to load project: Invalid file format')
      }
    }
    reader.readAsText(file)

    // Reset input
    e.target.value = ''
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={clearProject}
          className="text-gray-500 hover:text-gray-700 transition-colors"
          title="Back to templates"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="text-lg font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:outline-none px-1 py-0.5"
            placeholder="Project name"
          />
          {currentTemplate && (
            <p className="text-sm text-gray-500">
              {currentTemplate.name} • {currentTemplate.dimensions.width}x{currentTemplate.dimensions.height}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
        >
          Load
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleLoadProject}
          className="hidden"
        />
        <button
          onClick={handleSaveProject}
          className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
        >
          Save
        </button>
        <ExportButton />
      </div>
    </header>
  )
}

export default Header
