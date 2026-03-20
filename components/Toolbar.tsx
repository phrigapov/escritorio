'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface User {
  username: string
  name?: string
  avatar?: string
  loginType: 'simple' | 'github'
}

interface ToolbarProps {
  user: User
  mode: 'game' | 'headless'
  onSwitchMode: () => void

  chatOpen?: boolean
  onToggleChat?: () => void

  claudeOpen?: boolean
  onToggleClaude?: () => void

  githubOpen?: boolean
  onToggleGithub?: () => void

  editorOpen?: boolean
  onOpenEditor?: () => void
  onCloseEditor?: () => void

  settingsOpen?: boolean
  onToggleSettings?: () => void

  officeLocked?: boolean
  onToggleLock?: () => void
}

export default function Toolbar({
  user,
  mode,
  onSwitchMode,
  chatOpen = false,
  onToggleChat,
  claudeOpen = false,
  onToggleClaude,
  githubOpen = false,
  onToggleGithub,
  editorOpen = false,
  onOpenEditor,
  onCloseEditor,
  settingsOpen = false,
  onToggleSettings,
  officeLocked,
  onToggleLock,
}: ToolbarProps) {
  const displayName = user.name || user.username

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-2.5 z-[1500] bg-background">
      <Badge variant="outline" className="gap-1.5">
        <span className="text-sm font-bold">{displayName}</span>
        {user.loginType === 'github' && (
          <span className="text-[10px] text-muted-foreground">via GitHub</span>
        )}
      </Badge>

      <div className="ml-auto flex items-center gap-1.5">
        {onToggleChat && (
          <Button
            variant={chatOpen ? 'secondary' : 'ghost'}
            size="xs"
            onClick={onToggleChat}
          >
            Chat (1)
          </Button>
        )}

        {onToggleClaude && (
          <Button
            variant={claudeOpen ? 'secondary' : 'ghost'}
            size="xs"
            onClick={onToggleClaude}
          >
            IA Paulo (2)
          </Button>
        )}

        {onToggleGithub && (
          <Button
            variant={githubOpen ? 'secondary' : 'ghost'}
            size="xs"
            onClick={onToggleGithub}
          >
            GitHub (3)
          </Button>
        )}

        {mode === 'game' && onOpenEditor && onCloseEditor && (
          <Button
            variant={editorOpen ? 'destructive' : 'ghost'}
            size="xs"
            onClick={editorOpen ? onCloseEditor : onOpenEditor}
          >
            {editorOpen ? 'Fechar Editor' : 'Editor (4)'}
          </Button>
        )}

        {onToggleLock !== undefined && (
          <Button
            variant={officeLocked ? 'destructive' : 'default'}
            size="xs"
            onClick={onToggleLock}
            title={officeLocked ? 'Escritório BLOQUEADO — clique para liberar' : 'Escritório LIBERADO — clique para bloquear'}
          >
            {officeLocked ? '🔒 Bloqueado' : '🔓 Liberado'}
          </Button>
        )}

        <Button variant="outline" size="xs" onClick={onSwitchMode}>
          {mode === 'game' ? 'Modo Dev' : 'Modo Normal'}
        </Button>

        {onToggleSettings && (
          <Button
            variant={settingsOpen ? 'secondary' : 'ghost'}
            size="xs"
            onClick={onToggleSettings}
          >
            Config (Esc)
          </Button>
        )}
      </div>
    </div>
  )
}
