'use client'

import { useEffect, useState, useCallback } from 'react'
import type { SpaceDefinition } from '@/game/types/MapDefinition'
import { OBJECT_CATALOG, type EditorTool } from '@/game/scenes/EditorScene'

// Opções de textura disponíveis para pisos e paredes de salas
const FLOOR_TEXTURES = [
  { key: '',              label: 'Cor sólida (padrão)' },
  { key: 'floor_red',    label: 'Vermelho' },
  { key: 'floor_golden', label: 'Dourado' },
  { key: 'floor_teal',   label: 'Teal' },
  { key: 'floor_wood',   label: 'Madeira' },
  { key: 'floor_dark',   label: 'Escuro' },
  { key: 'floor_orange', label: 'Laranja' },
  { key: 'floor_purple', label: 'Roxo' },
  { key: 'floor_gray',   label: 'Cinza' },
  { key: 'floor_ceramic1', label: 'Cerâmica 1' },
  { key: 'floor_ceramic2', label: 'Cerâmica 2' },
  { key: 'floor_mosaic',   label: 'Mosaico' },
  { key: 'floor_herring',  label: 'Espinha Peixe' },
  { key: 'floor_stone',    label: 'Pedra' },
  { key: 'floor_slate',    label: 'Ardósia' },
]

const WALL_TEXTURES = [
  { key: '',                label: 'Cor sólida (padrão)' },
  { key: 'wall_base',      label: 'Neutro' },
  { key: 'wall_red',       label: 'Vermelho' },
  { key: 'wall_yellow',    label: 'Amarelo' },
  { key: 'wall_teal',      label: 'Teal' },
  { key: 'wall_brown',     label: 'Marrom' },
  { key: 'wall_darkbrown', label: 'Marrom Escuro' },
  { key: 'wall_orange',    label: 'Laranja' },
  { key: 'wall_purple',    label: 'Roxo' },
  { key: 'wall_gray',      label: 'Cinza' },
  { key: 'wall_red_alt',   label: 'Vermelho Alt.' },
  { key: 'wall_yellow_alt',label: 'Amarelo Alt.' },
  { key: 'wall_teal_alt',  label: 'Teal Alt.' },
  { key: 'wall_brown_alt', label: 'Marrom Alt.' },
]

interface EditorOverlayProps {
  sceneRef: React.MutableRefObject<any>
  onClose: () => void
}

const TOOLS: { id: EditorTool; label: string; tip: string }[] = [
  { id: 'select',     label: '🖱 Selecionar',     tip: 'Clique para selecionar e arrastar objetos/salas' },
  { id: 'add-object', label: '➕ Add Objeto',      tip: 'Clique para adicionar o objeto selecionado' },
  { id: 'add-room',   label: '🚪 Nova Sala',       tip: 'Arraste para desenhar uma nova sala' },
  { id: 'spawn',      label: '🟢 Spawn',           tip: 'Clique para definir ponto de início do jogador' },
  { id: 'delete',     label: '🗑 Deletar',         tip: 'Clique em qualquer objeto/sala para remover' },
]

// ── estilos ───────────────────────────────────────────────────────────────────

