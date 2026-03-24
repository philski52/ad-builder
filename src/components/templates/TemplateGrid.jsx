import { useState } from 'react'
import { templates, TEMPLATE_CATEGORIES, BRAND_PREFIXES } from '../../templates'
import TemplateCard from './TemplateCard'
import ImportAdButton from '../import/ImportAdButton'
import { useClickZoneToolStore } from '../../stores/clickZoneToolStore'

function TemplateGrid() {
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [brandFilter, setBrandFilter] = useState('all')

  const filteredTemplates = templates.filter((template) => {
    if (categoryFilter !== 'all' && template.category !== categoryFilter) return false
    if (brandFilter !== 'all' && template.brand !== brandFilter) return false
    return true
  })

  const activateClickZoneTool = useClickZoneToolStore((s) => s.activate)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ad Builder</h1>
            <p className="text-gray-600 mt-1">Select a template or import an existing ad</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={activateClickZoneTool}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Click Zone Tool
            </button>
            <ImportAdButton />
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="px-8 py-4 bg-white border-b border-gray-200 flex gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Categories</option>
            {Object.entries(TEMPLATE_CATEGORIES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Brand/Size</label>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Sizes</option>
            {Object.entries(BRAND_PREFIXES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Template Grid */}
      <div className="px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTemplates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No templates match your filters</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default TemplateGrid
