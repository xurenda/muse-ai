import type { Hono } from 'hono'
import { SERVER_API_PATHS, marketInstallUrlRequestSchema, marketPackageKindSchema } from '@museai/shared'
import { readFile } from 'node:fs/promises'
import { MarketError, type MarketService } from '../market/market-service.js'
import { createMarketInstallAuthMiddleware } from '../middleware/market-install-auth.js'
import type { AuthService } from '../services/auth-service.js'
import type { DeviceService } from '../services/device-service.js'
import type { ServerVariables } from '../types.js'

type ServerApp = Hono<{ Variables: ServerVariables }>

function toPackageId(author: string, slug: string): string {
  return `${author}/${slug}`
}

export function registerMarketRoutes(
  app: ServerApp,
  marketService: MarketService,
  authService: AuthService,
  userAuth: ReturnType<typeof import('../middleware/user-auth.js').createUserAuthMiddleware>,
  deviceAuth: ReturnType<typeof import('../middleware/device-auth.js').createDeviceAuthMiddleware>,
  deviceService: DeviceService,
): void {
  const marketInstallAuth = createMarketInstallAuthMiddleware(authService, deviceService)
  app.get(SERVER_API_PATHS.MARKET_PACKAGES, userAuth, async c => {
    const kindRaw = c.req.query('kind')
    const kindParsed = kindRaw ? marketPackageKindSchema.safeParse(kindRaw) : undefined
    if (kindRaw && !kindParsed?.success) {
      return c.json({ error: 'invalid_request', message: '无效的 kind 参数' }, 400)
    }

    const result = await marketService.listPublishedPackages({
      kind: kindParsed?.data,
      author: c.req.query('author'),
      q: c.req.query('q'),
    })
    return c.json(result)
  })

  app.post(`${SERVER_API_PATHS.MARKET_PACKAGES}/:author/:slug/install-url`, marketInstallAuth, async c => {
    const author = c.req.param('author')
    const slug = c.req.param('slug')
    if (!author || !slug) {
      return c.json({ error: 'invalid_request', message: '缺少 packageId' }, 400)
    }

    const json: unknown = await c.req.json().catch(() => ({}))
    const parsed = marketInstallUrlRequestSchema.safeParse(json)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }

    try {
      const result = await marketService.createInstallUrl(toPackageId(author, slug), parsed.data.version)
      return c.json(result)
    } catch (error: unknown) {
      if (error instanceof MarketError) {
        const status = error.code === 'package_not_found' || error.code === 'version_not_found' ? 404 : 503
        return c.json({ error: error.code, message: error.message }, status)
      }
      throw error
    }
  })

  app.get(`${SERVER_API_PATHS.MARKET_PACKAGES}/:author/:slug`, userAuth, async c => {
    const author = c.req.param('author')
    const slug = c.req.param('slug')
    if (!author || !slug) {
      return c.json({ error: 'invalid_request', message: '缺少 packageId' }, 400)
    }
    try {
      const detail = await marketService.getPackageDetail(toPackageId(author, slug))
      return c.json(detail)
    } catch (error: unknown) {
      if (error instanceof MarketError) {
        return c.json({ error: error.code, message: error.message }, 404)
      }
      throw error
    }
  })

  app.get(`${SERVER_API_PATHS.MARKET_DOWNLOAD}/:author/:slug/:version`, deviceAuth, async c => {
    const author = c.req.param('author')
    const slug = c.req.param('slug')
    const version = c.req.param('version')
    if (!author || !slug || !version) {
      return c.json({ error: 'invalid_request', message: '缺少下载参数' }, 400)
    }

    try {
      const blob = await marketService.getPublishedVersionBlob(toPackageId(author, slug), version)
      const data = await readFile(blob.absolutePath)
      const filename = `${author}-${slug}-${version}.musepack`
      return new Response(data, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-Muse-Pack-Sha256': blob.sha256,
        },
      })
    } catch (error: unknown) {
      if (error instanceof MarketError) {
        const status = error.code === 'package_not_found' || error.code === 'version_not_found' ? 404 : 503
        return c.json({ error: error.code, message: error.message }, status)
      }
      throw error
    }
  })
}
