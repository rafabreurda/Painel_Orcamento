/**
 * NeuroFlux Mold Enterprise — Cálculo client-side v2.0
 * Sincronizado com backend/src/services/moldCalculator.ts
 * Usa catálogo Polimold real + preços Brasil 2024/2025
 */

interface PieceSize { x: number; y: number; z: number }

export interface PlateStack {
  topPlate:     { width: number; length: number; height: number; material?: string }
  cavityPlate:  { width: number; length: number; height: number; material?: string }
  punchPlate:   { width: number; length: number; height: number; material?: string }
  spacerBlocks: { width: number; length: number; height: number; material?: string }
  ejectorPlate: { width: number; length: number; height: number; material?: string }
  bottomPlate:  { width: number; length: number; height: number; material?: string }
  seriesLabel?: string
  cavityLayout?: { cols: number; rows: number }
}

// ─── Catálogo Polimold (espelho do backend) ───────────────────────────
const POLIMOLD_CATALOG = [
  { series: '15', w: 150, l: 150 }, { series: '15', w: 150, l: 200 }, { series: '15', w: 150, l: 250 },
  { series: '20', w: 200, l: 200 }, { series: '20', w: 200, l: 250 }, { series: '20', w: 200, l: 300 },
  { series: '20', w: 200, l: 350 }, { series: '20', w: 200, l: 400 },
  { series: '25', w: 250, l: 250 }, { series: '25', w: 250, l: 300 }, { series: '25', w: 250, l: 350 },
  { series: '25', w: 250, l: 400 }, { series: '25', w: 250, l: 450 }, { series: '25', w: 250, l: 500 },
  { series: '30', w: 300, l: 300 }, { series: '30', w: 300, l: 350 }, { series: '30', w: 300, l: 400 },
  { series: '30', w: 300, l: 450 }, { series: '30', w: 300, l: 500 }, { series: '30', w: 300, l: 600 },
  { series: '35', w: 350, l: 350 }, { series: '35', w: 350, l: 400 }, { series: '35', w: 350, l: 450 },
  { series: '35', w: 350, l: 500 }, { series: '35', w: 350, l: 600 },
  { series: '40', w: 400, l: 400 }, { series: '40', w: 400, l: 450 }, { series: '40', w: 400, l: 500 },
  { series: '40', w: 400, l: 600 },
  { series: '45', w: 450, l: 450 }, { series: '45', w: 450, l: 500 }, { series: '45', w: 450, l: 600 },
  { series: '50', w: 500, l: 500 }, { series: '50', w: 500, l: 600 },
  { series: '60', w: 600, l: 600 },
]

function getCavityLayout(cavities: number): { cols: number; rows: number } {
  const map: Record<number, { cols: number; rows: number }> = {
    1: { cols: 1, rows: 1 }, 2: { cols: 1, rows: 2 }, 4: { cols: 2, rows: 2 },
    6: { cols: 2, rows: 3 }, 8: { cols: 2, rows: 4 }, 12: { cols: 3, rows: 4 },
    16: { cols: 4, rows: 4 }, 24: { cols: 4, rows: 6 }, 32: { cols: 4, rows: 8 },
  }
  if (map[cavities]) return map[cavities]
  const cols = Math.ceil(Math.sqrt(cavities))
  return { cols, rows: Math.ceil(cavities / cols) }
}

function selectPolimold(requiredW: number, requiredL: number) {
  const [rw, rl] = requiredW <= requiredL ? [requiredW, requiredL] : [requiredL, requiredW]
  return POLIMOLD_CATALOG.find(p => p.w >= rw && p.l >= rl)
    ?? { series: '60+', w: Math.ceil(rw / 50) * 50, l: Math.ceil(rl / 50) * 50 }
}

function getThicknesses(series: string, pieceZ: number) {
  const s = Number(series.replace('+', '')) || 60
  const fixH   = s <= 20 ? 25 : s <= 30 ? 28 : s <= 40 ? 32 : 35
  const cavH   = pieceZ + (s <= 20 ? 28 : s <= 30 ? 32 : s <= 40 ? 38 : 45)
  const punchH = pieceZ + (s <= 20 ? 22 : s <= 30 ? 26 : s <= 40 ? 32 : 38)
  const spacerH = Math.round(Math.max(pieceZ * 1.25, pieceZ + 15) + 25)
  const ejectorH = s <= 20 ? 20 : s <= 35 ? 22 : 25
  return { fixH, cavH, punchH, spacerH, ejectorH }
}

export function calculateMoldDimensions(piece: PieceSize, cavities: number): PlateStack {
  const layout = getCavityLayout(cavities)
  const wallSide = Math.max(30, piece.x * 0.18)
  const wallBetw = Math.max(20, piece.x * 0.12)
  const rw = Math.ceil((layout.cols * piece.x + 2 * wallSide + (layout.cols - 1) * wallBetw) * 1.08)
  const rl = Math.ceil((layout.rows * piece.y + 2 * wallSide + (layout.rows - 1) * wallBetw) * 1.08)
  const polimold = selectPolimold(rw, rl)
  const { fixH, cavH, punchH, spacerH, ejectorH } = getThicknesses(polimold.series, piece.z)
  const pw = polimold.w, pl = polimold.l

  return {
    topPlate:     { width: pw, length: pl, height: fixH,      material: 'S1045' },
    cavityPlate:  { width: pw, length: pl, height: cavH,      material: 'P20' },
    punchPlate:   { width: pw, length: pl, height: punchH,    material: 'P20' },
    spacerBlocks: { width: Math.round(pw * 0.22), length: pl, height: spacerH, material: 'S1045' },
    ejectorPlate: { width: pw - 20, length: pl - 20, height: ejectorH, material: 'P20' },
    bottomPlate:  { width: pw, length: pl, height: fixH,      material: 'S1045' },
    seriesLabel:  `Série ${polimold.series} — ${polimold.w}×${polimold.l}mm`,
    cavityLayout: layout,
  }
}
