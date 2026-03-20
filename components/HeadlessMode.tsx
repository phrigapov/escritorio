'use client'

import { useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
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

export default function HeadlessMode({ user, socket, onSwitchMode, onLogout }: { user: User; socket: Socket | null; onSwitchMode: () => void; onLogout?: () => void }) {
  const [chatOpen, setChatOpen]   = useState(false)
  const [claudeOpen, setClaudeOpen] = useState(false)
  const [githubOpen, setGithubOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const displayName = user.name || user.username

  // Anuncia presença quando entra no modo headless (socket já existe, apenas emite player-joined)
  useEffect(() => {
    if (!socket) return
    const emitJoin = () => {
      socket.emit('player-joined', {
        username:       displayName,
        githubUsername: user.username,
        x:              GLASS_ROOM_X,
        y:              GLASS_ROOM_Y,
        color:          0x667eea,
        headless:       true,
        loginType:      user.loginType,
      })
      socket.emit('player-status-changed', { status: 'online' })
    }
    if (socket.connected) emitJoin()
    else socket.once('connect', emitJoin)
    return () => { socket.off('connect', emitJoin) }
  }, [socket, displayName, user.loginType])

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
        onToggleClaude={user.username === 'phrigapov' ? () => setClaudeOpen(o => !o) : undefined}
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

        {/* Painel da IA do Paulo — somente admin */}
        {user.username === 'phrigapov' && claudeOpen && (
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
