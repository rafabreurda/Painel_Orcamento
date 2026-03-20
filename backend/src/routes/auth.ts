import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin } from '../middleware/auth'

const prisma = new PrismaClient()

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login
  app.post('/login', async (req, reply) => {
    const body = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({ where: { username: body.username } })
    if (!user || !user.isActive) {
      return reply.status(401).send({ error: 'Usuário ou senha inválidos' })
    }
    if (!(await bcrypt.compare(body.password, user.password))) {
      return reply.status(401).send({ error: 'Usuário ou senha inválidos' })
    }

    const token = app.jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      { expiresIn: '10h' }
    )

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        avatarColor: user.avatarColor,
        defaultRiskMargin:   user.defaultRiskMargin,
        defaultProfitMargin: user.defaultProfitMargin,
        defaultTaxRate:      user.defaultTaxRate,
        defaultSteelType:    user.defaultSteelType,
        defaultPolishLevel:  user.defaultPolishLevel,
        defaultCavities:     user.defaultCavities,
      },
    }
  })

  // GET /api/auth/me
  app.get('/me', { preHandler: [authenticate] }, async (req) => {
    const payload = req.user as { id: string }
    return prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true, name: true, username: true, role: true, avatarColor: true,
        isActive: true,
        defaultRiskMargin: true, defaultProfitMargin: true, defaultTaxRate: true,
        defaultSteelType: true, defaultPolishLevel: true, defaultCavities: true,
      },
    })
  })

  // PATCH /api/auth/my-config  — cada usuário edita suas próprias configs
  app.patch('/my-config', { preHandler: [authenticate] }, async (req) => {
    const payload = req.user as { id: string }
    const allowed = z.object({
      defaultRiskMargin:   z.number().optional(),
      defaultProfitMargin: z.number().optional(),
      defaultTaxRate:      z.number().optional(),
      defaultSteelType:    z.string().optional(),
      defaultPolishLevel:  z.string().optional(),
      defaultCavities:     z.number().int().optional(),
      avatarColor:         z.string().optional(),
    }).parse(req.body)

    return prisma.user.update({
      where: { id: payload.id },
      data: allowed,
      select: {
        id: true, name: true, username: true, role: true, avatarColor: true,
        defaultRiskMargin: true, defaultProfitMargin: true, defaultTaxRate: true,
        defaultSteelType: true, defaultPolishLevel: true, defaultCavities: true,
      },
    })
  })

  // PATCH /api/auth/change-password
  app.patch('/change-password', { preHandler: [authenticate] }, async (req, reply) => {
    const payload = req.user as { id: string }
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string }

    const user = await prisma.user.findUnique({ where: { id: payload.id } })
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return reply.status(400).send({ error: 'Senha atual incorreta' })
    }

    await prisma.user.update({
      where: { id: payload.id },
      data: { password: await bcrypt.hash(newPassword, 10) },
    })
    return { message: 'Senha alterada com sucesso' }
  })
}
