import React, { useState, useEffect, useRef } from 'react'
import { decryptFromLocalStorage } from '../lib/secureStorage'

type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

type Model = {
  id: string
  label: string
  sublabel: string
  badge?: string
}

const MODELS: Model[] = [
  { id: 'x-ai/grok-3-beta',                              label: 'Grok 3',          sublabel: 'xAI · Best reasoning',        badge: '★' },
  { id: 'x-ai/grok-3-mini-beta',                         label: 'Grok 3 Mini',     sublabel: 'xAI · Fast & cheap' },
  { id: 'anthropic/claude-sonnet-4-6',                   label: 'Claude Sonnet',   sublabel: 'Anthropic · Balanced' },
  { id: 'anthropic/claude-opus-4-6',                     label: 'Claude Opus',     sublabel: 'Anthropic · Most capable' },
  { id: 'google/gemini-2.0-flash',                       label: 'Gemini 2.0 Flash',sublabel: 'Google · Fast' },
  { id: 'meta-llama/llama-4-maverick',                   label: 'Llama 4 Maverick',sublabel: 'Meta · Open source' },
  { id: 'deepseek/deepseek-r2',                          label: 'DeepSeek R2',     sublabel: 'DeepSeek · Reasoning' },
  { id: 'mistralai/mistral-large',                       label: 'Mistral Large',   sublabel: 'Mistral · European' },
]

const MED_SYSTEM = `You are a concise, high-yield medical tutor helping a student prepare for NEET-PG / USMLE. 
When explaining concepts, use structured formats: mechanisms, mnemonics, clinical pearls, differentials.
Keep responses focused and exam-relevant. Flag high-yield facts clearly.`

const GENERAL_SYSTEM = `You are a helpful, knowledgeable assistant.`

type Props = {
  apiKey: string | null
}

