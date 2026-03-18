'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RefreshCw, X, GitBranch, GitCommit, GitPullRequest, Bug, Layers, FlaskConical, BarChart3 } from 'lucide-react'
import IssueDetailView from './IssueDetailView'
import SidePanel from './SidePanel'

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
  repo?: string
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
  repo?: string
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
      variant="outline"
      style={{ background: `#${color}`, color: fg, borderColor: 'transparent' }}
      className="rounded-full font-semibold mr-1"
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
      size="sm"
      className="bg-card rounded-lg px-3 py-2.5 mb-2 cursor-pointer transition-colors hover:bg-accent gap-1"
    >
      {children}
    </Card>
  )
}

function IssueCard({ issue, onClick }: { issue: GHIssue; onClick: () => void }) {
  return (
    <ItemCard onClick={onClick}>
      <p className="text-sm text-card-foreground leading-snug font-medium">
        #{issue.number} {issue.title}
      </p>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
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
    </ItemCard>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center text-muted-foreground py-8 text-sm">
      <div className="text-2xl mb-2 flex justify-center">{icon}</div>
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

  // ── Issue detail state ──────────────────────────────────────────────────────
  const [selectedIssue, setSelectedIssue] = useState<number | null>(null)

  // ── Data fetching ───────────────────────────────────────────────────────────
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

  // ── Se uma issue esta selecionada, mostrar detalhe ────────────────────────
  if (selectedIssue !== null) {
    return (
      <SidePanel defaultWidth={420} className="text-sm">
        <IssueDetailView
          issueNumber={selectedIssue}
          onBack={() => setSelectedIssue(null)}
        />
      </SidePanel>
    )
  }

  return (
    <SidePanel defaultWidth={420} className="text-sm">

      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 pt-4 pb-3">
        {/* Titulo + botoes */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="truncate text-base font-semibold text-foreground">
            {data ? data.repo.fullName : 'GitHub'}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="gap-1"
            >
              <RefreshCw className="size-3.5" />
              Atualizar
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              title="Fechar (G)"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Seletor de usuario */}
        <div className="mb-2">
          <div className="flex items-center gap-2">
            <Input
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSelectedUsername(inputUsername)
              }}
              placeholder="Usuario GitHub"
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={() => setSelectedUsername(inputUsername)}
              className="shrink-0"
            >
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
          <p className="text-xs text-muted-foreground opacity-60">
            Atualizado {relativeTime(lastFetch.toISOString())}
          </p>
        )}
      </div>

      {/* Tabs + Body */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex min-h-0 flex-1 flex-col">
          <TabsList
            variant="line"
            className="grid h-auto w-full grid-cols-3 gap-1 border-b border-border bg-transparent p-2 sm:grid-cols-6"
          >
            {([
              ['overview', <BarChart3 key="overview" className="size-4" />, 'Visao Geral'],
              ['backlog',  <span key="backlog" className="flex items-center gap-1"><Layers className="size-3.5" />{data?.backlog.length ?? ''}</span>, 'Backlog'],
              ['sprint',   <span key="sprint" className="flex items-center gap-1"><Bug className="size-3.5" />{data?.sprint.length ?? ''}</span>, 'Sprint'],
              ['test',     <span key="test" className="flex items-center gap-1"><FlaskConical className="size-3.5" />{data?.test.length ?? ''}</span>, 'Em Teste'],
              ['pulls',    <span key="pulls" className="flex items-center gap-1"><GitPullRequest className="size-3.5" />{data?.pulls.length ?? ''}</span>, 'Pull Requests'],
              ['commits',  <GitCommit key="commits" className="size-4" />, 'Commits'],
            ] as [Tab, React.ReactNode, string][]).map(([id, label, title]) => (
              <TabsTrigger
                key={id}
                value={id}
                title={title}
                className="h-8 min-w-0 px-1.5 text-xs text-muted-foreground data-active:border-primary data-active:bg-accent data-active:text-accent-foreground"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Body ── */}
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4">

              {loading && (
                <EmptyState icon={<RefreshCw className="size-6 animate-spin text-muted-foreground" />} text="Carregando dados do repositorio..." />
              )}

              {!loading && error && (
                <div className="text-center py-8 text-sm text-destructive">
                  <div className="text-2xl mb-2">
                    <X className="size-6 mx-auto" />
                  </div>
                  {error}
                </div>
              )}

              {!loading && !error && data && (
                <>
                  {/* ── Overview ── */}
                  <TabsContent value="overview">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-1">Repositorio</p>
                    <div className="mb-4 grid grid-cols-3 gap-2">
                      {[
                        { val: data.repo.stars, label: 'Stars' },
                        { val: data.repo.forks, label: 'Forks' },
                        { val: data.repo.openIssues, label: 'Issues', warn: data.repo.openIssues > 0 },
                      ].map(s => (
                        <Card key={s.label} size="sm" className="flex-1 rounded-lg p-3 text-center gap-0">
                          <span className={`text-2xl font-bold block ${s.warn ? 'text-destructive' : 'text-card-foreground'}`}>
                            {s.val}
                          </span>
                          <span className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</span>
                        </Card>
                      ))}
                    </div>

                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Issues do Projeto</p>
                    <div className="mb-4 grid grid-cols-3 gap-2">
                      {[
                        { val: data.sprint.length, label: 'Sprint', icon: <Bug key="bug" className="size-4 inline" /> },
                        { val: data.backlog.length, label: 'Backlog', icon: <Layers key="layers" className="size-4 inline" /> },
                        { val: data.test.length, label: 'Test', icon: <FlaskConical key="flask" className="size-4 inline" /> },
                      ].map(s => (
                        <Card key={s.label} size="sm" className="flex-1 rounded-lg p-3 text-center gap-0">
                          <span className="text-xl font-bold block text-card-foreground">
                            {s.icon} {s.val}
                          </span>
                          <span className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</span>
                        </Card>
                      ))}
                    </div>

                    <Card size="sm" className="rounded-lg px-4 py-3 mb-4 gap-0">
                      <div className="flex justify-between items-center text-sm mb-2">
                        <span className="text-muted-foreground">Branch padrao</span>
                        <Badge variant="secondary" className="gap-1">
                          <GitBranch className="size-3" />
                          {data.repo.defaultBranch}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Ult. atualizacao</span>
                        <span className="text-foreground">{relativeTime(data.repo.updatedAt)}</span>
                      </div>
                    </Card>

                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Ultimos commits</p>
                    {data.commits.slice(0, 5).map(c => (
                      <ItemCard key={c.sha} onClick={() => openUrl(c.url)}>
                        <p className="text-sm text-card-foreground leading-snug font-medium">{c.message}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
                          <Badge variant="secondary" className="gap-1">
                            <GitCommit className="size-3" />
                            {c.sha}
                          </Badge>
                          <span>{c.author}</span>
                          <span>{relativeTime(c.date)}</span>
                        </div>
                      </ItemCard>
                    ))}

                    {data.pulls.length > 0 && (
                      <>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-4">PRs abertos</p>
                        {data.pulls.slice(0, 3).map(p => (
                          <ItemCard key={`${p.repo}-${p.number}`} onClick={() => openUrl(p.url)}>
                            <p className="text-sm text-card-foreground leading-snug font-medium">
                              {p.draft && <Badge variant="outline" className="mr-1.5">Draft</Badge>}
                              #{p.number} {p.title}
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
                              {p.repo && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{p.repo.split('/')[1]}</Badge>}
                              <span>{p.author}</span>
                              <Badge variant="secondary" className="gap-1">
                                <GitBranch className="size-3" />
                                {p.branch}
                              </Badge>
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
                      ? <EmptyState icon={<Layers className="size-6 text-muted-foreground" />} text="Nenhuma issue no backlog" />
                      : <>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-1">Issues no Backlog</p>
                          {data.backlog.map(i => (
                            <IssueCard key={i.number} issue={{ ...i, labels: i.labels.filter(l => l.name !== 'backlog') }} onClick={() => setSelectedIssue(i.number)} />
                          ))}
                        </>
                    }
                  </TabsContent>

                  {/* ── Sprint ── */}
                  <TabsContent value="sprint">
                    {data.sprint.length === 0
                      ? <EmptyState icon={<Bug className="size-6 text-muted-foreground" />} text="Nenhuma issue na sprint atual" />
                      : <>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-1">Issues na Sprint</p>
                          {data.sprint.map(i => (
                            <IssueCard key={i.number} issue={{ ...i, labels: i.labels.filter(l => l.name !== 'sprint') }} onClick={() => setSelectedIssue(i.number)} />
                          ))}
                        </>
                    }
                  </TabsContent>

                  {/* ── Test ── */}
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

                  {/* ── Pull Requests ── */}
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
                              <Badge variant="secondary" className="gap-1">
                                <GitBranch className="size-3" />
                                {p.branch}
                              </Badge>
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
                        <p className="text-sm text-card-foreground leading-snug font-medium">{c.message}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
                          <Badge variant="secondary" className="gap-1">
                            <GitCommit className="size-3" />
                            {c.sha}
                          </Badge>
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
    </SidePanel>
  )
}
