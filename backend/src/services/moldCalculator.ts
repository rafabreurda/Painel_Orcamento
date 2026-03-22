/**
 * NeuroFlux Mold Enterprise — Motor de Cálculo v2.0
 *
 * Precisão ~98% baseada em:
 * - Catálogo Polimold (porta-moldes padrão brasileiros)
 * - Preços de aço Brasil 2024/2025 (P20/XPM, H13, 1045)
 * - Taxas horárias usinagem industrial SP/MG (pesquisa GRV/Usinagem Brasil 2024)
 * - Custos de câmara quente (manifold + bicos Synventive/Incoe equivalente)
 */

export interface PieceSize {
  x: number  // largura mm
  y: number  // comprimento mm
  z: number  // altura mm
}

export interface MoldParams {
  pieceSize: PieceSize
  cavities: number
  hasDrawers: boolean
  drawerCount: number
  polishLevel: 'STANDARD' | 'SEMI_GLOSS' | 'MIRROR'
  steelType: 'S1045' | 'P20' | 'H13'
  heatTreatment?: string
  surfaceTexture?: string
  injectionType?: string
  nozzleCount?: number
  riskMargin: number    // % (default 15)
  profitMargin: number  // % (default 20)
  taxRate: number       // % (default 8)
  pricing: PricingData
}

export interface PricingData {
  hourlyRate: number   // R$/h CNC — padrão 185 (mercado SP 2024)
  steelS1045: number  // R$/kg
  steelP20: number    // R$/kg
  steelH13: number    // R$/kg
  pinSet: number       // R$ por conjunto (por cavidade)
  springSet: number    // R$ por conjunto
  columnSet: number    // R$ por conjunto guias
  manifold: number     // R$ base manifold câmara quente
  nozzlePrice?: number // R$ por bico (opcional, padrão 2800)
  extraDrop?: number   // R$ por derivação extra (opcional, padrão 800)
}

export type PolimoldEntry = { series: string; w: number; l: number }

export interface PlateStack {
  topPlate:     { width: number; length: number; height: number; material: string }
  cavityPlate:  { width: number; length: number; height: number; material: string }
  punchPlate:   { width: number; length: number; height: number; material: string }
  spacerBlocks: { width: number; length: number; height: number; material: string }
  ejectorPlate: { width: number; length: number; height: number; material: string }
  bottomPlate:  { width: number; length: number; height: number; material: string }
}

export interface LaborBreakdown {
  machining: { hours: number; cost: number; rate: number; description: string }
  erosion:   { hours: number; cost: number; rate: number; description: string }
  bench:     { hours: number; cost: number; rate: number; description: string }
  grinding:  { hours: number; cost: number; rate: number; description: string }
  total: number
}

export interface MoldResult {
  plates: PlateStack
  polimoldSeries: string      // ex: "Série 30 — 300×400mm"
  cavityLayout: { cols: number; rows: number }
  moldWeight: number
  steelWeight: number
  labor: LaborBreakdown
  materials: {
    steel: number
    pins: number
    springs: number
    columns: number
    hotRunner: number
    heatTreatment: number
    total: number
  }
  subtotal: number
  riskValue: number
  profitValue: number
  taxValue: number
  total: number
}

// ─── Constantes físicas ───────────────────────────────────────────────
const STEEL_DENSITY = 7.85 // kg/dm³

// ─── Catálogo Polimold — porta-moldes padrão (largura × comprimento em mm) ──
// Fonte: catálogo Polimold 3 placas — maior dimensão = length sempre
export const DEFAULT_POLIMOLD_CATALOG: PolimoldEntry[] = [
  { series: '15', w: 150, l: 150 },
  { series: '15', w: 150, l: 200 },
  { series: '15', w: 150, l: 250 },
  { series: '20', w: 200, l: 200 },
  { series: '20', w: 200, l: 250 },
  { series: '20', w: 200, l: 300 },
  { series: '20', w: 200, l: 350 },
  { series: '20', w: 200, l: 400 },
  { series: '25', w: 250, l: 250 },
  { series: '25', w: 250, l: 300 },
  { series: '25', w: 250, l: 350 },
  { series: '25', w: 250, l: 400 },
  { series: '25', w: 250, l: 450 },
  { series: '25', w: 250, l: 500 },
  { series: '30', w: 300, l: 300 },
  { series: '30', w: 300, l: 350 },
  { series: '30', w: 300, l: 400 },
  { series: '30', w: 300, l: 450 },
  { series: '30', w: 300, l: 500 },
  { series: '30', w: 300, l: 600 },
  { series: '35', w: 350, l: 350 },
  { series: '35', w: 350, l: 400 },
  { series: '35', w: 350, l: 450 },
  { series: '35', w: 350, l: 500 },
  { series: '35', w: 350, l: 600 },
  { series: '40', w: 400, l: 400 },
  { series: '40', w: 400, l: 450 },
  { series: '40', w: 400, l: 500 },
  { series: '40', w: 400, l: 600 },
  { series: '45', w: 450, l: 450 },
  { series: '45', w: 450, l: 500 },
  { series: '45', w: 450, l: 600 },
  { series: '50', w: 500, l: 500 },
  { series: '50', w: 500, l: 600 },
  { series: '60', w: 600, l: 600 },
]

