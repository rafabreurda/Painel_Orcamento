import type { IncomingMessage, ServerResponse } from 'http'
import fs from 'fs'
import path from 'path'
import { buildApp } from '../backend/src/app'

// On Vercel with SQLite: copy seed.db from bundle to /tmp on first run
function ensureDatabase() {
  const tmpDb = '/tmp/dev.db'
  if (!fs.existsSync(tmpDb)) {
    // Try to find the seed db bundled with the function
    const candidates = [
      path.join(process.cwd(), 'backend/prisma/dev.db'),
      path.join(__dirname, '../backend/prisma/dev.db'),
      '/var/task/backend/prisma/dev.db',
    ]
    for (const src of candidates) {
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, tmpDb)
        console.log(`[init] Copied SQLite DB from ${src} to ${tmpDb}`)
        break
      }
    }
    if (!fs.existsSync(tmpDb)) {
      console.warn('[init] WARNING: seed.db not found in any candidate path')
    }
  }
  // Override DATABASE_URL to point to /tmp/dev.db
  process.env.DATABASE_URL = 'file:/tmp/dev.db'
}

// Run DB setup before anything else
ensureDatabase()

// Singleton — reutiliza entre invocações no mesmo worker
let app: ReturnType<typeof buildApp> | null = null

async function getApp() {
  if (!app) {
    app = buildApp()
    await app.ready()
  }
  return app
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const instance = await getApp()
  instance.server.emit('request', req, res)
}
