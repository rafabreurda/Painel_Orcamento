/**
 * MoldOpen — Vista do molde aberto (P1 e P2 separadas) com produto simulado
 * Estilo blueprint técnico igual ao Gemini: fundo claro, aço metálico, produto visível
 */

interface Props {
  pieceX: number
  pieceY: number
  pieceZ: number
  cavities: number
  steelType: string
  injectionType?: string
  nozzleCount?: number
  productType?: string   // para variar a silhueta do produto
  surfaceTexture?: string
  heatTreatment?: string
}

export default function MoldOpen({
  pieceX, pieceY, pieceZ, cavities,
  steelType, injectionType, nozzleCount,
  productType, surfaceTexture, heatTreatment,
}: Props) {
  const W = 480, H = 440

  // Mold dimensions based on piece
  const moldW   = Math.min(Math.max(pieceX * 3.2 + 60, 160), 260)
  const moldD   = 72   // depth (perspective look)
  const pCavH   = Math.min(Math.max(pieceZ * 1.8 + 28, 40), 80)   // cavity plate height
  const gap     = Math.min(Math.max(pieceZ * 2.2 + 24, 55), 100)  // open gap
  const structH = 32  // structural plate height

  // Center of diagram
  const cx = W / 2
  // P1 (top half): y0 = 70, bottom at y0+structH+pCavH
  const p1Y0 = 52
  const p1Bottom = p1Y0 + structH + pCavH
  // P2 (bottom half): y0 = p1Bottom + gap
  const p2Y0 = p1Bottom + gap
  const p2Bottom = p2Y0 + pCavH + structH + 14  // ejector + base

  // Piece simulation: sits in the gap, centered
  const pieceScreenW = Math.min(Math.max(pieceX * 1.4, 30), moldW * 0.55)
  const pieceScreenH = Math.min(Math.max(pieceZ * 1.5, 18), gap * 0.62)
  const pieceX0 = cx - pieceScreenW / 2
  const pieceY0 = p1Bottom + (gap - pieceScreenH) / 2

  const cavCols = Math.min(cavities, 4)
  const cavRows = Math.ceil(cavities / cavCols)
  const cavPitch = pieceScreenW / Math.max(cavCols, 1)

  // Product silhouette shape based on type
  function productPath(x: number, y: number, w: number, h: number): string {
    const pt = productType
    if (pt === 'tampa' || pt === 'frasco') {
      // Round cap shape
      const r = Math.min(w, h) * 0.4
      return `M ${x} ${y+h} L ${x} ${y+r} Q ${x} ${y} ${x+r} ${y} L ${x+w-r} ${y} Q ${x+w} ${y} ${x+w} ${y+r} L ${x+w} ${y+h} Z`
    }
    if (pt === 'conector') {
      // Connector: rectangular with tabs
      const tab = h * 0.18
      return `M ${x} ${y+h} L ${x} ${y+tab} L ${x+w*0.2} ${y} L ${x+w*0.8} ${y} L ${x+w} ${y+tab} L ${x+w} ${y+h} Z`
    }
    if (pt === 'carcaça') {
      // Housing: deep rectangular with chamfers
      const ch = h * 0.12
      return `M ${x+ch} ${y} L ${x+w-ch} ${y} L ${x+w} ${y+ch} L ${x+w} ${y+h-ch} L ${x+w-ch} ${y+h} L ${x+ch} ${y+h} L ${x} ${y+h-ch} L ${x} ${y+ch} Z`
    }
    // Default: ergonomic handle / generic rounded rect
    const ry = h * 0.35
    return `M ${x} ${y+ry} Q ${x} ${y} ${x+ry} ${y} L ${x+w-ry} ${y} Q ${x+w} ${y} ${x+w} ${y+ry} L ${x+w} ${y+h-ry} Q ${x+w} ${y+h} ${x+w-ry} ${y+h} L ${x+ry} ${y+h} Q ${x} ${y+h} ${x} ${y+h-ry} Z`
  }

  // Surface texture label
  const texLabel: Record<string, string> = {
    POLISHED: 'Polido', TEXTURED_VDI12: 'Textura VDI-12',
    TEXTURED_VDI18: 'Textura VDI-18', TEXTURED_VDI24: 'Textura VDI-24',
    SANDBLASTED: 'Jateado',
  }
  const htLabel: Record<string, string> = {
    NONE: '—', NITRIDE: 'Nitretação',
    QUENCH_TEMPER: 'Têmpera + Revenido', THROUGH_HARDEN: 'Endurecimento Total',
  }

  // Steel color theme
  const isXPM = steelType === 'P20' || steelType === 'H13'
  const plateTop   = isXPM ? '#8aacbf' : '#c0c8d0'
  const plateSide  = isXPM ? '#456070' : '#8090a0'
  const plateFront = isXPM ? '#304050' : '#606878'
  const cavColor   = isXPM ? '#2a4a62' : '#404858'
  const hilite     = isXPM ? 'rgba(140,210,255,0.6)' : 'rgba(220,230,245,0.7)'

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-xl shadow-xl"
        style={{ background: 'linear-gradient(160deg,#d8e6f0 0%,#e8f0f8 50%,#d4e2ec 100%)', maxHeight: 400 }}
      >
        <defs>
          <pattern id="moGrid" width="18" height="18" patternUnits="userSpaceOnUse">
            <path d="M 18 0 L 0 0 0 18" fill="none" stroke="#a8c0d0" strokeWidth="0.3" opacity="0.4"/>
          </pattern>
          {/* Steel gradients */}
          <linearGradient id="moGrad1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={plateSide}/>
            <stop offset="30%" stopColor={plateTop}/>
            <stop offset="100%" stopColor={plateSide}/>
          </linearGradient>
          <linearGradient id="moGrad2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={plateSide}/>
            <stop offset="35%" stopColor="#ddeeff"/>
            <stop offset="65%" stopColor="#ddeeff"/>
            <stop offset="100%" stopColor={plateSide}/>
          </linearGradient>
          {/* Cavity depth gradient */}
          <linearGradient id="cavGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cavColor}/>
            <stop offset="100%" stopColor="#1a2838"/>
          </linearGradient>
          {/* Product material gradient */}
          <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8f4ff"/>
            <stop offset="40%" stopColor="#c8dff0"/>
            <stop offset="100%" stopColor="#a0c0dc"/>
          </linearGradient>
          <filter id="moShadow">
            <feDropShadow dx="2" dy="3" stdDeviation="4" floodColor="#5878a0" floodOpacity="0.25"/>
          </filter>
          <filter id="prodShadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#2050a0" floodOpacity="0.3"/>
          </filter>
        </defs>

        {/* Background */}
        <rect width={W} height={H} fill="url(#moGrid)"/>
        <rect x={5} y={5} width={W-10} height={H-10} fill="none" stroke="#8090a8" strokeWidth="1.2"/>

        {/* Title */}
        <text x={W/2} y={22} textAnchor="middle" fill="#1a3a58"
          fontSize={10} fontFamily="sans-serif" fontWeight="bold" letterSpacing="1.5">
          MOLDE ABERTO — SIMULAÇÃO DE INJEÇÃO
        </text>
        <text x={W/2} y={35} textAnchor="middle" fill="#3a5878"
          fontSize={7.5} fontFamily="monospace">
          {pieceX}×{pieceY}×{pieceZ}mm · {cavities} Cav. · {steelType === 'S1045' ? '1045' : steelType}
          {injectionType === 'camera_quente' ? ` · Câmara Quente (${nozzleCount} bicos)` : ' · Canal Frio'}
        </text>

        {/* ── P1 — Top half (Cavity / Fêmea) ─────────────────────────────── */}
        <g filter="url(#moShadow)">
          {/* Structural plate (top) */}
          <rect x={cx - moldW/2} y={p1Y0} width={moldW} height={structH}
            fill="url(#moGrad1)" stroke="#404858" strokeWidth="0.8" rx="1"/>
          <rect x={cx - moldW/2 + 1} y={p1Y0 + 1} width={moldW - 2} height={3}
            fill={hilite} rx="1"/>

          {/* Sprue bushing */}
          <circle cx={cx} cy={p1Y0 + structH/2} r="6"
            fill="#2a3848" stroke="#6090b8" strokeWidth="1.2"/>
          <circle cx={cx} cy={p1Y0 + structH/2} r="3"
            fill="#1a2838" stroke="#4878a0" strokeWidth="0.8"/>
          <circle cx={cx} cy={p1Y0 + structH/2} r="1.2"
            fill="#60a0d0"/>

          {/* Guide columns (4 corners) */}
          {[cx - moldW/2 + 18, cx + moldW/2 - 18].map((colX, ci) => (
            <g key={ci}>
              <circle cx={colX} cy={p1Y0 + structH/2} r="5.5"
                fill="#3a4858" stroke="#6080a0" strokeWidth="0.9"/>
              <circle cx={colX} cy={p1Y0 + structH/2} r="2.5"
                fill="#1a2838"/>
            </g>
          ))}

          {/* Cavity plate (P1 bottom — female/fêmea) */}
          <rect x={cx - moldW/2} y={p1Y0 + structH} width={moldW} height={pCavH}
            fill="url(#moGrad1)" stroke="#304050" strokeWidth="0.8"/>
          <rect x={cx - moldW/2 + 1} y={p1Y0 + structH} width={moldW - 2} height={2}
            fill={hilite}/>

          {/* Cavities (female impressions) visible on parting surface */}
          {Array.from({ length: cavities }).map((_, ci) => {
            const col = ci % cavCols
            const row = Math.floor(ci / cavCols)
            const totalCavW = cavPitch * Math.min(cavities, cavCols)
            const startX = cx - totalCavW / 2 + cavPitch * col + cavPitch / 2
            const startY = p1Bottom - 4 - row * (pieceScreenH * 0.45 + 4)
            const cw = pieceScreenW / cavCols * 0.72
            const ch = pCavH * 0.72 / cavRows
            const cx2 = startX - cw/2
            const cy2 = p1Bottom - ch - 2 - row * (ch + 4)
            return (
              <g key={ci}>
                <path d={productPath(cx2, cy2, cw, ch)}
                  fill="url(#cavGrad)" stroke="#1e4060" strokeWidth="0.7"/>
                {/* Cavity highlight rim */}
                <path d={productPath(cx2, cy2, cw, ch)}
                  fill="none" stroke="rgba(80,150,220,0.35)" strokeWidth="0.5"
                  transform="translate(0.5,-0.5)"/>
              </g>
            )
          })}

          {/* Label P1 */}
          <text x={cx - moldW/2 - 6} y={p1Y0 + structH + pCavH/2 + 4}
            textAnchor="end" fill="#1a3a5a" fontSize={7.5} fontFamily="sans-serif" fontWeight="bold">
            P1
          </text>
          <text x={cx - moldW/2 - 6} y={p1Y0 + structH + pCavH/2 + 14}
            textAnchor="end" fill="#3a5878" fontSize={6.5} fontFamily="monospace">
            FÊMEA
          </text>
        </g>

        {/* ── GAP indicator lines ────────────────────────────────────────── */}
        <line x1={cx - moldW/2 - 20} y1={p1Bottom} x2={cx + moldW/2 + 20} y2={p1Bottom}
          stroke="#5088c0" strokeWidth="0.7" strokeDasharray="4,3" opacity="0.5"/>
        <line x1={cx - moldW/2 - 20} y1={p2Y0} x2={cx + moldW/2 + 20} y2={p2Y0}
          stroke="#5088c0" strokeWidth="0.7" strokeDasharray="4,3" opacity="0.5"/>
        {/* Gap arrows */}
        <line x1={cx + moldW/2 + 16} y1={p1Bottom} x2={cx + moldW/2 + 16} y2={p2Y0}
          stroke="#3a78b0" strokeWidth="1" markerEnd="url(#arr)"/>
        <text x={cx + moldW/2 + 22} y={(p1Bottom + p2Y0)/2 + 4}
          fill="#2a5888" fontSize={7} fontFamily="monospace">
          {Math.round(pieceZ + 20)}mm
        </text>

        {/* ── Ejector pins (visible in gap) ─────────────────────────────── */}
        {Array.from({ length: Math.min(cavities * 2, 8) }).map((_, ei) => {
          const totalPins = Math.min(cavities * 2, 8)
          const pinX = cx - moldW/2 + 28 + ei * (moldW - 56) / Math.max(totalPins - 1, 1)
          return (
            <g key={ei}>
              <line x1={pinX} y1={p1Bottom + 6} x2={pinX} y2={p2Y0 - 6}
                stroke="#4a6a88" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
              <line x1={pinX} y1={p1Bottom + 6} x2={pinX} y2={p2Y0 - 6}
                stroke="rgba(150,200,240,0.3)" strokeWidth="0.8" strokeLinecap="round"/>
            </g>
          )
        })}

        {/* ── PRODUCT in open gap ────────────────────────────────────────── */}
        {Array.from({ length: Math.min(cavities, cavCols) }).map((_, ci) => {
          const totalW = cavPitch * Math.min(cavities, cavCols)
          const px = cx - totalW / 2 + cavPitch * ci + cavPitch / 2 - pieceScreenW / cavCols / 2
          const pw = pieceScreenW / cavCols * 0.82
          const py = pieceY0 + (cavRows > 1 ? 0 : 0)
          return (
            <g key={ci} filter="url(#prodShadow)">
              {/* Product body */}
              <path d={productPath(px, py, pw, pieceScreenH)}
                fill="url(#prodGrad)" stroke="#3a7ab0" strokeWidth="1"/>
              {/* Surface texture hint */}
              {surfaceTexture && surfaceTexture !== 'POLISHED' && (
                Array.from({ length: 5 }).map((_, li) => (
                  <line key={li}
                    x1={px + pw * 0.15} y1={py + pieceScreenH * (0.2 + li * 0.15)}
                    x2={px + pw * 0.85} y2={py + pieceScreenH * (0.2 + li * 0.15)}
                    stroke="rgba(50,80,120,0.12)" strokeWidth="0.5"/>
                ))
              )}
              {/* Highlight on product */}
              <path d={productPath(px + pw*0.1, py + 2, pw * 0.35, pieceScreenH * 0.4)}
                fill="rgba(255,255,255,0.25)" stroke="none"/>
              {/* Sprue gate mark */}
              <circle cx={px + pw/2} cy={py - 1} r="2.5"
                fill="#3060b0" stroke="#5080d0" strokeWidth="0.7" opacity="0.8"/>
            </g>
          )
        })}

        {/* ── P2 — Bottom half (Punch / Macho) ─────────────────────────── */}
        <g filter="url(#moShadow)">
          {/* Punch plate (cavity) */}
          <rect x={cx - moldW/2} y={p2Y0} width={moldW} height={pCavH}
            fill="url(#moGrad1)" stroke="#304050" strokeWidth="0.8"/>
          <rect x={cx - moldW/2 + 1} y={p2Y0 + pCavH - 2} width={moldW - 2} height={2}
            fill="rgba(0,0,0,0.15)"/>

          {/* Male cores (punch impressions) visible on top */}
          {Array.from({ length: cavities }).map((_, ci) => {
            const col = ci % cavCols
            const row = Math.floor(ci / cavCols)
            const totalCavW = cavPitch * Math.min(cavities, cavCols)
            const startX = cx - totalCavW / 2 + cavPitch * col + cavPitch / 2
            const cw = pieceScreenW / cavCols * 0.72
            const ch = pCavH * 0.65 / cavRows
            const cx2 = startX - cw/2
            const cy2 = p2Y0 + 3 + row * (ch + 4)
            return (
              <g key={ci}>
                {/* Punch core protrusion */}
                <path d={productPath(cx2, cy2, cw, ch)}
                  fill={isXPM ? '#506878' : '#707888'} stroke="#1e3050" strokeWidth="0.7"/>
                {/* Highlight top edge */}
                <path d={productPath(cx2, cy2, cw, ch)}
                  fill="none" stroke="rgba(200,230,255,0.4)" strokeWidth="0.8"
                  transform="translate(0,-0.8)"/>
              </g>
            )
          })}

          {/* Guide column holes on P2 */}
          {[cx - moldW/2 + 18, cx + moldW/2 - 18].map((colX, ci) => (
            <g key={ci}>
              <circle cx={colX} cy={p2Y0 + 8} r="5.5"
                fill="#2a3848" stroke="#5070a0" strokeWidth="0.9"/>
              <circle cx={colX} cy={p2Y0 + 8} r="2.5"
                fill="#1a2838"/>
            </g>
          ))}

          {/* Ejector + Base plates */}
          <rect x={cx - moldW/2} y={p2Y0 + pCavH} width={moldW} height={8}
            fill={plateSide} stroke="#304050" strokeWidth="0.6"/>
          <rect x={cx - moldW/2} y={p2Y0 + pCavH + 8} width={moldW} height={structH}
            fill="url(#moGrad1)" stroke="#404858" strokeWidth="0.8" rx="1"/>
          <rect x={cx - moldW/2 + 1} y={p2Y0 + pCavH + 8 + structH - 3} width={moldW - 2} height={2}
            fill="rgba(0,0,0,0.15)"/>

          {/* Label P2 */}
          <text x={cx - moldW/2 - 6} y={p2Y0 + pCavH/2 + 4}
            textAnchor="end" fill="#1a3a5a" fontSize={7.5} fontFamily="sans-serif" fontWeight="bold">
            P2
          </text>
          <text x={cx - moldW/2 - 6} y={p2Y0 + pCavH/2 + 14}
            textAnchor="end" fill="#3a5878" fontSize={6.5} fontFamily="monospace">
            MACHO
          </text>
        </g>

        {/* ── Runner / Hot runner nozzles ────────────────────────────────── */}
        {injectionType === 'camera_quente' && Array.from({ length: Math.min(nozzleCount ?? 0, cavities) }).map((_, ni) => {
          const totalW = cavPitch * Math.min(cavities, cavCols)
          const nx = cx - totalW / 2 + cavPitch * ni + cavPitch / 2
          return (
            <g key={ni}>
              <rect x={nx - 4} y={p1Y0 + structH - 14} width={8} height={14}
                fill="#c08020" stroke="#806010" strokeWidth="0.7" rx="1"/>
              <circle cx={nx} cy={p1Y0 + structH} r="3"
                fill="#f0a030" stroke="#c07820" strokeWidth="0.6"/>
            </g>
          )
        })}

        {/* ── Spec badges ───────────────────────────────────────────────── */}
        {(() => {
          const badges = [
            surfaceTexture ? `Textura: ${texLabel[surfaceTexture] ?? surfaceTexture}` : null,
            heatTreatment && heatTreatment !== 'NONE' ? `TT: ${htLabel[heatTreatment] ?? heatTreatment}` : null,
            `${cavities} Cav. · ${steelType}`,
          ].filter(Boolean) as string[]

          return badges.map((b, bi) => (
            <g key={bi}>
              <rect x={W - 120} y={H - 42 + bi * 14 - badges.length * 14} width={112} height={12}
                fill="#1a3a5a" rx="2" opacity="0.85"/>
              <text x={W - 64} y={H - 33 + bi * 14 - badges.length * 14}
                textAnchor="middle" fill="#90b8d8" fontSize={6.5} fontFamily="monospace">
                {b}
              </text>
            </g>
          ))
        })()}

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <rect x={0} y={H - 20} width={W} height={20} fill="#1a3a5a" opacity="0.8"/>
        <text x={W/2} y={H - 8} textAnchor="middle" fill="#6090b8"
          fontSize={7} fontFamily="monospace">
          NEUROFLUX · Simulação Técnica — não substitui projeto de engenharia
        </text>
      </svg>
    </div>
  )
}
