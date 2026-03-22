import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin } from '../middleware/auth'

const prisma = new PrismaClient()

const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#14b8a6',
]

function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
}

const createUserSchema = z.object({
  username:    z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, 'Apenas letras minúsculas, números e _'),
  name:        z.string().min(2),
  password:    z.string().min(4),
  role:        z.enum(['ADMIN', 'ENGINEER', 'SALESPERSON']).default('ENGINEER'),
  avatarColor: z.string().optional(),
  defaultRiskMargin:   z.number().default(15),
  defaultProfitMargin: z.number().default(20),
  defaultTaxRate:      z.number().default(8),
  defaultSteelType:    z.string().default('P20'),
  defaultPolishLevel:  z.string().default('STANDARD'),
  defaultCavities:     z.number().int().default(1),
})

const updateUserSchema = z.object({
  name:        z.string().min(2).optional(),
  role:        z.enum(['ADMIN', 'ENGINEER', 'SALESPERSON']).optional(),
  isActive:    z.boolean().optional(),
  avatarColor: z.string().optional(),
  password:    z.string().min(4).optional(),
  defaultRiskMargin:   z.number().optional(),
  defaultProfitMargin: z.number().optional(),
  defaultTaxRate:      z.number().optional(),
  defaultSteelType:    z.string().optional(),
  defaultPolishLevel:  z.string().optional(),
  defaultCavities:     z.number().int().optional(),
})

const SELECT_USER = {
  id: true, username: true, name: true, role: true,
  isActive: true, avatarColor: true, createdAt: true,
  defaultRiskMargin: true, defaultProfitMargin: true,
  defaultTaxRate: true, defaultSteelType: true,
  defaultPolishLevel: true, defaultCavities: true,
  _count: { select: { projects: true } },
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)
  app.addHook('preHandler', requireAdmin)

  // GET /api/admin/users
  app.get('/users', async () => {
    return prisma.user.findMany({
      select: SELECT_USER,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    })
  })

  // GET /api/admin/users/:id
  app.get('/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = await prisma.user.findUnique({ where: { id }, select: SELECT_USER })
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado' })
    return user
  })

  // POST /api/admin/users
  app.post('/users', async (req, reply) => {
    const body = createUserSchema.parse(req.body)

    const exists = await prisma.user.findUnique({ where: { username: body.username } })
    if (exists) return reply.status(409).send({ error: 'Nome de usuário já existe' })

    const user = await prisma.user.create({
      data: {
        ...body,
        password: await bcrypt.hash(body.password, 10),
        avatarColor: body.avatarColor || randomColor(),
      },
      select: SELECT_USER,
    })
    return reply.status(201).send(user)
  })

  // PATCH /api/admin/users/:id
  app.patch('/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    const body = updateUserSchema.parse(req.body)
    const data: any = { ...body }
    if (body.password) data.password = await bcrypt.hash(body.password, 10)
    else delete data.password

    const user = await prisma.user.update({ where: { id }, data, select: SELECT_USER })
    return user
  })

  // DELETE /api/admin/users/:id
  app.delete('/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const caller = (req.user as { id: string })

    if (id === caller.id) return reply.status(400).send({ error: 'Você não pode se excluir' })

    const count = await prisma.project.count({ where: { userId: id } })
    if (count > 0) {
      // Apenas desativa — não deleta para preservar histórico
      await prisma.user.update({ where: { id }, data: { isActive: false } })
      return { message: `Usuário desativado (possui ${count} projeto(s))` }
    }

    await prisma.user.delete({ where: { id } })
    return { message: 'Usuário removido' }
  })

  // GET /api/admin/stats
  app.get('/stats', async () => {
    const [users, activeUsers, totalProjects, totalValue] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.project.count(),
      prisma.project.aggregate({ _sum: { totalProject: true } }),
    ])

    const byRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
    })

    return {
      users,
      activeUsers,
      totalProjects,
      totalValue: totalValue._sum.totalProject ?? 0,
      byRole: byRole.map(r => ({ role: r.role, count: r._count.id })),
    }
  })
}
