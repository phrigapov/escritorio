'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const Game         = dynamic(() => import('@/components/Game'),        { ssr: false })
const HeadlessMode = dynamic(() => import('@/components/HeadlessMode'), { ssr: false })

interface User {
  username: string
  name?: string
  avatar?: string
  loginType: 'simple' | 'github'
}

export default function Home() {
  const [user, setUser]       = useState<User | null>(null)
  const [headless, setHeadless] = useState(false)
  const [error, setError]     = useState('')
  const [simpleName, setSimpleName] = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    const loginType  = searchParams.get('login')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      const errors: Record<string, string> = {
        no_code:    'Codigo de autorizacao nao recebido',
        config:     'Configuracao OAuth incompleta no servidor',
        token:      'Erro ao obter token de acesso',
        user_fetch: 'Erro ao buscar dados do usuario',
        server:     'Erro no servidor',
      }
      setError(errors[errorParam] || 'Erro desconhecido no login')
      window.history.replaceState({}, '', '/')
      return
    }

    if (loginType === 'github') {
      const ghUsername = searchParams.get('username')
      const ghName     = searchParams.get('name')
      const ghAvatar   = searchParams.get('avatar')
      const ghHeadless = searchParams.get('headless') === 'true'

      if (ghUsername) {
        setUser({
          username:  ghUsername,
          name:      ghName   || undefined,
          avatar:    ghAvatar || undefined,
          loginType: 'github',
        })
        setHeadless(ghHeadless)
        window.history.replaceState({}, '', '/')
      }
    }
  }, [searchParams])

  const handleGitHubLogin = (headless = false) => {
    setError('')
    window.location.href = headless ? '/api/auth/github?headless=true' : '/api/auth/github'
  }

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Card className="w-[90%] max-w-[400px] text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Escritorio Virtual</CardTitle>
            <CardDescription>Entre no escritorio multiplayer online</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <div className="flex items-start justify-between gap-2">
                  <span>{error}</span>
                  <button
                    onClick={() => setError('')}
                    className="shrink-0 text-destructive/70 hover:text-destructive"
                  >
                    x
                  </button>
                </div>
                <div className="mt-3 border-t border-destructive/20 pt-3">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => handleGitHubLogin()}
                  >
                    Tentar Novamente
                  </Button>
                </div>
              </div>
            )}

            {/* Login rapido com nome */}
            <div className="flex gap-2">
              <Input
                placeholder="Seu nome..."
                value={simpleName}
                onChange={e => setSimpleName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && simpleName.trim()) {
                    setUser({ username: simpleName.trim(), name: simpleName.trim(), loginType: 'simple' })
                  }
                }}
                className="flex-1"
              />
              <Button
                size="lg"
                disabled={!simpleName.trim()}
                onClick={() => setUser({ username: simpleName.trim(), name: simpleName.trim(), loginType: 'simple' })}
              >
                Entrar
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <Button
              size="lg"
              variant="outline"
              onClick={() => handleGitHubLogin()}
              className="w-full gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
              </svg>
              Entrar com GitHub
            </Button>

            <Button
              variant="secondary"
              size="lg"
              onClick={() => handleGitHubLogin(true)}
              className="w-full"
            >
              Modo Dev (Sala de Vidro)
            </Button>
          </CardContent>

          <CardFooter className="justify-center">
            <p className="text-xs text-muted-foreground">
              Entre com um nome ou via GitHub
            </p>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const handleLogout = () => {
    setUser(null)
    setHeadless(false)
  }

  if (headless) return <HeadlessMode user={user} onSwitchMode={() => setHeadless(false)} onLogout={handleLogout} />
  return <Game user={user} onSwitchMode={() => setHeadless(true)} onLogout={handleLogout} />
}
