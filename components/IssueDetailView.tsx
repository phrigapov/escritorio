'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  ArrowLeft, ExternalLink, CircleDot, CheckCircle2, GitMerge,
  Pencil, Save, X, Send, Check, GitBranch, Tag, Settings,
  Calendar, Type, ListChecks, Hash, Milestone,
} from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────────────────
interface ProjectField {
  name: string
  fieldId: string
  type: 'single_select' | 'text' | 'number' | 'date' | 'iteration'
  value: string | number | null
  options?: { id: string; name: string; color?: string; description?: string }[]
  iterations?: { id: string; title: string; startDate: string; duration: number }[]
}
interface RepoLabel { name: string; color: string; description: string }
interface Collaborator { login: string; avatarUrl: string }
interface IssueDetail {
  id: string; number: number; title: string; body: string; bodyHTML: string
  state: string; stateReason: string | null; createdAt: string; updatedAt: string
  closedAt: string | null; url: string; isPinned: boolean
  reactionCount: number; referenceCount: number
  milestone: string | null; milestoneDueOn: string | null
  linkedBranches: string[]
  author: { login: string; avatarUrl: string }
  assignees: { login: string; avatarUrl: string }[]
  labels: { name: string; color: string }[]
  repoLabels: RepoLabel[]
  repoCollaborators: Collaborator[]
  comments: IssueComment[]
  commentCount: number
  projectItemId: string | null; projectTitle: string | null; projectFields: ProjectField[]
}
interface IssueComment {
  id: string; body: string; bodyHTML: string; createdAt: string; updatedAt: string
  reactionCount: number; author: { login: string; avatarUrl: string }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
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
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Avatar({ src, login, size = 'md' }: { src: string; login: string; size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'lg' ? 'size-8' : size === 'sm' ? 'size-5' : 'size-6'
  return <img src={src} alt={login} title={login} className={`${px} rounded-full ring-1 ring-border shrink-0`} />
}

function LabelBadge({ name, color, onRemove }: { name: string; color: string; onRemove?: () => void }) {
  const fg = parseInt(color, 16) > 0x888888 ? '#111' : '#fff'
  return (
    <Badge variant="outline" style={{ background: `#${color}`, color: fg, borderColor: 'transparent' }}
      className="rounded-full text-[10px] font-semibold gap-0.5 px-2 py-0.5">
      {name}
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove() }} className="hover:opacity-70 ml-0.5">
          <X className="size-2.5" />
        </button>
      )}
    </Badge>
  )
}

// ── Label Picker ─────────────────────────────────────────────────────────────
function LabelPicker({ currentLabels, repoLabels, onToggle, disabled }: {
  currentLabels: { name: string; color: string }[]
  repoLabels: RepoLabel[]
  onToggle: (name: string, active: boolean) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const currentSet = useMemo(() => new Set(currentLabels.map(l => l.name)), [currentLabels])
  const filtered = useMemo(() => {
    if (!search) return repoLabels
    const q = search.toLowerCase()
    return repoLabels.filter(l => l.name.toLowerCase().includes(q) || l.description.toLowerCase().includes(q))
  }, [repoLabels, search])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button disabled={disabled} className="text-muted-foreground hover:text-foreground transition-colors" />}>
        <Settings className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent
        className="max-w-[calc(100vw-1rem)] w-64 p-0"
        side="bottom" align="end"
      >
        <div className="px-3 py-2 border-b border-border">
          <p className="text-xs font-semibold mb-1.5">Aplicar labels</p>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar..." className="h-7 text-xs" autoFocus />
        </div>
        <ScrollArea className="max-h-[min(220px,50vh)]">
          <div className="py-1">
            {filtered.map(label => {
              const active = currentSet.has(label.name)
              return (
                <button key={label.name} onClick={() => onToggle(label.name, !active)} disabled={disabled}
                  className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent text-sm text-left">
                  <div className="size-4 flex items-center justify-center shrink-0">
                    {active && <Check className="size-3.5" />}
                  </div>
                  <span className="size-3 rounded-full shrink-0" style={{ background: `#${label.color}` }} />
                  <span className="flex-1 truncate">{label.name}</span>
                </button>
              )
            })}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhuma label</p>}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

