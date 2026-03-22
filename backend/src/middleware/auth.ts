import { FastifyRequest, FastifyReply } from 'fastify'

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    await reply.status(401).send({ error: 'Token inválido ou expirado' })
    return
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const user = req.user as { role: string }
  if (user.role !== 'ADMIN') {
    await reply.status(403).send({ error: 'Acesso restrito a administradores' })
    return
  }
}
