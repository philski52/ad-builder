import { useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import AssetManager from '../editor/AssetManager'
import ConfigPanel from '../editor/ConfigPanel'
import ClickZonesEditor from '../editor/ClickZonesEditor'
import ISIEditor from '../editor/ISIEditor'
import ExpandableISIEditor from '../editor/ExpandableISIEditor'
import AnimationEditor from '../editor/AnimationEditor'
import CodeView from '../editor/CodeView'
import PreviewIframe from '../preview/PreviewIframe'
import ValidationReport from '../export/ValidationReport'
import { useProjectStore } from '../../stores/projectStore'
import { hasFeature } from '../../templates'

function MainLayout() {
  const [activeSection, setActiveSection] = useState('assets')
  const currentTemplate = useProjectStore((state) => state.currentTemplate)

  const renderEditor = () => {
    switch (activeSection) {
      case 'assets':
        return <AssetManager />
      case 'config':
        return <ConfigPanel />
      case 'zones':
        return <ClickZonesEditor />
      case 'isi':
        return <ISIEditor />
      case 'expandable':
        return <ExpandableISIEditor />
      case 'animation':
        return <AnimationEditor />
      case 'code':
        return <CodeView />
      case 'validation':
        return <ValidationReport />
      default:
        return <AssetManager />
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />

        {/* Editor Panel */}
        <div className="w-96 bg-white border-r border-gray-200 overflow-y-auto">
          {renderEditor()}
        </div>

        {/* Preview Panel */}
        <div className="flex-1 bg-gray-100 p-4 overflow-auto">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Preview</h3>
          <PreviewIframe />
        </div>
      </div>
    </div>
  )
}

export default MainLayout
