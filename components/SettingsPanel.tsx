'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

interface User {
  username: string
  name?: string
  avatar?: string
  loginType: 'simple' | 'github'
}

interface SettingsPanelProps {
  user: User
  onClose: () => void
  onLogout: () => void
}

const SHORTCUTS = [
  { key: 'C', desc: 'Abrir/fechar Chat' },
  { key: 'G', desc: 'Abrir/fechar painel GitHub' },
  { key: 'E', desc: 'Abrir/fechar Editor de Mapa' },
  { key: 'P', desc: 'Abrir/fechar Monitor de Desempenho' },
  { key: 'Esc', desc: 'Fechar menu de Configuracoes' },
  { key: 'W A S D', desc: 'Movimentar personagem' },
]

const EDITOR_SHORTCUTS = [
  { key: 'R', desc: 'Rotacionar objeto selecionado (+15°)' },
  { key: 'Shift+R', desc: 'Rotacionar objeto (-15°)' },
  { key: '+ / -', desc: 'Aumentar/diminuir escala do objeto' },
  { key: 'Setas', desc: 'Mover item (1px)' },
  { key: 'Shift+Setas', desc: 'Mover item (10px)' },
  { key: 'Delete', desc: 'Deletar item selecionado' },
  { key: 'Scroll', desc: 'Pan (arrastar mapa)' },
  { key: 'Ctrl+Scroll', desc: 'Zoom' },
  { key: 'Botao Dir/Meio', desc: 'Pan (arrastar mapa)' },
]

export default function SettingsPanel({ user, onClose, onLogout }: SettingsPanelProps) {
  const [confirmLogout, setConfirmLogout] = useState(false)

  return (
    <div className="flex w-[340px] shrink-0 flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-bold text-foreground">Configuracoes</span>
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          x
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">

          {/* Perfil */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Perfil
            </h3>
            <div className="flex items-center gap-3">
              {user.avatar && (
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="h-10 w-10 rounded-full border border-border"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-foreground truncate">
                  {user.name || user.username}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  @{user.username}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {user.loginType === 'github' ? 'GitHub' : 'Local'}
              </Badge>
            </div>
          </section>

          <Separator />

          {/* Sobre */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Sobre o Jogo
            </h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Nome</span>
                <span className="text-foreground font-medium">Escritorio Virtual</span>
              </div>
              <div className="flex justify-between">
                <span>Tipo</span>
                <span className="text-foreground font-medium">Multiplayer 2D</span>
              </div>
              <div className="flex justify-between">
                <span>Engine</span>
                <span className="text-foreground font-medium">Phaser 3 + Next.js</span>
              </div>
              <div className="flex justify-between">
                <span>Comunicacao</span>
                <span className="text-foreground font-medium">Socket.io</span>
              </div>
            </div>
          </section>

          <Separator />

          {/* Atalhos gerais */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Atalhos Gerais
            </h3>
            <div className="space-y-1.5">
              {SHORTCUTS.map(s => (
                <div key={s.key} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s.desc}</span>
                  <kbd className="ml-2 shrink-0 rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-secondary-foreground">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          {/* Atalhos do editor */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Atalhos do Editor de Mapa
            </h3>
            <div className="space-y-1.5">
              {EDITOR_SHORTCUTS.map(s => (
                <div key={s.key} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s.desc}</span>
                  <kbd className="ml-2 shrink-0 rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-secondary-foreground">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          {/* Logout */}
          <section>
            {!confirmLogout ? (
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => setConfirmLogout(true)}
              >
                Sair da Conta
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-center text-muted-foreground">
                  Tem certeza que deseja sair?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setConfirmLogout(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={onLogout}
                  >
                    Confirmar
                  </Button>
                </div>
              </div>
            )}
          </section>

        </div>
      </ScrollArea>
    </div>
  )
}
