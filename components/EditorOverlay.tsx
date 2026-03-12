'use client'

import { useEffect, useState, useCallback } from 'react'
import type { SpaceDefinition } from '@/game/types/MapDefinition'
import { OBJECT_CATALOG, type EditorTool } from '@/game/scenes/EditorScene'

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
            floorColor: fFloor, wallColor: fWall }
        : { scale: parseFloat(fScale) || 1 }),
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

      {/* Catálogo de objetos (visível apenas na ferramenta add-object) */}
      {activeTool === 'add-object' && (
        <div style={S.sec()}>
          <div style={S.title()}>Tipo de Objeto</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {OBJECT_CATALOG.map(o => (
              <button key={o.type} onClick={() => selectObj(o.type)}
                style={S.btn(activeObj === o.type)}>{o.label}</button>
            ))}
          </div>
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
              <label style={{ fontSize: 10, color: '#778' }}>Escala</label>
              <input style={S.numInput()} value={fScale}
                onChange={e => setFScale(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyInspector()} />
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
              <span style={{ flex: 1, fontWeight: 'bold', fontSize: 12, color: '#aabbff' }}>
                {space.name}
              </span>
              <button onClick={() => scene()?.focusSpace(si)} style={{
                background: '#1a2a5a', border: '1px solid #3a5aba', color: '#aabbff',
                borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 10,
              }}>📍 Ir</button>
            </div>
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
        <span>🖱 Dir: pan &nbsp; Scroll: zoom</span>
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
