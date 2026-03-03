import { useState } from 'react'

// Busca endereço por CEP via ViaCEP (100% grátis, sem token)
async function fetchCEP(cep) {
  const clean = cep.replace(/\D/g, '')
  if (clean.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
    const data = await res.json()
    if (data.erro) return null
    return data
  } catch { return null }
}

// Geocodifica endereço via Nominatim/OpenStreetMap (grátis)
async function geocodeAddress(address) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(address + ', Ribeirão Preto, SP')}&format=json&limit=1`,
      { headers: { 'User-Agent': 'AquaCities3D/1.0' } }
    )
    const data = await res.json()
    if (data.length === 0) return null
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display: data[0].display_name }
  } catch { return null }
}

export default function AddressSearch({ onLocationFound, onAlert }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [report, setReport] = useState(null)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setResult(null)
    setReport(null)

    const clean = query.replace(/\D/g, '')
    let addr = null

    // Tenta CEP primeiro
    if (clean.length === 8) {
      const cepData = await fetchCEP(clean)
      if (cepData) {
        const fullAddr = `${cepData.logradouro}, ${cepData.bairro}, ${cepData.localidade}`
        const geo = await geocodeAddress(fullAddr)
        if (geo) {
          addr = { ...geo, cep: cepData }
        }
      }
    }

    // Se não achou por CEP, tenta geocodificação direta
    if (!addr) {
      const geo = await geocodeAddress(query)
      if (geo) addr = geo
    }

    if (addr) {
      setResult(addr)
      onLocationFound?.({ lat: addr.lat, lon: addr.lon })

      // Gera relatório simulado de risco para o endereço
      const distCreek = calcDistToCreek(addr.lat, addr.lon)
      const elev = estimateElevation(addr.lat, addr.lon)
      const floodRisk = Math.min(1, Math.max(0, (1 - distCreek / 2) * 0.6 + (1 - elev / 600) * 0.4))
      const fireRisk = Math.min(1, Math.max(0, (elev / 600) * 0.5 + Math.random() * 0.3))
      const commercialScore = Math.min(1, Math.max(0, (1 - floodRisk) * 0.7 + (distCreek > 0.5 ? 0.3 : 0.1)))

      setReport({
        floodRisk,
        fireRisk,
        commercialScore,
        elevation: elev,
        distCreek,
        status: floodRisk < 0.33 ? 'SEGURO' : floodRisk < 0.66 ? 'MODERADO' : 'ALTO RISCO',
      })

      onAlert?.({
        type: floodRisk > 0.66 ? 'danger' : floodRisk > 0.33 ? 'warning' : 'success',
        title: 'Análise Concluída',
        message: `Risco de inundação: ${(floodRisk * 100).toFixed(0)}% — ${addr.display?.split(',').slice(0, 2).join(',')}`,
      })
    } else {
      onAlert?.({ type: 'warning', title: 'Não encontrado', message: 'Endereço/CEP não localizado. Tente com mais detalhes.' })
    }

    setLoading(false)
  }

  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">
        Busca por CEP ou Endereço
      </p>

      <div className="flex gap-1.5 mb-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="CEP ou endereço..."
          className="cyber-input flex-1 text-[11px]"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="cyber-btn text-[10px] px-3 py-1 disabled:opacity-40"
        >
          {loading ? '...' : '🔎'}
        </button>
      </div>

      {/* Resultado da busca */}
      {result && (
        <div className="bg-gray-900/50 rounded p-2 mb-2 text-[10px]">
          <p className="text-gray-500">Localizado:</p>
          <p className="text-gray-300 truncate">{result.display ?? `${result.lat.toFixed(5)}, ${result.lon.toFixed(5)}`}</p>
          {result.cep && (
            <p className="text-gray-500 mt-1">
              {result.cep.logradouro}, {result.cep.bairro} — {result.cep.localidade}/{result.cep.uf}
            </p>
          )}
        </div>
      )}

      {/* Mini-relatório de risco */}
      {report && (
        <div className="bg-gray-900/40 rounded border border-gray-800 p-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Relatório de Risco</p>

          <div className="flex flex-col gap-1.5">
            <RiskBar label="Inundação" value={report.floodRisk}
              color={report.floodRisk < 0.33 ? '#00ff88' : report.floodRisk < 0.66 ? '#ffd700' : '#ff2d55'} />
            <RiskBar label="Incêndio" value={report.fireRisk}
              color={report.fireRisk < 0.33 ? '#00ff88' : report.fireRisk < 0.66 ? '#ffd700' : '#ff6b00'} />
            <RiskBar label="Viabilidade" value={report.commercialScore}
              color={report.commercialScore > 0.66 ? '#00ff88' : report.commercialScore > 0.33 ? '#ffd700' : '#ff2d55'} />
          </div>

          <div className="grid grid-cols-2 gap-1 mt-2 text-[10px]">
            <div className="text-gray-500">Elevação: <span className="text-cyber-cyan">{report.elevation.toFixed(0)}m</span></div>
            <div className="text-gray-500">Dist. córrego: <span className="text-cyber-cyan">{report.distCreek.toFixed(2)}km</span></div>
          </div>

          <div className="mt-2 text-center">
            <span
              className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded"
              style={{
                color: report.floodRisk < 0.33 ? '#00ff88' : report.floodRisk < 0.66 ? '#ffd700' : '#ff2d55',
                background: `${report.floodRisk < 0.33 ? 'rgba(0,255,136,0.08)' : report.floodRisk < 0.66 ? 'rgba(255,215,0,0.08)' : 'rgba(255,45,85,0.08)'}`,
                border: `1px solid ${report.floodRisk < 0.33 ? 'rgba(0,255,136,0.3)' : report.floodRisk < 0.66 ? 'rgba(255,215,0,0.3)' : 'rgba(255,45,85,0.3)'}`,
              }}
            >
              {report.status}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function RiskBar({ label, value, color }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-gray-500">{label}</span>
        <span style={{ color }} className="font-bold">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value * 100}%`, background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
    </div>
  )
}

// ── Helpers de cálculo local ──────────────────────────────────────────────────
function calcDistToCreek(lat, lon) {
  // Córrego principal de RP corre diag. SW→NE
  const creekLat = -21.183 + (lon + 47.812) * 0.25
  const dLat = (lat - creekLat) * 111.32
  const dLon = 0 // simplificação: distância perpendicular
  return Math.abs(dLat)
}

function estimateElevation(lat, lon) {
  // Simulação: centro de RP ~540m, vales ~510m
  const dist = calcDistToCreek(lat, lon)
  return 510 + dist * 20 + (Math.sin(lon * 100) * 5)
}
