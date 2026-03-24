import { useProjectStore } from './stores/projectStore'
import { useRefactorStore } from './stores/refactorStore'
import MainLayout from './components/layout/MainLayout'
import TemplateGrid from './components/templates/TemplateGrid'
import RefactorWorkspace from './components/refactor/RefactorWorkspace'

function App() {
  const currentTemplate = useProjectStore((state) => state.currentTemplate)
  const isRefactorActive = useRefactorStore((state) => state.isActive)

  return (
    <div className="min-h-screen bg-gray-50">
      {isRefactorActive ? (
        <RefactorWorkspace />
      ) : currentTemplate ? (
        <MainLayout />
      ) : (
        <TemplateGrid />
      )}
    </div>
  )
}

export default App
