import { useState } from 'react'
import { templates, TEMPLATE_CATEGORIES, BRAND_PREFIXES } from '../../templates'
import TemplateCard from './TemplateCard'
import ImportAdButton from '../import/ImportAdButton'
import TemplateWizard from './TemplateWizard'
import { useClickZoneToolStore } from '../../stores/clickZoneToolStore'

function TemplateGrid() {
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [brandFilter, setBrandFilter] = useState('all')
  const [showWizard, setShowWizard] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  const filteredTemplates = templates.filter((template) => {
    if (categoryFilter !== 'all' && template.category !== categoryFilter) return false
    if (brandFilter !== 'all' && template.brand !== brandFilter) return false
    return true
  })

  const activateClickZoneTool = useClickZoneToolStore((s) => s.activate)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Ad Builder</h1>
      </header>

      {/* Hero — Two primary actions */}
      <div className="px-8 py-12">
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-gray-600 mb-8">What would you like to do?</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Build New Ad */}
            <button
              onClick={() => setShowWizard(true)}
              className="group p-8 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all text-left"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div className="font-semibold text-gray-900 text-lg">Build New Ad</div>
              <p className="text-sm text-gray-500 mt-1">Guided wizard — answer a few questions and we'll set up the right template</p>
            </button>

            {/* Import & Refactor — drop zone card */}
            <ImportAdButton dropZone />

            {/* Click Zone Tool */}
            <button
              onClick={activateClickZoneTool}
              className="group p-8 bg-white rounded-xl border-2 border-gray-200 hover:border-amber-500 hover:shadow-lg transition-all text-left"
            >
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-amber-200 transition-colors">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <div className="font-semibold text-gray-900 text-lg">Click Zone Tool</div>
              <p className="text-sm text-gray-500 mt-1">Upload an ad to visually place and edit click zones</p>
            </button>
          </div>
        </div>
      </div>

      {/* Divider — expand to show all templates */}
      <div className="px-8">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="w-full flex items-center gap-3 py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="flex items-center gap-1.5">
              {showTemplates ? 'Hide' : 'Or pick a template directly'}
              <svg className={'w-4 h-4 transition-transform ' + (showTemplates ? 'rotate-180' : '')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </button>
        </div>
      </div>

      {/* Template Grid — collapsed by default */}
      {showTemplates && (
        <>
          {/* Filters */}
          <div className="px-8 py-4 flex gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Categories</option>
                {Object.entries(TEMPLATE_CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Size</label>
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Sizes</option>
                {Object.entries(BRAND_PREFIXES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="px-8 pb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>

            {filteredTemplates.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No templates match your filters</p>
              </div>
            )}
          </div>
        </>
      )}

      {showWizard && <TemplateWizard onClose={() => setShowWizard(false)} />}
    </div>
  )
}

export default TemplateGrid
