import { type MusePaths } from '../paths.js'
import { MarketInstallerError } from '../market/market-errors.js'
import {
  installMarketPackageFromBackend,
  installMarketPackageFromFile,
  listInstalledMarketPackages,
  uninstallMarketPackage,
  updateMarketPackage,
} from '../market/market-installer.js'
import { resolveMarketBackendOptions } from '../market/resolve-backend-options.js'

function isLocalMusepackPath(value: string): boolean {
  return value.endsWith('.musepack') || value.startsWith('./') || value.startsWith('/')
}

async function resolveBackendInstallOptions(): Promise<{ backendUrl: string; deviceToken: string }> {
  const { getMusePaths } = await import('../paths.js')
  return resolveMarketBackendOptions(getMusePaths())
}

export async function runMarketCommand(args: string[], paths?: MusePaths): Promise<number> {
  const { getMusePaths } = await import('../paths.js')
  const musePaths = paths ?? getMusePaths()
  const subcommand = args[0]

  try {
    switch (subcommand) {
      case 'list': {
        const installed = await listInstalledMarketPackages(musePaths)
        const entries = Object.entries(installed.packages)
        if (entries.length === 0) {
          console.log('（无已安装市场包）')
          return 0
        }
        for (const [packageId, entry] of entries) {
          console.log(`${packageId}\t${entry.version}\t${entry.installedAt}`)
        }
        return 0
      }
      case 'install': {
        const target = args[1]?.trim()
        if (!target) {
          console.error('用法: muse market install <packageId> | muse market install <path.musepack>')
          return 1
        }
        if (isLocalMusepackPath(target)) {
          const result = await installMarketPackageFromFile(musePaths, target)
          console.log(`${result.action === 'installed' ? '已安装' : '已更新'} ${result.packageId}@${result.version}`)
          return 0
        }
        const backend = await resolveBackendInstallOptions()
        const result = await installMarketPackageFromBackend(musePaths, target, backend)
        console.log(`${result.action === 'installed' ? '已安装' : '已更新'} ${result.packageId}@${result.version}`)
        return 0
      }
      case 'update': {
        const packageId = args[1]?.trim()
        if (!packageId) {
          console.error('用法: muse market update <packageId>')
          return 1
        }
        const backend = await resolveBackendInstallOptions()
        const result = await updateMarketPackage(musePaths, packageId, backend)
        console.log(`已更新 ${result.packageId}@${result.version}`)
        return 0
      }
      case 'uninstall': {
        const packageId = args[1]?.trim()
        if (!packageId) {
          console.error('用法: muse market uninstall <packageId>')
          return 1
        }
        await uninstallMarketPackage(musePaths, packageId)
        console.log(`已卸载 ${packageId}`)
        return 0
      }
      default:
        console.error('用法: muse market list|install|update|uninstall')
        return 1
    }
  } catch (error: unknown) {
    if (error instanceof MarketInstallerError) {
      console.error(error.message)
      if (error.code === 'agents_reference_conflict' && error.details?.conflictingAgents) {
        for (const agent of error.details.conflictingAgents) {
          console.error(`- ${agent.name} (${agent.id}) persona=${agent.personaId}`)
        }
      }
      return 1
    }
    throw error
  }
}
