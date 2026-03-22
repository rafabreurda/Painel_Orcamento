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
import { historyRoutes } from './routes/history'
import { configRoutes } from './routes/config'

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'production',
  })

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true) // server-to-server / curl
      // Allow localhost (dev) and any Vercel deployment of this project
      if (
        origin.startsWith('http://localhost') ||
        origin.endsWith('.vercel.app') ||
        origin === process.env.PRODUCTION_FRONTEND_URL
      ) {
        return cb(null, true)
      }
      cb(new Error('Not allowed by CORS'), false)
    },
    credentials: true,
  })

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET env var is required')
  }
  app.register(jwt, {
    secret: process.env.JWT_SECRET,
  })

  app.register(multipart, {
    limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  })

  app.get('/health', async () => ({ status: 'ok', service: 'NeuroFlux Mold API' }))
  app.get('/api/health', async () => ({ status: 'ok' }))

  app.register(authRoutes,    { prefix: '/api/auth' })
  app.register(projectRoutes, { prefix: '/api/projects' })
  app.register(historyRoutes, { prefix: '/api/projects' })
  app.register(pricingRoutes, { prefix: '/api/pricing' })
  app.register(exportRoutes,  { prefix: '/api/exports' })
  app.register(adminRoutes,   { prefix: '/api/admin' })
  app.register(visionRoutes,  { prefix: '/api/vision' })
  app.register(configRoutes,  { prefix: '/api/config' })

  return app
}
