import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  assignees: Array<{
    login: string;
    avatar_url: string;
  }>;
  user: {
    login: string;
    avatar_url: string;
  };
  body: string | null;
  comments: number;
  milestone?: {
    title: string;
    due_on: string | null;
  } | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
}

// Função para buscar campos customizados via GraphQL
async function fetchProjectFieldsForIssues(
  owner: string,
  repo: string,
  issueNumbers: number[],
  token: string
): Promise<Map<number, { startDate?: string | null; endDate?: string | null; status?: string | null }>> {
  const fields = new Map<number, { startDate?: string | null; endDate?: string | null; status?: string | null }>();
  
  if (issueNumbers.length === 0) return fields;

  // Limitar a 50 issues por vez para não exceder limites da API
  const batchSize = 50;
  for (let i = 0; i < issueNumbers.length; i += batchSize) {
    const batch = issueNumbers.slice(i, i + batchSize);
    
    try {
      // Query GraphQL para buscar project fields
      const query = `
        query {
          repository(owner: "${owner}", name: "${repo}") {
            ${batch.map(num => `
              issue${num}: issue(number: ${num}) {
                number
                projectItems(first: 10) {
                  nodes {
                    fieldValues(first: 20) {
                      nodes {
                        ... on ProjectV2ItemFieldDateValue {
                          field {
                            ... on ProjectV2Field {
                              name
                            }
                          }
                          date
                        }
                        ... on ProjectV2ItemFieldSingleSelectValue {
                          field {
                            ... on ProjectV2SingleSelectField {
                              name
                            }
                          }
                          name
                        }
                      }
                    }
                  }
                }
              }
            `).join('\n')}
          }
        }
      `;

      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        console.error('GraphQL error:', await response.text());
        continue;
      }

      const result = await response.json();
      
      if (result.errors) {
        console.error('GraphQL errors:', result.errors);
        continue;
      }

      // Processar resultados
      const repoData = result.data?.repository;
      if (repoData) {
        batch.forEach(num => {
          const issueData = repoData[`issue${num}`];
          if (issueData?.projectItems?.nodes) {
            let startDate: string | null = null;
            let endDate: string | null = null;
            let status: string | null = null;

            issueData.projectItems.nodes.forEach((item: any) => {
              item.fieldValues?.nodes?.forEach((fieldValue: any) => {
                const fieldName = fieldValue.field?.name?.toLowerCase();
                
                if (fieldName === 'startdate' || fieldName === 'start date') {
                  startDate = fieldValue.date;
                } else if (fieldName === 'enddate' || fieldName === 'end date') {
                  endDate = fieldValue.date;
                } else if (fieldName === 'status') {
                  status = fieldValue.name;
                }
              });
            });

            if (startDate || endDate || status) {
              fields.set(issueData.number, { startDate, endDate, status });
            }
          }
        });
      }
    } catch (error) {
      console.error(`Error fetching GraphQL batch ${i}:`, error);
    }
  }

  return fields;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state') || 'all'; // 'open', 'closed', 'all'
    const labels = searchParams.get('labels') || ''; // comma-separated
    const since = searchParams.get('since') || ''; // ISO 8601 timestamp
    const forceRefresh = searchParams.has('_t'); // timestamp indica refresh forçado
    
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER || 'sismacke';
    const repo = process.env.GITHUB_REPO || 'mackensina';

    if (!token) {
      return NextResponse.json(
        { error: 'GitHub token não configurado' },
        { status: 500 }
      );
    }

    // Buscar todas as issues com paginação ilimitada
    let allIssues: GitHubIssue[] = [];
    let page = 1;
    let hasMorePages = true;
    
    while (hasMorePages) {
      let url = `https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&per_page=100&page=${page}`;
      if (labels) {
        url += `&labels=${labels}`;
      }
      if (since) {
        url += `&since=${since}`;
      }

      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Cronograma-TE-App'
          },
          // Usar cache exceto quando forçar refresh
          next: forceRefresh ? { revalidate: 0 } : { revalidate: 86400 },
          cache: forceRefresh ? 'no-store' : 'force-cache'
        });
        
        if (!response.ok) {
          // Se falhar, usar o que já temos
          if (allIssues.length > 0) {
            break;
          }
          const errorData = await response.json();
          return NextResponse.json(
            { error: 'Erro ao buscar issues do GitHub', details: errorData },
            { status: response.status }
          );
        }

        const issues: GitHubIssue[] = await response.json();
        
        // Se retornou 0 issues, não há mais páginas
        if (issues.length === 0) {
          hasMorePages = false;
          break;
        }
        
        allIssues = allIssues.concat(issues);
        console.log(`✓ Página ${page}: ${issues.length} issues (total acumulado: ${allIssues.length})`);
        
        // Se retornou menos que 100, é a última página
        if (issues.length < 100) {
          hasMorePages = false;
          break;
        }
        
        page++;
      } catch (error) {
        console.error(`Erro ao buscar página ${page}:`, error);
        // Se já temos dados, continuar com o que temos
        if (allIssues.length > 0) {
          break;
        }
        throw error;
      }
    }
    
    // Filtrar pull requests (issues com 'pull_request' key)
    const filteredIssues = allIssues.filter(issue => !('pull_request' in issue));

    // Buscar campos customizados via GraphQL para todas as issues
    console.log(`🔍 Buscando campos customizados para ${filteredIssues.length} issues via GraphQL...`);
    const issueNumbers = filteredIssues.map(issue => issue.number);
    const projectFields = await fetchProjectFieldsForIssues(owner, repo, issueNumbers, token);
    
    // Adicionar campos customizados às issues
    const issuesWithFields = filteredIssues.map(issue => {
      const fields = projectFields.get(issue.number);
      return {
        ...issue,
        startDate: fields?.startDate || null,
        endDate: fields?.endDate || null,
        status: fields?.status || null,
      };
    });

    console.log(`✓ ${projectFields.size} issues com campos customizados encontrados`);

    return NextResponse.json({
      issues: issuesWithFields,
      total: issuesWithFields.length,
      repository: `${owner}/${repo}`
    });
  } catch (error) {
    console.error('Erro na API GitHub:', error);
    return NextResponse.json(
      { error: 'Erro interno ao buscar issues' },
      { status: 500 }
    );
  }
}
