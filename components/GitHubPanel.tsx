'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  RefreshCw, X, GitBranch, GitCommit, GitPullRequest,
  Bug, Layers, FlaskConical, BarChart3, Columns2, GripVertical, AlertTriangle,
  AtSign, Users, CircleDot,
} from 'lucide-react'
import IssueDetailView from './IssueDetailView'
import SidePanel from './SidePanel'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface GHRepo {
  name: string; fullName: string; description: string
  stars: number; forks: number; openIssues: number
  defaultBranch: string; updatedAt: string
}
interface GHIssue {
  number: number; title: string; state: string
  labels: { name: string; color: string }[]
  author: string; assignees: string[]
  createdAt: string; url: string; repo?: string
  status?: string; endDate?: string
}
interface GHPull {
  number: number; title: string; state: string; draft: boolean
  author: string; branch: string; createdAt: string; url: string; repo?: string
}
interface GHCommit {
  sha: string; message: string; author: string; date: string; url: string
}
interface GHMention {
  number: number; title: string; type: 'issue' | 'pr'
  repo: string; url: string; createdAt: string; author: string
}
interface GHTeamIssue {
  number: number; title: string; url: string; repo: string
  assignees: { login: string; avatarUrl: string }[]
  endDate: string
}
interface GHData {
  repo: GHRepo; issues: GHIssue[]; backlog: GHIssue[]; sprint: GHIssue[]
  test: GHIssue[]; pulls: GHPull[]; commits: GHCommit[]; reviewCount: number
  mentions: GHMention[]; teamSprint: GHTeamIssue[]
}

type Tab = 'overview' | 'mentions' | 'team' | 'test' | 'pulls' | 'commits'
type Col = 'backlog' | 'sprint'

// ── Helpers ───────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
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
    <Badge variant="outline"
      style={{ background: `#${color}`, color: fg, borderColor: 'transparent' }}
      className="rounded-full font-semibold mr-1 text-[10px] px-1.5 py-0">
      {name}
    </Badge>
  )
}

function ItemCard({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <Card onClick={onClick} size="sm"
      className="bg-card rounded-lg px-3 py-2.5 mb-2 cursor-pointer transition-colors hover:bg-accent gap-1">
      {children}
    </Card>
  )
}

function isOverdue(endDate?: string): boolean {
  if (!endDate) return false
  return new Date(endDate) < new Date(new Date().toDateString())
}

function heatLevel(endDate: string): { color: string; label: string } {
  if (!endDate) return { color: 'text-muted-foreground', label: '—' }
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
  if (days > 3) return { color: 'text-green-500', label: `+${days}d` }
  if (days > 1) return { color: 'text-yellow-500', label: `+${days}d` }
  if (days === 1) return { color: 'text-orange-400', label: 'amanhã' }
  if (days === 0) return { color: 'text-orange-500', label: 'hoje' }
  const abs = Math.abs(days)
  return { color: 'text-red-500', label: `${abs}d` }
}

function IssueCard({ issue, showLate, onClick }: { issue: GHIssue; showLate?: boolean; onClick: () => void }) {
  const late = showLate && isOverdue(issue.endDate)
  return (
    <ItemCard onClick={onClick}>
      <div className="flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-card-foreground leading-snug font-medium">
            #{issue.number} {issue.title}
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center mt-0.5">
            {issue.repo && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{issue.repo.split('/')[1]}</Badge>}
            <span>por {issue.author}</span>
            {issue.assignees.length > 0 && <span>→ {issue.assignees.join(', ')}</span>}
            <span>{relativeTime(issue.createdAt)}</span>
          </div>
          {issue.labels.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {issue.labels.map(l => <LabelBadge key={l.name} {...l} />)}
            </div>
          )}
        </div>
        {late && (
          <div title={`Atrasada — prazo: ${new Date(issue.endDate!).toLocaleDateString('pt-BR')}`}
            className="shrink-0 flex items-center gap-1 text-destructive mt-0.5">
            <AlertTriangle className="size-3.5" />
          </div>
        )}
      </div>
    </ItemCard>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center text-muted-foreground py-8 text-sm">
      <div className="text-2xl mb-2 flex justify-center">{icon}</div>
      {text}
    </div>
  )
}

