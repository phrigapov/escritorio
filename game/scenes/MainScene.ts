import * as Phaser from 'phaser'
import { io, Socket } from 'socket.io-client'
import { MapLoader } from '../MapLoader'
import type { MapDefinition } from '../types/MapDefinition'

interface Player {
  sprite: Phaser.Physics.Arcade.Sprite
  nameText: Phaser.GameObjects.Text
}

interface PlayerData {
  id: string
  x: number
  y: number
  username: string
  color: number
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

  constructor() {
    super('MainScene')
  }

  preload() {
    this.load.spritesheet('character_down',  '/sprites/Julia_walk_Foward.png', { frameWidth: 64, frameHeight: 64 })
    this.load.spritesheet('character_up',    '/sprites/Julia_walk_Up.png',     { frameWidth: 64, frameHeight: 64 })
    this.load.spritesheet('character_left',  '/sprites/Julia_walk_Left.png',   { frameWidth: 64, frameHeight: 64 })
    this.load.spritesheet('character_right', '/sprites/Julia_walk_Rigth.png',  { frameWidth: 64, frameHeight: 64 })

    this.load.image('desk',       '/sprites/desk.png')
    this.load.image('desk-with-pc', '/sprites/desk-with-pc.png')
    this.load.image('chair',      '/sprites/Chair.png')
    this.load.image('plant',      '/sprites/plant.png')
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

  /** Gera texturas procedurais usadas como objetos de mobília */
  private createProceduralAssets() {
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

    this.socket = io('http://localhost:3001')

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
  }

  private createAnimations() {
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

  private createHUD() {
    this.add.text(16, 16, '🎮 WASD/Setas para mover', {
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
        otherPlayer.sprite.destroy()
        otherPlayer.nameText.destroy()
        this.otherPlayers.delete(id)
      }
    })
  }

  private addOtherPlayer(id: string, playerData: PlayerData) {
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

    this.otherPlayers.set(id, { sprite, nameText })
  }

  update() {
    if (!this.player) return

    const speed = 200
    let velocityX = 0
    let velocityY = 0
    let isMoving = false

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

    this.otherPlayers.forEach(player => {
      player.nameText.setPosition(player.sprite.x, player.sprite.y - 25)
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
