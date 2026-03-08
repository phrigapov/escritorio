export interface FloorConfig {
  tileSize?: number
  colorA?: string  // hex, ex: "#e8e8e8"
  colorB?: string
}

export interface DoorConfig {
  side: 'top' | 'bottom' | 'left' | 'right'
  offset?: number  // deslocamento em px a partir do centro da parede (padrão: 0)
  width?: number   // largura da abertura em px (padrão: 80)
  label?: string
}

export interface ObjectDefinition {
  type: string     // chave da textura Phaser, ou tipo composto como "workstation"
  x: number        // relativo ao centro da sala (para objetos de sala) ou à origem do espaço
  y: number
  scale?: number
  depth?: number
  flipX?: boolean
  rotation?: number // em graus
}

export interface RoomDefinition {
  id: string
  name: string
  x: number        // centro X relativo à origem do espaço
  y: number        // centro Y relativo à origem do espaço
  width: number
  height: number
  floorColor?: string  // hex
  wallColor?: string   // hex
  door?: DoorConfig
  objects?: ObjectDefinition[]
}

export interface SpaceDefinition {
  id: string
  name: string
  offset?: { x: number; y: number }   // posição no mundo (padrão: 0,0)
  width: number
  height: number
  spawnPoint: { x: number; y: number } // relativo à origem do espaço
  floor?: FloorConfig
  rooms?: RoomDefinition[]
  objects?: ObjectDefinition[]         // objetos no espaço aberto (fora de salas)
}

export interface MapDefinition {
  version: string
  spaces: SpaceDefinition[]
}
