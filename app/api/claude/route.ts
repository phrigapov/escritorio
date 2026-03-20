import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'

// ── Enabled tools ─────────────────────────────────────────────────────────────

function getEnabledTools(): string[] {
  try {
    const file = path.join(process.cwd(), 'ai-tools.json')
    return JSON.parse(fs.readFileSync(file, 'utf-8')).enabled ?? []
  } catch {
    return ['postgres']
  }
}

// ── Database pools ────────────────────────────────────────────────────────────

const pools: Record<string, Pool> = {}

function getPool(env: string): Pool {
  if (!pools[env]) {
    const urlKey = env === 'prod' ? 'DATABASE_URL_PROD' : 'DATABASE_URL'
    const connStr = process.env[urlKey]
    if (!connStr) throw new Error(`Variável ${urlKey} não configurada`)
    pools[env] = new Pool({
      connectionString: connStr,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    })
  }
  return pools[env]
}

// ── GitHub helper ─────────────────────────────────────────────────────────────

async function githubFetch(endpoint: string): Promise<any> {
  const token = process.env.GITHUB_TOKEN
  const res = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── OpenAI client ─────────────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const WRITE_PATTERN = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY)\b/i

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOL_DEFS: Record<string, OpenAI.ChatCompletionTool> = {
  postgres: {
    type: 'function',
    function: {
      name: 'postgres_query',
      description: 'Executa uma consulta SQL SELECT no banco de dados PostgreSQL (somente leitura).',
      parameters: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: 'Consulta SQL SELECT a executar' },
        },
        required: ['sql'],
      },
    },
  },
  github: {
    type: 'function',
    function: {
      name: 'github_query',
      description:
        'Consulta o repositório GitHub: lista issues, PRs, commits, conteúdo de arquivos, etc.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list_issues', 'list_prs', 'list_commits', 'get_file', 'search_code'],
            description: 'Ação a executar',
          },
          params: {
            type: 'object',
            description:
              'Parâmetros da ação. Para get_file: {path}. Para search_code: {query}. Para list_issues/list_prs: {state, per_page}.',
          },
        },
        required: ['action'],
      },
    },
  },
}

// ── System prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt(enabledTools: string[], selectedDb: string): string {
  const parts = [
    'Você é a IA do Paulo, assistente do Escritório Virtual. Responda sempre em português brasileiro, de forma concisa e útil.',
  ]

  if (enabledTools.includes('postgres')) {
    parts.push(
      `\nVocê tem acesso ao banco de dados PostgreSQL (ambiente: ${selectedDb === 'prod' ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}). Use postgres_query para consultas SELECT. NUNCA execute comandos de escrita (INSERT, UPDATE, DELETE, DROP, etc.). Se não souber o schema, liste as tabelas primeiro: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'.`
    )
  }

  if (enabledTools.includes('github')) {
    const owner = process.env.GITHUB_OWNER
    const repo = process.env.GITHUB_REPO
    parts.push(
      `\nVocê tem acesso ao repositório GitHub ${owner}/${repo}. Use github_query para listar issues, PRs, commits ou buscar arquivos/código.`
    )
  }

  return parts.join('\n')
}

// ── Tool executor ─────────────────────────────────────────────────────────────

async function executeTool(name: string, args: any, selectedDb: string): Promise<string> {
  if (name === 'postgres_query') {
    const { sql } = args as { sql: string }
    if (WRITE_PATTERN.test(sql)) {
      return 'BLOQUEADO: Apenas SELECT é permitido.'
    }
    const pool = getPool(selectedDb)
    const client = await pool.connect()
    try {
      await client.query('BEGIN READ ONLY')
      const result = await client.query(sql)
      await client.query('COMMIT')
      return JSON.stringify({
        rows: result.rows.slice(0, 100),
        rowCount: result.rowCount,
        fields: result.fields?.map((f: { name: string }) => f.name),
      })
    } catch (e: any) {
      await client.query('ROLLBACK').catch(() => {})
      return `Erro SQL: ${e.message}`
    } finally {
      client.release()
    }
  }

  if (name === 'github_query') {
    const { action, params = {} } = args as { action: string; params?: any }
    const owner = process.env.GITHUB_OWNER
    const repo = process.env.GITHUB_REPO
    try {
      let data: any
      if (action === 'list_issues') {
        const qs = new URLSearchParams({ state: params.state ?? 'open', per_page: String(params.per_page ?? 20) })
        data = await githubFetch(`/repos/${owner}/${repo}/issues?${qs}`)
      } else if (action === 'list_prs') {
        const qs = new URLSearchParams({ state: params.state ?? 'open', per_page: String(params.per_page ?? 20) })
        data = await githubFetch(`/repos/${owner}/${repo}/pulls?${qs}`)
      } else if (action === 'list_commits') {
        const qs = new URLSearchParams({ per_page: String(params.per_page ?? 20) })
        data = await githubFetch(`/repos/${owner}/${repo}/commits?${qs}`)
      } else if (action === 'get_file') {
        data = await githubFetch(`/repos/${owner}/${repo}/contents/${params.path}`)
        if (data.content) {
          data = { path: data.path, content: Buffer.from(data.content, 'base64').toString('utf-8').slice(0, 4000) }
        }
      } else if (action === 'search_code') {
        const q = encodeURIComponent(`${params.query} repo:${owner}/${repo}`)
        data = await githubFetch(`/search/code?q=${q}&per_page=10`)
      } else {
        return `Ação desconhecida: ${action}`
      }
      return JSON.stringify(data)
    } catch (e: any) {
      return `Erro GitHub: ${e.message}`
    }
  }

  return `Ferramenta desconhecida: ${name}`
}

// ── Handler ───────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { messages, model: requestedModel, database } = (await req.json()) as {
      messages: Message[]
      model?: string
      database?: string
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array is required' }, { status: 400 })
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    const selectedModel = requestedModel || 'gpt-4.1'
    const selectedDb = database === 'prod' ? 'prod' : 'dev'
    const enabledTools = getEnabledTools()

    const activeToolDefs = enabledTools
      .filter(id => TOOL_DEFS[id])
      .map(id => TOOL_DEFS[id])

    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: buildSystemPrompt(enabledTools, selectedDb) },
      ...messages,
    ]

    let response = await openai.chat.completions.create({
      model: selectedModel,
      max_completion_tokens: 4096,
      ...(activeToolDefs.length > 0 ? { tools: activeToolDefs } : {}),
      messages: openaiMessages,
    })

    let iterations = 0
    while (response.choices[0]?.finish_reason === 'tool_calls' && iterations < 5) {
      iterations++
      const assistantMessage = response.choices[0].message
      openaiMessages.push(assistantMessage)

      for (const toolCall of assistantMessage.tool_calls ?? []) {
        if (toolCall.type !== 'function') continue
        const args = JSON.parse(toolCall.function.arguments)
        const result = await executeTool(toolCall.function.name, args, selectedDb)
        openaiMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: result })
      }

      response = await openai.chat.completions.create({
        model: selectedModel,
        max_completion_tokens: 4096,
        ...(activeToolDefs.length > 0 ? { tools: activeToolDefs } : {}),
        messages: openaiMessages,
      })
    }

    const textContent = response.choices[0]?.message?.content
    if (!textContent) {
      const reason = response.choices[0]?.finish_reason
      return NextResponse.json(
        { error: reason === 'tool_calls' ? 'Limite de chamadas atingido sem resposta.' : `Sem conteúdo (${reason}).` },
        { status: 500 }
      )
    }

    return NextResponse.json({ response: textContent })
  } catch (error: any) {
    console.error('OpenAI API error:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
