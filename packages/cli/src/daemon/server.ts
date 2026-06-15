import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { streamSSE } from 'hono/streaming'
import { CLI_API_PATHS, chatRequestSchema, createHealthResponse, createSessionRequestSchema, healthResponseSchema, sessionMetaSchema } from '@muse-ai/shared'
import type { CliConfig } from '../config.js'
import { ChatServiceError } from './chat-service.js'
import { createSseSubscriber } from './event-hub.js'
import type { CliDaemonDeps } from './deps.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}

export function createCliApp(config: CliConfig, deps: CliDaemonDeps): Hono {
  const app = new Hono()

  app.use(
    '*',
    cors({
      origin: config.corsOrigins,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  )

  app.get(CLI_API_PATHS.HEALTH, c => {
    const body = createHealthResponse('cli', '0.0.0')
    healthResponseSchema.parse(body)
    return c.json(body)
  })

  app.get(CLI_API_PATHS.AGENTS, c => c.json({ agents: [] }))

  app.get(CLI_API_PATHS.SESSIONS, async c => {
    const sessions = await deps.sessionStore.list()
    return c.json({ sessions })
  })

  app.post(CLI_API_PATHS.SESSIONS, async c => {
    const body: unknown = await c.req.json()
    const parsed = createSessionRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }

    const session = await deps.sessionStore.create(parsed.data)
    sessionMetaSchema.parse(session)
    return c.json({ session }, 201)
  })

  app.get('/sessions/:sessionId/events', async c => {
    const sessionId = c.req.param('sessionId')
    if (!isUuid(sessionId)) {
      return c.json({ error: 'invalid_session_id' }, 400)
    }

    const session = await deps.sessionStore.get(sessionId)
    if (!session) {
      return c.json({ error: 'session_not_found' }, 404)
    }

    return streamSSE(c, async stream => {
      const unsubscribe = deps.eventHub.subscribe(
        sessionId,
        createSseSubscriber(c.req.raw.signal, async event => {
          await stream.writeSSE({ data: JSON.stringify(event) })
        }),
      )

      await new Promise<void>(resolve => {
        const done = () => resolve()
        c.req.raw.signal.addEventListener('abort', done, { once: true })
      })

      unsubscribe()
    })
  })

  app.post(CLI_API_PATHS.CHAT, async c => {
    const body: unknown = await c.req.json()
    const parsed = chatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }

    try {
      const result = await deps.chatService.enqueue(parsed.data)
      return c.json(result, 202)
    } catch (error: unknown) {
      if (error instanceof ChatServiceError && error.code === 'session_not_found') {
        return c.json({ error: error.code, message: error.message }, 404)
      }
      throw error
    }
  })

  return app
}

export function startCliServer(config: CliConfig, deps: CliDaemonDeps): void {
  const app = createCliApp(config, deps)

  serve({
    fetch: app.fetch,
    hostname: config.host,
    port: config.port,
  })

  console.log(`muse cli daemon listening on http://${config.host}:${config.port}`)
}
