/**
 * Motor de Cálculo de Moldes — NeuroFlux Mold Enterprise
 * Baseado na planilha Euromoldes
 */

export interface PieceSize {
  x: number  // mm
  y: number  // mm
  z: number  // mm
}

export interface MoldParams {
  pieceSize: PieceSize
  cavities: number
  hasDrawers: boolean
  drawerCount: number
  polishLevel: 'STANDARD' | 'SEMI_GLOSS' | 'MIRROR'
  steelType: 'S1045' | 'P20' | 'H13'
  riskMargin: number    // % (default 15)
  profitMargin: number  // % (default 20)
  taxRate: number       // % (default 8)
  pricing: PricingData
}

export interface PricingData {
  hourlyRate: number   // R$/h (padrão 150)
  steelS1045: number  // R$/kg
  steelP20: number    // R$/kg
  steelH13: number    // R$/kg
  pinSet: number       // R$ (conjunto pinos)
  springSet: number    // R$ (conjunto molas)
  columnSet: number    // R$ (conjunto colunas)
  manifold: number     // R$ (manifold câmara quente, se aplicável)
}

export interface PlateStack {
  topPlate: { width: number; length: number; height: number }
  cavityPlate: { width: number; length: number; height: number }
  punchPlate: { width: number; length: number; height: number }
  spacerBlocks: { width: number; length: number; height: number }
  ejectorPlate: { width: number; length: number; height: number }
  bottomPlate: { width: number; length: number; height: number }
}

export interface LaborBreakdown {
  machining: { hours: number; cost: number; description: string }
  erosion: { hours: number; cost: number; description: string }
  bench: { hours: number; cost: number; description: string }
  grinding: { hours: number; cost: number; description: string }
  total: number
}

export interface MoldResult {
  plates: PlateStack
  moldWeight: number       // kg
  steelWeight: number      // kg
  labor: LaborBreakdown
  materials: {
    steel: number
    pins: number
    springs: number
    columns: number
    manifold: number
    total: number
  }
  subtotal: number
  riskValue: number
  profitValue: number
  taxValue: number
  total: number
}

const STEEL_DENSITY = 7.85 // kg/dm³ = g/cm³

function getSteelPrice(type: string, pricing: PricingData): number {
  if (type === 'S1045') return pricing.steelS1045
  if (type === 'H13') return pricing.steelH13
  return pricing.steelP20
}

function calcPlateVolume(w: number, l: number, h: number): number {
  // Volume em dm³ (para resultado em kg)
  return (w / 100) * (l / 100) * (h / 100)
}

function calcPlateWeight(w: number, l: number, h: number): number {
  return calcPlateVolume(w, l, h) * STEEL_DENSITY
}

export function calculateMoldDimensions(piece: PieceSize, cavities: number): PlateStack {
  const SAFETY_MARGIN = 50  // mm por lado

  // Dimensões base do molde
  let plateWidth = piece.x + SAFETY_MARGIN * 2
  let plateLength = piece.y + SAFETY_MARGIN * 2

  // Para múltiplas cavidades: layout em H (dobra uma dimensão)
  if (cavities === 2) {
    plateLength = piece.y * 2 + SAFETY_MARGIN * 3
  } else if (cavities === 4) {
    plateWidth = piece.x * 2 + SAFETY_MARGIN * 3
    plateLength = piece.y * 2 + SAFETY_MARGIN * 3
  } else if (cavities > 4) {
    const cols = Math.ceil(Math.sqrt(cavities))
    const rows = Math.ceil(cavities / cols)
    plateWidth = piece.x * cols + SAFETY_MARGIN * (cols + 1)
    plateLength = piece.y * rows + SAFETY_MARGIN * (rows + 1)
  }

  // Alturas das placas (norma Euromoldes)
  const topPlateH = piece.z < 30 ? 27 : piece.z < 60 ? 37 : 57
  const cavityPlateH = piece.z + 30   // Porta-postiço cavidade = peça + 30mm
  const punchPlateH = piece.z + 20    // Porta-postiço punção = peça + 20mm
  const spacerH = piece.z + 50        // Calços = peça + 50mm (curso extrator)
  const ejectorPlateH = 20            // Placa extratora padrão
  const bottomPlateH = topPlateH      // Simétrica à superior

  return {
    topPlate:     { width: plateWidth, length: plateLength, height: topPlateH },
    cavityPlate:  { width: plateWidth, length: plateLength, height: cavityPlateH },
    punchPlate:   { width: plateWidth, length: plateLength, height: punchPlateH },
    spacerBlocks: { width: 80, length: plateLength, height: spacerH },   // Calços ~80mm de largura
    ejectorPlate: { width: plateWidth - 20, length: plateLength - 20, height: ejectorPlateH },
    bottomPlate:  { width: plateWidth, length: plateLength, height: bottomPlateH },
  }
}

