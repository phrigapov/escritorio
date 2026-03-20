import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const FILE = path.join(process.cwd(), 'ai-tools.json')

// Ferramentas disponíveis para a IA do Paulo
const AVAILABLE_TOOLS = [
  {
    id: 'postgres',
    label: 'PostgreSQL',
    description: 'Consulta SQL somente leitura no banco de dados',
    requiresEnv: ['DATABASE_URL'],
  },
  {
    id: 'github',
    label: 'GitHub',
    description: 'Issues, PRs e arquivos do repositório',
    requiresEnv: ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'],
  },
]

function readEnabled(): string[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8')).enabled ?? []
  } catch {
    return ['postgres']
  }
}

function writeEnabled(enabled: string[]) {
  fs.writeFileSync(FILE, JSON.stringify({ enabled }, null, 2))
}

export async function GET() {
  const enabled = readEnabled()
  return NextResponse.json({
    tools: AVAILABLE_TOOLS.map(t => ({ ...t, enabled: enabled.includes(t.id) })),
  })
}

export async function POST(req: NextRequest) {
  const { toolId } = await req.json()
  const enabled = readEnabled()
  const idx = enabled.indexOf(toolId)
  if (idx >= 0) {
    enabled.splice(idx, 1)
  } else {
    enabled.push(toolId)
  }
  writeEnabled(enabled)
  return NextResponse.json({ ok: true, enabled })
}
