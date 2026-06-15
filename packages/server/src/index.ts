import { serve } from '@hono/node-server'
import { createServerApp } from './app.js'
import { loadServerConfig } from './config.js'

const config = loadServerConfig()
const app = createServerApp(config)

serve({
  fetch: app.fetch,
  hostname: config.host,
  port: config.port,
})

console.log(`muse server listening on http://${config.host}:${config.port}`)
