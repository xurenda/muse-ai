import type { AgentDefinition } from '@museai/shared'

export class MarketInstallerError extends Error {
  constructor(
    readonly code:
      | 'pack_too_large'
      | 'sha256_mismatch'
      | 'unsafe_zip_path'
      | 'invalid_manifest'
      | 'package_not_installed'
      | 'basic_kit_uninstall_forbidden'
      | 'agents_reference_conflict'
      | 'device_not_paired'
      | 'backend_error',
    message: string,
    readonly details?: { conflictingAgents?: AgentDefinition[] },
  ) {
    super(message)
    this.name = 'MarketInstallerError'
  }
}
