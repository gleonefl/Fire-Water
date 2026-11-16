import { useEffect, useRef } from 'react'

// Pontos de fogo em Ribeirão Preto [lon, lat]
export const FIRE_POINTS = [
  [-47.8099, -21.1775], [-47.8220, -21.1690], [-47.7980, -21.1840],
  [-47.8150, -21.1960], [-47.7900, -21.1710], [-47.8310, -21.1820],
  [-47.8050, -21.1650], [-47.7960, -21.1920], [-47.8260, -21.1740],
  [-47.8130, -21.2010], [-47.8380, -21.1590], [-47.7870, -21.1780],
]

// Cria uma chama individual com variação
function createFlame(size, delay, dur, hue) {
  const el = document.createElement('div')
  const w = size * (0.4 + Math.random() * 0.3)
  const h = size * (0.8 + Math.random() * 0.5)
  el.className = 'fire-flame'
  el.style.cssText = `
    position: absolute;
    width: ${w}px; height: ${h}px;
    bottom: 0; left: 50%;
    transform: translateX(-50%);
    border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
    background: radial-gradient(ellipse at 50% 80%,
      #fff8 10%,
      hsl(${hue}, 100%, 65%) 25%,
      hsl(${hue - 15}, 100%, 50%) 50%,
      hsl(${hue - 30}, 100%, 35%) 75%,
      transparent 100%);
    filter: blur(${size * 0.06}px);
    animation: flameRise ${dur}s ${delay}s ease-in-out infinite alternate;
    opacity: 0.9;
  `
  return el
}

// Cria uma faísca
function createSpark(size, delay) {
  const el = document.createElement('div')
  const s = 2 + Math.random() * 3
  const drift = (Math.random() - 0.5) * size * 1.5
  el.className = 'fire-spark'
  el.style.cssText = `
    position: absolute;
    width: ${s}px; height: ${s}px;
    bottom: ${size * 0.3}px;
    left: calc(50% + ${drift}px);
    border-radius: 50%;
    background: ${Math.random() > 0.5 ? '#ffe066' : '#ffaa00'};
    box-shadow: 0 0 ${s * 2}px #ff6600;
    animation: sparkFloat ${0.8 + Math.random() * 1.2}s ${delay}s ease-out infinite;
    opacity: 0;
  `
  return el
}

// Cria nuvem de fumaça
function createSmoke(size, delay, isHeavy) {
  const el = document.createElement('div')
  const s = size * (0.6 + Math.random() * 0.8)
  const drift = (Math.random() - 0.5) * size * 0.5
  el.className = 'fire-smoke'
  el.style.cssText = `
    position: absolute;
    width: ${s}px; height: ${s}px;
    bottom: ${size * 0.4}px;
    left: calc(50% + ${drift}px);
    transform: translate(-50%, 0);
    border-radius: 50%;
    background: radial-gradient(circle,
      rgba(${isHeavy ? '80,80,100' : '100,100,120'}, ${isHeavy ? '0.5' : '0.35'}) 0%,
      rgba(${isHeavy ? '60,60,80' : '90,90,110'}, ${isHeavy ? '0.3' : '0.15'}) 50%,
      transparent 70%);
    animation: smokeRise ${2.5 + Math.random() * 2}s ${delay}s ease-out infinite;
    opacity: 0;
  `
  return el
}

