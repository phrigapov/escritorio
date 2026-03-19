import * as Phaser from 'phaser'
import type { MapDefinition, RoomDefinition, ObjectDefinition } from '../types/MapDefinition'

// ── Tipos exportados ──────────────────────────────────────────────────────────

export type EditorTool = 'select' | 'add-object' | 'add-room' | 'spawn' | 'delete'

export type SelectedEditorItem =
  | { kind: 'space-obj'; si: number; oi: number }
  | { kind: 'room-obj';  si: number; ri: number; oi: number }
  | { kind: 'room';      si: number; ri: number }

// ── Catálogo visual de objetos ────────────────────────────────────────────────

export const OBJ_INFO: Record<string, { w: number; h: number; color: number; label: string }> = {
  // ── Compostos / Grandes ──
  workstation:       { w: 64,  h: 70,  color: 0x2c3e50, label: 'WS'          },
  meetingTable:      { w: 128, h: 96,  color: 0xa0522d, label: 'Mesa Reun.'  },
  // ── Mesas & Bancadas ──
  desk:              { w: 64,  h: 48,  color: 0x8B6914, label: 'Mesa'        },
  'desk-with-pc':    { w: 80,  h: 48,  color: 0x5d4037, label: 'PC-Desk'     },
  // ── Cadeiras ──
  chair:             { w: 28,  h: 28,  color: 0x4a90d9, label: 'Cadeira'     },
  exec_chair:        { w: 16,  h: 16,  color: 0x4a90d9, label: 'Exec.Ch.'    },
  office_chair:      { w: 16,  h: 16,  color: 0x4a75c9, label: 'Off.Ch.'     },
  sofa:              { w: 80,  h: 48,  color: 0x9b59b6, label: 'Sofá'        },
  // ── Plantas ──
  plant:             { w: 32,  h: 32,  color: 0x2ecc71, label: 'Planta'      },
  tall_plant:        { w: 16,  h: 16,  color: 0x27ae60, label: 'Pl.Alta'     },
  // ── Armários & Estantes ──
  bookshelf:         { w: 32,  h: 64,  color: 0x795548, label: 'Estante'     },
  cabinet:           { w: 36,  h: 64,  color: 0x6d4c41, label: 'Arquivo'     },
  filing_cabinet:    { w: 16,  h: 16,  color: 0x6d4c41, label: 'Arq.P.'      },
  small_cabinet:     { w: 16,  h: 16,  color: 0x8d6e63, label: 'Arm.P.'      },
  wall_shelf:        { w: 16,  h: 16,  color: 0x795548, label: 'Pratel.'     },
  // ── Equipamentos ──
  coffee:            { w: 40,  h: 28,  color: 0x607d8b, label: 'Café'        },
  coffee_cup:        { w: 16,  h: 16,  color: 0x795548, label: 'Xícara'      },
  printer:           { w: 40,  h: 28,  color: 0x546e7a, label: 'Impressora'  },
  water:             { w: 24,  h: 48,  color: 0x29b6f6, label: 'Água'        },
  water_cooler:      { w: 16,  h: 16,  color: 0x29b6f6, label: 'Beb.P.'      },
  server_rack:       { w: 16,  h: 16,  color: 0x37474f, label: 'Servidor'    },
  // ── Computadores & Eletrônicos ──
  laptop:            { w: 16,  h: 16,  color: 0x546e7a, label: 'Laptop'      },
  monitor_obj:       { w: 16,  h: 16,  color: 0x2c3e50, label: 'Monitor'     },
  keyboard_obj:      { w: 16,  h: 16,  color: 0x424242, label: 'Teclado'     },
  mouse_obj:         { w: 16,  h: 16,  color: 0x424242, label: 'Mouse'       },
  desk_lamp:         { w: 16,  h: 16,  color: 0xffd54f, label: 'Luminária'   },
  // ── Itens de parede ──
  whiteboard:        { w: 16,  h: 16,  color: 0xeeeeee, label: 'Quadro'      },
  wall_art:          { w: 16,  h: 16,  color: 0xe91e63, label: 'Quadro A.'   },
  wall_chart:        { w: 16,  h: 16,  color: 0x42a5f5, label: 'Gráfico'     },
  wall_monitor:      { w: 16,  h: 16,  color: 0x263238, label: 'TV Parede'   },
  // ── Pequenos objetos ──
  documents:         { w: 16,  h: 16,  color: 0xfff9c4, label: 'Docs'        },
  trash:             { w: 24,  h: 24,  color: 0x757575, label: 'Lixo'        },
  trash_bin:         { w: 16,  h: 16,  color: 0x757575, label: 'Lixo P.'     },
  sink:              { w: 40,  h: 36,  color: 0x00acc1, label: 'Pia'         },
  // ── Divisórias ──
  partition1:        { w: 16,  h: 80,  color: 0x78909c, label: '|'           },
  partition2:        { w: 80,  h: 16,  color: 0x78909c, label: '─'           },
  cubicle_partition: { w: 16,  h: 16,  color: 0x78909c, label: 'Divisória'   },
  // ── NPCs / Personagens decorativos ──
  boss:              { w: 64,  h: 64,  color: 0xe53935, label: 'Chefe'       },
  npc_character:     { w: 16,  h: 16,  color: 0x8e24aa, label: 'NPC'         },
  worker1:           { w: 64,  h: 64,  color: 0x1e88e5, label: 'Func.1'      },
  worker2:           { w: 64,  h: 64,  color: 0x43a047, label: 'Func.2'      },
  worker4:           { w: 64,  h: 64,  color: 0xfb8c00, label: 'Func.4'      },
  // ── Interiors tileset — mobília extraída ──
  int_fridge:        { w: 32,  h: 48,  color: 0x81c784, label: 'Geladeira'   },
  int_fridge2:       { w: 32,  h: 48,  color: 0x64b5f6, label: 'Gelad.2'     },
  int_fridge3:       { w: 32,  h: 48,  color: 0x4db6ac, label: 'Gelad.3'     },
  int_stove:         { w: 32,  h: 32,  color: 0x757575, label: 'Fogão'       },
  int_microwave:     { w: 16,  h: 16,  color: 0x90a4ae, label: 'Micro.'      },
  int_sink_kitchen:  { w: 32,  h: 32,  color: 0xb0bec5, label: 'Pia Coz.'    },
  int_window:        { w: 48,  h: 48,  color: 0x81d4fa, label: 'Janela'      },
  int_bathtub:       { w: 48,  h: 32,  color: 0xe0e0e0, label: 'Banheira'    },
  int_toilet:        { w: 16,  h: 32,  color: 0xfafafa, label: 'Vaso'        },
  int_bath_sink:     { w: 16,  h: 32,  color: 0xeceff1, label: 'Pia Ban.'    },
  int_bed_single:    { w: 32,  h: 48,  color: 0xef9a9a, label: 'Cama S.'     },
  int_bed_double:    { w: 48,  h: 48,  color: 0xce93d8, label: 'Cama C.'     },
  int_desk_wood:     { w: 48,  h: 32,  color: 0xa1887f, label: 'Mesa Mad.'   },
  int_desk_modern:   { w: 48,  h: 32,  color: 0x90a4ae, label: 'Mesa Mod.'   },
  int_chair_office:  { w: 16,  h: 32,  color: 0x5c6bc0, label: 'Cad.Int.'    },
  int_bookshelf:     { w: 32,  h: 48,  color: 0x8d6e63, label: 'Estante L.'  },
  int_shelf:         { w: 32,  h: 48,  color: 0xa1887f, label: 'Pratel.G.'   },
  int_sofa_blue:     { w: 48,  h: 32,  color: 0x5c6bc0, label: 'Sofá Az.'    },
  int_sofa_purple:   { w: 48,  h: 32,  color: 0xab47bc, label: 'Sofá Rx.'    },
  int_armchair:      { w: 32,  h: 32,  color: 0x7e57c2, label: 'Poltrona'    },
  int_tv:            { w: 32,  h: 32,  color: 0x37474f, label: 'TV'          },
  int_pc_setup:      { w: 32,  h: 32,  color: 0x455a64, label: 'PC Setup'    },
  int_plant_pot:     { w: 16,  h: 32,  color: 0x66bb6a, label: 'Vaso Pl.'    },
  int_plant_big:     { w: 32,  h: 48,  color: 0x43a047, label: 'Palmeira'    },
  int_door:          { w: 32,  h: 48,  color: 0x8d6e63, label: 'Porta'       },
  int_door_double:   { w: 48,  h: 48,  color: 0x795548, label: 'Porta Dup.'  },
  int_painting1:     { w: 32,  h: 32,  color: 0xef5350, label: 'Quadro 1'    },
  int_painting2:     { w: 32,  h: 32,  color: 0x42a5f5, label: 'Quadro 2'    },
  int_clock:         { w: 16,  h: 16,  color: 0xfdd835, label: 'Relógio'     },
  int_rug_red:       { w: 48,  h: 32,  color: 0xc62828, label: 'Tapete Vm.'  },
  int_rug_blue:      { w: 48,  h: 32,  color: 0x1565c0, label: 'Tapete Az.'  },
  int_counter:       { w: 48,  h: 32,  color: 0xa1887f, label: 'Balcão'      },
  int_reception:     { w: 64,  h: 32,  color: 0x8d6e63, label: 'Recepção'    },
  int_vending:       { w: 32,  h: 48,  color: 0xe53935, label: 'Vending'     },
  int_arcade:        { w: 32,  h: 48,  color: 0x1e88e5, label: 'Fliperama'   },
  // ── Room Builder — pisos temáticos (16×16 tiles) ──
  floor_red:         { w: 16,  h: 16,  color: 0xb16c63, label: 'Piso Verm.'  },
  floor_golden:      { w: 16,  h: 16,  color: 0xcdab7e, label: 'Piso Dour.'  },
  floor_teal:        { w: 16,  h: 16,  color: 0xc5c6b7, label: 'Piso Teal'   },
  floor_wood:        { w: 16,  h: 16,  color: 0xa77c55, label: 'Piso Mad.'   },
  floor_dark:        { w: 16,  h: 16,  color: 0x8a6659, label: 'Piso Escuro' },
  floor_orange:      { w: 16,  h: 16,  color: 0x9c5b47, label: 'Piso Laran.' },
  floor_purple:      { w: 16,  h: 16,  color: 0x9c9faf, label: 'Piso Roxo'   },
  floor_gray:        { w: 16,  h: 16,  color: 0xaca99e, label: 'Piso Cinza'  },
  floor_ceramic1:    { w: 16,  h: 16,  color: 0x975351, label: 'Piso Cer.1'  },
  floor_ceramic2:    { w: 16,  h: 16,  color: 0x9a5754, label: 'Piso Cer.2'  },
  floor_mosaic:      { w: 16,  h: 16,  color: 0xdad29c, label: 'Piso Mosaico'},
  floor_herring:     { w: 16,  h: 16,  color: 0x857d7d, label: 'Esp.Peixe'   },
  floor_stone:       { w: 16,  h: 16,  color: 0x8d8382, label: 'Piso Pedra'  },
  floor_slate:       { w: 16,  h: 16,  color: 0x908785, label: 'Piso Ardósia'},
  // ── Room Builder — paredes temáticas (16×16 tiles) ──
  wall_base:         { w: 16,  h: 16,  color: 0xb0b0b9, label: 'Par.Neutro'  },
  wall_red:          { w: 16,  h: 16,  color: 0xc59788, label: 'Par.Verm.'   },
  wall_yellow:       { w: 16,  h: 16,  color: 0xd9cda5, label: 'Par.Amar.'   },
  wall_teal:         { w: 16,  h: 16,  color: 0xc7d9d5, label: 'Par.Teal'    },
  wall_brown:        { w: 16,  h: 16,  color: 0xb6977a, label: 'Par.Marrom'  },
  wall_darkbrown:    { w: 16,  h: 16,  color: 0x9f857d, label: 'Par.M.Esc.'  },
  wall_orange:       { w: 16,  h: 16,  color: 0xad7d6f, label: 'Par.Laran.'  },
  wall_purple:       { w: 16,  h: 16,  color: 0xb0b2be, label: 'Par.Roxo'    },
  wall_gray:         { w: 16,  h: 16,  color: 0xbbbab3, label: 'Par.Cinza'   },
  wall_red_alt:      { w: 16,  h: 16,  color: 0xcf8869, label: 'Par.Vm.Alt'  },
  wall_yellow_alt:   { w: 16,  h: 16,  color: 0xefe29c, label: 'Par.Am.Alt'  },
  wall_teal_alt:     { w: 16,  h: 16,  color: 0xd4f2e8, label: 'Par.Tl.Alt'  },
  wall_brown_alt:    { w: 16,  h: 16,  color: 0xb68552, label: 'Par.Mr.Alt'  },
}

