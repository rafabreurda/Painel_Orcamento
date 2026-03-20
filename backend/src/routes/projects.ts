import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs/promises'
import { authenticate } from '../middleware/auth'
import { calculateMold } from '../services/moldCalculator'

const prisma = new PrismaClient()

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
  riskMargin: z.number().min(0).max(100).default(15),
  profitMargin: z.number().min(0).max(100).default(20),
  taxRate: z.number().min(0).max(100).default(8),
})

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

export async function projectRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /api/projects
  app.get('/', async (req) => {
    const user = req.user as { id: string; role: string }
    const where = user.role === 'ADMIN' ? {} : { userId: user.id }
    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, clientName: true, status: true,
        totalProject: true, cavities: true, steelType: true,
        createdAt: true, imageUrl: true,
        createdBy: { select: { name: true } },
      },
    })
    return projects
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

    return {
      total,
      pending,
      inProduction: inProd,
      totalValue: totalValue._sum.totalProject ?? 0,
    }
  })

  // GET /api/projects/:id
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const project = await prisma.project.findUnique({
      where: { id },
      include: { createdBy: { select: { name: true, email: true } } },
    })
    if (!project) return reply.status(404).send({ error: 'Projeto não encontrado' })
    return project
  })

  // POST /api/projects
  app.post('/', async (req, reply) => {
    const user = req.user as { id: string }
    const body = projectSchema.parse(req.body)
    const pricing = await getDefaultPricing()

    const result = calculateMold({
      pieceSize: { x: body.pieceX, y: body.pieceY, z: body.pieceZ },
      cavities: body.cavities,
      hasDrawers: body.hasDrawers,
      drawerCount: body.drawerCount,
      polishLevel: body.polishLevel,
      steelType: body.steelType,
      riskMargin: body.riskMargin,
      profitMargin: body.profitMargin,
      taxRate: body.taxRate,
      pricing,
    })

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

  // PATCH /api/projects/:id/status
  app.patch('/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { status } = req.body as { status: string }
    const project = await prisma.project.update({
      where: { id },
      data: { status: status as any },
    })
    return project
  })

  // POST /api/projects/:id/image
  app.post('/:id/image', async (req, reply) => {
    const { id } = req.params as { id: string }
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })

    const uploadDir = path.join(process.cwd(), 'uploads', 'projects')
    await fs.mkdir(uploadDir, { recursive: true })
    const filename = `${id}-${Date.now()}${path.extname(data.filename)}`
    const filepath = path.join(uploadDir, filename)
    await fs.writeFile(filepath, await data.toBuffer())

    const imageUrl = `/uploads/projects/${filename}`
    await prisma.project.update({ where: { id }, data: { imageUrl } })
    return { imageUrl }
  })

  // POST /api/projects/calculate — cálculo sem salvar
  app.post('/calculate', async (req) => {
    const body = projectSchema.parse(req.body)
    const pricing = await getDefaultPricing()

    return calculateMold({
      pieceSize: { x: body.pieceX, y: body.pieceY, z: body.pieceZ },
      cavities: body.cavities,
      hasDrawers: body.hasDrawers,
      drawerCount: body.drawerCount,
      polishLevel: body.polishLevel,
      steelType: body.steelType,
      riskMargin: body.riskMargin,
      profitMargin: body.profitMargin,
      taxRate: body.taxRate,
      pricing,
    })
  })
}
