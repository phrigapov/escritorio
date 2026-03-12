import * as Phaser from 'phaser'
import { io, Socket } from 'socket.io-client'
import { MapLoader } from '../MapLoader'
import type { MapDefinition } from '../types/MapDefinition'

type PlayerStatus = 'online' | 'busy' | 'away'

const STATUS_COLORS: Record<PlayerStatus, number> = {
  online: 0x2ecc71,
  busy:   0xe74c3c,
  away:   0xf39c12,
}

const STATUS_LABELS: Record<PlayerStatus, string> = {
  online: 'Online',
  busy:   'Ocupado',
  away:   'Ausente',
}

interface Player {
  sprite: Phaser.Physics.Arcade.Sprite
  nameText: Phaser.GameObjects.Text
  statusDot: Phaser.GameObjects.Graphics
  status: PlayerStatus
  chatBubble?: Phaser.GameObjects.Text
  chatBubbleHideEvent?: Phaser.Time.TimerEvent
}

interface PlayerData {
  id: string
  x: number
  y: number
  username: string
  color: number
}

interface ChatMessage {
  id: string
  username: string
  text: string
  timestamp: number
}

export default class MainScene extends Phaser.Scene {
  private socket!: Socket
  private player!: Phaser.Physics.Arcade.Sprite
  private playerNameText!: Phaser.GameObjects.Text
  private otherPlayers: Map<string, Player> = new Map()
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: {
    W: Phaser.Input.Keyboard.Key
    A: Phaser.Input.Keyboard.Key
    S: Phaser.Input.Keyboard.Key
    D: Phaser.Input.Keyboard.Key
  }
  private username!: string
  private playerColor!: number
  private walls!: Phaser.Physics.Arcade.StaticGroup
  private lastDirection: string = 'down'
  private spawnX: number = 500
  private spawnY: number = 700
  private chatInputElement?: HTMLInputElement
  private isTyping = false
  private playerChatBubble?: Phaser.GameObjects.Text
  private playerChatBubbleHideEvent?: Phaser.Time.TimerEvent
  private playerStatus: PlayerStatus = 'online'
  private playerStatusDot!: Phaser.GameObjects.Graphics
  private menuObjects: Phaser.GameObjects.GameObject[] = []
  private isMenuOpen = false
  private isPanelOpen = false

  constructor() {
    super('MainScene')
  }

  preload() {
    // Loading screen visual
    const progressBar = this.add.graphics()
    const progressBox = this.add.graphics()
    progressBox.fillStyle(0x222222, 0.8)
    progressBox.fillRect(this.cameras.main.width / 2 - 160, this.cameras.main.height / 2 - 25, 320, 50)
    
    const loadingText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 - 50, 'Carregando...', {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5)

    this.load.on('progress', (value: number) => {
      progressBar.clear()
      progressBar.fillStyle(0x4ade80, 1)
      progressBar.fillRect(this.cameras.main.width / 2 - 150, this.cameras.main.height / 2 - 15, 300 * value, 30)
    })

    this.load.on('complete', () => {
      progressBar.destroy()
      progressBox.destroy()
      loadingText.destroy()
    })

    // Sprites essenciais do personagem (carregamento prioritário)
    this.load.spritesheet('character_down',  '/sprites/Julia_walk_Foward.png', { frameWidth: 64, frameHeight: 64 })
    this.load.spritesheet('character_up',    '/sprites/Julia_walk_Up.png',     { frameWidth: 64, frameHeight: 64 })
    this.load.spritesheet('character_left',  '/sprites/Julia_walk_Left.png',   { frameWidth: 64, frameHeight: 64 })
    this.load.spritesheet('character_right', '/sprites/Julia_walk_Rigth.png',  { frameWidth: 64, frameHeight: 64 })

    // Sprites de mobília mais comuns (carregamento prioritário)
    this.load.image('desk',       '/sprites/desk.png')
    this.load.image('desk-with-pc', '/sprites/desk-with-pc.png')
    this.load.image('chair',      '/sprites/Chair.png')
    this.load.image('plant',      '/sprites/plant.png')
    
    // Sprites menos usados (lazy load)
    this.load.image('coffee',     '/sprites/coffee-maker.png')
    this.load.image('water',      '/sprites/water-cooler.png')
    this.load.image('cabinet',    '/sprites/cabinet.png')
    this.load.image('printer',    '/sprites/printer.png')
    this.load.image('pc1',        '/sprites/PC1.png')
    this.load.image('pc2',        '/sprites/PC2.png')
    this.load.image('sofa',       '/sprites/stamping-table.png')
    this.load.image('bookshelf',  '/sprites/writing-table.png')
    this.load.image('partition1', '/sprites/office-partitions-1.png')
    this.load.image('partition2', '/sprites/office-partitions-2.png')
    this.load.image('sink',       '/sprites/sink.png')
    this.load.image('trash',      '/sprites/Trash.png')

    // Definição do mapa em JSON
    this.load.json('map', '/maps/office-map.json')
  }

