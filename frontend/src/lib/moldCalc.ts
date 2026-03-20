/**
 * Cálculo de dimensões do molde — cópia client-side para uso offline/sketch
 * Mantida em sync com backend/src/services/moldCalculator.ts
 */

interface PieceSize { x: number; y: number; z: number }

export interface PlateStack {
  topPlate:     { width: number; length: number; height: number }
  cavityPlate:  { width: number; length: number; height: number }
  punchPlate:   { width: number; length: number; height: number }
  spacerBlocks: { width: number; length: number; height: number }
  ejectorPlate: { width: number; length: number; height: number }
  bottomPlate:  { width: number; length: number; height: number }
}

export function calculateMoldDimensions(piece: PieceSize, cavities: number): PlateStack {
  const SAFETY_MARGIN = 50
  let plateWidth  = piece.x + SAFETY_MARGIN * 2
  let plateLength = piece.y + SAFETY_MARGIN * 2

  if (cavities === 2) {
    plateLength = piece.y * 2 + SAFETY_MARGIN * 3
  } else if (cavities === 4) {
    plateWidth  = piece.x * 2 + SAFETY_MARGIN * 3
    plateLength = piece.y * 2 + SAFETY_MARGIN * 3
  } else if (cavities > 4) {
    const cols = Math.ceil(Math.sqrt(cavities))
    const rows = Math.ceil(cavities / cols)
    plateWidth  = piece.x * cols + SAFETY_MARGIN * (cols + 1)
    plateLength = piece.y * rows + SAFETY_MARGIN * (rows + 1)
  }

  const topPlateH    = piece.z < 30 ? 27 : piece.z < 60 ? 37 : 57
  const cavityPlateH = piece.z + 30
  const punchPlateH  = piece.z + 20
  const spacerH      = piece.z + 50
  const ejectorH     = 20
  const bottomPlateH = topPlateH

  return {
    topPlate:     { width: plateWidth, length: plateLength, height: topPlateH },
    cavityPlate:  { width: plateWidth, length: plateLength, height: cavityPlateH },
    punchPlate:   { width: plateWidth, length: plateLength, height: punchPlateH },
    spacerBlocks: { width: 80, length: plateLength, height: spacerH },
    ejectorPlate: { width: plateWidth - 20, length: plateLength - 20, height: ejectorH },
    bottomPlate:  { width: plateWidth, length: plateLength, height: bottomPlateH },
  }
}
