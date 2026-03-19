import * as Phaser from 'phaser'
import type { MapDefinition, SpaceDefinition, RoomDefinition, ObjectDefinition } from './types/MapDefinition'

export interface DoorZone {
  /** Centro da abertura no mundo */
  x: number
  y: number
  /** Tamanho da abertura */
  width: number
  height: number
  /** Label da porta */
  label: string
  /** Referência ao corpo de colisão (parede invisível que fecha a porta) */
  blocker: Phaser.GameObjects.Rectangle | null
  /** Container visual da porta (sprite + maçaneta), posicionado na dobradiça */
  container: Phaser.GameObjects.Container
  /** Ângulo fechado (0) e aberto (±90) */
  closedAngle: number
  openAngle: number
  /** Estado atual */
  open: boolean
}

export interface MapLoadResult {
  worldWidth: number
  worldHeight: number
  spawnX: number
  spawnY: number
  doors: DoorZone[]
}

// Profundidade padrão por tipo de objeto
const DEFAULT_DEPTHS: Record<string, number> = {
  // Cadeiras (mais abaixo)
  chair: 1,
  exec_chair: 1,
  office_chair: 1,
  // Mesas e mobília média
  sofa: 2,
  desk: 2,
  'desk-with-pc': 2,
  bookshelf: 2,
  cabinet: 2,
  filing_cabinet: 2,
  small_cabinet: 2,
  meetingTable: 2,
  // Equipamentos
  coffee: 2,
  coffee_cup: 3,
  water: 2,
  water_cooler: 2,
  printer: 2,
  sink: 2,
  server_rack: 2,
  // Eletrônicos (acima da mesa)
  monitor: 3,
  monitor_obj: 3,
  keyboard: 3,
  keyboard_obj: 3,
  mouse: 3,
  mouse_obj: 3,
  laptop: 3,
  desk_lamp: 3,
  documents: 3,
  // Itens de parede
  whiteboard: 4,
  wall_art: 4,
  wall_chart: 4,
  wall_monitor: 4,
  wall_shelf: 4,
  // Plantas e lixeiras (acima de tudo)
  plant: 5,
  tall_plant: 5,
  trash: 4,
  trash_bin: 4,
  // Divisórias
  partition1: 5,
  partition2: 5,
  cubicle_partition: 5,
  // Personagens decorativos
  boss: 6,
  npc_character: 6,
  worker1: 6,
  worker2: 6,
  worker4: 6,
  // Interiors tileset — cozinha/banheiro
  int_fridge: 2, int_fridge2: 2, int_fridge3: 2,
  int_stove: 2, int_microwave: 3, int_sink_kitchen: 2,
  int_bathtub: 2, int_toilet: 2, int_bath_sink: 2,
  // Interiors — dormitório/mobília
  int_bed_single: 2, int_bed_double: 2,
  int_desk_wood: 2, int_desk_modern: 2, int_chair_office: 1,
  int_bookshelf: 2, int_shelf: 2,
  int_sofa_blue: 2, int_sofa_purple: 2, int_armchair: 2,
  int_tv: 3, int_pc_setup: 3,
  int_counter: 2, int_reception: 2,
  int_vending: 2, int_arcade: 2,
  // Interiors — decoração
  int_plant_pot: 5, int_plant_big: 5,
  int_door: 3, int_door_double: 3,
  int_painting1: 4, int_painting2: 4, int_clock: 4,
  int_rug_red: 0, int_rug_blue: 0, // tapetes no chão
  int_window: 4,
  // Room Builder — pisos (no chão)
  floor_red: 0, floor_golden: 0, floor_teal: 0, floor_wood: 0,
  floor_dark: 0, floor_orange: 0, floor_purple: 0, floor_gray: 0,
  floor_ceramic1: 0, floor_ceramic2: 0, floor_mosaic: 0, floor_herring: 0,
  floor_stone: 0, floor_slate: 0,
  // Room Builder — paredes
  wall_base: 3, wall_red: 3, wall_yellow: 3, wall_teal: 3,
  wall_brown: 3, wall_darkbrown: 3, wall_orange: 3, wall_purple: 3, wall_gray: 3,
  wall_red_alt: 3, wall_yellow_alt: 3, wall_teal_alt: 3, wall_brown_alt: 3,
  wall_wood: 3,
}

