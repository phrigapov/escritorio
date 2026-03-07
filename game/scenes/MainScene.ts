import * as Phaser from 'phaser'
import { io, Socket } from 'socket.io-client'

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
  private doors!: Phaser.GameObjects.Group
  private lastDirection: string = 'down'

  constructor() {
    super('MainScene')
  }

  preload() {
    // Carregar sprites de personagens como spritesheets (4 frames cada)
    this.load.spritesheet('character_down', '/sprites/Julia_walk_Foward.png', {
      frameWidth: 48,
      frameHeight: 48
    })
    this.load.spritesheet('character_up', '/sprites/Julia_walk_Up.png', {
      frameWidth: 48,
      frameHeight: 48
    })
    this.load.spritesheet('character_left', '/sprites/Julia_walk_Left.png', {
      frameWidth: 48,
      frameHeight: 48
    })
    this.load.spritesheet('character_right', '/sprites/Julia_walk_Rigth.png', {
      frameWidth: 48,
      frameHeight: 48
    })
    this.load.image('character_idle', '/sprites/Julia-Idle.png')
    
    // Carregar sprites de mobília
    this.load.image('desk', '/sprites/desk.png')
    this.load.image('desk-with-pc', '/sprites/desk-with-pc.png')
    this.load.image('chair', '/sprites/Chair.png')
    this.load.image('plant', '/sprites/plant.png')
    this.load.image('coffee', '/sprites/coffee-maker.png')
    this.load.image('water', '/sprites/water-cooler.png')
    this.load.image('cabinet', '/sprites/cabinet.png')
    this.load.image('printer', '/sprites/printer.png')
    this.load.image('pc1', '/sprites/PC1.png')
    this.load.image('pc2', '/sprites/PC2.png')
    this.load.image('sofa', '/sprites/stamping-table.png')
    this.load.image('bookshelf', '/sprites/writing-table.png')
    this.load.image('partition1', '/sprites/office-partitions-1.png')
    this.load.image('partition2', '/sprites/office-partitions-2.png')
    this.load.image('sink', '/sprites/sink.png')
    this.load.image('trash', '/sprites/Trash.png')
  }

  private createMissingAssets() {
    const g = this.make.graphics({ x: 0, y: 0 })
    
    // Monitor
    g.clear()
    g.fillStyle(0x2c3e50, 1)
    g.fillRect(4, 2, 24, 20)
    g.fillStyle(0x3498db, 0.6)
    g.fillRect(6, 4, 20, 16)
    g.fillStyle(0x2c2c2c, 1)
    g.fillRect(10, 22, 12, 2)
    g.generateTexture('monitor', 32, 28)
    
    // Keyboard
    g.clear()
    g.fillStyle(0x2c2c2c, 1)
    g.fillRect(0, 0, 24, 10)
    g.generateTexture('keyboard', 24, 10)
    
    // Mouse
    g.clear()
    g.fillStyle(0x3c3c3c, 1)
    g.fillEllipse(6, 8, 10, 14)
    g.generateTexture('mouse', 12, 16)
    
    // Meeting Table
    g.clear()
    g.fillStyle(0x654321, 1)
    g.fillEllipse(64, 48, 120, 80)
    g.generateTexture('meetingTable', 128, 96)
    
    g.destroy()
  }

  create() {
    // Criar assets procedurais faltantes primeiro
    this.createMissingAssets()
    
    this.username = this.registry.get('username') || 'Jogador'
    this.playerColor = Math.random() * 0xffffff

    // Criar grupos de física
    this.walls = this.physics.add.staticGroup()
    this.doors = this.add.group()

    // Criar animações de personagem
    this.createAnimations()

    // Criar o escritório
    this.createOffice()

    // Conectar ao servidor
    this.socket = io('http://localhost:3001')

    // Criar o jogador local
    this.createPlayer()

    // Configurar controles
    this.setupControls()

    // Configurar eventos de rede
    this.setupNetworkEvents()

    // Informar ao servidor que o jogador entrou
    this.socket.emit('player-joined', {
      username: this.username,
      x: this.player.x,
      y: this.player.y,
      color: this.playerColor
    })

    // Adicionar HUD
    this.createHUD()
  }

  private createAnimations() {
    // Criar animações para todas as direções
    const directions = ['down', 'up', 'left', 'right']
    
    directions.forEach(direction => {
      this.anims.create({
        key: `walk_${direction}`,
        frames: this.anims.generateFrameNumbers(`character_${direction}`, { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
      })
    })
  }

  private createOffice() {
    const width = 2000
    const height = 1500

    // Floor
    for (let x = 0; x < width; x += 100) {
      for (let y = 0; y < height; y += 100) {
        const shade = ((x + y) % 200 === 0) ? 0xe8e8e8 : 0xf5f5f5
        this.add.rectangle(x + 50, y + 50, 100, 100, shade).setDepth(0)
      }
    }

    // Walls
    this.createWall(width / 2, 10, width, 20)
    this.createWall(width / 2, height - 10, width, 20)
    this.createWall(10, height / 2, 20, height)
    this.createWall(width - 10, height / 2, 20, height)

    // Create rooms
    this.createWorkArea()
    this.createMeetingRoom()
    this.createCoffeeRoom()
    this.createPrivateOffice()
    this.decorateCorridor()

    // World bounds
    this.physics.world.setBounds(0, 0, width, height)
    this.cameras.main.setBounds(0, 0, width, height)
  }

  private createWall(x: number, y: number, width: number, height: number, color: number = 0x3e2723) {
    const wall = this.add.rectangle(x, y, width, height, color)
    this.walls.add(wall)
    const body = wall.body as Phaser.Physics.Arcade.StaticBody
    if (body) body.updateFromGameObject()
  }

  private createWorkArea() {
    const positions = [
      [250, 300], [450, 300], [650, 300],
      [250, 500], [450, 500], [650, 500],
      [250, 700], [450, 700], [650, 700],
      [250, 900], [450, 900], [650, 900]
    ]

    positions.forEach(([x, y]) => {
      this.add.image(x, y, 'desk').setDepth(2)
      this.add.image(x, y - 10, 'monitor').setDepth(3)
      this.add.image(x, y + 10, 'keyboard').setDepth(3)
      this.add.image(x + 18, y + 12, 'mouse').setDepth(3)
      this.add.image(x, y + 50, 'chair').setDepth(1)
    })

    // Plants
    this.add.image(150, 250, 'plant').setDepth(5)
    this.add.image(750, 250, 'plant').setDepth(5)
  }

  private createMeetingRoom() {
    const roomX = 1600
    const roomY = 300
    const roomWidth = 350
    const roomHeight = 400

    this.add.rectangle(roomX, roomY, roomWidth, roomHeight, 0xdcdcdc).setDepth(1)
    this.createWall(roomX, roomY - roomHeight/2 + 10, roomWidth, 20)
    this.createWall(roomX, roomY + roomHeight/2 - 10, roomWidth, 20)
    this.createWall(roomX + roomWidth/2 - 10, roomY, 20, roomHeight)
    this.createWall(roomX - roomWidth/2 + 10, roomY - 120, 20, 140)
    this.createWall(roomX - roomWidth/2 + 10, roomY + 120, 20, 140)
    
    this.createDoor(roomX - roomWidth/2 + 10, roomY, '📊 Reunião')

    this.add.image(roomX, roomY, 'meetingTable').setDepth(2)
    
    const chairPositions = [
      [roomX - 70, roomY - 60], [roomX, roomY - 80], [roomX + 70, roomY - 60],
      [roomX - 70, roomY + 60], [roomX, roomY + 80], [roomX + 70, roomY + 60]
    ]
    chairPositions.forEach(([x, y]) => {
      this.add.image(x, y, 'chair').setDepth(3)
    })
  }

  private createCoffeeRoom() {
    const roomX = 1650
    const roomY = 900
    const roomWidth = 300
    const roomHeight = 400

    this.add.rectangle(roomX, roomY, roomWidth, roomHeight, 0xe8d4b0).setDepth(1)
    this.createWall(roomX, roomY - roomHeight/2 + 10, roomWidth, 20)
    this.createWall(roomX, roomY + roomHeight/2 - 10, roomWidth, 20)
    this.createWall(roomX + roomWidth/2 - 10, roomY, 20, roomHeight)
    this.createWall(roomX - roomWidth/2 + 10, roomY - 120, 20, 140)
    this.createWall(roomX - roomWidth/2 + 10, roomY + 120, 20, 140)
    
    this.createDoor(roomX - roomWidth/2 + 10, roomY, '☕ Café')

    this.add.image(roomX - 100, roomY - 130, 'coffee').setDepth(2)
    this.add.image(roomX, roomY + 100, 'sofa').setDepth(2)
    this.add.image(roomX - 120, roomY + 150, 'plant').setDepth(2)
  }

  private createPrivateOffice() {
    const roomX = 250
    const roomY = 150
    const roomWidth = 300
    const roomHeight = 250

    this.add.rectangle(roomX, roomY, roomWidth, roomHeight, 0xfaf0e6).setDepth(1)
    this.createWall(roomX, roomY - roomHeight/2 + 10, roomWidth, 20)
    this.createWall(roomX - roomWidth/2 + 10, roomY, 20, roomHeight)
    this.createWall(roomX + roomWidth/2 - 10, roomY, 20, roomHeight)
    this.createWall(roomX - 80, roomY + roomHeight/2 - 10, 140, 20)
    this.createWall(roomX + 80, roomY + roomHeight/2 - 10, 140, 20)
    
    this.createDoor(roomX, roomY + roomHeight/2 - 10, '🚪 Escritório')

    this.add.image(roomX, roomY + 40, 'desk').setDepth(2).setScale(1.5)
    this.add.image(roomX - 100, roomY - 60, 'bookshelf').setDepth(2)
  }

  private decorateCorridor() {
    for (let y = 300; y < 1200; y += 200) {
      this.add.image(1000, y, 'plant').setDepth(5)
    }
    this.add.image(1000, 600, 'water').setDepth(2)
  }

  private createDoor(x: number, y: number, label: string) {
    const door = this.add.rectangle(x, y, 80, 20, 0x8B4513).setDepth(4)
    const text = this.add.text(x, y - 30, label, {
      fontSize: '12px',
      color: '#fff',
      backgroundColor: '#000',
      padding: { x: 6, y: 3 }
    }).setOrigin(0.5).setDepth(10)
    this.doors.add(door)
  }

  private createHUD() {
    this.add.text(16, 16, '🎮 WASD/Setas para mover', {
      fontSize: '14px',
      color: '#fff',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 12, y: 8 }
    }).setScrollFactor(0).setDepth(1000)
  }

  private createPlayer() {
    const startX = 500
    const startY = 600

    this.player = this.physics.add.sprite(startX, startY, 'character_down')
    this.player.setFrame(0) // Mostrar apenas o primeiro frame
    
    this.player.setCollideWorldBounds(true)
    this.player.setDepth(10)
    this.player.setSize(20, 16)
    this.player.setOffset(6, 16)
    this.physics.add.collider(this.player, this.walls)

    this.playerNameText = this.add.text(this.player.x, this.player.y - 25, this.username, {
      fontSize: '12px',
      color: '#fff',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 6, y: 3 }
    }).setOrigin(0.5).setDepth(11)

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)
  }

  private setupControls() {
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    }
  }

  private setupNetworkEvents() {
    this.socket.on('current-players', (players: Record<string, PlayerData>) => {
      Object.keys(players).forEach(id => {
        if (id !== this.socket.id) {
          this.addOtherPlayer(id, players[id])
        }
      })
    })

    this.socket.on('new-player', (data: { id: string, playerData: PlayerData }) => {
      if (data.id !== this.socket.id) {
        this.addOtherPlayer(data.id, data.playerData)
      }
    })

    this.socket.on('player-moved', (data: { id: string, x: number, y: number, direction?: string }) => {
      const otherPlayer = this.otherPlayers.get(data.id)
      if (otherPlayer) {
        this.tweens.add({
          targets: otherPlayer.sprite,
          x: data.x,
          y: data.y,
          duration: 50,
          ease: 'Linear'
        })
        
        // Atualizar animação do outro jogador baseado na direção
        if (data.direction) {
          otherPlayer.sprite.anims.play(`walk_${data.direction}`, true)
        }
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
    sprite.setFrame(0) // Mostrar apenas o primeiro frame
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
      // Quando parado, usar o primeiro frame da direção atual
      this.player.anims.stop()
      this.player.setTexture(`character_${this.lastDirection}`, 0)
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
