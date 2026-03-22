/**
 * MoldViewer3D — Visualizador 3D interativo do molde
 * Three.js via @react-three/fiber
 * Funcionalidades: rotação, zoom, animação abrir/fechar, produto visível na cavidade
 */

import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import { cn, BRL } from '@/lib/utils'

interface PlateStack {
  topPlate: { width: number; length: number; height: number }
  cavityPlate: { width: number; length: number; height: number }
  punchPlate: { width: number; length: number; height: number }
  spacerBlocks: { width: number; length: number; height: number }
  ejectorPlate: { width: number; length: number; height: number }
  bottomPlate: { width: number; length: number; height: number }
}
interface Analysis {
  suggestedCavities?: number; injectionType?: string; nozzleCount?: number
  moldSeries?: string; estimatedCycles?: string; productType?: string
  needsDrawers?: boolean
}
interface Props {
  plates?: PlateStack
  pieceX: number; pieceY: number; pieceZ: number
  cavities: number; steelType: string
  analysis?: Analysis
  calculation?: any
  projectName?: string
}

// 1mm = 1/SCALE Three.js units
const SCALE = 16

// ── Mold geometry scene ────────────────────────────────────────────────────────
function MoldMesh({ plates, pieceX, pieceY, pieceZ, cavities, steelType, isOpen }: {
  plates: PlateStack; pieceX: number; pieceY: number; pieceZ: number
  cavities: number; steelType: string; isOpen: boolean
}) {
  const movingRef = useRef<THREE.Group>(null)
  const productRef = useRef<THREE.Mesh>(null)
  const openProgress = useRef(0)

  const w   = plates.topPlate.width  / SCALE
  const d   = plates.topPlate.length / SCALE
  const topH   = Math.max(plates.topPlate.height   / SCALE, 0.8)
  const cavH   = Math.max(plates.cavityPlate.height / SCALE, 2.0)
  const punchH = Math.max(plates.punchPlate.height  / SCALE, 2.0)
  const spacH  = Math.max(plates.spacerBlocks.height / SCALE, 2.5)
  const ejH    = Math.max(plates.ejectorPlate.height / SCALE, 0.8)
  const botH   = Math.max(plates.bottomPlate.height  / SCALE, 0.8)

  const openGap   = Math.max(pieceZ / SCALE + 1.2, 2.5)
  const totalH    = topH + cavH + punchH + spacH + ejH + botH
  const centerOff = totalH / 2 - (topH + cavH) + (topH + cavH) / 2

  const XPM   = '#7b93a8'
  const S1045 = '#8e8e9a'

  useFrame((_, delta) => {
    const target = isOpen ? 1 : 0
    openProgress.current += (target - openProgress.current) * Math.min(delta * 3.5, 1)

    if (movingRef.current) {
      movingRef.current.position.y = -openProgress.current * openGap
    }
    if (productRef.current) {
      const mat = productRef.current.material as THREE.MeshStandardMaterial
      mat.opacity = Math.max(0, openProgress.current * 1.1 - 0.1)
    }
  })

  // Fixed half Y positions (P1 — cavity/fêmea, stays put)
  const cavY  = cavH / 2
  const topY  = cavH + topH / 2

  // Moving half Y positions (P2 — punch/macho, moves down)
  const punchY = -punchH / 2
  const spacY  = -(punchH + spacH / 2)
  const ejY    = -(punchH + spacH + ejH / 2)
  const botY   = -(punchH + spacH + ejH + botH / 2)

  const cornerX = w / 2 - 0.55
  const cornerZ = d / 2 - 0.55
  const corners: [number, number][] = [[cornerX, cornerZ], [-cornerX, cornerZ], [cornerX, -cornerZ], [-cornerX, -cornerZ]]

  // Cavity layout
  const cavCols = cavities <= 4 ? cavities : Math.ceil(cavities / 2)
  const cavRows = Math.ceil(cavities / cavCols)
  const spacingX = (w * 0.6) / cavCols
  const spacingZ = (d * 0.6) / cavRows
  const pW = Math.min(pieceX / SCALE * 0.7, spacingX * 0.75)
  const pD = Math.min(pieceY / SCALE * 0.7, spacingZ * 0.75)
  const pH = pieceZ / SCALE

  return (
    <group position={[0, -centerOff, 0]}>

      {/* ── FIXED HALF (P1 — Cavity side) ───────────────────────────────── */}

      {/* Cavity plate — XPM premium steel */}
      <mesh position={[0, cavY, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, cavH, d]} />
        <meshStandardMaterial color={XPM} metalness={0.80} roughness={0.20} />
      </mesh>

      {/* Top plate — 1045 */}
      <mesh position={[0, topY, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, topH, d]} />
        <meshStandardMaterial color={S1045} metalness={0.65} roughness={0.30} />
      </mesh>

      {/* Sprue bushing center of top plate */}
      <mesh position={[0, cavH + topH + 0.08, 0]}>
        <cylinderGeometry args={[0.16, 0.30, 0.22, 16]} />
        <meshStandardMaterial color="#1c1c1c" metalness={0.92} roughness={0.18} />
      </mesh>
      <mesh position={[0, cavH + topH - 0.05, 0]}>
        <cylinderGeometry args={[0.10, 0.10, topH * 0.6, 12]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Guide columns (fixed to cavity plate, enter punch plate) */}
      {corners.map(([cx, cz], i) => (
        <group key={i}>
          {/* Column body */}
          <mesh position={[cx, cavY + cavH / 2 + 0.9, cz]} castShadow>
            <cylinderGeometry args={[0.13, 0.13, 1.8, 14]} />
            <meshStandardMaterial color="#d8d8d8" metalness={0.95} roughness={0.08} />
          </mesh>
          {/* Column flange */}
          <mesh position={[cx, cavY + cavH / 2 + 0.04, cz]}>
            <cylinderGeometry args={[0.22, 0.22, 0.12, 14]} />
            <meshStandardMaterial color="#b0b0b0" metalness={0.85} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* Cavity imprints (visible on parting surface) */}
      {Array.from({ length: cavities }).map((_, ci) => {
        const row = Math.floor(ci / cavCols) - (cavRows - 1) / 2
        const col = (ci % cavCols) - (cavCols - 1) / 2
        return (
          <mesh key={ci} position={[col * spacingX, 0.06, row * spacingZ]}>
            <boxGeometry args={[pW, 0.18, pD]} />
            <meshStandardMaterial color="#0d1e2c" metalness={0.6} roughness={0.35} />
          </mesh>
        )
      })}

      {/* Cooling channels outlets on side of cavity plate */}
      {[0.25, 0.5, 0.75].map((f, i) => (
        <group key={i}>
          <mesh position={[w / 2 + 0.01, cavH * f - cavH / 2 + cavY - cavY, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.08, 0.08, 0.12, 10]} />
            <meshStandardMaterial color="#1a3a28" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[w / 2 + 0.01, cavH * f - cavH / 2 + cavY - cavY, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 0.16, 8]} />
            <meshStandardMaterial color="#3aaa70" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* ── MOVING HALF (P2 — Punch side) ───────────────────────────────── */}
      <group ref={movingRef}>

        {/* Punch plate — XPM */}
        <mesh position={[0, punchY, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, punchH, d]} />
          <meshStandardMaterial color={XPM} metalness={0.80} roughness={0.20} />
        </mesh>

        {/* Guide column bores */}
        {corners.map(([cx, cz], i) => (
          <mesh key={i} position={[cx, punchY + punchH / 2 - 0.05, cz]}>
            <cylinderGeometry args={[0.145, 0.145, 0.25, 14]} />
            <meshStandardMaterial color="#101010" metalness={0.4} roughness={0.7} />
          </mesh>
        ))}

        {/* Spacer blocks — LEFT and RIGHT sides */}
        <mesh position={[-(w / 2 - 0.35), spacY, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.70, spacH, d]} />
          <meshStandardMaterial color={S1045} metalness={0.65} roughness={0.30} />
        </mesh>
        <mesh position={[(w / 2 - 0.35), spacY, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.70, spacH, d]} />
          <meshStandardMaterial color={S1045} metalness={0.65} roughness={0.30} />
        </mesh>

        {/* Ejector plate */}
        <mesh position={[0, ejY, 0]} castShadow receiveShadow>
          <boxGeometry args={[w - 1.4, ejH, d]} />
          <meshStandardMaterial color="#909098" metalness={0.55} roughness={0.40} />
        </mesh>

        {/* Bottom plate — 1045 */}
        <mesh position={[0, botY, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, botH, d]} />
          <meshStandardMaterial color={S1045} metalness={0.65} roughness={0.30} />
        </mesh>

        {/* Ejector pins (visible in spacer gap) */}
        {[[-0.4, -0.28], [0.4, -0.28], [-0.4, 0.28], [0.4, 0.28], [0, 0]].map(([ex, ez], i) => (
          <mesh key={i} position={[ex * w * 0.35, spacY + ejH * 0.1, ez * d * 0.3]}>
            <cylinderGeometry args={[0.042, 0.042, spacH + ejH * 0.8, 8]} />
            <meshStandardMaterial color="#c0c8d0" metalness={0.92} roughness={0.12} />
          </mesh>
        ))}

        {/* Core pins on punch plate (protrusions) */}
        {Array.from({ length: cavities }).map((_, ci) => {
          const row = Math.floor(ci / cavCols) - (cavRows - 1) / 2
          const col = (ci % cavCols) - (cavCols - 1) / 2
          return (
            <mesh key={ci} position={[col * spacingX, -punchH / 2 - 0.10, row * spacingZ]}>
              <boxGeometry args={[pW * 0.82, 0.25, pD * 0.82]} />
              <meshStandardMaterial color="#0d1e2c" metalness={0.65} roughness={0.30} />
            </mesh>
          )
        })}
      </group>

      {/* ── PRODUCT (visible when mold opens) ───────────────────────────── */}
      <mesh ref={productRef} position={[0, pH / 2, 0]} castShadow>
        <boxGeometry args={[pW * 1.02, pH, pD * 1.02]} />
        <meshStandardMaterial
          color="#d63a10"
          metalness={0.02}
          roughness={0.55}
          transparent
          opacity={0}
        />
      </mesh>
    </group>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function MoldViewer3D({
  plates, pieceX, pieceY, pieceZ, cavities, steelType, analysis, calculation, projectName
}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  if (!plates) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Preencha as dimensões para visualizar o molde em 3D
      </div>
    )
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ height: 540 }}>
      {/* ── 3D Canvas ── */}
      <Canvas
        shadows
        camera={{ position: [14, 9, 18], fov: 42 }}
        gl={{ antialias: true }}
        style={{ background: 'linear-gradient(150deg, #070e1a 0%, #0c1a34 60%, #080f1c 100%)' }}
      >
        <ambientLight intensity={0.35} />
        {/* Key light — upper right front */}
        <directionalLight
          position={[12, 18, 12]} intensity={1.4} castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={0.5} shadow-camera-far={60}
          shadow-camera-left={-20} shadow-camera-right={20}
          shadow-camera-top={20} shadow-camera-bottom={-20}
        />
        {/* Fill light — left cool */}
        <directionalLight position={[-10, 6, -6]} intensity={0.45} color="#90b8e0" />
        {/* Rim light — behind */}
        <pointLight position={[0, 12, -14]} intensity={0.5} color="#ffffff" />
        {/* Ground bounce */}
        <pointLight position={[0, -10, 0]} intensity={0.15} color="#3060a0" />

        <MoldMesh
          plates={plates}
          pieceX={pieceX} pieceY={pieceY} pieceZ={pieceZ}
          cavities={cavities} steelType={steelType}
          isOpen={isOpen}
        />

        {/* Floor grid */}
        <Grid
          position={[0, -8, 0]}
          args={[40, 40]}
          cellSize={1} cellThickness={0.4} cellColor="#1a3a6a"
          sectionSize={5} sectionThickness={0.8} sectionColor="#1e4080"
          fadeDistance={30} fadeStrength={1.2} infiniteGrid
        />

        <OrbitControls
          enablePan={false}
          minDistance={6} maxDistance={40}
          maxPolarAngle={Math.PI / 1.75}
          rotateSpeed={0.65}
        />
      </Canvas>

      {/* ── HTML Overlay ── */}
      <div className="absolute inset-0 pointer-events-none">

        {/* Top-left: Identificação do projeto */}
        <div className="absolute top-4 left-4 pointer-events-none">
          <div className="bg-black/65 backdrop-blur-md border border-white/10 rounded-xl p-3.5 shadow-xl">
            <p className="text-white/95 font-bold text-sm tracking-wide uppercase">
              {projectName ?? 'Molde de Injeção'}
            </p>
            <p className="text-blue-300 text-xs mt-0.5 font-mono">
              {cavities} Cav · XPM + 1045
            </p>
            <p className="text-slate-400 text-xs mt-0.5">
              Peça: {pieceX}×{pieceY}×{pieceZ} mm
            </p>
            {analysis?.moldSeries && (
              <div className="mt-2 pt-2 border-t border-white/10">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Série </span>
                <span className="text-blue-300 font-bold text-xs">{analysis.moldSeries}</span>
                {analysis.estimatedCycles && (
                  <span className="text-slate-500 text-[10px] ml-2">· {analysis.estimatedCycles} ciclos</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Top-right: Valores financeiros */}
        {calculation && (
          <div className="absolute top-4 right-4 pointer-events-none">
            <div className="bg-black/65 backdrop-blur-md border border-white/10 rounded-xl p-3.5 shadow-xl min-w-[172px]">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Investimento Total</p>
              <p className="text-green-400 font-bold text-xl tabular-nums">
                {BRL.format(calculation.totalProject)}
              </p>
              <div className="mt-2.5 space-y-1 border-t border-white/10 pt-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Material aço</span>
                  <span className="text-slate-200 font-medium tabular-nums">{BRL.format(calculation.totalMaterial)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Mão de obra</span>
                  <span className="text-slate-200 font-medium tabular-nums">{BRL.format(calculation.totalLabor)}</span>
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-white/10 space-y-0.5">
                <p className="text-[9px] text-slate-600 uppercase tracking-widest">Condições</p>
                <p className="text-[10px] text-slate-400">40% entrada · 30% T1 · 30% entrega</p>
              </div>
            </div>
          </div>
        )}

        {/* Bottom-center: Controles */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-3">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              'px-6 py-2.5 rounded-full font-semibold text-sm tracking-wide transition-all duration-200',
              'border shadow-lg backdrop-blur-sm flex items-center gap-2',
              isOpen
                ? 'bg-blue-600/80 border-blue-400/50 text-white hover:bg-blue-500/80'
                : 'bg-emerald-600/80 border-emerald-400/50 text-white hover:bg-emerald-500/80'
            )}
          >
            <span className="text-base">{isOpen ? '🔒' : '🔓'}</span>
            {isOpen ? 'Fechar Molde' : 'Abrir Molde'}
          </button>

          <a
            href="https://www.polimold.com.br/porta-moldes"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-full text-xs font-medium text-cyan-300 border border-cyan-500/30 bg-black/45 backdrop-blur-sm hover:bg-cyan-900/30 transition-colors"
          >
            📐 Catálogo Polimold
          </a>
        </div>

        {/* Hint de interação */}
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2">
          <p className="text-white/20 text-[10px] tracking-widest text-center whitespace-nowrap select-none">
            ARRASTE PARA ROTACIONAR · SCROLL PARA ZOOM
          </p>
        </div>

        {/* Tag EUROMOLDES */}
        <div className="absolute bottom-4 right-4">
          <p className="text-white/15 text-[9px] tracking-[0.2em] font-mono uppercase select-none">
            EUROMOLDES · NEUROFLUX
          </p>
        </div>

        {/* Indicador quando aberto */}
        {isOpen && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2">
            <div className="bg-emerald-900/60 border border-emerald-400/40 rounded-full px-4 py-1.5 backdrop-blur-sm">
              <p className="text-emerald-300 text-xs font-semibold tracking-wide">
                ✓ Produto visível na cavidade
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