// ── Kanban duplo ──────────────────────────────────────────────────────────────
function DualKanbanView({ backlog, sprint, movingIssue, onIssueClick, onMove }: {
  backlog: GHIssue[]
  sprint: GHIssue[]
  movingIssue: number | null
  onIssueClick: (n: number) => void
  onMove: (issueNumber: number, from: Col, to: Col) => void
}) {
  const [dragging, setDragging] = useState<{ number: number; from: Col } | null>(null)
  const [dropTarget, setDropTarget] = useState<Col | null>(null)

  const handleDrop = (to: Col) => {
    if (dragging && dragging.from !== to) {
      onMove(dragging.number, dragging.from, to)
    }
    setDragging(null)
    setDropTarget(null)
  }

  const renderColumn = (list: GHIssue[], colId: Col, title: string, dotClass: string) => {
    const isDropTarget = dropTarget === colId && dragging?.from !== colId
    return (
      <div
        className={`flex-1 min-w-0 flex flex-col rounded-lg border-2 transition-all overflow-hidden
          ${isDropTarget ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border bg-muted/10'}`}
        onDragOver={e => { e.preventDefault(); setDropTarget(colId) }}
        onDragLeave={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null)
        }}
        onDrop={() => handleDrop(colId)}
      >
        {/* Column header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-muted/20 shrink-0">
          <span className={`size-2.5 rounded-full shrink-0 ${dotClass}`} />
          <span className="text-xs font-semibold flex-1">{title}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{list.length}</Badge>
        </div>

        {/* Cards */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1.5">
            {list.map(issue => (
              <div
                key={issue.number}
                draggable
                onDragStart={e => {
                  setDragging({ number: issue.number, from: colId })
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => { setDragging(null); setDropTarget(null) }}
                className={`group cursor-grab active:cursor-grabbing transition-opacity
                  ${movingIssue === issue.number ? 'opacity-40 pointer-events-none' : ''}
                  ${dragging?.number === issue.number ? 'opacity-50' : ''}`}
              >
                <Card
                  size="sm"
                  className="px-2.5 py-2 bg-card gap-1 hover:bg-accent transition-colors select-none"
                  onClick={() => { if (!dragging) onIssueClick(issue.number) }}
                >
                  <div className="flex items-start gap-1.5">
                    <GripVertical className="size-3 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-snug text-card-foreground line-clamp-2">
                        {issue.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[10px] text-muted-foreground flex-1">
                          {issue.repo?.split('/')[1] ?? issue.repo} #{issue.number}
                        </p>
                        {colId === 'sprint' && isOverdue(issue.endDate) && (
                          <span title={`Atrasada — prazo: ${new Date(issue.endDate!).toLocaleDateString('pt-BR')}`}
                            className="text-destructive shrink-0">
                            <AlertTriangle className="size-3" />
                          </span>
                        )}
                      </div>
                      {issue.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {issue.labels.slice(0, 3).map(l => <LabelBadge key={l.name} {...l} />)}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            ))}

            {list.length === 0 && (
              <div className={`flex items-center justify-center h-16 text-xs rounded-lg border-2 border-dashed transition-colors
                ${isDropTarget ? 'border-primary text-primary' : 'border-border text-muted-foreground italic'}`}>
                {isDropTarget ? 'Soltar aqui' : 'Vazio'}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  return (
    <div className="flex gap-3 h-full p-3 overflow-hidden">
      {renderColumn(backlog, 'backlog', 'Backlogs', 'bg-orange-400')}
      {renderColumn(sprint, 'sprint', 'Sprint', 'bg-green-500')}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function GitHubPanel({ onClose, defaultUsername }: { onClose: () => void; defaultUsername?: string }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [data, setData] = useState<GHData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [selectedUsername, setSelectedUsername] = useState(defaultUsername || '')
  const [inputUsername, setInputUsername] = useState(defaultUsername || '')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [selectedIssue, setSelectedIssue] = useState<number | null>(null)
  const [dualKanban, setDualKanban] = useState(false)

  // Local lists for optimistic drag-and-drop updates
  const [localBacklog, setLocalBacklog] = useState<GHIssue[]>([])
  const [localSprint, setLocalSprint] = useState<GHIssue[]>([])
  const [movingIssue, setMovingIssue] = useState<number | null>(null)
  const [overviewFilter, setOverviewFilter] = useState<'sprint' | 'backlog' | 'test' | null>('sprint')

  // Unread mentions tracking
  const [unreadMentions, setUnreadMentions] = useState(false)
  const lastMentionKeyRef = useRef<string>(
    typeof window !== 'undefined' ? (localStorage.getItem('gh-mentions-last') || '') : ''
  )

  // Auto-refresh countdown
  const REFRESH_INTERVAL = 15_000
  const [nextRefresh, setNextRefresh] = useState(REFRESH_INTERVAL / 1000)
  const [refreshing, setRefreshing] = useState(false)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async (silent = false, force = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const base = selectedUsername ? `/api/github?username=${encodeURIComponent(selectedUsername)}` : '/api/github'
      const url = force ? `${base}${base.includes('?') ? '&' : '?'}nocache=1` : base
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      setLocalBacklog(json.backlog)
      setLocalSprint(json.sprint)
      setLastFetch(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
      setNextRefresh(REFRESH_INTERVAL / 1000)
    }
  }, [selectedUsername])

  // Auto-refresh: interval + countdown + visibilitychange pause
  useEffect(() => {
    fetchData()

    const startCountdown = () => {
      setNextRefresh(REFRESH_INTERVAL / 1000)
      if (countdownRef.current) clearInterval(countdownRef.current)
      countdownRef.current = setInterval(() => {
        setNextRefresh(prev => Math.max(0, prev - 1))
      }, 1000)
    }

    const startInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchData(true)
          startCountdown()
        }
      }, REFRESH_INTERVAL)
      startCountdown()
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Retomou — busca imediatamente e reinicia o intervalo
        fetchData(true)
        startInterval()
      } else {
        // Saiu — pausa o countdown mas mantém o interval (ele checa visibilidade)
        if (countdownRef.current) clearInterval(countdownRef.current)
      }
    }

    startInterval()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchData])

  const openUrl = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

  // ── Track unread mentions ────────────────────────────────────────────────────
  useEffect(() => {
    if (!data?.mentions?.length) return
    const key = `${data.mentions[0].repo}#${data.mentions[0].number}`
    if (key !== lastMentionKeyRef.current) {
      setUnreadMentions(true)
    }
  }, [data?.mentions])

  // ── Tab change handler ───────────────────────────────────────────────────────
  const handleTabChange = (v: string) => {
    const t = v as Tab
    setTab(t)
    if (t === 'mentions' && data?.mentions?.length) {
      setUnreadMentions(false)
      const key = `${data.mentions[0].repo}#${data.mentions[0].number}`
      lastMentionKeyRef.current = key
      localStorage.setItem('gh-mentions-last', key)
    }
  }

  // ── Move issue between kanban columns ───────────────────────────────────────
  const moveIssue = useCallback(async (issueNumber: number, from: Col, to: Col) => {
    if (from === to) return

    // Optimistic update
    const issue = (from === 'backlog' ? localBacklog : localSprint).find(i => i.number === issueNumber)
    if (!issue) return

    if (from === 'backlog') {
      setLocalBacklog(prev => prev.filter(i => i.number !== issueNumber))
      setLocalSprint(prev => [...prev, issue])
    } else {
      setLocalSprint(prev => prev.filter(i => i.number !== issueNumber))
      setLocalBacklog(prev => [...prev, issue])
    }

    setMovingIssue(issueNumber)
    try {
      const res = await fetch('/api/github/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueNumber, targetStatus: to }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Força atualização sem cache para refletir a mudança
      fetchData(true, true)
    } catch {
      // Revert on error
      if (from === 'backlog') {
        setLocalBacklog(prev => [...prev, issue])
        setLocalSprint(prev => prev.filter(i => i.number !== issueNumber))
      } else {
        setLocalSprint(prev => [...prev, issue])
        setLocalBacklog(prev => prev.filter(i => i.number !== issueNumber))
      }
    } finally {
      setMovingIssue(null)
    }
  }, [localBacklog, localSprint])

  // ── Issue detail view ───────────────────────────────────────────────────────
  if (selectedIssue !== null) {
    return (
      <SidePanel defaultWidth={600} className="text-sm">
        <IssueDetailView issueNumber={selectedIssue} onBack={() => setSelectedIssue(null)} />
      </SidePanel>
    )
  }

  // ── Dual kanban mode ────────────────────────────────────────────────────────
  if (dualKanban) {
    return (
      <SidePanel key="dual" defaultWidth={740} className="text-sm">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="shrink-0 border-b border-border px-4 py-3 flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground flex-1 truncate">
              {data ? data.repo.fullName : 'GitHub'} — Kanban
            </span>
            {movingIssue && <span className="text-[10px] text-muted-foreground animate-pulse">Movendo...</span>}
            <div className="flex items-center gap-1">
              <span className={`size-1.5 rounded-full ${refreshing ? 'bg-green-500 animate-pulse' : 'bg-green-500/40'}`} />
              <span className="text-[10px] text-muted-foreground opacity-50">
                {refreshing ? 'atualizando...' : `${nextRefresh}s`}
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setDualKanban(false)} className="gap-1.5">
              <Columns2 className="size-3.5" />
              Fechar
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onClose} title="Fechar (G)">
              <X className="size-4" />
            </Button>
          </div>

          {/* Body */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
              Carregando...
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center text-xs text-destructive p-4">{error}</div>
          ) : (
            <div className="flex-1 min-h-0">
              <DualKanbanView
                backlog={localBacklog}
                sprint={localSprint}
                movingIssue={movingIssue}
                onIssueClick={setSelectedIssue}
                onMove={moveIssue}
              />
            </div>
          )}
        </div>
      </SidePanel>
    )
  }

  // ── Normal tabbed view ──────────────────────────────────────────────────────
  return (
    <SidePanel key="normal" defaultWidth={420} className="text-sm">

      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 pt-4 pb-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="truncate text-base font-semibold text-foreground">
            {data ? data.repo.fullName : 'GitHub'}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDualKanban(true)}
              title="Ver Backlog e Sprint lado a lado"
              className="gap-1.5"
            >
              <Columns2 className="size-3.5" />
              Kanban
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onClose} title="Fechar (G)">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mb-2">
          <div className="flex items-center gap-2">
            <Input
              value={inputUsername}
              onChange={e => setInputUsername(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setSelectedUsername(inputUsername) }}
              placeholder="Usuario GitHub"
              className="text-sm"
            />
            <Button size="sm" onClick={() => setSelectedUsername(inputUsername)} className="shrink-0">
              Buscar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Mostrando issues de:{' '}
            <strong className="text-foreground">{selectedUsername || 'nenhum usuario'}</strong>
          </p>
        </div>

        {data?.repo.description && (
          <p className="mb-1 line-clamp-2 text-sm leading-snug text-muted-foreground">{data.repo.description}</p>
        )}
        {lastFetch && (
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground opacity-60">
              Atualizado {relativeTime(lastFetch.toISOString())}
            </p>
            <div className="flex items-center gap-1 ml-auto">
              <span className={`size-1.5 rounded-full ${refreshing ? 'bg-green-500 animate-pulse' : 'bg-green-500/40'}`} />
              <span className="text-[10px] text-muted-foreground opacity-50">
                {refreshing ? 'atualizando...' : `${nextRefresh}s`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={handleTabChange} className="flex min-h-0 flex-1 flex-col">
        <TabsList
          variant="line"
          className="grid h-auto w-full grid-cols-3 gap-1 border-b border-border bg-transparent p-2 sm:grid-cols-6"
        >
          {([
            ['overview', <BarChart3 key="o" className="size-4" />, 'Visao Geral'],
            ['mentions', <span key="m" className="relative flex items-center gap-1">
              <AtSign className="size-3.5" />
              {unreadMentions && <span className="absolute -top-1 -right-1 size-1.5 rounded-full bg-red-500" />}
            </span>, 'Menções'],
            ['team', <Users key="team" className="size-3.5" />, 'Sprint da Equipe'],
            ['test', <span key="t" className="flex items-center gap-1"><FlaskConical className="size-3.5" />{data?.test.length ?? ''}</span>, 'Em Teste'],
            ['pulls', <span key="p" className="flex items-center gap-1"><GitPullRequest className="size-3.5" />{data?.pulls.length ?? ''}</span>, 'Pull Requests'],
            ['commits', <GitCommit key="c" className="size-4" />, 'Commits'],
          ] as [Tab, React.ReactNode, string][]).map(([id, label, title]) => (
            <TabsTrigger key={id} value={id} title={title}
              className="h-8 min-w-0 px-1.5 text-xs text-muted-foreground data-active:border-primary data-active:bg-accent data-active:text-accent-foreground">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">

            {loading && <EmptyState icon={<RefreshCw className="size-6 animate-spin text-muted-foreground" />} text="Carregando dados do repositorio..." />}
            {!loading && error && (
              <div className="text-center py-8 text-sm text-destructive">
                <X className="size-6 mx-auto mb-2" />{error}
              </div>
            )}

            {!loading && !error && data && (
              <>
                {/* Overview — resumo do usuário */}
                <TabsContent value="overview">
                  {!selectedUsername ? (
                    <EmptyState icon={<BarChart3 className="size-6 text-muted-foreground" />} text="Selecione um usuário para ver o resumo" />
                  ) : (
                    <>
                      {/* Avatar + nome */}
                      <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted/20 border border-border">
                        <img
                          src={`https://github.com/${selectedUsername}.png?size=48`}
                          alt={selectedUsername}
                          className="size-10 rounded-full ring-2 ring-border shrink-0"
                        />
                        <div>
                          <p className="font-semibold text-foreground">{selectedUsername}</p>
                          <p className="text-xs text-muted-foreground">
                            {data.sprint.length + data.backlog.length + data.test.length} tarefas no projeto
                          </p>
                        </div>
                      </div>

                      {/* Contadores de tarefas — filtro inline */}
                      {(() => {
                        const FILTERS = [
                          { key: 'sprint' as const, val: data.sprint.length, label: 'Sprint', dot: 'bg-green-500' },
                          { key: 'backlog' as const, val: data.backlog.length, label: 'Backlog', dot: 'bg-orange-400' },
                          { key: 'test' as const, val: data.test.length, label: 'Em Teste', dot: 'bg-blue-400' },
                        ] as const
                        const issueMap = { sprint: data.sprint, backlog: data.backlog, test: data.test }
                        const filtered = overviewFilter
                          ? [{ key: overviewFilter, issues: issueMap[overviewFilter] }]
                          : FILTERS.map(f => ({ key: f.key, issues: issueMap[f.key] }))
                        return (
                          <>
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              {FILTERS.map(f => (
                                <Card key={f.key} size="sm"
                                  className={`flex-1 rounded-lg p-3 text-center gap-1 cursor-pointer transition-colors
                                    ${overviewFilter === f.key ? 'ring-2 ring-primary bg-accent' : 'hover:bg-accent'}`}
                                  onClick={() => setOverviewFilter(prev => prev === f.key ? null : f.key)}>
                                  <span className="text-2xl font-bold block text-card-foreground">{f.val}</span>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className={`size-2 rounded-full ${f.dot}`} />
                                    <span className="text-xs text-muted-foreground">{f.label}</span>
                                  </div>
                                </Card>
                              ))}
                            </div>

                            {/* PRs aguardando revisão */}
                            {data.reviewCount > 0 && (
                              <Card size="sm"
                                className="rounded-lg p-3 mb-2 flex items-center gap-3 cursor-pointer hover:bg-accent transition-colors border-amber-500/60"
                                onClick={() => setTab('pulls')}>
                                <div className="size-8 rounded-full flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-500">
                                  <GitPullRequest className="size-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-foreground">{data.reviewCount}</p>
                                  <p className="text-xs text-muted-foreground">PR{data.reviewCount !== 1 ? 's' : ''} aguardando sua revisão</p>
                                </div>
                                <Badge className="bg-amber-500 text-white border-0 shrink-0">{data.reviewCount}</Badge>
                              </Card>
                            )}

                            {/* PRs do usuário — destaque acima das issues */}
                            {data.pulls.length > 0 && (
                              <div className="mb-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 mt-3">
                                  Pull Requests ({data.pulls.length})
                                </p>
                                <div className="space-y-1">
                                  {data.pulls.map(p => (
                                    <div key={`${p.repo}-${p.number}`}
                                      onClick={() => openUrl(p.url)}
                                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 cursor-pointer transition-colors group">
                                      <GitPullRequest className={`size-3 shrink-0 ${p.draft ? 'text-muted-foreground' : 'text-violet-400'}`} />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-foreground leading-snug truncate">
                                          {p.draft && <span className="text-[10px] text-muted-foreground mr-1">[Draft]</span>}
                                          {p.title}
                                        </p>
                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                                          {p.repo && <span className="truncate max-w-[60px]">{p.repo.split('/')[1]}</span>}
                                          <span className="opacity-40">·</span>
                                          <GitBranch className="size-2.5 shrink-0" />
                                          <span className="truncate max-w-[80px]">{p.branch}</span>
                                          <span className="opacity-40">·</span>
                                          <span>{relativeTime(p.createdAt)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Issues filtradas */}
                            {(data.sprint.length > 0 || data.backlog.length > 0 || data.test.length > 0) && (
                              <div className="border-t border-border/50 pt-3 mt-2">
                                {filtered.map(({ key, issues }) => issues.length === 0 ? null : (
                                  <div key={key}>
                                    {!overviewFilter && (
                                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-3 first:mt-0">
                                        {FILTERS.find(f => f.key === key)?.label}
                                      </p>
                                    )}
                                    {issues.map(i => (
                                      <IssueCard key={i.number} showLate={key === 'sprint'}
                                        issue={{ ...i, labels: i.labels.filter(l => l.name !== key) }}
                                        onClick={() => setSelectedIssue(i.number)} />
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}

                            {data.sprint.length === 0 && data.backlog.length === 0 && data.test.length === 0 && (
                              <EmptyState icon={<Bug className="size-6 text-muted-foreground" />} text="Nenhuma tarefa encontrada para este usuário" />
                            )}
                          </>
                        )
                      })()}
                    </>
                  )}
                </TabsContent>

                {/* Mentions */}
                <TabsContent value="mentions">
                  {!data.mentions?.length
                    ? <EmptyState icon={<AtSign className="size-6 text-muted-foreground" />} text="Nenhuma menção recente" />
                    : <>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-1">Menções recentes</p>
                        {data.mentions.map(m => (
                          <ItemCard key={`${m.repo}-${m.number}`} onClick={() => openUrl(m.url)}>
                            <div className="flex items-center gap-1.5">
                              {m.type === 'pr'
                                ? <GitPullRequest className="size-3 text-violet-400 shrink-0" />
                                : <CircleDot className="size-3 text-green-500 shrink-0" />}
                              <p className="text-sm text-card-foreground leading-snug font-medium flex-1 min-w-0 truncate">
                                #{m.number} {m.title}
                              </p>
                            </div>
                            <div className="flex gap-2 text-xs text-muted-foreground items-center">
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{m.repo.split('/')[1]}</Badge>
                              <span>por {m.author}</span>
                              <span>{relativeTime(m.createdAt)}</span>
                            </div>
                          </ItemCard>
                        ))}
                      </>
                  }
                </TabsContent>

                {/* Team Sprint */}
                <TabsContent value="team">
                  {!data.teamSprint?.length
                    ? <EmptyState icon={<Users className="size-6 text-muted-foreground" />} text="Nenhuma issue na sprint" />
                    : <>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-1">Sprint da Equipe</p>
                        <div className="space-y-0.5">
                          {data.teamSprint.map(i => {
                            const heat = heatLevel(i.endDate)
                            return (
                              <div key={i.number}
                                onClick={() => setSelectedIssue(i.number)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer transition-colors group">
                                {/* Assignee avatar(s) */}
                                <div className="flex -space-x-1 shrink-0">
                                  {i.assignees.slice(0, 2).map(a => (
                                    <img key={a.login} src={a.avatarUrl} alt={a.login} title={a.login}
                                      className="size-5 rounded-full ring-1 ring-background" />
                                  ))}
                                  {i.assignees.length === 0 && (
                                    <div className="size-5 rounded-full bg-muted ring-1 ring-background flex items-center justify-center">
                                      <Users className="size-2.5 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                                {/* Title */}
                                <p className="flex-1 min-w-0 text-xs text-foreground truncate">{i.title}</p>
                                {/* Heat indicator */}
                                <span className={`text-[10px] font-medium shrink-0 ${heat.color}`}>{heat.label}</span>
                              </div>
                            )
                          })}
                        </div>
                      </>
                  }
                </TabsContent>

                {/* Test */}
                <TabsContent value="test">
                  {data.test.length === 0
                    ? <EmptyState icon={<FlaskConical className="size-6 text-muted-foreground" />} text="Nenhuma issue em teste" />
                    : <>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-1">Issues em Teste</p>
                        {data.test.map(i => (
                          <IssueCard key={i.number} issue={i} onClick={() => setSelectedIssue(i.number)} />
                        ))}
                      </>
                  }
                </TabsContent>

                {/* Pull Requests */}
                <TabsContent value="pulls">
                  {data.pulls.length === 0
                    ? <EmptyState icon={<GitPullRequest className="size-6 text-muted-foreground" />} text="Nenhum PR aberto!" />
                    : data.pulls.map(p => (
                        <ItemCard key={`${p.repo}-${p.number}`} onClick={() => openUrl(p.url)}>
                          <p className="text-sm text-card-foreground leading-snug font-medium">
                            {p.draft && <Badge variant="outline" className="mr-1.5">Draft</Badge>}
                            #{p.number} {p.title}
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
                            {p.repo && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{p.repo.split('/')[1]}</Badge>}
                            <span>{p.author}</span>
                            <Badge variant="secondary" className="gap-1"><GitBranch className="size-3" />{p.branch}</Badge>
                            <span>{relativeTime(p.createdAt)}</span>
                          </div>
                        </ItemCard>
                      ))
                  }
                </TabsContent>

                {/* Commits */}
                <TabsContent value="commits">
                  {data.commits.map(c => (
                    <ItemCard key={c.sha} onClick={() => openUrl(c.url)}>
                      <p className="text-sm text-card-foreground leading-snug font-medium">{c.message}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
                        <Badge variant="secondary" className="gap-1"><GitCommit className="size-3" />{c.sha}</Badge>
                        <span>{c.author}</span><span>{relativeTime(c.date)}</span>
                      </div>
                    </ItemCard>
                  ))}
                </TabsContent>
              </>
            )}
          </div>
        </ScrollArea>
      </Tabs>
    </SidePanel>
  )
}
