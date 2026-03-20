import { NextRequest, NextResponse } from 'next/server'

const TOKEN = process.env.GITHUB_TOKEN
const OWNER = process.env.GITHUB_OWNER
const REPO  = process.env.GITHUB_REPO
const ORG   = process.env.GITHUB_ORG || 'sismacke'
const PROJECT_NUMBER = parseInt(process.env.GITHUB_PROJECT_NUMBER || '1', 10)

async function ghGraphQL(query: string, variables: Record<string, unknown> = {}) {
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

// POST /api/github/move
// body: { issueNumber: number, targetStatus: string }  (e.g. "sprint" ou "backlog")
export async function POST(req: NextRequest) {
  if (!OWNER || !REPO || !TOKEN) {
    return NextResponse.json({ error: 'GitHub não configurado' }, { status: 500 })
  }

  const { issueNumber, targetStatus } = await req.json()
  if (!issueNumber || !targetStatus) {
    return NextResponse.json({ error: 'issueNumber e targetStatus obrigatórios' }, { status: 400 })
  }

  // 1. Buscar project item id + opções do campo Status
  const issueQuery = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          projectItems(first: 10, includeArchived: false) {
            nodes {
              id
              project { number }
              fieldValues(first: 20) {
                nodes {
                  __typename
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    field {
                      ... on ProjectV2SingleSelectField {
                        id
                        name
                        options { id name }
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

  const issueData = await ghGraphQL(issueQuery, { owner: OWNER, repo: REPO, number: issueNumber })
  const issue = issueData.repository?.issue
  if (!issue) return NextResponse.json({ error: 'Issue não encontrada' }, { status: 404 })

  const projectItem = issue.projectItems?.nodes?.find(
    (p: any) => p.project?.number === PROJECT_NUMBER
  ) ?? issue.projectItems?.nodes?.[0]

  if (!projectItem) {
    return NextResponse.json({ error: 'Issue não está em nenhum projeto' }, { status: 404 })
  }

  const statusFV = projectItem.fieldValues?.nodes?.find(
    (fv: any) => fv.field?.name?.toLowerCase() === 'status'
  )

  if (!statusFV?.field) {
    return NextResponse.json({ error: 'Campo Status não encontrado no projeto' }, { status: 404 })
  }

  const fieldId = statusFV.field.id
  const options = statusFV.field.options as { id: string; name: string }[]
  const target = targetStatus.toLowerCase()

  // Match parcial case-insensitive
  const targetOpt = options.find(o =>
    o.name.toLowerCase() === target ||
    o.name.toLowerCase().includes(target) ||
    target.includes(o.name.toLowerCase())
  )

  if (!targetOpt) {
    return NextResponse.json({
      error: `Opção "${targetStatus}" não encontrada. Disponíveis: ${options.map(o => o.name).join(', ')}`,
    }, { status: 404 })
  }

  // 2. Buscar project id
  const projectQuery = `
    query($org: String!, $number: Int!) {
      organization(login: $org) {
        projectV2(number: $number) { id }
      }
    }
  `
  const projectData = await ghGraphQL(projectQuery, { org: ORG, number: PROJECT_NUMBER })
  const projectId = projectData.organization?.projectV2?.id
  if (!projectId) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

  // 3. Atualizar
  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: $value
      }) {
        projectV2Item { id }
      }
    }
  `

  await ghGraphQL(mutation, {
    projectId,
    itemId: projectItem.id,
    fieldId,
    value: { singleSelectOptionId: targetOpt.id },
  })

  return NextResponse.json({ ok: true, movedTo: targetOpt.name })
}
