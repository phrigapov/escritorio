'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './page.module.css'

const Game = dynamic(() => import('@/components/Game'), { ssr: false })

interface User {
  username: string
  name?: string
  avatar?: string
  loginType: 'simple' | 'github'
}

export default function Home() {
  const [username, setUsername] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()

  // Verificar se chegou de um login do GitHub
  useEffect(() => {
    const loginType = searchParams.get('login')
    const errorParam = searchParams.get('error')
    
    if (errorParam) {
      const errors: Record<string, string> = {
        no_code: 'Código de autorização não recebido',
        config: 'Configuração OAuth incompleta no servidor',
        token: 'Erro ao obter token de acesso',
        user_fetch: 'Erro ao buscar dados do usuário',
        server: 'Erro no servidor',
      }
      setError(errors[errorParam] || 'Erro desconhecido no login')
      
      // Limpar URL
      window.history.replaceState({}, '', '/')
      return
    }

    if (loginType === 'github') {
      const ghUsername = searchParams.get('username')
      const ghName = searchParams.get('name')
      const ghAvatar = searchParams.get('avatar')
      
      if (ghUsername) {
        setUser({
          username: ghUsername,
          name: ghName || undefined,
          avatar: ghAvatar || undefined,
          loginType: 'github'
        })
        
        // Limpar URL
        window.history.replaceState({}, '', '/')
      }
    }
  }, [searchParams])

  const handleSimpleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (username.trim()) {
      setUser({
        username: username.trim(),
        loginType: 'simple'
      })
    }
  }

  const handleGitHubLogin = () => {
    setError('')
    window.location.href = '/api/auth/github'
  }

  const handleClearError = () => {
    setError('')
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.loginBox}>
          <h1>🏢 Escritório Virtual</h1>
          <p>Entre no escritório multiplayer online</p>
          
          {error && (
            <div className={styles.errorBox}>
              <div className={styles.errorContent}>
                <div>⚠️ {error}</div>
                <button 
                  onClick={handleClearError} 
                  className={styles.closeError}
                  title="Fechar"
                >
                  ✕
                </button>
              </div>
              {error && (
                <div className={styles.errorHelp}>
                  <button 
                    onClick={handleGitHubLogin}
                    className={`${styles.button} ${styles.retryButton}`}
                  >
                    🔄 Tentar Novamente
                  </button>
                </div>
              )}
            </div>
          )}
          
          <form onSubmit={handleSimpleLogin}>
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
          
          <div className={styles.divider}>
            <span>ou</span>
          </div>
          
          <button 
            type="button"
            onClick={handleGitHubLogin} 
            className={`${styles.button} ${styles.githubButton}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}>
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
            Entrar com GitHub
          </button>
          
          <p className={styles.note}>
            💡 Use sua conta do GitHub para login rápido e avatar personalizado
          </p>
        </div>
      </div>
    )
  }

  return <Game user={user} />
}
