import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { Pool } from 'pg'

// ── Database pools por ambiente ──────────────────────────────────────────────
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const SYSTEM_PROMPT = `Você é a IA do Paulo, o assistente de IA do Escritório Virtual. Você ajuda os usuários com perguntas, tarefas e consultas ao banco de dados PostgreSQL.

Quando o usuário pedir informações do banco de dados, use a função postgres_query para executar consultas SQL.
- IMPORTANTE: Você só tem permissão de LEITURA. Use apenas SELECT.
- Nunca execute DROP, DELETE, TRUNCATE, ALTER, INSERT, UPDATE ou qualquer comando de escrita.
- Formate os resultados de forma legível
- Se não souber o schema, primeiro liste as tabelas com: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'

Responda sempre em português brasileiro, de forma concisa e útil.`

const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'postgres_query',
      description:
        'Executa uma consulta SQL READ-ONLY no banco de dados PostgreSQL. Use APENAS SELECT. Nunca execute comandos de escrita (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE).',
      parameters: {
        type: 'object',
        properties: {
          sql: {
            type: 'string',
            description: 'A consulta SQL SELECT a ser executada (somente leitura)',
          },
        },
        required: ['sql'],
      },
    },
  },
]

// Comandos de escrita bloqueados
const WRITE_PATTERN = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY)\b/i

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

    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT + `\n\nVocê está conectado ao banco de dados: ${selectedDb === 'prod' ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}.` },
      ...messages,
    ]

    let response = await openai.chat.completions.create({
      model: selectedModel,
      max_completion_tokens: 4096,
      tools,
      messages: openaiMessages,
    })

    // Handle tool use loop
    let iterations = 0
    const MAX_ITERATIONS = 5

    while (
      response.choices[0]?.finish_reason === 'tool_calls' &&
      iterations < MAX_ITERATIONS
    ) {
      iterations++

      const assistantMessage = response.choices[0].message
      openaiMessages.push(assistantMessage)

      const toolCalls = assistantMessage.tool_calls || []

      for (const toolCall of toolCalls) {
        if (toolCall.type !== 'function') continue
        if (toolCall.function.name === 'postgres_query') {
          const { sql } = JSON.parse(toolCall.function.arguments) as { sql: string }

          // Bloquear comandos de escrita
          if (WRITE_PATTERN.test(sql)) {
            openaiMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: 'BLOQUEADO: Apenas consultas SELECT são permitidas. Comandos de escrita não são autorizados.',
            })
            continue
          }

          try {
            const pool = getPool(selectedDb)
            const client = await pool.connect()
            try {
              // Forçar transação somente leitura
              await client.query('BEGIN READ ONLY')
              const result = await client.query(sql)
              await client.query('COMMIT')
              openaiMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  rows: result.rows.slice(0, 100),
                  rowCount: result.rowCount,
                  fields: result.fields?.map((f: { name: string }) => f.name),
                }),
              })
            } catch (dbError: any) {
              await client.query('ROLLBACK').catch(() => {})
              openaiMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `Erro SQL: ${dbError.message}`,
              })
            } finally {
              client.release()
            }
          } catch (connError: any) {
            openaiMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `Erro de conexão: ${connError.message}`,
            })
          }
        }
      }

      response = await openai.chat.completions.create({
        model: selectedModel,
        max_completion_tokens: 4096,
        tools,
        messages: openaiMessages,
      })
    }

    const textContent = response.choices[0]?.message?.content || ''

    return NextResponse.json({ response: textContent })
  } catch (error: any) {
    console.error('OpenAI API error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