  /** Gera texturas procedurais usadas como objetos de mobília (com cache) */
  private createProceduralAssets() {
    // Verifica se já foram criadas (evita recriar em restart)
    if (this.textures.exists('monitor')) return

    const g = this.make.graphics({ x: 0, y: 0 })

    g.fillStyle(0x2c3e50, 1).fillRect(4, 2, 24, 20)
    g.fillStyle(0x3498db, 0.6).fillRect(6, 4, 20, 16)
    g.fillStyle(0x2c2c2c, 1).fillRect(10, 22, 12, 2)
    g.generateTexture('monitor', 32, 28)

    g.clear().fillStyle(0x2c2c2c, 1).fillRect(0, 0, 24, 10)
    g.generateTexture('keyboard', 24, 10)

    g.clear().fillStyle(0x3c3c3c, 1).fillEllipse(6, 8, 10, 14)
    g.generateTexture('mouse', 12, 16)

    g.clear().fillStyle(0x654321, 1).fillEllipse(64, 48, 120, 80)
    g.generateTexture('meetingTable', 128, 96)

    g.destroy()
  }

  create() {
    this.createProceduralAssets()

    this.username = this.registry.get('username') || 'Jogador'
    this.playerColor = Math.random() * 0xffffff

    this.walls = this.physics.add.staticGroup()

    this.createAnimations()

    // Carrega e renderiza o mapa a partir do JSON
    const mapData = this.cache.json.get('map') as MapDefinition
    const loader = new MapLoader(this, this.walls)
    const { worldWidth, worldHeight, spawnX, spawnY } = loader.load(mapData)

    this.spawnX = spawnX
    this.spawnY = spawnY

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight)
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight)

    // Reutiliza socket existente (se cena foi reiniciada após editor) ou cria novo
    if (this.socket?.connected) {
      this.socket.off() // remove listeners antigos antes de registrar novos
    } else {
      // Conexão socket otimizada com timeout reduzido
      this.socket = io({ timeout: 3000, reconnection: true, reconnectionDelay: 500 })
    }

    this.createPlayer()
    this.setupControls()
    this.setupNetworkEvents()

    this.socket.emit('player-joined', {
      username: this.username,
      x: this.player.x,
      y: this.player.y,
      color: this.playerColor,
    })

    this.createHUD()
    this.startPingMeasurement()
  }

  private startPingMeasurement() {
    this.time.addEvent({
      delay: 2000,
      loop: true,
      callback: () => {
        if (!this.socket?.connected) return
        const start = Date.now()
        this.socket.emit('ping-check', () => {
          const latency = Date.now() - start
          window.dispatchEvent(
            new CustomEvent('perf-ping', { detail: { latency } })
          )
        })
      },
    })
  }

  private createAnimations() {
    // evita erro se animações já foram criadas (cena reiniciada)
    if (this.anims.exists('walk_down')) return
    const directions = ['down', 'up', 'left', 'right']
    directions.forEach(direction => {
      this.anims.create({
        key: `walk_${direction}`,
        frames: this.anims.generateFrameNumbers(`character_${direction}`, { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1,
      })
    })
  }

  // Limpa tudo ao reiniciar/parar a cena (editor, reload)
  shutdown() {
    // Remove input DOM do chat
    if (this.chatInputElement) {
      this.chatInputElement.remove()
      this.chatInputElement = undefined
    }
    // Destrói sprites de jogadores remotos
    this.otherPlayers.forEach(p => {
      p.chatBubble?.destroy()
      p.chatBubbleHideEvent?.remove(false)
      p.statusDot.destroy()
      p.sprite.destroy()
      p.nameText.destroy()
    })
    this.otherPlayers.clear()
    // Não desconecta o socket aqui — o servidor detecta reconexão pelo username
    // e remove entradas duplicadas automaticamente
  }

  private createHUD() {
    this.add.text(16, 16, '🎮 WASD/Setas para mover • ↵ Enter para chat', {
      fontSize: '14px',
      color: '#fff',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 12, y: 8 },
    }).setScrollFactor(0).setDepth(1000)
  }

  private createPlayer() {
    this.player = this.physics.add.sprite(this.spawnX, this.spawnY, 'character_down')
    this.player.setFrame(0)
    this.player.setCollideWorldBounds(true)
    this.player.setDepth(10)
    this.player.setSize(20, 16)
    this.player.setOffset(6, 16)
    this.physics.add.collider(this.player, this.walls)

    this.playerNameText = this.add.text(this.player.x, this.player.y - 25, this.username, {
      fontSize: '12px',
      color: '#fff',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(11)

    this.playerStatusDot = this.add.graphics().setDepth(12)
    this.drawStatusDot(this.playerStatusDot, this.playerStatus)

    this.player.setInteractive()
    this.player.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopImmediatePropagation()
      if (this.isMenuOpen) {
        this.closeCircularMenu()
      } else {
        this.openCircularMenu()
      }
    })

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)
  }

  private setupControls() {
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }

    this.createChatInput()

    this.input.keyboard!.on('keydown-ENTER', (event: KeyboardEvent) => {
      if (event.repeat) return

      if (!this.isTyping) {
        this.openChatInput()
        return
      }

      this.submitChatMessage()
    })

    this.input.keyboard!.on('keydown-ESC', () => {
      if (!this.isTyping) return
      this.closeChatInput()
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanupChatInput()
    })

    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.cleanupChatInput()
    })
  }

  private setupNetworkEvents() {
    this.socket.on('current-players', (players: Record<string, PlayerData>) => {
      Object.keys(players).forEach(id => {
        if (id !== this.socket.id) this.addOtherPlayer(id, players[id])
      })
    })

    this.socket.on('new-player', (data: { id: string, playerData: PlayerData }) => {
      if (data.id !== this.socket.id) this.addOtherPlayer(data.id, data.playerData)
    })

    this.socket.on('player-moved', (data: { id: string, x: number, y: number, direction?: string }) => {
      const otherPlayer = this.otherPlayers.get(data.id)
      if (otherPlayer) {
        this.tweens.add({ targets: otherPlayer.sprite, x: data.x, y: data.y, duration: 50, ease: 'Linear' })
        if (data.direction) otherPlayer.sprite.anims.play(`walk_${data.direction}`, true)
      }
    })

    this.socket.on('player-disconnected', (id: string) => {
      const otherPlayer = this.otherPlayers.get(id)
      if (otherPlayer) {
        otherPlayer.chatBubble?.destroy()
        otherPlayer.chatBubbleHideEvent?.remove(false)
        otherPlayer.statusDot.destroy()
        otherPlayer.sprite.destroy()
        otherPlayer.nameText.destroy()
        this.otherPlayers.delete(id)
      }
    })

    this.socket.on('player-status-changed', (data: { id: string, status: PlayerStatus }) => {
      const otherPlayer = this.otherPlayers.get(data.id)
      if (otherPlayer) {
        otherPlayer.status = data.status
        this.drawStatusDot(otherPlayer.statusDot, data.status)
      }
    })

    this.socket.on('chat-message', (message: ChatMessage) => {
      if (message.id === this.socket.id) {
        this.showOwnChatBubble(message.text)
        return
      }

      const otherPlayer = this.otherPlayers.get(message.id)
      if (otherPlayer) {
        this.showOtherPlayerChatBubble(otherPlayer, message.text)
      }
    })
  }

  private addOtherPlayer(id: string, playerData: PlayerData) {
    // Evita duplicata se o evento chegar mais de uma vez
    if (this.otherPlayers.has(id)) return
    const sprite = this.physics.add.sprite(playerData.x, playerData.y, 'character_down')
    sprite.setFrame(0)
    sprite.setDepth(10)
    sprite.setSize(20, 16)
    sprite.setOffset(6, 16)

    const nameText = this.add.text(playerData.x, playerData.y - 25, playerData.username, {
      fontSize: '12px',
      color: '#fff',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 6, y: 3 }
    }).setOrigin(0.5).setDepth(11)

    const statusDot = this.add.graphics().setDepth(12)
    this.drawStatusDot(statusDot, 'online')

    this.otherPlayers.set(id, { sprite, nameText, statusDot, status: 'online' })
  }

  private createChatInput() {
    if (typeof window === 'undefined') return
    if (this.chatInputElement) return

    const input = document.createElement('input')
    input.type = 'text'
    input.maxLength = 200
    input.placeholder = 'Digite e pressione Enter...'
    input.style.position = 'fixed'
    input.style.left = '50%'
    input.style.bottom = '28px'
    input.style.transform = 'translateX(-50%)'
    input.style.width = 'min(520px, calc(100vw - 32px))'
    input.style.padding = '12px 14px'
    input.style.border = '2px solid #667eea'
    input.style.borderRadius = '12px'
    input.style.background = 'rgba(255, 255, 255, 0.96)'
    input.style.fontSize = '16px'
    input.style.zIndex = '2000'
    input.style.display = 'none'
    input.style.outline = 'none'
    input.style.boxShadow = '0 8px 30px rgba(0,0,0,0.25)'

    document.body.appendChild(input)

    input.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        this.submitChatMessage()
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        this.closeChatInput()
      }
    })

    this.chatInputElement = input
  }

  private openChatInput() {
    if (!this.chatInputElement) return
    this.isTyping = true
    this.input.keyboard!.disableGlobalCapture()
    this.chatInputElement.style.display = 'block'
    this.chatInputElement.value = ''
    this.chatInputElement.focus()
  }

  private closeChatInput() {
    if (!this.chatInputElement) return
    this.isTyping = false
    this.input.keyboard!.enableGlobalCapture()
    this.chatInputElement.style.display = 'none'
    this.chatInputElement.blur()
  }

  private submitChatMessage() {
    if (!this.chatInputElement) return

    const text = this.chatInputElement.value.trim()
    if (!text) {
      this.closeChatInput()
      return
    }

    this.socket.emit('chat-message', {
      username: this.username,
      text,
      timestamp: Date.now(),
    })

    this.closeChatInput()
  }

  private cleanupChatInput() {
    if (!this.chatInputElement) return
    this.chatInputElement.remove()
    this.chatInputElement = undefined
    this.isTyping = false
  }

  private createBubbleText(x: number, y: number, text: string) {
    const safeText = text.length > 80 ? `${text.slice(0, 77)}...` : text
    return this.add.text(x, y, safeText, {
      fontSize: '12px',
      color: '#222',
      backgroundColor: 'rgba(255,255,255,0.95)',
      padding: { x: 8, y: 5 },
      wordWrap: { width: 220, useAdvancedWrap: true },
      align: 'center',
    })
      .setOrigin(0.5, 1)
      .setDepth(30)
  }

  private showOwnChatBubble(text: string) {
    this.playerChatBubble?.destroy()
    this.playerChatBubbleHideEvent?.remove(false)

    this.playerChatBubble = this.createBubbleText(this.player.x, this.player.y - 45, text)
    this.playerChatBubbleHideEvent = this.time.delayedCall(4000, () => {
      this.playerChatBubble?.destroy()
      this.playerChatBubble = undefined
      this.playerChatBubbleHideEvent = undefined
    })
  }

  private showOtherPlayerChatBubble(player: Player, text: string) {
    player.chatBubble?.destroy()
    player.chatBubbleHideEvent?.remove(false)

    player.chatBubble = this.createBubbleText(player.sprite.x, player.sprite.y - 45, text)
    player.chatBubbleHideEvent = this.time.delayedCall(4000, () => {
      player.chatBubble?.destroy()
      player.chatBubble = undefined
      player.chatBubbleHideEvent = undefined
    })
  }

  // ── Status dot ──────────────────────────────────────────────────────────────

  private drawStatusDot(g: Phaser.GameObjects.Graphics, status: PlayerStatus) {
    g.clear()
    g.fillStyle(STATUS_COLORS[status], 1)
    g.fillCircle(0, 0, 5)
    g.lineStyle(1.5, 0xffffff, 0.9)
    g.strokeCircle(0, 0, 5)
  }

  // ── Menu circular ───────────────────────────────────────────────────────────

  private openCircularMenu() {
    if (this.isMenuOpen) return
    this.isMenuOpen = true

    const px = this.player.x
    const py = this.player.y

    // Fundo semi-transparente
    const bg = this.add.graphics()
    bg.fillStyle(0x000000, 0.45)
    bg.fillCircle(px, py, 72)
    bg.setDepth(48)
    this.menuObjects.push(bg)

    const statuses: PlayerStatus[] = ['online', 'busy', 'away']
    const angles = [-90, 30, 150]

    statuses.forEach((status, i) => {
      const rad = Phaser.Math.DegToRad(angles[i])
      const bx = px + Math.cos(rad) * 55
      const by = py + Math.sin(rad) * 55

      const isActive = status === this.playerStatus

      const btn = this.add.graphics()
      btn.fillStyle(STATUS_COLORS[status], 1)
      btn.fillCircle(0, 0, 22)
      if (isActive) {
        btn.lineStyle(3, 0xffffff, 1)
        btn.strokeCircle(0, 0, 25)
      }
      btn.setPosition(bx, by)
      btn.setDepth(50)
      btn.setInteractive(
        new Phaser.Geom.Circle(0, 0, 22),
        Phaser.Geom.Circle.Contains
      )

      btn.on('pointerover', () => {
        btn.clear()
        btn.fillStyle(STATUS_COLORS[status], 0.85)
        btn.fillCircle(0, 0, 26)
        if (isActive) { btn.lineStyle(3, 0xffffff, 1); btn.strokeCircle(0, 0, 28) }
      })
      btn.on('pointerout', () => {
        btn.clear()
        btn.fillStyle(STATUS_COLORS[status], 1)
        btn.fillCircle(0, 0, 22)
        if (isActive) { btn.lineStyle(3, 0xffffff, 1); btn.strokeCircle(0, 0, 25) }
      })
      btn.on('pointerdown', () => {
        this.setPlayerStatus(status)
        this.closeCircularMenu()
      })
      this.menuObjects.push(btn)

      const lbl = this.add.text(bx, by + 31, STATUS_LABELS[status], {
        fontSize: '10px',
        color: '#fff',
        stroke: '#000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(52)
      this.menuObjects.push(lbl)
    })

    // Fechar ao clicar fora (delay para não fechar no mesmo clique de abertura)
    this.time.delayedCall(150, () => {
      this.input.once('pointerdown', () => this.closeCircularMenu())
    })
  }

  private closeCircularMenu() {
    if (!this.isMenuOpen) return
    this.menuObjects.forEach(o => (o as Phaser.GameObjects.GameObject).destroy())
    this.menuObjects = []
    this.isMenuOpen = false
  }

  private setPlayerStatus(status: PlayerStatus) {
    this.playerStatus = status
    this.drawStatusDot(this.playerStatusDot, status)
    this.socket.emit('player-status-changed', { status })
  }

  update() {
    if (!this.player) return

    const speed = 200
    let velocityX = 0
    let velocityY = 0
    let isMoving = false

    if (!this.isTyping && !this.isMenuOpen && !this.isPanelOpen) {
      if (this.cursors.left.isDown || this.wasd.A.isDown) {
        velocityX = -speed
        this.lastDirection = 'left'
        isMoving = true
      } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
        velocityX = speed
        this.lastDirection = 'right'
        isMoving = true
      }

      if (this.cursors.up.isDown || this.wasd.W.isDown) {
        velocityY = -speed
        this.lastDirection = 'up'
        isMoving = true
      } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
        velocityY = speed
        this.lastDirection = 'down'
        isMoving = true
      }
    }

    if (velocityX !== 0 && velocityY !== 0) {
      const factor = Math.sqrt(2) / 2
      velocityX *= factor
      velocityY *= factor
    }

    this.player.setVelocity(velocityX, velocityY)

    // Atualizar animação baseado na direção
    if (isMoving) {
      this.player.anims.play(`walk_${this.lastDirection}`, true)
    } else {
      // Quando parado, usar frame 0 da direção atual
      this.player.anims.stop()
      this.player.setTexture('character_down', 0)
    }

    this.playerNameText.setPosition(this.player.x, this.player.y - 25)
    this.playerStatusDot.setPosition(
      this.playerNameText.x - this.playerNameText.width / 2 - 9,
      this.playerNameText.y
    )
    if (this.playerChatBubble) {
      this.playerChatBubble.setPosition(this.player.x, this.player.y - 45)
    }

    this.otherPlayers.forEach(player => {
      player.nameText.setPosition(player.sprite.x, player.sprite.y - 25)
      player.statusDot.setPosition(
        player.nameText.x - player.nameText.width / 2 - 9,
        player.nameText.y
      )
      if (player.chatBubble) {
        player.chatBubble.setPosition(player.sprite.x, player.sprite.y - 45)
      }
    })

    if (isMoving) {
      this.socket.emit('player-movement', {
        x: this.player.x,
        y: this.player.y,
        direction: this.lastDirection
      })
    }
  }
}
