import Phaser from 'phaser'

// ── Constantes ────────────────────────────────────────────────────────────────

const TILE = 32

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type FloorTile = { x: number; y: number; tile: string }
export type FurnitureItem = { id: string; type: string; x: number; y: number }
export type Room = { id: string; name: string; x: number; y: number; w: number; h: number; color: string }

export interface EditorMapData {
  tileSize: number
  width: number
  height: number
  floors: FloorTile[]
  furniture: FurnitureItem[]
  rooms: Room[]
}

type Tool = 'select' | 'floor' | 'erase-floor' | 'room' | 'furniture' | 'erase-furniture'

// ── Catálogo de pisos ─────────────────────────────────────────────────────────

export const FLOOR_TYPES: { key: string; label: string; color: number }[] = [
  { key: 'wood',    label: '🪵 Madeira',  color: 0xc8a96e },
  { key: 'carpet',  label: '🟣 Carpete',  color: 0x7b68ee },
  { key: 'tile',    label: '⬜ Cerâmica', color: 0xd0d0d0 },
  { key: 'grass',   label: '🟢 Grama',    color: 0x6dbf67 },
  { key: 'concrete',label: '🔲 Concreto', color: 0x8e9eab },
]

// ── Catálogo de móveis ────────────────────────────────────────────────────────

export const FURNITURE_CATALOG: {
  type: string; label: string; color: number; w: number; h: number
}[] = [
  { type: 'desk',       label: '🖥 Mesa de Trabalho', color: 0x8B6914, w: 3, h: 2 },
  { type: 'chair',      label: '🪑 Cadeira',           color: 0x4a90d9, w: 1, h: 1 },
  { type: 'sofa',       label: '🛋 Sofá',              color: 0x9b59b6, w: 3, h: 2 },
  { type: 'plant',      label: '🌿 Planta',            color: 0x2ecc71, w: 1, h: 1 },
  { type: 'bookshelf',  label: '📚 Estante',           color: 0x795548, w: 1, h: 3 },
  { type: 'whiteboard', label: '📋 Quadro Branco',     color: 0xecf0f1, w: 3, h: 1 },
  { type: 'table',      label: '🪵 Mesa de Reunião',   color: 0xa0522d, w: 4, h: 3 },
  { type: 'coffee',     label: '☕ Máquina de Café',   color: 0x607d8b, w: 2, h: 1 },
  { type: 'printer',    label: '🖨 Impressora',        color: 0x546e7a, w: 2, h: 1 },
  { type: 'water',      label: '💧 Bebedouro',         color: 0x29b6f6, w: 1, h: 2 },
]

const ROOM_COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#16a085']

// ── Cena ──────────────────────────────────────────────────────────────────────

export default class EditorScene extends Phaser.Scene {

  // dados
  private mapData!: EditorMapData

  // ferramenta ativa
  private activeTool: Tool = 'select'
  private activeFloor = FLOOR_TYPES[0]
  private activeFurniture = FURNITURE_CATALOG[0]

  // camadas
  private floorLayer!: Phaser.GameObjects.Graphics
  private roomLayer!: Phaser.GameObjects.Graphics
  private furnitureLayer!: Phaser.GameObjects.Graphics
  private gridLayer!: Phaser.GameObjects.Graphics
  private cursorLayer!: Phaser.GameObjects.Graphics
  private roomPreviewLayer!: Phaser.GameObjects.Graphics

  // labels (text objects)
  private furnitureLabels: Phaser.GameObjects.Text[] = []
  private roomLabels: Phaser.GameObjects.Text[] = []

  // interação — arrastar móvel
  private isDragging = false
  private dragTarget: FurnitureItem | null = null
  private dragOffX = 0
  private dragOffY = 0

  // interação — pintura de piso
  private isPainting = false

  // interação — desenhar sala
  private isDrawingRoom = false
  private roomStart: { tx: number; ty: number } | null = null

  // câmera pan com botão direito
  private isPanning = false
  private panStart = { x: 0, y: 0 }
  private panScrollStart = { x: 0, y: 0 }

