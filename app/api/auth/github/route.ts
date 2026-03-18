import { NextRequest, NextResponse } from 'next/server'

const CLIENT_ID = process.env.GITHUB_CLIENT_ID
const REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/api/auth/callback'

export async function GET(req: NextRequest) {
  if (!CLIENT_ID) {
    return NextResponse.json({ error: 'GITHUB_CLIENT_ID não configurado' }, { status: 500 })
  }

  const headless = req.nextUrl.searchParams.get('headless') === 'true'
  const state = headless ? 'headless' : 'normal'

  const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=user:email&state=${state}`

  return NextResponse.redirect(authUrl)
}
