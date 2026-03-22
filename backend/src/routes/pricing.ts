import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import { authenticate, requireAdmin } from '../middleware/auth'

const prisma = new PrismaClient()

// Preços reais mercado Brasil 2024/2025
const DEFAULT_PRICING = [
  // ── Hora-Máquina (pesquisa GRV/Usinagem Brasil 2024) ──────────────
  { key: 'RATE_CNC',       label: 'Hora CNC (Fresamento 3 Eixos)',  value: 185,   unit: 'R$/h',   category: 'rates' },
  { key: 'RATE_EDM',       label: 'Hora EDM (Eletroerosão)',        value: 130,   unit: 'R$/h',   category: 'rates' },
  { key: 'RATE_BENCH',     label: 'Hora Bancada / Ajustagem',       value: 95,    unit: 'R$/h',   category: 'rates' },
  { key: 'RATE_GRINDING',  label: 'Hora Retífica e Polimento',      value: 110,   unit: 'R$/h',   category: 'rates' },
  // ── Aços (fornecedores: Aços Nobre, GGD Metals, AÇOESPECIAL 2024) ─
  { key: 'STEEL_S1045',    label: 'Aço SAE 1045 (estrutural)',      value: 12.80, unit: 'R$/kg',  category: 'steel' },
  { key: 'STEEL_P20',      label: 'Aço P20 / XPM (cavidades)',      value: 42.00, unit: 'R$/kg',  category: 'steel' },
  { key: 'STEEL_H13',      label: 'Aço H13 (alta temperatura)',     value: 68.00, unit: 'R$/kg',  category: 'steel' },
  { key: 'STEEL_P20S',     label: 'Aço P20+S / 2316 (inox fácil)', value: 78.00, unit: 'R$/kg',  category: 'steel' },
  { key: 'STEEL_420SS',    label: 'Aço 420 Inox (espelho)',         value: 92.00, unit: 'R$/kg',  category: 'steel' },
  // ── Componentes Polimold ──────────────────────────────────────────
  { key: 'COMP_PINS',      label: 'Conjunto de Pinos Extratores',   value: 320,   unit: 'R$/jg',  category: 'components' },
  { key: 'COMP_SPRINGS',   label: 'Conjunto de Molas-Guia',         value: 150,   unit: 'R$/jg',  category: 'components' },
  { key: 'COMP_COLUMNS',   label: 'Conjunto Colunas + Buchas',      value: 420,   unit: 'R$/jg',  category: 'components' },
  { key: 'COMP_BUSHING',   label: 'Bucha de Injeção Central',       value: 180,   unit: 'R$/un',  category: 'components' },
  { key: 'COMP_LOCATING',  label: 'Anel de Centragem',              value: 85,    unit: 'R$/un',  category: 'components' },
  // ── Câmara Quente (bico padrão Synventive/Incoe equivalente) ──────
  { key: 'HR_NOZZLE',      label: 'Bico Câmara Quente (por unid.)', value: 2800,  unit: 'R$/un',  category: 'hot_runner' },
  { key: 'HR_MANIFOLD',    label: 'Manifold Base + 1 Derivação',    value: 4500,  unit: 'R$/jg',  category: 'hot_runner' },
  { key: 'HR_EXTRA_DROP',  label: 'Derivação Adicional (manifold)', value: 800,   unit: 'R$/un',  category: 'hot_runner' },
  // ── Legado (chaves antigas — mantidas por compatibilidade) ─────────
  { key: 'HOURLY_RATE',       label: 'Hora de Trabalho (legado)',    value: 185,   unit: 'R$/h',  category: 'rates' },
  { key: 'COMPONENT_PINS',    label: 'Pinos Extratores (legado)',    value: 320,   unit: 'R$/jg', category: 'components' },
  { key: 'COMPONENT_SPRINGS', label: 'Molas-Guia (legado)',          value: 150,   unit: 'R$/jg', category: 'components' },
  { key: 'COMPONENT_COLUMNS', label: 'Colunas e Buchas (legado)',    value: 420,   unit: 'R$/jg', category: 'components' },
  { key: 'COMPONENT_MANIFOLD', label: 'Manifold (legado)',           value: 4500,  unit: 'R$/jg', category: 'hot_runner' },
]

// Keys que não podem ser deletadas (sistema depende)
const SYSTEM_KEYS = new Set([
  'STEEL_S1045', 'STEEL_P20', 'STEEL_H13',
  'HOURLY_RATE', 'COMPONENT_PINS', 'COMPONENT_SPRINGS',
  'COMPONENT_COLUMNS', 'COMPONENT_MANIFOLD',
])

export async function pricingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /api/pricing
  app.get('/', async () => {
    return prisma.pricingTable.findMany({ orderBy: { key: 'asc' } })
  })

  // PUT /api/pricing/:key — editar valor
  app.put('/:key', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { key } = req.params as { key: string }
    const { value, label, unit } = req.body as { value: number; label?: string; unit?: string }
    const data: any = { value }
    if (label) data.label = label
    if (unit) data.unit = unit
    const updated = await prisma.pricingTable.update({ where: { key }, data })
    return updated
  })

  // POST /api/pricing — criar novo item
  app.post('/', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { key, label, value, unit, category } = req.body as {
      key: string; label: string; value: number; unit: string; category?: string
    }
    if (!key || !label || value === undefined || !unit) {
      return reply.status(400).send({ error: 'Campos obrigatórios: key, label, value, unit' })
    }
    const normalizedKey = key.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
    const existing = await prisma.pricingTable.findUnique({ where: { key: normalizedKey } })
    if (existing) return reply.status(409).send({ error: 'Chave já existe. Use PUT para editar.' })

    const created = await prisma.pricingTable.create({
      data: { key: normalizedKey, label, value, unit },
    })
    return reply.status(201).send(created)
  })

  // DELETE /api/pricing/:key
  app.delete('/:key', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { key } = req.params as { key: string }
    if (SYSTEM_KEYS.has(key)) {
      return reply.status(403).send({ error: 'Esta chave é usada pelo sistema e não pode ser removida.' })
    }
    const existing = await prisma.pricingTable.findUnique({ where: { key } })
    if (!existing) return reply.status(404).send({ error: 'Item não encontrado' })
    await prisma.pricingTable.delete({ where: { key } })
    return { ok: true }
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
      const key   = String(row['CHAVE'] || row['KEY'] || '').toUpperCase().trim()
      const value = parseFloat(row['VALOR'] || row['VALUE'] || '0')
      if (key && !isNaN(value) && value > 0) {
        await prisma.pricingTable.upsert({
          where: { key },
          update: { value },
          create: {
            key, value,
            label: String(row['DESCRICAO'] || row['LABEL'] || key),
            unit: String(row['UNIDADE'] || row['UNIT'] || ''),
          },
        })
        updated.push(key)
      }
    }
    return { message: `${updated.length} itens atualizados`, updated }
  })

  // POST /api/pricing/seed — restaura preços padrão
  app.post('/seed', { preHandler: [requireAdmin] }, async () => {
    for (const item of DEFAULT_PRICING) {
      await prisma.pricingTable.upsert({
        where: { key: item.key },
        update: { value: item.value, label: item.label, unit: item.unit },
        create: { key: item.key, label: item.label, value: item.value, unit: item.unit },
      })
    }
    return { message: 'Tabela restaurada com preços de mercado 2024/2025', count: DEFAULT_PRICING.length }
  })
}
