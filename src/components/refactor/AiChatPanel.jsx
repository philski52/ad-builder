import { useState, useRef, useEffect } from 'react'
import { useRefactorStore } from '../../stores/refactorStore'

const PROVIDER_MODELS = {
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', desc: 'Fast & cheap ($0.80/1M in)' },
    { id: 'claude-sonnet-4-20250514', label: 'Sonnet 4', desc: 'Balanced ($3/1M in)' },
    { id: 'claude-opus-4-20250514', label: 'Opus 4', desc: 'Most capable ($15/1M in)' },
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Fast & cheap ($0.15/1M in)' },
    { id: 'gpt-4o', label: 'GPT-4o', desc: 'Balanced ($2.50/1M in)' },
    { id: 'o3', label: 'o3', desc: 'Strongest reasoning ($10/1M in)' },
  ],
}

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
}

function AiChatPanel() {
  const chatHistory = useRefactorStore((s) => s.chatHistory)
  const addChatMessage = useRefactorStore((s) => s.addChatMessage)
  const clearChat = useRefactorStore((s) => s.clearChat)
  const toggleChat = useRefactorStore((s) => s.toggleChat)
  const aiProvider = useRefactorStore((s) => s.aiProvider)
  const setAiProvider = useRefactorStore((s) => s.setAiProvider)
  const apiKey = useRefactorStore((s) => s.apiKey)
  const setApiKey = useRefactorStore((s) => s.setApiKey)
  const aiModel = useRefactorStore((s) => s.aiModel)
  const setAiModel = useRefactorStore((s) => s.setAiModel)
  const files = useRefactorStore((s) => s.files)
  const updateFile = useRefactorStore((s) => s.updateFile)
  const tasks = useRefactorStore((s) => s.tasks)
  const updateTaskStatus = useRefactorStore((s) => s.updateTaskStatus)
  const adMeta = useRefactorStore((s) => s.adMeta)

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(!apiKey)
  const [providerInput, setProviderInput] = useState(aiProvider)
  const [keyInput, setKeyInput] = useState(apiKey)
  const [modelInput, setModelInput] = useState(aiModel)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  // When provider changes, reset model to that provider's default
  const handleProviderChange = (newProvider) => {
    setProviderInput(newProvider)
    setModelInput(DEFAULT_MODELS[newProvider])
  }

  const handleSaveSettings = () => {
    setAiProvider(providerInput)
    setApiKey(keyInput.trim())
    setAiModel(modelInput)
    setShowSettings(false)
  }

  const buildSystemPrompt = () => {
    const fileList = Object.keys(files).join(', ')
    const pendingTasks = tasks.filter(t => t.status !== 'done')
      .map(t => `- [${t.priority}] ${t.title}: ${t.description}`)
      .join('\n')

    return `You are an ad refactoring assistant for PatientPoint/IXR digital signage. You help developers refactor pre-built HTML/CSS/JS advertising packages for BrightSign devices running Chrome 69.

## Device Constraints
- ES5 only (no const/let, arrow functions, template literals, async/await)
- Must use TweenMax 2.0.1 (TimelineMax syntax, NOT gsap.timeline)
- jQuery 2.1.4 required
- No Web Components, no CDN scripts (offline devices)
- ISI must use outerMostDiv/innerMostDiv/isi-controls structure
- Click handlers must use appHost methods (openExternalLinkFull, requestPDFView) with typeof appHost !== 'undefined' check

## Current Ad
- Type: ${adMeta.templateType?.toUpperCase() || 'Unknown'}
- Dimensions: ${adMeta.dimensions?.width}x${adMeta.dimensions?.height}
- Files: ${fileList}

## Remaining Tasks
${pendingTasks || 'None'}

## Instructions
- When you modify code, wrap changes in a code block with the filename as a comment on the first line, e.g.:
\`\`\`html
<!-- FILE: index.html -->
...full file content...
\`\`\`
- Always provide the COMPLETE file content, not just snippets
- Follow the device specifications strictly
- Explain what you changed and why`
  }

  const callAnthropic = async (messages, systemPrompt) => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: aiModel,
        max_tokens: 8192,
        system: systemPrompt,
        messages,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `Anthropic API error: ${response.status}`)
    }

    const data = await response.json()
    return data.content?.[0]?.text || 'No response'
  }

  const callOpenAI = async (messages, systemPrompt) => {
    // OpenAI uses system message in the messages array
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: aiModel,
        max_tokens: 8192,
        messages: openaiMessages,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || 'No response'
  }

  const handleSend = async () => {
    const message = input.trim()
    if (!message || isLoading) return
    if (!apiKey) {
      setShowSettings(true)
      return
    }

    setInput('')
    addChatMessage('user', message)
    setIsLoading(true)

    try {
      // Build messages array from chat history
      const messages = chatHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
      messages.push({ role: 'user', content: message })

      // Include current file contents as context
      const fileContext = Object.entries(files)
        .map(([path, content]) => `--- ${path} ---\n${content}`)
        .join('\n\n')

      // Prepend file context to the first user message
      if (messages.length === 1) {
        messages[0].content = `Here are the current files:\n\n${fileContext}\n\n---\n\n${message}`
      }

      const systemPrompt = buildSystemPrompt()
      const assistantMessage = aiProvider === 'openai'
        ? await callOpenAI(messages, systemPrompt)
        : await callAnthropic(messages, systemPrompt)

      addChatMessage('assistant', assistantMessage)

      // Auto-extract file updates from the response
      extractAndApplyFileUpdates(assistantMessage)
    } catch (err) {
      addChatMessage('assistant', `Error: ${err.message}`)
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const extractAndApplyFileUpdates = (message) => {
    // Look for code blocks with FILE: comments
    const codeBlockRegex = /```(?:html|javascript|css|js)\n(?:<!--\s*FILE:\s*(.+?)\s*-->|\/\/\s*FILE:\s*(.+?)\s*|\/\*\s*FILE:\s*(.+?)\s*\*\/)\n([\s\S]*?)```/g

    let match
    while ((match = codeBlockRegex.exec(message)) !== null) {
      const filePath = (match[1] || match[2] || match[3]).trim()
      const content = match[4].trim()

      // Only update files that exist in our file system
      if (files[filePath] !== undefined) {
        updateFile(filePath, content)
      }
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Get friendly model name for the header
  const currentModelLabel = PROVIDER_MODELS[aiProvider]
    ?.find(m => m.id === aiModel)?.label || aiModel

  // Settings view
  if (showSettings) {
    const models = PROVIDER_MODELS[providerInput] || []

    return (
      <div className="h-full flex flex-col bg-white">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">AI Settings</h3>
          <button onClick={toggleChat} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Provider toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Provider
            </label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => handleProviderChange('anthropic')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  providerInput === 'anthropic'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Anthropic
              </button>
              <button
                onClick={() => handleProviderChange('openai')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                  providerInput === 'openai'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                OpenAI
              </button>
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {providerInput === 'anthropic' ? 'Anthropic' : 'OpenAI'} API Key
            </label>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={providerInput === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Stored locally in your browser. Never sent anywhere except the {providerInput === 'anthropic' ? 'Anthropic' : 'OpenAI'} API.
            </p>
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model
            </label>
            <select
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.desc}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={!keyInput.trim()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            Save & Continue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          AI
          <span className="text-xs font-normal text-gray-400">{currentModelLabel}</span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {chatHistory.length > 0 && (
            <button
              onClick={clearChat}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Clear chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button onClick={toggleChat} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.length === 0 && (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-sm text-gray-500">Ask the AI to help with refactoring tasks</p>
            <p className="text-xs text-gray-400 mt-1">It can see your current files and make edits directly</p>
          </div>
        )}

        {chatHistory.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800'
            }`}>
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              <p className={`text-[10px] mt-1 ${
                msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'
              }`}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-xl px-4 py-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI for help..."
            rows={1}
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none max-h-32"
            style={{ minHeight: '38px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default AiChatPanel
