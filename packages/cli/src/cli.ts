#!/usr/bin/env node
import { loadCliConfig } from './config.js'
import { createCliDaemonDeps } from './daemon/deps.js'
import { startCliServer } from './daemon/server.js'
import { ensureMuseDir } from './paths.js'

const command = process.argv[2]

async function main(): Promise<void> {
  switch (command) {
    case 'start':
    case undefined: {
      await ensureMuseDir()
      const deps = createCliDaemonDeps()
      startCliServer(loadCliConfig(), deps)
      break
    }
    default:
      console.error(`未知命令: ${command}`)
      console.error('用法: muse start')
      process.exit(1)
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
