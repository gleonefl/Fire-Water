import { useState } from 'react'
import RiskCard from './RiskCard'
import WeatherPanel from './WeatherPanel'
import AddressSearch from './AddressSearch'
import axios from 'axios'

export default function Sidebar({
  waterLevel,
  onWaterLevelChange,
  selectedCoord,
  riskData,
  setRiskData,
  isLoading,
  setIsLoading,
  activeModule,
  fireActive,
  onFireToggle,
  weather,
  weatherLoading,
  onLocationFound,
  onAlert,
}) {
  const [precipitation, setPrecipitation] = useState(80)
  const [impermeability, setImpermeability] = useState(0.7)

  // Cálculo local do risco: Risco = (P × C_imp) / Altitude
  const estimatedRisk = selectedCoord
    ? Math.min(
        ((precipitation * impermeability) / Math.max(waterLevel || 1, 1)) * 0.1,
        1
      )
    : null

  const fetchRiskData = async () => {
    if (!selectedCoord) return
    setIsLoading(true)
    try {
      const res = await axios.get('/api/flood/risk', {
        params: {
          lat: selectedCoord.lat,
          lon: selectedCoord.lon,
          water_level: waterLevel,
        },
      })
      setRiskData(res.data)
    } catch {
      // Fallback com dados simulados quando backend não está rodando
      setRiskData({
        risk_score: estimatedRisk ?? 0.42,
        altitude: 540 - Math.random() * 30,
        flood_probability: Math.round((estimatedRisk ?? 0.42) * 100),
        precipitation_7d: precipitation,
        distance_to_water: (Math.random() * 2 + 0.1).toFixed(2),
        status: getRiskStatus(estimatedRisk ?? 0.42),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <aside className="absolute top-16 right-4 bottom-4 w-80 flex flex-col gap-3 z-10 overflow-y-auto">
      {/* ── Painel principal ── */}
      <div className="cyber-panel p-4 flex flex-col gap-4">
        {/* Header */}
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">
            Sistema // Módulo ativo
          </p>
          <h2 className="cyber-text-cyan text-base font-bold uppercase tracking-wider">
            {activeModule === 'flood' ? '[ Flood Map 3D ]' : activeModule === 'wildfire' ? '[ Wildfire Sim ]' : '[ GeoMarketing ]'}
          </h2>
          <div className="neon-divider mt-2" />
        </div>

        {/* ── Slider: Nível da Água ── */}
        {activeModule === 'flood' && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[11px] text-gray-400 uppercase tracking-widest">
                Nível de Inundação
              </label>
              <span className="cyber-text-cyan text-sm font-bold">
                {waterLevel.toFixed(1)}m
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              step={0.5}
              value={waterLevel}
              onChange={(e) => onWaterLevelChange(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>0m — Seco</span>
              <span>50m — Crítico</span>
            </div>

            {/* Barra de nível visual */}
            <div className="mt-3 h-2 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(waterLevel / 50) * 100}%`,
                  background: waterLevel < 15
                    ? 'linear-gradient(90deg, #00f5ff, #0088ff)'
                    : waterLevel < 30
                    ? 'linear-gradient(90deg, #ffd700, #ff6b00)'
                    : 'linear-gradient(90deg, #ff6b00, #ff2d55)',
                  boxShadow: waterLevel > 0
                    ? `0 0 8px ${waterLevel < 15 ? '#00f5ff' : waterLevel < 30 ? '#ffd700' : '#ff2d55'}`
                    : 'none',
                }}
              />
            </div>

            {/* Alert de nível */}
            {waterLevel > 0 && (
              <div
                className={`mt-3 px-3 py-2 rounded text-[11px] border font-bold uppercase tracking-wider ${
                  waterLevel < 15
                    ? 'border-cyber-cyan/40 text-cyber-cyan bg-cyber-cyan/5'
                    : waterLevel < 30
                    ? 'border-yellow-500/40 text-yellow-400 bg-yellow-500/5'
                    : 'border-red-500/40 text-red-400 bg-red-500/10 animate-pulse'
                }`}
              >
                {waterLevel < 5 && '▶ Nível baixo — sem risco'}
                {waterLevel >= 5 && waterLevel < 15 && '⚠ Atenção — monitorar'}
                {waterLevel >= 15 && waterLevel < 30 && '⚡ Alerta — risco moderado'}
                {waterLevel >= 30 && '☠ CRÍTICO — EVACUAÇÃO'}
              </div>
            )}

            {/* Boto de Fogo */}
            <div className="mt-3">
              <button
                onClick={onFireToggle}
                className={`w-full py-2 px-3 rounded text-[11px] uppercase tracking-widest font-bold border transition-all duration-300 ${
                  fireActive
                    ? 'border-orange-500 text-orange-400 bg-orange-500/10 shadow-orange animate-pulse'
                    : 'border-gray-700 text-gray-500 hover:border-orange-700 hover:text-orange-600'
                }`}
              >
                {fireActive ? '🔥 FOGO ATIVO — DESLIGAR' : '🔥 SIMULAR INCÊNDIO'}
              </button>
              {fireActive && (
                <p className="text-[10px] text-orange-400/70 mt-1 text-center">
                  Fumaça persiste ao desligar
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Parâmetros de Risco ── */}
        {activeModule === 'flood' && (
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">
              Parâmetros do Cálculo
            </p>

            <div className="flex flex-col gap-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-400">Precipitação (mm)</span>
                  <span className="text-cyber-orange">{precipitation} mm</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={300}
                  step={5}
                  value={precipitation}
                  onChange={(e) => setPrecipitation(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-400">Impermeabilidade</span>
                  <span className="text-cyber-orange">{(impermeability * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={impermeability}
                  onChange={(e) => setImpermeability(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Fórmula */}
            <div className="mt-3 p-2 bg-gray-900/60 rounded border border-gray-800 text-[10px] text-gray-500 font-mono">
              <span className="text-gray-400">Risco</span> ={' '}
              <span className="text-cyber-cyan">(P × C)</span> /{' '}
              <span className="text-cyber-orange">Alt</span>
              {estimatedRisk !== null && (
                <span className="ml-2 text-white">
                  ≈{' '}
                  <span
                    className={
                      estimatedRisk < 0.33
                        ? 'text-cyber-green'
                        : estimatedRisk < 0.66
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    }
                  >
                    {(estimatedRisk * 100).toFixed(1)}%
                  </span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Busca de endereço (GeoMarketing) ── */}
        {activeModule === 'geomarketing' && (
          <AddressSearch onLocationFound={onLocationFound} onAlert={onAlert} />
        )}

        {/* ── Módulo Wildfire ── */}
        {activeModule === 'wildfire' && (
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">
              Simulação de Incêndio Urbano
            </p>

            <button
              onClick={onFireToggle}
              className={`w-full py-2.5 px-3 rounded text-[11px] uppercase tracking-widest font-bold border transition-all duration-300 ${
                fireActive
                  ? 'border-orange-500 text-orange-400 bg-orange-500/10 shadow-orange animate-pulse'
                  : 'border-gray-700 text-gray-500 hover:border-orange-700 hover:text-orange-600'
              }`}
            >
              {fireActive ? '🔥 FOGO ATIVO — DESLIGAR' : '🔥 INICIAR SIMULAÇÃO'}
            </button>

            {fireActive && (
              <>
                <p className="text-[10px] text-orange-400/70 mt-1 text-center">
                  Fumaça persiste ao desligar
                </p>

                {/* Stats do incêndio */}
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  <div className="bg-gray-900/50 rounded p-2 text-center">
                    <p className="text-[9px] text-gray-600 uppercase">Focos</p>
                    <p className="text-orange-400 text-sm font-bold">12</p>
                  </div>
                  <div className="bg-gray-900/50 rounded p-2 text-center">
                    <p className="text-[9px] text-gray-600 uppercase">Área</p>
                    <p className="text-orange-400 text-sm font-bold">3.2 km²</p>
                  </div>
                  <div className="bg-gray-900/50 rounded p-2 text-center">
                    <p className="text-[9px] text-gray-600 uppercase">Temperatura</p>
                    <p className="text-red-400 text-sm font-bold">~800°C</p>
                  </div>
                  <div className="bg-gray-900/50 rounded p-2 text-center">
                    <p className="text-[9px] text-gray-600 uppercase">Risco</p>
                    <p className="text-red-400 text-sm font-bold animate-pulse">ALTO</p>
                  </div>
                </div>
              </>
            )}

            {/* Legenda de queimadas */}
            <div className="mt-3 p-2 bg-gray-900/40 rounded border border-gray-800">
              <p className="text-[10px] text-gray-500 mb-1.5">Tipos de incêndio</p>
              <div className="flex flex-col gap-1">
                {[
                  { color: '#ff6b00', label: 'Fogo ativo (chamas)' },
                  { color: '#ff2d55', label: 'Zona de calor extremo' },
                  { color: 'rgba(100,100,100,0.6)', label: 'Fumaça / pós-combustão' },
                  { color: '#ffd700', label: 'Faíscas / propagação' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2 text-[10px]">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
                    <span className="text-gray-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Coordenada selecionada ── */}
      {selectedCoord && (
        <div className="cyber-panel p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">
            Ponto Selecionado
          </p>
          <div className="flex gap-3 text-[11px]">
            <div>
              <span className="text-gray-500">LAT </span>
              <span className="text-cyber-cyan">{selectedCoord.lat.toFixed(5)}</span>
            </div>
            <div>
              <span className="text-gray-500">LON </span>
              <span className="text-cyber-cyan">{selectedCoord.lon.toFixed(5)}</span>
            </div>
          </div>

          <button
            onClick={fetchRiskData}
            disabled={isLoading}
            className="cyber-btn w-full mt-3 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="animate-pulse">Calculando...</span>
            ) : (
              'Calcular Risco'
            )}
          </button>
        </div>
      )}

      {/* ── Score de Viabilidade Comercial ── */}
      {riskData && (
        <RiskCard data={riskData} />
      )}

      {/* ── Painel meteorológico em tempo real ── */}
      {(activeModule === 'flood' || activeModule === 'wildfire') && (
        <WeatherPanel weather={weather} loading={weatherLoading} />
      )}

      {/* ── Databricks Status ── */}
      <div className="cyber-panel p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Databricks</p>
          <span className="text-[9px] text-gray-600 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500/60" />
            Config pendente
          </span>
        </div>
        <p className="text-[10px] text-gray-600 mt-1">
          Conecte ao Databricks Community Edition para persistir análises.
          Acesse <span className="text-cyber-cyan">/api/db/setup-ddl</span> para instruções.
        </p>
      </div>

      {/* ── Legenda ── */}
      <div className="cyber-panel p-3">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">
          Legenda de Risco
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { color: '#00ff88', label: 'Seguro (0–33%)' },
            { color: '#ffd700', label: 'Moderado (33–66%)' },
            { color: '#ff6b00', label: 'Alto (66–85%)' },
            { color: '#ff2d55', label: 'Crítico (85–100%)' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2 text-[11px]">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ background: color, boxShadow: `0 0 6px ${color}` }}
              />
              <span className="text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

function getRiskStatus(score) {
  if (score < 0.33) return 'SEGURO'
  if (score < 0.66) return 'MODERADO'
  if (score < 0.85) return 'ALTO'
  return 'CRÍTICO'
}
