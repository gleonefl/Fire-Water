import { useState, useEffect, useCallback, useRef } from 'react'

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'

// Busca previsão real de chuva para Ribeirão Preto via Open-Meteo (grátis, sem token)
async function fetchWeatherData(lat = -21.1775, lon = -47.8099) {
  try {
    const res = await fetch(
      `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code' +
      '&hourly=precipitation_probability,precipitation' +
      '&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min' +
      '&timezone=America/Sao_Paulo&past_days=7&forecast_days=3'
    )
    if (!res.ok) throw new Error('Open-Meteo offline')
    return await res.json()
  } catch {
    return null
  }
}

// Weather code → descrição
function weatherDesc(code) {
  if (code <= 1) return 'Céu limpo'
  if (code <= 3) return 'Parcialmente nublado'
  if (code <= 49) return 'Nevoeiro'
  if (code <= 59) return 'Garoa'
  if (code <= 69) return 'Chuva'
  if (code <= 79) return 'Neve'
  if (code <= 84) return 'Chuva forte'
  if (code <= 94) return 'Trovoada'
  return 'Tempestade ⛈'
}

function weatherIcon(code) {
  if (code <= 1) return '☀'
  if (code <= 3) return '⛅'
  if (code <= 49) return '🌫'
  if (code <= 59) return '🌦'
  if (code <= 69) return '🌧'
  if (code <= 84) return '🌧'
  return '⛈'
}

export function useWeatherData(lat = -21.1775, lon = -47.8099) {
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await fetchWeatherData(lat, lon)
    if (data) setWeather(data)
    setLoading(false)
  }, [lat, lon])

  useEffect(() => {
    refresh()
    // Atualiza a cada 10 minutos
    intervalRef.current = setInterval(refresh, 600_000)
    return () => clearInterval(intervalRef.current)
  }, [refresh])

  return { weather, loading, refresh }
}

// ── Componente de painel meteorológico ──────────────────────────────────────
export default function WeatherPanel({ weather, loading }) {
  if (loading && !weather) {
    return (
      <div className="cyber-panel p-3">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Meteorologia</p>
        <p className="text-[11px] text-gray-600 animate-pulse">Conectando Open-Meteo...</p>
      </div>
    )
  }

  if (!weather) {
    return (
      <div className="cyber-panel p-3">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Meteorologia</p>
        <p className="text-[11px] text-red-400">Offline — sem dados</p>
      </div>
    )
  }

  const c = weather.current
  const daily = weather.daily
  const code = c.weather_code

  // Total de chuva nos últimos 7 dias (past_days=7)
  const rainLast7d = daily.precipitation_sum
    .slice(0, 7)
    .reduce((s, v) => s + (v ?? 0), 0)

  // Previsão de chuva para hoje + próximos 2 dias
  const forecastDays = daily.precipitation_sum.slice(7) // últimos 3 = forecast
  const maxProb = daily.precipitation_probability_max?.slice(7) ?? []

  return (
    <div className="cyber-panel p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest">
          Dados em Tempo Real
        </p>
        <span className="text-[9px] text-cyber-cyan animate-pulse">● LIVE</span>
      </div>

      {/* Condição atual */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{weatherIcon(code)}</span>
        <div>
          <p className="text-white text-sm font-bold">{c.temperature_2m}°C</p>
          <p className="text-gray-500 text-[10px]">{weatherDesc(code)}</p>
        </div>
        <div className="flex-1" />
        <div className="text-right text-[10px]">
          <p className="text-gray-500">Umidade <span className="text-cyber-cyan">{c.relative_humidity_2m}%</span></p>
          <p className="text-gray-500">Vento <span className="text-cyber-cyan">{c.wind_speed_10m} km/h</span></p>
          {c.precipitation > 0 && (
            <p className="text-yellow-400">Chuva: {c.precipitation} mm</p>
          )}
        </div>
      </div>

      <div className="neon-divider mb-2" />

      {/* Chuva acumulada */}
      <div className="mb-2">
        <p className="text-[10px] text-gray-500 mb-1">Chuva acumulada 7 dias</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (rainLast7d / 150) * 100)}%`,
                background: rainLast7d < 50
                  ? 'linear-gradient(90deg, #00f5ff, #0088ff)'
                  : rainLast7d < 100
                  ? 'linear-gradient(90deg, #ffd700, #ff6b00)'
                  : 'linear-gradient(90deg, #ff6b00, #ff2d55)',
              }}
            />
          </div>
          <span className="text-[11px] text-cyber-cyan font-bold">{rainLast7d.toFixed(1)} mm</span>
        </div>
      </div>

      {/* Previsão 3 dias */}
      <div>
        <p className="text-[10px] text-gray-500 mb-1">Previsão de chuva</p>
        <div className="grid grid-cols-3 gap-1">
          {['Hoje', 'Amanhã', 'D+2'].map((label, i) => {
            const rain = forecastDays[i] ?? 0
            const prob = maxProb[i] ?? 0
            return (
              <div key={label} className="bg-gray-900/50 rounded p-1.5 text-center">
                <p className="text-[9px] text-gray-600">{label}</p>
                <p className={`text-[12px] font-bold ${rain > 10 ? 'text-yellow-400' : 'text-cyber-cyan'}`}>
                  {rain.toFixed(0)} mm
                </p>
                <p className="text-[9px] text-gray-500">{prob}% prob</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
