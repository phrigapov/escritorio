import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const MCP_FILE = path.join(process.cwd(), '.mcp.json')

interface McpConfig {
  mcpServers: Record<string, any>
  _disabledServers?: Record<string, any>
}

function readConfig(): McpConfig {
  try {
    return JSON.parse(fs.readFileSync(MCP_FILE, 'utf-8'))
  } catch {
    return { mcpServers: {} }
  }
}

function writeConfig(config: McpConfig) {
  fs.writeFileSync(MCP_FILE, JSON.stringify(config, null, 2))
}

export async function GET() {
  const config = readConfig()
  const enabled = Object.entries(config.mcpServers).map(([name, def]) => ({
    name,
    enabled: true,
    definition: def,
  }))
  const disabled = Object.entries(config._disabledServers ?? {}).map(([name, def]) => ({
    name,
    enabled: false,
    definition: def,
  }))
  return NextResponse.json({ servers: [...enabled, ...disabled] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, name, definition } = body
  const config = readConfig()

  if (action === 'toggle') {
    const isEnabled = name in config.mcpServers
    if (isEnabled) {
      // disable: move to _disabledServers
      config._disabledServers = config._disabledServers ?? {}
      config._disabledServers[name] = config.mcpServers[name]
      delete config.mcpServers[name]
    } else {
      // enable: move back to mcpServers
      const def = config._disabledServers?.[name]
      if (def) {
        config.mcpServers[name] = def
        delete config._disabledServers![name]
      }
    }
    writeConfig(config)
    return NextResponse.json({ ok: true })
  }

  if (action === 'add') {
    config.mcpServers[name] = definition
    writeConfig(config)
    return NextResponse.json({ ok: true })
  }

  if (action === 'remove') {
    delete config.mcpServers[name]
    delete config._disabledServers?.[name]
    writeConfig(config)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false, error: 'Ação inválida' }, { status: 400 })
}
