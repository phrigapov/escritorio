'use client'

import { useEffect, useRef, useState } from 'react'

interface GameProps {
  username: string
}

export default function Game({ username }: GameProps) {
  const gameRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Sinaliza se o efeito foi limpo (evita dupla inicialização no Strict Mode)
    let cancelled = false

    const initGame = async () => {
      try {
        const Phaser = await import('phaser')
        const MainScene = (await import('@/game/scenes/MainScene')).default

        // Guarda pós-await: evita criar dois jogos no React Strict Mode
        if (cancelled || gameRef.current) return

        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO,
          parent: 'game-container',
          width: window.innerWidth,
          height: window.innerHeight,
          physics: {
            default: 'arcade',
            arcade: {
              gravity: { x: 0, y: 0 },
              debug: false
            }
          },
          scene: [MainScene],
          backgroundColor: '#2d3436'
        }

        gameRef.current = new Phaser.Game(config)
        gameRef.current.registry.set('username', username)

        setIsLoading(false)

        const handleResize = () => {
          if (gameRef.current) {
            gameRef.current.scale.resize(window.innerWidth, window.innerHeight)
          }
        }

        window.addEventListener('resize', handleResize)

        return () => {
          window.removeEventListener('resize', handleResize)
        }
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

  if (error) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#2d3436',
        color: 'white',
        flexDirection: 'column',
        gap: '1rem',
        fontSize: '1.2rem'
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
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2d3436',
          color: 'white',
          fontSize: '1.5rem',
          zIndex: 9999
        }}>
          Carregando escritório...
        </div>
      )}
      <div id="game-container" className="game-container" />
    </div>
  )
}
