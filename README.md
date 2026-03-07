# 🏢 Escritório Virtual Multiplayer

Uma plataforma de escritório 2D online em tempo real, construída com Next.js, Phaser e Socket.io.

## ✨ Funcionalidades

- 🎮 **Jogo 2D com Phaser**: Escritório interativo renderizado com a engine Phaser
- 👥 **Multiplayer em Tempo Real**: Veja outros usuários online simultaneamente
- 🚶 **Movimentação Livre**: Use WASD ou setas para se mover pelo escritório
- 💬 **Chat em Tempo Real**: Converse com outros usuários através do chat integrado
- 🎨 **Avatares Coloridos**: Cada jogador tem um avatar único com cor aleatória
- 📱 **Design Responsivo**: Funciona em diferentes tamanhos de tela

## 🛠️ Tecnologias

- **Frontend**: Next.js 14, React 18, TypeScript
- **Game Engine**: Phaser 3
- **Comunicação em Tempo Real**: Socket.io
- **Servidor**: Node.js com Express
- **Estilização**: CSS Modules

## 🚀 Como Rodar o Projeto

### Pré-requisitos

- Node.js 18+ instalado
- npm ou yarn

### Instalação

1. **Instale as dependências do frontend:**
```bash
npm install
```

2. **Instale as dependências do servidor:**
```bash
cd server
npm install
cd ..
```

### Rodando o Projeto

Você precisa rodar o servidor e o frontend simultaneamente:

1. **Terminal 1 - Servidor WebSocket:**
```bash
cd server
npm run dev
```
O servidor rodará na porta 3001

2. **Terminal 2 - Frontend Next.js:**
```bash
npm run dev
```
O frontend rodará na porta 3000

3. **Acesse no navegador:**
```
http://localhost:3000
```

## 🎮 Como Usar

1. Digite seu nome na tela inicial
2. Clique em "Entrar no Escritório"
3. Use as teclas **WASD** ou **setas do teclado** para mover seu avatar
4. Use o **chat** no canto inferior direito para conversar
5. Abra em múltiplas abas/navegadores para testar o multiplayer!

## 📁 Estrutura do Projeto

```
escritorio/
├── app/                      # Páginas Next.js
│   ├── layout.tsx           # Layout principal
│   ├── page.tsx             # Página inicial
│   ├── page.module.css      # Estilos da página
│   └── globals.css          # Estilos globais
├── components/              # Componentes React
│   ├── Game.tsx            # Componente principal do jogo
│   ├── Game.module.css     # Estilos do jogo
│   ├── Chat.tsx            # Componente de chat
│   └── Chat.module.css     # Estilos do chat
├── game/                    # Lógica do Phaser
│   └── scenes/
│       └── MainScene.ts    # Cena principal do escritório
├── server/                  # Servidor WebSocket
│   ├── server.js           # Servidor Socket.io
│   └── package.json        # Dependências do servidor
├── package.json            # Dependências do frontend
├── tsconfig.json           # Configuração TypeScript
└── next.config.js          # Configuração Next.js
```

## 🎨 Customização

### Alterar o Layout do Escritório

Edite o arquivo `game/scenes/MainScene.ts` na função `createOffice()` para adicionar ou modificar elementos do escritório.

### Alterar Cores e Estilos

Os arquivos CSS Module permitem customizar facilmente:
- `app/page.module.css` - Tela de login
- `components/Chat.module.css` - Chat
- `components/Game.module.css` - Container do jogo

### Adicionar Novos Recursos

- **Novos objetos no escritório**: Adicione na `MainScene.ts`
- **Novas interações**: Adicione eventos no `update()` da cena
- **Novos eventos de rede**: Adicione no servidor (`server/server.js`) e no cliente (`MainScene.ts`)

## 🔧 Configurações

### Porta do Servidor

Para alterar a porta do servidor WebSocket, edite `server/server.js`:
```javascript
const PORT = process.env.PORT || 3001
```

E atualize a conexão nos arquivos:
- `game/scenes/MainScene.ts`
- `components/Chat.tsx`

### Limites do Mundo

Para alterar o tamanho do escritório, edite em `MainScene.ts`:
```typescript
const width = 1600
const height = 1200
```

## 🐛 Troubleshooting

### Erro de conexão com Socket.io

Certifique-se de que:
1. O servidor está rodando na porta 3001
2. As URLs de conexão apontam para `http://localhost:3001`
3. Não há firewall bloqueando a porta

### Avatares não aparecem

Verifique no console do navegador se há erros. Geralmente é problema de conexão com o servidor.

### Game não renderiza

Isso pode acontecer se:
1. O Phaser não carregou corretamente
2. Há conflito com SSR do Next.js (por isso usamos `dynamic import` com `ssr: false`)

## 🚀 Deploy

### Frontend (Vercel)

```bash
npm run build
vercel deploy
```

Lembre-se de atualizar as URLs do Socket.io para o endereço do servidor em produção.

### Servidor (Heroku, Railway, etc)

O servidor pode ser deployado em qualquer plataforma Node.js:

```bash
cd server
# Configure a variável de ambiente PORT
# Configure CORS para aceitar o domínio do frontend
```

## 📝 Próximas Funcionalidades

- [ ] Sistema de salas/escritórios separados
- [ ] Persistência de dados com banco de dados
- [ ] Emojis e reações
- [ ] Áudio/vídeo chamadas integradas
- [ ] Quadro branco colaborativo
- [ ] Sistema de permissões e moderação
- [ ] Customização de avatares
- [ ] Animações de caminhada
- [ ] Colisão entre jogadores
- [ ] Zonas de interação (mesas, café, etc)

## 📄 Licença

MIT

## 👨‍💻 Desenvolvedor

Desenvolvido com ❤️ usando Next.js e Phaser

---

Para dúvidas ou sugestões, sinta-se à vontade para abrir uma issue!
