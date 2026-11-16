import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import Map3D from './components/Map3D'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import FireOverlay, { FIRE_POINTS } from './components/FireOverlay'
import AlertToast from './components/AlertToast'
import { useWeatherData } from './components/WeatherPanel'

// Ribeirão Preto, SP — centro
const RIBEIRAO_PRETO = {
  longitude: -47.8099,
  latitude: -21.1775,
  zoom: 13,
  pitch: 50,
  bearing: -10,
}

let alertIdCounter = 0

export default function App() {
  const [waterLevel, setWaterLevel] = useState(0)
  const [viewState, setViewState] = useState(RIBEIRAO_PRETO)
  const [selectedCoord, setSelectedCoord] = useState(null)
  const [riskData, setRiskData] = useState(null)
  const [activeModule, setActiveModule] = useState('flood')
  const [isLoading, setIsLoading] = useState(false)
  const [fireActive, setFireActive] = useState(false)
  const [smokeOnly, setSmokeOnly] = useState(false)
  const [alerts, setAlerts] = useState([])
  const mapRef = useRef(null)
  const prevWaterBand = useRef(0)
  const firmsRef = useRef(null)
  const [firms, setFirms] = useState(null)
  const [firmsLoading, setFirmsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 30000)

    fetch('/api/nasa/firms', { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error('firms')
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setFirms(data)
      })
      .catch(() => {
        if (!cancelled) setFirms({ ok: false, fires: [], count: 0, fallback: 'simulated' })
      })
      .finally(() => {
        if (!cancelled) setFirmsLoading(false)
        clearTimeout(timer)
      })

    return () => {
      cancelled = true
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [])

  const firePoints = useMemo(() => {
    if (!firms) return null
    if (firms.ok && Array.isArray(firms.fires) && firms.fires.length > 0) {
      return firms.fires.slice(0, 30).map((f) => [f.lon, f.lat])
    }
    if (firms.ok) return []
    return FIRE_POINTS
  }, [firms])

  const fireSourceLabel = !firms ? null : firms.ok ? 'NASA FIRMS' : 'simulated'
  firmsRef.current = firms

  // Dados meteorológicos em tempo real (Open-Meteo, grátis)
  const { weather, loading: weatherLoading } = useWeatherData()

  // ── Alert system ──────────────────────────────────────────────────────────
  const addAlert = useCallback(({ type = 'info', title, message, duration = 5000 }) => {
    const id = ++alertIdCounter
    setAlerts((prev) => [...prev.slice(-4), { id, type, title, message, duration }])
  }, [])

  const removeAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  // Alertas automáticos por nível de água
  useEffect(() => {
    const band = waterLevel < 5 ? 0 : waterLevel < 15 ? 1 : waterLevel < 30 ? 2 : 3
    if (band !== prevWaterBand.current && band > 0) {
      const msgs = [
        null,
        { type: 'info',    title: 'Nível subindo', message: `Nível ${waterLevel.toFixed(1)}m — monitoramento ativo` },
        { type: 'warning', title: 'Alerta moderado', message: `Nível ${waterLevel.toFixed(1)}m — risco de alagamento em vias secundárias` },
        { type: 'danger',  title: '⚠ NÍVEL CRÍTICO', message: `Nível ${waterLevel.toFixed(1)}m — todas as vias comprometidas`, duration: 8000 },
      ]
      if (msgs[band]) addAlert(msgs[band])
    }
    prevWaterBand.current = band
  }, [waterLevel, addAlert])

  const handleFireToggle = useCallback(() => {
    setFireActive((prev) => {
      if (prev) {
        setSmokeOnly(true)
        setTimeout(() => setSmokeOnly(false), 3500)
        addAlert({ type: 'success', title: 'Fogo extinto', message: 'Simulação de incêndio desativada — fumaça residual' })
      } else {
        setSmokeOnly(false)
        const live = firmsRef.current?.ok && firmsRef.current?.count > 0
        addAlert({
          type: 'fire',
          title: live ? 'Focos NASA FIRMS' : 'Incêndio ativo',
          message: live
            ? `${firmsRef.current.count} detecções reais na região canavieira`
            : 'Pontos simulated — FIRMS indisponível',
          duration: 6000,
        })
      }
      return !prev
    })
  }, [addAlert])

  const handleMapClick = useCallback((coord) => {
    setSelectedCoord(coord)
  }, [])

  const handleLocationFound = useCallback((coord) => {
    setSelectedCoord({ lat: coord.lat, lon: coord.lon })
    // Fly to location on map
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [coord.lon, coord.lat], zoom: 15, speed: 0.8 })
    }
  }, [])

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-cyber-bg font-mono">
      {/* CRT scan line overlay */}
      <div className="scan-overlay" />

      {/* Mapa principal */}
      <Map3D
        mapRef={mapRef}
        viewState={viewState}
        onViewStateChange={setViewState}
        waterLevel={waterLevel}
        activeModule={activeModule}
        onMapClick={handleMapClick}
        selectedCoord={selectedCoord}
      />

      {/* Fire/Smoke overlay HTML puro — zero chamadas ao WebGL do MapLibre */}
      <FireOverlay
        map={mapRef}
        fireActive={fireActive || activeModule === 'wildfire'}
        smokeOnly={smokeOnly}
        points={firePoints}
        sourceLabel={fireSourceLabel}
      />

      {/* Top bar */}
      <TopBar activeModule={activeModule} onModuleChange={setActiveModule} />

      {/* Sidebar */}
      <Sidebar
        waterLevel={waterLevel}
        onWaterLevelChange={setWaterLevel}
        selectedCoord={selectedCoord}
        riskData={riskData}
        setRiskData={setRiskData}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        activeModule={activeModule}
        fireActive={fireActive || activeModule === 'wildfire'}
        onFireToggle={handleFireToggle}
        weather={weather}
        weatherLoading={weatherLoading}
        onLocationFound={handleLocationFound}
        onAlert={addAlert}
        firms={firms}
        firmsLoading={firmsLoading}
        fireSourceLabel={fireSourceLabel}
      />

      {/* Toast notifications */}
      <AlertToast alerts={alerts} onDismiss={removeAlert} />
    </div>
  )
}
