'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import SidePanel from './SidePanel'

const ROOMS = ['geral', 'SME-GERAL', 'devs', 'suporte'] as const
type Room = (typeof ROOMS)[number]

type PlayerStatus = 'online' | 'busy' | 'away'
const STATUS_COLORS: Record<PlayerStatus, string> = {
  online: 'bg-green-500',
  busy: 'bg-red-500',
  away: 'bg-yellow-500',
}
const STATUS_LABELS: Record<PlayerStatus, string> = {
  online: 'Online',
  busy: 'Ocupado',
  away: 'Ausente',
}

interface ChatMessage {
  id: string
  username: string
  text: string
  timestamp: number
  room?: string
}

interface DmMessage {
  from: string
  to: string
  text: string
  timestamp: number
}

interface OnlinePlayer {
  id: string
  username: string
  status: PlayerStatus
  headless?: boolean
}

type ActiveView = Room | `dm:${string}`

interface Props {
  displayName: string
  socket: Socket | null
  onClose?: () => void
  /** Quando true, preenche o container pai em vez de usar SidePanel */
  embedded?: boolean
}

export default function ChatPanel({ displayName, socket, onClose, embedded = false }: Props) {
  const [input, setInput] = useState('')
  const [activeView, setActiveView] = useState<ActiveView>('geral')
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>(() => {
    const init: Record<string, ChatMessage[]> = {}
    ROOMS.forEach(r => { init[r] = [] })
    return init
  })
  const [dmMessages, setDmMessages] = useState<Record<string, DmMessage[]>>({})
  const [players, setPlayers] = useState<OnlinePlayer[]>([])
  const [myStatus, setMyStatus] = useState<PlayerStatus>('online')
  const [socketStatus, setSocketStatus] = useState<string>('sem socket')
  const [showPlayers, setShowPlayers] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isDm = activeView.startsWith('dm:')
  const dmTarget = isDm ? activeView.slice(3) : ''
  const activeRoom = isDm ? '' : (activeView as Room)

  // ── Status do socket ─────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      if (!socket) setSocketStatus('sem socket')
      else if (socket.connected) setSocketStatus('online')
      else setSocketStatus('reconectando')
    }
    check()
    const interval = setInterval(check, 1000)
    return () => clearInterval(interval)
  }, [socket])

  // ── Listeners ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    const onMessage = (msg: ChatMessage) => {
      const room = msg.room || 'geral'
      setMessagesByRoom(prev => ({
        ...prev,
        [room]: [...(prev[room] || []).slice(-299), msg],
      }))
    }

    const onHistory = (data: any) => {
      if (Array.isArray(data)) {
        setMessagesByRoom(prev => ({ ...prev, geral: data }))
      } else if (data?.room && Array.isArray(data.messages)) {
        setMessagesByRoom(prev => ({ ...prev, [data.room]: data.messages }))
      }
    }

    const onDm = (msg: DmMessage) => {
      const other = msg.from === displayName ? msg.to : msg.from
      setDmMessages(prev => ({
        ...prev,
        [other]: [...(prev[other] || []).slice(-299), msg],
      }))
    }

    const onDmHistory = (data: { with: string; messages: DmMessage[] }) => {
      if (data?.with && Array.isArray(data.messages)) {
        setDmMessages(prev => ({ ...prev, [data.with]: data.messages }))
      }
    }

    const onPlayersList = (list: OnlinePlayer[]) => {
      setPlayers(list.filter(p => p.username !== displayName))
    }

    socket.on('chat-message', onMessage)
    socket.on('chat-history', onHistory)
    socket.on('dm-message', onDm)
    socket.on('dm-history', onDmHistory)
    socket.on('players-list', onPlayersList)

    // Pedir histórico
    ROOMS.forEach(room => socket.emit('request-chat-history', { room }))

    return () => {
      socket.off('chat-message', onMessage)
      socket.off('chat-history', onHistory)
      socket.off('dm-message', onDm)
      socket.off('dm-history', onDmHistory)
      socket.off('players-list', onPlayersList)
    }
  }, [socket, displayName])

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  const currentMessages = isDm
    ? (dmMessages[dmTarget] || [])
    : (messagesByRoom[activeRoom] || [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentMessages.length, activeView])

  // ── Enviar mensagem ──────────────────────────────────────────────────────
  const sendMessage = useCallback(() => {
    const text = input.trim()
    if (!text || !socket) return

    if (isDm) {
      socket.emit('dm-message', { to: dmTarget, text, timestamp: Date.now() })
    } else {
      socket.emit('chat-message', {
        username: displayName,
        text,
        timestamp: Date.now(),
        room: activeRoom,
      })
    }
    setInput('')
    inputRef.current?.focus()
  }, [input, displayName, socket, activeView, isDm, dmTarget, activeRoom])

  // ── Mudar status ─────────────────────────────────────────────────────────
  const changeStatus = useCallback((status: PlayerStatus) => {
    setMyStatus(status)
    socket?.emit('player-status-changed', { status })
  }, [socket])

  // ── Abrir DM ─────────────────────────────────────────────────────────────
  const openDm = useCallback((username: string) => {
    setActiveView(`dm:${username}`)
    setShowPlayers(false)
    socket?.emit('request-dm-history', { with: username })
  }, [socket])

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const isConnected = socketStatus === 'online'

  // ── Render ───────────────────────────────────────────────────────────────
  const content = (
    <>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">Chat</span>
          <Badge variant={isConnected ? 'outline' : 'destructive'} className="text-[10px] px-1.5 py-0 h-4">
            {socketStatus}
          </Badge>
          <span className="text-[10px] text-muted-foreground">{players.length + 1} online</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Status selector */}
          <select
            value={myStatus}
            onChange={(e) => changeStatus(e.target.value as PlayerStatus)}
            className={`rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] outline-none ${
              myStatus === 'busy' ? 'text-red-400' : myStatus === 'away' ? 'text-yellow-400' : 'text-green-400'
            }`}
          >
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <Button
            variant={showPlayers ? 'secondary' : 'ghost'}
            size="icon-xs"
            onClick={() => setShowPlayers(o => !o)}
            title="Jogadores online"
          >
            <span className="text-xs">👥</span>
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon-xs" onClick={onClose}>
              x
            </Button>
          )}
        </div>
      </div>

      {/* Players list (toggle) */}
      {showPlayers && (
        <div className="shrink-0 border-b border-border p-2 max-h-[200px] overflow-y-auto">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
            Jogadores online
          </p>
          {/* Self */}
          <div className="flex items-center gap-2 rounded-md bg-primary/10 px-2 py-1 mb-1">
            <div className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLORS[myStatus]}`} />
            <span className="flex-1 truncate text-xs font-medium">{displayName}</span>
            <span className="text-[9px] text-muted-foreground">você</span>
          </div>
          {players.map(p => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent cursor-pointer"
              onClick={() => openDm(p.username)}
              title={`Enviar DM para ${p.username}`}
            >
              <div className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLORS[p.status] || 'bg-green-500'}`} />
              <span className="flex-1 truncate text-xs text-muted-foreground">{p.username}</span>
              {p.headless && <span className="text-[9px] text-primary">Dev</span>}
              <span className="text-[9px] text-muted-foreground">{STATUS_LABELS[p.status]}</span>
            </div>
          ))}
          {players.length === 0 && (
            <p className="text-[10px] text-muted-foreground/50 px-2 py-1">Ninguém mais online</p>
          )}
        </div>
      )}

      {/* Room / DM tabs */}
      <div className="flex shrink-0 gap-1 border-b border-border px-2 py-1.5 overflow-x-auto">
        {ROOMS.map(room => (
          <button
            key={room}
            onClick={() => setActiveView(room)}
            className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              activeView === room
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            #{room}
          </button>
        ))}
        {/* DM tabs */}
        {Object.keys(dmMessages).filter(k => dmMessages[k].length > 0).map(user => (
          <button
            key={`dm:${user}`}
            onClick={() => openDm(user)}
            className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors flex items-center gap-1 ${
              activeView === `dm:${user}`
                ? 'bg-violet-600 text-white'
                : 'text-violet-400 hover:bg-accent'
            }`}
          >
            @{user}
            <button
              className="ml-0.5 text-[9px] opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                setDmMessages(prev => { const n = { ...prev }; delete n[user]; return n })
                if (activeView === `dm:${user}`) setActiveView('geral')
              }}
            >
              ×
            </button>
          </button>
        ))}
      </div>

      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          {currentMessages.length === 0 && (
            <div className="pt-12 text-center text-xs text-muted-foreground">
              {isDm
                ? `Nenhuma mensagem com @${dmTarget}.`
                : `Nenhuma mensagem em #${activeRoom}.`}
            </div>
          )}
          {currentMessages.map((msg, i) => {
            const isOwn = isDm
              ? (msg as DmMessage).from === displayName
              : (msg as ChatMessage).username === displayName
            const senderName = isDm
              ? (msg as DmMessage).from
              : (msg as ChatMessage).username
            return (
              <div
                key={i}
                className={`mb-2 max-w-[92%] rounded-lg border p-2 ${
                  isOwn
                    ? 'ml-auto border-primary/30 bg-primary/10'
                    : isDm
                    ? 'border-violet-500/30 bg-violet-500/10'
                    : 'border-border bg-card'
                }`}
              >
                <div className="mb-0.5 flex items-baseline gap-2">
                  <span className={`text-[11px] font-bold ${isOwn ? 'text-primary' : isDm ? 'text-violet-400' : 'text-muted-foreground'}`}>
                    {senderName}
                  </span>
                  <span className="text-[9px] text-muted-foreground/50">{formatTime(msg.timestamp)}</span>
                </div>
                <span className="text-xs leading-relaxed text-foreground break-words whitespace-pre-wrap">
                  {isDm ? (msg as DmMessage).text : (msg as ChatMessage).text}
                </span>
              </div>
            )
          })}
          <div ref={chatEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="flex shrink-0 gap-2 border-t border-border p-3">
        <Input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage() } }}
          placeholder={isDm ? `DM para @${dmTarget}...` : `Mensagem em #${activeRoom}...`}
          maxLength={500}
          className="flex-1 text-xs"
        />
        <Button
          size="sm"
          onClick={sendMessage}
          disabled={!input.trim() || !socket}
        >
          Enviar
        </Button>
      </div>
    </>
  )

  if (embedded) {
    return (
      <div
        className="flex min-w-0 flex-1 flex-col bg-background text-foreground"
        onKeyDown={e => e.stopPropagation()}
        onKeyUp={e => e.stopPropagation()}
      >
        {content}
      </div>
    )
  }

  return (
    <SidePanel defaultWidth={400}>
      {content}
    </SidePanel>
  )
}