export default function FireOverlay({ map, fireActive, smokeOnly, points = null, sourceLabel = null }) {
  const containerRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const mapInstance = map?.current
    if (!mapInstance || !containerRef.current) return
    const activePoints = Array.isArray(points) ? points : []
    if (!fireActive && !smokeOnly) {
      containerRef.current.innerHTML = ''
      return
    }
    if (activePoints.length === 0) {
      containerRef.current.innerHTML = ''
      return
    }

    const container = containerRef.current
    container.innerHTML = ''

    activePoints.forEach((_, i) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'fire-point'
      wrapper.dataset.index = i
      wrapper.style.cssText = `
        position: absolute;
        pointer-events: none;
        will-change: transform;
      `

      // Tamanho varia por ponto (simula incêndios de intensidades dif.)
      const baseSize = 40 + (i % 5) * 12

      if (!smokeOnly) {
        // ── Glow grande no chão ──
        const groundGlow = document.createElement('div')
        groundGlow.style.cssText = `
          position: absolute;
          width: ${baseSize * 3}px; height: ${baseSize * 1.5}px;
          bottom: -${baseSize * 0.3}px; left: 50%;
          transform: translateX(-50%);
          border-radius: 50%;
          background: radial-gradient(ellipse,
            rgba(255,80,0,0.4) 0%,
            rgba(255,40,0,0.2) 40%,
            transparent 70%);
          animation: glowPulse ${1.5 + (i % 4) * 0.3}s ease-in-out infinite alternate;
          filter: blur(8px);
        `
        wrapper.appendChild(groundGlow)

        // ── 3-5 chamas por ponto, cada uma com tamanho/cor/timing dif. ──
        const flameCount = 3 + (i % 3)
        for (let f = 0; f < flameCount; f++) {
          const hue = 30 + Math.random() * 25  // laranja a amarelo
          const delay = Math.random() * 0.8
          const dur = 0.4 + Math.random() * 0.5
          const flame = createFlame(baseSize * (0.7 + f * 0.15), delay, dur, hue)
          // Spread chamas lateralmente
          const spread = ((f - flameCount / 2) / flameCount) * baseSize * 0.6
          flame.style.left = `calc(50% + ${spread}px)`
          wrapper.appendChild(flame)
        }

        // ── Chama central brilhante ──
        const coreFlame = document.createElement('div')
        coreFlame.style.cssText = `
          position: absolute;
          width: ${baseSize * 0.25}px; height: ${baseSize * 0.55}px;
          bottom: ${baseSize * 0.05}px; left: 50%;
          transform: translateX(-50%);
          border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
          background: radial-gradient(ellipse at 50% 70%,
            #fff 0%, #fffbe0 30%, #ffd000 60%, transparent 100%);
          animation: flameRise ${0.35}s 0s ease-in-out infinite alternate;
          filter: blur(1px);
          opacity: 0.95;
        `
        wrapper.appendChild(coreFlame)

        // ── 6-10 faíscas subindo ──
        const sparkCount = 6 + (i % 5)
        for (let s = 0; s < sparkCount; s++) {
          wrapper.appendChild(createSpark(baseSize, Math.random() * 3))
        }
      }

      // ── Fumaça (sempre presente) ──
      const smokeCount = smokeOnly ? 5 : 3
      for (let s = 0; s < smokeCount; s++) {
        const smoke = createSmoke(baseSize, Math.random() * 2, smokeOnly)
        if (smokeOnly) {
          smoke.style.transition = 'opacity 2.5s ease-out'
        }
        wrapper.appendChild(smoke)
      }

      container.appendChild(wrapper)
    })

    // Reposiciona conforme a câmera do mapa move
    const updatePositions = () => {
      const els = container.querySelectorAll('.fire-point')
      els.forEach((el, i) => {
        const [lon, lat] = activePoints[i] || []
        if (lon == null || lat == null) return
        try {
          const pt = mapInstance.project([lon, lat])
          el.style.transform = `translate(${pt.x}px, ${pt.y}px) translate(-50%, -100%)`
        } catch { /* mapa destruido */ }
      })
      rafRef.current = requestAnimationFrame(updatePositions)
    }
    rafRef.current = requestAnimationFrame(updatePositions)

    // Smoke-only: fade out após um delay
    if (smokeOnly) {
      setTimeout(() => {
        container.querySelectorAll('.fire-smoke').forEach((el) => {
          el.style.opacity = '0'
        })
        setTimeout(() => { container.innerHTML = '' }, 3000)
      }, 400)
    }

    return () => cancelAnimationFrame(rafRef.current)
  }, [map, fireActive, smokeOnly, points])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 5 }}>
      <div ref={containerRef} className="absolute inset-0 overflow-hidden" />
      {fireActive && sourceLabel && (
        <div
          className="absolute bottom-4 left-4 px-2 py-1 rounded border text-[10px] tracking-widest font-bold"
          style={{
            background: 'rgba(0,0,0,0.72)',
            borderColor: sourceLabel === 'simulated' ? 'rgba(255,107,0,0.45)' : 'rgba(0,245,255,0.45)',
            color: sourceLabel === 'simulated' ? '#ff6b00' : '#00f5ff',
          }}
        >
          {sourceLabel}
        </div>
      )}
    </div>
  )
}
