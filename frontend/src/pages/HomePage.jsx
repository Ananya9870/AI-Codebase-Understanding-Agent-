import { useState, useEffect, useRef } from 'react'
import { analyzeRepo, pollStatus } from '../utils/api.js'
import { GitBranch, Zap, Search, Network, BookOpen, ChevronRight, Loader } from 'lucide-react'

const EXAMPLE_REPOS = [
  'https://github.com/tiangolo/fastapi',
  'https://github.com/pallets/flask',
  'https://github.com/expressjs/express',
]

export default function HomePage({ onRepoReady }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const pollRef = useRef(null)

  const handleSubmit = async (e) => {
    e?.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    setError('')
    setLoading(true)
    setProgress({ status: 'queued', step: 'Starting...', progress: 0 })

    try {
      const { repo_id } = await analyzeRepo(trimmed)
      pollRef.current = setInterval(async () => {
        const status = await pollStatus(repo_id)
        setProgress(status)

        if (status.status === 'complete') {
          clearInterval(pollRef.current)
          setLoading(false)
          setTimeout(() => {
            onRepoReady({ repo_id, repo_name: status.repo_name, github_url: trimmed, stats: status.stats })
          }, 600)
        } else if (status.status === 'error') {
          clearInterval(pollRef.current)
          setLoading(false)
          setError(status.step || 'Analysis failed')
          setProgress(null)
        }
      }, 1500)
    } catch (err) {
      setLoading(false)
      setProgress(null)
      setError(err.message)
    }
  }

  useEffect(() => () => clearInterval(pollRef.current), [])

  return (
    <div style={styles.page}>
      {/* Background grid */}
      <div style={styles.gridBg} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <GitBranch size={22} color="#4fc3f7" />
          <span style={styles.logoText}>CodebaseGit</span>
        </div>
        <span style={styles.badge}>AI-Powered</span>
      </header>

      {/* Hero */}
      <main style={styles.main}>
        <div style={styles.hero}>
          <div style={styles.tagline}>
            <Zap size={14} color="#fbbf24" />
            <span>Understand any codebase in minutes</span>
          </div>

          <h1 style={styles.title}>
            Your AI guide to<br />
            <span style={styles.titleAccent}>any GitHub repo</span>
          </h1>

          <p style={styles.subtitle}>
            Drop a GitHub URL. Get architecture diagrams, dependency graphs,
            file summaries, and answers to any question about the codebase.
          </p>

          {/* Input form */}
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.inputWrapper}>
              <GitBranch size={18} color="#4a6580" style={{ flexShrink: 0 }} />
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                style={styles.input}
                disabled={loading}
              />
              <button type="submit" disabled={loading || !url.trim()} style={styles.btn}>
                {loading ? <Loader size={16} className="spin" /> : 'Analyze'}
                {!loading && <ChevronRight size={16} />}
              </button>
            </div>

            {/* Example repos */}
            <div style={styles.examples}>
              {EXAMPLE_REPOS.map(repo => (
                <button
                  key={repo}
                  type="button"
                  onClick={() => setUrl(repo)}
                  style={styles.exampleBtn}
                  disabled={loading}
                >
                  {repo.split('/').slice(-2).join('/')}
                </button>
              ))}
            </div>
          </form>

          {/* Progress */}
          {progress && (
            <div style={styles.progressCard}>
              <div style={styles.progressHeader}>
                <Loader size={14} color="#4fc3f7" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ color: '#4fc3f7', fontSize: 14 }}>{progress.step}</span>
                <span style={{ marginLeft: 'auto', color: '#4a6580', fontSize: 13 }}>
                  {progress.progress}%
                </span>
              </div>
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${progress.progress}%` }} />
              </div>
              {progress.current_file && (
                <div style={styles.currentFile}>→ {progress.current_file}</div>
              )}
            </div>
          )}

          {error && (
            <div style={styles.error}>
              ⚠ {error}
            </div>
          )}
        </div>

        {/* Feature cards */}
        <div style={styles.features}>
          {FEATURES.map(f => (
            <div key={f.title} style={styles.featureCard}>
              <f.icon size={20} color="#4fc3f7" />
              <div>
                <div style={styles.featureTitle}>{f.title}</div>
                <div style={styles.featureDesc}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #2a4060; }
        input:focus { outline: none; border-color: #4fc3f7 !important; }
        button:hover:not(:disabled) { opacity: 0.85; }
      `}</style>
    </div>
  )
}

