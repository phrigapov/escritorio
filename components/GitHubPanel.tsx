'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface GHRepo {
  name: string
  fullName: string
  description: string
  stars: number
  forks: number
  openIssues: number
  defaultBranch: string
  updatedAt: string
}
interface GHIssue {
  number: number
  title: string
  state: string
  labels: { name: string; color: string }[]
  author: string
  createdAt: string
  url: string
}
interface GHPull {
  number: number
  title: string
  state: string
  draft: boolean
  author: string
  branch: string
  createdAt: string
  url: string
}
interface GHCommit {
  sha: string
  message: string
  author: string
  date: string
  url: string
}
interface GHData {
  repo: GHRepo
  issues: GHIssue[]
  pulls: GHPull[]
  commits: GHCommit[]
}

type Tab = 'overview' | 'issues' | 'pulls' | 'commits'

// ── helpers ───────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d atrás`
  return `${Math.floor(d / 30)}m atrás`
}

function LabelBadge({ name, color }: { name: string; color: string }) {
  const fg = parseInt(color, 16) > 0x888888 ? '#111' : '#fff'
  return (
    <span style={{
      background: `#${color}`,
      color: fg,
      fontSize: 9,
      padding: '1px 6px',
      borderRadius: 10,
      fontWeight: 600,
      marginRight: 3,
    }}>
      {name}
    </span>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────────
function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '6px 0',
    background: active ? '#1a2060' : 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid #4a7aff' : '2px solid transparent',
    color: active ? '#fff' : '#666',
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'inherit',
    transition: 'color 0.15s',
  }
}

function badgeStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    borderRadius: 4,
    padding: '1px 6px',
    fontSize: 10,
    fontWeight: 600,
  }
}

