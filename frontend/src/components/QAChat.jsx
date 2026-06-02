import { useState, useRef, useEffect } from 'react'
import { askQuestion } from '../utils/api.js'
import { Send, Loader, MessageSquare, FileCode } from 'lucide-react'

export default function QAChat({ repoId, suggestedQuestions }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const question = (text || input).trim()
    if (!question || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: question }])
    setLoading(true)

    try {
      const result = await askQuestion(repoId, question)
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: result.answer,
        sources: result.sources,
        confidence: result.confidence,
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Error: ${err.message}`,
        sources: [],
        confidence: 'low',
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.chatArea}>
        {messages.length === 0 ? (
          <WelcomeState
            suggestedQuestions={suggestedQuestions}
            onSelect={sendMessage}
          />
        ) : (
          <div style={styles.messages}>
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            {loading && <ThinkingBubble />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={styles.inputArea}>
        {messages.length > 0 && suggestedQuestions.length > 0 && (
          <div style={styles.quickSuggestions}>
            {suggestedQuestions.slice(0, 3).map(q => (
              <button key={q} style={styles.quickBtn} onClick={() => sendMessage(q)} disabled={loading}>
                {q}
              </button>
            ))}
          </div>
        )}
        <div style={styles.inputRow}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask anything about the codebase..."
            style={styles.input}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={styles.sendBtn}
          >
            {loading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } input::placeholder { color: #2a4060; } input:focus { outline: none; }`}</style>
    </div>
  )
}

function WelcomeState({ suggestedQuestions, onSelect }) {
  return (
    <div style={styles.welcome}>
      <MessageSquare size={32} color="#1e2d45" style={{ marginBottom: 16 }} />
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Ask about the codebase</h3>
      <p style={{ color: '#4a6580', fontSize: 14, marginBottom: 28 }}>
        I can answer questions about architecture, specific features, or any file.
      </p>
      {suggestedQuestions.length > 0 && (
        <div style={styles.suggestions}>
          <div style={{ fontSize: 12, color: '#4a6580', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Try asking...
          </div>
          {suggestedQuestions.map(q => (
            <button key={q} style={styles.suggestionBtn} onClick={() => onSelect(q)}>
              <span style={{ color: '#4fc3f7' }}>→</span> {q}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ ...styles.messageBubble, ...(isUser ? styles.userBubble : styles.aiBubble) }}>
      {!isUser && (
        <div style={styles.aiLabel}>
          <MessageSquare size={12} color="#4fc3f7" />
          <span>AI Answer</span>
          {msg.confidence && (
            <span style={{
              ...styles.confidenceBadge,
              color: msg.confidence === 'high' ? '#4ade80' : msg.confidence === 'medium' ? '#fbbf24' : '#f87171',
            }}>
              {msg.confidence} confidence
            </span>
          )}
        </div>
      )}

      <p style={{ ...styles.messageText, ...(isUser ? { color: '#0a0e17' } : {}) }}>
        {msg.text}
      </p>

      {msg.sources?.length > 0 && (
        <div style={styles.sources}>
          <div style={styles.sourcesLabel}>
            <FileCode size={11} /> Referenced files:
          </div>
          {msg.sources.map(s => (
            <div key={s.path} style={styles.sourceItem}>
              <span style={styles.sourcePath}>{s.path}</span>
              <span style={styles.sourceScore}>{Math.round(s.relevance * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ThinkingBubble() {
  return (
    <div style={{ ...styles.messageBubble, ...styles.aiBubble }}>
      <div style={styles.aiLabel}><MessageSquare size={12} color="#4fc3f7" /><span>Thinking...</span></div>
      <div style={styles.dots}>
        <span style={{ ...styles.dot, animationDelay: '0ms' }}>●</span>
        <span style={{ ...styles.dot, animationDelay: '200ms' }}>●</span>
        <span style={{ ...styles.dot, animationDelay: '400ms' }}>●</span>
      </div>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
        .dot { animation: pulse 1.2s infinite; }
      `}</style>
    </div>
  )
}

const styles = {
  container: {
    maxWidth: 800, margin: '0 auto',
    display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)',
  },
  chatArea: { flex: 1, overflow: 'auto', marginBottom: 16 },
  messages: { display: 'flex', flexDirection: 'column', gap: 16 },
  messageBubble: { maxWidth: '85%', borderRadius: 12, padding: '14px 16px' },
  userBubble: { alignSelf: 'flex-end', background: '#4fc3f7', color: '#0a0e17' },
  aiBubble: { alignSelf: 'flex-start', background: '#131c2e', border: '1px solid #1e2d45' },
  aiLabel: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, color: '#4fc3f7' },
  confidenceBadge: { marginLeft: 'auto', fontSize: 11 },
  messageText: { fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' },
  sources: { marginTop: 12, borderTop: '1px solid #1e2d45', paddingTop: 10 },
  sourcesLabel: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#4a6580', marginBottom: 6 },
  sourceItem: { display: 'flex', justifyContent: 'space-between', padding: '3px 0' },
  sourcePath: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#7fa3c4' },
  sourceScore: { fontSize: 11, color: '#4fc3f7' },
  dots: { display: 'flex', gap: 4, color: '#4a6580', fontSize: 10 },
  dot: { display: 'inline-block' },
  welcome: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center' },
  suggestions: { width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 8 },
  suggestionBtn: {
    textAlign: 'left', background: '#131c2e', border: '1px solid #1e2d45',
    color: '#c8d8e8', borderRadius: 8, padding: '12px 16px',
    fontSize: 14, cursor: 'pointer', display: 'flex', gap: 10,
    transition: 'border-color 0.2s',
  },
  inputArea: { borderTop: '1px solid #1e2d45', paddingTop: 16 },
  quickSuggestions: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  quickBtn: {
    background: 'transparent', border: '1px solid #1e2d45', color: '#4a6580',
    borderRadius: 20, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
    transition: 'all 0.15s',
  },
  inputRow: { display: 'flex', gap: 10 },
  input: {
    flex: 1, background: '#131c2e', border: '1px solid #1e2d45', color: '#e2e8f0',
    borderRadius: 10, padding: '12px 16px', fontSize: 14, outline: 'none',
  },
  sendBtn: {
    background: '#4fc3f7', border: 'none', color: '#0a0e17',
    borderRadius: 10, width: 46, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
}