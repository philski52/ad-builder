import { useState } from 'react'
import { templates } from '../../templates'
import { useProjectStore } from '../../stores/projectStore'

const STEPS = {
  adType: {
    question: 'What type of ad are you building?',
    options: [
      { id: 'cp', label: 'CP (Exam Room)', description: '1080x1733 — passive card ad displayed on wallboard', icon: '🖥️' },
      { id: 'mr', label: 'MR (Rectangle)', description: '300x250 — small format rectangle ad', icon: '📐' },
      { id: 'int', label: 'INT (Interact)', description: '1000x1600 — interactive wallboard ad', icon: '📱' },
    ]
  },
  cpType: {
    question: 'Does the ad have animation?',
    options: [
      { id: 'animated', label: 'Yes, animated', description: 'Multi-frame animation with TweenMax timeline' },
      { id: 'static', label: 'No, static', description: 'Single image or fixed layout' },
    ]
  },
  cpStaticFeature: {
    question: 'What features does the ad need?',
    options: [
      { id: 'isi', label: 'ISI (Safety Information)', description: 'Scrollable Important Safety Information section' },
      { id: 'modal', label: 'Opens a Modal', description: 'Tapping opens a secondary fullscreen ad' },
      { id: 'none', label: 'None — just a static image', description: 'Simple background with click zones' },
    ]
  },
  cpAnimatedExpandable: {
    question: 'Does the ISI expand/collapse?',
    options: [
      { id: 'yes', label: 'Yes, expandable ISI', description: 'User can tap to expand ISI to full height' },
      { id: 'no', label: 'No, standard ISI', description: 'Fixed-height scrollable ISI section' },
    ]
  },
  mrType: {
    question: 'Does the ad have animation?',
    options: [
      { id: 'animated', label: 'Yes, animated with ISI', description: 'Multi-frame animation with scrollable ISI' },
      { id: 'static', label: 'No, static', description: 'Fixed layout' },
    ]
  },
  mrStaticFeature: {
    question: 'Does it open a modal?',
    options: [
      { id: 'modal', label: 'Yes, opens a modal', description: 'Tapping opens a secondary fullscreen ad' },
      { id: 'none', label: 'No — just a static ad', description: 'Simple background with click zones' },
    ]
  },
  intType: {
    question: 'What type of INT ad?',
    options: [
      { id: 'static', label: 'Static', description: 'Single image with click zones' },
      { id: 'animated', label: 'Animated + ISI', description: 'Multi-frame animation with scrollable ISI' },
      { id: 'video', label: 'Video', description: 'Video player ad' },
    ]
  },
  intVideoType: {
    question: 'What kind of video ad?',
    options: [
      { id: 'bg-video', label: 'Background + Video', description: 'Background image with embedded video player overlay' },
      { id: 'video-0', label: 'Video Only (No Buttons)', description: 'Full video, no CTA buttons' },
      { id: 'video-1-2', label: 'Video + 1-2 Buttons', description: 'Video with PI/MG buttons' },
      { id: 'video-3-4', label: 'Video + 3-4 Buttons', description: 'Video with multiple CTA buttons' },
    ]
  },
}

// Map wizard answers to template IDs
function resolveTemplate(answers) {
  var type = answers.adType
  if (type === 'cp') {
    if (answers.cpType === 'static') {
      if (answers.cpStaticFeature === 'isi') return 'cp-static-isi'
      if (answers.cpStaticFeature === 'modal') return 'cp-static-open-mod'
      return 'cp-static'
    }
    // animated
    if (answers.cpAnimatedExpandable === 'yes') return 'cp-animated-isi-expandable'
    return 'cp-animated-isi'
  }
  if (type === 'mr') {
    if (answers.mrType === 'animated') return 'mr-animated-isi'
    if (answers.mrStaticFeature === 'modal') return 'mr-static-open-mod'
    return 'mr-static'
  }
  if (type === 'int') {
    if (answers.intType === 'static') return 'int-static'
    if (answers.intType === 'animated') return 'int-animated-isi'
    if (answers.intVideoType === 'bg-video') return 'int-bg-video-embedded'
    if (answers.intVideoType === 'video-0') return 'int-mod-video-0-buttons'
    if (answers.intVideoType === 'video-1-2') return 'int-mod-video-1-2-buttons'
    if (answers.intVideoType === 'video-3-4') return 'int-mod-video-3-4-buttons'
  }
  return null
}