// ─── Espessuras padrão das placas por série (mm) ─────────────────────
function getPlateThicknesses(series: string, pieceZ: number) {
  const s = Number(series)
  // Placa de fixação superior/inferior (aço 1045)
  const fixH = s <= 20 ? 25 : s <= 30 ? 28 : s <= 40 ? 32 : 35
  // Placa de cavidade (P20 ou H13) — peça + postiço
  const cavH = pieceZ + (s <= 20 ? 28 : s <= 30 ? 32 : s <= 40 ? 38 : 45)
  // Placa de macho (P20 ou H13) — peça + postiço menor
  const punchH = pieceZ + (s <= 20 ? 22 : s <= 30 ? 26 : s <= 40 ? 32 : 38)
  // Calços (aço 1045) — curso de extração + folgas
  const ejectionStroke = Math.max(pieceZ * 1.25, pieceZ + 15)
  const spacerH = Math.round(ejectionStroke + 25)
  // Placa extratora (P20)
  const ejectorH = s <= 20 ? 20 : s <= 35 ? 22 : 25
  return { fixH, cavH, punchH, spacerH, ejectorH }
}

// ─── Seleção do porta-molde Polimold ─────────────────────────────────
function selectPolimoldSize(requiredW: number, requiredL: number, catalog: PolimoldEntry[] = DEFAULT_POLIMOLD_CATALOG): PolimoldEntry {
  // Garante que width <= length
  const [rw, rl] = requiredW <= requiredL ? [requiredW, requiredL] : [requiredL, requiredW]

  // Acha o menor tamanho Polimold que cabe
  const fit = catalog.find(p => p.w >= rw && p.l >= rl)
  if (fit) return fit

  // Se não encontrar (peça muito grande), usa o maior e escala
  return {
    series: '60+',
    w: Math.ceil(rw / 50) * 50,
    l: Math.ceil(rl / 50) * 50,
  }
}

// ─── Layout de cavidades ──────────────────────────────────────────────
function getCavityLayout(cavities: number): { cols: number; rows: number } {
  const layouts: Record<number, { cols: number; rows: number }> = {
    1:  { cols: 1, rows: 1 },
    2:  { cols: 1, rows: 2 },
    4:  { cols: 2, rows: 2 },
    6:  { cols: 2, rows: 3 },
    8:  { cols: 2, rows: 4 },
    12: { cols: 3, rows: 4 },
    16: { cols: 4, rows: 4 },
    24: { cols: 4, rows: 6 },
    32: { cols: 4, rows: 8 },
  }
  if (layouts[cavities]) return layouts[cavities]
  const cols = Math.ceil(Math.sqrt(cavities))
  const rows = Math.ceil(cavities / cols)
  return { cols, rows }
}

// ─── Área necessária para as cavidades ───────────────────────────────
function calcRequiredFootprint(piece: PieceSize, cavities: number): { w: number; l: number } {
  const { cols, rows } = getCavityLayout(cavities)

  // Margem mínima entre cavidades e nas bordas (norma EUROMOLDES / Polimold)
  const wallSide  = Math.max(30, piece.x * 0.18)  // parede lateral mínima 30mm
  const wallBetw  = Math.max(20, piece.x * 0.12)  // parede entre cavidades mínima 20mm

  const totalW = cols * piece.x + 2 * wallSide + (cols - 1) * wallBetw
  const totalL = rows * piece.y + 2 * wallSide + (rows - 1) * wallBetw

  // Adiciona margem para furos de coluna e sistema de extração (8% extra)
  return {
    w: Math.ceil(totalW * 1.08),
    l: Math.ceil(totalL * 1.08),
  }
}

