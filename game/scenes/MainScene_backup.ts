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
    // Criar sprites pixel art proceduralmente
    // Não usar URLs externas para evitar problemas de CORS
  }

  create() {
    this.username = this.registry.get('username') || 'Jogador'
    this.playerColor = Math.random() * 0xffffff

    // Criar grupos de física
    this.walls = this.physics.add.staticGroup()
    this.doors = this.add.group()

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

  private createProfessionalPixelArtSprites() {
    // Criar sprites pixel art profissionais, pixel por pixel
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    // Helper para criar pixel art
    const drawPixel = (x: number, y: number, color: string) => {
      ctx.fillStyle = color
      ctx.fillRect(x, y, 1, 1)
    }
    
    // Character sprite - Top down view (32x32)
    // Criar 4 direções com 3 frames de animação cada
    const directions = [
      { name: 'down', frames: [
        // Frame 0 - parado
        [[10,8,'#ffdbac'],[11,8,'#ffdbac'],[12,8,'#ffdbac'],[13,8,'#ffdbac'], // Cabeça
         [9,9,'#ffdbac'],[10,9,'#ffdbac'],[11,9,'#ffdbac'],[12,9,'#ffdbac'],[13,9,'#ffdbac'],[14,9,'#ffdbac'],
         [10,10,'#000'],[12,10,'#000'], // Olhos
         [9,11,'#ff6b6b'],[10,11,'#ff6b6b'],[11,11,'#ff6b6b'],[12,11,'#ff6b6b'],[13,11,'#ff6b6b'],[14,11,'#ff6b6b'], // Corpo
         [9,12,'#ff6b6b'],[10,12,'#ff6b6b'],[11,12,'#ff6b6b'],[12,12,'#ff6b6b'],[13,12,'#ff6b6b'],[14,12,'#ff6b6b'],
         [9,13,'#ff6b6b'],[10,13,'#ff6b6b'],[11,13,'#ff6b6b'],[12,13,'#ff6b6b'],[13,13,'#ff6b6b'],[14,13,'#ff6b6b'],
         [9,14,'#ff6b6b'],[10,14,'#ff6b6b'],[11,14,'#ff6b6b'],[12,14,'#ff6b6b'],[13,14,'#ff6b6b'],[14,14,'#ff6b6b'],
         [10,15,'#2c3e50'],[11,15,'#2c3e50'],[12,15,'#2c3e50'],[13,15,'#2c3e50'], // Calça
         [10,16,'#2c3e50'],[11,16,'#2c3e50'],[12,16,'#2c3e50'],[13,16,'#2c3e50'],
         [10,17,'#2c3e50'],[13,17,'#2c3e50'], // Pernas
         [10,18,'#2c3e50'],[13,18,'#2c3e50'],
         [9,19,'#000'],[10,19,'#000'],[13,19,'#000'],[14,19,'#000']] // Pés
      ]},
      { name: 'up', frames: [
        // Frame 0 - parado olhando para cima
        [[10,8,'#3d2817'],[11,8,'#3d2817'],[12,8,'#3d2817'],[13,8,'#3d2817'], // Cabelo
         [9,9,'#3d2817'],[10,9,'#3d2817'],[11,9,'#ffdbac'],[12,9,'#ffdbac'],[13,9,'#3d2817'],[14,9,'#3d2817'],
         [9,10,'#ffdbac'],[10,10,'#ffdbac'],[11,10,'#ffdbac'],[12,10,'#ffdbac'],[13,10,'#ffdbac'],[14,10,'#ffdbac'],
         [9,11,'#ff6b6b'],[10,11,'#ff6b6b'],[11,11,'#ff6b6b'],[12,11,'#ff6b6b'],[13,11,'#ff6b6b'],[14,11,'#ff6b6b'],
         [9,12,'#ff6b6b'],[10,12,'#ff6b6b'],[11,12,'#ff6b6b'],[12,12,'#ff6b6b'],[13,12,'#ff6b6b'],[14,12,'#ff6b6b'],
         [9,13,'#ff6b6b'],[10,13,'#ff6b6b'],[11,13,'#ff6b6b'],[12,13,'#ff6b6b'],[13,13,'#ff6b6b'],[14,13,'#ff6b6b'],
         [9,14,'#ff6b6b'],[10,14,'#ff6b6b'],[11,14,'#ff6b6b'],[12,14,'#ff6b6b'],[13,14,'#ff6b6b'],[14,14,'#ff6b6b'],
         [10,15,'#2c3e50'],[11,15,'#2c3e50'],[12,15,'#2c3e50'],[13,15,'#2c3e50'],
         [10,16,'#2c3e50'],[11,16,'#2c3e50'],[12,16,'#2c3e50'],[13,16,'#2c3e50'],
         [10,17,'#2c3e50'],[13,17,'#2c3e50'],
         [10,18,'#2c3e50'],[13,18,'#2c3e50'],
         [9,19,'#000'],[10,19,'#000'],[13,19,'#000'],[14,19,'#000']]
      ]},
      { name: 'left', frames: [
        // Frame 0 - parado olhando para esquerda
        [[11,8,'#ffdbac'],[12,8,'#ffdbac'],[13,8,'#ffdbac'],
         [10,9,'#ffdbac'],[11,9,'#ffdbac'],[12,9,'#ffdbac'],[13,9,'#ffdbac'],[14,9,'#ffdbac'],
         [10,10,'#ffdbac'],[11,10,'#000'],[12,10,'#ffdbac'],[13,10,'#ffdbac'],[14,10,'#ffdbac'], // Olho
         [10,11,'#ff6b6b'],[11,11,'#ff6b6b'],[12,11,'#ff6b6b'],[13,11,'#ff6b6b'],[14,11,'#ff6b6b'],
         [10,12,'#ff6b6b'],[11,12,'#ff6b6b'],[12,12,'#ff6b6b'],[13,12,'#ff6b6b'],[14,12,'#ff6b6b'],
         [10,13,'#ff6b6b'],[11,13,'#ff6b6b'],[12,13,'#ff6b6b'],[13,13,'#ff6b6b'],[14,13,'#ff6b6b'],
         [10,14,'#ff6b6b'],[11,14,'#ff6b6b'],[12,14,'#ff6b6b'],[13,14,'#ff6b6b'],[14,14,'#ff6b6b'],
         [11,15,'#2c3e50'],[12,15,'#2c3e50'],[13,15,'#2c3e50'],
         [11,16,'#2c3e50'],[12,16,'#2c3e50'],[13,16,'#2c3e50'],
         [11,17,'#2c3e50'],[12,17,'#2c3e50'],
         [11,18,'#2c3e50'],[12,18,'#2c3e50'],
         [10,19,'#000'],[11,19,'#000'],[12,19,'#000']]
      ]},
      { name: 'right', frames: [
        // Frame 0 - parado olhando para direita  
        [[10,8,'#ffdbac'],[11,8,'#ffdbac'],[12,8,'#ffdbac'],
         [9,9,'#ffdbac'],[10,9,'#ffdbac'],[11,9,'#ffdbac'],[12,9,'#ffdbac'],[13,9,'#ffdbac'],
         [9,10,'#ffdbac'],[10,10,'#ffdbac'],[11,10,'#ffdbac'],[12,10,'#000'],[13,10,'#ffdbac'], // Olho
         [9,11,'#ff6b6b'],[10,11,'#ff6b6b'],[11,11,'#ff6b6b'],[12,11,'#ff6b6b'],[13,11,'#ff6b6b'],
         [9,12,'#ff6b6b'],[10,12,'#ff6b6b'],[11,12,'#ff6b6b'],[12,12,'#ff6b6b'],[13,12,'#ff6b6b'],
         [9,13,'#ff6b6b'],[10,13,'#ff6b6b'],[11,13,'#ff6b6b'],[12,13,'#ff6b6b'],[13,13,'#ff6b6b'],
         [9,14,'#ff6b6b'],[10,14,'#ff6b6b'],[11,14,'#ff6b6b'],[12,12,'#ff6b6b'],[13,14,'#ff6b6b'],
         [10,15,'#2c3e50'],[11,15,'#2c3e50'],[12,15,'#2c3e50'],
         [10,16,'#2c3e50'],[11,16,'#2c3e50'],[12,16,'#2c3e50'],
         [11,17,'#2c3e50'],[12,17,'#2c3e50'],
         [11,18,'#2c3e50'],[12,18,'#2c3e50'],
         [11,19,'#000'],[12,19,'#000'],[13,19,'#000']]
      ]}
    ]
    
    // Gerar spritesheets para cada direção
    directions.forEach(dir => {
      canvas.width = 32 * 3 // 3 frames
      canvas.height = 32
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Desenhar 3 frames (parado, passo esquerdo, passo direito)
      for (let frameIdx = 0; frameIdx < 3; frameIdx++) {
        const offsetX = frameIdx * 32 + 4
        dir.frames[0].forEach((pixel: any) => {
          const [x, y, color] = pixel
          drawPixel(offsetX + (x as number), (y as number) + 4, color as string)
        })
        
        // Animar pernas nos frames 1 e 2
        if (frameIdx === 1) {
          // Perna esquerda para frente
          drawPixel(offsetX + 10, 17, '#2c3e50')
          drawPixel(offsetX + 10, 18, '#2c3e50')
          drawPixel(offsetX + 9, 19, '#000')
        } else if (frameIdx === 2) {
          // Perna direita para frente
          drawPixel(offsetX + 13, 17, '#2c3e50')
          drawPixel(offsetX + 13, 18, '#2c3e50')
          drawPixel(offsetX + 14, 19, '#000')
        }
      }
      
      this.textures.addCanvas(`character_${dir.name}`, canvas)
    })
    
    // Desk sprite (64x48)
    canvas.width = 64
    canvas.height = 48
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Mesa marrom
    ctx.fillStyle = '#8B7355'
    ctx.fillRect(4, 8, 56, 32)
    ctx.fillStyle = '#6B5335'
    ctx.fillRect(4, 36, 56, 4) // Sombra
    // Pernas
    ctx.fillStyle = '#4a3a2a'
    ctx.fillRect(8, 40, 6, 6)
    ctx.fillRect(50, 40, 6, 6)
    // Detalhes
    ctx.fillStyle = '#5a4a3a'
    ctx.fillRect(6, 10, 52, 2)
    
    this.textures.addCanvas('desk', canvas)
    
    // Monitor sprite (32x28)
    canvas.width = 32
    canvas.height = 28
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = '#2c3e50'
    ctx.fillRect(6, 2, 20, 18)
    ctx.fillStyle = '#3498db'
    ctx.fillRect(8, 4, 16, 14)
    ctx.fillStyle = '#2c2c2c'
    ctx.fillRect(12, 20, 8, 2)
    ctx.fillRect(14, 22, 4, 4)
    
    this.textures.addCanvas('monitor', canvas)
    
    // Chair sprite (32x32)
    canvas.width = 32
    canvas.height = 32
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = '#34495e'
    ctx.fillRect(8, 4, 16, 12) // Encosto
    ctx.fillStyle = '#4a5f7f'
    ctx.fillRect(6, 16, 20, 10) // Assento
    ctx.fillStyle = '#2c3e50'
    ctx.fillRect(14, 26, 4, 4) // Pé
    
    this.textures.addCanvas('chair', canvas)
    
    // Plant sprite (32x32)
    canvas.width = 32
    canvas.height = 32
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Vaso
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(11, 22, 10, 8)
    ctx.fillStyle = '#654321'
    ctx.fillRect(11, 28, 10, 2)
    // Folhas - pixel art
    ctx.fillStyle = '#27ae60'
    ctx.fillRect(12, 12, 8, 8)
    ctx.fillRect(10, 14, 12, 4)
    ctx.fillRect(14, 10, 4, 8)
    ctx.fillStyle = '#229954'
    ctx.fillRect(14, 14, 4, 4)
    
    this.textures.addCanvas('plant', canvas)
    
    // Continuar com outros sprites...
    this.createMorePixelArtSprites(ctx, canvas, drawPixel)
  }
  
  private createMorePixelArtSprites(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, drawPixel: Function) {
    // Bookshelf (48x64)
    canvas.width = 48
    canvas.height = 64
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = '#654321'
    ctx.fillRect(0, 0, 48, 64)
    ctx.fillStyle = '#4a3428'
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(2, 4 + i * 15, 44, 12)
    }
    // Livros
    ctx.fillStyle = '#8b0000'
    ctx.fillRect(6, 6, 6, 10)
    ctx.fillStyle = '#00008b'
    ctx.fillRect(14, 6, 6, 10)
    ctx.fillStyle = '#006400'
    ctx.fillRect(22, 6, 6, 10)
    ctx.fillStyle = '#8b8b00'
    ctx.fillRect(30, 6, 6, 10)
    
    this.textures.addCanvas('bookshelf', canvas)
    
    // Sofa (96x44)
    canvas.width = 96
    canvas.height = 44
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = '#4169E1'
    ctx.fillRect(0, 10, 96, 14) // Encosto
    ctx.fillStyle = '#5179F1'
    ctx.fillRect(0, 24, 96, 16) // Assento
    ctx.fillStyle = '#3159D1'
    ctx.fillRect(0, 16, 8, 24) // Braço esquerdo
    ctx.fillRect(88, 16, 8, 24) // Braço direito
    
    this.textures.addCanvas('sofa', canvas)
    
    // Meeting Table (128x96)
    canvas.width = 128
    canvas.height = 96
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = '#654321'
    ctx.beginPath()
    ctx.ellipse(64, 48, 60, 40, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#4a3428'
    ctx.beginPath()
    ctx.ellipse(64, 52, 58, 38, 0, 0, Math.PI * 2)
    ctx.fill()
    
    this.textures.addCanvas('meetingTable', canvas)
    
    // Water cooler (32x44)
    canvas.width = 32
    canvas.height = 44
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = '#4682B4'
    ctx.fillRect(10, 16, 12, 24)
    ctx.fillStyle = '#87CEEB'
    ctx.globalAlpha = 0.6
    ctx.beginPath()
    ctx.arc(16, 12, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = '#c0c0c0'
    ctx.fillRect(8, 30, 3, 3)
    ctx.fillRect(21, 30, 3, 3)
    
    this.textures.addCanvas('water', canvas)
    
    // Keyboard (24x10)
    canvas.width = 24
    canvas.height = 10
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = '#2c2c2c'
    ctx.fillRect(0, 0, 24, 10)
    ctx.fillStyle = '#1a1a1a'
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillRect(2 + i * 4, 2 + j * 4, 3, 3)
      }
    }
    
    this.textures.addCanvas('keyboard', canvas)
    
    // Mouse (12x16)
    canvas.width = 12
    canvas.height = 16
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = '#3c3c3c'
    ctx.beginPath()
    ctx.ellipse(6, 8, 5, 7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2c2c2c'
    ctx.fillRect(5, 4, 2, 6)
    
    this.textures.addCanvas('mouse', canvas)
    
    // Coffee machine (32x40)
    canvas.width = 32
    canvas.height = 40
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = '#2c2c2c'
    ctx.fillRect(6, 8, 20, 28)
    ctx.fillStyle = '#8b0000'
    ctx.fillRect(6, 8, 20, 5)
    ctx.fillStyle = '#3a3a3a'
    ctx.fillRect(12, 18, 8, 2)
    ctx.fillStyle = '#654321'
    ctx.fillRect(12, 28, 8, 6)
    
    this.textures.addCanvas('coffee', canvas)
    
    // Frame/Picture (32x40)
    canvas.width = 32
    canvas.height = 40
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = '#654321'
    ctx.fillRect(0, 0, 32, 40)
    ctx.fillStyle = '#87CEEB'
    ctx.fillRect(4, 4, 24, 32)
    // Desenho simples dentro
    ctx.fillStyle = '#FFD700'
    ctx.beginPath()
    ctx.arc(16, 16, 6, 0, Math.PI * 2)
    ctx.fill()
    
    this.textures.addCanvas('frame', canvas)
  }

  private createBackupSprites() {
    // Método de backup - os sprites já foram criados em createProfessionalPixelArtSprites
    console.log('✅ Sprites pixel art carregados com sucesso!')
  }

  private createCharacterSprites() {
    const tileSize = 32
    
    // Floor tiles com estilo pixel art
    const floorGraphics = this.make.graphics({ x: 0, y: 0 })
    floorGraphics.fillStyle(0xe8e8e8, 1)
    floorGraphics.fillRect(0, 0, tileSize, tileSize)
    floorGraphics.fillStyle(0xd0d0d0, 1)
    floorGraphics.fillRect(0, 0, 2, tileSize)
    floorGraphics.fillRect(0, 0, tileSize, 2)
    floorGraphics.generateTexture('floor', tileSize, tileSize)
    floorGraphics.destroy()

    // Desk - mesa moderna pixel art
    const deskGraphics = this.make.graphics({ x: 0, y: 0 })
    deskGraphics.fillStyle(0x8B7355, 1)
    deskGraphics.fillRect(2, 4, 60, 40)
    deskGraphics.fillStyle(0x6B5335, 1)
    deskGraphics.fillRect(2, 40, 60, 4)
    deskGraphics.fillRect(58, 8, 4, 36)
    deskGraphics.fillStyle(0x3a3a3a, 1)
    deskGraphics.fillRect(6, 40, 6, 8)
    deskGraphics.fillRect(52, 40, 6, 8)
    deskGraphics.generateTexture('desk', 64, 48)
    deskGraphics.destroy()

    // Monitor
    const monitorGraphics = this.make.graphics({ x: 0, y: 0 })
    monitorGraphics.fillStyle(0x2c3e50, 1)
    monitorGraphics.fillRect(4, 2, 24, 20)
    monitorGraphics.fillStyle(0x3498db, 0.6)
    monitorGraphics.fillRect(6, 4, 20, 16)
    monitorGraphics.fillStyle(0x2c2c2c, 1)
    monitorGraphics.fillRect(10, 22, 12, 2)
    monitorGraphics.fillRect(13, 24, 6, 4)
    monitorGraphics.generateTexture('monitor', 32, 28)
    monitorGraphics.destroy()

    // Chair pixel art
    const chairGraphics = this.make.graphics({ x: 0, y: 0 })
    chairGraphics.fillStyle(0x34495e, 1)
    chairGraphics.fillRoundedRect(6, 2, 20, 14, 4)
    chairGraphics.fillStyle(0x4a5f7f, 1)
    chairGraphics.fillEllipse(16, 20, 22, 12)
    chairGraphics.fillStyle(0x2c3e50, 1)
    chairGraphics.fillRect(14, 24, 4, 4)
    chairGraphics.generateTexture('chair', 32, 28)
    chairGraphics.destroy()

    // Plant pixel art
    const plantGraphics = this.make.graphics({ x: 0, y: 0 })
    plantGraphics.fillStyle(0x8B4513, 1)
    plantGraphics.fillRect(10, 22, 12, 8)
    plantGraphics.fillStyle(0x654321, 1)
    plantGraphics.fillRect(10, 28, 12, 2)
    plantGraphics.fillStyle(0x27ae60, 1)
    plantGraphics.fillCircle(12, 14, 8)
    plantGraphics.fillCircle(20, 14, 8)
    plantGraphics.fillCircle(16, 8, 8)
    plantGraphics.fillStyle(0x229954, 1)
    plantGraphics.fillCircle(16, 16, 6)
    plantGraphics.generateTexture('plant', 32, 32)
    plantGraphics.destroy()

    // Door
    const doorGraphics = this.make.graphics({ x: 0, y: 0 })
    doorGraphics.fillStyle(0x8B4513, 1)
    doorGraphics.fillRect(0, 0, 32, 48)
    doorGraphics.fillStyle(0x6B3413, 1)
    doorGraphics.fillRect(4, 4, 24, 40)
    doorGraphics.fillRect(4, 24, 24, 2)
    doorGraphics.fillStyle(0xFFD700, 1)
    doorGraphics.fillCircle(8, 28, 3)
    doorGraphics.generateTexture('door', 32, 48)
    doorGraphics.destroy()

    // Coffee machine
    const coffeeGraphics = this.make.graphics({ x: 0, y: 0 })
    coffeeGraphics.fillStyle(0x2c2c2c, 1)
    coffeeGraphics.fillRect(4, 8, 24, 32)
    coffeeGraphics.fillStyle(0x8b0000, 1)
    coffeeGraphics.fillRect(4, 8, 24, 6)
    coffeeGraphics.fillStyle(0x3a3a3a, 1)
    coffeeGraphics.fillRect(10, 20, 12, 2)
    coffeeGraphics.fillStyle(0x654321, 1)
    coffeeGraphics.fillRect(12, 30, 8, 6)
    coffeeGraphics.generateTexture('coffee', 32, 40)
    coffeeGraphics.destroy()

    // Bookshelf
    const bookshelfGraphics = this.make.graphics({ x: 0, y: 0 })
    bookshelfGraphics.fillStyle(0x654321, 1)
    bookshelfGraphics.fillRect(0, 0, 48, 64)
    bookshelfGraphics.fillStyle(0x4a3428, 1)
    for (let i = 0; i < 4; i++) {
      bookshelfGraphics.fillRect(2, 4 + i * 15, 44, 12)
    }
    bookshelfGraphics.fillStyle(0x8b0000, 1)
    bookshelfGraphics.fillRect(6, 6, 6, 10)
    bookshelfGraphics.fillStyle(0x00008b, 1)
    bookshelfGraphics.fillRect(14, 6, 6, 10)
    bookshelfGraphics.fillStyle(0x006400, 1)
    bookshelfGraphics.fillRect(22, 6, 6, 10)
    bookshelfGraphics.generateTexture('bookshelf', 48, 64)
    bookshelfGraphics.destroy()

    // Sofa
    const sofaGraphics = this.make.graphics({ x: 0, y: 0 })
    sofaGraphics.fillStyle(0x4169E1, 1)
    sofaGraphics.fillRect(0, 8, 96, 16)
    sofaGraphics.fillStyle(0x5179F1, 1)
    sofaGraphics.fillRect(0, 24, 96, 20)
    sofaGraphics.fillStyle(0x3159D1, 1)
    sofaGraphics.fillRect(0, 14, 8, 30)
    sofaGraphics.fillRect(88, 14, 8, 30)
    sofaGraphics.generateTexture('sofa', 96, 44)
    sofaGraphics.destroy()

    // Meeting table
    const tableGraphics = this.make.graphics({ x: 0, y: 0 })
    tableGraphics.fillStyle(0x654321, 1)
    tableGraphics.fillEllipse(64, 48, 120, 80)
    tableGraphics.fillStyle(0x4a3428, 1)
    tableGraphics.fillEllipse(64, 52, 116, 76)
    tableGraphics.generateTexture('meetingTable', 128, 96)
    tableGraphics.destroy()

    // Water cooler
    const waterGraphics = this.make.graphics({ x: 0, y: 0 })
    waterGraphics.fillStyle(0x4682B4, 1)
    waterGraphics.fillRect(8, 16, 16, 28)
    waterGraphics.fillStyle(0x87CEEB, 0.6)
    waterGraphics.fillCircle(16, 12, 10)
    waterGraphics.fillStyle(0xc0c0c0, 1)
    waterGraphics.fillRect(6, 30, 4, 4)
    waterGraphics.fillRect(22, 30, 4, 4)
    waterGraphics.generateTexture('water', 32, 44)
    waterGraphics.destroy()

    // Frame/poster
    const frameGraphics = this.make.graphics({ x: 0, y: 0 })
    frameGraphics.fillStyle(0x654321, 1)
    frameGraphics.fillRect(0, 0, 32, 40)
    frameGraphics.fillStyle(0x87CEEB, 1)
    frameGraphics.fillRect(3, 3, 26, 34)
    frameGraphics.generateTexture('frame', 32, 40)
    frameGraphics.destroy()

    // Keyboard
    const keyboardGraphics = this.make.graphics({ x: 0, y: 0 })
    keyboardGraphics.fillStyle(0x2c2c2c, 1)
    keyboardGraphics.fillRect(0, 0, 24, 10)
    keyboardGraphics.fillStyle(0x1a1a1a, 1)
    for (let i = 0; i < 4; i++) {
      keyboardGraphics.fillRect(2 + i * 5, 2, 4, 3)
      keyboardGraphics.fillRect(2 + i * 5, 6, 4, 3)
    }
    keyboardGraphics.generateTexture('keyboard', 24, 10)
    keyboardGraphics.destroy()

    // Mouse
    const mouseGraphics = this.make.graphics({ x: 0, y: 0 })
    mouseGraphics.fillStyle(0x3c3c3c, 1)
    mouseGraphics.fillEllipse(6, 8, 10, 14)
    mouseGraphics.fillStyle(0x2c2c2c, 1)
    mouseGraphics.fillRect(5, 4, 2, 6)
    mouseGraphics.generateTexture('mouse', 12, 16)
    mouseGraphics.destroy()

    // Criar personagens animados
    this.createCharacterSprites()
  }

  private createCharacterSprites() {
    const charSize = 32
    const colors = [
      0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3,
      0xf38181, 0xaa96da, 0xfcbad3, 0xa8e6cf
    ]

    const directions = ['down', 'up', 'left', 'right']
    
    directions.forEach((direction, dirIndex) => {
      const graphics = this.make.graphics({ x: 0, y: 0 })
      
      for (let frame = 0; frame < 3; frame++) {
        const x = frame * charSize
        const offsetY = (frame === 1) ? 2 : 0
        
        // Sombra
        graphics.fillStyle(0x000000, 0.3)
        graphics.fillEllipse(x + 16, 28, 20, 8)
        
        // Corpo
        const color = colors[dirIndex % colors.length]
        graphics.fillStyle(color, 1)
        graphics.fillEllipse(x + 16, 20 - offsetY, 18, 22)
        
        // Cabeça
        graphics.fillStyle(0xffdbac, 1)
        graphics.fillCircle(x + 16, 10 - offsetY, 7)
        
        // Olhos baseados na direção
        graphics.fillStyle(0xffffff, 1)
        if (direction === 'down') {
          graphics.fillCircle(x + 13, 10 - offsetY, 2)
          graphics.fillCircle(x + 19, 10 - offsetY, 2)
          graphics.fillStyle(0x000000, 1)
          graphics.fillCircle(x + 13, 11 - offsetY, 1)
          graphics.fillCircle(x + 19, 11 - offsetY, 1)
        } else if (direction === 'up') {
          graphics.fillStyle(0x3d2817, 1)
          graphics.fillEllipse(x + 16, 7 - offsetY, 10, 5)
        } else if (direction === 'left') {
          graphics.fillCircle(x + 13, 10 - offsetY, 2)
          graphics.fillStyle(0x000000, 1)
          graphics.fillCircle(x + 12, 10 - offsetY, 1)
        } else {
          graphics.fillCircle(x + 19, 10 - offsetY, 2)
          graphics.fillStyle(0x000000, 1)
          graphics.fillCircle(x + 20, 10 - offsetY, 1)
        }
        
        // Pés
        graphics.fillStyle(0x5a5a5a, 1)
        if (direction !== 'up') {
          graphics.fillEllipse(x + 12, 28 - offsetY, 6, 4)
          graphics.fillEllipse(x + 20, 28 - offsetY, 6, 4)
        }
      }
      
      graphics.generateTexture(`character_${direction}`, charSize * 3, charSize)
      graphics.destroy()
    })
  }

  private createSprites() {
    // Método antigo - mantido por compatibilidade
    this.createPixelArtAssets()
  }

  private createOffice() {
    const width = 2000
    const height = 1500

    // Chão principal com padrão
    for (let x = 0; x < width; x += 100) {
      for (let y = 0; y < height; y += 100) {
        const shade = ((x + y) % 200 === 0) ? 0xe8e8e8 : 0xf5f5f5
        this.add.rectangle(x + 50, y + 50, 100, 100, shade).setDepth(0)
      }
    }

    // Paredes externas
    this.createWall(width / 2, 10, width, 20) // Topo
    this.createWall(width / 2, height - 10, width, 20) // Baixo
    this.createWall(10, height / 2, 20, height) // Esquerda
    this.createWall(width - 10, height / 2, 20, height) // Direita

    // Área de trabalho principal
    this.createWorkArea()

    // Sala de reunião (canto superior direito)
    this.createMeetingRoom()

    // Sala de café/descanso (canto inferior direito)
    this.createCoffeeRoom()

    // Sala privada/escritório (canto superior esquerdo)
    this.createPrivateOffice()

    // Corredor central
    this.decorateCorridor()

    // Configurar limites do mundo
    this.physics.world.setBounds(0, 0, width, height)
    
    // Configurar câmera
    this.cameras.main.setBounds(0, 0, width, height)
    this.cameras.main.setZoom(1)
  }

  private createWall(x: number, y: number, width: number, height: number, color: number = 0x3e2723) {
    const wall = this.add.rectangle(x, y, width, height, color)
    this.walls.add(wall)
    const body = wall.body as Phaser.Physics.Arcade.StaticBody
    if (body) {
      body.updateFromGameObject()
    }
  }

  private createWorkArea() {
    // Área aberta de trabalho com múltiplas estações
    const positions = [
      [250, 300], [450, 300], [650, 300],
      [250, 500], [450, 500], [650, 500],
      [250, 700], [450, 700], [650, 700],
      [250, 900], [450, 900], [650, 900]
    ]

    positions.forEach(([x, y]) => {
      this.createWorkstation(x, y)
    })

    // Adicionar plantas decorativas
    this.add.image(150, 250, 'plant').setDepth(5)
    this.add.image(750, 250, 'plant').setDepth(5)
    this.add.image(150, 950, 'plant').setDepth(5)
    this.add.image(750, 950, 'plant').setDepth(5)

    // Quadros nas paredes
    this.add.image(100, 150, 'frame').setDepth(1)
    this.add.image(400, 150, 'frame').setDepth(1)
    this.add.image(700, 150, 'frame').setDepth(1)
  }

  private createWorkstation(x: number, y: number) {
    // Mesa usando sprite
    this.add.image(x, y, 'desk').setDepth(2)
    
    // Monitor
    this.add.image(x, y - 10, 'monitor').setDepth(3)
    
    // Teclado
    this.add.image(x, y + 10, 'keyboard').setDepth(3)
    
    // Mouse
    this.add.image(x + 18, y + 12, 'mouse').setDepth(3)
    
    // Cadeira
    this.add.image(x, y + 50, 'chair').setDepth(1)
    
    // Luminária de mesa
    this.add.circle(x + 30, y - 20, 6, 0xFFD700, 0.8).setDepth(3)
    const lampGraphics = this.add.graphics()
    lampGraphics.lineStyle(2, 0x696969)
    lampGraphics.lineBetween(x + 30, y - 14, x + 30, y - 5)
    lampGraphics.setDepth(3)
  }

  private createMeetingRoom() {
    const roomX = 1600
    const roomY = 300
    const roomWidth = 350
    const roomHeight = 400

    // Paredes da sala
    this.add.rectangle(roomX, roomY, roomWidth, roomHeight, 0xdcdcdc).setDepth(1)
    this.createWall(roomX, roomY - roomHeight/2 + 10, roomWidth, 20) // Topo
    this.createWall(roomX, roomY + roomHeight/2 - 10, roomWidth, 20) // Baixo
    this.createWall(roomX + roomWidth/2 - 10, roomY, 20, roomHeight) // Direita
    
    // Parede esquerda com porta
    this.createWall(roomX - roomWidth/2 + 10, roomY - 120, 20, 140) // Parte superior
    this.createWall(roomX - roomWidth/2 + 10, roomY + 120, 20, 140) // Parte inferior
    
    // Porta
    this.createDoor(roomX - roomWidth/2 + 10, roomY, '📊 Sala de Reunião')

    // Mesa de reunião usando o sprite
    this.add.image(roomX, roomY, 'meetingTable').setDepth(2)
    
    // Cadeiras ao redor
    const chairPositions = [
      [roomX - 70, roomY - 60], [roomX, roomY - 80], [roomX + 70, roomY - 60],
      [roomX - 70, roomY + 60], [roomX, roomY + 80], [roomX + 70, roomY + 60],
      [roomX - 100, roomY], [roomX + 100, roomY]
    ]
    chairPositions.forEach(([x, y]) => {
      this.add.image(x, y, 'chair').setDepth(3)
    })

    // Quadro branco
    this.add.rectangle(roomX, roomY - 170, 150, 80, 0xffffff).setDepth(2)
    this.add.rectangle(roomX, roomY - 170, 148, 78, 0xf0f0f0).setDepth(2)
    this.add.text(roomX - 60, roomY - 190, '🖊️ Quadro', { 
      fontSize: '14px', 
      color: '#666666' 
    }).setDepth(2)

    // Projetor
    this.add.circle(roomX, roomY + 150, 15, 0x2c2c2c).setDepth(2)
    
    // Plantas decorativas
    this.add.image(roomX - 150, roomY - 160, 'plant').setDepth(2)
    this.add.image(roomX + 150, roomY - 160, 'plant').setDepth(2)
  }

  private createCoffeeRoom() {
    const roomX = 1650
    const roomY = 900
    const roomWidth = 300
    const roomHeight = 400

    // Paredes da sala
    this.add.rectangle(roomX, roomY, roomWidth, roomHeight, 0xe8d4b0).setDepth(1)
    this.createWall(roomX, roomY - roomHeight/2 + 10, roomWidth, 20) // Topo
    this.createWall(roomX, roomY + roomHeight/2 - 10, roomWidth, 20) // Baixo
    this.createWall(roomX + roomWidth/2 - 10, roomY, 20, roomHeight) // Direita
    
    // Parede esquerda com porta
    this.createWall(roomX - roomWidth/2 + 10, roomY - 120, 20, 140)
    this.createWall(roomX - roomWidth/2 + 10, roomY + 120, 20, 140)
    
    // Porta
    this.createDoor(roomX - roomWidth/2 + 10, roomY, '☕ Café & Descanso')

    // Máquina de café usando sprite
    this.add.image(roomX - 100, roomY - 130, 'coffee').setDepth(2)
    this.add.text(roomX - 120, roomY - 165, '☕', { fontSize: '24px' }).setDepth(2)

    // Geladeira
    this.add.rectangle(roomX + 80, roomY - 130, 70, 90, 0xc0c0c0).setDepth(2)
    this.add.circle(roomX + 85, roomY - 130, 5, 0x696969).setDepth(3)

    // Mesa de centro usando desk sprite
    this.add.image(roomX, roomY, 'desk').setDepth(2).setScale(0.8)
    
    // Sofá usando sprite
    this.add.image(roomX, roomY + 100, 'sofa').setDepth(2)

    // Plantas
    this.add.image(roomX - 120, roomY + 150, 'plant').setDepth(2)
    this.add.image(roomX + 120, roomY + 150, 'plant').setDepth(2)
  }

  private createPrivateOffice() {
    const roomX = 250
    const roomY = 150
    const roomWidth = 300
    const roomHeight = 250

    // Paredes da sala
    this.add.rectangle(roomX, roomY, roomWidth, roomHeight, 0xfaf0e6).setDepth(1)
    this.createWall(roomX, roomY - roomHeight/2 + 10, roomWidth, 20) // Topo
    this.createWall(roomX - roomWidth/2 + 10, roomY, 20, roomHeight) // Esquerda
    this.createWall(roomX + roomWidth/2 - 10, roomY, 20, roomHeight) // Direita
    
    // Parede inferior com porta
    this.createWall(roomX - 80, roomY + roomHeight/2 - 10, 140, 20)
    this.createWall(roomX + 80, roomY + roomHeight/2 - 10, 140, 20)
    
    // Porta
    this.createDoor(roomX, roomY + roomHeight/2 - 10, '🚪 Escritório Privado')

    // Mesa executiva usando sprite desk
    this.add.image(roomX, roomY + 40, 'desk').setDepth(2).setScale(1.5)
    this.add.image(roomX, roomY + 20, 'monitor').setDepth(3)
    
    // Cadeira executiva
    this.add.image(roomX, roomY + 100, 'chair').setDepth(3)
    
    // Estante usando sprite
    this.add.image(roomX - 100, roomY - 60, 'bookshelf').setDepth(2)

    // Janela
    this.add.rectangle(roomX + 100, roomY - 60, 80, 80, 0x87CEEB).setDepth(2)
    this.add.rectangle(roomX + 100, roomY - 60, 2, 80, 0x654321).setDepth(3)
    this.add.rectangle(roomX + 100, roomY - 60, 80, 2, 0x654321).setDepth(3)
    
    // Planta decorativa
    this.add.image(roomX + 120, roomY + 80, 'plant').setDepth(2)
  }

  private decorateCorridor() {
    // Corredor central entre área de trabalho e salas
    const corridorX = 1000

    // Plantas no corredor
    for (let y = 300; y < 1200; y += 200) {
      this.add.image(corridorX, y, 'plant').setDepth(5)
      this.add.image(corridorX + 200, y, 'plant').setDepth(5)
    }

    // Bebedouro usando sprite
    this.add.image(1000, 600, 'water').setDepth(2)
    this.add.text(975, 640, '💧', { fontSize: '20px' }).setDepth(3)
    
    // Quadros decorativos nas paredes
    this.add.image(900, 400, 'frame').setDepth(2)
    this.add.image(1100, 800, 'frame').setDepth(2)
  }

  private createDoor(x: number, y: number, label: string) {
    const door = this.add.rectangle(x, y, 80, 20, 0x8B4513)
    door.setDepth(4)
    door.setData('label', label)
    door.setData('isOpen', false)
    
    // Maçaneta
    this.add.circle(x - 30, y, 5, 0xFFD700).setDepth(5)
    
    // Texto flutuante
    const doorText = this.add.text(x, y - 30, label, {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setDepth(10)
    
    door.setData('text', doorText)
    door.setInteractive()
    
    door.on('pointerover', () => {
      door.setFillStyle(0xCD853F)
      doorText.setVisible(true)
    })
    
    door.on('pointerout', () => {
      door.setFillStyle(0x8B4513)
    })
    
    // Tornar a porta clicável mas não bloqueante
    door.setData('canPassThrough', true)
    
    this.doors.add(door)
  }

  private createHUD() {
    // Instruções melhoradas
    const instructionsText = this.add.text(16, 16, 
      '🎮 WASD ou ←↑→↓ para mover\n💬 Use o chat para conversar\n🚪 Passe pelas portas para entrar nas salas', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: { x: 12, y: 8 },
      lineSpacing: 5
    })
    instructionsText.setScrollFactor(0).setDepth(1000)

    // Contador de jogadores online
    const onlineText = this.add.text(16, 120, '👥 Online: 1', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: { x: 12, y: 6 }
    })
    onlineText.setScrollFactor(0).setDepth(1000)
    
    // Atualizar contador quando jogadores conectarem/desconectarem
    this.socket.on('player-count', (count: number) => {
      onlineText.setText(`👥 Online: ${count}`)
    })
  }

  private createDesk(x: number, y: number) {
    // Mesa
    this.add.rectangle(x, y, 120, 80, 0x8b7355)
    // Computador
    this.add.rectangle(x, y - 10, 40, 30, 0x2c3e50)
  }

  private createPlayer() {
    const startX = 500
    const startY = 600

    // Criar sprite animado do jogador
    this.player = this.physics.add.sprite(startX, startY, 'character_down')
    
    // Criar animações para cada direção
    const directions = ['down', 'up', 'left', 'right']
    directions.forEach(direction => {
      this.anims.create({
        key: `walk_${direction}`,
        frames: this.anims.generateFrameNumbers(`character_${direction}`, { start: 0, end: 2 }),
        frameRate: 8,
        repeat: -1
      })
      this.anims.create({
        key: `idle_${direction}`,
        frames: [{ key: `character_${direction}`, frame: 0 }],
        frameRate: 1
      })
    })
    
    this.player.setCollideWorldBounds(true)
    this.player.setDepth(10)
    this.player.setSize(20, 16)
    this.player.setOffset(6, 16)

    // Colisão com paredes
    this.physics.add.collider(this.player, this.walls)

    // Nome do jogador com estilo melhorado
    this.playerNameText = this.add.text(this.player.x, this.player.y - 25, this.username, {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: { x: 6, y: 3 }
    })
    this.playerNameText.setOrigin(0.5)
    this.playerNameText.setDepth(11)

    // Câmera segue o jogador com transição suave
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
    // Quando receber lista de jogadores existentes
    this.socket.on('current-players', (players: Record<string, PlayerData>) => {
      Object.keys(players).forEach(id => {
        if (id !== this.socket.id) {
          this.addOtherPlayer(id, players[id])
        }
      })
    })

    // Quando um novo jogador entrar
    this.socket.on('new-player', (data: { id: string, playerData: PlayerData }) => {
      if (data.id !== this.socket.id) {
        this.addOtherPlayer(data.id, data.playerData)
      }
    })

    // Quando um jogador se mover
    this.socket.on('player-moved', (data: { id: string, x: number, y: number, direction?: string }) => {
      const otherPlayer = this.otherPlayers.get(data.id)
      if (otherPlayer) {
        // Interpolação suave
        this.tweens.add({
          targets: otherPlayer.sprite,
          x: data.x,
          y: data.y,
          duration: 50,
          ease: 'Linear'
        })
        
        // Animar o outro jogador na direção correta
        if (data.direction) {
          otherPlayer.sprite.anims.play(`walk_${data.direction}`, true)
        }
      }
    })

    // Quando um jogador desconectar
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
    // Criar sprite animado do outro jogador
    const sprite = this.physics.add.sprite(playerData.x, playerData.y, 'character_down')
    sprite.setDepth(10)
    sprite.setSize(20, 16)
    sprite.setOffset(6, 16)

    // Nome do outro jogador
    const nameText = this.add.text(playerData.x, playerData.y - 25, playerData.username, {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: { x: 6, y: 3 }
    })
    nameText.setOrigin(0.5)
    nameText.setDepth(11)

    this.otherPlayers.set(id, { sprite, nameText })
  }

  update() {
    if (!this.player) return

    const speed = 200
    let velocityX = 0
    let velocityY = 0
    let isMoving = false

    // Controles
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

    // Normalizar velocidade diagonal
    if (velocityX !== 0 && velocityY !== 0) {
      const factor = Math.sqrt(2) / 2
      velocityX *= factor
      velocityY *= factor
    }

    this.player.setVelocity(velocityX, velocityY)

    // Atualizar animação
    if (isMoving) {
      this.player.anims.play(`walk_${this.lastDirection}`, true)
    } else {
      this.player.anims.play(`idle_${this.lastDirection}`, true)
    }

    // Atualizar posição do nome
    this.playerNameText.setPosition(this.player.x, this.player.y - 25)

    // Atualizar posição dos nomes dos outros jogadores
    this.otherPlayers.forEach(player => {
      player.nameText.setPosition(player.sprite.x, player.sprite.y - 25)
    })

    // Enviar posição para o servidor (apenas se moveu)
    if (isMoving) {
      this.socket.emit('player-movement', {
        x: this.player.x,
        y: this.player.y,
        direction: this.lastDirection
      })
    }
  }
}
