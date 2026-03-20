import { FastifyInstance } from 'fastify'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { PrismaClient } from '@prisma/client'
import { authenticate } from '../middleware/auth'
import { calculateMold } from '../services/moldCalculator'

const prisma = new PrismaClient()

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

async function getDefaultPricing() {
  const rows = await prisma.pricingTable.findMany()
  const map: Record<string, number> = {}
  rows.forEach((r) => (map[r.key] = r.value))
  return {
    hourlyRate: map['HOURLY_RATE'] ?? 150,
    steelS1045: map['STEEL_S1045'] ?? 11.35,
    steelP20:   map['STEEL_P20']   ?? 38.0,
    steelH13:   map['STEEL_H13']   ?? 65.0,
    pinSet:     map['COMPONENT_PINS']    ?? 280,
    springSet:  map['COMPONENT_SPRINGS'] ?? 120,
    columnSet:  map['COMPONENT_COLUMNS'] ?? 350,
    manifold:   map['COMPONENT_MANIFOLD'] ?? 0,
  }
}

export async function exportRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/:id/pdf', async (req, reply) => {
    const { id } = req.params as { id: string }
    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) return reply.status(404).send({ error: 'Projeto não encontrado' })

    const pricing = await getDefaultPricing()
    const result = calculateMold({
      pieceSize: { x: project.pieceX, y: project.pieceY, z: project.pieceZ },
      cavities: project.cavities,
      hasDrawers: project.hasDrawers,
      drawerCount: project.drawerCount,
      polishLevel: project.polishLevel as any,
      steelType: project.steelType as any,
      riskMargin: project.riskMargin,
      profitMargin: project.profitMargin,
      taxRate: project.taxRate,
      pricing,
    })

    const pdfDoc = await PDFDocument.create()
    const page   = pdfDoc.addPage([595, 842]) // A4
    const { width, height } = page.getSize()

    const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const DARK   = rgb(0.05, 0.05, 0.15)
    const ACCENT = rgb(0.0, 0.47, 0.84)
    const LIGHT  = rgb(0.95, 0.95, 0.98)
    const WHITE  = rgb(1, 1, 1)

    // Header
    page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: DARK })
    page.drawText('EUROMOLDES', { x: 30, y: height - 32, font: fontBold, size: 22, color: WHITE })
    page.drawText('Indústria de Moldes e Matrizes', { x: 30, y: height - 52, font: fontNormal, size: 10, color: rgb(0.7, 0.7, 0.8) })
    page.drawText('ORÇAMENTO TÉCNICO', { x: width - 160, y: height - 40, font: fontBold, size: 13, color: ACCENT })
    page.drawText(`Nº ${id.slice(-8).toUpperCase()}`, { x: width - 160, y: height - 58, font: fontNormal, size: 9, color: rgb(0.7, 0.7, 0.8) })

    let y = height - 110

    // Project info
    page.drawText('DADOS DO PROJETO', { x: 30, y, font: fontBold, size: 11, color: DARK })
    y -= 20

    const infoLines = [
      ['Cliente:', project.clientName],
      ['Projeto:', project.name],
      ['Data:', new Date(project.createdAt).toLocaleDateString('pt-BR')],
      [`Dimensões da Peça:`, `${NUM.format(project.pieceX)} × ${NUM.format(project.pieceY)} × ${NUM.format(project.pieceZ)} mm`],
      ['Cavidades:', String(project.cavities)],
      ['Material:', project.steelType === 'S1045' ? 'Aço 1045' : project.steelType === 'P20' ? 'Aço P20' : 'Aço H13'],
      ['Polimento:', project.polishLevel === 'STANDARD' ? 'Padrão' : project.polishLevel === 'SEMI_GLOSS' ? 'Semi-brilho' : 'Espelho'],
    ]

    for (const [label, value] of infoLines) {
      page.drawText(label, { x: 30, y, font: fontBold, size: 9, color: DARK })
      page.drawText(value, { x: 160, y, font: fontNormal, size: 9, color: DARK })
      y -= 16
    }

    y -= 10

    // Labor table
    page.drawRectangle({ x: 30, y: y - 2, width: width - 60, height: 18, color: ACCENT })
    page.drawText('MÃO DE OBRA', { x: 35, y: y + 2, font: fontBold, size: 10, color: WHITE })
    page.drawText('HORAS', { x: 310, y: y + 2, font: fontBold, size: 9, color: WHITE })
    page.drawText('VALOR', { x: 420, y: y + 2, font: fontBold, size: 9, color: WHITE })
    page.drawText('TOTAL', { x: 500, y: y + 2, font: fontBold, size: 9, color: WHITE })
    y -= 20

    const laborItems = [
      ['Usinagem CNC / Fresamento', result.labor.machining.hours, pricing.hourlyRate, result.labor.machining.cost],
      ['Eletroerosão / EDM',        result.labor.erosion.hours,   pricing.hourlyRate, result.labor.erosion.cost],
      ['Bancada / Ajustagem',       result.labor.bench.hours,     pricing.hourlyRate, result.labor.bench.cost],
      ['Retífica e Polimento',      result.labor.grinding.hours,  pricing.hourlyRate, result.labor.grinding.cost],
    ]

    laborItems.forEach(([desc, h, rate, total], i) => {
      if (i % 2 === 1) page.drawRectangle({ x: 30, y: y - 3, width: width - 60, height: 16, color: LIGHT })
      page.drawText(String(desc), { x: 35, y, font: fontNormal, size: 8.5, color: DARK })
      page.drawText(`${NUM.format(Number(h))}h`, { x: 310, y, font: fontNormal, size: 8.5, color: DARK })
      page.drawText(BRL.format(Number(rate)), { x: 395, y, font: fontNormal, size: 8.5, color: DARK })
      page.drawText(BRL.format(Number(total)), { x: 490, y, font: fontBold, size: 8.5, color: DARK })
      y -= 16
    })

    page.drawText('TOTAL MÃO DE OBRA', { x: 35, y, font: fontBold, size: 9, color: DARK })
    page.drawText(BRL.format(result.labor.total), { x: 490, y, font: fontBold, size: 9, color: ACCENT })
    y -= 24

    // Materials
    page.drawRectangle({ x: 30, y: y - 2, width: width - 60, height: 18, color: ACCENT })
    page.drawText('MATERIAIS', { x: 35, y: y + 2, font: fontBold, size: 10, color: WHITE })
    y -= 20

    const matItems = [
      [`Aço ${project.steelType} (${NUM.format(result.steelWeight)} kg)`, result.materials.steel],
      ['Conjunto de Pinos', result.materials.pins],
      ['Conjunto de Molas', result.materials.springs],
      ['Conjunto de Colunas', result.materials.columns],
    ]

    matItems.forEach(([desc, val], i) => {
      if (i % 2 === 1) page.drawRectangle({ x: 30, y: y - 3, width: width - 60, height: 16, color: LIGHT })
      page.drawText(String(desc), { x: 35, y, font: fontNormal, size: 8.5, color: DARK })
      page.drawText(BRL.format(Number(val)), { x: 490, y, font: fontBold, size: 8.5, color: DARK })
      y -= 16
    })

    page.drawText('TOTAL MATERIAIS', { x: 35, y, font: fontBold, size: 9, color: DARK })
    page.drawText(BRL.format(result.materials.total), { x: 490, y, font: fontBold, size: 9, color: ACCENT })
    y -= 30

    // Financial summary
    page.drawRectangle({ x: 30, y: y - 100, width: width - 60, height: 110, color: LIGHT })
    const summaryLines = [
      ['Subtotal (MO + Materiais):', result.subtotal],
      [`Margem de Risco (${project.riskMargin}%):`, result.riskValue],
      [`Margem de Lucro (${project.profitMargin}%):`, result.profitValue],
      [`Impostos (${project.taxRate}%):`, result.taxValue],
    ]

    summaryLines.forEach(([label, val]) => {
      page.drawText(String(label), { x: 40, y, font: fontNormal, size: 9, color: DARK })
      page.drawText(BRL.format(Number(val)), { x: 490, y, font: fontNormal, size: 9, color: DARK })
      y -= 18
    })

    page.drawLine({ start: { x: 40, y: y + 10 }, end: { x: width - 40, y: y + 10 }, thickness: 1, color: ACCENT })
    y -= 4
    page.drawText('VALOR TOTAL DO MOLDE', { x: 40, y, font: fontBold, size: 12, color: DARK })
    page.drawText(BRL.format(result.total), { x: 420, y, font: fontBold, size: 14, color: ACCENT })
    y -= 30

    // Payment conditions
    page.drawText('CONDIÇÕES DE PAGAMENTO', { x: 30, y, font: fontBold, size: 10, color: DARK })
    y -= 16
    const payments = [
      [`50% na assinatura: ${BRL.format(result.total * 0.5)}`, ''],
      [`30% na entrega da primeira amostra: ${BRL.format(result.total * 0.3)}`, ''],
      [`20% na aprovação final: ${BRL.format(result.total * 0.2)}`, ''],
    ]
    payments.forEach(([line]) => {
      page.drawText(`• ${line}`, { x: 35, y, font: fontNormal, size: 9, color: DARK })
      y -= 14
    })

    // Footer
    page.drawRectangle({ x: 0, y: 0, width, height: 40, color: DARK })
    page.drawText('Orçamento válido por 15 dias • Euromoldes — Sua peça, nossa precisão', {
      x: 30, y: 15, font: fontNormal, size: 8, color: rgb(0.6, 0.6, 0.7)
    })

    const pdfBytes = await pdfDoc.save()

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="orcamento-${id.slice(-8)}.pdf"`)
      .send(Buffer.from(pdfBytes))
  })
}
