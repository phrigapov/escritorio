import { NextResponse } from 'next/server'

const TOKEN = process.env.GITHUB_TOKEN
const ORG   = process.env.GITHUB_ORG || 'sismacke'
const PROJECT_NUMBER = parseInt(process.env.GITHUB_PROJECT_NUMBER || '7', 10)

async function ghGraphQL(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`)
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0].message)
  return json.data
}

// Cache em memória — 60 segundos
let cache: { data: any[]; timestamp: number } | null = null
const CACHE_TTL = 60 * 1000

export async function GET(req: Request) {
  if (!TOKEN) return NextResponse.json({ error: 'GITHUB_TOKEN não configurado' }, { status: 500 })

  const nocache = new URL(req.url).searchParams.get('nocache') === '1'
  if (nocache) cache = null

  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json({ teamSprint: cache.data })
  }

  try {
    // ── FASE 1: buscar só IDs e dados básicos das issues abertas do projeto (sem projectItems)
    // A search API filtra server-side por org+projeto, então poucos resultados paginados
    const phaseOneQuery = `
      query($q: String!, $cursor: String) {
        search(query: $q, type: ISSUE, first: 100, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            ... on Issue {
              id
              number
              title
              url
              repository { nameWithOwner }
              assignees(first: 5) { nodes { login avatarUrl } }
              labels(first: 3) { nodes { name color } }
            }
          }
        }
      }
    `

    const allIssues: any[] = []
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      const data = await ghGraphQL(phaseOneQuery, {
        q: `is:issue is:open org:${ORG} project:${ORG}/${PROJECT_NUMBER}`,
        cursor,
      })
      const search = data.search
      if (!search?.nodes) break
      allIssues.push(...search.nodes.filter((n: any) => n?.id !== undefined))
      hasNextPage = search.pageInfo.hasNextPage
      cursor = search.pageInfo.endCursor
    }

    if (allIssues.length === 0) {
      cache = { data: [], timestamp: Date.now() }
      return NextResponse.json({ teamSprint: [] })
    }

    // ── FASE 2: buscar projectItems.fieldValues para todas as issues de uma vez via nodes(ids:[...])
    // Dividir em lotes de 50 para não exceder query size
    const BATCH = 50
    const ids = allIssues.map((i: any) => i.id)
    const batches: string[][] = []
    for (let i = 0; i < ids.length; i += BATCH) {
      batches.push(ids.slice(i, i + BATCH))
    }

    const phaseTwoQuery = `
      query($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Issue {
            id
            projectItems(first: 3, includeArchived: false) {
              nodes {
                project { number }
                fieldValues(first: 8) {
                  nodes {
                    __typename
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field { ... on ProjectV2SingleSelectField { name } }
                    }
                    ... on ProjectV2ItemFieldDateValue {
                      date
                      field { ... on ProjectV2Field { name } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `

    // Buscar todos os lotes em paralelo
    const batchResults = await Promise.all(
      batches.map(batchIds => ghGraphQL(phaseTwoQuery, { ids: batchIds }))
    )

    // Montar mapa id → projectItems
    const itemsMap = new Map<string, any>()
    for (const result of batchResults) {
      for (const node of (result.nodes || [])) {
        if (node?.id) itemsMap.set(node.id, node.projectItems)
      }
    }

    // ── Filtrar e mapear apenas issues com status Sprint
    const teamSprint = allIssues
      .map((issue: any) => {
        const projectItems = itemsMap.get(issue.id)
        const projectItem = projectItems?.nodes?.find(
          (p: any) => p.project?.number === PROJECT_NUMBER
        )
        if (!projectItem) return null

        const fields = projectItem.fieldValues?.nodes || []
        const statusField = fields.find(
          (f: any) => f.__typename === 'ProjectV2ItemFieldSingleSelectValue' &&
            f.field?.name?.toLowerCase() === 'status'
        )
        if (!statusField?.name?.toLowerCase().includes('sprint')) return null

        const endDateField = fields.find(
          (f: any) => f.__typename === 'ProjectV2ItemFieldDateValue' &&
            (f.field?.name?.toLowerCase().includes('end') || f.field?.name?.toLowerCase().includes('fim'))
        )
        const startDateField = fields.find(
          (f: any) => f.__typename === 'ProjectV2ItemFieldDateValue' &&
            (f.field?.name?.toLowerCase().includes('start') || f.field?.name?.toLowerCase().includes('inicio') || f.field?.name?.toLowerCase().includes('início'))
        )

        return {
          number: issue.number,
          title: issue.title,
          url: issue.url,
          repo: issue.repository?.nameWithOwner || '',
          assignees: (issue.assignees?.nodes || []).map((a: any) => ({ login: a.login, avatarUrl: a.avatarUrl })),
          labels: (issue.labels?.nodes || []).map((l: any) => ({ name: l.name, color: l.color })),
          status: statusField?.name || '',
          endDate: endDateField?.date || '',
          startDate: startDateField?.date || '',
        }
      })
      .filter(Boolean)

    cache = { data: teamSprint, timestamp: Date.now() }
    return NextResponse.json({ teamSprint })
  } catch (err) {
    console.error('Team Sprint Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}
