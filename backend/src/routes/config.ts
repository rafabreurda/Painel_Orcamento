import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate, requireAdmin } from '../middleware/auth'


const DEFAULTS: Record<string, any> = {
  PAYMENT_TERMS: [
    { label: '40% — Assinatura do Contrato', pct: 0.4 },
    { label: '30% — 1ª Amostra (T1)',         pct: 0.3 },
    { label: '30% — Entrega Final',            pct: 0.3 },
  ],
  POLIMOLD_CATALOG: [
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
  ],
}

export async function configRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /api/config/:key
  app.get('/:key', async (req, reply) => {
    const { key } = req.params as { key: string }
    const record = await prisma.systemConfig.findUnique({ where: { key } })
    if (!record) {
      const fallback = DEFAULTS[key]
      if (fallback !== undefined) return { key, value: fallback }
      return reply.status(404).send({ error: 'Configuração não encontrada' })
    }
    try {
      return { key: record.key, value: JSON.parse(record.value), updatedAt: record.updatedAt }
    } catch {
      return { key: record.key, value: record.value, updatedAt: record.updatedAt }
    }
  })

  // PUT /api/config/:key — admin only
  app.put('/:key', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { key } = req.params as { key: string }
    const { value } = req.body as { value: any }
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    const record = await prisma.systemConfig.upsert({
      where: { key },
      update: { value: serialized },
      create: { key, value: serialized },
    })
    return { key: record.key, value: JSON.parse(record.value), updatedAt: record.updatedAt }
  })

  // GET /api/config — listar todas
  app.get('/', async () => {
    const records = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } })
    return records.map(r => {
      try { return { key: r.key, value: JSON.parse(r.value), updatedAt: r.updatedAt } }
      catch { return { key: r.key, value: r.value, updatedAt: r.updatedAt } }
    })
  })

  // GET /api/config/polimold/download — download catálogo como CSV
  app.get('/polimold/download', async (req, reply) => {
    const catalog = DEFAULTS.POLIMOLD_CATALOG as Array<{ series: string; w: number; l: number }>
    const lines = [
      'Série,Largura (mm),Comprimento (mm)',
      ...catalog.map(e => `Série ${e.series},${e.w},${e.l}`),
    ]
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="catalogo-polimold.csv"')
    return reply.send('\uFEFF' + lines.join('\r\n'))
  })
}
