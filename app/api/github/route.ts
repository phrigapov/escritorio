import { NextRequest, NextResponse } from 'next/server'

const TOKEN = process.env.GITHUB_TOKEN
const OWNER = process.env.GITHUB_OWNER
const REPO  = process.env.GITHUB_REPO
const ORG   = process.env.GITHUB_ORG || 'sismacke'
const PROJECT_NUMBER = process.env.GITHUB_PROJECT_NUMBER || '7'

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
const CACHE_TTL = 15 * 1000 // 15 segundos — alinhado ao auto-refresh do frontend


// Busca issues do usuário na org inteira (search API, rápido) e traz o status do projeto
// junto na mesma query. O GitHub filtra por assignee server-side.
async function getProjectIssuesForUser(org: string, projectNumber: number, username: string) {
  const cacheKey = `project:${org}/${projectNumber}:${username}`
  const cached = issueCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[CACHE] Hit para ${username}: ${cached.issues.length} issues`)
    return cached.issues
  }

  console.log(`[SEARCH] Buscando issues de ${username} na org ${org}`)
  const allIssues: any[] = []
  let cursor: string | null = null
  let hasNextPage = true

  while (hasNextPage) {
    const query = `
      query($q: String!, $cursor: String) {
        search(query: $q, type: ISSUE, first: 100, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            ... on Issue {
              number
              title
              state
              url
              createdAt
              repository { nameWithOwner }
              author { login }
              assignees(first: 5) { nodes { login } }
              labels(first: 10) { nodes { name color } }
              projectItems(first: 5, includeArchived: false) {
                nodes {
                  project { number }
                  fieldValues(first: 20) {
                    nodes {
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
      }
    `

    const data = await ghGraphQL(query, {
      q: `is:issue is:open assignee:${username} org:${org}`,
      cursor,
    })

    const search = data.search
    if (!search?.nodes) break
    allIssues.push(...search.nodes.filter((n: any) => n?.number !== undefined))
    hasNextPage = search.pageInfo.hasNextPage
    cursor = search.pageInfo.endCursor
  }

  // Filtrar só issues que estão no projeto
  const issues = allIssues
    .filter((issue: any) =>
      issue.projectItems?.nodes?.some((p: any) => p.project?.number === projectNumber)
    )
    .map((issue: any) => {
      const projectItem = issue.projectItems.nodes.find(
        (p: any) => p.project?.number === projectNumber
      )
      const statusField = projectItem?.fieldValues?.nodes?.find(
        (f: any) => f.field?.name?.toLowerCase() === 'status'
      )
      const endDateField = projectItem?.fieldValues?.nodes?.find(
        (f: any) => f.date !== undefined &&
          (f.field?.name?.toLowerCase().includes('end') || f.field?.name?.toLowerCase().includes('fim'))
      )
      return { ...issue, projectStatus: statusField?.name || '', endDate: endDateField?.date || '' }
    })

  issueCache.set(cacheKey, { issues, timestamp: Date.now() })
  console.log(`[SEARCH] ${allIssues.length} issues na org, ${issues.length} no projeto #${projectNumber}`)
  return issues
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
  const nocache = searchParams.get('nocache') === '1'

  // Invalidar cache se solicitado (ex: após mover issue)
  if (nocache && username) {
    const cacheKey = `project:${ORG}/${PROJECT_NUMBER}:${username}`
    issueCache.delete(cacheKey)
  }

  try {
    // Buscar dados básicos do repositório + PRs da org onde o usuário está envolvido
    const [repo, commits] = await Promise.all([
      ghFetch(`/repos/${OWNER}/${REPO}`),
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

      const rawIssues = await getProjectIssuesForUser(ORG!, parseInt(PROJECT_NUMBER), username)
      console.log(`[INFO] Processando ${rawIssues.length} issues de ${username}`)

      rawIssues.forEach((issue: any) => {
        const status = (issue.projectStatus || '').toLowerCase()

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
          repo: issue.repository?.nameWithOwner || '',
          status,
          endDate: issue.endDate || '',
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

    // Buscar PRs abertos da org onde o usuário está envolvido + PRs aguardando review
    let pulls: any[] = []
    let reviewCount = 0
    try {
      if (username) {
        const prQuery = `
          query($q: String!, $qReview: String!) {
            myPrs: search(query: $q, type: ISSUE, first: 20) {
              nodes {
                ... on PullRequest {
                  number title state isDraft url createdAt
                  author { login }
                  headRefName
                  repository { nameWithOwner }
                }
              }
            }
            toReview: search(query: $qReview, type: ISSUE, first: 1) {
              issueCount
            }
          }
        `
        const prData = await ghGraphQL(prQuery, {
          q: `is:pr is:open org:${ORG} involves:${username}`,
          qReview: `is:pr is:open org:${ORG} review-requested:${username} -author:${username}`,
        })
        pulls = (prData.myPrs?.nodes || []).filter((n: any) => n?.number !== undefined)
        reviewCount = prData.toReview?.issueCount || 0
      }
    } catch (prError) {
      console.error('Erro ao buscar PRs:', prError)
    }

    // Buscar menções
    let mentions: any[] = []
    try {
      if (username) {
        const mentionsQuery = `
          query($q: String!) {
            search(query: $q, type: ISSUE, first: 15) {
              nodes {
                __typename
                ... on Issue { number title url createdAt author { login } repository { nameWithOwner } }
                ... on PullRequest { number title url createdAt author { login } repository { nameWithOwner } }
              }
            }
          }
        `
        const mentionsData = await ghGraphQL(mentionsQuery, { q: `mentions:${username} sort:updated-desc` })
        mentions = (mentionsData.search?.nodes || [])
          .filter((n: any) => n?.number !== undefined)
          .map((n: any) => ({
            number: n.number,
            title: n.title,
            type: n.__typename === 'PullRequest' ? 'pr' : 'issue',
            repo: n.repository?.nameWithOwner || '',
            url: n.url,
            createdAt: n.createdAt,
            author: n.author?.login || 'unknown',
          }))
      }
    } catch (mentionsError) {
      console.error('Erro ao buscar menções:', mentionsError)
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
      reviewCount,
      pulls: pulls.map((p: any) => ({
        number: p.number,
        title: p.title,
        state: p.state,
        draft: p.isDraft || false,
        author: p.author?.login || 'unknown',
        branch: p.headRefName || '',
        createdAt: p.createdAt,
        url: p.url,
        repo: p.repository?.nameWithOwner || '',
      })),
      commits: (commits as any[]).map((c: any) => ({
        sha: c.sha?.slice(0, 7),
        message: (c.commit?.message as string)?.split('\n')[0].slice(0, 80),
        author: c.commit?.author?.name,
        date: c.commit?.author?.date,
        url: c.html_url,
      })),
      mentions,
    })
  } catch (err) {
    console.error('GitHub API Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}
