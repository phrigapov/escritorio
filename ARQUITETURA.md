# 🏗️ Arquitetura do Projeto

## Visão Geral

Este projeto é dividido em três partes principais:

1. **Frontend Next.js** (porta 3000)
2. **Game Engine Phaser** (cliente)
3. **Servidor WebSocket** (porta 3001)

## Fluxo de Comunicação

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Navegador  │ ◄─────► │   Next.js    │ ◄─────► │   Socket    │
│   (Phaser)  │         │  (React)     │         │   Server    │
└─────────────┘         └──────────────┘         └─────────────┘
     ▲                                                   ▲
     │                                                   │
     └───────────── WebSocket Connection ────────────────┘
```

## Componentes

### 1. Frontend (Next.js + React)

**Página Principal** (`app/page.tsx`)
- Tela de login onde o usuário digita o nome
- Após login, carrega o componente Game

**Componente Game** (`components/Game.tsx`)
- Inicializa o Phaser
- Passa configurações para a MainScene
- Gerencia o ciclo de vida do jogo

**Componente Chat** (`components/Chat.tsx`)
- Interface de chat independente
- Conecta ao Socket.io
- Envia e recebe mensagens em tempo real

### 2. Game Engine (Phaser)

**MainScene** (`game/scenes/MainScene.ts`)
- Cria o escritório (chão, paredes, mesas)
- Gerencia o jogador local
- Gerencia outros jogadores conectados
- Implementa movimentação
- Sincroniza posições via Socket.io

**Elementos do Jogo:**
- **Player Local**: Controlado pelo usuário
- **Other Players**: Outros usuários online
- **Office Elements**: Mesas, salas, decoração
- **Camera**: Segue o jogador local

### 3. Servidor WebSocket (Node.js)

**server.js** (`server/server.js`)
- Gerencia conexões Socket.io
- Mantém lista de jogadores conectados
- Transmite movimentos entre clientes
- Gerencia mensagens de chat
- Notifica entradas/saídas de jogadores

## Eventos Socket.io

### Cliente → Servidor

| Evento | Dados | Descrição |
|--------|-------|-----------|
| `player-joined` | `{username, x, y, color}` | Jogador entra no escritório |
| `player-movement` | `{x, y}` | Jogador se move |
| `chat-message` | `{username, text, timestamp}` | Envia mensagem |

### Servidor → Cliente

| Evento | Dados | Descrição |
|--------|-------|-----------|
| `current-players` | `{id: PlayerData}` | Lista de jogadores existentes |
| `new-player` | `{id, playerData}` | Novo jogador entrou |
| `player-moved` | `{id, x, y}` | Jogador se moveu |
| `player-disconnected` | `id` | Jogador desconectou |
| `chat-message` | `{username, text, timestamp}` | Nova mensagem no chat |

## Estrutura de Dados

### PlayerData
```typescript
{
  id: string          // Socket ID único
  username: string    // Nome do jogador
  x: number          // Posição X
  y: number          // Posição Y
  color: number      // Cor do avatar (hex)
}
```

### Message
```typescript
{
  username: string    // Quem enviou
  text: string       // Conteúdo
  timestamp: number  // Quando enviou
}
```

## Ciclo de Vida

### 1. Jogador Entra
```
1. Usuário digita nome
2. Next.js carrega componente Game
3. Phaser inicializa MainScene
4. Socket.io conecta ao servidor
5. Servidor envia jogadores existentes
6. Cliente renderiza todos os avatares
7. Servidor notifica outros clientes
```

### 2. Movimentação
```
1. Usuário pressiona WASD/setas
2. Phaser atualiza posição local (60fps)
3. Cliente envia nova posição ao servidor
4. Servidor transmite para outros clientes
5. Outros clientes atualizam o avatar
```

### 3. Chat
```
1. Usuário digita mensagem
2. Cliente envia via Socket.io
3. Servidor transmite para TODOS clientes
4. Clientes adicionam na lista de mensagens
```

### 4. Jogador Sai
```
1. Usuário fecha aba/navegador
2. Socket.io detecta desconexão
3. Servidor remove da lista
4. Servidor notifica outros clientes
5. Clientes removem o avatar
```

## Otimizações Implementadas

### Client-Side
- **Interpolação**: Movimentos suaves usando tweens
- **Client-Side Prediction**: Movimento local instantâneo
- **Dynamic Import**: Phaser carregado apenas no cliente
- **Debouncing**: Eventos de movimento otimizados

### Server-Side
- **Broadcast**: Mensagens enviadas apenas para outros clientes
- **State Management**: Estado mínimo no servidor
- **Room System**: Pronto para múltiplas salas (futuro)

## Performance

- **Update Rate**: ~60fps no cliente
- **Network Rate**: Movimentos enviados quando necessário
- **Latência**: ~50-100ms em rede local
- **Jogadores Simultâneos**: Testado até 10, suporta mais

## Segurança

### Implementado
- CORS configurado
- Validação de mensagens de chat (max length)
- Sanitização de username

### Recomendado Adicionar
- Rate limiting
- Autenticação
- Validação de posição no servidor
- Anti-cheat
- Moderação de chat

## Próximos Passos

1. **Banco de Dados**: Persistir jogadores e dados
2. **Salas**: Múltiplos escritórios
3. **Colisão**: Jogadores não atravessam paredes
4. **Interações**: Clicar em objetos
5. **Animações**: Sprites animados
6. **Som**: Efeitos sonoros e música

## Tecnologias e Versões

- Next.js: 14.1.0
- React: 18.2.0
- Phaser: 3.70.0
- Socket.io: 4.6.1
- TypeScript: 5.x
- Node.js: 18+

---

Para dúvidas sobre a arquitetura, consulte o código ou abra uma issue!
