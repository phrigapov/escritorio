'use client'

import { useEffect, useRef, useState } from 'react'

interface PerfData {
  fps: number
  memUsedMB: number
  memLimitMB: number
  memPct: number
  domNodes: number
  ping: number        // ms, -1 = ainda não medido
  jsErrors: number    // contador de erros JS
}

// ── Limiares de alerta ────────────────────────────────────────────────────────
const THRESHOLDS = {
  fps:      { warn: 45, crit: 30  },   // abaixo = problema
  memPct:   { warn: 60, crit: 80  },   // % do heap limit — acima = problema
  memUsed:  { warn: 150, crit: 300 },  // MB — acima = problema
  domNodes: { warn: 2000, crit: 5000 }, // acima = problema
  ping:     { warn: 100, crit: 200 },  // ms — acima = problema
}

function metricColor(
  value: number,
  thr: { warn: number; crit: number },
  lowerIsBad = false,
): string {
  if (lowerIsBad) {
    if (value <= thr.crit) return '#ff4d4d'
    if (value <= thr.warn) return '#ffaa00'
    return '#4ade80'
  }
  if (value >= thr.crit) return '#ff4d4d'
  if (value >= thr.warn) return '#ffaa00'
  return '#4ade80'
}

// ── Linha de métrica ──────────────────────────────────────────────────────────
function MetricRow({
  icon,
  label,
  value,
  color,
  limitLabel,
}: {
  icon: string
  label: string
  value: string
  color: string
  limitLabel: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <span style={{ color: '#aaa', minWidth: 90 }}>
        {icon} {label}
      </span>
      <span style={{ color, fontWeight: 'bold', marginLeft: 8 }}>{value}</span>
      <span style={{ color: '#555', fontSize: 10, marginLeft: 8 }}>{limitLabel}</span>
    </div>
  )
}

