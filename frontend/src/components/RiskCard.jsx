const STATUS_CONFIG = {
  SEGURO: {
    color: '#00ff88',
    shadow: '0 0 20px rgba(0, 255, 136, 0.5)',
    bg: 'rgba(0, 255, 136, 0.05)',
    border: 'rgba(0, 255, 136, 0.3)',
    bar: 'linear-gradient(90deg, #00ff88, #00cc6a)',
    label: '✔ SEGURO',
  },
  MODERADO: {
    color: '#ffd700',
    shadow: '0 0 20px rgba(255, 215, 0, 0.5)',
    bg: 'rgba(255, 215, 0, 0.05)',
    border: 'rgba(255, 215, 0, 0.3)',
    bar: 'linear-gradient(90deg, #ffd700, #ff9500)',
    label: '⚡ MODERADO',
  },
  ALTO: {
    color: '#ff6b00',
    shadow: '0 0 20px rgba(255, 107, 0, 0.5)',
    bg: 'rgba(255, 107, 0, 0.05)',
    border: 'rgba(255, 107, 0, 0.3)',
    bar: 'linear-gradient(90deg, #ff6b00, #ff3300)',
    label: '⚠ ALTO',
  },
  CRÍTICO: {
    color: '#ff2d55',
    shadow: '0 0 20px rgba(255, 45, 85, 0.6)',
    bg: 'rgba(255, 45, 85, 0.08)',
    border: 'rgba(255, 45, 85, 0.4)',
    bar: 'linear-gradient(90deg, #ff2d55, #ff0040)',
    label: '☠ CRÍTICO',
  },
}

export default function RiskCard({ data }) {
  const status = data?.status ?? 'SEGURO'
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.SEGURO
  const score = Math.round((data?.risk_score ?? 0) * 100)
  const floodProb = data?.flood_probability ?? score

  return (
    <div
      className="rounded-lg p-4 font-mono text-sm transition-all duration-500"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        boxShadow: cfg.shadow,
      }}
    >
      {/* Header do card */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest">
          Score de Viabilidade
        </p>
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: cfg.color, textShadow: `0 0 8px ${cfg.color}` }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Score circular */}
      <div className="flex items-center gap-4 mb-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
          style={{
            border: `3px solid ${cfg.color}`,
            boxShadow: `0 0 16px ${cfg.color}`,
            color: cfg.color,
          }}
        >
          {score}
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-gray-500 mb-1">Probabilidade de Inundação</p>
          <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${floodProb}%`,
                background: cfg.bar,
                boxShadow: `0 0 8px ${cfg.color}`,
              }}
            />
          </div>
          <p className="text-[11px] mt-1" style={{ color: cfg.color }}>
            {floodProb}%
          </p>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Metric label="Altitude" value={`${data?.altitude?.toFixed(0) ?? '—'} m`} />
        <Metric label="Chuva 7d" value={`${data?.precipitation_7d ?? '—'} mm`} />
        <Metric label="Dist. Rio" value={`${data?.distance_to_water ?? '—'} km`} />
        <Metric label="Risco" value={`${score}%`} highlight={cfg.color} />
      </div>

      <div
        className="mt-3 h-px w-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${cfg.color}60, transparent)`,
        }}
      />

      <p className="text-[10px] text-gray-600 mt-2 text-center uppercase tracking-widest">
        AQUACITIES 3D // ANÁLISE DE RISCO
      </p>
    </div>
  )
}

function Metric({ label, value, highlight }) {
  return (
    <div className="bg-black/40 rounded px-2 py-1.5 border border-white/5">
      <p className="text-gray-500 text-[9px] uppercase tracking-wider">{label}</p>
      <p
        className="text-white font-bold mt-0.5"
        style={highlight ? { color: highlight } : {}}
      >
        {value}
      </p>
    </div>
  )
}
