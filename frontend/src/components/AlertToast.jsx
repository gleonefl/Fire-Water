import { useEffect, useRef, useState } from 'react'

const ALERT_CONFIG = {
  info:     { icon: '▶',  color: '#00f5ff', border: 'rgba(0,245,255,0.4)',  bg: 'rgba(0,245,255,0.06)' },
  warning:  { icon: '⚠',  color: '#ffd700', border: 'rgba(255,215,0,0.4)',  bg: 'rgba(255,215,0,0.06)' },
  danger:   { icon: '☠',  color: '#ff2d55', border: 'rgba(255,45,85,0.5)',  bg: 'rgba(255,45,85,0.08)' },
  fire:     { icon: '🔥', color: '#ff6b00', border: 'rgba(255,107,0,0.5)', bg: 'rgba(255,107,0,0.08)' },
  success:  { icon: '✔',  color: '#00ff88', border: 'rgba(0,255,136,0.4)', bg: 'rgba(0,255,136,0.06)' },
}

export default function AlertToast({ alerts, onDismiss }) {
  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '380px' }}>
      {alerts.map((alert) => (
        <Toast key={alert.id} alert={alert} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function Toast({ alert, onDismiss }) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef(null)

  const cfg = ALERT_CONFIG[alert.type] ?? ALERT_CONFIG.info

  useEffect(() => {
    // Entry animation
    requestAnimationFrame(() => setVisible(true))

    // Auto-dismiss after duration
    const dur = alert.duration ?? 5000
    timerRef.current = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onDismiss(alert.id), 400)
    }, dur)

    return () => clearTimeout(timerRef.current)
  }, [alert, onDismiss])

  return (
    <div
      className="pointer-events-auto font-mono"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderLeft: `3px solid ${cfg.color}`,
        borderRadius: '6px',
        padding: '10px 14px',
        backdropFilter: 'blur(16px)',
        boxShadow: `0 0 20px ${cfg.bg}, 0 4px 12px rgba(0,0,0,0.5)`,
        transform: visible && !exiting ? 'translateX(0)' : 'translateX(-120%)',
        opacity: visible && !exiting ? 1 : 0,
        transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease',
        maxWidth: '100%',
      }}
    >
      <div className="flex items-start gap-2">
        <span style={{ color: cfg.color, fontSize: '14px', lineHeight: '1.3' }}>{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <p style={{ color: cfg.color, fontSize: '10px', letterSpacing: '0.15em', marginBottom: '2px' }}
            className="uppercase font-bold">
            {alert.title}
          </p>
          <p className="text-gray-400 text-[11px] leading-snug">{alert.message}</p>
        </div>
        <button
          onClick={() => { setExiting(true); setTimeout(() => onDismiss(alert.id), 300) }}
          className="text-gray-600 hover:text-gray-300 text-xs ml-1 shrink-0"
          style={{ lineHeight: 1 }}
        >
          ✕
        </button>
      </div>
      {/* Progress bar */}
      <div className="mt-2 h-px rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full"
          style={{
            background: cfg.color,
            animation: `toastProgress ${alert.duration ?? 5000}ms linear forwards`,
            opacity: 0.6,
          }}
        />
      </div>
    </div>
  )
}
