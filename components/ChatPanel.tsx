'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

interface ChatMessage {
  id: string
  username: string
  text: string
  timestamp: number
}

interface Props {
  displayName: string
  onClose: () => void
}

export default function ChatPanel({ displayName, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState('')
  const [connected, setConnected] = useState(false)
  const socketRef  = useRef<Socket | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'
    const socket = io(url, { timeout: 3000, reconnection: true, reconnectionDelay: 500 })
    socketRef.current = socket

    socket.on('connect',    () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('chat-message', (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-299), msg])
    })

    return () => { socket.disconnect() }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(() => {
    const text = input.trim()
    if (!text || !socketRef.current) return
    socketRef.current.emit('chat-message', { username: displayName, text, timestamp: Date.now() })
    setInput('')
    inputRef.current?.focus()
  }, [input, displayName])

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex w-[340px] shrink-0 flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">Chat</span>
          <Badge variant={connected ? 'outline' : 'destructive'} className="text-[10px] px-1.5 py-0 h-4">
            {connected ? 'online' : 'reconectando'}
          </Badge>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          x
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {messages.length === 0 && (
            <div className="pt-12 text-center text-xs text-muted-foreground">
              Nenhuma mensagem ainda.
            </div>
          )}
          {messages.map((msg, i) => {
            const isOwn = msg.username === displayName
            return (
              <div
                key={i}
                className={`mb-2 max-w-[92%] rounded-lg border p-2 ${
                  isOwn
                    ? 'ml-auto border-primary/30 bg-primary/10'
                    : 'border-border bg-card'
                }`}
              >
                <div className="mb-0.5 flex items-baseline gap-2">
                  <span className={`text-[11px] font-bold ${isOwn ? 'text-primary' : 'text-muted-foreground'}`}>
                    {msg.username}
                  </span>
                  <span className="text-[9px] text-muted-foreground/50">{formatTime(msg.timestamp)}</span>
                </div>
                <span className="text-xs leading-relaxed text-foreground break-words">
                  {msg.text}
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
          placeholder="Mensagem..."
          maxLength={200}
          className="flex-1 text-xs"
        />
        <Button
          size="sm"
          onClick={sendMessage}
          disabled={!input.trim() || !connected}
        >
          Enviar
        </Button>
      </div>
    </div>
  )
}
