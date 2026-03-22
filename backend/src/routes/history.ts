import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { authenticate } from '../middleware/auth'

const prisma = new PrismaClient()

export async function historyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /api/projects/:id/history
  app.get('/:id/history', async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = req.user as { id: string; role: string }

    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) return reply.status(404).send({ error: 'Projeto não encontrado' })
    if (project.userId !== user.id && user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Sem permissão' })
    }

    const history = await prisma.projectHistory.findMany({
      where: { projectId: id },
      orderBy: { version: 'desc' },
    })

    return history.map(h => ({
      id: h.id,
      version: h.version,
      totalProject: h.totalProject,
      changedBy: h.changedBy,
      notes: h.notes,
      createdAt: h.createdAt,
      // snapshot parseado só sob demanda
    }))
  })

  // GET /api/projects/:id/history/:historyId — snapshot completo
  app.get('/:id/history/:historyId', async (req, reply) => {
    const { id, historyId } = req.params as { id: string; historyId: string }
    const user = req.user as { id: string; role: string }

    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) return reply.status(404).send({ error: 'Projeto não encontrado' })
    if (project.userId !== user.id && user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Sem permissão' })
    }

    const entry = await prisma.projectHistory.findFirst({
      where: { id: historyId, projectId: id },
    })
    if (!entry) return reply.status(404).send({ error: 'Versão não encontrada' })

    try {
      return { ...entry, snapshot: JSON.parse(entry.snapshot) }
    } catch {
      return entry
    }
  })
}
