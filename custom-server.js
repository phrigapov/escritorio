const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, port })
const handle = app.getRequestHandler()

// ── Estado dos jogadores ─────────────────────────────────────────────────────
const players = {}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })

  // ── Socket.io ──────────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`✅  Novo jogador conectado: ${socket.id}`)

    // Jogador entrou
    socket.on('player-joined', (data) => {
      players[socket.id] = {
        id: socket.id,
        username: data.username,
        x: data.x,
        y: data.y,
        color: data.color,
        status: 'online',
      }

      // Enviar jogadores existentes
      const others = {}
      Object.keys(players).forEach((id) => {
        if (id !== socket.id) others[id] = players[id]
      })
      socket.emit('current-players', others)

      // Notificar os demais
      socket.broadcast.emit('new-player', {
        id: socket.id,
        playerData: players[socket.id],
      })

      console.log(`➡️  ${data.username} entrou no escritório`)
    })

    // Movimento
    socket.on('player-movement', (data) => {
      if (!players[socket.id]) return
      players[socket.id].x = data.x
      players[socket.id].y = data.y
      if (data.direction) players[socket.id].direction = data.direction

      socket.broadcast.emit('player-moved', {
        id: socket.id,
        x: data.x,
        y: data.y,
        direction: data.direction,
      })
    })

    // Chat
    socket.on('chat-message', (message) => {
      const payload = {
        id: socket.id,
        username: players[socket.id]?.username || message.username || 'Jogador',
        text: String(message.text || '').slice(0, 200),
        timestamp: message.timestamp || Date.now(),
      }
      if (!payload.text.trim()) return
      console.log(`💬  ${payload.username}: ${payload.text}`)
      io.emit('chat-message', payload)
    })

    // Status
    socket.on('player-status-changed', (data) => {
      if (players[socket.id]) players[socket.id].status = data.status
      socket.broadcast.emit('player-status-changed', { id: socket.id, status: data.status })
    })

    // Ping de latência
    socket.on('ping-check', (callback) => {
      if (typeof callback === 'function') callback()
    })

    // Desconexão
    socket.on('disconnect', () => {
      const player = players[socket.id]
      if (player) console.log(`⬅️  ${player.username} saiu do escritório`)
      delete players[socket.id]
      socket.broadcast.emit('player-disconnected', socket.id)
    })
  })

  httpServer.listen(port, () => {
    console.log(`🚀  Servidor rodando em http://localhost:${port}  (modo: ${dev ? 'dev' : 'prod'})`)
  })
})