function calcLaborHours(piece: PieceSize, cavities: number, polishLevel: string): LaborBreakdown {
  const area = piece.x * piece.y // mm²
  const areaFactor = Math.sqrt(area) / 100

  // Horas base de usinagem
  let machiningBase = 20 + areaFactor * 8 + cavities * 5
  let erosionBase   = 10 + areaFactor * 4 + cavities * 3
  let benchBase     = 8  + areaFactor * 2 + cavities * 2
  let grindingBase  = 6  + areaFactor * 1

  // Multiplicadores de polimento
  if (polishLevel === 'SEMI_GLOSS') {
    benchBase    *= 1.4
    grindingBase *= 1.5
  } else if (polishLevel === 'MIRROR') {
    benchBase    *= 2.0
    grindingBase *= 2.5
  }

  // Arredonda para 0.5h
  const round = (h: number) => Math.round(h * 2) / 2

  return {
    machining: { hours: round(machiningBase), cost: 0, description: 'Usinagem CNC / Fresamento' },
    erosion:   { hours: round(erosionBase),   cost: 0, description: 'Eletroerosão / EDM' },
    bench:     { hours: round(benchBase),     cost: 0, description: 'Bancada / Ajustagem' },
    grinding:  { hours: round(grindingBase),  cost: 0, description: 'Retífica e Polimento' },
    total: 0,
  }
}

export function calculateMold(params: MoldParams): MoldResult {
  const { pieceSize, cavities, hasDrawers, drawerCount, polishLevel, steelType, pricing } = params

  // 1. Dimensões das placas
  const plates = calculateMoldDimensions(pieceSize, cavities)

  // 2. Peso do aço (soma todas as placas)
  const allPlates = [
    plates.topPlate,
    plates.cavityPlate,
    plates.punchPlate,
    { ...plates.spacerBlocks, width: plates.spacerBlocks.width * 2 }, // 2 calços
    plates.ejectorPlate,
    plates.bottomPlate,
  ]

  let steelWeight = allPlates.reduce(
    (sum, p) => sum + calcPlateWeight(p.width, p.length, p.height),
    0
  )

  if (hasDrawers && drawerCount > 0) {
    steelWeight *= 1 + drawerCount * 0.08 // +8% por gaveta
  }

  const steelPrice = getSteelPrice(steelType, pricing)
  const steelCost  = steelWeight * steelPrice

  // 3. Componentes padronizados
  const pinsCost    = pricing.pinSet * cavities
  const springsCost = pricing.springSet
  const columnsCost = pricing.columnSet
  const manifoldCost = 0 // Só se câmara quente (não implementado nesta versão)

  const materialTotal = steelCost + pinsCost + springsCost + columnsCost + manifoldCost

  // 4. Mão de obra
  const labor = calcLaborHours(pieceSize, cavities, polishLevel)
  labor.machining.cost = labor.machining.hours * pricing.hourlyRate
  labor.erosion.cost   = labor.erosion.hours   * pricing.hourlyRate
  labor.bench.cost     = labor.bench.hours      * pricing.hourlyRate
  labor.grinding.cost  = labor.grinding.hours   * pricing.hourlyRate
  labor.total = labor.machining.cost + labor.erosion.cost + labor.bench.cost + labor.grinding.cost

  // 5. Financeiro
  const subtotal    = materialTotal + labor.total
  const riskValue   = subtotal * (params.riskMargin / 100)
  const profitValue = (subtotal + riskValue) * (params.profitMargin / 100)
  const taxBase     = subtotal + riskValue + profitValue
  const taxValue    = taxBase * (params.taxRate / 100)
  const total       = taxBase + taxValue

  return {
    plates,
    moldWeight: steelWeight,
    steelWeight,
    labor,
    materials: {
      steel: steelCost,
      pins: pinsCost,
      springs: springsCost,
      columns: columnsCost,
      manifold: manifoldCost,
      total: materialTotal,
    },
    subtotal,
    riskValue,
    profitValue,
    taxValue,
    total,
  }
}
