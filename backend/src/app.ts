import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import path from 'path'
import { authRoutes } from './routes/auth'
import { projectRoutes } from './routes/projects'
import { pricingRoutes } from './routes/pricing'
import { exportRoutes } from './routes/exports'
import { adminRoutes } from './routes/admin'
import { visionRoutes } from './routes/vision'

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'production',
  })

  const origins = [
    'http://localhost:5173',
    'http://localhost:4173',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ]

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true) // server-to-server
      if (origins.some(o => origin.startsWith(o)) || origin.includes('vercel.app')) {
        return cb(null, true)
      }
      cb(new Error('Not allowed by CORS'), false)
    },
    credentials: true,
  })

  app.register(jwt, {
    secret: process.env.JWT_SECRET || 'euromoldes-secret-2024',
  })

  app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024 },
  })

  app.get('/health', async () => ({ status: 'ok', service: 'NeuroFlux Mold API' }))
  app.get('/api/health', async () => ({ status: 'ok' }))

  app.register(authRoutes,    { prefix: '/api/auth' })
  app.register(projectRoutes, { prefix: '/api/projects' })
  app.register(pricingRoutes, { prefix: '/api/pricing' })
  app.register(exportRoutes,  { prefix: '/api/exports' })
  app.register(adminRoutes,   { prefix: '/api/admin' })
  app.register(visionRoutes,  { prefix: '/api/vision' })

  return app
}
