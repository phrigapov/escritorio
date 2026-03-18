'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import PerfMonitor from './PerfMonitor'
import GitHubPanel from './GitHubPanel'
import SettingsPanel from './SettingsPanel'

const EditorOverlay = dynamic(() => import('./EditorOverlay'), { ssr: false })
const ChatPanel     = dynamic(() => import('./ChatPanel'),     { ssr: false })

interface User {
  username: string
  name?: string
  avatar?: string
  loginType: 'simple' | 'github'
}

interface GameProps {
  user: User
  onSwitchMode: () => void
  onLogout: () => void
}

export default function Game({ user, onSwitchMode, onLogout }: GameProps) {
  const gameRef        = useRef<any>(null)
  const editorSceneRef = useRef<any>(null)
  const [isLoading, setIsLoading]   = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [githubOpen, setGithubOpen] = useState(false)
  const [chatOpen, setChatOpen]     = useState(false)
  const [perfOpen, setPerfOpen]     = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const displayName = user.name || user.username

  // ── Entrar/sair do editor ──────────────────────────────────────────────────
  const openEditor = useCallback(() => {
    const game = gameRef.current
    if (!game) return
    const main = game.scene.getScene('MainScene')
    main?.scene.pause()
    game.scene.start('EditorScene')
    setTimeout(() => {
      editorSceneRef.current = game.scene.getScene('EditorScene')
      setEditorOpen(true)
    }, 100)
  }, [])

  const closeEditor = useCallback(() => {
    const game = gameRef.current
    if (!game) return
    game.scene.stop('EditorScene')
    editorSceneRef.current = null
    game.cache.json.remove('map')
    const main = game.scene.getScene('MainScene')
    main?.scene.restart()
    setEditorOpen(false)
  }, [])

  // ── Inicializar Phaser ─────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false

    const initGame = async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          if ((window as any).Phaser) { resolve(); return }
          const t = setTimeout(() => reject(new Error('Phaser CDN nao carregou')), 5000)
          const check = setInterval(() => {
            if ((window as any).Phaser) { clearInterval(check); clearTimeout(t); resolve() }
          }, 20)
        })

        const Phaser      = (window as any).Phaser as typeof import('phaser')
        const MainScene   = (await import('@/game/scenes/MainScene')).default
        const { default: EditorScene } = await import('@/game/scenes/EditorScene')

        if (cancelled || gameRef.current) return

        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO,
          parent: 'game-container',
          width: window.innerWidth,
          height: window.innerHeight,
          physics: {
            default: 'arcade',
            arcade: { gravity: { x: 0, y: 0 }, debug: false },
          },
          scene: [MainScene, EditorScene],
          backgroundColor: '#2d3436',
        }

        gameRef.current = new Phaser.Game(config)
        gameRef.current.registry.set('username', displayName)

        setIsLoading(false)

        const handleResize = () => {
          gameRef.current?.scale.resize(window.innerWidth, window.innerHeight)
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
      } catch (err) {
        if (!cancelled) {
          console.error('Erro ao inicializar Phaser:', err)
          setError(err instanceof Error ? err.message : 'Erro desconhecido ao carregar o jogo')
          setIsLoading(false)
        }
      }
    }

    initGame()

    return () => {
      cancelled = true
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
    }
  }, [user, displayName])

  // ── Sincronizar estado do painel com a cena do jogo ────────────────────────
  useEffect(() => {
    if (gameRef.current) {
      const mainScene = gameRef.current.scene.getScene('MainScene')
      if (mainScene) {
        (mainScene as any).isPanelOpen = githubOpen || editorOpen || chatOpen || settingsOpen
      }
    }
  }, [githubOpen, editorOpen, chatOpen, settingsOpen])

  // ── Atalhos de teclado ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'e' || e.key === 'E') {
        editorOpen ? closeEditor() : openEditor()
      }
      if (e.key === 'g' || e.key === 'G') setGithubOpen(o => !o)
      if (e.key === 'c' || e.key === 'C') setChatOpen(o => !o)
      if (e.key === 'p' || e.key === 'P') setPerfOpen(o => !o)
      if (e.key === 'Escape') setSettingsOpen(o => !o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editorOpen, openEditor, closeEditor])

  if (error) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <div className="text-lg">Erro ao carregar o jogo</div>
        <div className="text-sm text-muted-foreground">{error}</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">

      {/* ── Top toolbar ── */}
      {!isLoading && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-2 z-[1500] bg-background">
          {/* Indicador */}
          <Badge variant="outline" className="gap-1.5">
            <span className="text-sm font-bold">{displayName}</span>
            {user.loginType === 'github' && (
              <span className="text-[10px] text-muted-foreground">via GitHub</span>
            )}
          </Badge>

          {/* Botoes de painel (direita) */}
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant={chatOpen ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setChatOpen(o => !o)}
            >
              Chat (C)
            </Button>

            <Button
              variant={githubOpen ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setGithubOpen(o => !o)}
            >
              GitHub (G)
            </Button>

            <Button
              variant={editorOpen ? 'destructive' : 'ghost'}
              size="xs"
              onClick={editorOpen ? closeEditor : openEditor}
            >
              {editorOpen ? 'Fechar Editor' : 'Editor (E)'}
            </Button>

            <Button
              variant="outline"
              size="xs"
              onClick={onSwitchMode}
            >
              Modo Dev
            </Button>

            <Button
              variant={settingsOpen ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setSettingsOpen(o => !o)}
            >
              Config (Esc)
            </Button>
          </div>
        </div>
      )}

      {/* ── Main area: game + panels ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Game canvas */}
        <div className="relative min-w-0 flex-1">
          {isLoading && (
            <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-background text-foreground text-xl">
              Carregando escritorio...
            </div>
          )}
          <div id="game-container" className="game-container" />
        </div>

        {/* Painel lateral do editor */}
        {editorOpen && (
          <EditorOverlay sceneRef={editorSceneRef} onClose={closeEditor} />
        )}

        {/* Painel de chat (inline, nao fixed) */}
        {!isLoading && chatOpen && (
          <ChatPanel
            displayName={displayName}
            onClose={() => setChatOpen(false)}
          />
        )}

        {/* Painel do GitHub (inline, nao fixed) */}
        {!isLoading && githubOpen && (
          <GitHubPanel
            onClose={() => setGithubOpen(false)}
            defaultUsername={user.username}
          />
        )}

        {/* Painel de configuracoes */}
        {!isLoading && settingsOpen && (
          <SettingsPanel
            user={user}
            onClose={() => setSettingsOpen(false)}
            onLogout={onLogout}
          />
        )}
      </div>

      {/* Monitor de desempenho */}
      {!isLoading && <PerfMonitor visible={perfOpen} />}
    </div>
  )
}