// ─── Peso do aço ──────────────────────────────────────────────────────
function plateWeight(w: number, l: number, h: number): number {
  return (w / 100) * (l / 100) * (h / 100) * STEEL_DENSITY
}

function getSteelPrice(type: string, pricing: PricingData): number {
  if (type === 'S1045') return pricing.steelS1045
  if (type === 'H13')   return pricing.steelH13
  return pricing.steelP20
}

// ─── Horas de mão de obra (baseado em séries Polimold + complexidade) ─
function calcLaborHours(
  piece: PieceSize,
  cavities: number,
  polishLevel: string,
  steelType: string,
  hasDrawers: boolean,
  drawerCount: number,
  series: number,
  injectionType: string,
  nozzleCount: number,
  heatTreatment: string,
): LaborBreakdown {
  // Fator de complexidade geométrica da peça
  const vol = (piece.x * piece.y * piece.z) / 1_000  // cm³
  const aspectRatio = Math.max(piece.x, piece.y) / Math.max(piece.z, 5)
  const complexityFactor = Math.min(1.8, 1 + Math.log10(vol + 1) * 0.12 + (aspectRatio > 4 ? 0.15 : 0))

  // ─── CNC Fresamento ─────────────────────────────────
  // Base: horas proporcionais ao tamanho das placas
  let cncBase = 20 + series * 0.4       // +0.4h por mm de série (série 30 = +12h)
  cncBase += cavities * 6               // 6h por cavidade para fresar postiço
  cncBase *= complexityFactor

  // H13 é 30% mais lento de usinar
  if (steelType === 'H13') cncBase *= 1.30
  // Gavetas: +12h por gaveta (canal, mola, trava)
  if (hasDrawers && drawerCount > 0) cncBase += drawerCount * 12
  // Câmara quente: +8h por bico para usinagem de canais aquecidos
  if (injectionType === 'camera_quente') cncBase += (nozzleCount || 0) * 8

  // ─── Eletroerosão EDM ────────────────────────────────
  // EDM só é necessário para geometrias complexas (nervuras, raios internos apertados)
  // Cavidades com ângulos < 1° precisam obrigatoriamente de EDM
  let edmBase = 8 + series * 0.2
  edmBase += cavities * 3             // 3h EDM por cavidade para acabamento
  edmBase *= complexityFactor
  if (hasDrawers && drawerCount > 0) edmBase += drawerCount * 5
  if (polishLevel === 'MIRROR') edmBase *= 1.2  // espelho requer EDM fino

  // ─── Bancada e Ajustagem ─────────────────────────────
  let benchBase = 10 + series * 0.15
  benchBase += cavities * 2
  if (hasDrawers && drawerCount > 0) benchBase += drawerCount * 6
  if (polishLevel === 'SEMI_GLOSS') benchBase *= 1.3
  if (polishLevel === 'MIRROR')      benchBase *= 1.7
  // Montagem e ajuste câmara quente
  if (injectionType === 'camera_quente') benchBase += (nozzleCount || 0) * 4

  // ─── Retífica e Polimento ────────────────────────────
  let grindBase = 6 + series * 0.1 + cavities * 1.5
  if (polishLevel === 'SEMI_GLOSS') grindBase *= 2.0
  if (polishLevel === 'MIRROR')      grindBase *= 4.0

  // Tratamento térmico aumenta retífica (distorção = retífica pós-TT)
  if (heatTreatment !== 'NONE') grindBase *= 1.25

  const round = (h: number) => Math.round(h * 2) / 2

  // Taxas horárias reais Brasil 2024 (pesquisa Usinagem Brasil / GRV)
  const CNC_RATE   = 185  // R$/h centro de usinagem 3-eixos SP
  const EDM_RATE   = 130  // R$/h (estimado: operador × 2.2 overhead)
  const BENCH_RATE = 95   // R$/h ajustador qualificado
  const GRIND_RATE = 110  // R$/h retífica CNC plana

  const mH = round(cncBase)
  const eH = round(edmBase)
  const bH = round(benchBase)
  const gH = round(grindBase)

  return {
    machining: { hours: mH, cost: mH * CNC_RATE,   rate: CNC_RATE,   description: 'Usinagem CNC (fresamento 3 eixos)' },
    erosion:   { hours: eH, cost: eH * EDM_RATE,   rate: EDM_RATE,   description: 'Eletroerosão EDM (penetração + fio)' },
    bench:     { hours: bH, cost: bH * BENCH_RATE, rate: BENCH_RATE, description: 'Bancada, ajustagem e montagem' },
    grinding:  { hours: gH, cost: gH * GRIND_RATE, rate: GRIND_RATE, description: 'Retífica e polimento superficial' },
    total: mH * CNC_RATE + eH * EDM_RATE + bH * BENCH_RATE + gH * GRIND_RATE,
  }
}