// ── Assignee Picker ───────────────────────────────────────────────────────────
function AssigneePicker({ currentAssignees, collaborators, onToggle, disabled }: {
  currentAssignees: { login: string; avatarUrl: string }[]
  collaborators: Collaborator[]
  onToggle: (login: string, active: boolean) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const currentSet = useMemo(() => new Set(currentAssignees.map(a => a.login)), [currentAssignees])

  const options = useMemo(() => {
    const all = collaborators.length > 0 ? collaborators : currentAssignees
    if (!search) return all
    return all.filter(c => c.login.toLowerCase().includes(search.toLowerCase()))
  }, [collaborators, currentAssignees, search])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button disabled={disabled} className="text-muted-foreground hover:text-foreground transition-colors" />}>
        <Settings className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent
        className="max-w-[calc(100vw-1rem)] w-60 p-0"
        side="bottom" align="end"
      >
        <div className="px-3 py-2 border-b border-border">
          <p className="text-xs font-semibold mb-1.5">Atribuir a</p>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar usuários..." className="h-7 text-xs" autoFocus />
        </div>
        <ScrollArea className="max-h-[min(200px,50vh)]">
          <div className="py-1">
            {options.map(collab => {
              const active = currentSet.has(collab.login)
              return (
                <button key={collab.login} onClick={() => onToggle(collab.login, !active)} disabled={disabled}
                  className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent text-sm text-left">
                  <div className="size-4 flex items-center justify-center shrink-0">
                    {active && <Check className="size-3.5" />}
                  </div>
                  {collab.avatarUrl
                    ? <img src={collab.avatarUrl} alt={collab.login} className="size-5 rounded-full shrink-0" />
                    : <div className="size-5 rounded-full bg-muted shrink-0" />
                  }
                  <span className="flex-1 truncate">{collab.login}</span>
                </button>
              )
            })}
            {options.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum usuário encontrado</p>}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

// ── Sidebar section ──────────────────────────────────────────────────────────
function SidebarSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="py-3 border-t border-border/60 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-foreground">{title}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

// ── Project field editor ─────────────────────────────────────────────────────
function ProjectFieldEditor({ field, projectItemId, onUpdate, saving }: {
  field: ProjectField; projectItemId: string
  onUpdate: (payload: Record<string, unknown>) => void; saving: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(String(field.value ?? ''))

  const saveField = (value: string) => {
    onUpdate({ projectItemId, projectField: { fieldId: field.fieldId, type: field.type, value } })
    setEditing(false)
  }

  if (field.type === 'single_select' && field.options) {
    return (
      <Select
        value={String(field.value ?? '')}
        onValueChange={name => {
          const id = field.options!.find(o => o.name === name)?.id
          if (id) saveField(id)
        }}
        disabled={saving}
      >
        <SelectTrigger className="h-6 text-xs w-full">
          <SelectValue placeholder="Selecionar..." />
        </SelectTrigger>
        <SelectContent>
          {field.options.map(opt => (
            <SelectItem key={opt.id} value={opt.name}>
              <div className="flex items-center gap-1.5">
                {opt.color && <span className="size-2 rounded-full" style={{ background: opt.color.startsWith('#') ? opt.color : `#${opt.color}` }} />}
                {opt.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field.type === 'iteration' && field.iterations) {
    return (
      <Select
        value={String(field.value ?? '')}
        onValueChange={title => {
          const id = field.iterations!.find(it => it.title === title)?.id
          if (id) saveField(id)
        }}
        disabled={saving}
      >
        <SelectTrigger className="h-6 text-xs w-full"><SelectValue placeholder="Iteração..." /></SelectTrigger>
        <SelectContent>{field.iterations.map(it => <SelectItem key={it.id} value={it.title}>{it.title}</SelectItem>)}</SelectContent>
      </Select>
    )
  }

  if (!editing) {
    const display = field.type === 'date' && field.value
      ? formatDate(String(field.value))
      : field.value
    return (
      <button onClick={() => { setEditValue(String(field.value ?? '')); setEditing(true) }}
        className="text-xs text-foreground hover:text-muted-foreground text-left w-full flex items-center gap-1 group">
        <span className="truncate">{display ?? <span className="text-muted-foreground italic">—</span>}</span>
        <Pencil className="size-2.5 opacity-0 group-hover:opacity-100 shrink-0" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Input type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
        value={editValue} onChange={e => setEditValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') saveField(editValue); if (e.key === 'Escape') setEditing(false) }}
        className="h-6 text-xs flex-1" autoFocus />
      <Button variant="ghost" size="icon-xs" onClick={() => saveField(editValue)} disabled={saving}><Check className="size-3" /></Button>
      <Button variant="ghost" size="icon-xs" onClick={() => setEditing(false)}><X className="size-3" /></Button>
    </div>
  )
}

function fieldIcon(type: string): React.ElementType {
  switch (type) {
    case 'single_select': return ListChecks
    case 'text': return Type
    case 'number': return Hash
    case 'date': case 'iteration': return Calendar
    default: return Tag
  }
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function IssueDetailView({ issueNumber, onBack }: { issueNumber: number; onBack: () => void }) {
  const [issue, setIssue] = useState<IssueDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editingBody, setEditingBody] = useState(false)
  const [editBody, setEditBody] = useState('')
  const [newComment, setNewComment] = useState('')

  const fetchIssue = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/github/issue/${issueNumber}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setIssue(json); setEditTitle(json.title); setEditBody(json.body)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [issueNumber])

  useEffect(() => { fetchIssue() }, [fetchIssue])

  const patchIssue = useCallback(async (payload: Record<string, unknown>) => {
    setSaving(true); setSaveMessage(null)
    try {
      const res = await fetch(`/api/github/issue/${issueNumber}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setSaveMessage('Salvo!'); setTimeout(() => setSaveMessage(null), 2000)
      await fetchIssue()
    } catch (e) {
      setSaveMessage(`Erro: ${e instanceof Error ? e.message : String(e)}`)
      setTimeout(() => setSaveMessage(null), 4000)
    } finally { setSaving(false) }
  }, [issueNumber, fetchIssue])

  const saveTitle = () => { if (editTitle.trim() && editTitle !== issue?.title) patchIssue({ title: editTitle.trim() }); setEditingTitle(false) }
  const saveBody = () => { if (editBody !== issue?.body) patchIssue({ body: editBody }); setEditingBody(false) }
  const toggleState = () => { if (!issue) return; patchIssue({ state: issue.state === 'OPEN' ? 'closed' : 'open' }) }
  const toggleAssignee = (login: string, active: boolean) => {
    if (!issue) return
    const current = issue.assignees.map(a => a.login)
    patchIssue({ assignees: active ? [...current, login] : current.filter(a => a !== login) })
  }
  const toggleLabel = (labelName: string, active: boolean) => {
    if (!issue) return
    const currentNames = issue.labels.map(l => l.name)
    patchIssue({ labels: active ? [...currentNames, labelName] : currentNames.filter(n => n !== labelName) })
  }
  const submitComment = () => { if (!newComment.trim()) return; patchIssue({ comment: newComment.trim() }); setNewComment('') }

  const isOpen = issue?.state === 'OPEN'

  return (
    <div className="flex flex-col h-full text-sm">

      {/* ── Top bar ── */}
      <div className="shrink-0 border-b border-border px-3 py-2 flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={onBack}><ArrowLeft className="size-4" /></Button>
        <span className="text-xs text-muted-foreground font-mono flex-1">#{issueNumber}</span>
        {saving && <span className="text-[10px] text-muted-foreground animate-pulse">Salvando...</span>}
        {saveMessage && (
          <span className={`text-[10px] ${saveMessage.startsWith('Erro') ? 'text-destructive' : 'text-green-500'}`}>{saveMessage}</span>
        )}
        {issue && (
          <Button variant="ghost" size="icon-xs" onClick={() => window.open(issue.url, '_blank', 'noopener,noreferrer')} title="Abrir no GitHub">
            <ExternalLink className="size-3.5" />
          </Button>
        )}
      </div>

      {loading && <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">Carregando...</div>}
      {!loading && error && <div className="flex-1 flex items-center justify-center text-xs text-destructive p-4 text-center">{error}</div>}

      {!loading && !error && issue && (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-3">

            {/* ── Título ── */}
            <div>
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                    className="text-base font-semibold" autoFocus />
                  <Button variant="ghost" size="icon-sm" onClick={saveTitle} disabled={saving}><Save className="size-4" /></Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => { setEditTitle(issue.title); setEditingTitle(false) }}><X className="size-4" /></Button>
                </div>
              ) : (
                <div className="group flex items-start gap-1.5">
                  <h2 className="text-base font-semibold text-foreground leading-snug flex-1">
                    {issue.title}
                    <span className="text-muted-foreground font-normal ml-1.5">#{issue.number}</span>
                  </h2>
                  <Button variant="ghost" size="icon-xs" onClick={() => setEditingTitle(true)}
                    className="opacity-0 group-hover:opacity-100 shrink-0 mt-0.5">
                    <Pencil className="size-3" />
                  </Button>
                </div>
              )}

              {/* Status + badges */}
              <div className="flex items-center flex-wrap gap-1.5 mt-2">
                <button onClick={toggleState} disabled={saving}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-90 ${isOpen ? 'bg-green-600' : 'bg-purple-600'}`}>
                  {isOpen ? <CircleDot className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                  {isOpen ? 'Open' : 'Closed'}
                </button>
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{issue.author.login}</span>
                  {' abriu '}{relativeTime(issue.createdAt)}
                  {' · '}{issue.commentCount} comentário{issue.commentCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* ── Dois colunas ── */}
            <div className="flex gap-4 items-start">

              {/* ── Coluna principal ── */}
              <div className="flex-1 min-w-0 space-y-3">

                {/* Body card */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between bg-muted/30 border-b border-border px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {issue.author.avatarUrl && <Avatar src={issue.author.avatarUrl} login={issue.author.login} size="sm" />}
                      <span className="text-xs">
                        <span className="font-semibold text-foreground">{issue.author.login}</span>
                        <span className="text-muted-foreground"> comentou {relativeTime(issue.createdAt)}</span>
                      </span>
                    </div>
                    {!editingBody && (
                      <Button variant="ghost" size="icon-xs" onClick={() => setEditingBody(true)} className="text-muted-foreground hover:text-foreground">
                        <Pencil className="size-3" />
                      </Button>
                    )}
                  </div>
                  <div className="p-3">
                    {editingBody ? (
                      <div className="space-y-2">
                        <Textarea value={editBody} onChange={e => setEditBody(e.target.value)}
                          className="min-h-[120px] text-xs font-mono" placeholder="Descrição (Markdown)" />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveBody} disabled={saving} className="gap-1 h-7 text-xs">
                            <Save className="size-3" /> Salvar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setEditBody(issue.body); setEditingBody(false) }} className="h-7 text-xs">
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : issue.bodyHTML ? (
                      <div className="issue-body text-xs text-foreground leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: issue.bodyHTML }} />
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Sem descrição.</p>
                    )}
                  </div>
                </div>

                {/* Comments */}
                {issue.comments.map(comment => (
                  <div key={comment.id} className="border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-1.5 bg-muted/30 border-b border-border px-3 py-1.5">
                      {comment.author.avatarUrl && <Avatar src={comment.author.avatarUrl} login={comment.author.login} size="sm" />}
                      <span className="text-xs">
                        <span className="font-semibold text-foreground">{comment.author.login}</span>
                        <span className="text-muted-foreground"> comentou {relativeTime(comment.createdAt)}</span>
                      </span>
                      {comment.updatedAt !== comment.createdAt && (
                        <span className="text-[10px] text-muted-foreground ml-auto">(editado)</span>
                      )}
                    </div>
                    <div className="p-3 issue-body text-xs text-foreground leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: comment.bodyHTML }} />
                  </div>
                ))}

                {/* Add comment */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {issue.author.avatarUrl && <Avatar src={issue.author.avatarUrl} login={issue.author.login} size="sm" />}
                    <span className="text-xs font-semibold text-foreground">Adicionar comentário</span>
                  </div>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="flex border-b border-border bg-muted/20">
                      <span className="px-3 py-1.5 text-xs font-medium border-b-2 border-foreground">Write</span>
                    </div>
                    <Textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment() }}
                      placeholder="Use Markdown para formatar seu comentário&#10;(Ctrl+Enter para enviar)"
                      className="min-h-[80px] text-xs border-0 rounded-none focus-visible:ring-0 resize-none" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm" onClick={toggleState} disabled={saving} className="h-7 text-xs gap-1">
                      {isOpen ? <><GitMerge className="size-3" /> Fechar issue</> : <><CircleDot className="size-3" /> Reabrir issue</>}
                    </Button>
                    <Button size="sm" onClick={submitComment} disabled={saving || !newComment.trim()} className="h-7 text-xs gap-1">
                      <Send className="size-3" /> Comentar
                    </Button>
                  </div>
                </div>
              </div>

              {/* ── Sidebar ── */}
              <div className="w-[190px] shrink-0 text-xs space-y-0">

                {/* Assignees */}
                <SidebarSection title="Assignees" action={
                  <AssigneePicker
                    currentAssignees={issue.assignees}
                    collaborators={issue.repoCollaborators ?? []}
                    onToggle={toggleAssignee}
                    disabled={saving}
                  />
                }>
                  {issue.assignees.length === 0 ? (
                    <p className="text-muted-foreground italic">Nenhum</p>
                  ) : (
                    <div className="space-y-1.5">
                      {issue.assignees.map(a => (
                        <div key={a.login} className="flex items-center gap-1.5 group">
                          {a.avatarUrl && <Avatar src={a.avatarUrl} login={a.login} size="sm" />}
                          <span className="text-foreground font-medium flex-1 truncate">{a.login}</span>
                          <button onClick={() => toggleAssignee(a.login, false)} disabled={saving}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0">
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </SidebarSection>

                {/* Labels */}
                <SidebarSection title="Labels" action={
                  <LabelPicker currentLabels={issue.labels} repoLabels={issue.repoLabels} onToggle={toggleLabel} disabled={saving} />
                }>
                  {issue.labels.length === 0 ? (
                    <p className="text-muted-foreground italic">Nenhuma</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {issue.labels.map(l => (
                        <LabelBadge key={l.name} name={l.name} color={l.color} onRemove={() => toggleLabel(l.name, false)} />
                      ))}
                    </div>
                  )}
                </SidebarSection>

                {/* Projects */}
                {issue.projectFields.length > 0 && (
                  <SidebarSection title={issue.projectTitle || 'Projeto'}>
                    <div className="space-y-2">
                      {issue.projectFields.map(field => (
                        <div key={field.fieldId}>
                          <p className="text-[10px] text-muted-foreground mb-0.5">{field.name}</p>
                          {issue.projectItemId ? (
                            <ProjectFieldEditor field={field} projectItemId={issue.projectItemId} onUpdate={patchIssue} saving={saving} />
                          ) : (
                            <span className="text-foreground">{String(field.value ?? '—')}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </SidebarSection>
                )}

                {/* Milestone */}
                {issue.milestone && (
                  <SidebarSection title="Milestone">
                    <div className="flex items-center gap-1">
                      <Milestone className="size-3 text-muted-foreground shrink-0" />
                      <span className="text-foreground truncate">{issue.milestone}</span>
                    </div>
                    {issue.milestoneDueOn && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Vence {formatDate(issue.milestoneDueOn)}</p>
                    )}
                  </SidebarSection>
                )}

                {/* Development (branches) */}
                {issue.linkedBranches.length > 0 && (
                  <SidebarSection title="Development">
                    <div className="space-y-1">
                      {issue.linkedBranches.map(b => (
                        <div key={b} className="flex items-center gap-1 text-primary">
                          <GitBranch className="size-3 shrink-0" />
                          <span className="truncate text-[10px]">{b}</span>
                        </div>
                      ))}
                    </div>
                  </SidebarSection>
                )}

              </div>
            </div>

          </div>
        </ScrollArea>
      )}
    </div>
  )
}
