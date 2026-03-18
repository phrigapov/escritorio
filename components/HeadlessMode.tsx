'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import GitHubPanel from './GitHubPanel'

type PlayerStatus = 'online' | 'busy' | 'away'

interface User {
  username: string
  name?: string
  avatar?: string
  loginType: 'simple' | 'github'
}

interface ChatMessage {
  id: string
  username: string
  text: string
  timestamp: number
}

interface OnlinePlayer {
  id: string
  username: string
  status: PlayerStatus
  headless?: boolean
}

const STATUS_VARIANTS: Record<PlayerStatus, string> = {
  online: 'bg-green-500',
  busy:   'bg-red-500',
  away:   'bg-yellow-500',
}

const STATUS_LABELS: Record<PlayerStatus, string> = {
  online: 'Online',
  busy:   'Ocupado',
  away:   'Ausente',
}

const GLASS_ROOM_X = 150
const GLASS_ROOM_Y = 150

export default function HeadlessMode({ user, onSwitchMode, onLogout }: { user: User; onSwitchMode: () => void; onLogout?: () => void }) {
  const [messages, setMessages]   = useState<ChatMessage[]>([])
  const [input, setInput]         = useState('')
  const [players, setPlayers]     = useState<OnlinePlayer[]>([])
  const [status, setStatus]       = useState<PlayerStatus>('online')
  const [githubOpen, setGithubOpen] = useState(true)
  const [connected, setConnected] = useState(false)
  const socketRef    = useRef<Socket | null>(null)
  const chatEndRef   = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const mySocketId   = useRef<string>('')

  const displayName = user.name || user.username

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'
    const socket = io(url, { timeout: 3000, reconnection: true, reconnectionDelay: 500 })
    socketRef.current = socket

    socket.on('connect', () => {
      mySocketId.current = socket.id ?? ''
      setConnected(true)

      socket.emit('player-joined', {
        username:  displayName,
        x:         GLASS_ROOM_X,
        y:         GLASS_ROOM_Y,
        color:     0x667eea,
        headless:  true,
      })

      socket.emit('player-status-changed', { status: 'online' })
    })

    socket.on('disconnect', () => setConnected(false))

    socket.on('current-players', (playerMap: Record<string, any>) => {
      const list: OnlinePlayer[] = Object.entries(playerMap).map(([id, data]) => ({
        id,
        username: data.username,
        status:   (data.status as PlayerStatus) || 'online',
        headless: data.headless,
      }))
      setPlayers(list)
    })

    socket.on('new-player', ({ id, playerData }: { id: string; playerData: any }) => {
      setPlayers(prev => {
        if (prev.find(p => p.id === id)) return prev
        return [...prev, {
          id,
          username: playerData.username,
          status:   (playerData.status as PlayerStatus) || 'online',
          headless: playerData.headless,
        }]
      })
    })

    socket.on('player-disconnected', (id: string) => {
      setPlayers(prev => prev.filter(p => p.id !== id))
    })

    socket.on('player-status-changed', ({ id, status: s }: { id: string; status: PlayerStatus }) => {
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, status: s } : p))
    })

    socket.on('chat-message', (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-299), msg])
    })

    return () => {
      socket.disconnect()
    }
  }, [displayName])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(() => {
    const text = input.trim()
    if (!text || !socketRef.current) return
    socketRef.current.emit('chat-message', {
      username:  displayName,
      text,
      timestamp: Date.now(),
    })
    setInput('')
    inputRef.current?.focus()
  }, [input, displayName])

  const changeStatus = useCallback((s: PlayerStatus) => {
    setStatus(s)
    socketRef.current?.emit('player-status-changed', { status: s })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'g' || e.key === 'G') setGithubOpen(o => !o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Top bar */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
          {/* Glass room indicator */}
          <Badge variant="outline" className="gap-1.5">
            <span>Sala de Vidro</span>
            <span className="text-[10px] text-muted-foreground">modo dev</span>
          </Badge>

          {/* Name + status dot */}
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${STATUS_VARIANTS[status]}`} />
            <span className="text-sm font-bold">{displayName}</span>
            {user.loginType === 'github' && (
              <span className="text-[10px] text-muted-foreground">via GitHub</span>
            )}
          </div>

          {/* Connection indicator */}
          <Badge variant={connected ? 'outline' : 'destructive'} className="text-[10px] px-1.5 py-0 h-4">
            {connected ? 'Conectado' : 'Reconectando...'}
          </Badge>

          {/* Status buttons */}
          <div className="ml-auto flex gap-1.5">
            {(['online', 'busy', 'away'] as PlayerStatus[]).map(s => (
              <Button
                key={s}
                variant={status === s ? 'secondary' : 'ghost'}
                size="xs"
                onClick={() => changeStatus(s)}
              >
                {STATUS_LABELS[s]}
              </Button>
            ))}
          </div>

          <Button variant="outline" size="xs" onClick={onSwitchMode}>
            Modo Normal
          </Button>

          <Button
            variant={githubOpen ? 'secondary' : 'ghost'}
            size="xs"
            onClick={() => setGithubOpen(o => !o)}
          >
            GitHub (G)
          </Button>

          {onLogout && (
            <Button variant="ghost" size="xs" onClick={onLogout}>
              Sair
            </Button>
          )}
        </div>

        {/* Main area: players sidebar + chat */}
        <div className="flex min-h-0 flex-1">

          {/* Players sidebar */}
          <div className="flex w-[190px] shrink-0 flex-col overflow-y-auto border-r border-border">
            <div className="p-3">
              <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                No escritorio ({players.length + 1})
              </p>

              {/* Self */}
              <div className="mb-1 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-2 py-1.5">
                <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_VARIANTS[status]}`} />
                <span className="flex-1 truncate text-xs">{displayName}</span>
                <span className="text-[9px] text-primary">Dev</span>
              </div>

              {/* Other players */}
              {players.map(p => (
                <div key={p.id} className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5">
                  <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_VARIANTS[p.status] || 'bg-green-500'}`} />
                  <span className="flex-1 truncate text-xs text-muted-foreground">{p.username}</span>
                  {p.headless && (
                    <span className="text-[9px] text-primary" title="Modo Dev">Dev</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="flex min-w-0 flex-1 flex-col">

            {/* Messages */}
            <ScrollArea className="flex-1">
              <div className="p-4">
                {messages.length === 0 && (
                  <div className="pt-16 text-center text-xs text-muted-foreground">
                    Nenhuma mensagem ainda.
                    <br />
                    <span className="text-muted-foreground/50">
                      Voce esta na sala de vidro — use o chat para se comunicar.
                    </span>
                  </div>
                )}

                {messages.map((msg, i) => {
                  const isOwn = msg.username === displayName
                  return (
                    <div
                      key={i}
                      className={`mb-2 max-w-[90%] rounded-lg border p-2.5 ${
                        isOwn
                          ? 'ml-auto border-primary/30 bg-primary/10'
                          : 'border-border bg-card'
                      }`}
                    >
                      <div className="mb-0.5 flex items-baseline gap-2">
                        <span className={`text-xs font-bold ${isOwn ? 'text-primary' : 'text-muted-foreground'}`}>
                          {msg.username}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      <span className="text-sm leading-relaxed text-foreground break-words">
                        {msg.text}
                      </span>
                    </div>
                  )
                })}

                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Message input */}
            <div className="flex shrink-0 items-center gap-2.5 border-t border-border p-3">
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); sendMessage() }
                }}
                placeholder="Digite uma mensagem e pressione Enter..."
                maxLength={200}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || !connected}
              >
                Enviar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* GitHub Panel */}
      {githubOpen && (
        <GitHubPanel
          onClose={() => setGithubOpen(false)}
          defaultUsername={user.username}
        />
      )}
    </div>
  )
}