const OBJ_DEFAULT = { w: 36, h: 36, color: 0x888888, label: '?' }
function objInfo(type: string) {
  // Suporte a spritesheet:frame — usa tamanho padrão de tile
  if (type.includes(':')) return { w: 16, h: 16, color: 0xaaaaaa, label: `T${type.split(':')[1]}` }
  return OBJ_INFO[type] ?? OBJ_DEFAULT
}

export const OBJECT_CATALOG: { type: string; label: string; category: string }[] = [
  // Compostos
  { type: 'workstation',       label: '🖥 Workstation',      category: 'Compostos'    },
  { type: 'meetingTable',      label: '🏓 Mesa Reunião',     category: 'Compostos'    },
  // Mesas
  { type: 'desk',              label: '📦 Mesa',             category: 'Mobília'      },
  { type: 'desk-with-pc',      label: '🖥 Mesa c/ PC',       category: 'Mobília'      },
  // Cadeiras
  { type: 'chair',             label: '🪑 Cadeira',          category: 'Mobília'      },
  { type: 'exec_chair',        label: '🪑 Cadeira Exec.',    category: 'Mobília'      },
  { type: 'office_chair',      label: '🪑 Cadeira Office',   category: 'Mobília'      },
  { type: 'sofa',              label: '🛋 Sofá',             category: 'Mobília'      },
  // Armazenamento
  { type: 'bookshelf',         label: '📚 Estante',          category: 'Mobília'      },
  { type: 'cabinet',           label: '🗄 Arquivo',          category: 'Mobília'      },
  { type: 'filing_cabinet',    label: '🗄 Arquivo P.',       category: 'Mobília'      },
  { type: 'small_cabinet',     label: '🗄 Armário P.',       category: 'Mobília'      },
  { type: 'wall_shelf',        label: '📦 Prateleira',       category: 'Mobília'      },
  // Plantas
  { type: 'plant',             label: '🌿 Planta',           category: 'Decoração'    },
  { type: 'tall_plant',        label: '🌿 Planta Alta',      category: 'Decoração'    },
  // Equipamentos
  { type: 'coffee',            label: '☕ Cafeteira',         category: 'Equipamentos' },
  { type: 'coffee_cup',        label: '☕ Xícara',            category: 'Equipamentos' },
  { type: 'printer',           label: '🖨 Impressora',       category: 'Equipamentos' },
  { type: 'water',             label: '💧 Bebedouro',        category: 'Equipamentos' },
  { type: 'water_cooler',      label: '💧 Bebedouro P.',     category: 'Equipamentos' },
  { type: 'server_rack',       label: '🖥 Servidor',         category: 'Equipamentos' },
  { type: 'sink',              label: '🚰 Pia',              category: 'Equipamentos' },
  // Eletrônicos
  { type: 'laptop',            label: '💻 Laptop',           category: 'Eletrônicos'  },
  { type: 'monitor_obj',       label: '🖥 Monitor',          category: 'Eletrônicos'  },
  { type: 'keyboard_obj',      label: '⌨ Teclado',           category: 'Eletrônicos'  },
  { type: 'mouse_obj',         label: '🖱 Mouse',            category: 'Eletrônicos'  },
  { type: 'desk_lamp',         label: '💡 Luminária',        category: 'Eletrônicos'  },
  // Parede
  { type: 'whiteboard',        label: '📋 Quadro Branco',    category: 'Parede'       },
  { type: 'wall_art',          label: '🖼 Quadro Arte',      category: 'Parede'       },
  { type: 'wall_chart',        label: '📊 Gráfico Parede',   category: 'Parede'       },
  { type: 'wall_monitor',      label: '📺 TV Parede',        category: 'Parede'       },
  // Pequenos objetos
  { type: 'documents',         label: '📄 Documentos',       category: 'Pequenos'     },
  { type: 'trash',             label: '🗑 Lixeira',          category: 'Pequenos'     },
  { type: 'trash_bin',         label: '🗑 Lixeira P.',       category: 'Pequenos'     },
  // Divisórias
  { type: 'cubicle_partition', label: '▯ Divisória',         category: 'Estrutural'   },
  // Personagens decorativos
  { type: 'boss',              label: '👔 Chefe',            category: 'Personagens'  },
  { type: 'npc_character',     label: '👤 NPC',              category: 'Personagens'  },
  { type: 'worker1',           label: '👷 Funcionário 1',    category: 'Personagens'  },
  { type: 'worker2',           label: '👷 Funcionário 2',    category: 'Personagens'  },
  { type: 'worker4',           label: '👷 Funcionário 4',    category: 'Personagens'  },
  // ── Interiors Tileset — Cozinha ──
  { type: 'int_fridge',        label: '🧊 Geladeira',        category: 'Cozinha'      },
  { type: 'int_fridge2',       label: '🧊 Geladeira 2',      category: 'Cozinha'      },
  { type: 'int_fridge3',       label: '🧊 Geladeira 3',      category: 'Cozinha'      },
  { type: 'int_stove',         label: '🔥 Fogão',            category: 'Cozinha'      },
  { type: 'int_microwave',     label: '📦 Microondas',       category: 'Cozinha'      },
  { type: 'int_sink_kitchen',  label: '🚰 Pia Cozinha',      category: 'Cozinha'      },
  { type: 'int_counter',       label: '🔲 Balcão',           category: 'Cozinha'      },
  { type: 'int_vending',       label: '🥤 Vending Machine',  category: 'Cozinha'      },
  // ── Interiors Tileset — Banheiro ──
  { type: 'int_bathtub',       label: '🛁 Banheira',         category: 'Banheiro'     },
  { type: 'int_toilet',        label: '🚽 Vaso Sanitário',   category: 'Banheiro'     },
  { type: 'int_bath_sink',     label: '🚰 Pia Banheiro',     category: 'Banheiro'     },
  // ── Interiors Tileset — Dormitório ──
  { type: 'int_bed_single',    label: '🛏 Cama Solteiro',    category: 'Dormitório'   },
  { type: 'int_bed_double',    label: '🛏 Cama Casal',       category: 'Dormitório'   },
  // ── Interiors Tileset — Mobília Interior ──
  { type: 'int_desk_wood',     label: '🪵 Mesa Madeira',     category: 'Interior'     },
  { type: 'int_desk_modern',   label: '🔲 Mesa Moderna',     category: 'Interior'     },
  { type: 'int_chair_office',  label: '🪑 Cadeira Int.',     category: 'Interior'     },
  { type: 'int_bookshelf',     label: '📚 Estante Livros',   category: 'Interior'     },
  { type: 'int_shelf',         label: '📦 Prateleira G.',    category: 'Interior'     },
  { type: 'int_sofa_blue',     label: '🛋 Sofá Azul',        category: 'Interior'     },
  { type: 'int_sofa_purple',   label: '🛋 Sofá Roxo',        category: 'Interior'     },
  { type: 'int_armchair',      label: '💺 Poltrona',         category: 'Interior'     },
  { type: 'int_tv',            label: '📺 TV',               category: 'Interior'     },
  { type: 'int_pc_setup',      label: '🖥 PC Setup',         category: 'Interior'     },
  { type: 'int_reception',     label: '🏢 Recepção',         category: 'Interior'     },
  { type: 'int_arcade',        label: '🕹 Fliperama',        category: 'Interior'     },
  // ── Interiors Tileset — Decoração ──
  { type: 'int_plant_pot',     label: '🌱 Vaso Planta',      category: 'Dec. Interior'},
  { type: 'int_plant_big',     label: '🌴 Palmeira',         category: 'Dec. Interior'},
  { type: 'int_door',          label: '🚪 Porta',            category: 'Dec. Interior'},
  { type: 'int_door_double',   label: '🚪 Porta Dupla',      category: 'Dec. Interior'},
  { type: 'int_painting1',     label: '🖼 Quadro 1',         category: 'Dec. Interior'},
  { type: 'int_painting2',     label: '🖼 Quadro 2',         category: 'Dec. Interior'},
  { type: 'int_clock',         label: '🕐 Relógio',          category: 'Dec. Interior'},
  { type: 'int_rug_red',       label: '🔴 Tapete Vermelho',  category: 'Dec. Interior'},
  { type: 'int_rug_blue',      label: '🔵 Tapete Azul',      category: 'Dec. Interior'},
  { type: 'int_window',        label: '🪟 Janela',           category: 'Dec. Interior'},
  // ── Room Builder — Pisos ──
  { type: 'floor_red',         label: '🟥 Piso Vermelho',    category: 'Pisos'        },
  { type: 'floor_golden',      label: '🟨 Piso Dourado',     category: 'Pisos'        },
  { type: 'floor_teal',        label: '🟩 Piso Teal',        category: 'Pisos'        },
  { type: 'floor_wood',        label: '🟫 Piso Madeira',     category: 'Pisos'        },
  { type: 'floor_dark',        label: '🟫 Piso Escuro',      category: 'Pisos'        },
  { type: 'floor_orange',      label: '🟧 Piso Laranja',     category: 'Pisos'        },
  { type: 'floor_purple',      label: '🟪 Piso Roxo',        category: 'Pisos'        },
  { type: 'floor_gray',        label: '⬜ Piso Cinza',        category: 'Pisos'        },
  { type: 'floor_ceramic1',    label: '🔲 Piso Cerâmica 1',  category: 'Pisos'        },
  { type: 'floor_ceramic2',    label: '🔲 Piso Cerâmica 2',  category: 'Pisos'        },
  { type: 'floor_mosaic',      label: '🔶 Piso Mosaico',     category: 'Pisos'        },
  { type: 'floor_herring',     label: '🔷 Piso Esp.Peixe',   category: 'Pisos'        },
  { type: 'floor_stone',       label: '⬛ Piso Pedra',        category: 'Pisos'        },
  { type: 'floor_slate',       label: '⬛ Piso Ardósia',      category: 'Pisos'        },
  // ── Room Builder — Paredes ──
  { type: 'wall_base',         label: '⬜ Parede Neutra',     category: 'Paredes Dec.' },
  { type: 'wall_red',          label: '🟥 Parede Vermelha',  category: 'Paredes Dec.' },
  { type: 'wall_yellow',       label: '🟨 Parede Amarela',   category: 'Paredes Dec.' },
  { type: 'wall_teal',         label: '🟩 Parede Teal',      category: 'Paredes Dec.' },
  { type: 'wall_brown',        label: '🟫 Parede Marrom',    category: 'Paredes Dec.' },
  { type: 'wall_darkbrown',    label: '🟫 Parede M.Escuro',  category: 'Paredes Dec.' },
  { type: 'wall_orange',       label: '🟧 Parede Laranja',   category: 'Paredes Dec.' },
  { type: 'wall_purple',       label: '🟪 Parede Roxa',      category: 'Paredes Dec.' },
  { type: 'wall_gray',         label: '⬜ Parede Cinza',      category: 'Paredes Dec.' },
  { type: 'wall_red_alt',      label: '🟥 Parede Vm.Alt',    category: 'Paredes Dec.' },
  { type: 'wall_yellow_alt',   label: '🟨 Parede Am.Alt',    category: 'Paredes Dec.' },
  { type: 'wall_teal_alt',     label: '🟩 Parede Tl.Alt',    category: 'Paredes Dec.' },
  { type: 'wall_brown_alt',    label: '🟫 Parede Mr.Alt',    category: 'Paredes Dec.' },
]