export class MapLoader {
  private scene: Phaser.Scene
  private walls: Phaser.Physics.Arcade.StaticGroup
  private doors: DoorZone[] = []

  constructor(scene: Phaser.Scene, walls: Phaser.Physics.Arcade.StaticGroup) {
    this.scene = scene
    this.walls = walls
  }

  load(map: MapDefinition): MapLoadResult {
    let worldWidth = 0
    let worldHeight = 0
    let spawnX = 500
    let spawnY = 500
    this.doors = []

    map.spaces.forEach((space, index) => {
      const ox = space.offset?.x ?? 0
      const oy = space.offset?.y ?? 0

      if (index === 0) {
        spawnX = ox + space.spawnPoint.x
        spawnY = oy + space.spawnPoint.y
      }

      worldWidth = Math.max(worldWidth, ox + space.width)
      worldHeight = Math.max(worldHeight, oy + space.height)

      this.renderSpace(space, ox, oy)
    })

    return { worldWidth, worldHeight, spawnX, spawnY, doors: this.doors }
  }

  private renderSpace(space: SpaceDefinition, ox: number, oy: number) {
    const floorTex = space.floor?.texture

    if (floorTex && this.scene.textures.exists(floorTex)) {
      // Piso com textura tileable do spritesheet
      this.scene.add.tileSprite(ox, oy, space.width, space.height, floorTex)
        .setOrigin(0, 0).setDepth(0)
    } else {
      // Piso em xadrez (fallback procedural)
      const tileSize = space.floor?.tileSize ?? 100
      const colorA = this.parseColor(space.floor?.colorA, '#e8e8e8')
      const colorB = this.parseColor(space.floor?.colorB, '#f5f5f5')
      const floorKey = `floor_${ox}_${oy}_${space.width}_${space.height}`
      if (!this.scene.textures.exists(floorKey)) {
        const graphics = this.scene.make.graphics({ x: 0, y: 0 } as any)
        for (let tx = 0; tx < space.width; tx += tileSize) {
          for (let ty = 0; ty < space.height; ty += tileSize) {
            const col = (Math.floor(tx / tileSize) + Math.floor(ty / tileSize)) % 2 === 0 ? colorA : colorB
            graphics.fillStyle(col, 1)
            graphics.fillRect(tx, ty, tileSize, tileSize)
          }
        }
        graphics.generateTexture(floorKey, space.width, space.height)
        graphics.destroy()
      }
      this.scene.add.image(ox, oy, floorKey).setOrigin(0, 0).setDepth(0)
    }

    // Nome do espaço
    this.scene.add
      .text(ox + 30, oy + 30, space.name, {
        fontSize: '20px',
        color: '#333333',
        backgroundColor: 'rgba(255,255,255,0.75)',
        padding: { x: 10, y: 5 },
      })
      .setDepth(5)

    // Paredes perimetrais (16px = 1 tile de espessura)
    const T = 16
    const perimH = 'wall_base'
    const perimV = this.scene.textures.exists('wall_base_v') ? 'wall_base_v' : perimH
    this.addWall(ox + space.width / 2,     oy + T / 2,                space.width, T, 0x3e2723, perimH)
    this.addWall(ox + space.width / 2,     oy + space.height - T / 2, space.width, T, 0x3e2723, perimH)
    this.addWall(ox + T / 2,              oy + space.height / 2,     T, space.height, 0x3e2723, perimV)
    this.addWall(ox + space.width - T / 2, oy + space.height / 2,     T, space.height, 0x3e2723, perimV)

    // Salas
    space.rooms?.forEach(room => this.renderRoom(room, ox, oy))

    // Objetos soltos no espaço aberto
    space.objects?.forEach(obj => this.placeObject(obj, ox, oy))
  }

