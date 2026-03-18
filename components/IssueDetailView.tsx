'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  ArrowLeft, ExternalLink, MessageSquare, Clock, User, Milestone,
  Pencil, Save, X, Plus, Send, Check, GitBranch, Tag, Hash,
  Calendar, Type, ListChecks, Pin, Heart, Link2, ChevronDown
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

interface RepoLabel {
  name: string
  color: string
  description: string
}

interface IssueDetail {
  id: string
  number: number
  title: string
  body: string
  bodyHTML: string
  state: string
  stateReason: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  url: string
  isPinned: boolean
  reactionCount: number
  referenceCount: number
  milestone: string | null
  milestoneDueOn: string | null
  linkedBranches: string[]
  author: { login: string; avatarUrl: string }
  assignees: { login: string; avatarUrl: string }[]
  labels: { name: string; color: string }[]
  repoLabels: RepoLabel[]
  comments: IssueComment[]
  commentCount: number
  projectItemId: string | null
  projectTitle: string | null
  projectFields: ProjectField[]
}

interface IssueComment {
  id: string
  body: string
  bodyHTML: string
  createdAt: string
  updatedAt: string
  reactionCount: number
  author: { login: string; avatarUrl: string }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min atras`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atras`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d atras`
  return `${Math.floor(d / 30)}m atras`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function LabelBadge({ name, color, onRemove }: { name: string; color: string; onRemove?: () => void }) {
  const fg = parseInt(color, 16) > 0x888888 ? '#111' : '#fff'
  return (
    <Badge
      variant="outline"
      style={{ background: `#${color}`, color: fg, borderColor: 'transparent' }}
      className="rounded-full font-semibold gap-1"
    >
      {name}
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove() }} className="hover:opacity-70 ml-0.5">
          <X className="size-2.5" />
        </button>
      )}
    </Badge>
  )
}

function Avatar({ src, login, size = 'md' }: { src: string; login: string; size?: 'sm' | 'md' }) {
  const px = size === 'sm' ? 'size-5' : 'size-7'
  return <img src={src} alt={login} className={`${px} rounded-full ring-1 ring-border`} />
}