// ── Barra de progresso ────────────────────────────────────────────────────────
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div
      style={{
        height: 3,
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.min(pct, 100)}%`,
          background: color,
          borderRadius: 2,
          transition: 'width 0.5s, background 0.5s',
        }}
      />
    </div>
  )
}

interface PerfMonitorProps {
  visible?: boolean
}

export default function PerfMonitor({ visible = true }: PerfMonitorProps) {
  const [open, setOpen] = useState(false)
  const [perf, setPerf] = useState<PerfData>({
    fps: 0,
    memUsedMB: 0,
    memLimitMB: 0,
    memPct: 0,
    domNodes: 0,
    ping: -1,
    jsErrors: 0,
  })

  const frameCount  = useRef(0)
  const lastTime    = useRef(typeof performance !== 'undefined' ? performance.now() : 0)
  const jsErrors    = useRef(0)
  const pingRef     = useRef(-1)

  useEffect(() => {
    // Contador de erros JS globais
    const onError = () => { jsErrors.current++ }
    window.addEventListener('error', onError)

    // Contagem de frames
    let rafId: number
    const tick = () => {
      frameCount.current++
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    // Ping via evento customizado emitido pelo MainScene
    const onPing = (e: Event) => {
      pingRef.current = (e as CustomEvent<{ latency: number }>).detail.latency
    }
    window.addEventListener('perf-ping', onPing)

    // Atualiza métricas a cada segundo
    const interval = setInterval(() => {
      const now     = performance.now()
      const elapsed = now - lastTime.current
      const fps     = elapsed > 0 ? Math.round((frameCount.current / elapsed) * 1000) : 0
      frameCount.current = 0
      lastTime.current   = now

      const mem        = (performance as any).memory
      const memUsedMB  = mem ? Math.round(mem.usedJSHeapSize  / 1048576) : 0
      const memLimitMB = mem ? Math.round(mem.jsHeapSizeLimit / 1048576) : 0
      const memPct     = memLimitMB > 0 ? Math.round((memUsedMB / memLimitMB) * 100) : 0
      const domNodes   = document.querySelectorAll('*').length

      setPerf({
        fps,
        memUsedMB,
        memLimitMB,
        memPct,
        domNodes,
        ping: pingRef.current,
        jsErrors: jsErrors.current,
      })
    }, 1000)

    return () => {
      cancelAnimationFrame(rafId)
      clearInterval(interval)
      window.removeEventListener('error', onError)
      window.removeEventListener('perf-ping', onPing)
    }
  }, [])

  // Cor do botão toggle — reflete o status geral (pior das métricas)
  const hasWarning =
    perf.fps     <= THRESHOLDS.fps.warn       ||
    perf.memPct  >= THRESHOLDS.memPct.warn    ||
    perf.domNodes >= THRESHOLDS.domNodes.warn ||
    (perf.ping >= 0 && perf.ping >= THRESHOLDS.ping.warn)

  const hasCritical =
    perf.fps     <= THRESHOLDS.fps.crit       ||
    perf.memPct  >= THRESHOLDS.memPct.crit    ||
    perf.domNodes >= THRESHOLDS.domNodes.crit ||
    (perf.ping >= 0 && perf.ping >= THRESHOLDS.ping.crit)

  const toggleColor = hasCritical ? '#ff4d4d' : hasWarning ? '#ffaa00' : '#4ade80'

  const fpsColor  = metricColor(perf.fps,      THRESHOLDS.fps,      true)
  const memColor  = metricColor(perf.memPct,   THRESHOLDS.memPct)
  const domColor  = metricColor(perf.domNodes, THRESHOLDS.domNodes)
  const pingColor = perf.ping < 0 ? '#555' : metricColor(perf.ping, THRESHOLDS.ping)

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 52,
        right: 12,
        zIndex: 8500,
        fontFamily: '"Courier New", monospace',
        fontSize: 12,
        userSelect: 'none',
        pointerEvents: 'all',
      }}
    >
      {/* Botão toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Monitor de Desempenho"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          marginLeft: 'auto',
          background: 'rgba(0,0,0,0.78)',
          border: `1px solid ${toggleColor}55`,
          color: '#fff',
          borderRadius: 6,
          padding: '4px 10px',
          cursor: 'pointer',
          fontSize: 11,
          backdropFilter: 'blur(4px)',
        }}
      >
        <span style={{ color: toggleColor, fontSize: 9 }}>●</span>
        <span>Monitor</span>
        <span style={{ opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Painel expandido */}
      {open && (
        <div
          style={{
            marginTop: 4,
            background: 'rgba(10,10,10,0.88)',
            border: `1px solid rgba(255,255,255,0.12)`,
            borderRadius: 8,
            padding: '12px 14px',
            minWidth: 240,
            backdropFilter: 'blur(6px)',
          }}
        >
          {/* Cabeçalho */}
          <div
            style={{
              color: '#888',
              fontSize: 10,
              marginBottom: 10,
              textTransform: 'uppercase',
              letterSpacing: 1,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              paddingBottom: 6,
            }}
          >
            Desempenho do Navegador
          </div>

          {/* FPS */}
          <MetricRow
            icon="🎯"
            label="FPS"
            value={`${perf.fps}`}
            color={fpsColor}
            limitLabel={`mín ${THRESHOLDS.fps.warn}`}
          />
          <ProgressBar
            pct={Math.min((perf.fps / 60) * 100, 100)}
            color={fpsColor}
          />

          {/* Memória */}
          <MetricRow
            icon="🧠"
            label="Memória"
            value={
              perf.memLimitMB > 0
                ? `${perf.memUsedMB} MB (${perf.memPct}%)`
                : `${perf.memUsedMB} MB`
            }
            color={memColor}
            limitLabel={`≤ ${THRESHOLDS.memPct.warn}%`}
          />
          {perf.memLimitMB > 0 && (
            <ProgressBar pct={perf.memPct} color={memColor} />
          )}

          {/* Nós DOM */}
          <MetricRow
            icon="🌳"
            label="Nós DOM"
            value={`${perf.domNodes.toLocaleString('pt-BR')}`}
            color={domColor}
            limitLabel={`≤ ${THRESHOLDS.domNodes.warn.toLocaleString('pt-BR')}`}
          />
          <ProgressBar
            pct={(perf.domNodes / THRESHOLDS.domNodes.crit) * 100}
            color={domColor}
          />

          {/* Ping */}
          <MetricRow
            icon="🌐"
            label="Ping"
            value={perf.ping < 0 ? '…' : `${perf.ping} ms`}
            color={pingColor}
            limitLabel={`≤ ${THRESHOLDS.ping.warn}ms`}
          />
          {perf.ping >= 0 && (
            <ProgressBar
              pct={(perf.ping / THRESHOLDS.ping.crit) * 100}
              color={pingColor}
            />
          )}

          {/* Erros JS */}
          {perf.jsErrors > 0 && (
            <MetricRow
              icon="⚠️"
              label="Erros JS"
              value={`${perf.jsErrors}`}
              color="#ff4d4d"
              limitLabel="0"
            />
          )}

          {/* Legenda */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              marginTop: 10,
              paddingTop: 8,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              fontSize: 10,
              color: '#555',
            }}
          >
            <span><span style={{ color: '#4ade80' }}>●</span> Normal</span>
            <span><span style={{ color: '#ffaa00' }}>●</span> Alerta</span>
            <span><span style={{ color: '#ff4d4d' }}>●</span> Crítico</span>
          </div>
        </div>
      )}
    </div>
  )
}
