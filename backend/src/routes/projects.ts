import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { authenticate } from '../middleware/auth'
import { calculateMold, PolimoldEntry } from '../services/moldCalculator'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)


const VALID_STATUSES = ['PENDING', 'IN_PRODUCTION', 'DELIVERED', 'CANCELLED'] as const

// Schema relaxado para /calculate (name/clientName opcionais)
const calcSchema = z.object({
  name: z.string().default(''),
  clientName: z.string().default(''),
  pieceX: z.number().positive(),
  pieceY: z.number().positive(),
  pieceZ: z.number().positive(),
  cavities: z.number().int().min(1).max(64).default(1),
  hasDrawers: z.boolean().default(false),
  drawerCount: z.number().int().min(0).default(0),
  polishLevel: z.enum(['STANDARD', 'SEMI_GLOSS', 'MIRROR']).default('STANDARD'),
  steelType: z.enum(['S1045', 'P20', 'H13']).default('P20'),
  heatTreatment: z.string().default('NONE'),
  surfaceTexture: z.string().default('POLISHED'),
  injectionType: z.string().default('camera_fria'),
  nozzleCount: z.number().int().min(0).default(0),
  riskMargin: z.number().min(0).max(100).default(15),
  profitMargin: z.number().min(0).max(100).default(20),
  taxRate: z.number().min(0).max(100).default(8),
})

const projectSchema = z.object({
  name: z.string().min(1),
  clientName: z.string().min(1),
  pieceX: z.number().positive(),
  pieceY: z.number().positive(),
  pieceZ: z.number().positive(),
  cavities: z.number().int().min(1).max(64).default(1),
  hasDrawers: z.boolean().default(false),
  drawerCount: z.number().int().min(0).default(0),
  polishLevel: z.enum(['STANDARD', 'SEMI_GLOSS', 'MIRROR']).default('STANDARD'),
  steelType: z.enum(['S1045', 'P20', 'H13']).default('P20'),
  heatTreatment: z.string().default('NONE'),
  surfaceTexture: z.string().default('POLISHED'),
  injectionType: z.string().default('camera_fria'),
  nozzleCount: z.number().int().min(0).default(0),
  riskMargin: z.number().min(0).max(100).default(15),
  profitMargin: z.number().min(0).max(100).default(20),
  taxRate: z.number().min(0).max(100).default(8),
})

async function getDefaultPricing() {
  const rows = await prisma.pricingTable.findMany()
  const map: Record<string, number> = {}
  rows.forEach((r) => (map[r.key] = r.value))
  return {
    hourlyRate:  map['RATE_CNC']           ?? map['HOURLY_RATE']          ?? 185,
    steelS1045:  map['STEEL_S1045']        ?? 12.80,
    steelP20:    map['STEEL_P20']          ?? 42.0,
    steelH13:    map['STEEL_H13']          ?? 68.0,
    pinSet:      map['COMP_PINS']          ?? map['COMPONENT_PINS']       ?? 320,
    springSet:   map['COMP_SPRINGS']       ?? map['COMPONENT_SPRINGS']    ?? 150,
    columnSet:   map['COMP_COLUMNS']       ?? map['COMPONENT_COLUMNS']    ?? 420,
    manifold:    map['HR_MANIFOLD']        ?? map['COMPONENT_MANIFOLD']   ?? 4500,
    nozzlePrice: map['HR_NOZZLE']          ?? 2800,
    extraDrop:   map['HR_EXTRA_DROP']      ?? 800,
  }
}

// Polimold catalog removed from DB queries — calculator uses built-in defaults
// This avoids extra DB roundtrip on every calculation
function getPolimoldCatalog(): PolimoldEntry[] {
  return [] // empty = calculator uses its own hardcoded default catalog
}

function runCalc(body: z.infer<typeof projectSchema>, pricing: Awaited<ReturnType<typeof getDefaultPricing>>, catalog: PolimoldEntry[] = []) {
  return calculateMold({
    pieceSize:     { x: body.pieceX, y: body.pieceY, z: body.pieceZ },
    cavities:      body.cavities,
    hasDrawers:    body.hasDrawers,
    drawerCount:   body.drawerCount,
    polishLevel:   body.polishLevel,
    steelType:     body.steelType,
    heatTreatment: body.heatTreatment,
    surfaceTexture: body.surfaceTexture,
    injectionType: body.injectionType,
    nozzleCount:   body.nozzleCount,
    riskMargin:    body.riskMargin,
    profitMargin:  body.profitMargin,
    taxRate:       body.taxRate,
    pricing,
    catalog: catalog.length ? catalog : undefined,
  })
}