const FEATURES = [
  { icon: Network, title: 'Dependency Graph', desc: 'Visual map of how files import each other' },
  { icon: BookOpen, title: 'Architecture Overview', desc: 'High-level layers and modules explained' },
  { icon: Search, title: 'Semantic Q&A', desc: 'Ask anything: "Where is auth handled?"' },
  { icon: GitBranch, title: 'File Summaries', desc: 'Purpose of every file in plain English' },
]

const styles = {
  page: { minHeight: '100vh', position: 'relative', overflow: 'hidden' },
  gridBg: {
    position: 'fixed', inset: 0,
    backgroundImage: `linear-gradient(rgba(79,195,247,0.03) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(79,195,247,0.03) 1px, transparent 1px)`,
    backgroundSize: '40px 40px',
    pointerEvents: 'none',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 40px', borderBottom: '1px solid #1e2d45',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10 },
  logoText: { fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: '#e2e8f0' },
  badge: {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
    color: '#4fc3f7', background: 'rgba(79,195,247,0.1)',
    border: '1px solid rgba(79,195,247,0.3)', borderRadius: 20, padding: '3px 10px',
  },
  main: { maxWidth: 800, margin: '0 auto', padding: '60px 24px 80px' },
  hero: { textAlign: 'center', marginBottom: 60 },
  tagline: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    color: '#fbbf24', fontSize: 13, fontWeight: 500,
    background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
    borderRadius: 20, padding: '4px 12px', marginBottom: 24,
  },
  title: { fontSize: 52, fontWeight: 700, lineHeight: 1.15, marginBottom: 20, letterSpacing: '-0.02em' },
  titleAccent: { color: '#4fc3f7' },
  subtitle: { fontSize: 17, color: '#7fa3c4', maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.7 },
  form: { maxWidth: 600, margin: '0 auto' },
  inputWrapper: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: '#131c2e', border: '1px solid #1e2d45',
    borderRadius: 10, padding: '12px 16px', marginBottom: 12,
    transition: 'border-color 0.2s',
  },
  input: {
    flex: 1, background: 'transparent', border: 'none', color: '#e2e8f0',
    fontSize: 15, fontFamily: "'JetBrains Mono', monospace",
  },
  btn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#4fc3f7', color: '#0a0e17',
    border: 'none', borderRadius: 7, padding: '8px 18px',
    fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.2s',
    whiteSpace: 'nowrap',
  },
  examples: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  exampleBtn: {
    background: 'transparent', border: '1px solid #1e2d45', color: '#4a6580',
    borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
    fontFamily: "'JetBrains Mono', monospace", transition: 'all 0.2s',
  },
  progressCard: {
    marginTop: 24, background: '#131c2e', border: '1px solid #1e2d45',
    borderRadius: 10, padding: '16px 20px',
  },
  progressHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  progressBar: { height: 4, background: '#1e2d45', borderRadius: 2 },
  progressFill: { height: '100%', background: '#4fc3f7', borderRadius: 2, transition: 'width 0.5s ease' },
  currentFile: { marginTop: 8, fontSize: 11, color: '#4a6580', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  error: {
    marginTop: 16, padding: '12px 16px', background: 'rgba(248,113,113,0.1)',
    border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8,
    color: '#f87171', fontSize: 14,
  },
  features: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 },
  featureCard: {
    display: 'flex', gap: 14, alignItems: 'flex-start',
    background: '#131c2e', border: '1px solid #1e2d45', borderRadius: 10, padding: '18px 20px',
  },
  featureTitle: { fontWeight: 600, marginBottom: 4, fontSize: 15 },
  featureDesc: { color: '#7fa3c4', fontSize: 13, lineHeight: 1.5 },
}