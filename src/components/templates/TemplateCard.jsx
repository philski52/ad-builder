import { useProjectStore } from '../../stores/projectStore'
import { TEMPLATE_CATEGORIES } from '../../templates'

function TemplateCard({ template }) {
  const setTemplate = useProjectStore((state) => state.setTemplate)

  const featureColors = {
    isi: 'bg-blue-100 text-blue-700',
    animation: 'bg-purple-100 text-purple-700',
    video: 'bg-red-100 text-red-700',
    modal: 'bg-green-100 text-green-700',
    expandable: 'bg-yellow-100 text-yellow-700',
    buttons: 'bg-orange-100 text-orange-700'
  }

  const categoryColors = {
    static: 'bg-gray-100 text-gray-700',
    animated: 'bg-purple-100 text-purple-700',
    video: 'bg-red-100 text-red-700',
    modal: 'bg-green-100 text-green-700'
  }

  return (
    <div
      onClick={() => setTemplate(template)}
      className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg hover:border-primary-300 transition-all cursor-pointer group"
    >
      {/* Preview Area */}
      <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center relative">
        <div className="text-center p-4">
          <div className="text-3xl font-bold text-gray-300 mb-2">
            {template.dimensions.width}x{template.dimensions.height}
          </div>
          <div className="text-sm text-gray-400">
            {template.brand.toUpperCase()}
          </div>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-primary-600 bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 text-primary-600 font-medium bg-white px-4 py-2 rounded-lg shadow">
            Select Template
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColors[template.category]}`}>
            {TEMPLATE_CATEGORIES[template.category]}
          </span>
        </div>

        <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
        <p className="text-sm text-gray-500 mb-3">{template.description}</p>

        {/* Features */}
        {template.features.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.features.map((feature) => (
              <span
                key={feature}
                className={`text-xs px-2 py-0.5 rounded ${featureColors[feature] || 'bg-gray-100 text-gray-600'}`}
              >
                {feature.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default TemplateCard
