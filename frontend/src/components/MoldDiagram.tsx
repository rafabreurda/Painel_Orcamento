/**
 * MoldDiagram — Diagrama técnico isométrico explodido
 * Replica o estilo visual da geração Gemini:
 * visão explodida + layout cavidades + características
 */

interface PlateStack {
  topPlate: Plate; cavityPlate: Plate; punchPlate: Plate
  spacerBlocks: Plate; ejectorPlate: Plate; bottomPlate: Plate
}
interface Plate { width: number; length: number; height: number }

interface Analysis {
  suggestedCavities?: number
  injectionType?: string
  nozzleCount?: number
  moldSeries?: string
  estimatedCycles?: string
  needsDrawers?: boolean
  technicalNotes?: string[]
  cavityLayout?: string
}

interface Props {
  plates?: PlateStack
  pieceX: number; pieceY: number; pieceZ: number
  cavities: number
  steelType: string
  analysis?: Analysis
  projectName?: string
}

// ─── Isometric helpers ───────────────────────────────────────────────────────
const ISO_ANGLE = Math.PI / 6  // 30°
const CX = Math.cos(ISO_ANGLE)
const SX = Math.sin(ISO_ANGLE)

function isoX(x: number, y: number) { return (x - y) * CX }
function isoY(x: number, y: number, z: number) { return (x + y) * SX - z }

function platePoints(x0: number, y0: number, z0: number, w: number, d: number, h: number, scale: number) {
  // Bottom face corners
  const bl = [isoX(0, 0) * scale + x0, (isoY(0, 0, 0) + z0) * scale + y0]
  const br = [isoX(w, 0) * scale + x0, (isoY(w, 0, 0) + z0) * scale + y0]
  const tr = [isoX(w, d) * scale + x0, (isoY(w, d, 0) + z0) * scale + y0]
  const tl = [isoX(0, d) * scale + x0, (isoY(0, d, 0) + z0) * scale + y0]
  // Top face (offset by h)
  const blT = [isoX(0, 0) * scale + x0, (isoY(0, 0, h) + z0) * scale + y0]
  const brT = [isoX(w, 0) * scale + x0, (isoY(w, 0, h) + z0) * scale + y0]
  const trT = [isoX(w, d) * scale + x0, (isoY(w, d, h) + z0) * scale + y0]
  const tlT = [isoX(0, d) * scale + x0, (isoY(0, d, h) + z0) * scale + y0]
  return { bl, br, tr, tl, blT, brT, trT, tlT }
}

function poly(pts: number[][]) {
  return pts.map(p => p.join(',')).join(' ')
}

const PLATE_DEFS = [
  { key: 'topPlate',    label: 'PLACA SUPERIOR',      mat: '1045',  topFill: '#b0bec5', sideFill: '#90a4ae', frontFill: '#78909c' },
  { key: 'cavityPlate', label: 'PAVIMENTO FIXO',       mat: 'XPM',   topFill: '#546e7a', sideFill: '#455a64', frontFill: '#37474f' },
  { key: 'punchPlate',  label: 'PAVIMENTO MÓVEL',      mat: 'XPM',   topFill: '#546e7a', sideFill: '#455a64', frontFill: '#37474f' },
  { key: 'spacerBlocks',label: 'ESPAÇADORES',          mat: '1045',  topFill: '#b0bec5', sideFill: '#90a4ae', frontFill: '#78909c' },
  { key: 'ejectorPlate',label: 'PLACA EXTRATORA',      mat: '1045',  topFill: '#cfd8dc', sideFill: '#b0bec5', frontFill: '#90a4ae' },
  { key: 'bottomPlate', label: 'BASE INFERIOR',        mat: '1045',  topFill: '#b0bec5', sideFill: '#90a4ae', frontFill: '#78909c' },
]

