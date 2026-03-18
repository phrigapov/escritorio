const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"],
    methods: ["GET", "POST"]
  }
})

// Armazenar jogadores conectados
const players = {}

// Salas de chat disponiveis
const CHAT_ROOMS = ['geral', 'SME-GERAL', 'devs', 'suporte']

// Historico de chat por sala — ultimas 200 mensagens em memória cada
const chatHistories = {}
CHAT_ROOMS.forEach(room => { chatHistories[room] = [] })
const MAX_CHAT_HISTORY = 200

// Broadcast da lista de jogadores online para todos
function broadcastPlayersList() {
  const list = Object.values(players).map(p => ({
    id: p.id,
    username: p.username,
    status: p.status || 'online',
    headless: p.headless || false,
  }))
  io.emit('players-list', list)
}

io.on('connection', (socket) => {
  console.log(`Novo jogador conectado: ${socket.id}`)

  // Pedido explicito de historico de chat (para clientes que conectam tarde)
  socket.on('request-chat-history', (data) => {
    const room = (data && data.room) || 'geral'
    socket.emit('chat-history', { room, messages: chatHistories[room] || [] })
  })

  // Quando um jogador entra
  socket.on('player-joined', (data) => {
    // Remove sessão antiga DESCONECTADA com mesmo username (refresh/reconexão)
    // Sessões ainda conectadas são mantidas (ex: múltiplas abas)
    Object.keys(players).forEach(id => {
      if (id !== socket.id && players[id].username === data.username) {
        const existingSocket = io.sockets.sockets.get(id)
        if (!existingSocket || !existingSocket.connected) {
          socket.broadcast.emit('player-disconnected', id)
          delete players[id]
        }
      }
    })

    players[socket.id] = {
      id:       socket.id,
      username: data.username,
      x:        data.x,
      y:        data.y,
      color:    data.color,
      headless: data.headless || false,
    }

    // Enviar jogadores existentes para o novo jogador (excluindo ele mesmo)
    const otherPlayers = {}
    Object.keys(players).forEach(id => {
      if (id !== socket.id) {
        otherPlayers[id] = players[id]
      }
    })
    socket.emit('current-players', otherPlayers)

    // Notificar todos os outros jogadores sobre o novo jogador
    socket.broadcast.emit('new-player', {
      id: socket.id,
      playerData: players[socket.id]
    })

    // Enviar historico de todas as salas para o novo jogador
    CHAT_ROOMS.forEach(room => {
      if (chatHistories[room].length > 0) {
        socket.emit('chat-history', { room, messages: chatHistories[room] })
      }
    })

    // Enviar lista de salas disponiveis
    socket.emit('chat-rooms', CHAT_ROOMS)

    console.log(`${data.username} entrou no escritório`)
    broadcastPlayersList()
  })

  // Quando um jogador se move
  socket.on('player-movement', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x
      players[socket.id].y = data.y
      if (data.direction) {
        players[socket.id].direction = data.direction
      }

      // Transmitir movimento para outros jogadores
      socket.broadcast.emit('player-moved', {
        id: socket.id,
        x: data.x,
        y: data.y,
        direction: data.direction
      })
    }
  })

  // Mensagem de chat (com sala)
  socket.on('chat-message', (message) => {
    const room = message.room || 'geral'
    const payload = {
      id: socket.id,
      username: players[socket.id]?.username || message.username || 'Jogador',
      text: String(message.text || '').slice(0, 200),
      timestamp: message.timestamp || Date.now(),
      room,
    }

    if (!payload.text.trim()) return

    // Salvar no historico da sala
    if (!chatHistories[room]) chatHistories[room] = []
    chatHistories[room].push(payload)
    if (chatHistories[room].length > MAX_CHAT_HISTORY) {
      chatHistories[room].shift()
    }

    console.log(`Chat [${room}] - ${payload.username}: ${payload.text}`)
    // Transmitir mensagem para todos (cliente filtra por sala)
    io.emit('chat-message', payload)
  })

  // Status do jogador
  socket.on('player-status-changed', (data) => {
    if (players[socket.id]) {
      players[socket.id].status = data.status
    }
    socket.broadcast.emit('player-status-changed', {
      id: socket.id,
      status: data.status
    })
    broadcastPlayersList()
  })

  // Quando um jogador desconecta
  socket.on('disconnect', () => {
    const player = players[socket.id]
    if (player) {
      console.log(`${player.username} saiu do escritório`)
    }

    delete players[socket.id]

    // Notificar outros jogadores
    socket.broadcast.emit('player-disconnected', socket.id)
    broadcastPlayersList()
  })
})

const PORT = process.env.PORT || 3000

server.listen(PORT, () => {
  console.log(`🚀 Servidor WebSocket rodando na porta ${PORT}`)
  console.log(`📡 Salas de chat: ${CHAT_ROOMS.join(', ')}`)
  console.log(`📡 Aguardando conexões...`)
})
