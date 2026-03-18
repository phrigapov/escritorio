import { NextRequest, NextResponse } from 'next/server'

const TOKEN = process.env.GITHUB_TOKEN
const OWNER = process.env.GITHUB_OWNER
const REPO  = process.env.GITHUB_REPO
const ORG   = process.env.GITHUB_ORG || 'sismacke'
const PROJECT_NUMBER = parseInt(process.env.GITHUB_PROJECT_NUMBER || '1', 10)

const REST_HEADERS: HeadersInit = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
}

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

// ── GET — detalhes completos da issue ────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { number: string } }
) {
  if (!OWNER || !REPO || !TOKEN) {
    return NextResponse.json({ error: 'Variaveis GitHub nao configuradas' }, { status: 500 })
  }

  const issueNumber = parseInt(params.number, 10)
  if (isNaN(issueNumber)) {
    return NextResponse.json({ error: 'Numero invalido' }, { status: 400 })
  }

  try {
    // Query principal: issue + todos os campos do projeto
    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          labels(first: 100, orderBy: { field: NAME, direction: ASC }) {
            nodes { name color description }
          }
          issue(number: $number) {
            id
            number
            title
            body
            bodyHTML
            state
            stateReason
            createdAt
            updatedAt
            closedAt
            url
            isPinned
            author { login avatarUrl }
            assignees(first: 10) { nodes { login avatarUrl } }
            labels(first: 20) { nodes { name color } }
            milestone { title dueOn }
            linkedBranches(first: 5) { nodes { ref { name } } }
            timelineItems(last: 1, itemTypes: [CROSS_REFERENCED_EVENT, CONNECTED_EVENT]) {
              totalCount
            }
            reactions { totalCount }
            projectItems(first: 10, includeArchived: false) {
              nodes {
                id
                project { number title }
                fieldValues(first: 30) {
                  nodes {
                    __typename
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field {
                        ... on ProjectV2SingleSelectField {
                          name
                          id
                          options { id name color description }
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldTextValue {
                      text
                      field { ... on ProjectV2Field { name id } }
                    }
                    ... on ProjectV2ItemFieldNumberValue {
                      number
                      field { ... on ProjectV2Field { name id } }
                    }
                    ... on ProjectV2ItemFieldDateValue {
                      date
                      field { ... on ProjectV2Field { name id } }
                    }
                    ... on ProjectV2ItemFieldIterationValue {
                      title
                      startDate
                      duration
                      field {
                        ... on ProjectV2IterationField {
                          name
                          id
                          configuration {
                            iterations { id title startDate duration }
                            completedIterations { id title startDate duration }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            comments(first: 50, orderBy: { field: UPDATED_AT, direction: ASC }) {
              totalCount
              nodes {
                id
                body
                bodyHTML
                createdAt
                updatedAt
                author { login avatarUrl }
                reactions { totalCount }
              }
            }
          }
        }
      }
    `

    const data = await ghGraphQL(query, { owner: OWNER, repo: REPO, number: issueNumber })
    const issue = data.repository?.issue
    if (!issue) {
      return NextResponse.json({ error: 'Issue nao encontrada' }, { status: 404 })
    }

    // Todas as labels do repositorio
    const repoLabels = (data.repository?.labels?.nodes || []).map((l: any) => ({
      name: l.name,
      color: l.color,
      description: l.description || '',
    }))

    // Extrair campos do projeto
    const projectItem = issue.projectItems?.nodes?.find(
      (p: any) => p.project?.number === PROJECT_NUMBER
    ) ?? issue.projectItems?.nodes?.[0]

    const projectItemId = projectItem?.id || null
    const projectTitle = projectItem?.project?.title || null

    // Processar todos os campos customizados
    interface ProjectField {
      name: string
      fieldId: string
      type: string
      value: string | number | null
      options?: { id: string; name: string; color?: string; description?: string }[]
      iterations?: { id: string; title: string; startDate: string; duration: number }[]
    }

    const projectFields: ProjectField[] = []

    if (projectItem?.fieldValues?.nodes) {
      for (const fv of projectItem.fieldValues.nodes) {
        if (!fv?.field?.name) continue

        switch (fv.__typename) {
          case 'ProjectV2ItemFieldSingleSelectValue':
            projectFields.push({
              name: fv.field.name,
              fieldId: fv.field.id,
              type: 'single_select',
              value: fv.name,
              options: (fv.field.options || []).map((o: any) => ({
                id: o.id,
                name: o.name,
                color: o.color || null,
                description: o.description || '',
              })),
            })
            break

          case 'ProjectV2ItemFieldTextValue':
            projectFields.push({
              name: fv.field.name,
              fieldId: fv.field.id,
              type: 'text',
              value: fv.text,
            })
            break

          case 'ProjectV2ItemFieldNumberValue':
            projectFields.push({
              name: fv.field.name,
              fieldId: fv.field.id,
              type: 'number',
              value: fv.number,
            })
            break

          case 'ProjectV2ItemFieldDateValue':
            projectFields.push({
              name: fv.field.name,
              fieldId: fv.field.id,
              type: 'date',
              value: fv.date,
            })
            break

          case 'ProjectV2ItemFieldIterationValue':
            projectFields.push({
              name: fv.field.name,
              fieldId: fv.field.id,
              type: 'iteration',
              value: fv.title,
              iterations: [
                ...(fv.field.configuration?.iterations || []),
                ...(fv.field.configuration?.completedIterations || []),
              ].map((it: any) => ({
                id: it.id,
                title: it.title,
                startDate: it.startDate,
                duration: it.duration,
              })),
            })
            break
        }
      }
    }

    // Branches vinculadas
    const linkedBranches = (issue.linkedBranches?.nodes || [])
      .map((b: any) => b.ref?.name)
      .filter(Boolean)

    return NextResponse.json({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      bodyHTML: issue.bodyHTML || '',
      state: issue.state,
      stateReason: issue.stateReason,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      closedAt: issue.closedAt,
      url: issue.url,
      isPinned: issue.isPinned || false,
      reactionCount: issue.reactions?.totalCount || 0,
      referenceCount: issue.timelineItems?.totalCount || 0,
      author: {
        login: issue.author?.login || 'unknown',
        avatarUrl: issue.author?.avatarUrl || '',
      },
      assignees: (issue.assignees?.nodes || []).map((a: any) => ({
        login: a.login,
        avatarUrl: a.avatarUrl,
      })),
      labels: (issue.labels?.nodes || []).map((l: any) => ({
        name: l.name,
        color: l.color,
      })),
      repoLabels,
      milestone: issue.milestone?.title || null,
      milestoneDueOn: issue.milestone?.dueOn || null,
      linkedBranches,
      comments: (issue.comments?.nodes || []).map((c: any) => ({
        id: c.id,
        body: c.body || '',
        bodyHTML: c.bodyHTML || '',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        reactionCount: c.reactions?.totalCount || 0,
        author: {
          login: c.author?.login || 'unknown',
          avatarUrl: c.author?.avatarUrl || '',
        },
      })),
      commentCount: issue.comments?.totalCount || 0,
      // Dados do projeto
      projectItemId,
      projectTitle,
      projectFields,
    })
  } catch (err) {
    console.error('GitHub Issue Detail Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}

// ── PATCH — atualizar issue ──────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { number: string } }
) {
  if (!OWNER || !REPO || !TOKEN) {
    return NextResponse.json({ error: 'Variaveis GitHub nao configuradas' }, { status: 500 })
  }

  const issueNumber = parseInt(params.number, 10)
  if (isNaN(issueNumber)) {
    return NextResponse.json({ error: 'Numero invalido' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const results: Record<string, any> = {}

    // 1) Atualizar campos basicos via REST
    const restUpdate: Record<string, any> = {}
    if (body.title !== undefined) restUpdate.title = body.title
    if (body.body !== undefined) restUpdate.body = body.body
    if (body.state !== undefined) restUpdate.state = body.state.toLowerCase()
    if (body.state_reason !== undefined) restUpdate.state_reason = body.state_reason
    if (body.assignees !== undefined) restUpdate.assignees = body.assignees
    if (body.labels !== undefined) restUpdate.labels = body.labels

    if (Object.keys(restUpdate).length > 0) {
      const res = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/issues/${issueNumber}`,
        {
          method: 'PATCH',
          headers: { ...REST_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify(restUpdate),
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(`REST update failed ${res.status}: ${err.message || ''}`)
      }
      results.issue = await res.json()
    }

    // 2) Atualizar campo do projeto via GraphQL (generico — single_select, text, number, date, iteration)
    if (body.projectField && body.projectItemId) {
      const { fieldId, type, value } = body.projectField

      // Buscar projectId
      const projectQuery = `
        query($org: String!, $number: Int!) {
          organization(login: $org) {
            projectV2(number: $number) { id }
          }
        }
      `
      const projectData = await ghGraphQL(projectQuery, { org: ORG, number: PROJECT_NUMBER })
      const projectId = projectData.organization?.projectV2?.id

      if (projectId) {
        let fieldValue: Record<string, any> = {}

        switch (type) {
          case 'single_select':
            fieldValue = { singleSelectOptionId: value }
            break
          case 'text':
            fieldValue = { text: value }
            break
          case 'number':
            fieldValue = { number: parseFloat(value) }
            break
          case 'date':
            fieldValue = { date: value }
            break
          case 'iteration':
            fieldValue = { iterationId: value }
            break
        }

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
          itemId: body.projectItemId,
          fieldId,
          value: fieldValue,
        })
        results.projectField = 'updated'
      }
    }

    // 3) Adicionar comentario
    if (body.comment) {
      const res = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/issues/${issueNumber}/comments`,
        {
          method: 'POST',
          headers: { ...REST_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: body.comment }),
        }
      )
      if (!res.ok) throw new Error(`Comment failed ${res.status}`)
      results.comment = await res.json()
    }

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    console.error('GitHub Issue Update Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}
