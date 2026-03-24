import { useProjectStore } from './stores/projectStore'
import { useRefactorStore } from './stores/refactorStore'
import { useClickZoneToolStore } from './stores/clickZoneToolStore'
import MainLayout from './components/layout/MainLayout'
import TemplateGrid from './components/templates/TemplateGrid'
import RefactorWorkspace from './components/refactor/RefactorWorkspace'
import ClickZoneToolWorkspace from './components/clickzone-tool/ClickZoneToolWorkspace'

function App() {
  const currentTemplate = useProjectStore((state) => state.currentTemplate)
  const isRefactorActive = useRefactorStore((state) => state.isActive)
  const isClickZoneToolActive = useClickZoneToolStore((state) => state.isActive)

  return (
    <div className="min-h-screen bg-gray-50">
      {isClickZoneToolActive ? (
        <ClickZoneToolWorkspace />
      ) : isRefactorActive ? (
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
