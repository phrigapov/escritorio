'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

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
  assignees: string[]
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
  backlog: GHIssue[]
  sprint: GHIssue[]
  test: GHIssue[]
  pulls: GHPull[]
  commits: GHCommit[]
}

type Tab = 'overview' | 'backlog' | 'sprint' | 'test' | 'pulls' | 'commits'

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
    <Badge
      style={{ background: `#${color}`, color: fg, borderColor: 'transparent' }}
      className="text-[9px] px-1.5 py-0 h-4 rounded-full font-semibold mr-1"
    >
      {name}
    </Badge>
  )
}

// ── Card de issue/PR/commit ───────────────────────────────────────────────────
function ItemCard({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <Card
      onClick={onClick}
      className="bg-[#0e1228] border-[#1c2040] rounded-lg px-3 py-2.5 mb-2 cursor-pointer transition-colors hover:border-[#4a7aff] text-inherit gap-0"
    >
      {children}
    </Card>
  )
}

function IssueCard({ issue, onClick }: { issue: GHIssue; onClick: () => void }) {
  return (
    <ItemCard onClick={onClick}>
      <p className="text-xs text-[#d0d8ff] mb-1 leading-snug font-medium">
        #{issue.number} {issue.title}
      </p>
      <div className="flex flex-wrap gap-2 text-[10px] text-[#4a5080] items-center">
        <span>por {issue.author}</span>
        {issue.assignees.length > 0 && <span>→ {issue.assignees.join(', ')}</span>}
        <span>{relativeTime(issue.createdAt)}</span>
      </div>
      {issue.labels.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-0">
          {issue.labels.map(l => <LabelBadge key={l.name} {...l} />)}
        </div>
      )}
    </ItemCard>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="text-center text-[#333a60] py-8 text-xs">
      <div className="text-2xl mb-2">{emoji}</div>
      {text}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function GitHubPanel({ onClose, defaultUsername }: { onClose: () => void; defaultUsername?: string }) {
  const [tab, setTab]       = useState<Tab>('sprint')
  const [data, setData]     = useState<GHData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [selectedUsername, setSelectedUsername] = useState(defaultUsername || '')
  const [inputUsername, setInputUsername] = useState(defaultUsername || '')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = selectedUsername ? `/api/github?username=${encodeURIComponent(selectedUsername)}` : '/api/github'
      const res = await fetch(url)
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
  }, [selectedUsername])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 120_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchData])

  const openUrl = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

  return (
    <div
      className="dark fixed inset-y-0 right-0 z-[1300] flex w-[min(100vw,420px)] flex-col overflow-hidden border-l border-[#1c2040] bg-[rgba(8,10,22,0.97)] text-[13px] text-[#e0e0e0] backdrop-blur-sm"
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="shrink-0 border-b border-[#1c2040] px-3 pt-3 sm:px-3.5 sm:pt-3.5">
        {/* Título + botões */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate text-sm font-bold text-[#d0d8ff]">
            🐙 {data ? data.repo.fullName : 'GitHub'}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="xs"
              onClick={fetchData}
              className="h-6 border-[#1c2040] bg-transparent px-2 text-[10px] text-[#4a7aff] hover:bg-[#1c2040] hover:text-[#7ab4ff]"
            >
              ↺ Atualizar
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              className="text-[#4a5080] hover:bg-transparent hover:text-[#e0e0e0]"
              title="Fechar (G)"
            >
              ✕
            </Button>
          </div>
        </div>

        {/* Seletor de usuário */}
        <div className="mb-2.5">
          <div className="flex items-center gap-1.5">
            <Input
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSelectedUsername(inputUsername)
              }}
              placeholder="Usuário GitHub"
              className="h-7 border-[#1c2040] bg-[#0e1228] text-[11px] text-[#d0d8ff] placeholder:text-[#3a4060] focus-visible:border-[#4a7aff] focus-visible:ring-[#4a7aff]/20"
            />
            <Button
              size="sm"
              onClick={() => setSelectedUsername(inputUsername)}
              className="h-7 shrink-0 border-[#2a3080] bg-[#1a2060] px-3 text-[11px] text-[#4a7aff] hover:bg-[#2a3080] hover:text-[#7ab4ff]"
            >
              Buscar
            </Button>
          </div>
          <p className="text-[9px] text-[#4a5080] mt-1">
            Mostrando issues de:{' '}
            <strong className="text-[#4a7aff]">{selectedUsername || 'nenhum usuário'}</strong>
          </p>
        </div>

        {data?.repo.description && (
          <p className="mb-2 line-clamp-2 text-[11px] leading-snug text-[#4a5080]">{data.repo.description}</p>
        )}
        {lastFetch && (
          <p className="mb-2 text-[9px] text-[#2a3050]">
            Atualizado {relativeTime(lastFetch.toISOString())}
          </p>
        )}
      </div>

      {/* Tabs + Body */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex min-h-0 flex-1 flex-col">
          <TabsList
            variant="line"
            className="grid h-auto w-full grid-cols-3 gap-1 border-b border-[#1c2040] bg-transparent p-2 sm:grid-cols-6"
          >
            {([
              ['overview', '📊', 'Visão Geral'],
              ['backlog',  `📋 ${data?.backlog.length ?? ''}`, 'Backlog'],
              ['sprint',   `🏃 ${data?.sprint.length ?? ''}`, 'Sprint'],
              ['test',     `🧪 ${data?.test.length ?? ''}`, 'Em Teste'],
              ['pulls',    `🔀 ${data?.pulls.length ?? ''}`, 'Pull Requests'],
              ['commits',  '📌', 'Commits'],
            ] as [Tab, string, string][]).map(([id, label, title]) => (
              <TabsTrigger
                key={id}
                value={id}
                title={title}
                className="h-7 min-w-0 px-1 text-[10px] text-[#5e6385] data-active:border-[#4a7aff] data-active:bg-[#12173a] data-active:text-white"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Body ── */}
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-3 sm:p-3.5">

              {loading && (
                <EmptyState emoji="⏳" text="Carregando dados do repositório..." />
              )}

              {!loading && error && (
                <div className="text-center py-8 text-[11px] text-red-400">
                  <div className="text-2xl mb-2">❌</div>
                  {error}
                </div>
              )}

              {!loading && !error && data && (
                <>
                  {/* ── Overview ── */}
                  <TabsContent value="overview">
                    <p className="text-[10px] text-[#3a4080] uppercase tracking-wider mb-2 mt-1">Repositório</p>
                    <div className="mb-3 grid grid-cols-3 gap-2">
                      {[
                        { val: `⭐ ${data.repo.stars}`, label: 'Stars', color: '#4a7aff' },
                        { val: `🍴 ${data.repo.forks}`, label: 'Forks', color: '#4a7aff' },
                        { val: String(data.repo.openIssues), label: 'Issues', color: data.repo.openIssues > 0 ? '#f97316' : '#4ade80' },
                      ].map(s => (
                        <Card key={s.label} className="flex-1 bg-[#0e1228] border-[#1c2040] rounded-lg p-2 text-center gap-0">
                          <span className="text-xl font-bold block" style={{ color: s.color }}>{s.val}</span>
                          <span className="text-[9px] text-[#4a5080] uppercase tracking-wide">{s.label}</span>
                        </Card>
                      ))}
                    </div>

                    <p className="text-[10px] text-[#3a4080] uppercase tracking-wider mb-2">Issues do Projeto</p>
                    <div className="mb-3 grid grid-cols-3 gap-2">
                      {[
                        { val: `🏃 ${data.sprint.length}`, label: 'Sprint', color: '#10b981' },
                        { val: `📋 ${data.backlog.length}`, label: 'Backlog', color: '#fbbf24' },
                        { val: `🧪 ${data.test.length}`, label: 'Test', color: '#8b5cf6' },
                      ].map(s => (
                        <Card key={s.label} className="flex-1 bg-[#0e1228] border-[#1c2040] rounded-lg p-2 text-center gap-0">
                          <span className="text-lg font-bold block" style={{ color: s.color }}>{s.val}</span>
                          <span className="text-[9px] text-[#4a5080] uppercase tracking-wide">{s.label}</span>
                        </Card>
                      ))}
                    </div>

                    <Card className="bg-[#0e1228] border-[#1c2040] rounded-lg px-3 py-2.5 mb-3 gap-0">
                      <div className="flex justify-between items-center text-[11px] mb-1.5">
                        <span className="text-[#4a5080]">Branch padrão</span>
                        <Badge className="bg-[#0e2a0e] text-[#4ade80] border-transparent text-[10px]">
                          🌿 {data.repo.defaultBranch}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#4a5080]">Últ. atualização</span>
                        <span className="text-[#d0d8ff]">{relativeTime(data.repo.updatedAt)}</span>
                      </div>
                    </Card>

                    <p className="text-[10px] text-[#3a4080] uppercase tracking-wider mb-2">Últimos commits</p>
                    {data.commits.slice(0, 5).map(c => (
                      <ItemCard key={c.sha} onClick={() => openUrl(c.url)}>
                        <p className="text-xs text-[#d0d8ff] mb-1 leading-snug font-medium">{c.message}</p>
                        <div className="flex flex-wrap gap-2 text-[10px] text-[#4a5080] items-center">
                          <Badge className="bg-[#0e1a30] text-[#7ab4ff] border-transparent text-[9px] px-1.5 h-4">{c.sha}</Badge>
                          <span>{c.author}</span>
                          <span>{relativeTime(c.date)}</span>
                        </div>
                      </ItemCard>
                    ))}

                    {data.pulls.length > 0 && (
                      <>
                        <p className="text-[10px] text-[#3a4080] uppercase tracking-wider mb-2 mt-3">PRs abertos</p>
                        {data.pulls.slice(0, 3).map(p => (
                          <ItemCard key={p.number} onClick={() => openUrl(p.url)}>
                            <p className="text-xs text-[#d0d8ff] mb-1 leading-snug font-medium">
                              {p.draft && <Badge className="bg-[#1e1e1e] text-[#888] border-transparent text-[9px] px-1.5 h-4 mr-1">Draft</Badge>}
                              #{p.number} {p.title}
                            </p>
                            <div className="flex flex-wrap gap-2 text-[10px] text-[#4a5080] items-center">
                              <span>{p.author}</span>
                              <Badge className="bg-[#0e2a1e] text-[#4ade80] border-transparent text-[9px] px-1.5 h-4">← {p.branch}</Badge>
                              <span>{relativeTime(p.createdAt)}</span>
                            </div>
                          </ItemCard>
                        ))}
                      </>
                    )}
                  </TabsContent>

                  {/* ── Backlog ── */}
                  <TabsContent value="backlog">
                    {data.backlog.length === 0
                      ? <EmptyState emoji="📋" text="Nenhuma issue no backlog" />
                      : <>
                          <p className="text-[10px] text-[#3a4080] uppercase tracking-wider mb-2 mt-1">Issues no Backlog</p>
                          {data.backlog.map(i => (
                            <IssueCard key={i.number} issue={{ ...i, labels: i.labels.filter(l => l.name !== 'backlog') }} onClick={() => openUrl(i.url)} />
                          ))}
                        </>
                    }
                  </TabsContent>

                  {/* ── Sprint ── */}
                  <TabsContent value="sprint">
                    {data.sprint.length === 0
                      ? <EmptyState emoji="🏃" text="Nenhuma issue na sprint atual" />
                      : <>
                          <p className="text-[10px] text-[#3a4080] uppercase tracking-wider mb-2 mt-1">Issues na Sprint</p>
                          {data.sprint.map(i => (
                            <IssueCard key={i.number} issue={{ ...i, labels: i.labels.filter(l => l.name !== 'sprint') }} onClick={() => openUrl(i.url)} />
                          ))}
                        </>
                    }
                  </TabsContent>

                  {/* ── Test ── */}
                  <TabsContent value="test">
                    {data.test.length === 0
                      ? <EmptyState emoji="🧪" text="Nenhuma issue em teste" />
                      : <>
                          <p className="text-[10px] text-[#3a4080] uppercase tracking-wider mb-2 mt-1">Issues em Teste</p>
                          {data.test.map(i => (
                            <IssueCard key={i.number} issue={i} onClick={() => openUrl(i.url)} />
                          ))}
                        </>
                    }
                  </TabsContent>

                  {/* ── Pull Requests ── */}
                  <TabsContent value="pulls">
                    {data.pulls.length === 0
                      ? <EmptyState emoji="✅" text="Nenhum PR aberto!" />
                      : data.pulls.map(p => (
                          <ItemCard key={p.number} onClick={() => openUrl(p.url)}>
                            <p className="text-xs text-[#d0d8ff] mb-1 leading-snug font-medium">
                              {p.draft && <Badge className="bg-[#1e1e1e] text-[#888] border-transparent text-[9px] px-1.5 h-4 mr-1">Draft</Badge>}
                              #{p.number} {p.title}
                            </p>
                            <div className="flex flex-wrap gap-2 text-[10px] text-[#4a5080] items-center">
                              <span>{p.author}</span>
                              <Badge className="bg-[#0e2a1e] text-[#4ade80] border-transparent text-[9px] px-1.5 h-4">← {p.branch}</Badge>
                              <span>{relativeTime(p.createdAt)}</span>
                            </div>
                          </ItemCard>
                        ))
                    }
                  </TabsContent>

                  {/* ── Commits ── */}
                  <TabsContent value="commits">
                    {data.commits.map(c => (
                      <ItemCard key={c.sha} onClick={() => openUrl(c.url)}>
                        <p className="text-xs text-[#d0d8ff] mb-1 leading-snug font-medium">{c.message}</p>
                        <div className="flex flex-wrap gap-2 text-[10px] text-[#4a5080] items-center">
                          <Badge className="bg-[#0e1a30] text-[#7ab4ff] border-transparent text-[9px] px-1.5 h-4">{c.sha}</Badge>
                          <span>{c.author}</span>
                          <span>{relativeTime(c.date)}</span>
                        </div>
                      </ItemCard>
                    ))}
                  </TabsContent>
                </>
              )}
            </div>
          </ScrollArea>
      </Tabs>
    </div>
  )
}

