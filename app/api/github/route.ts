import { NextRequest, NextResponse } from 'next/server'

const TOKEN = process.env.GITHUB_TOKEN
const OWNER = process.env.GITHUB_OWNER
const REPO  = process.env.GITHUB_REPO

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

export async function GET(req: NextRequest) {
  if (!OWNER || !REPO) {
    return NextResponse.json({ error: 'GITHUB_OWNER ou GITHUB_REPO não configurado' }, { status: 500 })
  }

  try {
    const [repo, issues, pulls, commits] = await Promise.all([
      ghFetch(`/repos/${OWNER}/${REPO}`),
      ghFetch(`/repos/${OWNER}/${REPO}/issues?state=open&per_page=20&labels=`),
      ghFetch(`/repos/${OWNER}/${REPO}/pulls?state=open&per_page=10`),
      ghFetch(`/repos/${OWNER}/${REPO}/commits?per_page=10`),
    ])

    // Separa issues reais de PRs (GitHub retorna PRs na rota de issues)
    const issueList = (issues as any[]).filter((i: any) => !i.pull_request)

    return NextResponse.json({
      repo: {
        name:        repo.name,
        fullName:    repo.full_name,
        description: repo.description,
        stars:       repo.stargazers_count,
        forks:       repo.forks_count,
        openIssues:  repo.open_issues_count,
        defaultBranch: repo.default_branch,
        updatedAt:   repo.updated_at,
      },
      issues: issueList.map((i: any) => ({
        number:    i.number,
        title:     i.title,
        state:     i.state,
        labels:    (i.labels as any[]).map((l: any) => ({ name: l.name, color: l.color })),
        author:    i.user?.login,
        createdAt: i.created_at,
        url:       i.html_url,
      })),
      pulls: (pulls as any[]).map((p: any) => ({
        number:    p.number,
        title:     p.title,
        state:     p.state,
        draft:     p.draft,
        author:    p.user?.login,
        branch:    p.head?.ref,
        createdAt: p.created_at,
        url:       p.html_url,
      })),
      commits: (commits as any[]).map((c: any) => ({
        sha:       c.sha?.slice(0, 7),
        message:   (c.commit?.message as string)?.split('\n')[0].slice(0, 80),
        author:    c.commit?.author?.name,
        date:      c.commit?.author?.date,
        url:       c.html_url,
      })),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}
