'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'

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
    const main = game.scene.getScene('MainScene')
    main?.scene.resume()
    setEditorOpen(false)
  }, [])

  // ── Inicializar Phaser ─────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false

    const initGame = async () => {
      try {
        const Phaser      = await import('phaser')
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

  // ── Atalho de teclado E ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // não abrir editor se estiver digitando em algum input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'e' || e.key === 'E') {
        editorOpen ? closeEditor() : openEditor()
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

      {/* Botão flutuante para abrir/fechar editor */}
      {!isLoading && (
        <button
          onClick={editorOpen ? closeEditor : openEditor}
          title="Modo Editor (E)"
          style={{
            position: 'fixed', bottom: 20, right: 20,
            background: editorOpen ? '#c0392b' : '#2980b9',
            border: 'none', color: '#fff', borderRadius: 8,
            padding: '8px 14px', fontSize: 13, cursor: 'pointer',
            zIndex: 1400, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            transition: 'background 0.2s',
          }}
        >
          {editorOpen ? '✕ Fechar Editor' : '🗺 Editor (E)'}
        </button>
      )}

      {/* Painel lateral do editor */}
      {editorOpen && (
        <EditorOverlay sceneRef={editorSceneRef} onClose={closeEditor} />
      )}
    </div>
  )
}

