'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  FLOOR_TYPES,
  FURNITURE_CATALOG,
  type Room,
} from '@/game/scenes/EditorScene'

type Tool = 'select' | 'floor' | 'erase-floor' | 'room' | 'furniture' | 'erase-furniture'

interface EditorOverlayProps {
  sceneRef: React.MutableRefObject<any>   // referência à EditorScene
  onClose: () => void
}

const TOOLS: { id: Tool; label: string; tip: string }[] = [
  { id: 'select',          label: '🖱 Selecionar',     tip: 'Arrastar móveis' },
  { id: 'floor',           label: '🎨 Pintar Piso',    tip: 'Clicar/arrastar tiles' },
  { id: 'erase-floor',     label: '🧹 Apagar Piso',    tip: 'Remover tiles' },
  { id: 'room',            label: '🚪 Criar Sala',     tip: 'Arrastar retângulo' },
  { id: 'furniture',       label: '🪑 Colocar Móvel',  tip: 'Clicar para posicionar' },
  { id: 'erase-furniture', label: '🗑 Apagar Móvel',   tip: 'Clicar no móvel' },
]

export default function EditorOverlay({ sceneRef, onClose }: EditorOverlayProps) {
  const [activeTool, setActiveTool]         = useState<Tool>('select')
  const [activeFloor, setActiveFloor]       = useState(FLOOR_TYPES[0].key)
  const [activeFurniture, setActiveFurniture] = useState(FURNITURE_CATALOG[0].type)
  const [rooms, setRooms]                   = useState<Room[]>([])
  const [savedFeedback, setSavedFeedback]   = useState(false)
  const [editingRoom, setEditingRoom]       = useState<string | null>(null)
  const [editingName, setEditingName]       = useState('')

  // sincroniza com a cena
  const scene = useCallback(() => sceneRef.current as import('@/game/scenes/EditorScene').default | null, [sceneRef])

  // ouvir eventos da cena
  useEffect(() => {
    const s = scene()
    if (!s) return

    const onRoomsChanged = () => setRooms([...s.getRooms()])
    const onSaved = () => {
      setSavedFeedback(true)
      setTimeout(() => setSavedFeedback(false), 1600)
    }

    s.events.on('rooms-changed', onRoomsChanged)
    s.events.on('map-saved', onSaved)
    setRooms([...s.getRooms()])

    return () => {
      s.events.off('rooms-changed', onRoomsChanged)
      s.events.off('map-saved', onSaved)
    }
  }, [scene])

  function selectTool(tool: Tool) {
    setActiveTool(tool)
    scene()?.setActiveTool(tool)
  }

  function selectFloor(key: string) {
    setActiveFloor(key)
    scene()?.setActiveFloor(key)
    selectTool('floor')
  }

  function selectFurniture(type: string) {
    setActiveFurniture(type)
    scene()?.setActiveFurniture(type)
    selectTool('furniture')
  }

  function deleteRoom(id: string) {
    scene()?.deleteRoom(id)
    setRooms(prev => prev.filter(r => r.id !== id))
  }

  function startRenameRoom(r: Room) {
    setEditingRoom(r.id)
    setEditingName(r.name)
  }

  function confirmRename(id: string) {
    if (editingName.trim()) {
      scene()?.renameRoom(id, editingName.trim())
      setRooms(prev => prev.map(r => r.id === id ? { ...r, name: editingName.trim() } : r))
    }
    setEditingRoom(null)
  }

  // ── estilos inline (sem CSS externo para não poluir) ──────────────────────

  const panel: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0,
    width: 248, height: '100vh',
    background: 'rgba(12, 12, 28, 0.97)',
    color: '#eee', fontFamily: 'sans-serif', fontSize: 13,
    display: 'flex', flexDirection: 'column',
    borderRight: '1px solid #2a2a55',
    zIndex: 1500, boxSizing: 'border-box',
    overflowY: 'auto',
  }

  const section: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid #1e1e3a',
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: 10, color: '#6677aa', letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 7,
  }

  const btn = (active: boolean, color?: string): React.CSSProperties => ({
    background: active ? (color || '#2980b9') : '#1a1a3a',
    border: active ? `1px solid ${color || '#3a9ad9'}` : '1px solid #2a2a55',
    color: '#fff', padding: '6px 8px', borderRadius: 6,
    cursor: 'pointer', fontSize: 12, textAlign: 'left',
    transition: 'background 0.15s',
  })

  return (
    <div style={panel}>
      {/* cabeçalho */}
      <div style={{ ...section, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 14 }}>🗺 Editor de Mapa</strong>
        <button onClick={onClose} style={{
          background: '#c0392b', border: 'none', color: '#fff',
          borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontSize: 12,
        }}>✕ Fechar</button>
      </div>

      {/* ferramentas */}
      <div style={section}>
        <div style={sectionTitle}>Ferramentas</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {TOOLS.map(t => (
            <button
              key={t.id}
              title={t.tip}
              onClick={() => selectTool(t.id)}
              style={btn(activeTool === t.id)}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* pisos */}
      <div style={section}>
        <div style={sectionTitle}>Tipo de Piso</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {FLOOR_TYPES.map(f => (
            <button
              key={f.key}
              onClick={() => selectFloor(f.key)}
              style={{
                ...btn(activeFloor === f.key, `#${f.color.toString(16).padStart(6, '0')}`),
                borderLeft: `4px solid #${f.color.toString(16).padStart(6, '0')}`,
              }}
            >{f.label}</button>
          ))}
        </div>
      </div>

      {/* móveis */}
      <div style={section}>
        <div style={sectionTitle}>Móveis</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {FURNITURE_CATALOG.map(f => (
            <button
              key={f.type}
              onClick={() => selectFurniture(f.type)}
              style={{
                ...btn(activeFurniture === f.type && activeTool === 'furniture'),
                borderLeft: `4px solid #${f.color.toString(16).padStart(6, '0')}`,
              }}
            >{f.label} <span style={{ opacity: 0.5, fontSize: 10 }}>{f.w}×{f.h}</span></button>
          ))}
        </div>
      </div>

      {/* salas */}
      <div style={{ ...section, flex: 1 }}>
        <div style={sectionTitle}>Salas ({rooms.length})</div>
        {rooms.length === 0 && (
          <div style={{ color: '#445', fontSize: 11 }}>
            Nenhuma sala. Use a ferramenta 🚪 para criar.
          </div>
        )}
        {rooms.map(r => (
          <div key={r.id} style={{
            background: '#0e0e22', borderRadius: 6, padding: '6px 8px',
            marginBottom: 4, borderLeft: `3px solid ${r.color}`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {editingRoom === r.id ? (
              <>
                <input
                  autoFocus
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') confirmRename(r.id)
                    if (e.key === 'Escape') setEditingRoom(null)
                  }}
                  style={{
                    flex: 1, background: '#1a1a3a', border: '1px solid #3a3a6a',
                    color: '#fff', borderRadius: 4, padding: '2px 6px', fontSize: 12,
                  }}
                />
                <button onClick={() => confirmRename(r.id)} style={{
                  background: '#27ae60', border: 'none', color: '#fff',
                  borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 11,
                }}>✓</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, color: r.color, fontWeight: 'bold', fontSize: 12 }}>{r.name}</span>
                <button onClick={() => startRenameRoom(r)} title="Renomear" style={{
                  background: 'none', border: 'none', color: '#aaa',
                  cursor: 'pointer', fontSize: 13, padding: '0 2px',
                }}>✏️</button>
                <button onClick={() => deleteRoom(r.id)} title="Apagar sala" style={{
                  background: 'none', border: 'none', color: '#e74c3c',
                  cursor: 'pointer', fontSize: 13, padding: '0 2px',
                }}>✕</button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* dicas + feedback */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid #1e1e3a', fontSize: 11, color: '#445' }}>
        🖱 Btn direito: mover câmera &nbsp;|&nbsp; Scroll: zoom
      </div>

      {savedFeedback && (
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
