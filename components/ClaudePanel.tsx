'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import SidePanel from './SidePanel'

// ── Ferramentas da IA ─────────────────────────────────────────────────────────

interface AiTool {
  id: string
  label: string
  description: string
  enabled: boolean
  requiresEnv: string[]
}

function ToolsTab() {
  const [tools, setTools] = useState<AiTool[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  async function fetchTools() {
    setLoading(true)
    const res = await fetch('/api/ai-tools')
    const data = await res.json()
    setTools(data.tools ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchTools() }, [])

  async function toggle(toolId: string) {
    setSaving(toolId)
    await fetch('/api/ai-tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolId }),
    })
    await fetchTools()
    setSaving(null)
  }

  if (loading) return <div className="py-8 text-center text-xs text-muted-foreground">Carregando...</div>

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Ferramentas que a IA pode usar para responder suas perguntas.
      </p>
      <div className="space-y-2">
        {tools.map(tool => (
          <div
            key={tool.id}
            className={`rounded border px-3 py-2.5 space-y-1 transition-opacity ${tool.enabled ? 'border-border' : 'border-border/40 opacity-60'}`}
          >
            <div className="flex items-center gap-2">
              <span className="flex-1 text-xs font-semibold text-foreground">{tool.label}</span>
              <Badge variant={tool.enabled ? 'default' : 'outline'} className="text-[9px] h-4">
                {tool.enabled ? 'ativo' : 'off'}
              </Badge>
              <Button
                variant="ghost"
                size="icon-xs"
                className="h-6 w-6 shrink-0"
                disabled={saving === tool.id}
                onClick={() => toggle(tool.id)}
                title={tool.enabled ? 'Desativar' : 'Ativar'}
              >
                {saving === tool.id ? '…' : tool.enabled ? '⏸' : '▶'}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">{tool.description}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground pt-1">
        As alterações entram em vigor imediatamente na próxima mensagem.
      </p>
    </div>
  )
}

const AVAILABLE_MODELS = [
  // ── GPT-5.x ──
  { id: 'gpt-5.4', label: 'GPT-5.4' },
  { id: 'gpt-5.4-pro', label: 'GPT-5.4 Pro' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
  { id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano' },
  { id: 'gpt-5.2', label: 'GPT-5.2' },
  { id: 'gpt-5.2-pro', label: 'GPT-5.2 Pro' },
  { id: 'gpt-5.1', label: 'GPT-5.1' },
  { id: 'gpt-5', label: 'GPT-5' },
  { id: 'gpt-5-pro', label: 'GPT-5 Pro' },
  { id: 'gpt-5-mini', label: 'GPT-5 Mini' },
  { id: 'gpt-5-nano', label: 'GPT-5 Nano' },
  // ── GPT-4.x ──
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { id: 'gpt-4', label: 'GPT-4' },
  // ── Reasoning (o-series) ──
  { id: 'o4-mini', label: 'o4 Mini' },
  { id: 'o3-pro', label: 'o3 Pro' },
  { id: 'o3', label: 'o3' },
  { id: 'o3-mini', label: 'o3 Mini' },
  { id: 'o1', label: 'o1' },
  { id: 'o1-pro', label: 'o1 Pro' },
  // ── GPT-3.5 ──
  { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
]

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  onClose: () => void
}

export default function ClaudePanel({ onClose }: Props) {
  const [tab, setTab] = useState<'chat' | 'mcp'>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState('gpt-4.1')
  const [database, setDatabase] = useState<'dev' | 'prod'>('dev')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, model, database }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao chamar a API')
      }

      if (!data.response) {
        throw new Error('A IA não retornou nenhuma resposta. Tente novamente ou mude o modelo.')
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }, [input, messages, loading, model, database])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
    setError(null)
  }

  return (
    <SidePanel defaultWidth={420}>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">IA do Paulo</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            + PostgreSQL
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {tab === 'chat' && messages.length > 0 && (
            <Button variant="ghost" size="icon-xs" onClick={clearChat} title="Limpar conversa">
              <span className="text-xs">🗑</span>
            </Button>
          )}
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            x
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex border-b border-border">
        <button
          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${tab === 'chat' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('chat')}
        >
          Chat
        </button>
        <button
          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${tab === 'mcp' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('mcp')}
        >
          Ferramentas
        </button>
      </div>

      {/* MCP tab */}
      {tab === 'mcp' && (
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">
            <ToolsTab />
          </div>
        </ScrollArea>
      )}

      {/* Chat tab */}
      {tab === 'chat' && (
        <>
          {/* Model + Database selector */}
          <div className="shrink-0 border-b border-border px-4 py-2 flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Modelo</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="w-[100px]">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Banco</label>
              <select
                value={database}
                onChange={(e) => setDatabase(e.target.value as 'dev' | 'prod')}
                className={`mt-1 w-full rounded-md border px-2 py-1.5 text-xs font-medium outline-none focus:ring-1 focus:ring-ring ${
                  database === 'prod'
                    ? 'border-destructive/50 bg-destructive/10 text-destructive'
                    : 'border-border bg-secondary text-foreground'
                }`}
              >
                <option value="dev">Dev</option>
                <option value="prod">Prod</option>
              </select>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-3">
              {messages.length === 0 && !loading && (
                <div className="pt-8 text-center text-xs text-muted-foreground space-y-2">
                  <p className="font-medium">Fale com a IA do Paulo</p>
                  <p>Pergunte qualquer coisa ou consulte o banco de dados PostgreSQL.</p>
                  <div className="mt-4 space-y-1 text-left text-[10px] text-muted-foreground/70">
                    <p>Exemplos:</p>
                    <p className="pl-2">&quot;Liste as tabelas do banco&quot;</p>
                    <p className="pl-2">&quot;Quantos registros tem na tabela users?&quot;</p>
                    <p className="pl-2">&quot;Me ajude a escrever uma query&quot;</p>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => {
                const isUser = msg.role === 'user'
                return (
                  <div
                    key={i}
                    className={`mb-3 max-w-[95%] rounded-lg border p-3 ${
                      isUser ? 'ml-auto border-primary/30 bg-primary/10' : 'border-border bg-card'
                    }`}
                  >
                    <div className="mb-1 flex items-baseline gap-2">
                      <span className={`text-[11px] font-bold ${isUser ? 'text-primary' : 'text-violet-400'}`}>
                        {isUser ? 'Você' : 'IA do Paulo'}
                      </span>
                    </div>
                    <div className="text-xs leading-relaxed text-foreground break-words whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                )
              })}

              {loading && (
                <div className="mb-3 max-w-[95%] rounded-lg border border-border bg-card p-3">
                  <div className="mb-1">
                    <span className="text-[11px] font-bold text-violet-400">IA do Paulo</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="animate-pulse">Pensando</span>
                    <span className="animate-bounce">...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                  <span className="text-xs text-destructive">{error}</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="flex shrink-0 flex-col gap-2 border-t border-border p-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte à IA do Paulo... (Enter para enviar, Shift+Enter para nova linha)"
              className="min-h-[60px] max-h-[120px] resize-none text-xs"
              disabled={loading}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {AVAILABLE_MODELS.find(m => m.id === model)?.label}
                {' · '}
                <span className={database === 'prod' ? 'text-destructive font-medium' : ''}>
                  {database === 'prod' ? 'PROD' : 'DEV'}
                </span>
                {messages.length > 0 && ` · ${messages.length} msgs`}
              </span>
              <Button size="sm" onClick={sendMessage} disabled={!input.trim() || loading}>
                {loading ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </div>
        </>
      )}
    </SidePanel>
  )
}
