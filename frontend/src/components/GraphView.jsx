import { useEffect, useRef, useState } from 'react'
import { Loader, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

export default function GraphView({ data, loading }) {
  const svgRef = useRef(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!data || !svgRef.current) return
    renderGraph(data, svgRef.current, setSelectedNode, filter)
  }, [data, filter])

  if (loading) return <LoadingState />
  if (!data) return <EmptyState />

  const languages = [...new Set(data.nodes.map(n => n.language).filter(Boolean))]

  return (
    <div style={styles.container}>
      {/* Controls */}
      <div style={styles.controls}>
        <div style={styles.filterGroup}>
          <button
            style={{ ...styles.filterBtn, ...(filter === 'all' ? styles.filterActive : {}) }}
            onClick={() => setFilter('all')}
          >All</button>
          {languages.slice(0, 6).map(lang => (
            <button
              key={lang}
              style={{ ...styles.filterBtn, ...(filter === lang ? styles.filterActive : {}) }}
              onClick={() => setFilter(lang)}
            >
              {lang}
            </button>
          ))}
        </div>
        <div style={styles.statPills}>
          <StatPill label="Nodes" value={data.stats.total_nodes} />
          <StatPill label="Edges" value={data.stats.total_edges} />
          <StatPill label="Clusters" value={data.stats.components} />
        </div>
      </div>

      {/* Graph canvas */}
      <div style={styles.graphWrapper}>
        <svg ref={svgRef} style={styles.svg} />
        <div style={styles.hint}>Drag to pan • Scroll to zoom • Click node for details</div>
      </div>

      {/* Node detail panel */}
      {selectedNode && (
        <div style={styles.detailPanel}>
          <div style={styles.detailHeader}>
            <span style={styles.detailPath}>{selectedNode.id}</span>
            <button style={styles.closeBtn} onClick={() => setSelectedNode(null)}>×</button>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Language</span>
            <span style={styles.detailValue}>{selectedNode.language}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Imported by</span>
            <span style={styles.detailValue}>{selectedNode.in_degree} files</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Imports</span>
            <span style={styles.detailValue}>{selectedNode.out_degree} files</span>
          </div>
          {selectedNode.is_hub && (
            <div style={styles.hubBadge}>⭐ Core module — imported by many files</div>
          )}
        </div>
      )}

      {/* Most imported */}
      {data.stats.most_imported?.length > 0 && (
        <div style={styles.topFiles}>
          <h4 style={styles.topTitle}>Most Imported Files (Core Modules)</h4>
          <div style={styles.topList}>
            {data.stats.most_imported.map(f => (
              <div key={f.id} style={styles.topItem}>
                <span style={styles.topPath}>{f.id}</span>
                <span style={styles.topCount}>{f.in_degree} imports</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function renderGraph(data, svgEl, onNodeClick, langFilter) {
  // Dynamically import d3
  import('d3').then(d3 => {
    const width = svgEl.clientWidth || 900
    const height = 480

    d3.select(svgEl).selectAll('*').remove()

    const filteredNodes = langFilter === 'all'
      ? data.nodes
      : data.nodes.filter(n => n.language === langFilter)
    const filteredIds = new Set(filteredNodes.map(n => n.id))
    const filteredEdges = data.edges.filter(e => filteredIds.has(e.source) && filteredIds.has(e.target))

    const svg = d3.select(svgEl)
      .attr('width', width)
      .attr('height', height)
      .call(d3.zoom().scaleExtent([0.1, 4]).on('zoom', e => g.attr('transform', e.transform)))

    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#2a3f5f')

    const g = svg.append('g')

    const sim = d3.forceSimulation(filteredNodes)
      .force('link', d3.forceLink(filteredEdges).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(18))

    const link = g.append('g').selectAll('line')
      .data(filteredEdges)
      .join('line')
      .attr('stroke', '#1e2d45')
      .attr('stroke-width', 1)
      .attr('marker-end', 'url(#arrow)')

    const node = g.append('g').selectAll('circle')
      .data(filteredNodes)
      .join('circle')
      .attr('r', d => d.is_hub ? 10 : 6)
      .attr('fill', d => d.is_hub ? '#4fc3f7' : '#1a2540')
      .attr('stroke', d => d.is_hub ? '#4fc3f7' : '#2a3f5f')
      .attr('stroke-width', d => d.is_hub ? 2 : 1)
      .style('cursor', 'pointer')
      .on('click', (e, d) => onNodeClick(d))
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
        .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
      )

    const label = g.append('g').selectAll('text')
      .data(filteredNodes.filter(n => n.is_hub))
      .join('text')
      .text(d => d.id.split('/').pop())
      .attr('font-size', 9)
      .attr('fill', '#4fc3f7')
      .attr('dx', 12)
      .attr('dy', 4)
      .style('pointer-events', 'none')
      .style('font-family', "'JetBrains Mono', monospace")

    sim.on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
      node.attr('cx', d => d.x).attr('cy', d => d.y)
      label.attr('x', d => d.x).attr('y', d => d.y)
    })
  })
}

function StatPill({ label, value }) {
  return (
    <div style={styles.statPill}>
      <span style={{ color: '#4fc3f7', fontWeight: 700 }}>{value}</span>
      <span style={{ color: '#4a6580', fontSize: 12 }}> {label}</span>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={styles.centered}>
      <Loader size={24} color="#4fc3f7" style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#4a6580', marginTop: 12 }}>Building dependency graph...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={styles.centered}>
      <p style={{ color: '#4a6580' }}>Graph not available</p>
    </div>
  )
}

const styles = {
  container: { maxWidth: 1000, margin: '0 auto' },
  controls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  filterGroup: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  filterBtn: {
    background: '#131c2e', border: '1px solid #1e2d45', color: '#4a6580',
    borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
  },
  filterActive: { background: 'rgba(79,195,247,0.1)', borderColor: '#4fc3f7', color: '#4fc3f7' },
  statPills: { display: 'flex', gap: 16 },
  statPill: { fontSize: 13 },
  graphWrapper: {
    background: '#0a0e17', border: '1px solid #1e2d45', borderRadius: 12,
    position: 'relative', overflow: 'hidden', marginBottom: 20,
  },
  svg: { width: '100%', height: 480, display: 'block' },
  hint: {
    position: 'absolute', bottom: 12, right: 16,
    fontSize: 11, color: '#2a4060',
  },
  detailPanel: {
    background: '#131c2e', border: '1px solid #2a3f5f', borderRadius: 10,
    padding: '16px 20px', marginBottom: 20,
  },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  detailPath: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#4fc3f7' },
  closeBtn: { background: 'transparent', border: 'none', color: '#4a6580', cursor: 'pointer', fontSize: 18, lineHeight: 1 },
  detailRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1e2d45' },
  detailLabel: { fontSize: 13, color: '#4a6580' },
  detailValue: { fontSize: 13, color: '#e2e8f0', fontWeight: 500 },
  hubBadge: { marginTop: 10, fontSize: 12, color: '#fbbf24', background: 'rgba(251,191,36,0.08)', borderRadius: 6, padding: '6px 12px' },
  topFiles: { background: '#131c2e', border: '1px solid #1e2d45', borderRadius: 10, padding: '16px 20px' },
  topTitle: { fontSize: 13, color: '#7fa3c4', fontWeight: 600, marginBottom: 12 },
  topList: { display: 'flex', flexDirection: 'column', gap: 6 },
  topItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #0f1520' },
  topPath: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#c8d8e8' },
  topCount: { fontSize: 12, color: '#4fc3f7', fontWeight: 600 },
  centered: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300 },
}