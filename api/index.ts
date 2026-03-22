import type { IncomingMessage, ServerResponse } from 'http'
import { buildApp } from '../backend/src/app'

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
