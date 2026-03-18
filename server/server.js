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

io.on('connection', (socket) => {
  console.log(`Novo jogador conectado: ${socket.id}`)

  // Quando um jogador entra
  socket.on('player-joined', (data) => {
    // Remove sessão antiga com mesmo username (refresh/reconexão rápida)
    Object.keys(players).forEach(id => {
      if (id !== socket.id && players[id].username === data.username) {
        socket.broadcast.emit('player-disconnected', id)
        delete players[id]
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

    console.log(`${data.username} entrou no escritório`)
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

  // Mensagem de chat
  socket.on('chat-message', (message) => {
    const payload = {
      id: socket.id,
      username: players[socket.id]?.username || message.username || 'Jogador',
      text: String(message.text || '').slice(0, 200),
      timestamp: message.timestamp || Date.now()
    }

    if (!payload.text.trim()) return

    console.log(`Chat - ${payload.username}: ${payload.text}`)
    // Transmitir mensagem para todos, incluindo o remetente
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
  })
})

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`🚀 Servidor WebSocket rodando na porta ${PORT}`)
  console.log(`📡 Aguardando conexões...`)
})
