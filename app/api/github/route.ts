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

// Buscar issues do projeto filtradas por usuário (apenas abertas)
async function getProjectItemsForUser(org: string, projectNumber: number, username: string) {
  console.log(`[DEBUG] Buscando issues abertas atribuídas a: ${username}`)
  
  const itemFragment = `
    id
    content {
      ... on Issue {
        number
        title
        state
        url
        createdAt
        author {
          login
        }
        assignees(first: 10) {
          nodes {
            login
          }
        }
        labels(first: 20) {
          nodes {
            name
            color
          }
        }
      }
    }
    fieldValues(first: 20) {
      nodes {
        ... on ProjectV2ItemFieldSingleSelectValue {
          name
          field {
            ... on ProjectV2SingleSelectField {
              name
            }
          }
        }
        ... on ProjectV2ItemFieldTextValue {
          text
          field {
            ... on ProjectV2Field {
              name
            }
          }
        }
      }
    }
  `

  // Buscar todas as issues do usuário (paginação otimizada)
  let allItems: any[] = []
  let hasNextPage = true
  let cursor: string | null = null
  let pageCount = 0

  while (hasNextPage && pageCount < 10) { // Máximo 10 páginas
    pageCount++
    const query = `
      query($org: String!, $projectNumber: Int!, $cursor: String) {
        organization(login: $org) {
          projectV2(number: $projectNumber) {
            id
            title
            items(first: 100, after: $cursor) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                ${itemFragment}
              }
            }
          }
        }
      }
    `
    
    const data = await ghGraphQL(query, { org, projectNumber, cursor })
    const itemsData = data.organization?.projectV2?.items
    
    if (itemsData?.nodes) {
      // Filtrar apenas issues abertas do usuário
      const filteredItems = itemsData.nodes.filter((item: any) => {
        const content = item.content
        if (!content || content.state !== 'OPEN') return false
        
        const assignees = content.assignees?.nodes?.map((a: any) => a.login) || []
        return assignees.includes(username)
      })
      
      allItems = allItems.concat(filteredItems)
      hasNextPage = itemsData.pageInfo.hasNextPage
      cursor = itemsData.pageInfo.endCursor
      
      console.log(`[DEBUG] Página ${pageCount}: ${filteredItems.length} issues do usuário (de ${itemsData.nodes.length} total)`)
    } else {
      hasNextPage = false
    }
  }
  
  console.log(`[DEBUG] Total encontrado: ${allItems.length} issues abertas de ${username}`)
  return allItems
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
        console.log(`[DEBUG] Nenhum usuário fornecido, retornando listas vazias`)
        throw new Error('Username obrigatório')
      }
      
      const items = await getProjectItemsForUser(ORG, parseInt(PROJECT_NUMBER), username)
      console.log(`[DEBUG] Processando ${items.length} issues abertas de ${username}`)
      
      // Verificar se issue #7076 está nos resultados
      const issue7076 = items.find((item: any) => item.content?.number === 7076)
      if (issue7076) {
        console.log(`[DEBUG] ✓ Issue #7076 ENCONTRADA`)
        const statusField7076 = issue7076.fieldValues?.nodes?.find((f: any) => f.field?.name?.toLowerCase() === 'status')
        console.log(`[DEBUG] Issue #7076 Status: ${statusField7076?.name || 'sem status'}`)
      }

      // Processar items do projeto
      let processedCount = 0
      
      items.forEach((item: any) => {
        const content = item.content
        if (!content) return
        
        processedCount++

        // Pegar o valor do campo Status
        const statusField = item.fieldValues?.nodes?.find(
          (field: any) => field.field?.name?.toLowerCase() === 'status'
        )
        const status = statusField?.name?.toLowerCase() || ''

        const issue = {
          number: content.number,
          title: content.title,
          state: content.state,
          labels: (content.labels?.nodes || []).map((l: any) => ({
            name: l.name,
            color: l.color,
          })),
          author: content.author?.login || 'unknown',
          assignees: (content.assignees?.nodes || []).map((a: any) => a.login),
          createdAt: content.createdAt,
          url: content.url,
          status: status,
        }
        
        // Log simplificado (primeiras 20 issues)
        const categoryInfo = status.includes('sprint') ? 'Sprint' : 
                            status.includes('backlog') ? 'Backlog' : 
                            status.includes('test') || status.includes('teste') ? 'Test' : 
                            status ? `Outro(${status})` : 'Sem status'
        
        if (processedCount <= 20) {
          console.log(`[DEBUG] #${issue.number} | ${categoryInfo} | Status: "${statusField?.name}"`)
        }
        
        // Todas as issues já são do usuário (filtro feito na query)
        myIssues.push(issue)
        
        // Categorizar por status (aceita variações como "Backlogs" e "backlog")
        if (status.includes('sprint')) {
          sprintIssues.push(issue)
        } else if (status.includes('backlog')) {
          backlogIssues.push(issue)
        } else if (status.includes('test') || status.includes('teste')) {
          testIssues.push(issue)
        }
      })
      
      console.log(`\n[DEBUG] Estatísticas:`)
      console.log(`  Issues processadas: ${processedCount}`)
      console.log(`  Usuário: ${username}`)
      console.log(`  Sprint: ${sprintIssues.length}`)
      console.log(`  Backlog: ${backlogIssues.length}`)
      console.log(`  Test: ${testIssues.length}`)
      
    } catch (projectError) {
      console.error('Erro ao buscar projeto:', projectError)
      // Se falhar, continua sem dados do projeto
    }

    console.log(`\n[DEBUG] RESUMO:`)
    console.log(`  Total processado: ${sprintIssues.length + backlogIssues.length + testIssues.length} issues`)
    console.log(`  My Issues: ${myIssues.length} - [${myIssues.map(i => `#${i.number}`).join(', ')}]`)
    console.log(`  Sprint: ${sprintIssues.length} - [${sprintIssues.map(i => `#${i.number}`).join(', ')}]`)
    console.log(`  Backlog: ${backlogIssues.length} - [${backlogIssues.map(i => `#${i.number}`).join(', ')}]`)
    console.log(`  Test: ${testIssues.length} - [${testIssues.map(i => `#${i.number}`).join(', ')}]`)
    
    // Verificar issue #7076 especificamente
    const all = [...sprintIssues, ...backlogIssues, ...testIssues]
    const has7076 = all.find(i => i.number === 7076)
    if (has7076) {
      console.log(`  ✓ Issue #7076 presente na categoria: ${has7076.status}`)
    } else {
      console.log(`  ✗ Issue #7076 NÃO encontrada nas categorias`)
    }
    console.log()

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
