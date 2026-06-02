import { Layers, Box, Cpu, Database, Shield, Globe, Code2, Loader } from 'lucide-react'

const DOMAIN_COLORS = {
  auth: '#a78bfa', payment: '#4ade80', database: '#4fc3f7',
  api: '#fbbf24', ui: '#f87171', config: '#94a3b8',
  utils: '#64748b', other: '#475569',
}

const DOMAIN_ICONS = {
  auth: Shield, database: Database, api: Globe, ui: Code2,
  config: Cpu, payment: Box, utils: Box, other: Box,
}

export default function ArchitectureView({ data, loading }) {
  if (loading) return <LoadingState />
  if (!data) return <EmptyState />

  const techStack = data.tech_stack || {}

  return (
    <div style={styles.container}>
      {/* Overview banner */}
      <div style={styles.overviewCard}>
        <div style={styles.projectType}>{data.project_type || 'Software Project'}</div>
        <p style={styles.overview}>{data.overview}</p>
        {data.data_flow && (
          <div style={styles.dataFlow}>
            <span style={styles.label}>Data Flow:</span> {data.data_flow}
          </div>
        )}
      </div>

      {/* Tech Stack */}
      {Object.keys(techStack).length > 0 && (
        <Section title="Tech Stack" icon={Cpu}>
          <div style={styles.techGrid}>
            {techStack.framework && <TechBadge label="Framework" value={techStack.framework} />}
            {techStack.database && techStack.database !== 'unknown' && (
              <TechBadge label="Database" value={techStack.database} />
            )}
            {techStack.auth_method && techStack.auth_method !== 'unknown' && (
              <TechBadge label="Auth" value={techStack.auth_method} />
            )}
            {(techStack.other || []).map(t => (
              <TechBadge key={t} label="Library" value={t} />
            ))}
          </div>
        </Section>
      )}

      {/* Architecture Layers */}
      {data.layers?.length > 0 && (
        <Section title="Architecture Layers" icon={Layers}>
          <div style={styles.layerList}>
            {data.layers.map((layer, i) => (
              <div key={i} style={styles.layerCard}>
                <div style={styles.layerHeader}>
                  <div style={styles.layerNum}>{i + 1}</div>
                  <div style={styles.layerName}>{layer.name}</div>
                </div>
                <p style={styles.layerDesc}>{layer.description}</p>
                {layer.files?.length > 0 && (
                  <div style={styles.fileList}>
                    {layer.files.slice(0, 5).map(f => (
                      <span key={f} style={styles.fileChip}>{f}</span>
                    ))}
                    {layer.files.length > 5 && (
                      <span style={styles.moreChip}>+{layer.files.length - 5} more</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Modules */}
      {data.modules?.length > 0 && (
        <Section title="Feature Modules" icon={Box}>
          <div style={styles.modulesGrid}>
            {data.modules.map((mod, i) => {
              const color = DOMAIN_COLORS[mod.domain] || DOMAIN_COLORS.other
              const Icon = DOMAIN_ICONS[mod.domain] || Box
              return (
                <div key={i} style={{ ...styles.moduleCard, borderLeftColor: color }}>
                  <div style={styles.moduleHeader}>
                    <Icon size={16} color={color} />
                    <span style={styles.moduleName}>{mod.name}</span>
                    <span style={{ ...styles.domainBadge, background: color + '20', color }}>
                      {mod.domain}
                    </span>
                  </div>
                  <p style={styles.moduleDesc}>{mod.description}</p>
                  {mod.entry_points?.length > 0 && (
                    <div style={styles.fileList}>
                      {mod.entry_points.slice(0, 3).map(f => (
                        <span key={f} style={styles.fileChip}>{f}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Domain breakdown */}
      {data.domain_breakdown && (
        <Section title="Domain Distribution" icon={Globe}>
          <div style={styles.domainGrid}>
            {Object.entries(data.domain_breakdown).map(([domain, count]) => {
              const color = DOMAIN_COLORS[domain] || '#475569'
              return (
                <div key={domain} style={styles.domainItem}>
                  <div style={{ ...styles.domainDot, background: color }} />
                  <span style={styles.domainName}>{domain}</span>
                  <span style={{ ...styles.domainCount, color }}>{count}</span>
                </div>
              )
            })}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({ title, icon: Icon, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <Icon size={16} color="#4fc3f7" />
        <h3 style={styles.sectionTitle}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

function TechBadge({ label, value }) {
  return (
    <div style={styles.techBadge}>
      <span style={styles.techLabel}>{label}</span>
      <span style={styles.techValue}>{value}</span>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={styles.centered}>
      <Loader size={24} color="#4fc3f7" style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#4a6580', marginTop: 12 }}>Generating architecture overview...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={styles.centered}>
      <Layers size={32} color="#1e2d45" />
      <p style={{ color: '#4a6580', marginTop: 12 }}>Architecture data not available</p>
    </div>
  )
}

const styles = {
  container: { maxWidth: 900, margin: '0 auto' },
  overviewCard: {
    background: 'linear-gradient(135deg, #131c2e, #0f1a2e)',
    border: '1px solid #1e2d45', borderRadius: 12, padding: '24px 28px', marginBottom: 28,
  },
  projectType: {
    display: 'inline-block', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
    color: '#4fc3f7', background: 'rgba(79,195,247,0.1)', border: '1px solid rgba(79,195,247,0.2)',
    borderRadius: 4, padding: '2px 10px', marginBottom: 12,
  },
  overview: { fontSize: 16, lineHeight: 1.7, color: '#c8d8e8', marginBottom: 12 },
  dataFlow: { fontSize: 13, color: '#7fa3c4', padding: '10px 14px', background: '#0a0e17', borderRadius: 6 },
  label: { color: '#4a6580', fontWeight: 600 },
  techGrid: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  techBadge: {
    background: '#0f1520', border: '1px solid #1e2d45', borderRadius: 8,
    padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 2,
  },
  techLabel: { fontSize: 11, color: '#4a6580', textTransform: 'uppercase', letterSpacing: '0.08em' },
  techValue: { fontSize: 14, fontWeight: 600, color: '#e2e8f0' },
  section: { marginBottom: 28 },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 600, color: '#c8d8e8' },
  layerList: { display: 'flex', flexDirection: 'column', gap: 10 },
  layerCard: {
    background: '#131c2e', border: '1px solid #1e2d45', borderRadius: 8, padding: '14px 18px',
  },
  layerHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  layerNum: {
    width: 22, height: 22, borderRadius: '50%',
    background: 'rgba(79,195,247,0.15)', color: '#4fc3f7',
    fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  layerName: { fontWeight: 600, fontSize: 14 },
  layerDesc: { fontSize: 13, color: '#7fa3c4', lineHeight: 1.6, marginBottom: 10 },
  modulesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 },
  moduleCard: {
    background: '#131c2e', border: '1px solid #1e2d45', borderLeft: '3px solid #4fc3f7',
    borderRadius: 8, padding: '14px 16px',
  },
  moduleHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  moduleName: { fontWeight: 600, fontSize: 14, flex: 1 },
  domainBadge: { fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 500 },
  moduleDesc: { fontSize: 13, color: '#7fa3c4', lineHeight: 1.6, marginBottom: 10 },
  fileList: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  fileChip: {
    background: '#0a0e17', border: '1px solid #1e2d45', borderRadius: 4,
    padding: '2px 8px', fontSize: 11, color: '#4a6580', fontFamily: "'JetBrains Mono', monospace",
  },
  moreChip: {
    background: 'transparent', border: '1px dashed #1e2d45', borderRadius: 4,
    padding: '2px 8px', fontSize: 11, color: '#2a4060',
  },
  domainGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  domainItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#131c2e', border: '1px solid #1e2d45', borderRadius: 6, padding: '6px 12px',
  },
  domainDot: { width: 8, height: 8, borderRadius: '50%' },
  domainName: { fontSize: 13, color: '#c8d8e8' },
  domainCount: { fontSize: 14, fontWeight: 700, marginLeft: 4 },
  centered: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300 },
}