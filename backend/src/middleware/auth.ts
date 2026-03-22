import { FastifyRequest, FastifyReply } from 'fastify'

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    reply.status(401).send({ error: 'Token inválido ou expirado' })
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const user = req.user as { role: string }
  if (user.role !== 'ADMIN') {
    return reply.status(403).send({ error: 'Acesso restrito a administradores' })
  }
}
