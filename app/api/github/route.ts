import { NextRequest, NextResponse } from 'next/server'

const TOKEN = process.env.GITHUB_TOKEN
const OWNER = process.env.GITHUB_OWNER
const REPO  = process.env.GITHUB_REPO
const ORG   = process.env.GITHUB_ORG || 'sismacke'
const PROJECT_NUMBER = process.env.GITHUB_PROJECT_NUMBER || '1' // Número do projeto mackensina

const BASE  = 'https://api.github.com'

const headers: HeadersInit = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
}

async function ghFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers, next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`)
  return res.json()
}

// GraphQL para buscar dados do projeto
async function ghGraphQL(query: string, variables: any = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`)
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0].message)
  return json.data
}

// Cache em memória por usuário (funciona com custom server Node.js)
interface IssueCacheEntry {
  issues: any[]
  timestamp: number
}
const issueCache = new Map<string, IssueCacheEntry>()
const CACHE_TTL = 2 * 60 * 1000 // 2 minutos

// Busca issues abertas do usuário diretamente via GraphQL search (muito mais rápido que
// iterar todas as issues do projeto — o GitHub filtra server-side por assignee)
async function getOpenIssuesForUser(owner: string, repo: string, username: string, projectNumber: number) {
  const cacheKey = `${owner}/${repo}:${username}`
  const cached = issueCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[CACHE] Hit para ${username}: ${cached.issues.length} issues`)
    return cached.issues
  }

  console.log(`[SEARCH] Buscando issues abertas de: ${username}`)
  const allIssues: any[] = []
  let cursor: string | null = null
  let hasNextPage = true

  while (hasNextPage) {
    const query = `
      query($searchQuery: String!, $cursor: String) {
        search(query: $searchQuery, type: ISSUE, first: 100, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            ... on Issue {
              number
              title
              state
              url
              createdAt
              author { login }
              assignees(first: 10) { nodes { login } }
              labels(first: 20) { nodes { name color } }
              projectItems(first: 10, includeArchived: false) {
                nodes {
                  project { number }
                  fieldValues(first: 20) {
                    nodes {
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        name
                        field {
                          ... on ProjectV2SingleSelectField { name }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `

    const data = await ghGraphQL(query, {
      searchQuery: `is:issue is:open assignee:${username} repo:${owner}/${repo}`,
      cursor,
    })

    const search = data.search
    if (!search?.nodes) break

    allIssues.push(...search.nodes.filter((n: any) => n?.number !== undefined))
    hasNextPage = search.pageInfo.hasNextPage
    cursor = search.pageInfo.endCursor
  }

  issueCache.set(cacheKey, { issues: allIssues, timestamp: Date.now() })
  console.log(`[SEARCH] ${username}: ${allIssues.length} issues abertas encontradas`)
  return allIssues
}

export async function GET(req: NextRequest) {
  if (!OWNER || !REPO) {
    return NextResponse.json({ error: 'GITHUB_OWNER ou GITHUB_REPO não configurado' }, { status: 500 })
  }

  if (!TOKEN) {
    return NextResponse.json({ error: 'GITHUB_TOKEN não configurado' }, { status: 500 })
  }

  const searchParams = req.nextUrl.searchParams
  const username = searchParams.get('username') || ''

  try {
    // Buscar dados básicos do repositório
    const [repo, pulls, commits] = await Promise.all([
      ghFetch(`/repos/${OWNER}/${REPO}`),
      ghFetch(`/repos/${OWNER}/${REPO}/pulls?state=open&per_page=10`),
      ghFetch(`/repos/${OWNER}/${REPO}/commits?per_page=10`),
    ])

    // Buscar issues do projeto filtradas por usuário
    let myIssues: any[] = []
    let backlogIssues: any[] = []
    let sprintIssues: any[] = []
    let testIssues: any[] = []

    try {
      if (!username) {
        console.log(`[INFO] Nenhum usuário fornecido, retornando listas vazias`)
        throw new Error('Username obrigatório')
      }

      const rawIssues = await getOpenIssuesForUser(OWNER!, REPO!, username, parseInt(PROJECT_NUMBER))
      console.log(`[INFO] Processando ${rawIssues.length} issues de ${username}`)

      rawIssues.forEach((issue: any) => {
        // Localizar o item do projeto correto pelo número do projeto
        const projectItem = issue.projectItems?.nodes?.find(
          (p: any) => p.project?.number === parseInt(PROJECT_NUMBER)
        ) ?? issue.projectItems?.nodes?.[0]

        const statusField = projectItem?.fieldValues?.nodes?.find(
          (f: any) => f.field?.name?.toLowerCase() === 'status'
        )
        const status = statusField?.name?.toLowerCase() || ''

        const normalized = {
          number: issue.number,
          title: issue.title,
          state: issue.state,
          labels: (issue.labels?.nodes || []).map((l: any) => ({
            name: l.name,
            color: l.color,
          })),
          author: issue.author?.login || 'unknown',
          assignees: (issue.assignees?.nodes || []).map((a: any) => a.login),
          createdAt: issue.createdAt,
          url: issue.url,
          status,
        }

        myIssues.push(normalized)

        if (status.includes('sprint')) {
          sprintIssues.push(normalized)
        } else if (status.includes('backlog')) {
          backlogIssues.push(normalized)
        } else if (status.includes('test') || status.includes('teste')) {
          testIssues.push(normalized)
        }
      })

      console.log(`[INFO] Sprint: ${sprintIssues.length} | Backlog: ${backlogIssues.length} | Test: ${testIssues.length}`)

    } catch (projectError) {
      console.error('Erro ao buscar issues:', projectError)
    }

    return NextResponse.json({
      repo: {
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        openIssues: repo.open_issues_count,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at,
      },
      issues: [...sprintIssues, ...backlogIssues, ...testIssues],
      myIssues,
      backlog: backlogIssues,
      sprint: sprintIssues,
      test: testIssues,
      pulls: (pulls as any[]).map((p: any) => ({
        number: p.number,
        title: p.title,
        state: p.state,
        draft: p.draft,
        author: p.user?.login,
        branch: p.head?.ref,
        createdAt: p.created_at,
        url: p.html_url,
      })),
      commits: (commits as any[]).map((c: any) => ({
        sha: c.sha?.slice(0, 7),
        message: (c.commit?.message as string)?.split('\n')[0].slice(0, 80),
        author: c.commit?.author?.name,
        date: c.commit?.author?.date,
        url: c.html_url,
      })),
    })
  } catch (err) {
    console.error('GitHub API Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}
