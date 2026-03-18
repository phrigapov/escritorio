import * as Phaser from 'phaser'
import type { MapDefinition, SpaceDefinition, RoomDefinition, ObjectDefinition } from './types/MapDefinition'

export interface MapLoadResult {
  worldWidth: number
  worldHeight: number
  spawnX: number
  spawnY: number
}

// Profundidade padrão por tipo de objeto
const DEFAULT_DEPTHS: Record<string, number> = {
  chair: 1,
  sofa: 2,
  desk: 2,
  'desk-with-pc': 2,
  bookshelf: 2,
  cabinet: 2,
  coffee: 2,
  water: 2,
  printer: 2,
  sink: 2,
  meetingTable: 2,
  monitor: 3,
  keyboard: 3,
  mouse: 3,
  plant: 5,
  trash: 4,
  partition1: 5,
  partition2: 5,
}

export class MapLoader {
  private scene: Phaser.Scene
  private walls: Phaser.Physics.Arcade.StaticGroup

  constructor(scene: Phaser.Scene, walls: Phaser.Physics.Arcade.StaticGroup) {
    this.scene = scene
    this.walls = walls
  }

  load(map: MapDefinition): MapLoadResult {
    let worldWidth = 0
    let worldHeight = 0
    let spawnX = 500
    let spawnY = 500

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

    return { worldWidth, worldHeight, spawnX, spawnY }
  }

  private renderSpace(space: SpaceDefinition, ox: number, oy: number) {
    const tileSize = space.floor?.tileSize ?? 100
    const colorA = this.parseColor(space.floor?.colorA, '#e8e8e8')
    const colorB = this.parseColor(space.floor?.colorB, '#f5f5f5')

    // Piso em xadrez otimizado (usando render texture para batch rendering)
    const floorKey = `floor_${ox}_${oy}_${space.width}_${space.height}`
    if (!this.scene.textures.exists(floorKey)) {
      const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false })
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

    // Nome do espaço
    this.scene.add
      .text(ox + 30, oy + 30, space.name, {
        fontSize: '20px',
        color: '#333333',
        backgroundColor: 'rgba(255,255,255,0.75)',
        padding: { x: 10, y: 5 },
      })
      .setDepth(5)

    // Paredes perimetrais
    const T = 20
    this.addWall(ox + space.width / 2,          oy + T / 2,                  space.width, T)
    this.addWall(ox + space.width / 2,          oy + space.height - T / 2,   space.width, T)
    this.addWall(ox + T / 2,                    oy + space.height / 2,       T, space.height)
    this.addWall(ox + space.width - T / 2,      oy + space.height / 2,       T, space.height)

    // Salas
    space.rooms?.forEach(room => this.renderRoom(room, ox, oy))

    // Objetos soltos no espaço aberto
    space.objects?.forEach(obj => this.placeObject(obj, ox, oy))
  }

  private renderRoom(room: RoomDefinition, ox: number, oy: number) {
    const absX = ox + room.x
    const absY = oy + room.y
    const { width: rw, height: rh } = room
    const T = 14
    const doorW = room.door?.width ?? 80
    const doorOff = room.door?.offset ?? 0
    const floorColor = this.parseColor(room.floorColor, '#eeeeee')
    const wallColor = this.parseColor(room.wallColor, '#5d4037')

    // Piso da sala
    this.scene.add.rectangle(absX, absY, rw, rh, floorColor).setDepth(1)

    // Rótulo da sala
    this.scene.add
      .text(absX, absY - rh / 2 + 18, room.name, {
        fontSize: '12px',
        color: '#444444',
        backgroundColor: 'rgba(255,255,255,0.65)',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 0)
      .setDepth(6)

    // Paredes da sala com sprites de partition e abertura para porta
    const hSprite = 'partition1' // horizontal
    const vSprite = 'partition2' // vertical
    const sides = ['top', 'bottom', 'left', 'right'] as const
    for (const side of sides) {
      const hasDoor = room.door?.side === side
      if (side === 'top') {
        hasDoor
          ? this.wallWithGap(absX, absY - rh / 2, rw, T, 'h', doorW, doorOff, wallColor, hSprite)
          : this.addWall(absX, absY - rh / 2, rw, T, wallColor, hSprite)
      } else if (side === 'bottom') {
        hasDoor
          ? this.wallWithGap(absX, absY + rh / 2, rw, T, 'h', doorW, doorOff, wallColor, hSprite)
          : this.addWall(absX, absY + rh / 2, rw, T, wallColor, hSprite)
      } else if (side === 'left') {
        hasDoor
          ? this.wallWithGap(absX - rw / 2, absY, T, rh, 'v', doorW, doorOff, wallColor, vSprite)
          : this.addWall(absX - rw / 2, absY, T, rh, wallColor, vSprite)
      } else if (side === 'right') {
        hasDoor
          ? this.wallWithGap(absX + rw / 2, absY, T, rh, 'v', doorW, doorOff, wallColor, vSprite)
          : this.addWall(absX + rw / 2, absY, T, rh, wallColor, vSprite)
      }
    }

    // Rótulo da porta
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

    // Objetos dentro da sala (coordenadas relativas ao centro da sala)
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
    if (!this.scene.textures.exists(key)) return
    const img = this.scene.add.image(x, y, key).setDepth(depth).setScale(scale)
    if (flipX) img.setFlipX(true)
    if (rotationDeg) img.setAngle(rotationDeg)
  }

  private parseColor(hex: string | undefined, fallback: string): number {
    return parseInt((hex ?? fallback).replace('#', ''), 16)
  }
}
