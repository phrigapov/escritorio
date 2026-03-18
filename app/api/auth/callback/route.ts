import { NextRequest, NextResponse } from 'next/server'

const CLIENT_ID = process.env.GITHUB_CLIENT_ID
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const ORG_NAME = 'sismacke'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const code = searchParams.get('code')
  const headless = searchParams.get('state') === 'headless'

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', req.url))
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/?error=config', req.url))
  }

  try {
    // 1. Trocar o código pelo access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }),
    })

    const tokenData = await tokenResponse.json()
    
    if (tokenData.error || !tokenData.access_token) {
      console.error('Token error:', tokenData)
      return NextResponse.redirect(new URL('/?error=token', req.url))
    }

    const accessToken = tokenData.access_token

    // 2. Buscar dados do usuário
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    })

    if (!userResponse.ok) {
      return NextResponse.redirect(new URL('/?error=user_fetch', req.url))
    }

    const userData = await userResponse.json()

    console.log(`[Auth] User authenticated: ${userData.login}`)
    console.log(`[Auth] ✅ Login successful for ${userData.login}`)

    // Redirecionar de volta com os dados do usuário
    const redirectUrl = new URL('/', req.url)
    redirectUrl.searchParams.set('login', 'github')
    redirectUrl.searchParams.set('username', userData.login)
    redirectUrl.searchParams.set('name', userData.name || userData.login)
    redirectUrl.searchParams.set('avatar', userData.avatar_url || '')
    if (headless) redirectUrl.searchParams.set('headless', 'true')
    
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.redirect(new URL('/?error=server', req.url))
  }
}