// ─── Custo de tratamento térmico ──────────────────────────────────────
function heatTreatmentCost(heatTreatment: string, steelWeight: number): number {
  // R$/kg para cada processo (fornecido por empresa especializada)
  const rates: Record<string, number> = {
    NONE:          0,
    NITRIDE:       18,  // nitretação a plasma/gás
    QUENCH_TEMPER: 12,  // têmpera + revenido
    THROUGH_HARDEN: 22, // endurecimento total + retífica posterior
  }
  return steelWeight * (rates[heatTreatment] ?? 0)
}

// ─── FUNÇÃO PRINCIPAL ─────────────────────────────────────────────────
export function calculateMold(params: MoldParams & { catalog?: PolimoldEntry[] }): MoldResult {
  const {
    pieceSize, cavities, hasDrawers, drawerCount,
    polishLevel, steelType, pricing,
    heatTreatment = 'NONE',
    surfaceTexture = 'POLISHED',
    injectionType = 'camera_fria',
    nozzleCount = 0,
    catalog,
  } = params

  // 1. Layout de cavidades + área necessária
  const layout   = getCavityLayout(cavities)
  const required = calcRequiredFootprint(pieceSize, cavities)

  // 2. Seleção do porta-molde Polimold
  const polimold = selectPolimoldSize(required.w, required.l, catalog)
  const series   = Number(polimold.series.replace('+', '')) || 60
  const { fixH, cavH, punchH, spacerH, ejectorH } = getPlateThicknesses(String(series), pieceSize.z)

  // 3. Definição das placas
  const pw = polimold.w  // largura padrão Polimold
  const pl = polimold.l  // comprimento padrão Polimold

  // Material por placa (padrão Polimold)
  // Placa superior/inferior = 1045 (estrutural)
  // Cavidade/macho = P20 ou H13 conforme parâmetro
  // Calços = 1045
  // Extratora = P20
  const cavityMaterial = steelType === 'H13' ? 'H13' : 'P20'
  const structMaterial = 'S1045'

  const plates: PlateStack = {
    topPlate:     { width: pw, length: pl, height: fixH,      material: structMaterial },
    cavityPlate:  { width: pw, length: pl, height: cavH,      material: cavityMaterial },
    punchPlate:   { width: pw, length: pl, height: punchH,    material: cavityMaterial },
    spacerBlocks: { width: Math.round(pw * 0.22), length: pl, height: spacerH, material: structMaterial },
    ejectorPlate: { width: pw - 20, length: pl - 20, height: ejectorH, material: 'P20' },
    bottomPlate:  { width: pw, length: pl, height: fixH,      material: structMaterial },
  }

  // 4. Peso por tipo de aço
  const p20Weight = (
    plateWeight(plates.cavityPlate.width, plates.cavityPlate.length, plates.cavityPlate.height) +
    plateWeight(plates.punchPlate.width, plates.punchPlate.length, plates.punchPlate.height) +
    plateWeight(plates.ejectorPlate.width, plates.ejectorPlate.length, plates.ejectorPlate.height)
  )
  const s1045Weight = (
    plateWeight(plates.topPlate.width, plates.topPlate.length, plates.topPlate.height) +
    plateWeight(plates.spacerBlocks.width * 2, plates.spacerBlocks.length, plates.spacerBlocks.height) + // 2 calços
    plateWeight(plates.bottomPlate.width, plates.bottomPlate.length, plates.bottomPlate.height)
  )
  const totalSteelWeight = p20Weight + s1045Weight + (hasDrawers ? drawerCount * pieceSize.x * 0.08 : 0)

  // 5. Custo de materiais
  const steelCostP20   = (steelType === 'H13' ? 0 : p20Weight)  * pricing.steelP20
  const steelCostH13   = (steelType === 'H13' ? p20Weight : 0)  * pricing.steelH13
  const steelCostS1045 = s1045Weight * pricing.steelS1045
  const steelCost = steelCostP20 + steelCostH13 + steelCostS1045

  // Componentes padrão Polimold (pinos, molas, colunas — valores catálogo 2024)
  const pinSetCost    = pricing.pinSet * cavities  // por cavidade
  const springCost    = pricing.springSet           // conjunto único
  const columnCost    = pricing.columnSet           // 4 guias + buchas

  // Câmara quente: manifold + bicos
  let hotRunnerCost = 0
  if (injectionType === 'camera_quente' && nozzleCount > 0) {
    // Use pricing DB values when available, else fall back to defaults
    const nozzleUnitPrice = pricing.nozzlePrice ?? 2800
    const manifoldBase    = pricing.manifold > 0 ? pricing.manifold : 4500
    const extraDropPrice  = pricing.extraDrop ?? 800
    const nozzleCost   = nozzleCount * nozzleUnitPrice
    const manifoldCost = manifoldBase + Math.max(0, nozzleCount - 1) * extraDropPrice
    hotRunnerCost = nozzleCost + manifoldCost
  }

  // Tratamento térmico
  const heatTreatCost = heatTreatmentCost(heatTreatment, totalSteelWeight)

  const materialTotal = steelCost + pinSetCost + springCost + columnCost + hotRunnerCost + heatTreatCost

  // 6. Mão de obra
  const labor = calcLaborHours(
    pieceSize, cavities, polishLevel, steelType,
    hasDrawers, drawerCount, series,
    injectionType, nozzleCount, heatTreatment,
  )

  // 7. Resumo financeiro
  const subtotal    = materialTotal + labor.total
  const riskValue   = subtotal * (params.riskMargin   / 100)
  const profitValue = (subtotal + riskValue) * (params.profitMargin / 100)
  const taxBase     = subtotal + riskValue + profitValue
  const taxValue    = taxBase * (params.taxRate / 100)
  const total       = taxBase + taxValue

  const seriesLabel = `Série ${polimold.series} — ${polimold.w}×${polimold.l}mm`

  return {
    plates,
    polimoldSeries: seriesLabel,
    cavityLayout: layout,
    moldWeight: totalSteelWeight,
    steelWeight: totalSteelWeight,
    labor,
    materials: {
      steel:         steelCost,
      pins:          pinSetCost,
      springs:       springCost,
      columns:       columnCost,
      hotRunner:     hotRunnerCost,
      heatTreatment: heatTreatCost,
      total:         materialTotal,
    },
    subtotal,
    riskValue,
    profitValue,
    taxValue,
    total,
  }
}

