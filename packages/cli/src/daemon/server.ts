import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { streamSSE } from 'hono/streaming'
import {
  BUILTIN_TOOL_DESCRIPTORS,
  CLI_API_PATHS,
  chatRequestSchema,
  createAgentRequestSchema,
  createHealthResponse,
  createSessionRequestSchema,
  healthResponseSchema,
  sessionMetaSchema,
  sessionPatchRequestSchema,
  sessionSettingsPatchSchema,
  sessionForkRequestSchema,
  sessionNavigateRequestSchema,
  sessionTreeResponseSchema,
} from '@muse-ai/shared'
import type { CliConfig } from '../config.js'
import { ChatServiceError } from './chat-service.js'
import { SessionSettingsError } from './session-settings-service.js'
import { SessionStoreError } from '@muse-ai/core'
import { createCliAuthMiddleware } from './auth-middleware.js'
import { createSseSubscriber } from './event-hub.js'
import { startDeviceHeartbeat } from './heartbeat.js'
import type { CliDaemonDeps } from './deps.js'
import { allToolNames } from '@/tools/index.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}

export function createCliApp(config: CliConfig, deps: CliDaemonDeps): Hono {
  const app = new Hono()
  const requireAuth = createCliAuthMiddleware(deps.authState)

  app.use(
    '*',
    cors({
      origin: config.corsOrigins,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  )

  app.get(CLI_API_PATHS.HEALTH, c => {
    const body = createHealthResponse('cli', '0.0.0')
    healthResponseSchema.parse(body)
    return c.json(body)
  })

  app.get(CLI_API_PATHS.AGENTS, requireAuth, async c => {
    const agents = await deps.agentRegistry.listAgents()
    return c.json({ agents })
  })

  app.post(CLI_API_PATHS.AGENTS, requireAuth, async c => {
    const body: unknown = await c.req.json()
    const parsed = createAgentRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }
    for (const name of parsed.data.activeToolNames) {
      if (!allToolNames.has(name)) {
        return c.json({ error: 'invalid_tool', message: `未知内置工具: ${name}` }, 400)
      }
    }
    try {
      const agent = await deps.agentRegistry.createAgent(parsed.data)
      return c.json({ agent }, 201)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      return c.json({ error: 'create_failed', message }, 400)
    }
  })

  app.get(CLI_API_PATHS.PERSONAS, requireAuth, async c => {
    const personas = await deps.agentRegistry.listPersonas()
    return c.json({ personas })
  })

  app.get(CLI_API_PATHS.SKILLS, requireAuth, async c => {
    const skills = await deps.agentRegistry.listSkills()
    return c.json({ skills })
  })

  app.get(CLI_API_PATHS.TOOLS, requireAuth, async c => {
    return c.json({ tools: BUILTIN_TOOL_DESCRIPTORS })
  })

  app.get(CLI_API_PATHS.SESSIONS, requireAuth, async c => {
    const sessions = await deps.sessionStore.list()
    return c.json({ sessions })
  })

  app.post(CLI_API_PATHS.SESSIONS, requireAuth, async c => {
    const body: unknown = await c.req.json().catch(() => ({}))
    const parsed = createSessionRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }

    const agentId = parsed.data.agentId ?? (await deps.resolveDefaultAgentId())
    const agent = await deps.agentRegistry.getAgent(agentId)
    if (!agent) {
      return c.json({ error: 'agent_not_found', message: `Agent 不存在: ${agentId}` }, 404)
    }

    const session = await deps.sessionStore.create({ ...parsed.data, agentId })
    sessionMetaSchema.parse(session)
    return c.json({ session }, 201)
  })

  app.patch('/sessions/:sessionId', requireAuth, async c => {
    const sessionId = c.req.param('sessionId')
    if (!isUuid(sessionId)) {
      return c.json({ error: 'invalid_session_id' }, 400)
    }
    const body: unknown = await c.req.json()
    const parsed = sessionPatchRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }
    const updated = await deps.sessionStore.updateName(sessionId, parsed.data.name, 'manual')
    if (!updated) {
      return c.json({ error: 'session_not_found', message: `Session 不存在: ${sessionId}` }, 404)
    }
    sessionMetaSchema.parse(updated)
    return c.json({ session: updated })
  })

  app.delete('/sessions/:sessionId', requireAuth, async c => {
    const sessionId = c.req.param('sessionId')
    if (!isUuid(sessionId)) {
      return c.json({ error: 'invalid_session_id' }, 400)
    }
    if (deps.chatService.isSessionBusy(sessionId)) {
      return c.json({ error: 'session_busy', message: 'Agent 正在回复中，请稍后再试' }, 409)
    }
    const deleted = await deps.sessionStore.delete(sessionId)
    if (!deleted) {
      return c.json({ error: 'session_not_found', message: `Session 不存在: ${sessionId}` }, 404)
    }
    return c.json({ deleted: true, sessionId })
  })

  app.get('/sessions/:sessionId/events', requireAuth, async c => {
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

  app.get('/sessions/:sessionId/settings', requireAuth, async c => {
    const sessionId = c.req.param('sessionId')
    if (!isUuid(sessionId)) {
      return c.json({ error: 'invalid_session_id' }, 400)
    }
    try {
      const settings = await deps.sessionSettingsService.get(sessionId)
      return c.json(settings)
    } catch (error: unknown) {
      if (error instanceof SessionSettingsError && error.code === 'session_not_found') {
        return c.json({ error: error.code, message: error.message }, 404)
      }
      throw error
    }
  })

  app.patch('/sessions/:sessionId/settings', requireAuth, async c => {
    const sessionId = c.req.param('sessionId')
    if (!isUuid(sessionId)) {
      return c.json({ error: 'invalid_session_id' }, 400)
    }
    const body: unknown = await c.req.json()
    const parsed = sessionSettingsPatchSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }
    try {
      const settings = await deps.sessionSettingsService.patch(sessionId, parsed.data)
      return c.json(settings)
    } catch (error: unknown) {
      if (error instanceof SessionSettingsError) {
        const status = error.code === 'session_not_found' ? 404 : error.code === 'agent_not_found' ? 404 : 400
        return c.json({ error: error.code, message: error.message }, status)
      }
      throw error
    }
  })

  app.get('/sessions/:sessionId/tree', requireAuth, async c => {
    const sessionId = c.req.param('sessionId')
    if (!isUuid(sessionId)) {
      return c.json({ error: 'invalid_session_id' }, 400)
    }
    try {
      const tree = await deps.sessionStore.getTree(sessionId)
      return c.json(sessionTreeResponseSchema.parse(tree))
    } catch (error: unknown) {
      if (error instanceof SessionStoreError && error.code === 'session_not_found') {
        return c.json({ error: error.code, message: error.message }, 404)
      }
      throw error
    }
  })

  app.post('/sessions/:sessionId/navigate', requireAuth, async c => {
    const sessionId = c.req.param('sessionId')
    if (!isUuid(sessionId)) {
      return c.json({ error: 'invalid_session_id' }, 400)
    }
    const body: unknown = await c.req.json()
    const parsed = sessionNavigateRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }
    try {
      const tree = await deps.sessionStore.navigate(sessionId, parsed.data.entryId)
      return c.json(sessionTreeResponseSchema.parse(tree))
    } catch (error: unknown) {
      if (error instanceof SessionStoreError) {
        const status = error.code === 'session_not_found' || error.code === 'entry_not_found' ? 404 : 400
        return c.json({ error: error.code, message: error.message }, status)
      }
      throw error
    }
  })

  app.post('/sessions/:sessionId/fork', requireAuth, async c => {
    const sessionId = c.req.param('sessionId')
    if (!isUuid(sessionId)) {
      return c.json({ error: 'invalid_session_id' }, 400)
    }
    const body: unknown = await c.req.json().catch(() => ({}))
    const parsed = sessionForkRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }
    try {
      const session = await deps.sessionStore.fork(sessionId, parsed.data)
      sessionMetaSchema.parse(session)
      return c.json({ session }, 201)
    } catch (error: unknown) {
      if (error instanceof SessionStoreError && error.code === 'session_not_found') {
        return c.json({ error: error.code, message: error.message }, 404)
      }
      const message = error instanceof Error ? error.message : String(error)
      return c.json({ error: 'fork_failed', message }, 400)
    }
  })

  app.post(CLI_API_PATHS.CHAT, requireAuth, async c => {
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

  if (deps.authState.deviceToken) {
    startDeviceHeartbeat(config)
    console.log('[muse] 设备已配对，心跳已启动')
  } else {
    console.warn('[muse] 未配对设备：CLI API 暂不强制鉴权；执行 muse pair <配对码> 后启用')
  }

  serve({
    fetch: app.fetch,
    hostname: config.host,
    port: config.port,
  })

  console.log(`muse cli daemon listening on http://${config.host}:${config.port}`)
}