export async function projectRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // ── IMPORTANT: /calculate MUST come before /:id ──────────────────────────

  // POST /api/projects/calculate — cálculo sem salvar (name/clientName opcionais)
  app.post('/calculate', async (req) => {
    const body = calcSchema.parse(req.body)
    const pricing = await getDefaultPricing()
    return runCalc(body as any, pricing)
  })

  // GET /api/projects?page=1&limit=20&search=&status=
  app.get('/', async (req) => {
    const user = req.user as { id: string; role: string }
    const { page = '1', limit = '20', search = '', status = '' } = req.query as any
    const pageNum  = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
    const skip     = (pageNum - 1) * limitNum

    const baseWhere = user.role === 'ADMIN' ? {} : { userId: user.id }
    const where: any = { ...baseWhere }
    if (status && VALID_STATUSES.includes(status)) where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { clientName: { contains: search } },
      ]
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true, name: true, clientName: true, status: true,
          totalProject: true, cavities: true, steelType: true,
          createdAt: true, imageUrl: true,
          createdBy: { select: { name: true } },
        },
      }),
      prisma.project.count({ where }),
    ])

    return { projects, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) }
  })

  // GET /api/projects/stats
  app.get('/stats', async (req) => {
    const user = req.user as { id: string; role: string }
    const where = user.role === 'ADMIN' ? {} : { userId: user.id }
    const [total, pending, inProd, totalValue] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.count({ where: { ...where, status: 'PENDING' } }),
      prisma.project.count({ where: { ...where, status: 'IN_PRODUCTION' } }),
      prisma.project.aggregate({ where, _sum: { totalProject: true } }),
    ])
    return { total, pending, inProduction: inProd, totalValue: totalValue._sum.totalProject ?? 0 }
  })

  // GET /api/projects/:id
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = req.user as { id: string; role: string }
    const project = await prisma.project.findUnique({
      where: { id },
      include: { createdBy: { select: { name: true, username: true } } },
    })
    if (!project) return reply.status(404).send({ error: 'Projeto não encontrado' })
    if (project.userId !== user.id && user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Sem permissão para acessar este projeto' })
    }
    return project
  })

  // POST /api/projects
  app.post('/', async (req, reply) => {
    const user = req.user as { id: string }
    const body = projectSchema.parse(req.body)
    const pricing = await getDefaultPricing()
    const result = runCalc(body, pricing)
    const project = await prisma.project.create({
      data: {
        ...body,
        userId: user.id,
        totalMaterial: result.materials.total,
        totalLabor: result.labor.total,
        totalProject: result.total,
        laborBreakdown: JSON.stringify(result.labor),
      },
    })
    return reply.status(201).send({ project, calculation: result })
  })

  // PUT /api/projects/:id — editar projeto e recalcular
  app.put('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = req.user as { id: string; role: string }
    const existing = await prisma.project.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Projeto não encontrado' })
    if (existing.userId !== user.id && user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Sem permissão' })
    }

    // ── Salvar histórico ANTES de editar ──────────────────────────────
    const editor = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } })
    const lastHistory = await prisma.projectHistory.findFirst({
      where: { projectId: id }, orderBy: { version: 'desc' },
    })
    await prisma.projectHistory.create({
      data: {
        projectId: id,
        version: (lastHistory?.version ?? 0) + 1,
        snapshot: JSON.stringify(existing),
        totalProject: existing.totalProject ?? 0,
        changedBy: editor?.name ?? 'Sistema',
        notes: (req.body as any).historyNote ?? null,
      },
    })

    const body = projectSchema.parse(req.body)
    const pricing = await getDefaultPricing()
    const result = runCalc(body, pricing)
    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...body,
        totalMaterial: result.materials.total,
        totalLabor: result.labor.total,
        totalProject: result.total,
        laborBreakdown: JSON.stringify(result.labor),
      },
      include: { createdBy: { select: { name: true, username: true } } },
    })
    return { project: updated, calculation: result }
  })

  // PATCH /api/projects/:id/status
  app.patch('/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = req.user as { id: string; role: string }
    const { status } = req.body as { status: string }

    if (!VALID_STATUSES.includes(status as any)) {
      return reply.status(400).send({ error: `Status inválido. Valores aceitos: ${VALID_STATUSES.join(', ')}` })
    }
    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) return reply.status(404).send({ error: 'Projeto não encontrado' })
    if (project.userId !== user.id && user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Sem permissão para alterar este projeto' })
    }
    const updated = await prisma.project.update({ where: { id }, data: { status } })
    return updated
  })

  // POST /api/projects/:id/image
  app.post('/:id/image', async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = req.user as { id: string; role: string }
    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) return reply.status(404).send({ error: 'Projeto não encontrado' })
    if (project.userId !== user.id && user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Sem permissão' })
    }
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })
    const ext = path.extname(data.filename) || '.jpg'
    const filename = `projects/${id}-${Date.now()}${ext}`
    const buffer = await data.toBuffer()
    const { error: uploadError } = await supabase.storage
      .from('mold-images')
      .upload(filename, buffer, { contentType: data.mimetype, upsert: true })
    if (uploadError) return reply.status(500).send({ error: uploadError.message })
    const { data: publicData } = supabase.storage.from('mold-images').getPublicUrl(filename)
    const imageUrl = publicData.publicUrl
    await prisma.project.update({ where: { id }, data: { imageUrl } })
    return { imageUrl }
  })

  // DELETE /api/projects/:id
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = req.user as { id: string; role: string }
    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) return reply.status(404).send({ error: 'Projeto não encontrado' })
    if (project.userId !== user.id && user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Sem permissão' })
    }
    await prisma.project.delete({ where: { id } })
    return { ok: true }
  })
}