// ── Hit area ──────────────────────────────────────────────────────────────────

interface HitArea {
  wx: number; wy: number  // world center
  hw: number; hh: number  // half extents
  item: SelectedEditorItem
  zOrder: number
}

// ── Cena ──────────────────────────────────────────────────────────────────────

export default class EditorScene extends Phaser.Scene {

  private mapData!: MapDefinition

  // ferramenta ativa
  private activeTool: EditorTool = 'select'
  private activeObjectType = 'workstation'

  // camadas gráficas
  private bgLayer!:          Phaser.GameObjects.Graphics
  private roomLayer!:        Phaser.GameObjects.Graphics
  private objLayer!:         Phaser.GameObjects.Graphics
  private selLayer!:         Phaser.GameObjects.Graphics
  private spawnLayer!:       Phaser.GameObjects.Graphics
  private cursorLayer!:      Phaser.GameObjects.Graphics
  private roomPreviewLayer!: Phaser.GameObjects.Graphics

  // labels/text criados a cada redraw
  private labels: Phaser.GameObjects.Text[] = []

  // seleção e arraste
  private selectedItem: SelectedEditorItem | null = null
  private isDragging = false
  private dragOffX = 0
  private dragOffY = 0

  // desenhar sala
  private isDrawingRoom = false
  private roomDrawSi = 0
  private roomDrawStart = { wx: 0, wy: 0 }

