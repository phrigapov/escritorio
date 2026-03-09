import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const MAP_FILE = path.join(process.cwd(), 'data', 'map.json')

function ensureDir() {
  const dir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function defaultMap() {
  return {
    tileSize: 32,
    width: 50,
    height: 40,
    floors: [] as { x: number; y: number; tile: string }[],
    furniture: [] as { id: string; type: string; x: number; y: number }[],
    rooms: [] as { id: string; name: string; x: number; y: number; w: number; h: number; color: string }[],
  }
}

export async function GET() {
  try {
    ensureDir()
    if (!fs.existsSync(MAP_FILE)) {
      return NextResponse.json(defaultMap())
    }
    const data = JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8'))
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(defaultMap())
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureDir()
    const body = await req.json()
    fs.writeFileSync(MAP_FILE, JSON.stringify(body, null, 2))
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
