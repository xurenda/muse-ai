import type { Context } from 'hono'
import { MarketInstallerError } from './market-errors.js'

/** 将 MarketInstallerError 映射为 HTTP 响应 */
export function respondMarketInstallerError(c: Context, error: MarketInstallerError): Response {
  switch (error.code) {
    case 'device_not_paired':
      return c.json({ error: error.code, message: error.message }, 401)
    case 'agents_reference_conflict':
      return c.json(
        {
          error: error.code,
          message: error.message,
          conflictingAgents: error.details?.conflictingAgents ?? [],
        },
        409,
      )
    case 'basic_kit_uninstall_forbidden':
      return c.json({ error: error.code, message: error.message }, 409)
    case 'package_not_installed':
      return c.json({ error: error.code, message: error.message }, 404)
    default:
      return c.json({ error: error.code, message: error.message }, 400)
  }
}
