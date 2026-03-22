import { FastifyInstance } from 'fastify'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { PrismaClient } from '@prisma/client'
import { authenticate } from '../middleware/auth'
import { calculateMold, calculateMoldDimensions, PolimoldEntry } from '../services/moldCalculator'

const prisma = new PrismaClient()
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

async function getDefaultPricing() {
  const rows = await prisma.pricingTable.findMany()
  const map: Record<string, number> = {}
  rows.forEach((r) => (map[r.key] = r.value))
  return {
    hourlyRate:  map['RATE_CNC']      ?? map['HOURLY_RATE']       ?? 185,
    steelS1045:  map['STEEL_S1045']   ?? 12.80,
    steelP20:    map['STEEL_P20']     ?? 42.0,
    steelH13:    map['STEEL_H13']     ?? 68.0,
    pinSet:      map['COMP_PINS']     ?? map['COMPONENT_PINS']    ?? 320,
    springSet:   map['COMP_SPRINGS']  ?? map['COMPONENT_SPRINGS'] ?? 150,
    columnSet:   map['COMP_COLUMNS']  ?? map['COMPONENT_COLUMNS'] ?? 420,
    manifold:    map['HR_MANIFOLD']   ?? map['COMPONENT_MANIFOLD'] ?? 4500,
    nozzlePrice: map['HR_NOZZLE']     ?? 2800,
    extraDrop:   map['HR_EXTRA_DROP'] ?? 800,
  }
}

async function getPolimoldCatalog(): Promise<PolimoldEntry[]> {
  try {
    const cfg = await prisma.systemConfig.findUnique({ where: { key: 'POLIMOLD_CATALOG' } })
    if (cfg) return JSON.parse(cfg.value) as PolimoldEntry[]
  } catch {}
  return []
}

