# 🔐 Sistema de Autenticação

Este projeto possui um sistema de autenticação flexível que permite duas formas de login:

## 📋 Tipos de Login

### 1. Login Simples (por nome)
- Apenas digite um nome de usuário
- Acesso imediato ao escritório virtual
- Ideal para testes rápidos e acesso casual
- **Sem restrições de acesso**

### 2. Login com GitHub OAuth
- Autenticação via conta GitHub
- **Disponível para qualquer usuário do GitHub**
- Avatar do GitHub exibido automaticamente
- Login rápido e seguro

## ⚙️ Configuração

### Pré-requisitos

1. **GitHub Personal Access Token** (para verificação de org):
   - Acesse: https://github.com/settings/tokens
   - Crie um token com permissão `read:org`
   - Adicione ao `.env.local` como `GITHUB_TOKEN`

2. **GitHub OAuth App**:
   - Acesse: https://github.com/settings/developers
   - Crie um novo OAuth App
   - Configure:
     - **Homepage URL**: `http://localhost:3000`
     - **Callback URL**: `http://localhost:3000/api/auth/callback`
   - Copie o Client ID e Client Secret
   - Adicione ao `.env.local`

### Variáveis necessárias no `.env.local`:

```bash
# Credenciais OAuth
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

## 🔄 Fluxo de Autenticação GitHub

```
[Usuário] 
    ↓
[Clica "Entrar com GitHub"]
    ↓
[Redirecionado para github.com] → /api/auth/github
    ↓
[Autoriza no GitHub]
    ↓
[GitHub retorna código] → /api/auth/callback
    ↓
[Troca código por token]
    ↓
[Busca dados do usuário]
    ↓
[Login com sucesso ✅]
```

## 🛡️ Segurança

- **Client Secret**: Mantido no servidor, nunca exposto ao cliente
- **Token de acesso**: Usado apenas temporariamente para buscar dados do usuário
- **Autenticação via GitHub**: Usa o sistema OAuth2 oficial do GitHub
- **Scopes OAuth**: Apenas `user:email` (acesso mínimo necessário)

## 🚀 Para Produção

1. **Crie um novo OAuth App** para produção com as URLs corretas:
   - Homepage URL: `https://seu-dominio.com`
   - Callback URL: `https://seu-dominio.com/api/auth/callback`

2. **Atualize as variáveis de ambiente** no seu servidor:
   ```bash
   GITHUB_REDIRECT_URI=https://seu-dominio.com/api/auth/callback
   ```

3. **Configure variáveis de ambiente** na sua plataforma de hosting:
   - Vercel: Project Settings → Environment Variables
   - Azure: Configuration → Application settings
   - Outras: veja a documentação específica

## 📝 API Routes

O sistema usa as seguintes rotas:

- `GET /api/auth/github` - Inicia o fluxo OAuth
- `GET /api/auth/callback` - Callback do GitHub após autorização

## 🔍 Troubleshooting

### Erro: "Configuração OAuth incompleta no servidor"
- Verifique se `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET` estão no `.env.local`
- Reinicie o servidor Next.js

### Erro: "Código de autorização não recebido"
- Verifique se a URL de callback está correta no GitHub OAuth App
- Confirme se `GITHUB_REDIRECT_URI` no `.env.local` está correto

### Login não funciona
- Verifique os logs do console (F12)
- Veja os logs do terminal do servidor Next.js
- Teste se as variáveis de ambiente estão carregadas

## 🎯 Próximos Passos (Futuro)

Possíveis melhorias para o sistema de autenticação:

- [ ] Adicionar mais provedores OAuth (Google, Discord, etc.)
- [ ] Sessões persistentes com JWT
- [ ] Dashboard de administração
- [ ] Logs de auditoria de login
- [ ] Rate limiting para prevenir abuso
- [ ] Sistema de permissões/roles baseado em organizações do GitHub