// ── Label Picker (estilo GitHub) ─────────────────────────────────────────────
function LabelPicker({
  currentLabels,
  repoLabels,
  onToggle,
  disabled,
}: {
  currentLabels: { name: string; color: string }[]
  repoLabels: RepoLabel[]
  onToggle: (labelName: string, active: boolean) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const currentSet = useMemo(() => new Set(currentLabels.map(l => l.name)), [currentLabels])

  const filtered = useMemo(() => {
    if (!search) return repoLabels
    const q = search.toLowerCase()
    return repoLabels.filter(l =>
      l.name.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)
    )
  }, [repoLabels, search])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-xs" disabled={disabled} className="text-muted-foreground hover:text-foreground" />
        }
      >
        <Pencil className="size-3" />
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" side="bottom" align="start">
        <div className="px-3 py-2 border-b border-border">
          <p className="text-xs font-medium text-foreground mb-1.5">Aplicar labels</p>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar labels..."
            className="h-7 text-xs"
            autoFocus
          />
        </div>
        <ScrollArea className="max-h-[250px]">
          <div className="py-1">
            {filtered.map(label => {
              const active = currentSet.has(label.name)
              return (
                <button
                  key={label.name}
                  onClick={() => { onToggle(label.name, !active) }}
                  disabled={disabled}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent transition-colors text-sm"
                >
                  <div className="size-4 flex items-center justify-center shrink-0">
                    {active && <Check className="size-3.5 text-foreground" />}
                  </div>
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ background: `#${label.color}` }}
                  />
                  <span className="flex-1 truncate text-foreground">{label.name}</span>
                  {label.description && (
                    <span className="text-xs text-muted-foreground truncate max-w-[80px]">{label.description}</span>
                  )}
                </button>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhuma label encontrada</p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

// ── Sidebar field (layout padrao) ────────────────────────────────────────────
function SidebarField({ icon: Icon, label, children }: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <Icon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {children}
      </div>
    </div>
  )
}

// ── Project field editor ─────────────────────────────────────────────────────
function ProjectFieldEditor({
  field,
  projectItemId,
  onUpdate,
  saving,
}: {
  field: ProjectField
  projectItemId: string
  onUpdate: (payload: Record<string, unknown>) => void
  saving: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(String(field.value ?? ''))

  const saveField = (value: string) => {
    onUpdate({
      projectItemId,
      projectField: { fieldId: field.fieldId, type: field.type, value },
    })
    setEditing(false)
  }

  // Single select
  if (field.type === 'single_select' && field.options) {
    return (
      <Select
        value={field.options.find(o => o.name === field.value)?.id || ''}
        onValueChange={(val) => { if (val) saveField(val) }}
        disabled={saving}
      >
        <SelectTrigger className="h-7 w-full text-xs">
          <SelectValue placeholder="Selecionar..." />
        </SelectTrigger>
        <SelectContent>
          {field.options.map(opt => (
            <SelectItem key={opt.id} value={opt.id}>
              <div className="flex items-center gap-1.5">
                {opt.color && (
                  <span className="size-2 rounded-full shrink-0" style={{ background: opt.color.startsWith('#') ? opt.color : `#${opt.color}` }} />
                )}
                {opt.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // Iteration
  if (field.type === 'iteration' && field.iterations) {
    return (
      <Select
        value={field.iterations.find(it => it.title === field.value)?.id || ''}
        onValueChange={(val) => { if (val) saveField(val) }}
        disabled={saving}
      >
        <SelectTrigger className="h-7 w-full text-xs">
          <SelectValue placeholder="Selecionar iteracao..." />
        </SelectTrigger>
        <SelectContent>
          {field.iterations.map(it => (
            <SelectItem key={it.id} value={it.id}>{it.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // Text / Number / Date — inline edit
  if (!editing) {
    return (
      <button
        onClick={() => { setEditValue(String(field.value ?? '')); setEditing(true) }}
        className="text-sm text-foreground hover:text-muted-foreground transition-colors text-left w-full group flex items-center gap-1"
      >
        <span className="truncate">{field.value ?? <span className="text-muted-foreground italic">Vazio</span>}</span>
        <Pencil className="size-3 opacity-0 group-hover:opacity-100 text-muted-foreground shrink-0" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') saveField(editValue); if (e.key === 'Escape') setEditing(false) }}
        className="h-7 text-xs flex-1"
        autoFocus
      />
      <Button variant="ghost" size="icon-xs" onClick={() => saveField(editValue)} disabled={saving}>
        <Check className="size-3" />
      </Button>
      <Button variant="ghost" size="icon-xs" onClick={() => setEditing(false)}>
        <X className="size-3" />
      </Button>
    </div>
  )
}

// ── Icone por tipo de campo ──────────────────────────────────────────────────
function fieldIcon(type: string): React.ElementType {
  switch (type) {
    case 'single_select': return ListChecks
    case 'text': return Type
    case 'number': return Hash
    case 'date': return Calendar
    case 'iteration': return Calendar
    default: return Tag
  }
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function IssueDetailView({
  issueNumber,
  onBack,
}: {
  issueNumber: number
  onBack: () => void
}) {
  const [issue, setIssue] = useState<IssueDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // Campos editaveis
  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editingBody, setEditingBody] = useState(false)
  const [editBody, setEditBody] = useState('')
  const [editingAssignees, setEditingAssignees] = useState(false)
  const [assigneeInput, setAssigneeInput] = useState('')
  const [newComment, setNewComment] = useState('')

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchIssue = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/github/issue/${issueNumber}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setIssue(json)
      setEditTitle(json.title)
      setEditBody(json.body)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [issueNumber])

  useEffect(() => { fetchIssue() }, [fetchIssue])

  // ── Save helper ──────────────────────────────────────────────────────────
  const patchIssue = useCallback(async (payload: Record<string, unknown>) => {
    setSaving(true)
    setSaveMessage(null)
    try {
      const res = await fetch(`/api/github/issue/${issueNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setSaveMessage('Salvo!')
      setTimeout(() => setSaveMessage(null), 2000)
      await fetchIssue()
    } catch (e) {
      setSaveMessage(`Erro: ${e instanceof Error ? e.message : String(e)}`)
      setTimeout(() => setSaveMessage(null), 4000)
    } finally {
      setSaving(false)
    }
  }, [issueNumber, fetchIssue])

  // ── Actions ──────────────────────────────────────────────────────────────
  const saveTitle = () => {
    if (editTitle.trim() && editTitle !== issue?.title) patchIssue({ title: editTitle.trim() })
    setEditingTitle(false)
  }

  const saveBody = () => {
    if (editBody !== issue?.body) patchIssue({ body: editBody })
    setEditingBody(false)
  }

  const toggleState = () => {
    if (!issue) return
    patchIssue({ state: issue.state === 'OPEN' ? 'closed' : 'open' })
  }

  const addAssignee = () => {
    if (!issue || !assigneeInput.trim()) return
    const current = issue.assignees.map(a => a.login)
    if (!current.includes(assigneeInput.trim())) {
      patchIssue({ assignees: [...current, assigneeInput.trim()] })
    }
    setAssigneeInput('')
    setEditingAssignees(false)
  }

  const removeAssignee = (login: string) => {
    if (!issue) return
    patchIssue({ assignees: issue.assignees.map(a => a.login).filter(a => a !== login) })
  }

  const toggleLabel = (labelName: string, active: boolean) => {
    if (!issue) return
    const currentNames = issue.labels.map(l => l.name)
    const newLabels = active
      ? [...currentNames, labelName]
      : currentNames.filter(n => n !== labelName)
    patchIssue({ labels: newLabels })
  }

  const submitComment = () => {
    if (!newComment.trim()) return
    patchIssue({ comment: newComment.trim() })
    setNewComment('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 py-3 flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold text-foreground truncate flex-1">
          #{issueNumber}
        </span>
        {saving && <Badge variant="secondary" className="text-xs shrink-0 animate-pulse">Salvando...</Badge>}
        {saveMessage && (
          <Badge variant={saveMessage.startsWith('Erro') ? 'destructive' : 'secondary'} className="text-xs shrink-0">
            {saveMessage}
          </Badge>
        )}
      </div>

      {/* Body */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {loading && (
            <div className="text-center text-muted-foreground py-12 text-sm">Carregando detalhes...</div>
          )}
          {!loading && error && (
            <div className="text-center text-destructive py-12 text-sm">{error}</div>
          )}

          {!loading && !error && issue && (
            <div className="space-y-4">

              {/* ── Titulo editavel ── */}
              <div>
                {editingTitle ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                      className="text-base font-semibold"
                      autoFocus
                    />
                    <Button variant="ghost" size="icon-sm" onClick={saveTitle} disabled={saving}>
                      <Save className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => { setEditTitle(issue.title); setEditingTitle(false) }}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="group flex items-start gap-2">
                    <h2 className="text-lg font-semibold text-foreground leading-snug flex-1">
                      {issue.title}
                    </h2>
                    <Button
                      variant="ghost" size="icon-xs"
                      onClick={() => setEditingTitle(true)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1"
                    >
                      <Pencil className="size-3" />
                    </Button>
                  </div>
                )}

                {/* Estado + meta rapida */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Button
                    variant={issue.state === 'OPEN' ? 'default' : 'secondary'}
                    size="sm"
                    onClick={toggleState}
                    disabled={saving}
                    className="gap-1 h-6 text-xs"
                  >
                    {issue.state === 'OPEN' ? 'Aberta' : 'Fechada'}
                  </Button>
                  {issue.isPinned && (
                    <Badge variant="outline" className="gap-1 text-xs"><Pin className="size-3" /> Fixada</Badge>
                  )}
                  {issue.reactionCount > 0 && (
                    <Badge variant="outline" className="gap-1 text-xs"><Heart className="size-3" /> {issue.reactionCount}</Badge>
                  )}
                  {issue.referenceCount > 0 && (
                    <Badge variant="outline" className="gap-1 text-xs"><Link2 className="size-3" /> {issue.referenceCount} ref</Badge>
                  )}
                </div>
              </div>

              <Separator />

              {/* ── Sidebar de meta ── */}
              <div className="space-y-0.5">

                {/* Autor */}
                <SidebarField icon={User} label="Autor">
                  <div className="flex items-center gap-1.5">
                    {issue.author.avatarUrl && <Avatar src={issue.author.avatarUrl} login={issue.author.login} size="sm" />}
                    <span className="text-sm text-foreground font-medium">{issue.author.login}</span>
                  </div>
                </SidebarField>

                {/* Assignees */}
                <SidebarField icon={User} label="Assignees">
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {issue.assignees.map(a => (
                      <Badge key={a.login} variant="secondary" className="gap-1.5 pr-1">
                        {a.avatarUrl && <Avatar src={a.avatarUrl} login={a.login} size="sm" />}
                        <span className="text-xs">{a.login}</span>
                        <button onClick={() => removeAssignee(a.login)} disabled={saving} className="hover:text-destructive ml-0.5">
                          <X className="size-2.5" />
                        </button>
                      </Badge>
                    ))}
                    {issue.assignees.length === 0 && !editingAssignees && (
                      <span className="text-xs text-muted-foreground italic">Nenhum</span>
                    )}
                    <Button variant="ghost" size="icon-xs" onClick={() => setEditingAssignees(!editingAssignees)} className="text-muted-foreground">
                      <Plus className="size-3" />
                    </Button>
                  </div>
                  {editingAssignees && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <Input
                        value={assigneeInput}
                        onChange={(e) => setAssigneeInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') addAssignee(); if (e.key === 'Escape') setEditingAssignees(false) }}
                        placeholder="username"
                        className="h-7 text-xs flex-1"
                        autoFocus
                      />
                      <Button size="sm" onClick={addAssignee} disabled={saving} className="h-7 text-xs">Add</Button>
                    </div>
                  )}
                </SidebarField>

                {/* Labels */}
                <SidebarField icon={Tag} label="Labels">
                  <div className="flex flex-wrap gap-1 items-center">
                    {issue.labels.map(l => (
                      <LabelBadge
                        key={l.name}
                        name={l.name}
                        color={l.color}
                        onRemove={() => toggleLabel(l.name, false)}
                      />
                    ))}
                    {issue.labels.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">Nenhuma</span>
                    )}
                    <LabelPicker
                      currentLabels={issue.labels}
                      repoLabels={issue.repoLabels}
                      onToggle={toggleLabel}
                      disabled={saving}
                    />
                  </div>
                </SidebarField>

                {/* Datas */}
                <SidebarField icon={Clock} label="Datas">
                  <div className="text-xs text-foreground space-y-0.5">
                    <div>Criada em <span className="text-muted-foreground">{formatDate(issue.createdAt)} ({relativeTime(issue.createdAt)})</span></div>
                    <div>Atualizada <span className="text-muted-foreground">{relativeTime(issue.updatedAt)}</span></div>
                    {issue.closedAt && <div>Fechada em <span className="text-muted-foreground">{formatDate(issue.closedAt)}</span></div>}
                  </div>
                </SidebarField>

                {/* Milestone */}
                {issue.milestone && (
                  <SidebarField icon={Milestone} label="Milestone">
                    <div className="text-sm text-foreground">
                      {issue.milestone}
                      {issue.milestoneDueOn && (
                        <span className="text-xs text-muted-foreground ml-1.5">
                          (vence {formatDate(issue.milestoneDueOn)})
                        </span>
                      )}
                    </div>
                  </SidebarField>
                )}

                {/* Branches vinculadas */}
                {issue.linkedBranches.length > 0 && (
                  <SidebarField icon={GitBranch} label="Branches">
                    <div className="flex flex-wrap gap-1">
                      {issue.linkedBranches.map(b => (
                        <Badge key={b} variant="secondary" className="text-xs gap-1">
                          <GitBranch className="size-3" />
                          {b}
                        </Badge>
                      ))}
                    </div>
                  </SidebarField>
                )}
              </div>

              {/* ── Campos do projeto ── */}
              {issue.projectFields.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      {issue.projectTitle || 'Projeto'}
                    </p>
                    <div className="space-y-0.5">
                      {issue.projectFields.map(field => (
                        <SidebarField key={field.fieldId} icon={fieldIcon(field.type)} label={field.name}>
                          {issue.projectItemId ? (
                            <ProjectFieldEditor
                              field={field}
                              projectItemId={issue.projectItemId}
                              onUpdate={patchIssue}
                              saving={saving}
                            />
                          ) : (
                            <span className="text-sm text-foreground">{String(field.value ?? '-')}</span>
                          )}
                        </SidebarField>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* ── Body editavel ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descricao</span>
                  {!editingBody && (
                    <Button variant="ghost" size="sm" onClick={() => setEditingBody(true)} className="gap-1 h-6 text-xs">
                      <Pencil className="size-3" /> Editar
                    </Button>
                  )}
                </div>

                {editingBody ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="min-h-[150px] text-sm font-mono"
                      placeholder="Descricao (Markdown)"
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={saveBody} disabled={saving} className="gap-1">
                        <Save className="size-3.5" /> Salvar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setEditBody(issue.body); setEditingBody(false) }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : issue.bodyHTML ? (
                  <div
                    className="issue-body text-sm text-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: issue.bodyHTML }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sem descricao.</p>
                )}
              </div>

              {/* ── Comentarios ── */}
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    Comentarios ({issue.commentCount})
                  </span>
                </div>

                {issue.comments.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {issue.comments.map(comment => (
                      <Card key={comment.id} size="sm" className="px-3 py-2.5 gap-2">
                        <div className="flex items-center gap-2">
                          {comment.author.avatarUrl && (
                            <Avatar src={comment.author.avatarUrl} login={comment.author.login} size="sm" />
                          )}
                          <span className="text-sm font-medium text-foreground">{comment.author.login}</span>
                          <span className="text-xs text-muted-foreground">{relativeTime(comment.createdAt)}</span>
                          {comment.updatedAt !== comment.createdAt && (
                            <span className="text-xs text-muted-foreground">(editado)</span>
                          )}
                          {comment.reactionCount > 0 && (
                            <Badge variant="outline" className="text-xs gap-0.5 ml-auto">
                              <Heart className="size-2.5" /> {comment.reactionCount}
                            </Badge>
                          )}
                        </div>
                        <div
                          className="issue-body text-sm text-foreground leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: comment.bodyHTML }}
                        />
                      </Card>
                    ))}
                  </div>
                )}

                {/* Novo comentario */}
                <div className="space-y-2">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment()
                    }}
                    placeholder="Escrever comentario... (Ctrl+Enter para enviar)"
                    className="min-h-[80px] text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={submitComment}
                    disabled={saving || !newComment.trim()}
                    className="gap-1"
                  >
                    <Send className="size-3.5" /> Comentar
                  </Button>
                </div>
              </div>

              {/* Link externo */}
              <Separator />
              <Button
                variant="outline" size="sm" className="w-full gap-2"
                onClick={() => window.open(issue.url, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="size-3.5" /> Abrir no GitHub
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