export default function ChatPage({ apiKey: initialKey }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState(() => localStorage.getItem('chatModel') ?? MODELS[0].id)
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState<string | null>(initialKey)
  const [medMode, setMedMode] = useState(() => localStorage.getItem('medMode') === '1')
  const [passphrase, setPassphrase] = useState('')
  const [keyError, setKeyError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    localStorage.setItem('chatModel', model)
  }, [model])

  async function unlockKey() {
    if (!passphrase) return
    setKeyError('')
    try {
      const res = await decryptFromLocalStorage('cloud_api_key', passphrase)
      if (res?.key) {
        setApiKey(res.key)
        setPassphrase('')
      } else {
        setKeyError('Wrong passphrase or no key saved')
      }
    } catch {
      setKeyError('Decryption failed')
    }
  }

  async function send() {
    if (!input.trim() || !apiKey || loading) return

    const userMsg: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    abortRef.current = new AbortController()

    // Build messages with system prompt
    const system: Message = { role: 'system', content: medMode ? MED_SYSTEM : GENERAL_SYSTEM }
    const payload = [system, ...newMessages]

    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'MedCards',
        },
        body: JSON.stringify({
          model,
          messages: payload,
          stream: true,
        }),
        signal: abortRef.current.signal,
      })

      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err?.error?.message ?? `HTTP ${resp.status}`)
      }

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content ?? ''
            assistantContent += delta
            setMessages(prev => {
              const copy = [...prev]
              copy[copy.length - 1] = { role: 'assistant', content: assistantContent }
              return copy
            })
          } catch {}
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠ Error: ${e.message ?? 'Request failed'}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  function cancelStream() {
    abortRef.current?.abort()
    setLoading(false)
  }

  function clearChat() {
    setMessages([])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Auto-resize textarea
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  // ── No key ─────────────────────────────────────────────────────────────

  if (!apiKey) {
    return (
      <div className="chat-unlock">
        <div className="chat-unlock-box">
          <div className="chat-unlock-icon">⬡</div>
          <h2>Unlock Chat</h2>
          <p>Enter your passphrase to decrypt your OpenRouter key, or add a key in Settings first.</p>
          <input
            type="password"
            className="editor-input"
            placeholder="Passphrase"
            value={passphrase}
            onChange={e => setPassphrase(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && unlockKey()}
            autoFocus
          />
          {keyError && <p className="chat-unlock-error">{keyError}</p>}
          <button className="btn-primary" onClick={unlockKey} disabled={!passphrase}>
            Unlock
          </button>
          <p className="chat-unlock-hint">No key yet? Add one in <strong>Settings → Cloud boost</strong>.</p>
        </div>
      </div>
    )
  }

  // ── Chat UI ─────────────────────────────────────────────────────────────

  return (
    <div className="chat-page">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <h2>Chat</h2>
          <label className="chat-med-toggle">
            <input
              type="checkbox"
              checked={medMode}
              onChange={e => {
                setMedMode(e.target.checked)
                localStorage.setItem('medMode', e.target.checked ? '1' : '0')
              }}
            />
            <span>Med Mode</span>
          </label>
        </div>
        <div className="chat-header-right">
          <select
            className="chat-model-select"
            value={model}
            onChange={e => setModel(e.target.value)}
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.badge ? `${m.badge} ` : ''}{m.label} — {m.sublabel}</option>
            ))}
          </select>
          {messages.length > 0 && (
            <button className="btn-ghost chat-clear" onClick={clearChat}>Clear</button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">⬡</div>
            <p>Ask anything — medical concepts, mechanisms, mnemonics, differential diagnoses…</p>
            <div className="chat-starters">
              {(medMode ? [
                'Explain the mechanism of action of beta blockers',
                'What are the causes of elevated anion gap metabolic acidosis?',
                'Mnemonics for cranial nerve examination',
                'High-yield ECG changes in STEMI',
              ] : [
                'Summarise the key concepts from my last lecture',
                'Explain this concept simply',
                'Help me create a study plan',
              ]).map(q => (
                <button key={q} className="chat-starter" onClick={() => { setInput(q); inputRef.current?.focus() }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
            <div className="chat-msg-avatar">
              {msg.role === 'user' ? 'U' : '⬡'}
            </div>
            <div className="chat-msg-content">
              <MarkdownText text={msg.content} />
              {msg.role === 'assistant' && i === messages.length - 1 && loading && (
                <span className="chat-cursor" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="chat-input-wrap">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
            rows={1}
            disabled={loading}
          />
          <div className="chat-input-actions">
            {loading ? (
              <button className="chat-send chat-cancel" onClick={cancelStream}>■ Stop</button>
            ) : (
              <button className="chat-send" onClick={send} disabled={!input.trim()}>
                ↑
              </button>
            )}
          </div>
        </div>
        <div className="chat-model-label">
          {MODELS.find(m => m.id === model)?.label} via OpenRouter
        </div>
      </div>
    </div>
  )
}

// Very lightweight markdown renderer (bold, code, lists)
function MarkdownText({ text }: { text: string }) {
  if (!text) return <span className="chat-thinking">Thinking…</span>

  const lines = text.split('\n')
  return (
    <div className="chat-markdown">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i}>{line.slice(4)}</h3>
        if (line.startsWith('## '))  return <h2 key={i}>{line.slice(3)}</h2>
        if (line.startsWith('# '))   return <h1 key={i}>{line.slice(2)}</h1>
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <li key={i}>{renderInline(line.slice(2))}</li>
        }
        if (line.match(/^\d+\. /)) {
          return <li key={i}>{renderInline(line.replace(/^\d+\. /, ''))}</li>
        }
        if (line.startsWith('```')) return <div key={i} className="chat-code-fence" />
        if (!line.trim()) return <br key={i} />
        return <p key={i}>{renderInline(line)}</p>
      })}
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  // bold **text**, inline `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="chat-code-inline">{part.slice(1, -1)}</code>
    }
    return part
  })
}

