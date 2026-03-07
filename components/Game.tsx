'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Chat from './Chat'

interface GameProps {
  username: string
}

export default function Game({ username }: GameProps) {
  const gameRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined' || gameRef.current) return

    const initGame = async () => {
      try {
        console.log('Iniciando Phaser...')
        const Phaser = await import('phaser')
        const MainScene = (await import('@/game/scenes/MainScene')).default

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
        
        console.log('Phaser inicializado!')
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
      } catch (error) {
        console.error('Erro ao inicializar Phaser:', error)
        setIsLoading(false)
      }
    }

    initGame()

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
    }
  }, [username])

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
      <Chat username={username} />
    </div>
  )
}