export default function MoldDiagram({ plates, pieceX, pieceY, pieceZ, cavities, steelType, analysis, projectName }: Props) {
  if (!plates) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        Preencha as dimensões para gerar o diagrama técnico
      </div>
    )
  }

  const W = 560
  const H = 780
  const SCALE = 0.38
  const CX_ISO = W / 2 - 30
  const CY_ISO = 60

  // Build Z stack — explode from top down
  const plateDefs = [
    { ...PLATE_DEFS[0], plate: plates.topPlate },
    { ...PLATE_DEFS[1], plate: plates.cavityPlate },
    { ...PLATE_DEFS[2], plate: plates.punchPlate },
    { ...PLATE_DEFS[3], plate: { ...plates.spacerBlocks, width: plates.topPlate.width } },
    { ...PLATE_DEFS[4], plate: plates.ejectorPlate },
    { ...PLATE_DEFS[5], plate: plates.bottomPlate },
  ]

  const GAP = 14 // gap between plates in iso Z units
  let currentZ = 0
  const plateData = plateDefs.map((pd, i) => {
    const d = { ...pd, z: currentZ }
    currentZ += pd.plate.height * SCALE + GAP
    return d
  })
  const totalZ = currentZ

  const ISO_OY = CY_ISO + totalZ + 20

  // Label positions (right side)
  const labelX = W - 10

  // ─── Cavity layout ────────────────────────────────────────────────────────
  const cavRows = cavities <= 4 ? 2 : cavities <= 8 ? 2 : cavities <= 12 ? 3 : 4
  const cavCols = Math.ceil(cavities / cavRows)
  const cavW = 130; const cavH = 120
  const cavX0 = 12; const cavY0 = H - cavH - 10
  const cellW = (cavW - 16) / cavCols
  const cellH = (cavH - 28) / cavRows

  // Injection channel SVG path (simplified H-tree)
  function injChannel(cX0: number, cY0: number) {
    const cx = cX0 + cavW / 2
    const cy = cY0 + 16 + (cavH - 28) / 2
    return `M ${cx} ${cY0 + 8} L ${cx} ${cy}
            M ${cx} ${cy} L ${cX0 + 8} ${cy} M ${cx} ${cy} L ${cX0 + cavW - 8} ${cy}`
  }

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-xl border border-slate-700 shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d1f35 100%)', maxHeight: 700 }}
      >
        {/* Grid dots */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.6" fill="#1e3a5f" opacity="0.7" />
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />

        {/* ── Title ── */}
        <text x={W / 2} y={22} textAnchor="middle" fill="#60a5fa" fontSize={11} fontFamily="monospace" fontWeight="bold" letterSpacing="2">
          VISÃO EXPLODIDA DO PORTA-MOLDE
        </text>
        <text x={W / 2} y={36} textAnchor="middle" fill="#3b82f6" fontSize={9} fontFamily="monospace">
          {analysis?.moldSeries ?? 'Série 40'} · {pieceX}×{pieceY}×{pieceZ}mm · {cavities} Cav.
        </text>

        {/* ── Isometric plates ── */}
        {plateData.map((pd, i) => {
          const { plate, z, topFill, sideFill, frontFill, label, mat, key } = pd
          const w = plate.width * SCALE
          const d = plate.length * SCALE
          const h = Math.max(plate.height * SCALE, 4)
          const pts = platePoints(CX_ISO, ISO_OY, -z - h, w, d, h, 1)

          // Label line
          const labelY = ISO_OY + pts.brT[1] - 5
          const dotX = pts.brT[0] + 2
          const dotY = pts.brT[1] + ISO_OY - ISO_OY

          return (
            <g key={key}>
              {/* Front face */}
              <polygon points={poly([pts.bl, pts.br, pts.brT, pts.blT])} fill={frontFill} stroke="#1e3a5f" strokeWidth="0.8" opacity="0.92" />
              {/* Right side face */}
              <polygon points={poly([pts.br, pts.tr, pts.trT, pts.brT])} fill={sideFill} stroke="#1e3a5f" strokeWidth="0.8" opacity="0.92" />
              {/* Top face */}
              <polygon points={poly([pts.blT, pts.brT, pts.trT, pts.tlT])} fill={topFill} stroke="#60a5fa" strokeWidth="1" opacity="0.95" />

              {/* Highlight line on top edge */}
              <line x1={pts.blT[0]} y1={pts.blT[1]} x2={pts.brT[0]} y2={pts.brT[1]} stroke="#93c5fd" strokeWidth="1.2" opacity="0.5" />

              {/* Label */}
              <line
                x1={pts.trT[0] + 4} y1={pts.trT[1]}
                x2={labelX - 80} y2={pts.trT[1]}
                stroke="#3b82f6" strokeWidth="0.7" strokeDasharray="3,2" opacity="0.6"
              />
              <text x={labelX - 78} y={pts.trT[1] - 2} fill="#93c5fd" fontSize={8.5} fontFamily="monospace" fontWeight="bold">
                {label}
              </text>
              <text x={labelX - 78} y={pts.trT[1] + 9} fill="#64748b" fontSize={7.5} fontFamily="monospace">
                {Math.round(plate.height)}mm {mat}
              </text>
            </g>
          )
        })}

        {/* ── Cavity injection holes on top plate ── */}
        {(() => {
          const tp = plateData[0]
          const w = tp.plate.width * SCALE
          const d = tp.plate.length * SCALE
          const h = Math.max(tp.plate.height * SCALE, 4)
          const pts = platePoints(CX_ISO, ISO_OY, -tp.z - h, w, d, h, 1)
          // Draw sprue hole on top face (center)
          const cx = (pts.tlT[0] + pts.brT[0]) / 2
          const cy = (pts.tlT[1] + pts.brT[1]) / 2
          return (
            <ellipse cx={cx} cy={cy} rx={5} ry={3} fill="#0a1628" stroke="#60a5fa" strokeWidth="1" opacity="0.8" />
          )
        })()}

        {/* Divider line */}
        <line x1={12} y1={H - 145} x2={W - 12} y2={H - 145} stroke="#1e3a5f" strokeWidth="1" />

        {/* ── Cavity Layout (bottom left) ── */}
        <text x={cavX0 + cavW / 2} y={cavY0 - 6} textAnchor="middle" fill="#60a5fa" fontSize={8} fontFamily="monospace" fontWeight="bold">
          LAYOUT {cavities} CAVIDADES
        </text>
        <rect x={cavX0} y={cavY0} width={cavW} height={cavH} fill="#0d1f35" stroke="#1e4080" strokeWidth="1" rx={3} />

        {/* Injection channel */}
        <path d={injChannel(cavX0, cavY0)} stroke="#3b82f6" strokeWidth="1.5" fill="none" opacity="0.7" />

        {/* Cavities grid */}
        {Array.from({ length: cavities }).map((_, ci) => {
          const row = Math.floor(ci / cavCols)
          const col = ci % cavCols
          const cx2 = cavX0 + 8 + col * cellW + cellW / 2
          const cy2 = cavY0 + 20 + row * cellH + cellH / 2
          return (
            <g key={ci}>
              <rect x={cx2 - cellW * 0.35} y={cy2 - cellH * 0.38} width={cellW * 0.7} height={cellH * 0.76}
                rx={2} fill="#1e3a5f" stroke="#3b82f6" strokeWidth="0.8" opacity="0.9" />
              <text x={cx2} y={cy2 + 3} textAnchor="middle" fill="#93c5fd" fontSize={6} fontFamily="monospace">{ci + 1}</text>
            </g>
          )
        })}

        {/* Injection type indicator */}
        <text x={cavX0 + cavW / 2} y={cavY0 + cavH + 10} textAnchor="middle" fill="#64748b" fontSize={7} fontFamily="monospace">
          {analysis?.injectionType === 'camera_quente' ? `CÂMARA QUENTE · ${analysis.nozzleCount} BICOS` : 'INJEÇÃO CANAL FRIO'}
        </text>

        {/* ── Characteristics box (bottom right) ── */}
        {(() => {
          const bx = cavX0 + cavW + 10
          const by = cavY0 - 10
          const bw = W - bx - 12
          const chars = [
            `${cavities} Cavidades Balanceadas`,
            `Estrutura ${steelType === 'P20' ? '1045/P20' : steelType === 'H13' ? '1045/H13' : '1045'}`,
            `${analysis?.moldSeries ?? 'Série 40'}`,
            `Ciclo Otimizado`,
            `Vida Útil > ${analysis?.estimatedCycles ?? '500k'} Ciclos`,
            ...(analysis?.needsDrawers ? ['Gavetas Laterais'] : []),
            ...(analysis?.injectionType === 'camera_quente' ? [`${analysis.nozzleCount}x Bicos Quentes`] : []),
          ]
          return (
            <g>
              <rect x={bx} y={by} width={bw} height={cavH + 20} fill="#0d1f35" stroke="#1e4080" strokeWidth="1" rx={3} />
              <text x={bx + bw / 2} y={by + 12} textAnchor="middle" fill="#60a5fa" fontSize={8} fontFamily="monospace" fontWeight="bold">
                PRINCIPAIS CARACTERÍSTICAS
              </text>
              <line x1={bx + 6} y1={by + 17} x2={bx + bw - 6} y2={by + 17} stroke="#1e4080" strokeWidth="0.7" />
              {chars.map((c, i) => (
                <g key={i}>
                  <circle cx={bx + 10} cy={by + 27 + i * 15} r={2} fill="#3b82f6" />
                  <text x={bx + 16} y={by + 31 + i * 15} fill="#93c5fd" fontSize={7.5} fontFamily="monospace">{c}</text>
                </g>
              ))}
            </g>
          )
        })()}

        {/* ── Series badge ── */}
        <rect x={W - 80} y={H - 26} width={70} height={18} rx={4} fill="#1e3a5f" stroke="#3b82f6" strokeWidth="0.8" />
        <text x={W - 45} y={H - 14} textAnchor="middle" fill="#60a5fa" fontSize={8} fontFamily="monospace" fontWeight="bold">
          EUROMOLDES
        </text>
      </svg>
    </div>
  )
}
