import { useState, useMemo } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { generateTemplateCode } from '../../utils/templateGenerator'
import { hasFeature } from '../../templates'

function CodeView() {
  const [activeTab, setActiveTab] = useState('html')
  const currentTemplate = useProjectStore((state) => state.currentTemplate)
  const config = useProjectStore((state) => state.config)
  const assets = useProjectStore((state) => state.assets)
  const animations = useProjectStore((state) => state.animations)

  const generatedCode = useMemo(() => {
    if (!currentTemplate) return { html: '', js: '', css: '' }
    return generateTemplateCode(currentTemplate, config, assets, animations)
  }, [currentTemplate, config, assets, animations])

  const hasISI = hasFeature(currentTemplate, 'isi')
  const hasVideo = hasFeature(currentTemplate, 'video')
  const hasButtons = hasVideo && config.buttonCount > 0
  const hasClickZones = (config.clickZones || []).length > 0

  const tabs = [
    { id: 'html', label: 'index.html', content: generatedCode.html },
    { id: 'js', label: 'ad.js', content: generatedCode.js },
    { id: 'css', label: 'main.css', content: generatedCode.css },
    ...(hasISI ? [
      { id: 'scrollerCss', label: 'scroller.css', content: generatedCode.scrollerCss },
      { id: 'mainJs', label: 'main.js', content: generatedCode.mainJs }
    ] : []),
    ...(hasButtons ? [
      { id: 'buttonsCss', label: 'buttons.css', content: generatedCode.buttonsCss }
    ] : []),
    ...(hasClickZones ? [
      { id: 'clicksCss', label: 'clicks.css', content: generatedCode.clicksCss }
    ] : [])
  ]

  const activeContent = tabs.find(t => t.id === activeTab)?.content || ''

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold">Code View</h2>
        <p className="text-sm text-gray-500 mt-1">Preview generated ad code</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Code Display */}
      <div className="flex-1 overflow-auto bg-gray-900 relative">
        <button
          onClick={() => copyToClipboard(activeContent)}
          className="absolute top-2 right-2 px-3 py-1 bg-gray-700 text-gray-300 text-xs rounded hover:bg-gray-600 transition-colors"
        >
          Copy
        </button>
        <pre className="p-4 text-sm text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap">
          <code>{activeContent || '// No code generated yet'}</code>
        </pre>
      </div>

      {/* Info */}
      <div className="p-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          This code is auto-generated based on your configuration. Use Export to download
          the complete ad package.
        </p>
      </div>
    </div>
  )
}

export default CodeView