// Determine which step to show next
function getNextStep(answers) {
  if (!answers.adType) return 'adType'

  if (answers.adType === 'cp') {
    if (!answers.cpType) return 'cpType'
    if (answers.cpType === 'static' && !answers.cpStaticFeature) return 'cpStaticFeature'
    if (answers.cpType === 'animated' && !answers.cpAnimatedExpandable) return 'cpAnimatedExpandable'
    return null // done
  }

  if (answers.adType === 'mr') {
    if (!answers.mrType) return 'mrType'
    if (answers.mrType === 'static' && !answers.mrStaticFeature) return 'mrStaticFeature'
    return null // done (animated goes straight to template)
  }

  if (answers.adType === 'int') {
    if (!answers.intType) return 'intType'
    if (answers.intType === 'video' && !answers.intVideoType) return 'intVideoType'
    return null // done
  }

  return null
}

function TemplateWizard({ onClose }) {
  var [answers, setAnswers] = useState({})
  var [history, setHistory] = useState([])
  var selectTemplate = useProjectStore(function(s) { return s.selectTemplate })

  var currentStep = getNextStep(answers)
  var templateId = currentStep === null ? resolveTemplate(answers) : null
  var matchedTemplate = templateId ? templates.find(function(t) { return t.id === templateId }) : null

  function handleSelect(stepKey, value) {
    var newAnswers = Object.assign({}, answers)
    newAnswers[stepKey] = value
    setHistory(history.concat([answers]))
    setAnswers(newAnswers)
  }

  function handleBack() {
    if (history.length > 0) {
      var prev = history[history.length - 1]
      setAnswers(prev)
      setHistory(history.slice(0, -1))
    }
  }

  function handleUseTemplate() {
    if (matchedTemplate) {
      selectTemplate(matchedTemplate)
    }
  }

  var step = currentStep ? STEPS[currentStep] : null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4">

        {/* Showing a question */}
        {step && (
          <>
            <div className="flex items-center gap-2 mb-1">
              {history.length > 0 && (
                <button onClick={handleBack} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <h2 className="text-lg font-semibold text-gray-900">{step.question}</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Step {history.length + 1}
            </p>

            <div className="space-y-3">
              {step.options.map(function(option) {
                return (
                  <button
                    key={option.id}
                    onClick={function() { handleSelect(currentStep, option.id) }}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                  >
                    {option.icon && (
                      <div className="text-2xl flex-shrink-0">{option.icon}</div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{option.label}</div>
                      <div className="text-sm text-gray-500">{option.description}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* Result — template found */}
        {matchedTemplate && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={handleBack} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-lg font-semibold text-gray-900">Recommended Template</h2>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-blue-50 border-2 border-blue-200">
              <div className="font-semibold text-blue-900 text-lg">{matchedTemplate.name}</div>
              <div className="text-sm text-blue-700 mt-1">{matchedTemplate.description}</div>
              <div className="text-sm text-blue-600 mt-2">
                {matchedTemplate.dimensions.width}x{matchedTemplate.dimensions.height}
                {matchedTemplate.features.length > 0 && (
                  <span> — {matchedTemplate.features.join(', ')}</span>
                )}
              </div>
            </div>

            <button
              onClick={handleUseTemplate}
              className="mt-4 w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              Use This Template
            </button>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-3 w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default TemplateWizard
