import 'dotenv/config'
import { serve } from '@hono/node-server'
import { createServerApp, createServerContext } from './app.js'
import { loadServerConfig } from './config.js'

const config = loadServerConfig()
const ctx = await createServerContext(config)
const app = createServerApp(ctx)

const server = serve({
  fetch: app.fetch,
  hostname: config.host,
  port: config.port,
})

console.log(`muse server listening on http://${config.host}:${config.port}`)

const shutdown = async () => {
  server.close()
  await ctx.close()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
