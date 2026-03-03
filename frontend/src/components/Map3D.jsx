import { useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'

// CARTO Dark Matter — grátis, sem token
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

// Classes de rua ordenadas por vulnerabilidade a inundação.
// Threshold = nível de água necessário para aquela classe aparecer inundada.
// Vias maiores (calha natural) inundam primeiro; ruas menores só no fim.
const ROAD_FLOOD_THRESHOLDS = [
  { classes: ['motorway', 'trunk'],           threshold: 1  },
  { classes: ['primary'],                     threshold: 5  },
  { classes: ['secondary'],                   threshold: 12 },
  { classes: ['tertiary'],                    threshold: 20 },
  { classes: ['minor', 'service', 'residential'], threshold: 30 },
  { classes: ['path', 'track', 'raceway'],    threshold: 42 },
]

export default function Map3D({
  mapRef,
  viewState,
  onViewStateChange,
  waterLevel,
  activeModule,
  onMapClick,
  selectedCoord,
}) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const marker = useRef(null)
  const initialized = useRef(false)

  // Inicializa o mapa
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      pitch: viewState.pitch,
      bearing: viewState.bearing,
      antialias: true,
    })
    map.current = m
    // expõe a instância do mapa para componentes externos (ex: FireOverlay)
    if (mapRef) mapRef.current = m

    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')

    m.on('load', () => {
      // ── Extrusão 3D dos prédios ──────────────────────────────────────────
      const layers = m.getStyle().layers
      const labelLayerId = layers.find(
        (l) => l.type === 'symbol' && l.layout?.['text-field']
      )?.id

      // CARTO usa source 'carto' com OpenMapTiles spec
      const styleSources = Object.keys(m.getStyle().sources)
      const vectorSource = styleSources.find((s) =>
        ['carto', 'openmaptiles', 'composite'].includes(s)
      ) ?? styleSources[0]

      if (vectorSource) {
        m.addLayer(
          {
            id: 'building-extrusion',
            type: 'fill-extrusion',
            source: vectorSource,
            'source-layer': 'building',
            minzoom: 12,
            paint: {
              'fill-extrusion-color': [
                'interpolate', ['linear'],
                ['coalesce', ['get', 'render_height'], ['get', 'height'], 0],
                0,   '#0d1117',
                20,  '#111827',
                50,  '#1a2035',
                100, '#1e3a5f',
              ],
              'fill-extrusion-height': [
                'interpolate', ['linear'], ['zoom'],
                12, 0,
                13, ['coalesce', ['get', 'render_height'], ['get', 'height'], 3],
              ],
              'fill-extrusion-base': [
                'interpolate', ['linear'], ['zoom'],
                12, 0,
                13, ['coalesce', ['get', 'render_min_height'], 0],
              ],
              'fill-extrusion-opacity': 0.85,
            },
          },
          labelLayerId
        )
      }

      // ── Terrain 3D desabilitado — setTerrain com tiles externos
      // causa falha de WebGL context (tela preta) em dev/browsers sem CORS
      // Para habilitar em produção com token Mapbox:
      // m.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 })

      // ── Flood — água desenhada sobre as RUAS REAIS (vector tiles) ──────
      // Usa geometria real do source-layer 'transportation' do CARTO/OpenMapTiles.
      // A água segue cada rua conforme o slider de nível.
      if (vectorSource) {
        // Brilho externo (glow) nas ruas inundadas
        m.addLayer({
          id: 'road-flood-glow',
          type: 'line',
          source: vectorSource,
          'source-layer': 'transportation',
          filter: ['==', 'class', '__none__'],   // começa escondido
          minzoom: 10,
          paint: {
            'line-color': [
              'match', ['get', 'class'],
              'motorway', '#003cff',
              'trunk',    '#0055ff',
              'primary',  '#0077ff',
              'secondary','#0099ff',
              'tertiary', '#00bbff',
              '#00ddff',
            ],
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              10, 2,
              13, ['match', ['get', 'class'],
                'motorway', 18, 'trunk', 16, 'primary', 14,
                'secondary', 12, 'tertiary', 10, 6
              ],
              16, ['match', ['get', 'class'],
                'motorway', 30, 'trunk', 26, 'primary', 22,
                'secondary', 18, 'tertiary', 14, 10
              ],
            ],
            'line-opacity': 0.15,
            'line-blur': 4,
          },
        }, labelLayerId)

        // Lâmina d'água principal
        m.addLayer({
          id: 'road-flood-water',
          type: 'line',
          source: vectorSource,
          'source-layer': 'transportation',
          filter: ['==', 'class', '__none__'],   // começa escondido
          minzoom: 10,
          paint: {
            'line-color': [
              'match', ['get', 'class'],
              'motorway', '#0044ee',
              'trunk',    '#0066ff',
              'primary',  '#0088ff',
              'secondary','#00aaff',
              'tertiary', '#00ccff',
              '#00e0ff',
            ],
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              10, 1,
              13, ['match', ['get', 'class'],
                'motorway', 10, 'trunk', 9, 'primary', 7,
                'secondary', 6, 'tertiary', 5, 3
              ],
              16, ['match', ['get', 'class'],
                'motorway', 18, 'trunk', 16, 'primary', 14,
                'secondary', 12, 'tertiary', 10, 6
              ],
            ],
            'line-opacity': 0.55,
            'line-blur': 0.5,
          },
        }, labelLayerId)

        // Brilho do centro (highlight)
        m.addLayer({
          id: 'road-flood-shine',
          type: 'line',
          source: vectorSource,
          'source-layer': 'transportation',
          filter: ['==', 'class', '__none__'],
          minzoom: 12,
          paint: {
            'line-color': '#00f5ff',
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              12, 0.5,
              14, ['match', ['get', 'class'],
                'motorway', 3, 'trunk', 2.5, 'primary', 2, 1.5
              ],
              16, ['match', ['get', 'class'],
                'motorway', 5, 'trunk', 4, 'primary', 3, 2
              ],
            ],
            'line-opacity': 0.3,
            'line-blur': 0,
          },
        }, labelLayerId)
      }

      // ── Heatmap de risco comercial ───────────────────────────────────────
      m.addSource('risk-heatmap', {
        type: 'geojson',
        data: generateRiskPoints(),
      })

      m.addLayer({
        id: 'risk-heatmap-layer',
        type: 'heatmap',
        source: 'risk-heatmap',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'risk'], 0, 0, 1, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 15, 2],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,   'rgba(0,0,0,0)',
            0.2, 'rgba(0,255,137,0.6)',
            0.5, 'rgba(255,214,0,0.8)',
            0.8, 'rgba(255,107,0,0.9)',
            1,   'rgba(255,45,85,1)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 20, 15, 50],
          'heatmap-opacity': 0.75,
        },
      })
    })

    // Click handler
    m.on('click', (e) => {
      onMapClick({ lat: e.lngLat.lat, lon: e.lngLat.lng })
    })

    // Sync viewState on move
    m.on('move', () => {
      const c = m.getCenter()
      onViewStateChange({
        longitude: c.lng,
        latitude: c.lat,
        zoom: m.getZoom(),
        pitch: m.getPitch(),
        bearing: m.getBearing(),
      })
    })

    return () => {
      m.remove()
      map.current = null
      if (mapRef) mapRef.current = null
      initialized.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Flood: filtra ruas conforme o nível d'água ────────────────────────
  useEffect(() => {
    const m = map.current
    if (!m) return

    const apply = () => {
      if (!m.getLayer('road-flood-water')) return

      if (waterLevel > 0) {
        // Quais classes de rua já inundaram neste nível?
        const allowedClasses = ROAD_FLOOD_THRESHOLDS
          .filter((g) => waterLevel >= g.threshold)
          .flatMap((g) => g.classes)

        const filter = allowedClasses.length > 0
          ? ['in', ['get', 'class'], ['literal', allowedClasses]]
          : ['==', 'class', '__none__']

        m.setFilter('road-flood-glow',  filter)
        m.setFilter('road-flood-water', filter)
        m.setFilter('road-flood-shine', filter)

        // Opacidade cresce com o nível (só 1 setPaintProperty por mudança de slider)
        const t = Math.min(waterLevel / 50, 1)
        m.setPaintProperty('road-flood-water', 'line-opacity', 0.35 + t * 0.4)
        m.setPaintProperty('road-flood-glow',  'line-opacity', 0.08 + t * 0.14)
        m.setPaintProperty('road-flood-shine', 'line-opacity', 0.15 + t * 0.25)

        // Dasharray flow animation — cria efeito de água correndo
        // Usa setInterval a 6fps (muito lento para causar recompile de shader)
        m.setPaintProperty('road-flood-shine', 'line-dasharray', [4, 4])
      } else {
        // Nível 0 — esconde tudo
        const hide = ['==', 'class', '__none__']
        m.setFilter('road-flood-glow',  hide)
        m.setFilter('road-flood-water', hide)
        m.setFilter('road-flood-shine', hide)
      }
    }

    if (m.isStyleLoaded()) apply()
    else m.once('load', apply)
  }, [waterLevel])

  // ── Water flow animation (dash offset via layer swap) ─────────────────
  useEffect(() => {
    const m = map.current
    if (!m || waterLevel <= 0) return

    let phase = 0
    const DASH_PATTERNS = [
      [4, 4],
      [3, 4, 1, 0],
      [2, 4, 2, 0],
      [1, 4, 3, 0],
      [0, 4, 4, 0],
      [0, 3, 4, 1],
      [0, 2, 4, 2],
      [0, 1, 4, 3],
    ]

    const interval = setInterval(() => {
      if (!m.getLayer('road-flood-shine')) return
      phase = (phase + 1) % DASH_PATTERNS.length
      try {
        m.setPaintProperty('road-flood-shine', 'line-dasharray', DASH_PATTERNS[phase])
      } catch { /* layer may not exist yet */ }
    }, 180) // ~5.5fps — seguro para o WebGL

    return () => clearInterval(interval)
  }, [waterLevel > 0])

  // ── Heatmap toggle (activeModule) ──────────────────────────────────────
  useEffect(() => {
    const m = map.current
    if (!m) return
    const apply = () => {
      if (!m.getLayer('risk-heatmap-layer')) return
      m.setLayoutProperty(
        'risk-heatmap-layer',
        'visibility',
        activeModule === 'geomarketing' ? 'visible' : 'none'
      )
    }
    if (m.isStyleLoaded()) apply()
    else m.once('load', apply)
  }, [activeModule])

  // ── Marker for selected coord ─────────────────────────────────────────────
  useEffect(() => {
    const m = map.current
    if (!m || !selectedCoord) return

    if (marker.current) marker.current.remove()

    const el = document.createElement('div')
    el.style.cssText = `
      width: 14px; height: 14px;
      border-radius: 50%;
      background: #00f5ff;
      box-shadow: 0 0 12px #00f5ff, 0 0 24px rgba(0,245,255,0.5);
      border: 2px solid white;
    `

    marker.current = new maplibregl.Marker({ element: el })
      .setLngLat([selectedCoord.lon, selectedCoord.lat])
      .addTo(m)

    m.flyTo({ center: [selectedCoord.lon, selectedCoord.lat], speed: 0.8 })
  }, [selectedCoord])

  return (
    <div
      ref={mapContainer}
      className="absolute inset-0 w-full h-full"
      style={{ cursor: 'crosshair' }}
    />
  )
}

// Pontos de risco comercial simulados em Ribeirão Preto
function generateRiskPoints() {
  const center = [-47.8099, -21.1775]
  const points = []
  for (let i = 0; i < 120; i++) {
    const lng = center[0] + (Math.random() - 0.5) * 0.22
    const lat = center[1] + (Math.random() - 0.5) * 0.18
    points.push({
      type: 'Feature',
      properties: { risk: Math.random() },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    })
  }
  return { type: 'FeatureCollection', features: points }
}
