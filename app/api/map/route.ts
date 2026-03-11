import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Serve e salva o mapa real do jogo (office-map.json)
const MAP_FILE = path.join(process.cwd(), 'public', 'maps', 'office-map.json')

export async function GET() {
  try {
    const data = JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8'))
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Mapa não encontrado' }, { status: 404 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    fs.writeFileSync(MAP_FILE, JSON.stringify(body, null, 2))
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

