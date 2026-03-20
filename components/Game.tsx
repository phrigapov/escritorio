'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { Socket } from 'socket.io-client'
import Toolbar from './Toolbar'
import PerfMonitor from './PerfMonitor'
import GitHubPanel from './GitHubPanel'
import SettingsPanel from './SettingsPanel'

const EditorOverlay = dynamic(() => import('./EditorOverlay'), { ssr: false })
const ChatPanel     = dynamic(() => import('./ChatPanel'),     { ssr: false })
const ClaudePanel   = dynamic(() => import('./ClaudePanel'),   { ssr: false })

interface User {
  username: string
  name?: string
  avatar?: string
  loginType: 'simple' | 'github'
}

interface GameProps {
  user: User
  socket: Socket | null
  onSwitchMode: () => void
  onLogout: () => void
}

export default function Game({ user, socket, onSwitchMode, onLogout }: GameProps) {
  const gameRef        = useRef<any>(null)
  const editorSceneRef = useRef<any>(null)
  const [isLoading, setIsLoading]   = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [githubOpen, setGithubOpen] = useState(false)
  const [chatOpen, setChatOpen]     = useState(false)
  const [claudeOpen, setClaudeOpen] = useState(false)
  const [perfOpen, setPerfOpen]     = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const displayName = user.name || user.username
  const isAdmin = user.username === 'phrigapov'
  const [officeLocked, setOfficeLocked] = useState(false)

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
    // Limpa texturas de piso geradas dinamicamente (podem ter mudado no editor)
    game.textures.getTextureKeys()
      .filter((k: string) => k.startsWith('floor_'))
      .forEach((k: string) => game.textures.remove(k))
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
        gameRef.current.registry.set('githubUsername', user.username)
        gameRef.current.registry.set('loginType', user.loginType)
        // Socket é passado via prop — MainScene o lê do registry
        if (socket) gameRef.current.registry.set('socket', socket)

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

    // Aguarda socket estar disponível — ele é criado em page.tsx num efeito separado
    if (!socket) return

    initGame()

    return () => {
      cancelled = true
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
    }
  }, [user, displayName, socket])

  // ── Estado de bloqueio do escritório (somente admin) ──────────────────────
  useEffect(() => {
    if (!socket || !isAdmin) return
    const onLocked = (locked: boolean) => setOfficeLocked(locked)
    socket.on('office-locked', onLocked)
    socket.emit('request-office-status')
    return () => { socket.off('office-locked', onLocked) }
  }, [socket, isAdmin])

  const handleToggleLock = useCallback(() => {
    if (!socket) return
    const newLocked = !officeLocked
    setOfficeLocked(newLocked)                          // update otimista
    socket.emit('admin-lock-office', { locked: newLocked })
  }, [socket, officeLocked])

  // ── Sincronizar estado do painel com a cena do jogo ────────────────────────
  useEffect(() => {
    if (gameRef.current) {
      const mainScene = gameRef.current.scene.getScene('MainScene')
      if (mainScene) {
        (mainScene as any).isPanelOpen = githubOpen || editorOpen || chatOpen || claudeOpen || settingsOpen
      }
    }
  }, [githubOpen, editorOpen, chatOpen, claudeOpen, settingsOpen])

  // ── Desabilitar captura global do Phaser quando painéis estão abertos ────
  useEffect(() => {
    const main = gameRef.current?.scene?.getScene('MainScene') as any
    if (!main?.input?.keyboard) return
    const anyPanelOpen = githubOpen || editorOpen || chatOpen || claudeOpen || settingsOpen
    if (anyPanelOpen) {
      main.input.keyboard.disableGlobalCapture()
    } else {
      main.input.keyboard.enableGlobalCapture()
    }
  }, [githubOpen, editorOpen, chatOpen, claudeOpen, settingsOpen])

  // ── Atalhos de teclado (teclas numéricas para não conflitar com WASD) ────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '1') setChatOpen(o => !o)
      if (e.key === '2') setClaudeOpen(o => !o)
      if (e.key === '3') setGithubOpen(o => !o)
      if (e.key === '4') {
        editorOpen ? closeEditor() : openEditor()
      }
      if (e.key === '5') setPerfOpen(o => !o)
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
        <Toolbar
          user={user}
          mode="game"
          onSwitchMode={onSwitchMode}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen(o => !o)}
          claudeOpen={claudeOpen}
          onToggleClaude={isAdmin ? () => setClaudeOpen(o => !o) : undefined}
          githubOpen={githubOpen}
          onToggleGithub={() => setGithubOpen(o => !o)}
          editorOpen={editorOpen}
          onOpenEditor={openEditor}
          onCloseEditor={closeEditor}
          settingsOpen={settingsOpen}
          onToggleSettings={() => setSettingsOpen(o => !o)}
          officeLocked={isAdmin ? officeLocked : undefined}
          onToggleLock={isAdmin ? handleToggleLock : undefined}
        />
      )}

      {/* ── Main area: game + panels ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Game canvas */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
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
            socket={socket}
            onClose={() => setChatOpen(false)}
          />
        )}

        {/* Painel do Claude AI — somente admin */}
        {!isLoading && isAdmin && claudeOpen && (
          <ClaudePanel onClose={() => setClaudeOpen(false)} />
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
