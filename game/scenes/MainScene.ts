import * as Phaser from 'phaser'
import type { Socket } from 'socket.io-client'
import { MapLoader, type DoorZone } from '../MapLoader'
import type { MapDefinition } from '../types/MapDefinition'

type PlayerStatus = 'online' | 'busy' | 'away' | 'working'

const STATUS_COLORS: Record<PlayerStatus, number> = {
  online:   0x2ecc71,
  busy:     0xe74c3c,
  away:     0xf39c12,
  working:  0x3498db,
}

const STATUS_LABELS: Record<PlayerStatus, string> = {
  online:   'Online',
  busy:     'Ocupado',
  away:     'Ausente',
  working:  'Trabalhando',
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
  public socket!: Socket
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
  private loginType!: string
  private githubUsername!: string
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
  private doors: DoorZone[] = []
  private doorPrompt?: Phaser.GameObjects.Text
  private nearestDoor: DoorZone | null = null
  // Listeners registrados por esta cena — removidos no restart para evitar duplicatas
  private _sceneListeners: Array<[string, (...args: any[]) => void]> = []

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

    // ── Personagem principal (Julia) ──────────────────────────────────────────
    this.load.spritesheet('character_down',  '/sprites/caracters/Julia_walk_Foward.png', { frameWidth: 64, frameHeight: 64 })
    this.load.spritesheet('character_up',    '/sprites/caracters/Julia_walk_Up.png',     { frameWidth: 64, frameHeight: 64 })
    this.load.spritesheet('character_left',  '/sprites/caracters/Julia_walk_Left.png',   { frameWidth: 64, frameHeight: 64 })
    this.load.spritesheet('character_right', '/sprites/caracters/Julia_walk_Rigth.png',  { frameWidth: 64, frameHeight: 64 })

    // ── Personagens extras (NPCs / skins alternativas — 16x16 pack) ─────────
    const characters = ['Adam', 'Alex', 'Amelia', 'Bob']
    characters.forEach(name => {
      const n = name.toLowerCase()
      // Spritesheet completo (walk todas as direções): 24 cols × 7 rows de 16×32
      this.load.spritesheet(`${n}_walk`,      `/sprites/caracters/${name}_16x16.png`,           { frameWidth: 16, frameHeight: 32 })
      // Idle (4 direções, 1 frame cada)
      this.load.spritesheet(`${n}_idle`,      `/sprites/caracters/${name}_idle_16x16.png`,      { frameWidth: 16, frameHeight: 32 })
      // Idle animado
      this.load.spritesheet(`${n}_idle_anim`, `/sprites/caracters/${name}_idle_anim_16x16.png`, { frameWidth: 16, frameHeight: 32 })
      // Run
      this.load.spritesheet(`${n}_run`,       `/sprites/caracters/${name}_run_16x16.png`,       { frameWidth: 16, frameHeight: 32 })
      // Sentado
      this.load.spritesheet(`${n}_sit`,       `/sprites/caracters/${name}_sit_16x16.png`,       { frameWidth: 16, frameHeight: 32 })
      // Telefone
      this.load.spritesheet(`${n}_phone`,     `/sprites/caracters/${name}_phone_16x16.png`,     { frameWidth: 16, frameHeight: 32 })
    })

    // Personagens avulsos (imagens estáticas)
    this.load.image('boss',          '/sprites/caracters/boss.png')
    this.load.image('npc_character', '/sprites/caracters/npc_character.png')
    this.load.image('worker1',       '/sprites/caracters/worker1.png')
    this.load.image('worker2',       '/sprites/caracters/worker2.png')
    this.load.image('worker4',       '/sprites/caracters/worker4.png')

    // ── Objetos — mobília e itens de escritório ─────────────────────────────
    this.load.image('desk',             '/sprites/objects/desk.png')
    this.load.image('desk-with-pc',     '/sprites/objects/desk-with-pc.png')
    this.load.image('chair',            '/sprites/objects/Chair.png')
    this.load.image('plant',            '/sprites/objects/plant.png')
    this.load.image('coffee',           '/sprites/objects/coffee-maker.png')
    this.load.image('water',            '/sprites/objects/water-cooler.png')
    this.load.image('cabinet',          '/sprites/objects/cabinet.png')
    this.load.image('printer',          '/sprites/objects/printer.png')
    this.load.image('pc1',              '/sprites/objects/PC1.png')
    this.load.image('pc2',              '/sprites/objects/PC2.png')
    this.load.image('sofa',             '/sprites/objects/stamping-table.png')
    this.load.image('bookshelf',        '/sprites/objects/writing-table.png')
    this.load.image('sink',             '/sprites/objects/sink.png')
    this.load.image('trash',            '/sprites/objects/Trash.png')
    // Novos objetos pequenos (16x16)
    this.load.image('coffee_cup',       '/sprites/objects/coffee_cup.png')
    this.load.image('cubicle_partition', '/sprites/objects/cubicle_partition.png')
    this.load.image('desk_lamp',        '/sprites/objects/desk_lamp.png')
    this.load.image('documents',        '/sprites/objects/documents.png')
    this.load.image('exec_chair',       '/sprites/objects/exec_chair.png')
    this.load.image('filing_cabinet',   '/sprites/objects/filing_cabinet.png')
    this.load.image('keyboard_obj',     '/sprites/objects/keyboard.png')
    this.load.image('laptop',           '/sprites/objects/laptop.png')
    this.load.image('monitor_obj',      '/sprites/objects/monitor.png')
    this.load.image('mouse_obj',        '/sprites/objects/mouse.png')
    this.load.image('office_chair',     '/sprites/objects/office_chair.png')
    this.load.image('server_rack',      '/sprites/objects/server_rack.png')
    this.load.image('small_cabinet',    '/sprites/objects/small_cabinet.png')
    this.load.image('tall_plant',       '/sprites/objects/tall_plant.png')
    this.load.image('trash_bin',        '/sprites/objects/trash_bin.png')
    this.load.image('water_cooler',     '/sprites/objects/water_cooler.png')
    this.load.image('whiteboard',       '/sprites/objects/whiteboard.png')
    this.load.image('wall_art',         '/sprites/objects/wall_art.png')
    this.load.image('wall_chart',       '/sprites/objects/wall_chart.png')
    this.load.image('wall_monitor',     '/sprites/objects/wall_monitor.png')
    this.load.image('wall_shelf',       '/sprites/objects/wall_shelf.png')
    // Tileset de interiores (spritesheet 16x16)
    this.load.spritesheet('interiors',  '/sprites/objects/Interiors_free_16x16.png', { frameWidth: 16, frameHeight: 16 })

    // ── Cenário — paredes, pisos, tilesets ──────────────────────────────────
    this.load.image('partition1',       '/sprites/scenario/office-partitions-1.png')
    this.load.image('partition2',       '/sprites/scenario/office-partitions-2.png')
    this.load.spritesheet('room_builder', '/sprites/scenario/Room_Builder_free_16x16.png', { frameWidth: 16, frameHeight: 16 })
    this.load.spritesheet('tileset_1',  '/sprites/scenario/Tileset_16x16_1.png',  { frameWidth: 16, frameHeight: 16 })
    this.load.spritesheet('tileset_2',  '/sprites/scenario/Tileset_16x16_2.png',  { frameWidth: 16, frameHeight: 16 })
    this.load.spritesheet('tileset_3',  '/sprites/scenario/Tileset_16x16_3.png',  { frameWidth: 16, frameHeight: 16 })
    this.load.spritesheet('tileset_9',  '/sprites/scenario/Tileset_16x16_9.png',  { frameWidth: 16, frameHeight: 16 })
    this.load.spritesheet('tileset_16', '/sprites/scenario/Tileset_16x16_16.png', { frameWidth: 16, frameHeight: 16 })

    // Definição do mapa em JSON (via API para sempre pegar versão atualizada)
    this.load.json('map', `/api/map?t=${Date.now()}`)
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

    // ── Extrair itens compostos dos spritesheets ────────────────────────────
    this.extractTilesetItems()
  }

  /**
   * Extrai texturas nomeadas de regiões dos spritesheets (Interiors, Room_Builder).
   * Cada item é recortado da imagem fonte e registrado como textura independente.
   */
  private extractTilesetItems() {
    if (this.textures.exists('int_fridge')) return  // já extraído

    // Helper: extrai uma região de uma spritesheet como nova textura
    const extract = (name: string, sheetKey: string, sx: number, sy: number, sw: number, sh: number) => {
      if (!this.textures.exists(sheetKey)) return
      const source = this.textures.get(sheetKey).getSourceImage() as HTMLImageElement
      const canvas = document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh)
      this.textures.addCanvas(name, canvas)
    }

    // ── Interiors (256×1424, grade 16×16) ─────────────────────────────────
    // Geladeiras / armários grandes (topo da sheet)
    extract('int_fridge',       'interiors', 0,   0,   32, 48)  // geladeira verde
    extract('int_fridge2',      'interiors', 48,  0,   32, 48)  // geladeira azul
    extract('int_fridge3',      'interiors', 128, 0,   32, 48)  // geladeira teal
    // Eletrodomésticos de cozinha
    extract('int_stove',        'interiors', 0,   48,  32, 32)  // fogão
    extract('int_microwave',    'interiors', 32,  48,  16, 16)  // microondas
    extract('int_sink_kitchen', 'interiors', 48,  48,  32, 32)  // pia cozinha
    // Janela / porta
    extract('int_window',       'interiors', 96,  0,   48, 48)  // janela com cortina
    // Banheiro
    extract('int_bathtub',      'interiors', 0,   96,  48, 32)  // banheira
    extract('int_toilet',       'interiors', 48,  96,  16, 32)  // vaso
    extract('int_bath_sink',    'interiors', 64,  96,  16, 32)  // pia banheiro
    // Camas
    extract('int_bed_single',   'interiors', 0,   144, 32, 48)  // cama solteiro
    extract('int_bed_double',   'interiors', 32,  144, 48, 48)  // cama casal
    // Mesas e cadeiras de escritório
    extract('int_desk_wood',    'interiors', 0,   208, 48, 32)  // mesa madeira
    extract('int_desk_modern',  'interiors', 48,  208, 48, 32)  // mesa moderna
    extract('int_chair_office', 'interiors', 96,  208, 16, 32)  // cadeira office
    // Estantes e prateleiras
    extract('int_bookshelf',    'interiors', 0,   256, 32, 48)  // estante livros
    extract('int_shelf',        'interiors', 32,  256, 32, 48)  // prateleira
    // Sofás e poltronas
    extract('int_sofa_blue',    'interiors', 0,   320, 48, 32)  // sofá azul
    extract('int_sofa_purple',  'interiors', 48,  320, 48, 32)  // sofá roxo
    extract('int_armchair',     'interiors', 96,  320, 32, 32)  // poltrona
    // TV / eletrônicos
    extract('int_tv',           'interiors', 0,   368, 32, 32)  // TV
    extract('int_pc_setup',     'interiors', 32,  368, 32, 32)  // setup PC
    // Vasos / plantas
    extract('int_plant_pot',    'interiors', 128, 320, 16, 32)  // vaso de planta
    extract('int_plant_big',    'interiors', 144, 304, 32, 48)  // planta grande (palmeira)
    // Portas
    extract('int_door',         'interiors', 176, 320, 32, 48)  // porta
    extract('int_door_double',  'interiors', 208, 320, 48, 48)  // porta dupla
    // Quadros / decoração de parede
    extract('int_painting1',    'interiors', 0,   400, 32, 32)  // quadro 1
    extract('int_painting2',    'interiors', 32,  400, 32, 32)  // quadro 2
    extract('int_clock',        'interiors', 64,  400, 16, 16)  // relógio
    // Tapetes
    extract('int_rug_red',      'interiors', 96,  400, 48, 32)  // tapete vermelho
    extract('int_rug_blue',     'interiors', 144, 400, 48, 32)  // tapete azul
    // Balcões / recepção
    extract('int_counter',      'interiors', 0,   448, 48, 32)  // balcão
    extract('int_reception',    'interiors', 48,  448, 64, 32)  // recepção
    // Máquinas / vending
    extract('int_vending',      'interiors', 0,   496, 32, 48)  // máquina vending
    extract('int_arcade',       'interiors', 32,  496, 32, 48)  // fliperama

    // ── Room Builder (272×368, 17 cols × 23 rows de 16×16) ─────────────
    // Layout: pares de linhas = tema de cor. Linha par = parede, ímpar = piso.
    // Cols 0-9: variantes de parede/piso. Cols 11-16: pisos decorativos.
    //
    // Tile central de cada tema (col 1 = representativo, tileable)
    // Formato: row*16 = y. col*16 = x.

    // ── Texturas de PAREDE (16×16 tiles do topo de parede visto de cima) ──
    // Cada par: linha do topo = parede
    extract('wall_red',       'room_builder', 16, 80,  16, 16)  // row 5, col 1 — vermelho
    extract('wall_yellow',    'room_builder', 16, 112, 16, 16)  // row 7, col 1 — amarelo
    extract('wall_teal',      'room_builder', 16, 144, 16, 16)  // row 9, col 1 — teal
    extract('wall_brown',     'room_builder', 16, 176, 16, 16)  // row 11, col 1 — marrom
    extract('wall_darkbrown', 'room_builder', 16, 208, 16, 16)  // row 13, col 1 — marrom escuro
    extract('wall_orange',    'room_builder', 16, 240, 16, 16)  // row 15, col 1 — laranja
    extract('wall_purple',    'room_builder', 16, 272, 16, 16)  // row 17, col 1 — roxo
    extract('wall_gray',      'room_builder', 16, 304, 16, 16)  // row 19, col 1 — cinza
    // Variante com textura diferente (col 5)
    extract('wall_red_alt',   'room_builder', 80, 80,  16, 16)  // row 5, col 5
    extract('wall_yellow_alt','room_builder', 80, 112, 16, 16)  // row 7, col 5
    extract('wall_teal_alt',  'room_builder', 80, 144, 16, 16)  // row 9, col 5
    extract('wall_brown_alt', 'room_builder', 80, 176, 16, 16)  // row 11, col 5
    // Base neutra (rows 0-3 = parede cinza genérica)
    extract('wall_base',      'room_builder', 80, 16,  16, 16)  // row 1, col 5 — cinza neutro

    // ── Variantes verticais (rotação 90° CW) para paredes esquerda/direita ──
    const wallKeys = [
      'wall_red', 'wall_yellow', 'wall_teal', 'wall_brown',
      'wall_darkbrown', 'wall_orange', 'wall_purple', 'wall_gray',
      'wall_red_alt', 'wall_yellow_alt', 'wall_teal_alt', 'wall_brown_alt',
      'wall_base',
    ]
    for (const key of wallKeys) {
      if (!this.textures.exists(key)) continue
      const src = this.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement
      const canvas = document.createElement('canvas')
      canvas.width = src.height   // swap w/h
      canvas.height = src.width
      const ctx = canvas.getContext('2d')!
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(Math.PI / 2)
      ctx.drawImage(src, -src.width / 2, -src.height / 2)
      this.textures.addCanvas(key + '_v', canvas)
    }

    // ── Texturas de PISO (16×16 tiles de chão) ──
    // Cada par: linha de baixo = piso
    extract('floor_red',      'room_builder', 16, 96,  16, 16)  // row 6, col 1
    extract('floor_golden',   'room_builder', 16, 128, 16, 16)  // row 8, col 1
    extract('floor_teal',     'room_builder', 16, 160, 16, 16)  // row 10, col 1
    extract('floor_wood',     'room_builder', 16, 192, 16, 16)  // row 12, col 1 — madeira natural
    extract('floor_dark',     'room_builder', 16, 224, 16, 16)  // row 14, col 1 — escuro
    extract('floor_orange',   'room_builder', 16, 256, 16, 16)  // row 16, col 1
    extract('floor_purple',   'room_builder', 16, 288, 16, 16)  // row 18, col 1
    extract('floor_gray',     'room_builder', 16, 320, 16, 16)  // row 20, col 1
    // Pisos decorativos (seção direita, cols 11-16)
    extract('floor_ceramic1', 'room_builder', 176, 80,  16, 16) // row 5, col 11
    extract('floor_ceramic2', 'room_builder', 192, 80,  16, 16) // row 5, col 12
    extract('floor_mosaic',   'room_builder', 176, 112, 16, 16) // row 7, col 11
    extract('floor_herring',  'room_builder', 224, 112, 16, 16) // row 7, col 14 — espinha peixe
    extract('floor_stone',    'room_builder', 224, 80,  16, 16) // row 5, col 14 — pedra cinza
    extract('floor_slate',    'room_builder', 240, 80,  16, 16) // row 5, col 15
  }

  create() {
    this.createProceduralAssets()

    this.username       = this.registry.get('username')       || 'Jogador'
    this.loginType      = this.registry.get('loginType')      || 'github'
    this.githubUsername = this.registry.get('githubUsername') || this.username
    this.playerColor = Math.random() * 0xffffff

    this.walls = this.physics.add.staticGroup()

    this.createAnimations()

    // Carrega e renderiza o mapa a partir do JSON
    const mapData = this.cache.json.get('map') as MapDefinition
    const loader = new MapLoader(this, this.walls)
    const { worldWidth, worldHeight, spawnX, spawnY, doors } = loader.load(mapData)

    this.doors = doors
    this.spawnX = spawnX
    this.spawnY = spawnY

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight)
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight)

    // Socket criado em page.tsx e passado via registry — nunca chamar io() aqui
    this.socket = this.registry.get('socket') as Socket
    if (!this.socket) {
      console.error('[MainScene] Socket não encontrado no registry.')
      return
    }
    // Remove apenas os listeners desta cena (evita duplicatas em restart após editor)
    this.removeSceneListeners()

    this.createPlayer()
    this.setupControls()
    this.setupNetworkEvents()

    this.socket.emit('player-joined', {
      username:       this.username,
      githubUsername: this.githubUsername,
      x:              this.player.x,
      y:              this.player.y,
      color:          this.playerColor,
      loginType:      this.loginType,
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
    if (this.chatInputElement) {
      this.chatInputElement.remove()
      this.chatInputElement = undefined
    }
    this.otherPlayers.forEach(p => {
      p.chatBubble?.destroy()
      p.chatBubbleHideEvent?.remove(false)
      p.statusDot.destroy()
      p.sprite.destroy()
      p.nameText.destroy()
    })
    this.otherPlayers.clear()
    // Remove apenas os listeners desta cena — o socket permanece ativo
    this.removeSceneListeners()
  }

  private createHUD() {
    this.add.text(16, 16, '🎮 WASD/Setas para mover • ↵ Chat • E Interagir', {
      fontSize: '14px',
      color: '#fff',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 12, y: 8 },
    }).setScrollFactor(0).setDepth(1000)

    // Prompt flutuante "Pressione E" (invisível até proximidade)
    this.doorPrompt = this.add.text(0, 0, '', {
      fontSize: '12px',
      color: '#ffe082',
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(1001).setVisible(false)
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
      // Ignore when focus is on a React/HTML input (e.g. ChatPanel)
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return

      if (!this.isTyping) {
        this.openChatInput()
        return
      }

      this.submitChatMessage()
    })

    this.input.keyboard!.on('keydown-ESC', (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (!this.isTyping) return
      this.closeChatInput()
    })

    this.input.keyboard!.on('keydown-E', (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (this.isTyping || this.isMenuOpen) return
      this.interactWithNearestDoor()
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanupChatInput()
    })

    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.cleanupChatInput()
    })
  }

  /** Remove todos os listeners que esta cena registrou no socket compartilhado */
  private removeSceneListeners() {
    if (!this.socket) return
    this._sceneListeners.forEach(([event, fn]) => this.socket.off(event, fn))
    this._sceneListeners = []
  }

  /** Registra um listener no socket e guarda referência para remoção posterior */
  private onSocket(event: string, fn: (...args: any[]) => void) {
    this.socket.on(event, fn)
    this._sceneListeners.push([event, fn])
  }

  private setupNetworkEvents() {
    this.onSocket('connect', () => {
      console.log('[Socket] Conectado ao servidor, id:', this.socket.id)
    })
    this.onSocket('connect_error', (err: Error) => {
      console.error('[Socket] Erro de conexão:', err.message)
    })

    this.onSocket('current-players', (players: Record<string, PlayerData>) => {
      Object.keys(players).forEach(id => {
        if (id !== this.socket.id) this.addOtherPlayer(id, players[id])
      })
    })

    this.onSocket('new-player', (data: { id: string, playerData: PlayerData }) => {
      if (data.id !== this.socket.id) this.addOtherPlayer(data.id, data.playerData)
    })

    this.onSocket('player-moved', (data: { id: string, x: number, y: number, direction?: string }) => {
      const otherPlayer = this.otherPlayers.get(data.id)
      if (otherPlayer) {
        this.tweens.add({ targets: otherPlayer.sprite, x: data.x, y: data.y, duration: 50, ease: 'Linear' })
        if (data.direction) otherPlayer.sprite.anims.play(`walk_${data.direction}`, true)
      }
    })

    this.onSocket('player-disconnected', (id: string) => {
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

    this.onSocket('door-action', (data: { index: number, open: boolean }) => {
      const door = this.doors[data.index]
      if (door && door.open !== data.open) this.applyDoorState(door, data.open)
    })

    this.onSocket('player-status-changed', (data: { id: string, status: PlayerStatus }) => {
      const otherPlayer = this.otherPlayers.get(data.id)
      if (otherPlayer) {
        otherPlayer.status = data.status
        this.drawStatusDot(otherPlayer.statusDot, data.status)
      }
    })

    this.onSocket('chat-message', (message: ChatMessage) => {
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
    input.style.color = '#000'
    input.style.fontSize = '16px'
    input.style.zIndex = '2000'
    input.style.display = 'none'
    input.style.outline = 'none'
    input.style.boxShadow = '0 8px 30px rgba(0,0,0,0.25)'

    document.body.appendChild(input)

    input.addEventListener('keydown', (event: KeyboardEvent) => {
      // Stop propagation so Phaser's window listener doesn't see input keystrokes
      event.stopPropagation()

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
    // Só reabilita captura global se nenhum painel React estiver aberto
    if (!this.isPanelOpen) {
      this.input.keyboard!.enableGlobalCapture()
    }
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

    // Show bubble immediately (local echo)
    this.showOwnChatBubble(text)

    this.socket.emit('chat-message', {
      username: this.username,
      text,
      timestamp: Date.now(),
      room: 'geral',
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

    const statuses: PlayerStatus[] = ['online', 'busy', 'away', 'working']
    const angles = [-90, 0, 90, 180]

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

  private interactWithNearestDoor() {
    if (!this.nearestDoor) return
    const index = this.doors.indexOf(this.nearestDoor)
    if (index === -1) return
    const door = this.nearestDoor
    const open = !door.open
    this.applyDoorState(door, open)
    this.socket.emit('door-action', { index, open })
  }

  private applyDoorState(door: DoorZone, open: boolean) {
    door.open = open
    const targetAngle = open ? door.openAngle : door.closedAngle

    this.tweens.add({
      targets: door.container,
      angle: targetAngle,
      duration: 300,
      ease: 'Quad.easeInOut',
    })

    if (open) {
      if (door.blocker) {
        this.walls.remove(door.blocker, true, true)
        door.blocker = this.add.rectangle(door.x, door.y, door.width, door.height, 0x000000, 0).setDepth(0)
      }
    } else {
      this.time.delayedCall(300, () => {
        if (door.blocker) door.blocker.destroy()
        door.blocker = this.add.rectangle(door.x, door.y, door.width, door.height, 0x000000, 0).setDepth(0)
        this.walls.add(door.blocker)
        const body = door.blocker.body as Phaser.Physics.Arcade.StaticBody
        if (body) body.updateFromGameObject()
      })
    }
  }

  private checkDoorProximity() {
    if (!this.player || !this.doorPrompt) return
    const px = this.player.x
    const py = this.player.y
    const INTERACT_DIST = 60

    let closest: DoorZone | null = null
    let closestDist = Infinity

    for (const door of this.doors) {
      const dist = Phaser.Math.Distance.Between(px, py, door.x, door.y)
      if (dist < INTERACT_DIST && dist < closestDist) {
        closest = door
        closestDist = dist
      }
    }

    this.nearestDoor = closest

    if (closest) {
      const action = closest.open ? 'Fechar' : 'Abrir'
      this.doorPrompt.setText(`[E] ${action} — ${closest.label}`)
      this.doorPrompt.setPosition(closest.x, closest.y - 24)
      this.doorPrompt.setVisible(true)
    } else {
      this.doorPrompt.setVisible(false)
    }
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

    // Verifica proximidade com portas
    this.checkDoorProximity()

    if (isMoving) {
      this.socket.emit('player-movement', {
        x: this.player.x,
        y: this.player.y,
        direction: this.lastDirection
      })
    }
  }
}