export async function exportRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/:id/pdf', async (req, reply) => {
    const { id } = req.params as { id: string }
    const project = await prisma.project.findUnique({
      where: { id },
      include: { createdBy: { select: { name: true, username: true } } },
    })
    if (!project) return reply.status(404).send({ error: 'Projeto não encontrado' })

    const [pricing, catalog] = await Promise.all([getDefaultPricing(), getPolimoldCatalog()])
    const result  = calculateMold({
      pieceSize:     { x: project.pieceX, y: project.pieceY, z: project.pieceZ },
      cavities:      project.cavities,
      hasDrawers:    project.hasDrawers,
      drawerCount:   project.drawerCount,
      polishLevel:   project.polishLevel   as any,
      steelType:     project.steelType     as any,
      heatTreatment: project.heatTreatment ?? 'NONE',
      surfaceTexture: project.surfaceTexture ?? 'POLISHED',
      injectionType: project.injectionType ?? 'camera_fria',
      nozzleCount:   project.nozzleCount   ?? 0,
      riskMargin:    project.riskMargin,
      profitMargin:  project.profitMargin,
      taxRate:       project.taxRate,
      pricing,
      catalog: catalog.length ? catalog : undefined,
    })
    const plates = calculateMoldDimensions(
      { x: project.pieceX, y: project.pieceY, z: project.pieceZ },
      project.cavities,
      catalog.length ? catalog : undefined,
    )

    // ── PDF setup ────────────────────────────────────────────────────────────
    const doc  = await PDFDocument.create()
    const page = doc.addPage([595, 842]) // A4
    const { width, height } = page.getSize()

    const B = await doc.embedFont(StandardFonts.HelveticaBold)
    const N = await doc.embedFont(StandardFonts.Helvetica)

    // Color palette
    const NAVY    = rgb(0.04, 0.14, 0.28)
    const BLUE    = rgb(0.04, 0.45, 0.75)
    const LBLUE   = rgb(0.07, 0.35, 0.60)
    const WHITE   = rgb(1, 1, 1)
    const DARK    = rgb(0.10, 0.12, 0.18)
    const GRAY    = rgb(0.45, 0.48, 0.52)
    const LGRAY   = rgb(0.94, 0.95, 0.97)
    const ACCENT  = rgb(0.0,  0.60, 0.40)  // green accent for totals

    let y = height

    // ── HEADER ───────────────────────────────────────────────────────────────
    // Dark banner
    page.drawRectangle({ x: 0, y: height - 75, width, height: 75, color: NAVY })
    // Left: company name
    page.drawText('EUROMOLDES', {
      x: 28, y: height - 30, font: B, size: 20, color: WHITE,
    })
    page.drawText('Ferramentaria de Precisão — Rafael de Abreu', {
      x: 28, y: height - 48, font: N, size: 8.5, color: rgb(0.65, 0.75, 0.88),
    })
    page.drawText('euromoldes.com.br', {
      x: 28, y: height - 64, font: N, size: 7.5, color: rgb(0.45, 0.55, 0.72),
    })
    // Right: document type
    page.drawText('PROPOSTA TÉCNICA E COMERCIAL', {
      x: width - 215, y: height - 28, font: B, size: 11, color: rgb(0.7, 0.85, 1.0),
    })
    page.drawText(`MATRIZ DE INJEÇÃO · ${project.cavities} CAVIDADES`, {
      x: width - 215, y: height - 44, font: N, size: 9, color: rgb(0.50, 0.65, 0.82),
    })
    page.drawText(`Ref. ${id.slice(-8).toUpperCase()}`, {
      x: width - 215, y: height - 60, font: N, size: 8, color: rgb(0.40, 0.52, 0.68),
    })
    // Blue accent bar
    page.drawRectangle({ x: 0, y: height - 78, width, height: 3, color: BLUE })

    y = height - 94

    // ── Section helper ────────────────────────────────────────────────────────
    function sectionHeader(title: string) {
      page.drawRectangle({ x: 28, y: y - 4, width: width - 56, height: 17, color: NAVY })
      page.drawText(title, { x: 33, y: y + 1, font: B, size: 8.5, color: rgb(0.7, 0.85, 1.0) })
      y -= 22
    }

    function row2(label: string, value: string, bold = false) {
      page.drawText(label, { x: 35, y, font: bold ? B : N, size: 8.5, color: DARK })
      page.drawText(value, { x: 220, y, font: bold ? B : N, size: 8.5, color: bold ? BLUE : DARK })
      y -= 14
    }

    function divider() {
      page.drawLine({ start: { x: 28, y }, end: { x: width - 28, y }, thickness: 0.5, color: rgb(0.82, 0.85, 0.90) })
      y -= 8
    }

    // ── 1. CLIENT + PROJECT ───────────────────────────────────────────────────
    sectionHeader('1. DADOS DO PROJETO E CLIENTE')
    row2('Cliente:', project.clientName)
    row2('Projeto:', project.name)
    row2('Data da Proposta:', new Date(project.createdAt).toLocaleDateString('pt-BR'))
    row2('Responsável Técnico:', project.createdBy.name + ' — Euromoldes')
    row2('Validade desta Proposta:', '15 dias corridos')
    y -= 6

    // ── 2. TECHNICAL SPECS ────────────────────────────────────────────────────
    sectionHeader('2. ESPECIFICAÇÕES TÉCNICAS DO PROJETO')

    const steelLabel = project.steelType === 'S1045' ? 'Aço SAE 1045' : project.steelType === 'P20' ? 'Aço P20 (XPM)' : 'Aço H13'
    const polishLabel = project.polishLevel === 'STANDARD' ? 'Padrão Industrial'
      : project.polishLevel === 'SEMI_GLOSS' ? 'Semi-Brilho (Ra 0,4)'
      : 'Espelho (Ra 0,1) — Polimento Manual'
    const cavLayout  = project.cavities <= 4 ? `Linear (${project.cavities} cav.)`
      : project.cavities <= 8 ? `Layout H (${project.cavities} cav.)`
      : `Matricial ${Math.ceil(project.cavities / 2)}×2 (${project.cavities} cav.)`

    row2('Número de Cavidades:', `${project.cavities} cavidades — ${cavLayout}`)
    row2('Material Insertos/Cavidades:', `${steelLabel} (Alta condutividade térmica)`)
    row2('Estrutura do Porta-Molde:', 'Aço SAE 1045 (Robustez e estabilidade mecânica)')
    row2('Sistema de Alimentação:', 'Canal balanceado tipo "H" — preenchimento uniforme')
    row2('Refrigeração:', 'Circuitos independentes nos insertos para resfriamento acelerado')
    row2('Acabamento Superficial:', polishLabel)
    if (project.hasDrawers && project.drawerCount > 0) {
      row2('Gavetas Laterais:', `${project.drawerCount} gaveta(s) — acionamento mecânico`)
    }
    y -= 6

    // ── 3. PLATE DIMENSIONS ───────────────────────────────────────────────────
    sectionHeader('3. DIMENSIONAMENTO ESTIMADO')

    row2('Dimensões da Peça Plástica:', `${NUM.format(project.pieceX)} × ${NUM.format(project.pieceY)} × ${NUM.format(project.pieceZ)} mm`)
    row2('Dimensão do Porta-Molde:', `${Math.round(plates.topPlate.width)} × ${Math.round(plates.topPlate.length)} mm (Série ${project.pieceX < 80 ? '30' : project.pieceX < 150 ? '40' : '50'})`)
    row2('Altura Total Montado:', `${Math.round(plates.topPlate.height + plates.cavityPlate.height + plates.punchPlate.height + plates.spacerBlocks.height + plates.ejectorPlate.height + plates.bottomPlate.height)} mm (aprox.)`)

    y -= 4
    // Plate table header
    page.drawRectangle({ x: 28, y: y - 3, width: width - 56, height: 14, color: LGRAY })
    page.drawText('PLACA', { x: 33, y: y + 0, font: B, size: 7.5, color: DARK })
    page.drawText('ESPESSURA', { x: 260, y: y + 0, font: B, size: 7.5, color: DARK })
    page.drawText('MATERIAL', { x: 360, y: y + 0, font: B, size: 7.5, color: DARK })
    page.drawText('FUNÇÃO', { x: 440, y: y + 0, font: B, size: 7.5, color: DARK })
    y -= 18

    const plateRows = [
      ['Placa Superior (P1)',  `${Math.round(plates.topPlate.height)} mm`,    '1045', 'Fixação / Bucha de Injeção'],
      ['Pavimento Fixo',       `${Math.round(plates.cavityPlate.height)} mm`, 'XPM',  'Inserto Cavidade (Fêmea)'],
      ['Pavimento Móvel',      `${Math.round(plates.punchPlate.height)} mm`,  'XPM',  'Inserto Macho (Punção)'],
      ['Calços / Espaçadores', `${Math.round(plates.spacerBlocks.height)} mm`,'1045', 'Vão para Extrator'],
      ['Placa Extratora',      `${Math.round(plates.ejectorPlate.height)} mm`,'1045', 'Pinos de Extração'],
      ['Base Inferior (P2)',   `${Math.round(plates.bottomPlate.height)} mm`, '1045', 'Fixação Máquina'],
    ]

    plateRows.forEach(([name, h, mat, fn], i) => {
      if (i % 2 === 0) page.drawRectangle({ x: 28, y: y - 3, width: width - 56, height: 13, color: rgb(0.97, 0.98, 1.0) })
      page.drawText(name, { x: 33, y, font: N, size: 7.5, color: DARK })
      page.drawText(h,    { x: 260, y, font: mat === 'XPM' ? B : N, size: 7.5, color: mat === 'XPM' ? LBLUE : DARK })
      page.drawText(mat,  { x: 360, y, font: mat === 'XPM' ? B : N, size: 7.5, color: mat === 'XPM' ? LBLUE : DARK })
      page.drawText(fn,   { x: 440, y, font: N, size: 7, color: GRAY })
      y -= 14
    })
    y -= 4

    // ── 4. INVESTMENT TABLE (Gemini-style) ────────────────────────────────────
    sectionHeader('4. INVESTIMENTO ESTIMADO — MATRIZ COMPLETA')

    y -= 2
    // Table header
    page.drawRectangle({ x: 28, y: y - 3, width: width - 56, height: 14, color: NAVY })
    page.drawText('ITEM',             { x: 33,        y: y + 0, font: B, size: 7.5, color: WHITE })
    page.drawText('DESCRIÇÃO TÉCNICA',{ x: 110,       y: y + 0, font: B, size: 7.5, color: WHITE })
    page.drawText('VALOR ESTIMADO',   { x: width - 90,y: y + 0, font: B, size: 7.5, color: WHITE })
    y -= 18

    // Build investment items matching Gemini format
    const matSteel      = result.materials.steel
    const matComponents = result.materials.pins + result.materials.springs + result.materials.columns
    const laborCNC      = result.labor.machining.cost
    const laborEDM      = result.labor.erosion.cost
    const laborBench    = result.labor.bench.cost + result.labor.grinding.cost
    const engValue      = result.labor.total * 0.12  // ~12% for engineering
    const tryoutValue   = result.labor.total * 0.08  // ~8% for tryout

    const investmentRows: [string, string, number][] = [
      ['Porta-Molde',    'Estrutura completa SAE 1045 usinada — todas as placas',       matSteel * 0.55],
      ['Insertos/Cav.',  `Blocos ${steelLabel.split('(')[0].trim()} + usinagem de precisão`, matSteel * 0.45 + matComponents * 0.3],
      ['Componentes',    'Guias, colunas, buchas, pinos e molas — linha padrão',        matComponents * 0.7],
      ['Extração',       'Pinos extratores tratados, réguas e sistema de atuação',      laborBench * 0.3],
      ['Engenharia',     'Modelagem 3D, projeto do molde e programação CNC/CAM',        engValue],
      ['Usinagem/Ajuste','CNC acabamento, eletroerosão (EDM) e ajuste de bancada',      laborCNC + laborEDM + laborBench * 0.7],
      ['Try-out (T1)',   'Teste em injetora, amostras e ajustes finos',                 tryoutValue],
    ]

    investmentRows.forEach(([item, desc, val], i) => {
      if (i % 2 === 1) page.drawRectangle({ x: 28, y: y - 3, width: width - 56, height: 13, color: LGRAY })
      page.drawText(item, { x: 33,        y, font: B, size: 7.5, color: DARK })
      page.drawText(desc, { x: 110,       y, font: N, size: 7,   color: GRAY })
      page.drawText(BRL.format(val), { x: width - 90, y, font: N, size: 8, color: DARK })
      y -= 14
    })

    // Total line
    y -= 4
    page.drawLine({ start: { x: 28, y: y + 6 }, end: { x: width - 28, y: y + 6 }, thickness: 1.2, color: BLUE })
    y -= 2
    page.drawText('TOTAL DO INVESTIMENTO — Matriz Completa Pronta para Produzir',
      { x: 35, y, font: B, size: 9, color: DARK })
    page.drawText(BRL.format(result.total),
      { x: width - 90, y, font: B, size: 11, color: BLUE })
    y -= 22

    // ── 5. PAYMENT ────────────────────────────────────────────────────────────
    sectionHeader('5. CONDIÇÕES COMERCIAIS E CRONOGRAMA')

    row2('Prazo de Fabricação:', '45 a 55 dias úteis após aprovação e entrada')
    row2('Garantia Técnica:', `12 meses ou 500.000 ciclos (o que ocorrer primeiro)`)
    row2('Validade da Proposta:', '15 dias (sujeito a variação do preço do aço)')
    y -= 4
    page.drawText('Forma de Pagamento:', { x: 35, y, font: B, size: 8.5, color: DARK })
    y -= 12
    let paymentTerms: Array<{ label: string; pct: number }> = [
      { label: '40% na assinatura do contrato', pct: 0.4 },
      { label: '30% na entrega das primeiras amostras (T1)', pct: 0.3 },
      { label: '30% na aprovação final e entrega', pct: 0.3 },
    ]
    try {
      const cfg = await prisma.systemConfig.findUnique({ where: { key: 'PAYMENT_TERMS' } })
      if (cfg) paymentTerms = JSON.parse(cfg.value)
    } catch {}
    const pmts = paymentTerms.map(t => [`${t.label}:`, result.total * t.pct])
    pmts.forEach(([lbl, val]) => {
      page.drawText(`  •  ${lbl}`, { x: 40, y, font: N, size: 8.5, color: DARK })
      page.drawText(BRL.format(Number(val)), { x: width - 90, y, font: B, size: 8.5, color: BLUE })
      y -= 13
    })
    y -= 6

    // ── 6. DIFFERENTIALS ─────────────────────────────────────────────────────
    sectionHeader('6. DIFERENCIAIS DESTE PROJETO')
    const diffs = [
      `Aço ${steelLabel.split('(')[0].trim()}: condutividade térmica superior reduz o ciclo em até 25% vs. P20 comum — mais peças/hora.`,
      `${project.cavities} cavidades balanceadas: elimina variação de peso e dimensão entre peças — zero retrabalho.`,
      `Insertos independentes: manutenção rápida de cavidades específicas sem parar a produção.`,
      `Vida útil projetada > 500.000 ciclos com manutenção preventiva padrão.`,
    ]
    diffs.forEach(d => {
      page.drawText(`• ${d}`, { x: 35, y, font: N, size: 7.5, color: DARK })
      y -= 13
    })
    y -= 4

    // ── FINANCIAL SUMMARY BOX ────────────────────────────────────────────────
    page.drawRectangle({ x: 28, y: y - 54, width: width - 56, height: 62, color: rgb(0.95, 0.97, 1.0) })
    page.drawRectangle({ x: 28, y: y - 54, width: 4,          height: 62, color: BLUE })
    y -= 6
    page.drawText('RESUMO FINANCEIRO', { x: 38, y, font: B, size: 8, color: NAVY })
    y -= 14
    page.drawText(`Subtotal (MO + Materiais): ${BRL.format(result.subtotal)}`, { x: 38, y, font: N, size: 7.5, color: DARK })
    y -= 12
    page.drawText(`Risco ${project.riskMargin}%: ${BRL.format(result.riskValue)}   ·   Lucro ${project.profitMargin}%: ${BRL.format(result.profitValue)}   ·   Impostos ${project.taxRate}%: ${BRL.format(result.taxValue)}`, { x: 38, y, font: N, size: 7, color: GRAY })
    y -= 12
    page.drawText('VALOR TOTAL:',  { x: 38, y, font: B, size: 11, color: NAVY })
    page.drawText(BRL.format(result.total), { x: 130, y, font: B, size: 13, color: BLUE })
    y -= 20

    // ── FOOTER ────────────────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: 0, width, height: 32, color: NAVY })
    page.drawText(
      'Orçamento válido por 15 dias · Euromoldes — Sua peça, nossa precisão · © 2025 NeuroFlux Systems',
      { x: 28, y: 12, font: N, size: 7, color: rgb(0.5, 0.6, 0.75) }
    )
    page.drawText(`Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      { x: width - 135, y: 12, font: N, size: 7, color: rgb(0.4, 0.5, 0.65) })

    const pdfBytes = await doc.save()
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="proposta-${project.clientName.toLowerCase().replace(/\s+/g,'-')}-${id.slice(-6)}.pdf"`)
      .send(Buffer.from(pdfBytes))
  })
}