  // autosave debounce
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    super({ key: 'EditorScene' })
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async create() {
    const res = await fetch('/api/map')
    this.mapData = await res.json()

    const W = this.mapData.width * TILE
    const H = this.mapData.height * TILE

    this.cameras.main.setBackgroundColor('#111122')
    this.cameras.main.setBounds(0, 0, W, H)
    this.cameras.main.setZoom(1)

    // criar camadas na ordem certa
    this.floorLayer       = this.add.graphics().setDepth(0)
    this.roomLayer        = this.add.graphics().setDepth(1)
    this.furnitureLayer   = this.add.graphics().setDepth(2)
    this.gridLayer        = this.add.graphics().setDepth(3)
    this.cursorLayer      = this.add.graphics().setDepth(10)
    this.roomPreviewLayer = this.add.graphics().setDepth(11)

    this.redrawAll()
    this.setupInput()
  }

  shutdown() {
    document.getElementById('editor-overlay')?.remove()
    if (this.saveTimer) clearTimeout(this.saveTimer)
  }

  // ── Redesenho ─────────────────────────────────────────────────────────────

  private redrawAll() {
    this.drawGrid()
    this.drawFloors()
    this.drawRooms()
    this.drawFurniture()
  }

  private drawGrid() {
    const g = this.gridLayer
    g.clear()
    g.lineStyle(1, 0x333366, 0.5)
    for (let x = 0; x <= this.mapData.width; x++) {
      g.moveTo(x * TILE, 0).lineTo(x * TILE, this.mapData.height * TILE)
    }
    for (let y = 0; y <= this.mapData.height; y++) {
      g.moveTo(0, y * TILE).lineTo(this.mapData.width * TILE, y * TILE)
    }
    g.strokePath()

    // borda do mapa
    g.lineStyle(2, 0x5555aa, 1)
    g.strokeRect(0, 0, this.mapData.width * TILE, this.mapData.height * TILE)
  }

  private drawFloors() {
    const g = this.floorLayer
    g.clear()
    for (const f of this.mapData.floors) {
      const ft = FLOOR_TYPES.find(t => t.key === f.tile)
      const color = ft?.color ?? 0x888888
      g.fillStyle(color, 1)
      g.fillRect(f.x * TILE + 1, f.y * TILE + 1, TILE - 2, TILE - 2)
    }
  }

  private drawRooms() {
    const g = this.roomLayer
    g.clear()
    this.roomLabels.forEach(l => l.destroy())
    this.roomLabels = []

    for (const r of this.mapData.rooms) {
      const c = parseInt(r.color.replace('#', ''), 16)
      g.lineStyle(2, c, 1)
      g.fillStyle(c, 0.10)
      g.fillRect(r.x * TILE, r.y * TILE, r.w * TILE, r.h * TILE)
      g.strokeRect(r.x * TILE, r.y * TILE, r.w * TILE, r.h * TILE)

      const lbl = this.add.text(r.x * TILE + 6, r.y * TILE + 4, r.name, {
        fontSize: '11px',
        color: r.color,
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 3,
      }).setDepth(4)
      this.roomLabels.push(lbl)
    }
  }

  private drawFurniture() {
    const g = this.furnitureLayer
    g.clear()
    this.furnitureLabels.forEach(l => l.destroy())
    this.furnitureLabels = []

    for (const f of this.mapData.furniture) {
      const cat = FURNITURE_CATALOG.find(c => c.type === f.type) ?? FURNITURE_CATALOG[0]
      g.fillStyle(cat.color, 0.9)
      g.lineStyle(1, 0x000000, 0.6)
      g.fillRect(f.x * TILE + 2, f.y * TILE + 2, cat.w * TILE - 4, cat.h * TILE - 4)
      g.strokeRect(f.x * TILE + 2, f.y * TILE + 2, cat.w * TILE - 4, cat.h * TILE - 4)

      const lbl = this.add.text(f.x * TILE + 4, f.y * TILE + 4, cat.label, {
        fontSize: '10px',
        color: '#ffffff',
        stroke: '#000',
        strokeThickness: 2,
      }).setDepth(5)
      this.furnitureLabels.push(lbl)
    }
  }

