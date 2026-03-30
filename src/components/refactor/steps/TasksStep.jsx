import { useState } from 'react'
import { useRefactorStore } from '../../../stores/refactorStore'
import { exportWithContext } from '../exportUtils'

function TasksStep() {
  const tasks = useRefactorStore((s) => s.tasks)
  const updateTaskStatus = useRefactorStore((s) => s.updateTaskStatus)
  const setStep = useRefactorStore((s) => s.setStep)
  const toggleChat = useRefactorStore((s) => s.toggleChat)
  const isChatOpen = useRefactorStore((s) => s.isChatOpen)
  const addChatMessage = useRefactorStore((s) => s.addChatMessage)
  const apiKey = useRefactorStore((s) => s.apiKey)
  const files = useRefactorStore((s) => s.files)
  const assetFiles = useRefactorStore((s) => s.assetFiles)
  const adMeta = useRefactorStore((s) => s.adMeta)
  const importResult = useRefactorStore((s) => s.importResult)
  const [isExportingContext, setIsExportingContext] = useState(false)

  const pendingTasks = tasks.filter(t => t.status === 'pending')
  const doneTasks = tasks.filter(t => t.status === 'done')
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress')

  const handleSendToAI = (task) => {
    if (!apiKey) {
      alert('Please set your API key first (click the AI button in the header)')
      return
    }
    // Open chat and send the task as a message
    if (!isChatOpen) toggleChat()
    addChatMessage('user', `Please help me with this task:\n\n**${task.title}**\n${task.description}\n\nAction needed: ${task.action}`)
    updateTaskStatus(task.id, 'in-progress')
  }

  const handleExportWithContext = async () => {
    setIsExportingContext(true)
    try {
      await exportWithContext(files, assetFiles, tasks, adMeta, importResult)
    } catch (err) {
      alert(`Export failed: ${err.message}`)
    } finally {
      setIsExportingContext(false)
    }
  }

  const handleSendAllToAI = () => {
    if (!apiKey) {
      alert('Please set your API key first (click the AI button in the header)')
      return
    }
    if (pendingTasks.length === 0) return
    if (!isChatOpen) toggleChat()

    const taskList = pendingTasks.map((t, i) =>
      `${i + 1}. **${t.title}** (${t.priority})\n   ${t.description}\n   Action: ${t.action}`
    ).join('\n\n')

    addChatMessage('user', `Please work through these remaining tasks:\n\n${taskList}`)
    pendingTasks.forEach(t => updateTaskStatus(t.id, 'in-progress'))
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tasks</h2>
          <p className="text-gray-500 mt-1">
            {pendingTasks.length} pending • {inProgressTasks.length} in progress • {doneTasks.length} done
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportWithContext}
            disabled={isExportingContext}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            title="Export ad with CLAUDE.md context file for use in VS Code with Claude Code"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {isExportingContext ? 'Exporting...' : 'Export with CLAUDE.md'}
          </button>
        </div>
      </div>

      {/* No tasks */}
      {tasks.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg text-gray-600">No manual tasks required</p>
          <p className="text-sm text-gray-500 mt-1">All issues were handled by auto-refactor</p>
        </div>
      )}

      {/* Pending Tasks */}
      {pendingTasks.length > 0 && (
        <TaskGroup title="Pending" tasks={pendingTasks} onStatusChange={updateTaskStatus} onSendToAI={handleSendToAI} />
      )}

      {/* In Progress Tasks */}
      {inProgressTasks.length > 0 && (
        <TaskGroup title="In Progress" tasks={inProgressTasks} onStatusChange={updateTaskStatus} onSendToAI={handleSendToAI} />
      )}

      {/* Completed Tasks */}
      {doneTasks.length > 0 && (
        <details className="group">
          <summary className="text-sm font-medium text-gray-500 cursor-pointer list-none flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Completed ({doneTasks.length})
          </summary>
          <TaskGroup title="" tasks={doneTasks} onStatusChange={updateTaskStatus} onSendToAI={handleSendToAI} collapsed />
        </details>
      )}
    </div>
  )
}

function TaskGroup({ title, tasks, onStatusChange, onSendToAI, collapsed }) {
  const priorityOrder = { high: 0, critical: 0, medium: 1, low: 2 }
  const sorted = [...tasks].sort((a, b) =>
    (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
  )

  return (
    <div className="space-y-3">
      {title && <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>}
      {sorted.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onStatusChange={onStatusChange}
          onSendToAI={onSendToAI}
          collapsed={collapsed}
        />
      ))}
    </div>
  )
}

function TaskCard({ task, onStatusChange, onSendToAI, collapsed }) {
  const priorityColors = {
    critical: 'border-red-300 bg-red-50',
    high: 'border-red-200 bg-red-50',
    medium: 'border-amber-200 bg-amber-50',
    low: 'border-gray-200 bg-white',
  }

  const priorityBadge = {
    critical: 'bg-red-200 text-red-800',
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className={`rounded-xl border p-4 ${
      collapsed ? 'bg-gray-50 border-gray-200 opacity-60' : priorityColors[task.priority] || priorityColors.medium
    }`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onStatusChange(task.id, task.status === 'done' ? 'pending' : 'done')}
          className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            task.status === 'done'
              ? 'bg-green-500 border-green-500 text-white'
              : task.status === 'in-progress'
              ? 'bg-blue-100 border-blue-400'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          {task.status === 'done' && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {task.status === 'in-progress' && (
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${priorityBadge[task.priority] || priorityBadge.medium}`}>
              {task.priority}
            </span>
            {task.category && (
              <span className="text-xs text-gray-500">{task.category}</span>
            )}
          </div>
          <p className={`font-medium text-gray-900 ${task.status === 'done' ? 'line-through opacity-60' : ''}`}>
            {task.title}
          </p>
          <p className="text-sm text-gray-600 mt-0.5">{task.description}</p>
          {task.action && (
            <p className="text-sm text-blue-600 mt-2 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              {task.action}
            </p>
          )}
        </div>

        {/* AI button removed — export with CLAUDE.md is the workflow */}
      </div>
    </div>
  )
}

export default TasksStep