  // pan câmera — botão direito OU botão do meio
  private _panActive  = false
  private _panStartX  = 0
  private _panStartY  = 0
  private _panScrollX = 0
  private _panScrollY = 0

  // referência do handler nativo de wheel (para cleanup)
  private _wheelHandler: ((e: WheelEvent) => void) | null = null

  // hit areas reconstruídas a cada redraw
  private hitAreas: HitArea[] = []

  // autosave
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  // bloqueio do menu de contexto (botão direito = pan)
  private _noCtxMenu = (e: MouseEvent) => e.preventDefault()

  // dimensões do mundo
  private worldW = 2000
  private worldH = 3000

  // tamanho do grid (snap)
  private gridSize = 16

  constructor() { super({ key: 'EditorScene' }) }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async create() {
    const res = await fetch('/api/map')
    this.mapData = await res.json()

    this.computeWorldBounds()

    // Recuar o viewport para não ficar sob o painel lateral (270px)
    const panelW = 270
    const gw = this.game.scale.width
    const gh = this.game.scale.height
    this.cameras.main.setViewport(panelW, 0, gw - panelW, gh)

    this.cameras.main.setBackgroundColor('#111122')
    this.cameras.main.setBounds(-100, -100, this.worldW + 200, this.worldH + 200)
    this.cameras.main.setZoom(0.28)
    this.cameras.main.centerOn(this.worldW / 2, this.worldH / 2)

    this.bgLayer          = this.add.graphics().setDepth(0)
    this.roomLayer        = this.add.graphics().setDepth(2)
    this.objLayer         = this.add.graphics().setDepth(4)
    this.selLayer         = this.add.graphics().setDepth(6)
    this.spawnLayer       = this.add.graphics().setDepth(7)
    this.cursorLayer      = this.add.graphics().setDepth(10)
    this.roomPreviewLayer = this.add.graphics().setDepth(11)

    this.game.canvas.addEventListener('contextmenu', this._noCtxMenu)
    this.redrawAll()
    this.setupInput()
    // avisa o overlay que os dados já estão prontos
    this.events.emit('scene-ready')
  }

