/**
 * MoldSketch — Visualizador 2D esquemático do porta-molde
 * Renderiza as placas em escala proporcional
 */

interface PlateStack {
  topPlate:     { width: number; length: number; height: number }
  cavityPlate:  { width: number; length: number; height: number }
  punchPlate:   { width: number; length: number; height: number }
  spacerBlocks: { width: number; length: number; height: number }
  ejectorPlate: { width: number; length: number; height: number }
  bottomPlate:  { width: number; length: number; height: number }
}

interface Props {
  pieceX: number
  pieceY: number
  pieceZ: number
  cavities: number
  plates?: PlateStack
}

const PLATE_COLORS = [
  { bg: '#1e3a5f', border: '#3b82f6', label: 'Placa Superior' },
  { bg: '#1e3a4f', border: '#60a5fa', label: 'Porta-Postiço Cavidade' },
  { bg: '#1a2f3a', border: '#22d3ee', label: 'Porta-Postiço Punção' },
  { bg: '#1e2f1e', border: '#4ade80', label: 'Calços' },
  { bg: '#2d2218', border: '#fb923c', label: 'Placa Extratora' },
  { bg: '#1e3a5f', border: '#3b82f6', label: 'Placa Inferior' },
]

export default function MoldSketch({ pieceX, pieceY, pieceZ, cavities, plates }: Props) {
  if (!plates) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        <p>Preencha as dimensões para ver o esboço</p>
      </div>
    )
  }

  const plateDefs = [
    { key: 'topPlate',    plate: plates.topPlate,    ...PLATE_COLORS[0] },
    { key: 'cavityPlate', plate: plates.cavityPlate, ...PLATE_COLORS[1] },
    { key: 'punchPlate',  plate: plates.punchPlate,  ...PLATE_COLORS[2] },
    { key: 'spacerBlocks', plate: { ...plates.spacerBlocks, label: 'Calços' }, ...PLATE_COLORS[3] },
    { key: 'ejectorPlate', plate: plates.ejectorPlate, ...PLATE_COLORS[4] },
    { key: 'bottomPlate',  plate: plates.bottomPlate,  ...PLATE_COLORS[5] },
  ]

  const totalHeight = plateDefs.reduce((s, d) => s + d.plate.height, 0)
  const maxWidth    = Math.max(...plateDefs.map((d) => d.plate.width))

  // SVG canvas
  const SVG_W = 300
  const SVG_H = 420
  const MARGIN = 10
  const drawW = SVG_W - MARGIN * 2
  const drawH = SVG_H - MARGIN * 2 - 40 // reserve bottom for legend

  const scale = Math.min(drawW / maxWidth, drawH / totalHeight)

  let curY = MARGIN

  const rendered = plateDefs.map((d) => {
    const h = d.plate.height * scale
    const w = d.plate.width * scale
    const x = MARGIN + (drawW - w) / 2
    const y = curY
    curY += h + 1 // 1px gap between plates
    return { ...d, x, y, w, h }
  })

  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Esboço Estrutural — Vista Frontal
      </h3>
      <svg
        width="100%"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full"
        style={{ maxHeight: 420 }}
      >
        {/* Background */}
        <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#0f172a" rx={8} />

        {/* Center line */}
        <line
          x1={SVG_W / 2} y1={MARGIN}
          x2={SVG_W / 2} y2={SVG_H - 60}
          stroke="#334155" strokeWidth={1} strokeDasharray="4 3"
        />

        {rendered.map((d) => (
          <g key={d.key}>
            <rect
              x={d.x} y={d.y} width={d.w} height={d.h}
              fill={d.bg} stroke={d.border} strokeWidth={1.5} rx={2}
            />
            {d.h > 12 && (
              <text
                x={d.x + d.w / 2} y={d.y + d.h / 2 + 4}
                textAnchor="middle" fill={d.border}
                fontSize={Math.min(9, d.h * 0.4)} fontFamily="monospace"
              >
                {d.label}
              </text>
            )}
            {/* Dimension label on right */}
            <text
              x={d.x + d.w + 4} y={d.y + d.h / 2 + 3}
              fill="#64748b" fontSize={7} fontFamily="monospace"
            >
              {Math.round(d.plate.height)}mm
            </text>
          </g>
        ))}

        {/* Cavities indicator */}
        {cavities > 1 && (
          <text
            x={SVG_W / 2} y={SVG_H - 48}
            textAnchor="middle" fill="#60a5fa" fontSize={8} fontFamily="monospace"
          >
            {cavities}x cavidades — layout H
          </text>
        )}

        {/* Dimensions footer */}
        <text x={SVG_W / 2} y={SVG_H - 35} textAnchor="middle" fill="#475569" fontSize={7.5} fontFamily="monospace">
          Porta-molde: {Math.round(plates.topPlate.width)} × {Math.round(plates.topPlate.length)} mm
        </text>
        <text x={SVG_W / 2} y={SVG_H - 22} textAnchor="middle" fill="#475569" fontSize={7.5} fontFamily="monospace">
          Peça: {Math.round(pieceX)} × {Math.round(pieceY)} × {Math.round(pieceZ)} mm
        </text>
        <text x={SVG_W / 2} y={SVG_H - 9} textAnchor="middle" fill="#334155" fontSize={6.5} fontFamily="monospace">
          ⚠ Esboço esquemático — não em escala exata
        </text>
      </svg>
    </div>
  )
}