  // ── Input ────────────────────────────────────────────────────────────────────

  private setupInput() {
    const cam = this.cameras.main

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const tx = Math.floor(p.worldX / TILE)
      const ty = Math.floor(p.worldY / TILE)

      // cursor highlight
      this.cursorLayer.clear()
      if (this.activeTool !== 'select') {
        const cat = this.activeTool === 'furniture' ? this.activeFurniture : null
        const cw = cat ? cat.w : 1
        const ch = cat ? cat.h : 1
        this.cursorLayer.lineStyle(2, 0xffff00, 0.9)
        this.cursorLayer.fillStyle(0xffff00, 0.15)
        this.cursorLayer.fillRect(tx * TILE, ty * TILE, cw * TILE, ch * TILE)
        this.cursorLayer.strokeRect(tx * TILE, ty * TILE, cw * TILE, ch * TILE)
      }

      // arrastar móvel
      if (this.isDragging && this.dragTarget) {
        this.dragTarget.x = tx - this.dragOffX
        this.dragTarget.y = ty - this.dragOffY
        this.drawFurniture()
        return
      }

      // pintura contínua
      if (this.isPainting) {
        if (this.activeTool === 'floor')       this.paintFloor(tx, ty)
        if (this.activeTool === 'erase-floor') this.eraseFloor(tx, ty)
      }

      // preview de sala
      if (this.isDrawingRoom && this.roomStart) {
        const x = Math.min(tx, this.roomStart.tx)
        const y = Math.min(ty, this.roomStart.ty)
        const w = Math.abs(tx - this.roomStart.tx) + 1
        const h = Math.abs(ty - this.roomStart.ty) + 1
        this.roomPreviewLayer.clear()
        this.roomPreviewLayer.lineStyle(2, 0xffff00, 1)
        this.roomPreviewLayer.fillStyle(0xffff00, 0.12)
        this.roomPreviewLayer.fillRect(x * TILE, y * TILE, w * TILE, h * TILE)
        this.roomPreviewLayer.strokeRect(x * TILE, y * TILE, w * TILE, h * TILE)
      }

      // pan câmera
      if (this.isPanning) {
        cam.scrollX = this.panScrollStart.x - (p.x - this.panStart.x) / cam.zoom
        cam.scrollY = this.panScrollStart.y - (p.y - this.panStart.y) / cam.zoom
      }
    })

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const tx = Math.floor(p.worldX / TILE)
      const ty = Math.floor(p.worldY / TILE)

      // pan com botão direito
      if (p.rightButtonDown()) {
        this.isPanning = true
        this.panStart = { x: p.x, y: p.y }
        this.panScrollStart = { x: cam.scrollX, y: cam.scrollY }
        return
      }

      if (this.activeTool === 'select') {
        const found = this.furnitureAt(tx, ty)
        if (found) {
          this.isDragging = true
          this.dragTarget = found
          this.dragOffX = tx - found.x
          this.dragOffY = ty - found.y
        }
        return
      }

      if (this.activeTool === 'floor') {
        this.isPainting = true
        this.paintFloor(tx, ty)
        return
      }

      if (this.activeTool === 'erase-floor') {
        this.isPainting = true
        this.eraseFloor(tx, ty)
        return
      }

      if (this.activeTool === 'erase-furniture') {
        const found = this.furnitureAt(tx, ty)
        if (found) {
          this.mapData.furniture = this.mapData.furniture.filter(f => f.id !== found.id)
          this.drawFurniture()
          this.autoSave()
        }
        return
      }

      if (this.activeTool === 'room') {
        this.isDrawingRoom = true
        this.roomStart = { tx, ty }
        return
      }

      if (this.activeTool === 'furniture') {
        this.placeFurniture(tx, ty)
      }
    })

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonReleased()) { this.isPanning = false; return }

      const tx = Math.floor(p.worldX / TILE)
      const ty = Math.floor(p.worldY / TILE)

      if (this.isDragging) {
        this.isDragging = false
        this.dragTarget = null
        this.drawFurniture()
        this.autoSave()
        return
      }

      if (this.isPainting) {
        this.isPainting = false
        this.autoSave()
        return
      }

      if (this.isDrawingRoom && this.roomStart) {
        this.isDrawingRoom = false
        this.roomPreviewLayer.clear()
        const x = Math.min(tx, this.roomStart.tx)
        const y = Math.min(ty, this.roomStart.ty)
        const w = Math.abs(tx - this.roomStart.tx) + 1
        const h = Math.abs(ty - this.roomStart.ty) + 1
        this.roomStart = null
        if (w >= 2 && h >= 2) this.promptNewRoom(x, y, w, h)
      }
    })

    // zoom
    this.input.on('wheel', (_p: any, _go: any, _dx: any, deltaY: number) => {
      const zoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.001, 0.25, 2.5)
      cam.setZoom(zoom)
    })
  }

  // ── Ações ────────────────────────────────────────────────────────────────────

  private furnitureAt(tx: number, ty: number): FurnitureItem | undefined {
    return [...this.mapData.furniture].reverse().find(f => {
      const cat = FURNITURE_CATALOG.find(c => c.type === f.type)!
      return tx >= f.x && tx < f.x + cat.w && ty >= f.y && ty < f.y + cat.h
    })
  }

  private paintFloor(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= this.mapData.width || ty >= this.mapData.height) return
    const existing = this.mapData.floors.find(f => f.x === tx && f.y === ty)
    if (existing) { existing.tile = this.activeFloor.key }
    else { this.mapData.floors.push({ x: tx, y: ty, tile: this.activeFloor.key }) }
    this.drawFloors()
  }

  private eraseFloor(tx: number, ty: number) {
    this.mapData.floors = this.mapData.floors.filter(f => !(f.x === tx && f.y === ty))
    this.drawFloors()
  }

  private placeFurniture(tx: number, ty: number) {
    this.mapData.furniture.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: this.activeFurniture.type,
      x: tx,
      y: ty,
    })
    this.drawFurniture()
    this.autoSave()
  }

  private promptNewRoom(x: number, y: number, w: number, h: number) {
    const name = window.prompt('Nome da sala:', 'Nova Sala')
    if (!name?.trim()) return
    const color = ROOM_COLORS[this.mapData.rooms.length % ROOM_COLORS.length]
    this.mapData.rooms.push({ id: `${Date.now()}`, name: name.trim(), x, y, w, h, color })
    this.drawRooms()
    this.autoSave()
    // avisar overlay para atualizar lista
    this.events.emit('rooms-changed')
  }

  deleteRoom(id: string) {
    // destroi labels associados
    this.roomLabels.forEach(l => l.destroy())
    this.roomLabels = []
    this.mapData.rooms = this.mapData.rooms.filter(r => r.id !== id)
    this.drawRooms()
    this.autoSave()
  }

  renameRoom(id: string, name: string) {
    const room = this.mapData.rooms.find(r => r.id === id)
    if (room) room.name = name
    this.drawRooms()
    this.autoSave()
  }

  setActiveTool(tool: Tool) {
    this.activeTool = tool
  }

  setActiveFloor(key: string) {
    this.activeFloor = FLOOR_TYPES.find(f => f.key === key) ?? FLOOR_TYPES[0]
  }

  setActiveFurniture(type: string) {
    this.activeFurniture = FURNITURE_CATALOG.find(f => f.type === type) ?? FURNITURE_CATALOG[0]
  }

  // ── Autosave ──────────────────────────────────────────────────────────────────

  private autoSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.save(), 700)
  }

  async save() {
    await fetch('/api/map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.mapData),
    })
    this.events.emit('map-saved')
  }

  getRooms() { return this.mapData.rooms }
}