const S = {
  panel: (): React.CSSProperties => ({
    position: 'fixed', top: 0, left: 0,
    width: 270, height: '100vh',
    background: 'rgba(8,8,22,0.98)',
    color: '#eee', fontFamily: 'sans-serif', fontSize: 13,
    display: 'flex', flexDirection: 'column',
    borderRight: '1px solid #2a2a55',
    zIndex: 1500, boxSizing: 'border-box',
    overflowY: 'auto',
  }),
  sec: (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '9px 12px', borderBottom: '1px solid #1a1a38', ...extra,
  }),
  title: (): React.CSSProperties => ({
    fontSize: 10, color: '#5566aa', letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 6,
  }),
  btn: (active: boolean, accent = '#2980b9'): React.CSSProperties => ({
    background: active ? accent : '#14142c',
    border: `1px solid ${active ? accent : '#252548'}`,
    color: active ? '#fff' : '#ccc',
    padding: '5px 8px', borderRadius: 5, cursor: 'pointer',
    fontSize: 12, textAlign: 'left', transition: 'background 0.12s',
  }),
  numInput: (): React.CSSProperties => ({
    width: 60, background: '#10102a', border: '1px solid #333366',
    color: '#fff', borderRadius: 4, padding: '3px 6px',
    fontSize: 12, textAlign: 'center' as const,
  }),
  textInput: (flex = false): React.CSSProperties => ({
    ...(flex ? { flex: 1 } : { width: '100%' }),
    background: '#10102a', border: '1px solid #333366',
    color: '#fff', borderRadius: 4, padding: '3px 6px',
    fontSize: 12, boxSizing: 'border-box' as const,
  }),
  applyBtn: (): React.CSSProperties => ({
    background: '#1a5c8a', border: '1px solid #2a8ac4', color: '#fff',
    borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontSize: 11,
    whiteSpace: 'nowrap' as const,
  }),
  delBtn: (): React.CSSProperties => ({
    background: '#5c1a1a', border: '1px solid #c0392b', color: '#fff',
    borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontSize: 11,
  }),
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function EditorOverlay({ sceneRef, onClose }: EditorOverlayProps) {
  const [activeTool,   setActiveTool]   = useState<EditorTool>('select')
  const [activeObj,    setActiveObj]    = useState('workstation')
  const [inspector,    setInspector]    = useState<Record<string, any> | null>(null)
  const [spaces,       setSpaces]       = useState<SpaceDefinition[]>([])
  const [cursorPos,    setCursorPos]    = useState({ wx: 0, wy: 0 })
  const [savedMsg,     setSavedMsg]     = useState(false)

  // ── inspector fields ──────────────────────────────────────────────────────
  const [fName, setFName] = useState('')
  const [fX, setFX]       = useState('')
  const [fY, setFY]       = useState('')
  const [fW, setFW]       = useState('')
  const [fH, setFH]       = useState('')
  const [fScale, setFScale] = useState('')
  const [fFloor, setFFloor] = useState('')
  const [fWall,  setFWall]  = useState('')
  const [fFloorTex, setFFloorTex] = useState('')
  const [fWallTex,  setFWallTex]  = useState('')
  const [fRotation, setFRotation] = useState('')
  const [fDoorSide, setFDoorSide] = useState('')
  const [fDoorOff, setFDoorOff]   = useState('0')
  const [fDoorW, setFDoorW]       = useState('80')
  const [fDoorLabel, setFDoorLabel] = useState('')

  // estado de edição inline de espaços
  const [editingSpace, setEditingSpace] = useState<number | null>(null)
  const [spW, setSpW]       = useState('')
  const [spH, setSpH]       = useState('')
  const [spTile, setSpTile] = useState('')
  const [spCA, setSpCA]     = useState('')
  const [spCB, setSpCB]     = useState('')

  const scene = useCallback(
    () => sceneRef.current as import('@/game/scenes/EditorScene').default | null,
    [sceneRef],
  )

  // Sincroniza inputs quando inspector muda
  const syncFields = useCallback((info: Record<string, any> | null) => {
    if (!info) return
    setFName(info.name  ?? '')
    setFX(String(info.x ?? 0))
    setFY(String(info.y ?? 0))
    setFW(String(info.width  ?? ''))
    setFH(String(info.height ?? ''))
    setFScale(String(info.scale ?? 1))
    setFFloor(info.floorColor ?? '')
    setFWall(info.wallColor ?? '')
    setFFloorTex(info.floorTexture ?? '')
    setFWallTex(info.wallTexture ?? '')
    setFRotation(String(info.rotation ?? 0))
    setFDoorSide(info.doorSide ?? '')
    setFDoorOff(String(info.doorOffset ?? 0))
    setFDoorW(String(info.doorWidth ?? 80))
    setFDoorLabel(info.doorLabel ?? '')
  }, [])

  // ── Eventos da cena ───────────────────────────────────────────────────────

  useEffect(() => {
    const s = scene()
    if (!s) return

    const onCursor  = (p: { wx: number; wy: number }) => setCursorPos(p)
    const onSaved   = () => { setSavedMsg(true); setTimeout(() => setSavedMsg(false), 1600) }
    const onItem    = (info: Record<string, any> | null) => {
      setInspector(info)
      syncFields(info)
    }
    const onRooms = () => setSpaces([...s.getSpaces()])
    const onReady = () => setSpaces([...s.getSpaces()])

    s.events.on('cursor-moved', onCursor)
    s.events.on('map-saved',    onSaved)
    s.events.on('item-selected', onItem)
    s.events.on('rooms-changed', onRooms)
    s.events.on('scene-ready',   onReady)

    // Se mapData já carregou (cena já estava pronta), sincroniza agora
    if (s.getSpaces().length > 0) setSpaces([...s.getSpaces()])

    return () => {
      s.events.off('cursor-moved', onCursor)
      s.events.off('map-saved',    onSaved)
      s.events.off('item-selected', onItem)
      s.events.off('rooms-changed', onRooms)
      s.events.off('scene-ready',   onReady)
    }
  }, [scene, syncFields])

  // ── Ações ─────────────────────────────────────────────────────────────────

  function selectTool(tool: EditorTool) {
    setActiveTool(tool)
    scene()?.setTool(tool)
  }

  function selectObj(type: string) {
    setActiveObj(type)
    scene()?.setActiveObjectType(type)
    selectTool('add-object')
  }

  function applyInspector() {
    if (!inspector) return
    const updated = {
      ...inspector,
      name:       fName,
      x:          parseInt(fX,  10) || 0,
      y:          parseInt(fY,  10) || 0,
      ...(inspector.kind === 'room'
        ? { width: parseInt(fW, 10) || 100, height: parseInt(fH, 10) || 100,
            floorColor: fFloor, wallColor: fWall,
            floorTexture: fFloorTex, wallTexture: fWallTex,
            doorSide: fDoorSide, doorOffset: parseInt(fDoorOff, 10) || 0,
            doorWidth: parseInt(fDoorW, 10) || 80, doorLabel: fDoorLabel }
        : { scale: parseFloat(fScale) || 1, rotation: parseFloat(fRotation) || 0 }),
    }
    scene()?.applyItemUpdate(updated)
    setInspector(updated)
  }

  function deleteInspected() {
    if (!inspector) return
    const s = scene()
    if (!s) return
    // Recria item ref e deleta pelo removeItem público
    const item = inspector.kind === 'room'      ? { kind: 'room',      si: inspector.si, ri: inspector.ri }
               : inspector.kind === 'room-obj'  ? { kind: 'room-obj',  si: inspector.si, ri: inspector.ri, oi: inspector.oi }
               : inspector.kind === 'space-obj' ? { kind: 'space-obj', si: inspector.si, oi: inspector.oi }
               : null
    if (item) (s as any).removeItem(item)
    setInspector(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div 
      style={S.panel()}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      onKeyPress={(e) => e.stopPropagation()}
    >

      {/* Cabeçalho */}
      <div style={{ ...S.sec(), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 14 }}>🗺 Editor de Mapa</strong>
        <button onClick={onClose} style={{
          background: '#c0392b', border: 'none', color: '#fff',
          borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontSize: 12,
        }}>✕</button>
      </div>

      {/* Ferramentas */}
      <div style={S.sec()}>
        <div style={S.title()}>Ferramentas</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {TOOLS.map(t => (
            <button key={t.id} title={t.tip} onClick={() => selectTool(t.id)}
              style={{
                ...S.btn(activeTool === t.id, t.id === 'spawn' ? '#1a5c3a' : t.id === 'delete' ? '#6b1a1a' : undefined),
                ...(t.id === 'spawn' && activeTool === t.id ? { color: '#00ff88' } : {}),
              }}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* Grid snap */}
      <div style={{ ...S.sec(), display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: '#5566aa', textTransform: 'uppercase', letterSpacing: 1 }}>Grid</span>
        {[8, 16, 32, 64].map(g => (
          <button key={g} onClick={() => { scene()?.setGridSize(g) }}
            style={{
              ...S.btn(scene()?.getGridSize() === g),
              padding: '3px 7px', fontSize: 11, minWidth: 30,
            }}
          >{g}</button>
        ))}
      </div>

      {/* Catálogo de objetos (visível apenas na ferramenta add-object) */}
      {activeTool === 'add-object' && (
        <div style={{ ...S.sec(), maxHeight: '40vh', overflowY: 'auto' }}>
          <div style={S.title()}>Tipo de Objeto</div>
          {(() => {
            const groups: Record<string, typeof OBJECT_CATALOG> = {}
            OBJECT_CATALOG.forEach(o => {
              if (!groups[o.category]) groups[o.category] = []
              groups[o.category].push(o)
            })
            return Object.entries(groups).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: '#667eaa', marginBottom: 3, fontWeight: 'bold' }}>{cat}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {items.map(o => (
                    <button key={o.type} onClick={() => selectObj(o.type)}
                      style={S.btn(activeObj === o.type)}>{o.label}</button>
                  ))}
                </div>
              </div>
            ))
          })()}
        </div>
      )}

      {/* Inspector */}
      {inspector && (
        <div style={{ ...S.sec(), background: '#08081e', borderLeft: '3px solid #2a8ac4' }}>
          <div style={S.title()}>
            {inspector.kind === 'room' ? '🚪 Sala'
              : inspector.kind === 'room-obj' ? '📦 Objeto da Sala'
              : '📦 Objeto do Espaço'}
          </div>

          {/* Tipo do objeto */}
          {inspector.kind !== 'room' && (
            <div style={{ fontSize: 11, color: '#99aacc', marginBottom: 6 }}>
              Tipo: <strong>{inspector.type}</strong>
            </div>
          )}

          {/* Nome da sala */}
          {inspector.kind === 'room' && (
            <div style={{ marginBottom: 5 }}>
              <label style={{ fontSize: 10, color: '#778', display: 'block', marginBottom: 2 }}>Nome</label>
              <input style={S.textInput()} value={fName}
                onChange={e => setFName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyInspector()} />
            </div>
          )}

          {/* Posição X/Y */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5 }}>
            {[['X (rel)', fX, setFX], ['Y (rel)', fY, setFY]].map(([lbl, val, set]) => (
              <div key={String(lbl)} style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: '#778', display: 'block', marginBottom: 2 }}>{String(lbl)}</label>
                <input style={S.numInput()} value={String(val)}
                  onChange={e => (set as (v: string) => void)(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyInspector()} />
              </div>
            ))}
          </div>

          {/* Largura/Altura (sala) ou Escala (objeto) */}
          {inspector.kind === 'room' ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5 }}>
              {[['Largura', fW, setFW], ['Altura', fH, setFH]].map(([lbl, val, set]) => (
                <div key={String(lbl)} style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: '#778', display: 'block', marginBottom: 2 }}>{String(lbl)}</label>
                  <input style={S.numInput()} value={String(val)}
                    onChange={e => (set as (v: string) => void)(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyInspector()} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: '#778', display: 'block', marginBottom: 2 }}>Escala</label>
                <input style={S.numInput()} value={fScale}
                  onChange={e => setFScale(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyInspector()} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: '#778', display: 'block', marginBottom: 2 }}>Rotacao (°)</label>
                <input style={S.numInput()} value={fRotation}
                  onChange={e => setFRotation(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyInspector()} />
              </div>
            </div>
          )}

          {/* Cores da sala */}
          {inspector.kind === 'room' && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
              {[['Piso', fFloor, setFFloor], ['Parede', fWall, setFWall]].map(([lbl, val, set]) => (
                <div key={String(lbl)} style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: '#778', display: 'block', marginBottom: 2 }}>{String(lbl)}</label>
                  <input type="color" value={String(val) || '#eeeeee'}
                    onChange={e => (set as (v: string) => void)(e.target.value)}
                    style={{ width: '100%', height: 24, border: 'none', borderRadius: 3, cursor: 'pointer', background: 'none' }} />
                </div>
              ))}
            </div>
          )}

          {/* Texturas de piso e parede (sala) */}
          {inspector.kind === 'room' && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: '#778', display: 'block', marginBottom: 2 }}>Textura Piso</label>
                <select value={fFloorTex} onChange={e => { setFFloorTex(e.target.value); }}
                  style={{ ...S.textInput(), fontSize: 11, padding: '3px 4px' }}>
                  {FLOOR_TEXTURES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: '#778', display: 'block', marginBottom: 2 }}>Textura Parede</label>
                <select value={fWallTex} onChange={e => { setFWallTex(e.target.value); }}
                  style={{ ...S.textInput(), fontSize: 11, padding: '3px 4px' }}>
                  {WALL_TEXTURES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Porta (sala) */}
          {inspector.kind === 'room' && (
            <div style={{ marginBottom: 5, borderTop: '1px solid #1a1a38', paddingTop: 6 }}>
              <div style={{ fontSize: 10, color: '#5566aa', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Porta</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: '#778', display: 'block', marginBottom: 2 }}>Lado</label>
                  <select value={fDoorSide} onChange={e => setFDoorSide(e.target.value)}
                    style={{ ...S.textInput(), fontSize: 11, padding: '3px 4px' }}>
                    <option value="">Sem porta</option>
                    <option value="top">Cima</option>
                    <option value="bottom">Baixo</option>
                    <option value="left">Esquerda</option>
                    <option value="right">Direita</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: '#778', display: 'block', marginBottom: 2 }}>Largura</label>
                  <input style={S.numInput()} value={fDoorW}
                    onChange={e => setFDoorW(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyInspector()} />
                </div>
              </div>
              {fDoorSide && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, color: '#778', display: 'block', marginBottom: 2 }}>Offset</label>
                    <input style={S.numInput()} value={fDoorOff}
                      onChange={e => setFDoorOff(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && applyInspector()} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, color: '#778', display: 'block', marginBottom: 2 }}>Label</label>
                    <input style={S.textInput()} value={fDoorLabel}
                      onChange={e => setFDoorLabel(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && applyInspector()} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Posição no mundo (só leitura) */}
          <div style={{ fontSize: 10, color: '#445', marginBottom: 6 }}>
            🌍 Mundo: ({inspector.worldX}, {inspector.worldY}) px
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={applyInspector} style={S.applyBtn()}>✓ Aplicar</button>
            <button onClick={deleteInspected} style={S.delBtn()}>🗑 Apagar</button>
          </div>
        </div>
      )}

      {/* Espaços / Salas */}
      <div style={{ ...S.sec(), flex: 1 }}>
        <div style={S.title()}>Espaços & Salas</div>
        {spaces.map((space, si) => (
          <div key={space.id} style={{ marginBottom: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#0e0e26', borderRadius: 5, padding: '5px 8px', marginBottom: 4,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 'bold', fontSize: 12, color: '#aabbff' }}>
                  {space.name}
                </div>
                <div style={{ fontSize: 10, color: '#556' }}>
                  {space.width}x{space.height}px
                </div>
              </div>
              <button onClick={() => {
                if (editingSpace === si) { setEditingSpace(null); return }
                setEditingSpace(si)
                setSpW(String(space.width))
                setSpH(String(space.height))
                setSpTile(String(space.floor?.tileSize ?? 100))
                setSpCA(space.floor?.colorA ?? '#e8e8e8')
                setSpCB(space.floor?.colorB ?? '#f5f5f5')
              }} style={{
                background: editingSpace === si ? '#5c4a1a' : '#1a2a5a',
                border: `1px solid ${editingSpace === si ? '#c49a2a' : '#3a5aba'}`,
                color: editingSpace === si ? '#ffd' : '#aabbff',
                borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 10,
              }}>{editingSpace === si ? '✕ Fechar' : '⚙ Editar'}</button>
              <button onClick={() => scene()?.focusSpace(si)} style={{
                background: '#1a2a5a', border: '1px solid #3a5aba', color: '#aabbff',
                borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 10,
              }}>📍 Ir</button>
            </div>

            {/* Edição inline do espaço */}
            {editingSpace === si && (
              <div style={{
                background: '#0a0a1e', border: '1px solid #333366', borderRadius: 5,
                padding: '8px 10px', marginBottom: 6, marginLeft: 4,
              }}>
                <div style={{ fontSize: 10, color: '#5566aa', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                  Dimensoes do Espaco
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, color: '#778', display: 'block', marginBottom: 2 }}>Largura (px)</label>
                    <input style={{ ...S.numInput(), width: '100%' }} value={spW} onChange={e => setSpW(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, color: '#778', display: 'block', marginBottom: 2 }}>Altura (px)</label>
                    <input style={{ ...S.numInput(), width: '100%' }} value={spH} onChange={e => setSpH(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, color: '#778', display: 'block', marginBottom: 2 }}>Tam. Tile</label>
                    <input style={{ ...S.numInput(), width: '100%' }} value={spTile} onChange={e => setSpTile(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, color: '#778', display: 'block', marginBottom: 2 }}>Piso A</label>
                    <input type="color" value={spCA} onChange={e => setSpCA(e.target.value)}
                      style={{ width: '100%', height: 24, border: 'none', borderRadius: 3, cursor: 'pointer', background: 'none' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, color: '#778', display: 'block', marginBottom: 2 }}>Piso B</label>
                    <input type="color" value={spCB} onChange={e => setSpCB(e.target.value)}
                      style={{ width: '100%', height: 24, border: 'none', borderRadius: 3, cursor: 'pointer', background: 'none' }} />
                  </div>
                </div>
                <button onClick={() => {
                  scene()?.applySpaceUpdate(si, {
                    width:  parseInt(spW, 10) || space.width,
                    height: parseInt(spH, 10) || space.height,
                    floor: { tileSize: parseInt(spTile, 10) || 100, colorA: spCA, colorB: spCB },
                  })
                }} style={S.applyBtn()}>✓ Aplicar</button>
              </div>
            )}
            {(space.rooms ?? []).map((room, ri) => (
              <div key={room.id} style={{
                background: '#0c0c20', borderRadius: 4, padding: '4px 8px',
                marginBottom: 2, marginLeft: 8,
                borderLeft: `3px solid ${room.wallColor ?? '#5d4037'}`,
                display: 'flex', alignItems: 'center', gap: 6,
                outline: inspector?.kind === 'room' && inspector.si === si && inspector.ri === ri
                  ? '1px solid #3a9ad9' : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#ddd', fontWeight: 'bold',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {room.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#556' }}>
                    cx:{room.x} cy:{room.y} · {room.width}×{room.height}px ·{' '}
                    {room.objects?.length ?? 0} obj
                  </div>
                </div>
              </div>
            ))}
            <div style={{ marginLeft: 8, fontSize: 10, color: '#445' }}>
              {space.objects?.length ?? 0} objetos soltos · spawn ({space.spawnPoint?.x},{space.spawnPoint?.y})
            </div>
          </div>
        ))}
      </div>

      {/* Barra inferior: coordenadas */}
      <div style={{
        padding: '7px 12px', borderTop: '1px solid #1a1a38',
        display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#445',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'monospace', color: '#667' }}>
          {cursorPos.wx}px, {cursorPos.wy}px
        </span>
        <span style={{ textAlign: 'right', lineHeight: 1.4 }}>
          Dir/Mid: pan · Scroll: pan<br/>
          Ctrl+Scroll: zoom · R: rot
        </span>
      </div>

      {savedMsg && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#27ae60', color: '#fff', padding: '6px 18px',
          borderRadius: 20, fontSize: 13, pointerEvents: 'none', zIndex: 2000,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>💾 Mapa salvo!</div>
      )}
    </div>
  )
}
