/**
 * MoldDiagram v5 — Vista Explodida Técnica
 * Estilo blueprint profissional: fundo papel técnico, placas metálicas realistas,
 * cotas, cavidades detalhadas, canais de refrigeração, etiquetas técnicas
 */

interface PlateStack {
  topPlate: Plate; cavityPlate: Plate; punchPlate: Plate
  spacerBlocks: Plate; ejectorPlate: Plate; bottomPlate: Plate
}
interface Plate { width: number; length: number; height: number }
interface Analysis {
  suggestedCavities?: number; injectionType?: string; nozzleCount?: number
  moldSeries?: string; estimatedCycles?: string; needsDrawers?: boolean
  technicalNotes?: string[]; cavityLayout?: string; productType?: string
}
interface Props {
  plates?: PlateStack
  pieceX: number; pieceY: number; pieceZ: number
  cavities: number; steelType: string
  analysis?: Analysis; projectName?: string
}

// ── Isometric ──────────────────────────────────────────────────────────────────
const COS30 = Math.cos(Math.PI / 6)
const SIN30 = Math.sin(Math.PI / 6)
type P2 = [number, number]

const iso = (ox: number, oy: number, x: number, y: number, z: number): P2 => [
  ox + (x - y) * COS30,
  oy - z + (x + y) * SIN30
]
const poly = (pts: P2[]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

// ── Unique ID prefix (avoid gradient conflicts) ────────────────────────────────
let _uid = 0
const mkId = () => `md${++_uid}`

export default function MoldDiagram({
  plates, pieceX, pieceY, pieceZ, cavities, steelType, analysis, projectName
}: Props) {
  if (!plates) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Preencha as dimensões para gerar o diagrama técnico
      </div>
    )
  }

  const uid = mkId()
  const W = 560, H = 780
  const SC = 0.30       // mm → SVG units
  const OX = 210, OY_BASE = 68
  const GAP = 22        // gap between plates in exploded view

  // ── Plate stack definition ─────────────────────────────────────────────────
  const plateDefs = [
    { key: 'bot',    label: 'PLACA BASE',          sub: '1045 · Estrutural',    isXPM: false, plate: plates.bottomPlate  },
    { key: 'ej',     label: 'PLACA EXTRATORA',      sub: '1045 · Extração',      isXPM: false, plate: plates.ejectorPlate },
    { key: 'sp',     label: 'CALÇOS ESPAÇADORES',   sub: '1045 · ×2 laterais',   isXPM: false, plate: { ...plates.spacerBlocks, width: plates.topPlate.width } },
    { key: 'punch',  label: 'PAVIMENTO MÓVEL',      sub: 'XPM · Macho/Punção',   isXPM: true,  plate: plates.punchPlate   },
    { key: 'cav',    label: 'PAVIMENTO FIXO',       sub: 'XPM · Fêmea/Cavidade', isXPM: true,  plate: plates.cavityPlate  },
    { key: 'top',    label: 'PLACA DE FIXAÇÃO',     sub: '1045 · Estrutural',    isXPM: false, plate: plates.topPlate     },
  ]

  let zCum = 0
  const stack = plateDefs.map(d => {
    const w = d.plate.width  * SC
    const dp= d.plate.length * SC
    const h = Math.max(d.plate.height * SC, 6)
    const z0= zCum
    zCum += h + GAP
    return { ...d, w, dp, h, z0 }
  })

  const OY = OY_BASE + zCum + 10
  const cavCols = cavities <= 4 ? cavities : Math.ceil(cavities / 2)
  const cavRows = Math.ceil(cavities / cavCols)

  // ── Panel geometry ─────────────────────────────────────────────────────────
  const panelY = H - 195
  const cavPanel  = { x: 14, y: panelY, w: 175, h: 170 }
  const specPanel = { x: cavPanel.x + cavPanel.w + 8, y: panelY, w: W - cavPanel.x - cavPanel.w - 24, h: 170 }
  const cellW = (cavPanel.w - 20) / cavCols
  const cellH = (cavPanel.h - 36) / (cavRows + 0.3)

  const specs = [
    { label: `${cavities} Cavidades Balanceadas`,     icon: '◈' },
    { label: `Layout ${cavCols}×${cavRows} — XPM`,    icon: '▦' },
    { label: `Estrutura SAE 1045 Tratado`,             icon: '⬡' },
    { label: analysis?.moldSeries ?? 'Série 40',      icon: '⊞' },
    { label: `Vida >${analysis?.estimatedCycles ?? '500k'} Ciclos`, icon: '↻' },
    { label: analysis?.injectionType === 'camera_quente'
        ? `Câmara Quente · ${analysis.nozzleCount} Bicos`
        : 'Canal Frio Balanceado',                    icon: '⊕' },
    ...(analysis?.needsDrawers ? [{ label: 'Gavetas Laterais', icon: '⇔' }] : []),
  ]

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl shadow-2xl" style={{ maxHeight: 740 }}>
        <defs>
          {/* Blueprint grid */}
          <pattern id={`${uid}g1`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0L0 0 0 20" fill="none" stroke="#b0c4d4" strokeWidth="0.3" opacity="0.5"/>
          </pattern>
          <pattern id={`${uid}g2`} width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M100 0L0 0 0 100" fill="none" stroke="#98b0c4" strokeWidth="0.7" opacity="0.3"/>
          </pattern>

          {/* 1045 Steel — warm silver */}
          <linearGradient id={`${uid}t45`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#dde2ea"/>
            <stop offset="40%"  stopColor="#c4cad6"/>
            <stop offset="100%" stopColor="#9aa2b0"/>
          </linearGradient>
          <linearGradient id={`${uid}s45`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#8a929e"/>
            <stop offset="100%" stopColor="#606878"/>
          </linearGradient>
          <linearGradient id={`${uid}f45`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#787f8e"/>
            <stop offset="100%" stopColor="#50586a"/>
          </linearGradient>

          {/* XPM Steel — cool blue-steel (premium) */}
          <linearGradient id={`${uid}tXP`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#c8d8e8"/>
            <stop offset="40%"  stopColor="#98b0c8"/>
            <stop offset="100%" stopColor="#607888"/>
          </linearGradient>
          <linearGradient id={`${uid}sXP`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#4a6070"/>
            <stop offset="100%" stopColor="#2e3e4e"/>
          </linearGradient>
          <linearGradient id={`${uid}fXP`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#3a5060"/>
            <stop offset="100%" stopColor="#1e2c38"/>
          </linearGradient>

          {/* Vignette */}
          <radialGradient id={`${uid}vig`} cx="50%" cy="42%" r="65%">
            <stop offset="0%"   stopColor="#f4f9fc" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#8aa4b8" stopOpacity="0.15"/>
          </radialGradient>

          {/* Drop shadow */}
          <filter id={`${uid}sh`} x="-8%" y="-8%" width="120%" height="130%">
            <feDropShadow dx="3" dy="5" stdDeviation="5" floodColor="#5070a0" floodOpacity="0.22"/>
          </filter>

          {/* XPM badge glow */}
          <filter id={`${uid}glow`}>
            <feGaussianBlur stdDeviation="1.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ── Background ── */}
        <rect width={W} height={H} fill="#dce8f2"/>
        <rect width={W} height={H} fill={`url(#${uid}g1)`}/>
        <rect width={W} height={H} fill={`url(#${uid}g2)`}/>
        <rect width={W} height={H} fill={`url(#${uid}vig)`}/>

        {/* ── Technical border ── */}
        <rect x={5} y={5} width={W-10} height={H-10} fill="none" stroke="#5878a0" strokeWidth="1.8"/>
        <rect x={8} y={8} width={W-16} height={H-16} fill="none" stroke="#8aa4bc" strokeWidth="0.5"/>

        {/* Corner marks */}
        {([[15,15],[W-15,15],[15,H-15],[W-15,H-15]] as [number,number][]).map(([cx,cy],i) => (
          <g key={i} stroke="#4868a0" strokeWidth="1.2">
            <line x1={cx-7} y1={cy} x2={cx+7} y2={cy}/>
            <line x1={cx} y1={cy-7} x2={cx} y2={cy+7}/>
          </g>
        ))}

        {/* ── Title ── */}
        <text x={W/2} y={30} textAnchor="middle"
          fill="#0e2a4a" fontSize={13} fontFamily="monospace" fontWeight="bold" letterSpacing="3">
          VISTA EXPLODIDA — PORTA-MOLDE
        </text>
        <text x={W/2} y={46} textAnchor="middle"
          fill="#2a4870" fontSize={8.5} fontFamily="monospace" letterSpacing="1">
          {projectName ?? (analysis?.moldSeries ?? 'SÉRIE 40')} · {pieceX}×{pieceY}×{pieceZ} mm · {cavities} cav · XPM + SAE 1045
        </text>
        <line x1={W/2-160} y1={52} x2={W/2+160} y2={52} stroke="#4a6890" strokeWidth="0.8"/>

        {/* ── Plates ── */}
        {stack.map(({ key, label, sub, isXPM, w, dp, h, z0, plate }) => {
          const tGrad = isXPM ? `url(#${uid}tXP)` : `url(#${uid}t45)`
          const sGrad = isXPM ? `url(#${uid}sXP)` : `url(#${uid}s45)`
          const fGrad = isXPM ? `url(#${uid}fXP)` : `url(#${uid}f45)`
          const edgeDark   = isXPM ? '#1a2e3c' : '#3a4252'
          const highlight  = isXPM ? '#d0e6f8' : '#eaecf4'
          const labelColor = isXPM ? '#0a2a48' : '#1a2840'
          const subColor   = isXPM ? '#2a5070' : '#445060'

          const bl  = iso(OX, OY, 0, 0, z0),     br  = iso(OX, OY, w, 0, z0)
          const tr  = iso(OX, OY, w, dp, z0)
          const blT = iso(OX, OY, 0, 0, z0+h),   brT = iso(OX, OY, w, 0, z0+h)
          const trT = iso(OX, OY, w, dp, z0+h),  tlT = iso(OX, OY, 0, dp, z0+h)

          // Guide pin positions (4 corners)
          const gpOff = Math.max(w * 0.1, 8)
          const gpR = 3.5
          const gpPts: P2[] = [
            iso(OX, OY, gpOff,   gpOff,    z0+h),
            iso(OX, OY, w-gpOff, gpOff,    z0+h),
            iso(OX, OY, gpOff,   dp-gpOff, z0+h),
            iso(OX, OY, w-gpOff, dp-gpOff, z0+h),
          ]

          const lblY    = trT[1]
          const lineEnd = W - 118

          return (
            <g key={key} filter={`url(#${uid}sh)`}>
              {/* Front face */}
              <polygon points={poly([bl, br, brT, blT])} fill={fGrad} stroke={edgeDark} strokeWidth="0.5"/>
              {/* Right face */}
              <polygon points={poly([br, tr, trT, brT])} fill={sGrad} stroke={edgeDark} strokeWidth="0.5"/>
              {/* Top face */}
              <polygon points={poly([blT, brT, trT, tlT])} fill={tGrad}
                stroke={isXPM ? '#507090' : '#7888a0'} strokeWidth="0.9"/>

              {/* Highlights */}
              <line x1={blT[0].toFixed(1)} y1={blT[1].toFixed(1)}
                    x2={brT[0].toFixed(1)} y2={brT[1].toFixed(1)}
                    stroke={highlight} strokeWidth="2.5" opacity="0.8"/>
              <line x1={blT[0].toFixed(1)} y1={blT[1].toFixed(1)}
                    x2={tlT[0].toFixed(1)} y2={tlT[1].toFixed(1)}
                    stroke={highlight} strokeWidth="1.5" opacity="0.45"/>
              {/* Shadow bottom edge */}
              <line x1={bl[0].toFixed(1)} y1={bl[1].toFixed(1)}
                    x2={br[0].toFixed(1)} y2={br[1].toFixed(1)}
                    stroke="rgba(0,0,0,0.3)" strokeWidth="1.2"/>

              {/* ── Guide pin holes ── */}
              {gpPts.map(([gx, gy], gi) => (
                <g key={gi}>
                  <ellipse cx={gx.toFixed(1)} cy={gy.toFixed(1)}
                    rx={(gpR*COS30+0.4).toFixed(1)} ry={(gpR*SIN30+1.1).toFixed(1)}
                    fill={isXPM ? '#0d1e2c' : '#1e2838'}
                    stroke={isXPM ? '#3a6080' : '#4a5870'} strokeWidth="0.8"/>
                  <ellipse cx={gx.toFixed(1)} cy={gy.toFixed(1)}
                    rx={(gpR*COS30*0.45).toFixed(1)} ry={(gpR*SIN30*0.45+0.3).toFixed(1)}
                    fill="none" stroke="rgba(200,230,255,0.25)" strokeWidth="0.5"/>
                </g>
              ))}

              {/* ── Sprue bushing (top plate only) ── */}
              {key === 'top' && (() => {
                const sc = iso(OX, OY, w/2, dp/2, z0+h)
                return (
                  <g>
                    {[10, 6, 3, 1.2].map((r, ri) => (
                      <ellipse key={ri}
                        cx={sc[0].toFixed(1)} cy={sc[1].toFixed(1)}
                        rx={(r*COS30).toFixed(1)} ry={(r*SIN30+0.5*r/4).toFixed(1)}
                        fill={ri === 3 ? '#90c0e8' : `hsl(210,40%,${15+ri*8}%)`}
                        stroke={ri === 0 ? '#6090b8' : 'none'}
                        strokeWidth="0.8"
                      />
                    ))}
                  </g>
                )
              })()}

              {/* ── Cavity imprints (cavity plate top face) ── */}
              {key === 'cav' && (() => {
                const cols2 = cavCols, rows2 = cavRows
                const margin = Math.max(w * 0.12, 10)
                const cW = (w - margin*2) / cols2
                const cD = (dp - margin*2) / rows2
                const pH = cW * 0.52, pD2 = cD * 0.52
                const rc = iso(OX, OY, w/2, dp/2, z0+h)
                return (
                  <g>
                    {/* Sprue center on cavity */}
                    <ellipse cx={rc[0].toFixed(1)} cy={rc[1].toFixed(1)}
                      rx={(3.5*COS30).toFixed(1)} ry={(3.5*SIN30+0.6).toFixed(1)}
                      fill="#1a2e3e" stroke="#3a70b0" strokeWidth="0.9"/>
                    {Array.from({ length: cavities }).map((_, ci) => {
                      const row = Math.floor(ci / cols2), col = ci % cols2
                      const cx = margin + col*cW + cW/2
                      const cy2 = margin + row*cD + cD/2
                      const cc = iso(OX, OY, cx, cy2, z0+h)
                      const hw = pH/2, hd = pD2/2
                      const c1 = iso(OX,OY,cx-hw,cy2-hd,z0+h), c2 = iso(OX,OY,cx+hw,cy2-hd,z0+h)
                      const c3 = iso(OX,OY,cx+hw,cy2+hd,z0+h), c4 = iso(OX,OY,cx-hw,cy2+hd,z0+h)
                      const f = 0.64
                      const i1=iso(OX,OY,cx-hw*f,cy2-hd*f,z0+h), i2=iso(OX,OY,cx+hw*f,cy2-hd*f,z0+h)
                      const i3=iso(OX,OY,cx+hw*f,cy2+hd*f,z0+h), i4=iso(OX,OY,cx-hw*f,cy2+hd*f,z0+h)
                      return (
                        <g key={ci}>
                          <line x1={rc[0].toFixed(1)} y1={rc[1].toFixed(1)}
                                x2={cc[0].toFixed(1)} y2={cc[1].toFixed(1)}
                                stroke="#2860b0" strokeWidth="1.3" opacity="0.65"/>
                          {/* Cavity pocket */}
                          <polygon points={poly([c1,c2,c3,c4])}
                            fill="#1e3650" stroke="#3a78c0" strokeWidth="0.9"/>
                          {/* Product imprint */}
                          <polygon points={poly([i1,i2,i3,i4])}
                            fill="#0e2030" stroke="#2a60a8" strokeWidth="0.6"/>
                          {/* Cavity highlight */}
                          <line x1={c1[0].toFixed(1)} y1={c1[1].toFixed(1)}
                                x2={c2[0].toFixed(1)} y2={c2[1].toFixed(1)}
                                stroke="rgba(160,210,255,0.4)" strokeWidth="0.7"/>
                          {/* Cavity number */}
                          <text x={cc[0].toFixed(1)} y={(cc[1]+2).toFixed(1)}
                            textAnchor="middle" fill="#70a8e0" fontSize="5"
                            fontFamily="monospace" fontWeight="bold">{ci+1}</text>
                        </g>
                      )
                    })}
                  </g>
                )
              })()}

              {/* ── Cooling channels on XPM side face ── */}
              {isXPM && [0.28, 0.5, 0.72].map((frac, ci) => {
                const cp = iso(OX, OY, w, frac*dp, z0 + h*0.5)
                return (
                  <g key={ci}>
                    <circle cx={cp[0].toFixed(1)} cy={cp[1].toFixed(1)} r="2.8"
                      fill="#1a2e38" stroke="#2a7a58" strokeWidth="0.9"/>
                    <circle cx={cp[0].toFixed(1)} cy={cp[1].toFixed(1)} r="1.2"
                      fill="#3ab880" opacity="0.75"/>
                  </g>
                )
              })}

              {/* ── Ejector pin marks on ejector plate ── */}
              {key === 'ej' && (() => {
                const cols2 = cavCols, rows2 = cavRows
                const margin = Math.max(w * 0.12, 10)
                const cW2 = (w - margin*2) / cols2
                const cD2 = (dp - margin*2) / rows2
                return (
                  <g>
                    {Array.from({ length: cavities }).map((_, ci) => {
                      const row = Math.floor(ci / cols2), col = ci % cols2
                      const cx = margin + col*cW2 + cW2/2
                      const cy2 = margin + row*cD2 + cD2/2
                      return [[-cW2*0.18, 0], [cW2*0.18, 0]].map(([dx, dy2], ei) => {
                        const ep = iso(OX, OY, cx+dx, cy2+dy2, z0+h)
                        return (
                          <g key={`${ci}-${ei}`}>
                            <ellipse cx={ep[0].toFixed(1)} cy={ep[1].toFixed(1)}
                              rx={(2.2*COS30).toFixed(1)} ry={(2.2*SIN30+0.5).toFixed(1)}
                              fill="#283848" stroke="#506878" strokeWidth="0.5"/>
                          </g>
                        )
                      })
                    })}
                  </g>
                )
              })()}

              {/* ── XPM badge on XPM plates ── */}
              {isXPM && (() => {
                const bp = iso(OX, OY, w*0.82, dp*0.15, z0+h)
                return (
                  <g filter={`url(#${uid}glow)`}>
                    <rect x={(bp[0]-10).toFixed(1)} y={(bp[1]-5).toFixed(1)}
                      width="20" height="9" rx="2"
                      fill="#0e2030" stroke="#3a78c0" strokeWidth="0.7" opacity="0.85"/>
                    <text x={bp[0].toFixed(1)} y={(bp[1]+1).toFixed(1)}
                      textAnchor="middle" fill="#70b8f0" fontSize="5.5"
                      fontFamily="monospace" fontWeight="bold" letterSpacing="1">XPM</text>
                  </g>
                )
              })()}

              {/* ── Label callout ── */}
              <line x1={(trT[0]+5).toFixed(1)} y1={lblY.toFixed(1)}
                    x2={(lineEnd-2).toFixed(1)} y2={lblY.toFixed(1)}
                    stroke={isXPM ? '#3a6090' : '#5070a0'} strokeWidth="0.65" strokeDasharray="5,3"/>
              <circle cx={(lineEnd-2).toFixed(1)} cy={lblY.toFixed(1)} r="2"
                fill={isXPM ? '#2a6090' : '#3a5880'}/>
              <text x={lineEnd+2} y={(lblY-2.5).toFixed(1)}
                fill={labelColor} fontSize={8.5} fontFamily="sans-serif" fontWeight="bold">
                {label}
              </text>
              <text x={lineEnd+2} y={(lblY+8.5).toFixed(1)}
                fill={subColor} fontSize={7} fontFamily="monospace">
                {Math.round(plate.height)}mm · {sub.split('·')[0].trim()}
              </text>
            </g>
          )
        })}

        {/* ── Divider ── */}
        <line x1={12} y1={panelY-8} x2={W-12} y2={panelY-8}
          stroke="#5878a0" strokeWidth="1" opacity="0.5"/>

        {/* ── Cavity Layout Panel ── */}
        <rect x={cavPanel.x} y={cavPanel.y} width={cavPanel.w} height={cavPanel.h}
          fill="#eef4fa" stroke="#6090b8" strokeWidth="1.3" rx="4"/>
        <rect x={cavPanel.x} y={cavPanel.y} width={cavPanel.w} height={18}
          fill="#0e2a4a" rx="3"/>
        <rect x={cavPanel.x} y={cavPanel.y+14} width={cavPanel.w} height={4} fill="#0e2a4a"/>
        <text x={cavPanel.x+cavPanel.w/2} y={cavPanel.y+13} textAnchor="middle"
          fill="#b8d8f0" fontSize={7.5} fontFamily="monospace" fontWeight="bold" letterSpacing="0.5">
          LAYOUT {cavities} CAVIDADES · XPM
        </text>

        {/* Sprue */}
        {(() => {
          const sx = cavPanel.x + cavPanel.w/2, sy = cavPanel.y + 28
          return (
            <g>
              <circle cx={sx} cy={sy} r="5.5" fill="#0e2a4a" stroke="#3a70b0" strokeWidth="1"/>
              <circle cx={sx} cy={sy} r="2.2" fill="#4090d8"/>
              <line x1={sx} y1={sy+5.5} x2={sx} y2={cavPanel.y+cavPanel.h-10}
                stroke="#1a4890" strokeWidth="1.5" opacity="0.4"/>
            </g>
          )
        })()}

        {/* Cavity cells */}
        {Array.from({ length: cavities }).map((_, ci) => {
          const row = Math.floor(ci / cavCols), col = ci % cavCols
          const cx = cavPanel.x + 10 + col * cellW + cellW/2
          const cy2 = cavPanel.y + 32 + row * cellH + cellH/2
          const spX = cavPanel.x + cavPanel.w/2, spY = cavPanel.y + 28
          return (
            <g key={ci}>
              <line x1={spX} y1={spY+5.5} x2={cx} y2={cy2}
                stroke="#1a4890" strokeWidth="1.2" opacity="0.45"/>
              <rect x={(cx-cellW*0.37).toFixed(1)} y={(cy2-cellH*0.38).toFixed(1)}
                width={(cellW*0.74).toFixed(1)} height={(cellH*0.74).toFixed(1)}
                rx="2.5" fill="#cce0f8" stroke="#2a68c0" strokeWidth="1"/>
              <rect x={(cx-cellW*0.23).toFixed(1)} y={(cy2-cellH*0.24).toFixed(1)}
                width={(cellW*0.46).toFixed(1)} height={(cellH*0.48).toFixed(1)}
                rx="1.5" fill="#98c0ec" stroke="#1a50a8" strokeWidth="0.7" opacity="0.9"/>
              <circle cx={cx.toFixed(1)} cy={(cy2+cellH*0.32).toFixed(1)} r="1.6"
                fill="#1060c8" opacity="0.75"/>
              <text x={cx.toFixed(1)} y={(cy2+2.5).toFixed(1)} textAnchor="middle"
                fill="#0a2260" fontSize={7} fontFamily="monospace" fontWeight="bold">
                {ci+1}
              </text>
            </g>
          )
        })}

        <text x={cavPanel.x+cavPanel.w/2} y={cavPanel.y+cavPanel.h+14}
          textAnchor="middle" fill="#2a4870" fontSize={7} fontFamily="monospace" letterSpacing="0.5">
          {analysis?.injectionType === 'camera_quente'
            ? `CÂMARA QUENTE · ${analysis.nozzleCount} BICOS`
            : 'INJEÇÃO CANAL FRIO BALANCEADO'}
        </text>

        {/* ── Specs Panel ── */}
        <rect x={specPanel.x} y={specPanel.y} width={specPanel.w} height={specPanel.h}
          fill="#eef4fa" stroke="#6090b8" strokeWidth="1.3" rx="4"/>
        <rect x={specPanel.x} y={specPanel.y} width={specPanel.w} height={18}
          fill="#0e2a4a" rx="3"/>
        <rect x={specPanel.x} y={specPanel.y+14} width={specPanel.w} height={4} fill="#0e2a4a"/>
        <text x={specPanel.x+specPanel.w/2} y={specPanel.y+13} textAnchor="middle"
          fill="#b8d8f0" fontSize={7.5} fontFamily="monospace" fontWeight="bold" letterSpacing="0.5">
          CARACTERÍSTICAS TÉCNICAS
        </text>

        {specs.map(({ label: s, icon }, i) => (
          <g key={i}>
            <text x={specPanel.x+10} y={(specPanel.y+30+i*20).toFixed(1)}
              fill="#2a68a0" fontSize={8.5} fontFamily="monospace">{icon}</text>
            <text x={specPanel.x+20} y={(specPanel.y+30+i*20).toFixed(1)}
              fill="#0e2840" fontSize={8} fontFamily="sans-serif">{s}</text>
          </g>
        ))}

        {/* ── Footer ── */}
        <rect x={12} y={H-22} width={W-24} height={14} fill="#0e2a4a" rx="2" opacity="0.92"/>
        <text x={W/2} y={H-12} textAnchor="middle"
          fill="#7ab0d8" fontSize={7.5} fontFamily="monospace" letterSpacing="1.5">
          EUROMOLDES · FERRAMENTARIA DE PRECISÃO · NEUROFLUX MOLD ENTERPRISE
        </text>
      </svg>
    </div>
  )
}