  private renderRoom(room: RoomDefinition, ox: number, oy: number) {
    const absX = ox + room.x
    const absY = oy + room.y
    const { width: rw, height: rh } = room
    const T = 16  // espessura da parede = 1 tile
    const doorW = room.door?.width ?? 80
    const doorOff = room.door?.offset ?? 0
    const floorColor = this.parseColor(room.floorColor, '#eeeeee')
    const wallColor = this.parseColor(room.wallColor, '#5d4037')
    const floorTex = room.floorTexture
    const wallTex = room.wallTexture

    // ── Piso da sala ──────────────────────────────────────────────────────
    if (floorTex && this.scene.textures.exists(floorTex)) {
      this.scene.add.tileSprite(absX, absY, rw, rh, floorTex).setDepth(1)
    } else {
      this.scene.add.rectangle(absX, absY, rw, rh, floorColor).setDepth(1)
    }

    // ── Rótulo da sala ────────────────────────────────────────────────────
    this.scene.add
      .text(absX, absY - rh / 2 + 18, room.name, {
        fontSize: '12px',
        color: '#444444',
        backgroundColor: 'rgba(255,255,255,0.65)',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 0)
      .setDepth(6)

    // ── Paredes ───────────────────────────────────────────────────────────
    // Textura horizontal (top/bottom) e vertical (left/right)
    const wallSpriteH = (wallTex && this.scene.textures.exists(wallTex)) ? wallTex : undefined
    const wallSpriteV = (wallTex && this.scene.textures.exists(wallTex + '_v')) ? wallTex + '_v' : wallSpriteH

    // Paredes top/bottom (horizontal)
    const hDoorTop = room.door?.side === 'top'
    const hDoorBot = room.door?.side === 'bottom'
    if (hDoorTop) {
      this.wallWithGap(absX, absY - rh / 2, rw, T, 'h', doorW, doorOff, wallColor, wallSpriteH)
    } else {
      this.addWall(absX, absY - rh / 2, rw, T, wallColor, wallSpriteH)
    }
    if (hDoorBot) {
      this.wallWithGap(absX, absY + rh / 2, rw, T, 'h', doorW, doorOff, wallColor, wallSpriteH)
    } else {
      this.addWall(absX, absY + rh / 2, rw, T, wallColor, wallSpriteH)
    }

    // Paredes left/right (vertical — textura rotacionada)
    const vDoorLeft = room.door?.side === 'left'
    const vDoorRight = room.door?.side === 'right'
    if (vDoorLeft) {
      this.wallWithGap(absX - rw / 2, absY, T, rh, 'v', doorW, doorOff, wallColor, wallSpriteV)
    } else {
      this.addWall(absX - rw / 2, absY, T, rh, wallColor, wallSpriteV)
    }
    if (vDoorRight) {
      this.wallWithGap(absX + rw / 2, absY, T, rh, 'v', doorW, doorOff, wallColor, wallSpriteV)
    } else {
      this.addWall(absX + rw / 2, absY, T, rh, wallColor, wallSpriteV)
    }

    // ── Cantos (quadrado T×T em cada canto da sala) ─────────────────────
    const cornerKey = wallSpriteH
    const cx1 = absX - rw / 2
    const cx2 = absX + rw / 2
    const cy1 = absY - rh / 2
    const cy2 = absY + rh / 2
    this.addWall(cx1, cy1, T, T, wallColor, cornerKey)  // top-left
    this.addWall(cx2, cy1, T, T, wallColor, cornerKey)  // top-right
    this.addWall(cx1, cy2, T, T, wallColor, cornerKey)  // bottom-left
    this.addWall(cx2, cy2, T, T, wallColor, cornerKey)  // bottom-right

    // ── Rótulo da porta ───────────────────────────────────────────────────
    if (room.door?.label) {
      let lx = absX
      let ly = absY
      if (room.door.side === 'left')   { lx = absX - rw / 2; ly = absY + doorOff - 22 }
      if (room.door.side === 'right')  { lx = absX + rw / 2; ly = absY + doorOff - 22 }
      if (room.door.side === 'top')    { lx = absX + doorOff; ly = absY - rh / 2 - 22 }
      if (room.door.side === 'bottom') { lx = absX + doorOff; ly = absY + rh / 2 + 6  }

      this.scene.add
        .text(lx, ly, room.door.label, {
          fontSize: '11px',
          color: '#ffffff',
          backgroundColor: 'rgba(0,0,0,0.65)',
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5)
        .setDepth(10)
    }

    // ── Zona interativa da porta (sprite + blocker) ────────────────────
    if (room.door) {
      let dx = absX, dy = absY, bw = doorW, bh = T
      const side = room.door.side
      if (side === 'top')    { dx = absX + doorOff; dy = absY - rh / 2 }
      if (side === 'bottom') { dx = absX + doorOff; dy = absY + rh / 2 }
      if (side === 'left')   { dx = absX - rw / 2;  dy = absY + doorOff; bw = T; bh = doorW }
      if (side === 'right')  { dx = absX + rw / 2;  dy = absY + doorOff; bw = T; bh = doorW }

      const isH = side === 'top' || side === 'bottom'

      // Dobradiça: borda esquerda para H, borda superior para V
      const hingeX = isH ? dx - bw / 2 : dx
      const hingeY = isH ? dy : dy - bh / 2

      // Sprite visual da porta (posicionado relativo ao container)
      const doorSpriteKey = isH ? wallSpriteH : wallSpriteV
      let doorPanel: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Rectangle
      if (doorSpriteKey && this.scene.textures.exists(doorSpriteKey)) {
        doorPanel = this.scene.add.tileSprite(isH ? bw / 2 : 0, isH ? 0 : bh / 2, bw, bh, doorSpriteKey)
      } else {
        doorPanel = this.scene.add.rectangle(isH ? bw / 2 : 0, isH ? 0 : bh / 2, bw, bh, wallColor)
      }

      // Maçaneta (círculo dourado perto da extremidade oposta à dobradiça)
      const knobG = this.scene.add.graphics()
      const kx = isH ? bw - 6 : 0
      const ky = isH ? 0 : bh - 6
      knobG.fillStyle(0xdaa520, 1)
      knobG.fillCircle(kx, ky, 3)
      knobG.lineStyle(1, 0x8b6914, 1)
      knobG.strokeCircle(kx, ky, 3)

      // Container na posição da dobradiça (pivot = 0,0 do container)
      const container = this.scene.add.container(hingeX, hingeY, [doorPanel, knobG]).setDepth(4)

      // Blocker de colisão (começa fechado — com física)
      const blocker = this.scene.add.rectangle(dx, dy, bw, bh, 0x000000, 0).setDepth(0)
      this.walls.add(blocker)
      const blockerBody = blocker.body as Phaser.Physics.Arcade.StaticBody
      if (blockerBody) blockerBody.updateFromGameObject()

      this.doors.push({
        x: dx, y: dy, width: bw, height: bh,
        label: room.door.label ?? room.name,
        blocker,
        container,
        closedAngle: 0,
        openAngle: isH ? -90 : 90,
        open: false,
      })
    }

    // ── Objetos dentro da sala ────────────────────────────────────────────
    room.objects?.forEach(obj => this.placeObject(obj, ox + room.x, oy + room.y))
  }

  /**
   * Cria uma parede com abertura (porta).
   * dir 'h' = parede horizontal (gap no eixo X), 'v' = vertical (gap no eixo Y)
   */
  private wallWithGap(
    cx: number, cy: number,
    totalW: number, totalH: number,
    dir: 'h' | 'v',
    gapSize: number,
    gapOffset: number,
    color: number,
    spriteKey?: string,
  ) {
    if (dir === 'h') {
      const halfLen = totalW / 2
      const gapCx = cx + gapOffset
      const leftLen  = (gapCx - gapSize / 2) - (cx - halfLen)
      const rightLen = (cx + halfLen)         - (gapCx + gapSize / 2)
      if (leftLen  > 0) this.addWall(cx - halfLen + leftLen / 2,  cy, leftLen,  totalH, color, spriteKey)
      if (rightLen > 0) this.addWall(gapCx + gapSize / 2 + rightLen / 2, cy, rightLen, totalH, color, spriteKey)
    } else {
      const halfLen = totalH / 2
      const gapCy = cy + gapOffset
      const topLen = (gapCy - gapSize / 2) - (cy - halfLen)
      const botLen = (cy + halfLen)         - (gapCy + gapSize / 2)
      if (topLen > 0) this.addWall(cx, cy - halfLen + topLen / 2,  totalW, topLen, color, spriteKey)
      if (botLen > 0) this.addWall(cx, gapCy + gapSize / 2 + botLen / 2, totalW, botLen, color, spriteKey)
    }
  }

  private addWall(x: number, y: number, w: number, h: number, color: number = 0x3e2723, spriteKey?: string) {
    if (spriteKey && this.scene.textures.exists(spriteKey)) {
      // Parede visual com sprite tileado
      const tile = this.scene.add.tileSprite(x, y, w, h, spriteKey).setDepth(3)
      // Physics body invisível
      const phys = this.scene.add.rectangle(x, y, w, h, 0x000000, 0)
      this.walls.add(phys)
      const body = phys.body as Phaser.Physics.Arcade.StaticBody
      if (body) body.updateFromGameObject()
    } else {
      const wall = this.scene.add.rectangle(x, y, w, h, color)
      this.walls.add(wall)
      const body = wall.body as Phaser.Physics.Arcade.StaticBody
      if (body) body.updateFromGameObject()
    }
  }

  private placeObject(obj: ObjectDefinition, baseX: number, baseY: number) {
    const wx = baseX + obj.x
    const wy = baseY + obj.y
    const scale = obj.scale ?? 1
    const depth = obj.depth ?? (DEFAULT_DEPTHS[obj.type] ?? 2)

    // Tipo composto: workstation = mesa + monitor + teclado + mouse + cadeira
    if (obj.type === 'workstation') {
      this.tryImage('desk',     wx,              wy,               2,     scale)
      this.tryImage('monitor',  wx,              wy - 10 * scale,  3,     scale)
      this.tryImage('keyboard', wx,              wy + 10 * scale,  3,     scale)
      this.tryImage('mouse',    wx + 18 * scale, wy + 12 * scale,  3,     scale)
      this.tryImage('chair',    wx,              wy + 50 * scale,  1,     scale)
      return
    }

    this.tryImage(obj.type, wx, wy, depth, scale, obj.flipX, obj.rotation)
  }

  private tryImage(
    key: string,
    x: number,
    y: number,
    depth: number,
    scale: number,
    flipX?: boolean,
    rotationDeg?: number,
  ) {
    // Suporte a spritesheet:frame (ex: "interiors:42")
    const colonIdx = key.indexOf(':')
    if (colonIdx > 0) {
      const sheet = key.substring(0, colonIdx)
      const frame = parseInt(key.substring(colonIdx + 1), 10)
      if (!this.scene.textures.exists(sheet) || isNaN(frame)) return
      const img = this.scene.add.image(x, y, sheet, frame).setDepth(depth).setScale(scale)
      if (flipX) img.setFlipX(true)
      if (rotationDeg) img.setAngle(rotationDeg)
      return
    }

    if (!this.scene.textures.exists(key)) return
    const img = this.scene.add.image(x, y, key).setDepth(depth).setScale(scale)
    if (flipX) img.setFlipX(true)
    if (rotationDeg) img.setAngle(rotationDeg)
  }

  private parseColor(hex: string | undefined, fallback: string): number {
    return parseInt((hex ?? fallback).replace('#', ''), 16)
  }
}
