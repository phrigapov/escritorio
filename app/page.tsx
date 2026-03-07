'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import styles from './page.module.css'

const Game = dynamic(() => import('@/components/Game'), { ssr: false })

export default function Home() {
  const [username, setUsername] = useState('')
  const [isJoined, setIsJoined] = useState(false)

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    if (username.trim()) {
      setIsJoined(true)
    }
  }

  if (!isJoined) {
    return (
      <div className={styles.container}>
        <div className={styles.loginBox}>
          <h1>🏢 Escritório Virtual</h1>
          <p>Entre no escritório multiplayer online</p>
          <form onSubmit={handleJoin}>
            <input
              type="text"
              placeholder="Digite seu nome"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={styles.input}
              maxLength={20}
            />
            <button type="submit" className={styles.button}>
              Entrar no Escritório
            </button>
          </form>
        </div>
      </div>
    )
  }

  return <Game username={username} />
}
