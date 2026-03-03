import { useState, useEffect } from 'react'

const MODULES = [
  { id: 'flood', label: '[ Flood Map ]', icon: '🌊' },
  { id: 'wildfire', label: '[ Wildfire ]', icon: '🔥' },
  { id: 'geomarketing', label: '[ GeoMarketing ]', icon: '📍' },
]

export default function TopBar({ activeModule, onModuleChange }) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatted = time.toLocaleTimeString('pt-BR', { hour12: false })
  const dateStr = time.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <header className="absolute top-0 left-0 right-0 h-14 z-20 flex items-center px-4 gap-4"
      style={{
        background: 'linear-gradient(180deg, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.6) 100%)',
        borderBottom: '1px solid rgba(0,245,255,0.15)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <div className="w-7 h-7 rounded border border-cyber-cyan/60 flex items-center justify-center"
          style={{ boxShadow: '0 0 10px rgba(0,245,255,0.3)' }}>
          <span className="text-cyber-cyan text-xs">AQ</span>
        </div>
        <div>
          <p className="text-cyber-cyan text-sm font-bold leading-tight tracking-widest"
            style={{ textShadow: '0 0 10px rgba(0,245,255,0.7)' }}>
            AQUACITIES 3D
          </p>
          <p className="text-[9px] text-gray-600 tracking-widest uppercase leading-tight">
            Flood & Fire Intelligence
          </p>
        </div>
      </div>

      {/* Divisor */}
      <div className="h-6 w-px bg-cyber-border" />

      {/* Módulos */}
      <nav className="flex gap-1">
        {MODULES.map((mod) => (
          <button
            key={mod.id}
            onClick={() => onModuleChange(mod.id)}
            className={`px-3 py-1 rounded text-[11px] uppercase tracking-widest font-mono transition-all duration-200 border ${
              activeModule === mod.id
                ? 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/10'
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
            }`}
            style={activeModule === mod.id ? { boxShadow: '0 0 12px rgba(0,245,255,0.25)' } : {}}
          >
            {mod.icon} {mod.label}
          </button>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Status / Location */}
      <div className="hidden md:flex items-center gap-3 text-[10px] text-gray-500 font-mono">
        <span className="text-gray-600">Ribeirão Preto, SP</span>
        <span className="text-cyber-border">|</span>
        <span className="text-gray-400">{dateStr}</span>
        <span className="text-cyber-border">|</span>
        <span className="text-cyber-cyan">{formatted}</span>
        <span className="animate-blink text-cyber-cyan ml-1">█</span>
      </div>
    </header>
  )
}