  shutdown() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.game.canvas.removeEventListener('contextmenu', this._noCtxMenu)
    if (this._wheelHandler) {
      this.game.canvas.removeEventListener('wheel', this._wheelHandler)
      this._wheelHandler = null
    }
    // Restaurar viewport completo para a MainScene
    const gw = this.game.scale.width
    const gh = this.game.scale.height
    this.cameras.main.setViewport(0, 0, gw, gh)
  }

  update() {
    const pointer = this.input.activePointer
    const cam     = this.cameras.main
    const panning = pointer.rightButtonDown() || pointer.middleButtonDown()
    if (panning) {
      if (!this._panActive) {
        this._panActive  = true
        this._panStartX  = pointer.x
        this._panStartY  = pointer.y
        this._panScrollX = cam.scrollX
        this._panScrollY = cam.scrollY
      } else {
        cam.scrollX = this._panScrollX - (pointer.x - this._panStartX) / cam.zoom
        cam.scrollY = this._panScrollY - (pointer.y - this._panStartY) / cam.zoom
      }
    } else {
      this._panActive = false
    }
  }

  // ── Bounds ───────────────────────────────────────────────────────────────────

  private computeWorldBounds() {
    let maxX = 200, maxY = 200
    for (const space of this.mapData.spaces) {
      const ox = space.offset?.x ?? 0
      const oy = space.offset?.y ?? 0
      maxX = Math.max(maxX, ox + space.width)
      maxY = Math.max(maxY, oy + space.height)
      for (const room of space.rooms ?? []) {
        maxX = Math.max(maxX, ox + room.x + room.width  / 2 + 20)
        maxY = Math.max(maxY, oy + room.y + room.height / 2 + 20)
      }
    }
    this.worldW = maxX + 200
    this.worldH = maxY + 200
  }

  // ── Redraw ────────────────────────────────────────────────────────────────────

  private redrawAll() {
    this.hitAreas = []
    this.labels.forEach(l => l.destroy())
    this.labels = []
    this.bgLayer.clear()
    this.roomLayer.clear()
    this.objLayer.clear()
    this.spawnLayer.clear()

    for (let si = 0; si < this.mapData.spaces.length; si++) {
      this.drawSpace(si)
    }
    this.drawSelectionHighlight()
  }

  private drawSpace(si: number) {
    const space = this.mapData.spaces[si]
    const ox = space.offset?.x ?? 0
    const oy = space.offset?.y ?? 0

    // Piso xadrez
    const ts = space.floor?.tileSize ?? 100
    const cA = this.hexToNum(space.floor?.colorA ?? '#e8e8e8')
    const cB = this.hexToNum(space.floor?.colorB ?? '#f5f5f5')
    for (let tx = 0; tx < space.width; tx += ts) {
      for (let ty = 0; ty < space.height; ty += ts) {
        const col = (Math.floor(tx / ts) + Math.floor(ty / ts)) % 2 === 0 ? cA : cB
        this.bgLayer.fillStyle(col, 1)
        this.bgLayer.fillRect(ox + tx, oy + ty, ts, ts)
      }
    }

    // Grid do espaço
    const gs = this.gridSize
    this.bgLayer.lineStyle(1, 0x444466, 0.25)
    for (let gx = 0; gx <= space.width; gx += gs) {
      this.bgLayer.lineBetween(ox + gx, oy, ox + gx, oy + space.height)
    }
    for (let gy = 0; gy <= space.height; gy += gs) {
      this.bgLayer.lineBetween(ox, oy + gy, ox + space.width, oy + gy)
    }

    // Borda do espaço
    this.bgLayer.lineStyle(4, 0x5555bb, 1)
    this.bgLayer.strokeRect(ox, oy, space.width, space.height)

    // Label do espaço
    this.labels.push(this.add.text(ox + 20, oy + 18, space.name, {
      fontSize: '20px', color: '#ccccff',
      backgroundColor: 'rgba(0,0,20,0.7)', padding: { x: 8, y: 4 },
    }).setDepth(9))

    // Salas
    for (let ri = 0; ri < (space.rooms?.length ?? 0); ri++) {
      this.drawRoom(si, ri)
    }

    // Objetos do espaço
    for (let oi = 0; oi < (space.objects?.length ?? 0); oi++) {
      const obj = space.objects![oi]
      this.drawObject(ox + obj.x, oy + obj.y, obj.type, obj.scale ?? 1, obj.rotation ?? 0, { kind: 'space-obj', si, oi }, 1)
    }

    // Spawn
    this.drawSpawnMarker(si)
  }

  private drawRoom(si: number, ri: number) {
    const space = this.mapData.spaces[si]
    const room  = space.rooms![ri]
    const ox    = space.offset?.x ?? 0
    const oy    = space.offset?.y ?? 0
    const cx    = ox + room.x
    const cy    = oy + room.y
    const rw    = room.width
    const rh    = room.height
    const T     = 12
    const floor = this.hexToNum(room.floorColor ?? '#eeeeee')
    const wall  = this.hexToNum(room.wallColor  ?? '#5d4037')
    const door  = room.door

    // Piso da sala
    this.roomLayer.fillStyle(floor, 1)
    this.roomLayer.fillRect(cx - rw / 2, cy - rh / 2, rw, rh)

    // Paredes com abertura da porta
    const drawHWall = (wy: number, doorCx: number | null, doorW: number) => {
      this.roomLayer.fillStyle(wall, 1)
      if (!doorCx) {
        this.roomLayer.fillRect(cx - rw / 2 - T / 2, wy - T / 2, rw + T, T)
      } else {
        const x0 = cx - rw / 2 - T / 2
        const x1 = cx + rw / 2 + T / 2
        const gl = doorCx - doorW / 2
        const gr = doorCx + doorW / 2
        if (gl > x0) this.roomLayer.fillRect(x0, wy - T / 2, gl - x0, T)
        if (x1 > gr) this.roomLayer.fillRect(gr, wy - T / 2, x1 - gr, T)
      }
    }

    const drawVWall = (wx: number, doorCy: number | null, doorW: number) => {
      this.roomLayer.fillStyle(wall, 1)
      if (!doorCy) {
        this.roomLayer.fillRect(wx - T / 2, cy - rh / 2 - T / 2, T, rh + T)
      } else {
        const y0 = cy - rh / 2 - T / 2
        const y1 = cy + rh / 2 + T / 2
        const gt = doorCy - doorW / 2
        const gb = doorCy + doorW / 2
        if (gt > y0) this.roomLayer.fillRect(wx - T / 2, y0, T, gt - y0)
        if (y1 > gb) this.roomLayer.fillRect(wx - T / 2, gb, T, y1 - gb)
      }
    }

    const dw = door?.width ?? 80
    const dOff = door?.offset ?? 0
    drawHWall(cy - rh / 2, door?.side === 'top'    ? cx + dOff : null, dw)
    drawHWall(cy + rh / 2, door?.side === 'bottom' ? cx + dOff : null, dw)
    drawVWall(cx - rw / 2, door?.side === 'left'   ? cy + dOff : null, dw)
    drawVWall(cx + rw / 2, door?.side === 'right'  ? cy + dOff : null, dw)

    // Label da sala
    this.labels.push(this.add.text(cx, cy - rh / 2 + 14, room.name, {
      fontSize: '12px', color: '#222', fontStyle: 'bold',
      backgroundColor: 'rgba(255,255,255,0.7)', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 0).setDepth(5))

    // Label da porta
    if (door?.label) {
      let dlx = cx, dly = cy
      if (door.side === 'left')   { dlx = cx - rw / 2 - 4; dly = cy + dOff }
      if (door.side === 'right')  { dlx = cx + rw / 2 + 4; dly = cy + dOff }
      if (door.side === 'top')    { dlx = cx + dOff;         dly = cy - rh / 2 - 4 }
      if (door.side === 'bottom') { dlx = cx + dOff;         dly = cy + rh / 2 + 4 }
      this.labels.push(this.add.text(dlx, dly, door.label, {
        fontSize: '10px', color: '#fff',
        backgroundColor: 'rgba(0,0,0,0.65)', padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(9))
    }

    // Hit area da sala (zOrder baixo — atrás dos objetos)
    this.hitAreas.unshift({ wx: cx, wy: cy, hw: rw / 2, hh: rh / 2, item: { kind: 'room', si, ri }, zOrder: 0 })

    // Objetos da sala
    for (let oi = 0; oi < (room.objects?.length ?? 0); oi++) {
      const obj = room.objects![oi]
      this.drawObject(cx + obj.x, cy + obj.y, obj.type, obj.scale ?? 1, obj.rotation ?? 0, { kind: 'room-obj', si, ri, oi }, 2)
    }
  }

  private drawObject(wx: number, wy: number, type: string, scale: number, rotation: number, item: SelectedEditorItem, zOrder: number) {
    const info = objInfo(type)
    const w = info.w * scale
    const h = info.h * scale
    this.objLayer.fillStyle(info.color, 0.9)
    this.objLayer.lineStyle(1, 0x000000, 0.5)
    this.objLayer.fillRect(wx - w / 2, wy - h / 2, w, h)
    this.objLayer.strokeRect(wx - w / 2, wy - h / 2, w, h)

    // Indicador de rotação (seta vermelha a partir do centro)
    if (rotation) {
      const rad = Phaser.Math.DegToRad(rotation)
      const len = Math.min(w, h) / 2 - 2
      this.objLayer.lineStyle(2, 0xff4444, 0.9)
      this.objLayer.lineBetween(wx, wy, wx + Math.sin(rad) * len, wy - Math.cos(rad) * len)
    }

    if (w > 22) {
      this.labels.push(this.add.text(wx, wy, info.label, {
        fontSize: '9px', color: '#fff', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(5))
    }
    this.hitAreas.push({ wx, wy, hw: w / 2, hh: h / 2, item, zOrder })
  }

  private drawSpawnMarker(si: number) {
    const space = this.mapData.spaces[si]
    const sp    = space.spawnPoint
    if (!sp) return
    const ox = space.offset?.x ?? 0
    const oy = space.offset?.y ?? 0
    const wx = ox + sp.x
    const wy = oy + sp.y
    const g  = this.spawnLayer
    g.fillStyle(0x00ff88, 0.35)
    g.fillCircle(wx, wy, 22)
    g.lineStyle(2, 0x00ff88, 1)
    g.strokeCircle(wx, wy, 22)
    g.beginPath()
    g.moveTo(wx, wy - 14).lineTo(wx, wy + 14)
    g.moveTo(wx - 8, wy + 4).lineTo(wx, wy + 14).lineTo(wx + 8, wy + 4)
    g.strokePath()
  }

  private drawSelectionHighlight() {
    this.selLayer.clear()
    if (!this.selectedItem) return
    const b = this.getItemBounds(this.selectedItem)
    if (!b) return
    this.selLayer.lineStyle(2, 0xffffff, 1)
    this.selLayer.fillStyle(0xffffff, 0.18)
    this.selLayer.fillRect(b.cx - b.hw, b.cy - b.hh, b.hw * 2, b.hh * 2)
    this.selLayer.strokeRect(b.cx - b.hw, b.cy - b.hh, b.hw * 2, b.hh * 2)
    const cs = 5
    for (const [ex, ey] of [
      [b.cx - b.hw, b.cy - b.hh], [b.cx + b.hw, b.cy - b.hh],
      [b.cx - b.hw, b.cy + b.hh], [b.cx + b.hw, b.cy + b.hh],
    ]) {
      this.selLayer.fillStyle(0xffffff, 1)
      this.selLayer.fillRect(ex - cs, ey - cs, cs * 2, cs * 2)
    }
  }

  private getItemBounds(item: SelectedEditorItem) {
    const space = this.mapData.spaces[item.si]
    const ox = space?.offset?.x ?? 0
    const oy = space?.offset?.y ?? 0
    if (item.kind === 'room') {
      const room = space?.rooms?.[item.ri]
      if (!room) return null
      return { cx: ox + room.x, cy: oy + room.y, hw: room.width / 2, hh: room.height / 2 }
    }
    if (item.kind === 'room-obj') {
      const room = space?.rooms?.[item.ri]
      const obj  = room?.objects?.[item.oi]
      if (!room || !obj) return null
      const info = objInfo(obj.type); const s = obj.scale ?? 1
      return { cx: ox + room.x + obj.x, cy: oy + room.y + obj.y, hw: info.w * s / 2, hh: info.h * s / 2 }
    }
    if (item.kind === 'space-obj') {
      const obj = space?.objects?.[item.oi]
      if (!obj) return null
      const info = objInfo(obj.type); const s = obj.scale ?? 1
      return { cx: ox + obj.x, cy: oy + obj.y, hw: info.w * s / 2, hh: info.h * s / 2 }
    }
    return null
  }

  // ── Input ────────────────────────────────────────────────────────────────────

  private setupInput() {
    const cam = this.cameras.main

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const rawX = p.worldX, rawY = p.worldY
      const wx = this.snap(rawX), wy = this.snap(rawY)
      this.events.emit('cursor-moved', { wx, wy })
      this.cursorLayer.clear()

      if (this.isDragging && this.selectedItem) {
        this.applyDrag(rawX - this.dragOffX, rawY - this.dragOffY)
        return
      }

      if (this.isDrawingRoom) {
        const sx = this.roomDrawStart.wx, sy = this.roomDrawStart.wy
        const snX = this.snap(rawX), snY = this.snap(rawY)
        const x = Math.min(snX, sx), y = Math.min(snY, sy)
        const w = Math.abs(snX - sx), h = Math.abs(snY - sy)
        this.roomPreviewLayer.clear()
        this.roomPreviewLayer.lineStyle(2, 0xffff00, 1)
        this.roomPreviewLayer.fillStyle(0xffff00, 0.1)
        this.roomPreviewLayer.fillRect(x, y, w, h)
        this.roomPreviewLayer.strokeRect(x, y, w, h)
        return
      }

      if (this.activeTool === 'add-object') {
        const info = objInfo(this.activeObjectType)
        this.cursorLayer.lineStyle(2, 0xffff00, 0.85)
        this.cursorLayer.fillStyle(0xffff00, 0.15)
        this.cursorLayer.fillRect(wx - info.w / 2, wy - info.h / 2, info.w, info.h)
        this.cursorLayer.strokeRect(wx - info.w / 2, wy - info.h / 2, info.w, info.h)
      }
      if (this.activeTool === 'spawn') {
        this.cursorLayer.lineStyle(2, 0x00ff88, 0.9)
        this.cursorLayer.strokeCircle(wx, wy, 22)
      }

    })

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const wx = p.worldX, wy = p.worldY

      if (p.rightButtonDown()) return

      if (this.activeTool === 'select') {
        const hit = this.hitTest(wx, wy)
        if (hit) {
          this.selectedItem = hit.item
          const b = this.getItemBounds(hit.item)!
          this.dragOffX = wx - b.cx
          this.dragOffY = wy - b.cy
          this.isDragging = true
          this.drawSelectionHighlight()
          this.events.emit('item-selected', this.buildItemInfo(hit.item))
        } else {
          this.selectedItem = null
          this.drawSelectionHighlight()
          this.events.emit('item-selected', null)
        }
        return
      }

      if (this.activeTool === 'delete') {
        const hit = this.hitTest(wx, wy)
        if (hit) this.removeItem(hit.item)
        return
      }

      if (this.activeTool === 'add-object') {
        this.placeObject(wx, wy)
        return
      }

      if (this.activeTool === 'add-room') {
        this.isDrawingRoom = true
        this.roomDrawSi = this.spaceIndexAt(wx, wy)
        this.roomDrawStart = { wx: this.snap(wx), wy: this.snap(wy) }
        return
      }

      if (this.activeTool === 'spawn') {
        const si = this.spaceIndexAt(wx, wy)
        const space = this.mapData.spaces[si]
        const ox = space.offset?.x ?? 0
        const oy = space.offset?.y ?? 0
        space.spawnPoint = { x: this.snap(wx - ox), y: this.snap(wy - oy) }
        this.spawnLayer.clear()
        for (let i = 0; i < this.mapData.spaces.length; i++) this.drawSpawnMarker(i)
        this.autoSave()
        this.events.emit('spawn-changed', { si, x: space.spawnPoint.x, y: space.spawnPoint.y })
        return
      }
    })

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonReleased()) return
      const wx = p.worldX, wy = p.worldY

      if (this.isDragging) {
        this.isDragging = false
        this.redrawAll()
        this.autoSave()
        if (this.selectedItem) this.events.emit('item-selected', this.buildItemInfo(this.selectedItem))
        return
      }

      if (this.isDrawingRoom) {
        this.isDrawingRoom = false
        this.roomPreviewLayer.clear()
        const sx = this.roomDrawStart.wx, sy = this.roomDrawStart.wy
        const rw = Math.abs(wx - sx), rh = Math.abs(wy - sy)
        if (rw > 40 && rh > 40) {
          this.promptNewRoom(this.roomDrawSi, Math.min(wx, sx), Math.min(wy, sy), rw, rh)
        }
      }
    })

    // Wheel nativo: trackpad two-finger pan + pinch-to-zoom (ctrlKey)
    this._wheelHandler = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom ou Ctrl+scroll
        const zoom = Phaser.Math.Clamp(cam.zoom - e.deltaY * 0.005, 0.1, 2)
        cam.setZoom(zoom)
      } else {
        // Two-finger scroll / scroll wheel → pan
        cam.scrollX += e.deltaX / cam.zoom
        cam.scrollY += e.deltaY / cam.zoom
      }
    }
    this.game.canvas.addEventListener('wheel', this._wheelHandler, { passive: false })

    // Atalhos de teclado para o item selecionado
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (!this.selectedItem) return
      const item = this.selectedItem

      // R → rotacionar 15° (Shift+R → -15°)
      if (event.key === 'r' || event.key === 'R') {
        if (item.kind === 'room') return
        const obj = this.getObjRef(item)
        if (!obj) return
        const delta = event.shiftKey ? -15 : 15
        obj.rotation = ((obj.rotation ?? 0) + delta) % 360
        this.redrawAll(); this.autoSave()
        this.events.emit('item-selected', this.buildItemInfo(item))
        return
      }

      // Delete / Backspace → deletar
      if (event.key === 'Delete' || event.key === 'Backspace') {
        this.removeItem(item)
        return
      }

      // +/- → escalar
      if (event.key === '+' || event.key === '=') {
        if (item.kind === 'room') return
        const obj = this.getObjRef(item)
        if (!obj) return
        obj.scale = Math.round(((obj.scale ?? 1) + 0.1) * 10) / 10
        this.redrawAll(); this.autoSave()
        this.events.emit('item-selected', this.buildItemInfo(item))
        return
      }
      if (event.key === '-') {
        if (item.kind === 'room') return
        const obj = this.getObjRef(item)
        if (!obj) return
        obj.scale = Math.max(0.1, Math.round(((obj.scale ?? 1) - 0.1) * 10) / 10)
        this.redrawAll(); this.autoSave()
        this.events.emit('item-selected', this.buildItemInfo(item))
        return
      }

      // Setas → mover (1 grid step; Shift = 4× grid)
      const step = event.shiftKey ? this.gridSize * 4 : this.gridSize
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' ||
          event.key === 'ArrowUp'   || event.key === 'ArrowDown') {
        event.preventDefault()
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
        const dy = event.key === 'ArrowUp'   ? -step : event.key === 'ArrowDown'  ? step : 0
        this.nudgeItem(item, dx, dy)
        this.redrawAll(); this.autoSave()
        this.events.emit('item-selected', this.buildItemInfo(item))
      }
    })
  }

  // ── Ações ────────────────────────────────────────────────────────────────────

  private hitTest(wx: number, wy: number): HitArea | null {
    const sorted = [...this.hitAreas].sort((a, b) => b.zOrder - a.zOrder)
    return sorted.find(h =>
      wx >= h.wx - h.hw && wx <= h.wx + h.hw &&
      wy >= h.wy - h.hh && wy <= h.wy + h.hh
    ) ?? null
  }

  private spaceIndexAt(wx: number, wy: number): number {
    for (let i = 0; i < this.mapData.spaces.length; i++) {
      const s = this.mapData.spaces[i]
      const ox = s.offset?.x ?? 0, oy = s.offset?.y ?? 0
      if (wx >= ox && wx <= ox + s.width && wy >= oy && wy <= oy + s.height) return i
    }
    return 0
  }

  private applyDrag(cx: number, cy: number) {
    const item  = this.selectedItem!
    const space = this.mapData.spaces[item.si]
    const ox    = space.offset?.x ?? 0
    const oy    = space.offset?.y ?? 0

    if (item.kind === 'room') {
      const r = space.rooms![item.ri]
      r.x = this.snap(cx - ox); r.y = this.snap(cy - oy)
    } else if (item.kind === 'room-obj') {
      const r = space.rooms![item.ri]
      const o = r.objects![item.oi]
      o.x = this.snap(cx - (ox + r.x)); o.y = this.snap(cy - (oy + r.y))
    } else if (item.kind === 'space-obj') {
      const o = space.objects![item.oi]
      o.x = this.snap(cx - ox); o.y = this.snap(cy - oy)
    }

    this.labels.forEach(l => l.destroy()); this.labels = []
    this.hitAreas = []
    this.bgLayer.clear(); this.roomLayer.clear()
    this.objLayer.clear(); this.spawnLayer.clear()
    for (let si = 0; si < this.mapData.spaces.length; si++) this.drawSpace(si)
    this.drawSelectionHighlight()
  }

  private placeObject(wx: number, wy: number) {
    // verifica se está dentro de uma sala
    const roomHit = [...this.hitAreas]
      .filter(h => h.item.kind === 'room')
      .find(h => wx >= h.wx - h.hw && wx <= h.wx + h.hw && wy >= h.wy - h.hh && wy <= h.wy + h.hh)

    if (roomHit) {
      const { si, ri } = roomHit.item as Extract<SelectedEditorItem, { kind: 'room' }>
      const space = this.mapData.spaces[si]
      const room  = space.rooms![ri]
      const ox    = space.offset?.x ?? 0, oy = space.offset?.y ?? 0
      if (!room.objects) room.objects = []
      room.objects.push({ type: this.activeObjectType, x: this.snap(wx - (ox + room.x)), y: this.snap(wy - (oy + room.y)) })
    } else {
      const si    = this.spaceIndexAt(wx, wy)
      const space = this.mapData.spaces[si]
      const ox    = space.offset?.x ?? 0, oy = space.offset?.y ?? 0
      if (!space.objects) space.objects = []
      space.objects.push({ type: this.activeObjectType, x: this.snap(wx - ox), y: this.snap(wy - oy) })
    }

    this.redrawAll(); this.autoSave()
  }

  private removeItem(item: SelectedEditorItem) {
    const space = this.mapData.spaces[item.si]
    if (item.kind === 'room')      space.rooms?.splice(item.ri, 1)
    if (item.kind === 'room-obj')  space.rooms?.[item.ri]?.objects?.splice(item.oi, 1)
    if (item.kind === 'space-obj') space.objects?.splice(item.oi, 1)
    this.selectedItem = null
    this.events.emit('item-selected', null)
    this.events.emit('rooms-changed')
    this.redrawAll(); this.autoSave()
  }

  private promptNewRoom(si: number, x: number, y: number, rw: number, rh: number) {
    const name = window.prompt('Nome da sala:', 'Nova Sala')
    if (!name?.trim()) return
    const space = this.mapData.spaces[si]
    const ox    = space.offset?.x ?? 0, oy = space.offset?.y ?? 0
    if (!space.rooms) space.rooms = []
    space.rooms.push({
      id: `room-${Date.now()}`,
      name: name.trim(),
      x: this.snap(x - ox + rw / 2),
      y: this.snap(y - oy + rh / 2),
      width: this.snap(rw), height: this.snap(rh),
      floorColor: '#eeeeee', wallColor: '#5d4037',
      objects: [],
    })
    this.redrawAll(); this.autoSave()
    this.events.emit('rooms-changed')
  }

  // ── API pública (para EditorOverlay) ─────────────────────────────────────────

  buildItemInfo(item: SelectedEditorItem): Record<string, any> | null {
    const space = this.mapData.spaces[item.si]
    const ox = space?.offset?.x ?? 0, oy = space?.offset?.y ?? 0
    if (item.kind === 'room') {
      const r = space?.rooms?.[item.ri]
      if (!r) return null
      return { kind: 'room', si: item.si, ri: item.ri,
        name: r.name, x: r.x, y: r.y, width: r.width, height: r.height,
        floorColor: r.floorColor ?? '#eeeeee', wallColor: r.wallColor ?? '#5d4037',
        floorTexture: r.floorTexture ?? '', wallTexture: r.wallTexture ?? '',
        doorSide: r.door?.side ?? '', doorOffset: r.door?.offset ?? 0,
        doorWidth: r.door?.width ?? 80, doorLabel: r.door?.label ?? '',
        worldX: ox + r.x, worldY: oy + r.y }
    }
    if (item.kind === 'room-obj') {
      const r = space?.rooms?.[item.ri], o = r?.objects?.[item.oi]
      if (!r || !o) return null
      return { kind: 'room-obj', si: item.si, ri: item.ri, oi: item.oi,
        type: o.type, x: o.x, y: o.y, scale: o.scale ?? 1, rotation: o.rotation ?? 0,
        worldX: Math.round(ox + r.x + o.x), worldY: Math.round(oy + r.y + o.y) }
    }
    if (item.kind === 'space-obj') {
      const o = space?.objects?.[item.oi]
      if (!o) return null
      return { kind: 'space-obj', si: item.si, oi: item.oi,
        type: o.type, x: o.x, y: o.y, scale: o.scale ?? 1, rotation: o.rotation ?? 0,
        worldX: Math.round(ox + o.x), worldY: Math.round(oy + o.y) }
    }
    return null
  }

  applyItemUpdate(info: Record<string, any>) {
    const space = this.mapData.spaces[info.si]
    if (info.kind === 'room') {
      const r = space?.rooms?.[info.ri]
      if (!r) return
      r.name = info.name; r.x = info.x; r.y = info.y
      r.width = info.width; r.height = info.height
      r.floorColor = info.floorColor; r.wallColor = info.wallColor
      r.floorTexture = info.floorTexture || undefined
      r.wallTexture = info.wallTexture || undefined
      // Porta
      if (info.doorSide) {
        r.door = {
          side: info.doorSide as 'top' | 'bottom' | 'left' | 'right',
          offset: info.doorOffset ?? 0,
          width: info.doorWidth ?? 80,
          label: info.doorLabel || undefined,
        }
      } else {
        r.door = undefined
      }
    } else if (info.kind === 'room-obj') {
      const o = space?.rooms?.[info.ri]?.objects?.[info.oi]
      if (!o) return
      o.x = info.x; o.y = info.y; o.scale = info.scale; o.rotation = info.rotation ?? 0
    } else if (info.kind === 'space-obj') {
      const o = space?.objects?.[info.oi]
      if (!o) return
      o.x = info.x; o.y = info.y; o.scale = info.scale; o.rotation = info.rotation ?? 0
    }
    this.redrawAll(); this.autoSave()
    this.events.emit('rooms-changed')
  }

  applySpaceUpdate(si: number, data: { width?: number; height?: number; floor?: { tileSize?: number; colorA?: string; colorB?: string } }) {
    const space = this.mapData.spaces[si]
    if (!space) return
    if (data.width  != null) space.width  = data.width
    if (data.height != null) space.height = data.height
    if (data.floor) {
      if (!space.floor) space.floor = {}
      if (data.floor.tileSize != null) space.floor.tileSize = data.floor.tileSize
      if (data.floor.colorA != null) space.floor.colorA = data.floor.colorA
      if (data.floor.colorB != null) space.floor.colorB = data.floor.colorB
    }
    this.computeWorldBounds()
    this.cameras.main.setBounds(-100, -100, this.worldW + 200, this.worldH + 200)
    this.redrawAll()
    this.autoSave()
    this.events.emit('rooms-changed')
  }

  setTool(tool: EditorTool) {
    this.activeTool = tool
    if (tool !== 'select') {
      this.selectedItem = null
      this.drawSelectionHighlight()
      this.events.emit('item-selected', null)
    }
  }

  setActiveObjectType(type: string) { this.activeObjectType = type }

  getSpaces() { return this.mapData?.spaces ?? [] }

  focusSpace(si: number) {
    if (!this.mapData) return
    const space = this.mapData.spaces[si]
    const ox = space.offset?.x ?? 0, oy = space.offset?.y ?? 0
    this.cameras.main.setZoom(0.38)
    this.cameras.main.centerOn(ox + space.width / 2, oy + space.height / 2)
  }

  private getObjRef(item: SelectedEditorItem): ObjectDefinition | null {
    const space = this.mapData.spaces[item.si]
    if (item.kind === 'room-obj')  return space?.rooms?.[item.ri]?.objects?.[item.oi] ?? null
    if (item.kind === 'space-obj') return space?.objects?.[item.oi] ?? null
    return null
  }

  private nudgeItem(item: SelectedEditorItem, dx: number, dy: number) {
    const space = this.mapData.spaces[item.si]
    if (item.kind === 'room') {
      const r = space?.rooms?.[item.ri]
      if (r) { r.x += dx; r.y += dy }
    } else if (item.kind === 'room-obj') {
      const o = space?.rooms?.[item.ri]?.objects?.[item.oi]
      if (o) { o.x += dx; o.y += dy }
    } else if (item.kind === 'space-obj') {
      const o = space?.objects?.[item.oi]
      if (o) { o.x += dx; o.y += dy }
    }
  }

  // ── Autosave ─────────────────────────────────────────────────────────────────

  private autoSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.save(), 800)
  }

  async save() {
    await fetch('/api/map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.mapData),
    })
    this.events.emit('map-saved')
  }

  // ── Utilitários ──────────────────────────────────────────────────────────────

  /** Arredonda valor para o grid mais próximo */
  private snap(v: number): number {
    return Math.round(v / this.gridSize) * this.gridSize
  }

  private hexToNum(hex: string): number {
    return parseInt(hex.replace('#', ''), 16)
  }

  setGridSize(size: number) {
    this.gridSize = Math.max(4, size)
    this.redrawAll()
  }

  getGridSize() { return this.gridSize }
}
