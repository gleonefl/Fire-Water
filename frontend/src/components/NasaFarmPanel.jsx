import { useEffect, useState } from 'react'

const DEFAULT_LAT = -21.1775
const DEFAULT_LON = -47.8099

function riskColor(level) {
  if (level === 'LOW') return '#00ff88'
  if (level === 'MODERATE') return '#ffd700'
  if (level === 'HIGH') return '#ff6b00'
  if (level === 'SEVERE') return '#ff2d55'
  return '#9ca3af'
}

function fmt(value, digits, suffix = '') {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toFixed(digits)}${suffix}`
}

export default function NasaFarmPanel({ lat = DEFAULT_LAT, lon = DEFAULT_LON, firms = null, firmsLoading = false }) {
  const [power, setPower] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 20000)
    let cancelled = false
    setLoading(true)

    fetch(`/api/nasa/power?lat=${lat}&lon=${lon}&days=30`, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error('power')
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setPower(data)
      })
      .catch(() => {
        if (!cancelled) setPower({ ok: false, summary: {}, farm_climate_risk: { level: 'UNKNOWN' } })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
        clearTimeout(timer)
      })

    return () => {
      cancelled = true
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [lat, lon])

  const summary = power?.summary || {}
  const risk = power?.farm_climate_risk || {}
  const level = risk.level || 'UNKNOWN'
  const firmsOk = firms?.ok === true
  const fireCount = firmsOk ? firms.count : firms ? '—' : null

  return (
    <div className="cyber-panel p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest">NASA Farm Panel</p>
        <span className="text-[9px] text-cyber-cyan">{loading ? '…' : power?.ok ? 'POWER' : 'offline'}</span>
      </div>
      <p className="text-[10px] text-gray-500 mb-2">
        Ribeirão Preto cane belt · {Number(lat).toFixed(3)}, {Number(lon).toFixed(3)}
      </p>

      <div className="flex flex-col gap-1.5 text-[11px]">
        <Row label="30-day rain" value={loading ? '…' : fmt(summary.precip_total_mm, 1, ' mm')} />
        <Row label="Temperature" value={loading ? '…' : fmt(summary.t2m_mean_c, 1, ' °C')} />
        <Row
          label="Root-zone soil moisture"
          value={loading ? '…' : summary.gwetroot_mean == null ? '—' : `${fmt(summary.gwetroot_mean, 2)} (${Math.round(summary.gwetroot_mean * 100)}%)`}
        />
      </div>

      <div className="mt-2 px-2 py-1.5 rounded border border-gray-800 bg-gray-900/40">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest">Farm Climate Risk</span>
          <span className="text-[12px] font-bold" style={{ color: riskColor(level) }}>{loading ? '…' : level}</span>
        </div>
        {!loading && (
          <p className="text-[10px] text-gray-500 mt-1">
            {risk.primary === 'drought_stress' && 'Drought stress'}
            {risk.primary === 'waterlogging' && 'Waterlogging'}
            {risk.primary === 'favorable' && 'Favorable'}
            {(!risk.primary || risk.primary === 'unavailable') && 'Unavailable'}
            {risk.drought_stress != null && ` · drought ${risk.drought_stress}`}
            {risk.waterlogging != null && ` · waterlogging ${risk.waterlogging}`}
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-gray-400">FIRMS fire count</span>
        <span className="text-orange-400 font-bold">
          {firmsLoading && fireCount == null ? '…' : fireCount}
          {firms && !firmsOk && <span className="text-gray-500 font-normal"> simulated</span>}
        </span>
      </div>

      <p className="text-[9px] text-gray-600 mt-2 leading-relaxed">
        Drought: low GWETROOT + low rain + high T2M_MAX. Waterlogging: high rain + high GWETTOP.
        Window ends 5 days ago.
      </p>
      <p className="text-[10px] text-gray-400 mt-1">Source: NASA POWER / NASA FIRMS</p>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-400">{label}</span>
      <span className="text-cyber-cyan font-bold text-right">{value}</span>
    </div>
  )
}
