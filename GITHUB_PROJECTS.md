# Configuração do GitHub Projects

Este documento explica como configurar o projeto GitHub para integração com o painel lateral.

## Visão Geral

O painel GitHub mostra issues organizadas por status usando **GitHub Projects (Beta)**. As issues são categorizadas em:
- **Backlog**: Issues no backlog
- **Sprint**: Issues na sprint atual
- **Test**: Issues em teste

## Pré-requisitos

1. Um projeto GitHub Projects v2 criado na organização
2. Um campo personalizado chamado "Status" no projeto
3. Issues vinculadas ao projeto com valores de status definidos

## Como Encontrar o Número do Projeto

### Método 1: Pela URL do Projeto

1. Abra seu projeto no GitHub: `https://github.com/orgs/sismacke/projects/X`
2. O número `X` na URL é o número do projeto
3. Exemplo: `https://github.com/orgs/sismacke/projects/5` → número do projeto é `5`

### Método 2: Via GraphQL

```bash
curl -H "Authorization: bearer TOKEN" -X POST -d " \
{
  \"query\": \"query { organization(login: \\\"sismacke\\\") { projectsV2(first: 10) { nodes { number title } } } }\"
}" https://api.github.com/graphql
```

## Configuração do Campo Status

O projeto precisa ter um campo chamado **"Status"** com os seguintes valores possíveis:
- Um valor contendo "backlog" (ex: "Backlog", "📋 Backlog")
- Um valor contendo "sprint" (ex: "Sprint", "🏃 Sprint")
- Um valor contendo "test" (ex: "Test", "🧪 Test", "Em teste")

**Nota**: A comparação é case-insensitive e busca por substring, então "Sprint Atual" também funciona.

### Exemplo de Configuração no GitHub

1. Vá para o seu projeto
2. Clique em "⚙️ Settings" (canto superior direito)
3. Na seção "Fields", clique em "+ New field"
4. Configure:
   - **Name**: Status
   - **Type**: Single select
   - **Options**: 
     - 📋 Backlog
     - 🏃 Sprint
     - 🧪 Test
     - ✅ Concluído
     - etc.

## Variáveis de Ambiente

Adicione ao seu arquivo `.env.local`:

```bash
# Organização GitHub
GITHUB_ORG=sismacke

# Número do projeto (encontrado na URL do projeto)
GITHUB_PROJECT_NUMBER=1

# Token com permissões adequadas
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

### Permissões Necessárias do Token

Seu `GITHUB_TOKEN` precisa ter as seguintes permissões (scopes):
- ✅ `read:project` - Para ler dados do projeto
- ✅ `repo` - Para ler issues e commits

Para criar um token:
1. Acesse https://github.com/settings/tokens/new
2. Selecione os scopes necessários
3. Clique em "Generate token"
4. Copie o token e adicione ao `.env.local`

## Estrutura dos Dados

A API GraphQL retorna os dados assim:

```typescript
{
  organization: {
    projectV2: {
      items: {
        nodes: [
          {
            content: {
              __typename: "Issue",
              number: 123,
              title: "Título da issue",
              state: "OPEN",
              assignees: [...],
              labels: [...]
            },
            fieldValues: {
              nodes: [
                {
                  __typename: "ProjectV2ItemFieldSingleSelectValue",
                  field: { name: "Status" },
                  name: "Sprint"
                }
              ]
            }
          }
        ]
      }
    }
  }
}
```

## Troubleshooting

### Issues não aparecem nas abas

**Problema**: As issues existem no projeto mas não aparecem nas abas Backlog/Sprint/Test.

**Soluções**:
1. Verifique se o campo se chama exatamente "Status" (case-sensitive no GraphQL)
2. Confirme que os valores contêm "backlog", "sprint" ou "test" (case-insensitive)
3. Verifique se as issues estão vinculadas ao projeto correto
4. Confirme que `GITHUB_ORG` e `GITHUB_PROJECT_NUMBER` estão corretos

### Erro 401 ou 403

**Problema**: `Error fetching GitHub data: 401` ou `403`

**Soluções**:
1. Verifique se o `GITHUB_TOKEN` é válido
2. Confirme que o token tem permissão `read:project`
3. Verifique se você tem acesso ao projeto na organização

### Campo Status não encontrado

**Problema**: O campo Status não é reconhecido.

**Solução**: O nome do campo é case-sensitive no GraphQL. Certifique-se que está exatamente como "Status". Se você usa outro nome (como "Estado"), modifique a linha no código:

```typescript
// Em app/api/github/route.ts, linha ~100
const statusFieldValue = fieldValues.find(
  (fv: any) => fv.__typename === 'ProjectV2ItemFieldSingleSelectValue' &&
    fv.field?.name === 'Status' // <- Altere aqui se usar outro nome
);
```

## Testando a Configuração

1. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

2. Faça login com seu usuário GitHub

3. Abra o painel GitHub (ícone do GitHub no canto superior direito)

4. Verifique se:
   - A aba "Overview" mostra os contadores corretos
   - As abas "Backlog", "Sprint" e "Test" mostram as issues corretas
   - As issues estão categorizadas conforme o valor do campo Status

5. Verifique o console do navegador para mensagens de debug mostrando os dados do projeto

## Personalizando Categorias

Se você quiser adicionar mais categorias além de backlog/sprint/test, modifique:

1. **Interface TypeScript** (`components/GitHubPanel.tsx`):
```typescript
interface GHData {
  // ... outros campos
  backlog: Issue[];
  sprint: Issue[];
  test: Issue[];
  novacategoria: Issue[]; // <- adicione aqui
}
```

2. **Lógica de categorização** (`app/api/github/route.ts`):
```typescript
if (statusLower.includes('sprint')) sprint.push(issue);
else if (statusLower.includes('backlog')) backlog.push(issue);
else if (statusLower.includes('test')) test.push(issue);
else if (statusLower.includes('novacategoria')) novacategoria.push(issue); // <- adicione aqui
```

3. **UI da aba** (`components/GitHubPanel.tsx`):
```typescript
<button 
  onClick={() => setActiveTab('novacategoria')}
  className={activeTab === 'novacategoria' ? styles.activeTab : ''}
>
  🎯 Nova ({data.novacategoria?.length || 0})
</button>
```
