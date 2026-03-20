import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import { authenticate, requireAdmin } from '../middleware/auth'

const prisma = new PrismaClient()

const DEFAULT_PRICING = [
  { key: 'HOURLY_RATE',        label: 'Valor Hora de Trabalho', value: 150,  unit: 'R$/h' },
  { key: 'STEEL_S1045',        label: 'Aço 1045',               value: 11.35, unit: 'R$/kg' },
  { key: 'STEEL_P20',          label: 'Aço P20',                value: 38.0,  unit: 'R$/kg' },
  { key: 'STEEL_H13',          label: 'Aço H13 (Injetora)',     value: 65.0,  unit: 'R$/kg' },
  { key: 'COMPONENT_PINS',     label: 'Conjunto de Pinos',      value: 280,   unit: 'R$/jg' },
  { key: 'COMPONENT_SPRINGS',  label: 'Conjunto de Molas',      value: 120,   unit: 'R$/jg' },
  { key: 'COMPONENT_COLUMNS',  label: 'Conjunto de Colunas',    value: 350,   unit: 'R$/jg' },
  { key: 'COMPONENT_MANIFOLD', label: 'Manifold Câmara Quente', value: 2800,  unit: 'R$/un' },
]

export async function pricingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /api/pricing
  app.get('/', async () => {
    const rows = await prisma.pricingTable.findMany({ orderBy: { key: 'asc' } })
    return rows
  })

  // PUT /api/pricing/:key
  app.put('/:key', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { key } = req.params as { key: string }
    const { value } = req.body as { value: number }

    const updated = await prisma.pricingTable.update({
      where: { key },
      data: { value },
    })
    return updated
  })

  // POST /api/pricing/sync — importar planilha XLSX
  app.post('/sync', { preHandler: [requireAdmin] }, async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })

    const buffer = await data.toBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet)

    const updated: string[] = []

    for (const row of rows) {
      // Tenta identificar os campos pela planilha Euromoldes
      const key   = String(row['CHAVE'] || row['KEY'] || '').toUpperCase().trim()
      const value = parseFloat(row['VALOR'] || row['VALUE'] || '0')

      if (key && !isNaN(value) && value > 0) {
        await prisma.pricingTable.upsert({
          where: { key },
          update: { value },
          create: {
            key,
            label: String(row['DESCRICAO'] || row['LABEL'] || key),
            value,
            unit: String(row['UNIDADE'] || row['UNIT'] || ''),
          },
        })
        updated.push(key)
      }
    }

    return { message: `${updated.length} itens atualizados`, updated }
  })

  // POST /api/pricing/seed — inicializa preços padrão
  app.post('/seed', { preHandler: [requireAdmin] }, async () => {
    for (const item of DEFAULT_PRICING) {
      await prisma.pricingTable.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: item,
      })
    }
    return { message: 'Tabela de preços inicializada', count: DEFAULT_PRICING.length }
  })
}
