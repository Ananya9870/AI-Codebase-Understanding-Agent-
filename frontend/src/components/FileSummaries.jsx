import { useState } from 'react'
import { Search, FileText, Loader } from 'lucide-react'

const LANG_COLORS = {
  Python: '#3b82f6', JavaScript: '#eab308', TypeScript: '#06b6d4',
  'TypeScript (React)': '#0ea5e9', 'JavaScript (React)': '#f59e0b',
  Go: '#22d3ee', Rust: '#f97316', Java: '#ef4444',
  Ruby: '#ec4899', PHP: '#8b5cf6', 'C#': '#a78bfa',
}

export default function FileSummaries({ data, loading }) {
  const [search, setSearch] = useState('')
  const [domainFilter, setDomainFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)

  if (loading) return <LoadingState />
  if (!data) return <EmptyState />

  const summaries = data.summaries || []
  const domains = [...new Set(summaries.map(s => s.summary?.domain).filter(Boolean))]

  const filtered = summaries.filter(s => {
    const matchSearch = !search ||
      s.path.toLowerCase().includes(search.toLowerCase()) ||
      s.summary?.purpose?.toLowerCase().includes(search.toLowerCase())
    const matchDomain = domainFilter === 'all' || s.summary?.domain === domainFilter
    return matchSearch && matchDomain
  })

  return (
    <div style={styles.container}>
      {/* Search + Filter */}
      <div style={styles.toolbar}>
        <div style={styles.searchBox}>
          <Search size={15} color="#4a6580" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search files or purpose..."
            style={styles.searchInput}
          />
        </div>
        <div style={styles.filters}>
          <DomainBtn label="All" active={domainFilter === 'all'} onClick={() => setDomainFilter('all')} />
          {domains.map(d => (
            <DomainBtn key={d} label={d} active={domainFilter === d} onClick={() => setDomainFilter(d)} />
          ))}
        </div>
      </div>

      <div style={styles.count}>{filtered.length} of {summaries.length} files</div>

      {/* File list */}
      <div style={styles.list}>
        {filtered.map(item => {
          const isOpen = expanded === item.path
          const summary = item.summary || {}
          const langColor = LANG_COLORS[item.language] || '#4a6580'

          return (
            <div key={item.path} style={styles.card}>
              <button
                style={styles.cardHeader}
                onClick={() => setExpanded(isOpen ? null : item.path)}
              >
                <FileText size={14} color="#4a6580" style={{ flexShrink: 0 }} />
                <span style={styles.filePath}>{item.path}</span>
                <span style={{ ...styles.langBadge, background: langColor + '20', color: langColor }}>
                  {item.language}
                </span>
                {summary.domain && (
                  <span style={styles.domainTag}>{summary.domain}</span>
                )}
                <span style={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
              </button>

              {!isOpen && summary.purpose && (
                <div style={styles.purposePreview}>{summary.purpose}</div>
              )}

              {isOpen && (
                <div style={styles.details}>
                  <div style={styles.detailSection}>
                    <span style={styles.detailLabel}>Purpose</span>
                    <p style={styles.detailText}>{summary.purpose}</p>
                  </div>
                  {summary.key_components?.length > 0 && (
                    <div style={styles.detailSection}>
                      <span style={styles.detailLabel}>Key Components</span>
                      <div style={styles.chipList}>
                        {summary.key_components.map(c => (
                          <span key={c} style={styles.chip}>{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {summary.patterns?.length > 0 && (
                    <div style={styles.detailSection}>
                      <span style={styles.detailLabel}>Patterns</span>
                      <div style={styles.chipList}>
                        {summary.patterns.map(p => (
                          <span key={p} style={{ ...styles.chip, background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {summary.dependencies?.length > 0 && (
                    <div style={styles.detailSection}>
                      <span style={styles.detailLabel}>Dependencies</span>
                      <div style={styles.chipList}>
                        {summary.dependencies.map(d => (
                          <span key={d} style={{ ...styles.chip, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DomainBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'rgba(79,195,247,0.1)' : 'transparent',
        border: `1px solid ${active ? '#4fc3f7' : '#1e2d45'}`,
        color: active ? '#4fc3f7' : '#4a6580',
        borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <Loader size={24} color="#4fc3f7" style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#4a6580', marginTop: 12 }}>Loading file summaries...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <p style={{ color: '#4a6580' }}>No summaries available</p>
    </div>
  )
}

const styles = {
  container: { maxWidth: 900, margin: '0 auto' },
  toolbar: { display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  searchBox: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#131c2e', border: '1px solid #1e2d45',
    borderRadius: 8, padding: '8px 14px', flex: 1, minWidth: 200,
  },
  searchInput: { background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: 13, flex: 1, outline: 'none' },
  filters: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  count: { fontSize: 12, color: '#4a6580', marginBottom: 12 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: { background: '#131c2e', border: '1px solid #1e2d45', borderRadius: 8, overflow: 'hidden' },
  cardHeader: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    background: 'transparent', border: 'none', color: 'inherit',
    padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
  },
  filePath: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#c8d8e8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  langBadge: { fontSize: 11, padding: '2px 8px', borderRadius: 4, flexShrink: 0 },
  domainTag: { fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#1e2d45', color: '#4a6580', flexShrink: 0 },
  chevron: { color: '#2a4060', fontSize: 10, flexShrink: 0 },
  purposePreview: { padding: '0 16px 12px 40px', fontSize: 13, color: '#7fa3c4', lineHeight: 1.5 },
  details: { padding: '0 16px 16px', borderTop: '1px solid #1e2d45' },
  detailSection: { padding: '12px 0', borderBottom: '1px solid #0f1520' },
  detailLabel: { fontSize: 11, color: '#4a6580', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 },
  detailText: { fontSize: 13, color: '#c8d8e8', lineHeight: 1.6 },
  chipList: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: { background: 'rgba(79,195,247,0.08)', color: '#7fa3c4', border: '1px solid #1e2d45', borderRadius: 4, padding: '2px 8px', fontSize: 12 },
}