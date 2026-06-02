import { useState, useEffect } from 'react'
import { getArchitecture, getGraph, getSummaries, getSuggestedQuestions } from '../utils/api.js'
import { ArrowLeft, GitBranch, Layers, Network, FileText, MessageSquare, ExternalLink } from 'lucide-react'
import ArchitectureView from '../components/ArchitectureView.jsx'
import GraphView from '../components/GraphView.jsx'
import FileSummaries from '../components/FileSummaries.jsx'
import QAChat from '../components/QAChat.jsx'

const TABS = [
  { id: 'architecture', label: 'Architecture', icon: Layers },
  { id: 'graph', label: 'Dependency Graph', icon: Network },
  { id: 'files', label: 'File Summaries', icon: FileText },
  { id: 'qa', label: 'Ask Questions', icon: MessageSquare },
]

export default function AnalysisPage({ repo, onBack }) {
  const [activeTab, setActiveTab] = useState('architecture')
  const [architecture, setArchitecture] = useState(null)
  const [graph, setGraph] = useState(null)
  const [summaries, setSummaries] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loadingData, setLoadingData] = useState({})

  useEffect(() => {
    loadTab('architecture')
    loadTab('graph')
    loadTab('files')
    getSuggestedQuestions(repo.repo_id).then(d => setQuestions(d.questions || []))
  }, [repo.repo_id])

  const loadTab = async (tab) => {
    if (tab === 'architecture' && !architecture) {
      setLoadingData(p => ({ ...p, architecture: true }))
      try { setArchitecture(await getArchitecture(repo.repo_id)) } catch {}
      setLoadingData(p => ({ ...p, architecture: false }))
    }
    if (tab === 'graph' && !graph) {
      setLoadingData(p => ({ ...p, graph: true }))
      try { setGraph(await getGraph(repo.repo_id)) } catch {}
      setLoadingData(p => ({ ...p, graph: false }))
    }
    if (tab === 'files' && !summaries) {
      setLoadingData(p => ({ ...p, files: true }))
      try { setSummaries(await getSummaries(repo.repo_id)) } catch {}
      setLoadingData(p => ({ ...p, files: false }))
    }
  }

  const handleTabClick = (tabId) => {
    setActiveTab(tabId)
    loadTab(tabId)
  }

  return (
    <div style={styles.page}>
      {/* Top bar */}
      <header style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={styles.repoInfo}>
          <GitBranch size={16} color="#4fc3f7" />
          <span style={styles.repoName}>{repo.repo_name}</span>
          <a href={repo.github_url} target="_blank" rel="noopener noreferrer" style={styles.externalLink}>
            <ExternalLink size={13} />
          </a>
        </div>
        {repo.stats && (
          <div style={styles.stats}>
            <Stat label="Files" value={repo.stats.code_files} />
            <Stat label="Languages" value={Object.keys(repo.stats.languages || {}).length} />
          </div>
        )}
      </header>

      {/* Tabs */}
      <nav style={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={styles.content}>
        {activeTab === 'architecture' && (
          <ArchitectureView data={architecture} loading={loadingData.architecture} />
        )}
        {activeTab === 'graph' && (
          <GraphView data={graph} loading={loadingData.graph} />
        )}
        {activeTab === 'files' && (
          <FileSummaries data={summaries} loading={loadingData.files} />
        )}
        {activeTab === 'qa' && (
          <QAChat repoId={repo.repo_id} suggestedQuestions={questions} />
        )}
      </main>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#4fc3f7', fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 11, color: '#4a6580' }}>{label}</div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: {
    display: 'flex', alignItems: 'center', gap: 16, padding: '14px 32px',
    borderBottom: '1px solid #1e2d45', background: '#0f1520',
  },
  backBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'transparent', border: '1px solid #1e2d45', color: '#7fa3c4',
    borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer',
  },
  repoInfo: { display: 'flex', alignItems: 'center', gap: 8, flex: 1 },
  repoName: { fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600 },
  externalLink: { color: '#4a6580', display: 'flex', alignItems: 'center' },
  stats: { display: 'flex', gap: 24 },
  tabs: {
    display: 'flex', gap: 4, padding: '0 24px', background: '#0f1520',
    borderBottom: '1px solid #1e2d45',
  },
  tab: {
    display: 'flex', alignItems: 'center', gap: 7,
    background: 'transparent', border: 'none', color: '#4a6580',
    padding: '12px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
    borderBottom: '2px solid transparent', transition: 'all 0.15s',
  },
  tabActive: { color: '#4fc3f7', borderBottomColor: '#4fc3f7' },
  content: { flex: 1, padding: '24px 32px', overflow: 'auto' },
}