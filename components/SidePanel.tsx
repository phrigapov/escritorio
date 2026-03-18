'use client'

import { useCallback, useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'

const DEFAULT_WIDTH = 380
const MIN_WIDTH = 280
const MAX_WIDTH = 900

interface SidePanelProps {
  children: React.ReactNode
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  className?: string
}

export default function SidePanel({
  children,
  defaultWidth = DEFAULT_WIDTH,
  minWidth = MIN_WIDTH,
  maxWidth = MAX_WIDTH,
  className = '',
}: SidePanelProps) {
  const [panelWidth, setPanelWidth] = useState(defaultWidth)
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(defaultWidth)

  const onResizeStart = useCallback((e: React.PointerEvent) => {
    isResizing.current = true
    startX.current = e.clientX
    startWidth.current = panelWidth
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [panelWidth])

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!isResizing.current) return
    const delta = startX.current - e.clientX
    const clampedMax = Math.min(maxWidth, window.innerWidth * 0.85)
    const newWidth = Math.max(minWidth, Math.min(clampedMax, startWidth.current + delta))
    setPanelWidth(newWidth)
  }, [minWidth, maxWidth])

  const onResizeEnd = useCallback(() => {
    isResizing.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  return (
    <div
      className={`relative flex shrink-0 flex-col overflow-hidden border-l border-border bg-background text-foreground ${className}`}
      style={{ width: panelWidth }}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
    >
      {/* Drag handle */}
      <div
        className="absolute inset-y-0 left-0 w-1.5 z-10 cursor-col-resize hover:bg-accent active:bg-accent transition-colors flex items-center"
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
      >
        <GripVertical className="size-3 text-muted-foreground opacity-0 hover:opacity-100 transition-opacity" />
      </div>

      {children}
    </div>
  )
}
