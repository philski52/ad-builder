import { useProjectStore } from './stores/projectStore'
import MainLayout from './components/layout/MainLayout'
import TemplateGrid from './components/templates/TemplateGrid'

function App() {
  const currentTemplate = useProjectStore((state) => state.currentTemplate)

  return (
    <div className="min-h-screen bg-gray-50">
      {currentTemplate ? (
        <MainLayout />
      ) : (
        <TemplateGrid />
      )}
    </div>
  )
}

export default App
