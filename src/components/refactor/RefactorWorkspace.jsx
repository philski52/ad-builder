import { useRefactorStore } from '../../stores/refactorStore'
import OverviewStep from './steps/OverviewStep'
import RefactorStep from './steps/RefactorStep'
import TasksStep from './steps/TasksStep'

const STEPS = [
  { id: 'overview', label: 'Overview', icon: OverviewIcon },
  { id: 'refactor', label: 'Refactor', icon: RefactorIcon },
  { id: 'tasks', label: 'Tasks & Export', icon: TasksIcon },
]

function RefactorWorkspace() {
  const currentStep = useRefactorStore((s) => s.currentStep)
  const setStep = useRefactorStore((s) => s.setStep)
  const closeRefactor = useRefactorStore((s) => s.closeRefactor)
  const adMeta = useRefactorStore((s) => s.adMeta)
  const tasks = useRefactorStore((s) => s.tasks)
  const importResult = useRefactorStore((s) => s.importResult)

  const pendingTaskCount = tasks.filter(t => t.status === 'pending').length
  const totalFixes = importResult?.appliedFixes?.length || 0

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={closeRefactor}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            title="Back to home"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {adMeta.projectName || 'Ad Refactor'}
            </h1>
            <p className="text-xs text-gray-500">
              {adMeta.templateType?.toUpperCase()} • {adMeta.dimensions?.width}x{adMeta.dimensions?.height}
              {adMeta.isGWD && ' • GWD'}
            </p>
          </div>
        </div>

        {/* Stepper */}
        <nav className="flex items-center gap-1">
          {STEPS.map((step, i) => {
            const isActive = currentStep === step.id
            const stepIndex = STEPS.findIndex(s => s.id === currentStep)
            const isCompleted = i < stepIndex
            const Icon = step.icon

            return (
              <div key={step.id} className="flex items-center">
                {i > 0 && (
                  <div className={`w-8 h-px mx-1 ${isCompleted ? 'bg-green-400' : 'bg-gray-300'}`} />
                )}
                <button
                  onClick={() => setStep(step.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                      : isCompleted
                      ? 'text-green-700 hover:bg-green-50'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" completed={isCompleted} />
                  {step.label}
                  {step.id === 'tasks' && pendingTaskCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-amber-500 rounded-full">
                      {pendingTaskCount}
                    </span>
                  )}
                  {step.id === 'refactor' && totalFixes > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-green-500 rounded-full">
                      {totalFixes}
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </nav>

        {/* Spacer to balance header layout */}
        <div className="w-20"></div>
      </header>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {currentStep === 'overview' && <OverviewStep />}
        {currentStep === 'refactor' && <RefactorStep />}
        {currentStep === 'tasks' && <TasksStep />}
      </div>
    </div>
  )
}

// --- Step Icons ---

function OverviewIcon({ className, completed }) {
  if (completed) return <CheckIcon className={className} />
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

function RefactorIcon({ className, completed }) {
  if (completed) return <CheckIcon className={className} />
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function TasksIcon({ className, completed }) {
  if (completed) return <CheckIcon className={className} />
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )
}

function EditorIcon({ className, completed }) {
  if (completed) return <CheckIcon className={className} />
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  )
}

function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

export default RefactorWorkspace
