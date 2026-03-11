'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import PerfMonitor from './PerfMonitor'
import GitHubPanel from './GitHubPanel'

// EditorOverlay só carrega no cliente (usa refs de cena Phaser)
const EditorOverlay = dynamic(() => import('./EditorOverlay'), { ssr: false })

interface GameProps {
  username: string
}

export default function Game({ username }: GameProps) {
  const gameRef        = useRef<any>(null)
  const editorSceneRef = useRef<any>(null)
  const [isLoading, setIsLoading]   = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [githubOpen, setGithubOpen] = useState(false)

  // ── Entrar/sair do editor ──────────────────────────────────────────────────
  const openEditor = useCallback(() => {
    const game = gameRef.current
    if (!game) return
    const main = game.scene.getScene('MainScene')
    main?.scene.pause()
    game.scene.start('EditorScene')
    // aguarda a cena estar ativa para pegar a referência
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
    // Invalida o cache do mapa para forçar releitura do arquivo salvo pelo editor
    game.cache.json.remove('map')
    const main = game.scene.getScene('MainScene')
    // Reinicia a cena (preload → create) em vez de só resumir
    main?.scene.restart()
    setEditorOpen(false)
  }, [])

  // ── Inicializar Phaser ─────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false

    const initGame = async () => {
      try {
        // Aguarda o Phaser da CDN estar disponível (máx 10s)
        await new Promise<void>((resolve, reject) => {
          if ((window as any).Phaser) { resolve(); return }
          const t = setTimeout(() => reject(new Error('Phaser CDN não carregou')), 10000)
          const check = setInterval(() => {
            if ((window as any).Phaser) { clearInterval(check); clearTimeout(t); resolve() }
          }, 50)
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
          scene: [MainScene, EditorScene],   // ← EditorScene registrada
          backgroundColor: '#2d3436',
        }

        gameRef.current = new Phaser.Game(config)
        gameRef.current.registry.set('username', username)

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
  }, [username])

  // ── Atalhos de teclado ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // não abrir painéis se estiver digitando em algum input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'e' || e.key === 'E') {
        editorOpen ? closeEditor() : openEditor()
      }
      if (e.key === 'g' || e.key === 'G') {
        setGithubOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editorOpen, openEditor, closeEditor])

  if (error) {
    return (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#2d3436', color: 'white',
        flexDirection: 'column', gap: '1rem', fontSize: '1.2rem',
      }}>
        <div>❌ Erro ao carregar o jogo</div>
        <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>{error}</div>
      </div>
    )
  }

  return (
    <div className="game-wrapper">
      {isLoading && (
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: '#2d3436', color: 'white', fontSize: '1.5rem', zIndex: 9999,
        }}>
          Carregando escritório...
        </div>
      )}

      <div id="game-container" className="game-container" />

      {/* Botões flutuantes (canto inferior direito) */}
      {!isLoading && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20,
          display: 'flex', flexDirection: 'column', gap: 8,
          zIndex: 1400,
        }}>
          <button
            onClick={() => setGithubOpen(o => !o)}
            title="GitHub (G)"
            style={{
              background: githubOpen ? '#1a3a1a' : '#24292f',
              border: `1px solid ${githubOpen ? '#4ade80' : '#444'}`,
              color: '#fff', borderRadius: 8,
              padding: '8px 14px', fontSize: 13, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              transition: 'background 0.2s',
            }}
          >
            {githubOpen ? '✕ GitHub' : '🐙 GitHub (G)'}
          </button>
          <button
            onClick={editorOpen ? closeEditor : openEditor}
            title="Modo Editor (E)"
            style={{
              background: editorOpen ? '#c0392b' : '#2980b9',
              border: 'none', color: '#fff', borderRadius: 8,
              padding: '8px 14px', fontSize: 13, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              transition: 'background 0.2s',
            }}
          >
            {editorOpen ? '✕ Fechar Editor' : '🗺 Editor (E)'}
          </button>
        </div>
      )}

      {/* Painel lateral do editor */}
      {editorOpen && (
        <EditorOverlay sceneRef={editorSceneRef} onClose={closeEditor} />
      )}

      {/* Painel lateral do GitHub */}
      {!isLoading && githubOpen && (
        <GitHubPanel onClose={() => setGithubOpen(false)} />
      )}

      {/* Monitor de desempenho — sempre visível após o jogo carregar */}
      {!isLoading && <PerfMonitor />}
    </div>
  )
}