const S: Record<string, React.CSSProperties> = {
  panel: {
    position: 'fixed', top: 0, right: 0,
    width: 340, height: '100vh',
    background: 'rgba(8,10,22,0.97)',
    color: '#e0e0e0',
    fontFamily: "'Segoe UI', sans-serif",
    fontSize: 13,
    display: 'flex', flexDirection: 'column',
    borderLeft: '1px solid #1c2040',
    zIndex: 1300,
    backdropFilter: 'blur(8px)',
    boxSizing: 'border-box',
  },
  header: {
    padding: '14px 14px 0',
    borderBottom: '1px solid #1c2040',
    flexShrink: 0,
  },
  tabBar: {
    display: 'flex',
    gap: 2,
    padding: '0 14px',
    marginTop: 8,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 14px',
  },
  card: {
    background: '#0e1228',
    border: '1px solid #1c2040',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 8,
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  cardTitle: {
    fontSize: 12,
    color: '#d0d8ff',
    marginBottom: 5,
    lineHeight: 1.4,
    fontWeight: 500,
  },
  cardMeta: {
    fontSize: 10,
    color: '#4a5080',
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 10,
    color: '#3a4080',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  statBox: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  stat: {
    flex: 1,
    background: '#0e1228',
    border: '1px solid #1c2040',
    borderRadius: 8,
    padding: '10px 8px',
    textAlign: 'center' as const,
  },
  statVal: {
    fontSize: 20,
    fontWeight: 700,
    color: '#4a7aff',
    display: 'block',
  },
  statLabel: {
    fontSize: 9,
    color: '#4a5080',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#4a5080',
    cursor: 'pointer',
    fontSize: 16,
    padding: 0,
    lineHeight: 1,
  },
  refreshBtn: {
    background: 'none',
    border: '1px solid #1c2040',
    borderRadius: 5,
    color: '#4a7aff',
    cursor: 'pointer',
    fontSize: 11,
    padding: '3px 8px',
    fontFamily: 'inherit',
  },
  emptyState: {
    textAlign: 'center' as const,
    color: '#333a60',
    padding: '30px 0',
    fontSize: 12,
  },
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function GitHubPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab]       = useState<Tab>('overview')
  const [data, setData]     = useState<GHData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/github')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      setLastFetch(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Atualiza automaticamente a cada 2 minutos
    intervalRef.current = setInterval(fetchData, 120_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchData])

  const openUrl = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

  return (
    <div style={S.panel}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 700, color: '#d0d8ff', fontSize: 14 }}>
            <span style={{ marginRight: 6 }}>🐙</span>
            {data ? data.repo.fullName : 'GitHub'}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button style={S.refreshBtn} onClick={fetchData} title="Atualizar">
              ↺ Atualizar
            </button>
            <button style={S.closeBtn} onClick={onClose} title="Fechar (G)">✕</button>
          </div>
        </div>

        {data?.repo.description && (
          <p style={{ fontSize: 11, color: '#4a5080', marginBottom: 8, lineHeight: 1.4 }}>
            {data.repo.description}
          </p>
        )}

        {lastFetch && (
          <p style={{ fontSize: 9, color: '#2a3050', marginBottom: 6 }}>
            Atualizado {relativeTime(lastFetch.toISOString())}
          </p>
        )}

        {/* Tabs */}
        <div style={S.tabBar}>
          {([
            ['overview', '📊 Visão'],
            ['issues',   `🐛 Issues ${data ? `(${data.issues.length})` : ''}`],
            ['pulls',    `🔀 PRs ${data ? `(${data.pulls.length})` : ''}`],
            ['commits',  '📌 Commits'],
          ] as [Tab, string][]).map(([id, label]) => (
            <button key={id} style={tabStyle(tab === id)} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={S.body}>
        {loading && (
          <div style={S.emptyState}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
            Carregando dados do repositório...
          </div>
        )}

        {!loading && error && (
          <div style={{ ...S.emptyState, color: '#ff4d4d' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>❌</div>
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* ── Overview ── */}
            {tab === 'overview' && (
              <>
                <p style={S.sectionTitle}>Repositório</p>
                <div style={S.statBox}>
                  <div style={S.stat}>
                    <span style={S.statVal}>⭐ {data.repo.stars}</span>
                    <span style={S.statLabel}>Stars</span>
                  </div>
                  <div style={S.stat}>
                    <span style={S.statVal}>🍴 {data.repo.forks}</span>
                    <span style={S.statLabel}>Forks</span>
                  </div>
                  <div style={S.stat}>
                    <span style={{ ...S.statVal, color: data.repo.openIssues > 0 ? '#f97316' : '#4ade80' }}>
                      {data.repo.openIssues}
                    </span>
                    <span style={S.statLabel}>Issues</span>
                  </div>
                </div>

                <div style={{ ...S.card, cursor: 'default' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: '#4a5080' }}>Branch padrão</span>
                    <span style={{ ...badgeStyle('#0e2a0e'), color: '#4ade80', fontSize: 10 }}>
                      🌿 {data.repo.defaultBranch}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: '#4a5080' }}>Últ. atualização</span>
                    <span style={{ fontSize: 11, color: '#d0d8ff' }}>{relativeTime(data.repo.updatedAt)}</span>
                  </div>
                </div>

                <p style={S.sectionTitle}>Últimos commits</p>
                {data.commits.slice(0, 5).map(c => (
                  <div
                    key={c.sha}
                    style={S.card}
                    onClick={() => openUrl(c.url)}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#4a7aff')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#1c2040')}
                  >
                    <p style={S.cardTitle}>{c.message}</p>
                    <div style={S.cardMeta}>
                      <span style={{ ...badgeStyle('#0e1a30'), color: '#7ab4ff' }}>{c.sha}</span>
                      <span>{c.author}</span>
                      <span>{relativeTime(c.date)}</span>
                    </div>
                  </div>
                ))}

                {data.pulls.length > 0 && (
                  <>
                    <p style={{ ...S.sectionTitle, marginTop: 12 }}>PRs abertos</p>
                    {data.pulls.slice(0, 3).map(p => (
                      <div
                        key={p.number}
                        style={S.card}
                        onClick={() => openUrl(p.url)}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#4a7aff')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#1c2040')}
                      >
                        <p style={S.cardTitle}>
                          {p.draft && <span style={{ color: '#666', marginRight: 4 }}>[Draft]</span>}
                          #{p.number} {p.title}
                        </p>
                        <div style={S.cardMeta}>
                          <span>{p.author}</span>
                          <span style={{ ...badgeStyle('#0e2a1e'), color: '#4ade80' }}>← {p.branch}</span>
                          <span>{relativeTime(p.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}

            {/* ── Issues ── */}
            {tab === 'issues' && (
              <>
                {data.issues.length === 0 ? (
                  <div style={S.emptyState}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
                    Nenhuma issue aberta!
                  </div>
                ) : (
                  data.issues.map(i => (
                    <div
                      key={i.number}
                      style={S.card}
                      onClick={() => openUrl(i.url)}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#4a7aff')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1c2040')}
                    >
                      <p style={S.cardTitle}>#{i.number} {i.title}</p>
                      <div style={S.cardMeta}>
                        <span>{i.author}</span>
                        <span>{relativeTime(i.createdAt)}</span>
                      </div>
                      {i.labels.length > 0 && (
                        <div style={{ marginTop: 5 }}>
                          {i.labels.map(l => <LabelBadge key={l.name} {...l} />)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </>
            )}

            {/* ── Pull Requests ── */}
            {tab === 'pulls' && (
              <>
                {data.pulls.length === 0 ? (
                  <div style={S.emptyState}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                    Nenhum PR aberto!
                  </div>
                ) : (
                  data.pulls.map(p => (
                    <div
                      key={p.number}
                      style={S.card}
                      onClick={() => openUrl(p.url)}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#4a7aff')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1c2040')}
                    >
                      <p style={S.cardTitle}>
                        {p.draft && (
                          <span style={{ ...badgeStyle('#1e1e1e'), color: '#888', marginRight: 6 }}>
                            Draft
                          </span>
                        )}
                        #{p.number} {p.title}
                      </p>
                      <div style={S.cardMeta}>
                        <span>{p.author}</span>
                        <span style={{ ...badgeStyle('#0e2a1e'), color: '#4ade80', fontSize: 10 }}>
                          ← {p.branch}
                        </span>
                        <span>{relativeTime(p.createdAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* ── Commits ── */}
            {tab === 'commits' && (
              data.commits.map(c => (
                <div
                  key={c.sha}
                  style={S.card}
                  onClick={() => openUrl(c.url)}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#4a7aff')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#1c2040')}
                >
                  <p style={S.cardTitle}>{c.message}</p>
                  <div style={S.cardMeta}>
                    <span style={{ ...badgeStyle('#0e1a30'), color: '#7ab4ff' }}>{c.sha}</span>
                    <span>{c.author}</span>
                    <span>{relativeTime(c.date)}</span>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}