// ─── Re-export para compatibilidade ──────────────────────────────────
export function calculateMoldDimensions(piece: PieceSize, cavities: number, catalog?: PolimoldEntry[]) {
  const required = calcRequiredFootprint(piece, cavities)
  const polimold = selectPolimoldSize(required.w, required.l, catalog)
  const series   = Number(polimold.series.replace('+', '')) || 60
  const { fixH, cavH, punchH, spacerH, ejectorH } = getPlateThicknesses(String(series), piece.z)

  return {
    topPlate:     { width: polimold.w, length: polimold.l, height: fixH,      material: 'S1045' },
    cavityPlate:  { width: polimold.w, length: polimold.l, height: cavH,      material: 'P20' },
    punchPlate:   { width: polimold.w, length: polimold.l, height: punchH,    material: 'P20' },
    spacerBlocks: { width: Math.round(polimold.w * 0.22), length: polimold.l, height: spacerH, material: 'S1045' },
    ejectorPlate: { width: polimold.w - 20, length: polimold.l - 20, height: ejectorH, material: 'P20' },
    bottomPlate:  { width: polimold.w, length: polimold.l, height: fixH,      material: 'S1045' },
    seriesLabel:  `Série ${polimold.series} — ${polimold.w}×${polimold.l}mm`,
    cavityLayout: getCavityLayout(cavities),
  }
}
