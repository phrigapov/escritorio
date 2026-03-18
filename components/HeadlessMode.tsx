'use client'

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import Toolbar from './Toolbar'
import GitHubPanel from './GitHubPanel'
import SettingsPanel from './SettingsPanel'
import ChatPanel from './ChatPanel'
import ClaudePanel from './ClaudePanel'

interface User {
  username: string
  name?: string
  avatar?: string
  loginType: 'simple' | 'github'
}

const GLASS_ROOM_X = 150
const GLASS_ROOM_Y = 150

export default function HeadlessMode({ user, onSwitchMode, onLogout }: { user: User; onSwitchMode: () => void; onLogout?: () => void }) {
  const [chatOpen, setChatOpen]   = useState(false)
  const [claudeOpen, setClaudeOpen] = useState(false)
  const [githubOpen, setGithubOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)

  const displayName = user.name || user.username

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000'
    const s = io(url, { timeout: 3000, reconnection: true, reconnectionDelay: 500 })

    s.on('connect', () => {
      s.emit('player-joined', {
        username:  displayName,
        x:         GLASS_ROOM_X,
        y:         GLASS_ROOM_Y,
        color:     0x667eea,
        headless:  true,
      })
      s.emit('player-status-changed', { status: 'online' })
      setSocket(s)
    })

    return () => { s.disconnect() }
  }, [displayName])

  // ── Atalhos de teclado (mesmos do modo normal, sem editor) ────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '1') setChatOpen(o => !o)
      if (e.key === '2') setClaudeOpen(o => !o)
      if (e.key === '3') setGithubOpen(o => !o)
      if (e.key === 'Escape') setSettingsOpen(o => !o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">

      <Toolbar
        user={user}
        mode="headless"
        onSwitchMode={onSwitchMode}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen(o => !o)}
        claudeOpen={claudeOpen}
        onToggleClaude={() => setClaudeOpen(o => !o)}
        githubOpen={githubOpen}
        onToggleGithub={() => setGithubOpen(o => !o)}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen(o => !o)}
      />

      {/* Main area */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Chat principal — embedded, preenche o espaço */}
        <ChatPanel
          displayName={displayName}
          socket={socket}
          embedded
        />

        {/* Painel de chat extra (sidebar) */}
        {chatOpen && (
          <ChatPanel
            displayName={displayName}
            socket={socket}
            onClose={() => setChatOpen(false)}
          />
        )}

        {/* Painel da IA do Paulo */}
        {claudeOpen && (
          <ClaudePanel onClose={() => setClaudeOpen(false)} />
        )}

        {/* GitHub Panel */}
        {githubOpen && (
          <GitHubPanel
            onClose={() => setGithubOpen(false)}
            defaultUsername={user.username}
          />
        )}

        {/* Settings Panel */}
        {settingsOpen && (
          <SettingsPanel
            user={user}
            onClose={() => setSettingsOpen(false)}
            onLogout={onLogout || (() => {})}
          />
        )}
      </div>
    </div>
  )
}
