const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

try { require('dotenv').config({ path: '.env.local' }) } catch {}

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, port })
const handle = app.getRequestHandler()

// ── Estado ───────────────────────────────────────────────────────────────────
const players = {}              // socketId -> playerData
const usernameSockets = {}      // username -> socketId (garante unicidade)
let officeLocked = true         // padrão: escritório bloqueado até admin liberar
const ADMIN_USERNAME = 'phrigapov'

// Salas de chat
const CHAT_ROOMS = ['geral', 'SME-GERAL', 'devs', 'suporte']
const chatHistories = {}
CHAT_ROOMS.forEach(room => { chatHistories[room] = [] })

// DMs: chave = sorted "user1|user2", valor = array de mensagens
const dmHistories = {}
const MAX_HISTORY = 200

function getDmKey(a, b) {
  return [a, b].sort().join('|')
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })

  // Helper: enviar lista de jogadores online para todos
  function broadcastPlayerList() {
    const list = Object.values(players).map(p => ({
      id: p.id,
      username: p.username,
      status: p.status || 'online',
      headless: p.headless || false,
    }))
    io.emit('players-list', list)
  }

  io.on('connection', (socket) => {
    console.log(`✅  Novo socket: ${socket.id}`)

    // ── Status do escritório (sob demanda) ────────────────────────────────
    socket.on('request-office-status', () => {
      socket.emit('office-locked', officeLocked)
    })

    // ── Bloquear / liberar escritório (somente admin) ──────────────────────
    socket.on('admin-lock-office', (data) => {
      const player = players[socket.id]
      if (!player || !player.isAdmin) return

      officeLocked = !!data.locked
      io.emit('office-locked', officeLocked)
      console.log(`🔒  Escritório ${officeLocked ? 'BLOQUEADO' : 'LIBERADO'} por ${player.username}`)

      if (officeLocked) {
        // Expulsar todos os jogadores GitHub que não são admin
        Object.keys(players).forEach(id => {
          const p = players[id]
          if (p.loginType === 'github' && !p.isAdmin) {
            const s = io.sockets.sockets.get(id)
            if (s) {
              s.emit('force-disconnect', { reason: 'office-locked' })
              s.disconnect(true)
            }
          }
        })
      }
    })

    // ── Lista de jogadores (sob demanda) ──────────────────────────────────
    socket.on('request-players-list', () => {
      const list = Object.values(players).map(p => ({
        id: p.id,
        username: p.username,
        status: p.status || 'online',
        headless: p.headless || false,
      }))
      socket.emit('players-list', list)
    })

    // ── Histórico de chat ──────────────────────────────────────────────────
    socket.on('request-chat-history', (data) => {
      const room = (data && data.room) || 'geral'
      socket.emit('chat-history', { room, messages: chatHistories[room] || [] })
    })

    // ── Histórico de DM ────────────────────────────────────────────────────
    socket.on('request-dm-history', (data) => {
      if (!data || !data.with || !players[socket.id]) return
      const key = getDmKey(players[socket.id].username, data.with)
      socket.emit('dm-history', { with: data.with, messages: dmHistories[key] || [] })
    })

    // ── Jogador entrou ─────────────────────────────────────────────────────
    socket.on('player-joined', (data) => {
      const username = data.username

      // Desconectar sessão anterior do MESMO username (unicidade)
      if (usernameSockets[username] && usernameSockets[username] !== socket.id) {
        const oldId = usernameSockets[username]
        const oldSocket = io.sockets.sockets.get(oldId)
        if (oldSocket) {
          oldSocket.emit('force-disconnect', { reason: 'Nova sessão aberta' })
          oldSocket.disconnect(true)
        }
        delete players[oldId]
      }

      const loginType      = data.loginType      || 'github'
      const githubUsername = data.githubUsername || username

      // Admin nunca é bloqueado — verificado pelo handle GitHub, não pelo display name
      const isAdmin = githubUsername === ADMIN_USERNAME

      // Bloquear entrada de usuários GitHub quando escritório está fechado
      if (officeLocked && loginType === 'github' && !isAdmin) {
        socket.emit('force-disconnect', { reason: 'office-locked' })
        socket.disconnect(true)
        return
      }

      usernameSockets[username] = socket.id
      players[socket.id] = {
        id: socket.id,
        username,
        githubUsername,
        x: data.x,
        y: data.y,
        color: data.color,
        status: data.status || 'online',
        headless: data.headless || false,
        loginType,
        isAdmin,
      }

      // Enviar jogadores existentes (para posição no mapa)
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

      // Enviar histórico de todas as salas
      CHAT_ROOMS.forEach(room => {
        if (chatHistories[room].length > 0) {
          socket.emit('chat-history', { room, messages: chatHistories[room] })
        }
      })

      // Enviar lista de salas e jogadores
      socket.emit('chat-rooms', CHAT_ROOMS)
      broadcastPlayerList()

      console.log(`➡️  ${username} entrou no escritório`)
    })

    // ── Movimento ──────────────────────────────────────────────────────────
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

    // ── Chat (salas) ───────────────────────────────────────────────────────
    socket.on('chat-message', (message) => {
      const room = message.room || 'geral'
      const player = players[socket.id]
      const payload = {
        id: socket.id,
        username: player?.username || message.username || 'Jogador',
        text: String(message.text || '').slice(0, 500),
        timestamp: message.timestamp || Date.now(),
        room,
      }
      if (!payload.text.trim()) return

      if (!chatHistories[room]) chatHistories[room] = []
      chatHistories[room].push(payload)
      if (chatHistories[room].length > MAX_HISTORY) chatHistories[room].shift()

      console.log(`💬  [${room}] ${payload.username}: ${payload.text}`)
      io.emit('chat-message', payload)
    })

    // ── DM (mensagem direta) ───────────────────────────────────────────────
    socket.on('dm-message', (message) => {
      const sender = players[socket.id]
      if (!sender || !message.to) return

      const payload = {
        from: sender.username,
        to: message.to,
        text: String(message.text || '').slice(0, 500),
        timestamp: message.timestamp || Date.now(),
      }
      if (!payload.text.trim()) return

      // Salvar no histórico
      const key = getDmKey(sender.username, message.to)
      if (!dmHistories[key]) dmHistories[key] = []
      dmHistories[key].push(payload)
      if (dmHistories[key].length > MAX_HISTORY) dmHistories[key].shift()

      console.log(`📩  DM ${sender.username} → ${message.to}: ${payload.text}`)

      // Enviar para o destinatário
      const targetId = usernameSockets[message.to]
      if (targetId) {
        const targetSocket = io.sockets.sockets.get(targetId)
        if (targetSocket) targetSocket.emit('dm-message', payload)
      }

      // Confirmar para o remetente
      socket.emit('dm-message', payload)
    })

    // ── Porta ──────────────────────────────────────────────────────────────
    socket.on('door-action', (data) => {
      socket.broadcast.emit('door-action', data)
    })

    // ── Status ─────────────────────────────────────────────────────────────
    socket.on('player-status-changed', (data) => {
      if (players[socket.id]) {
        players[socket.id].status = data.status
      }
      socket.broadcast.emit('player-status-changed', { id: socket.id, status: data.status })
      broadcastPlayerList()
    })

    // ── Ping ───────────────────────────────────────────────────────────────
    socket.on('ping-check', (callback) => {
      if (typeof callback === 'function') callback()
    })

    // ── Desconexão ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const player = players[socket.id]
      if (player) {
        console.log(`⬅️  ${player.username} saiu do escritório`)
        // Limpar mapa de unicidade
        if (usernameSockets[player.username] === socket.id) {
          delete usernameSockets[player.username]
        }
      }
      delete players[socket.id]
      socket.broadcast.emit('player-disconnected', socket.id)
      broadcastPlayerList()
    })
  })

  httpServer.listen(port, () => {
    console.log(`🚀  Servidor rodando em http://localhost:${port}  (modo: ${dev ? 'dev' : 'prod'})`)
    console.log(`📡  Salas de chat: ${CHAT_ROOMS.join(', ')}`)
  })
})
