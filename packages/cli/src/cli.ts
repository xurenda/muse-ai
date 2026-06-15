#!/usr/bin/env node
import { loadCliConfig } from './config.js'
import { runAgentCommand } from './commands/agent.js'
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
    case 'agent': {
      await ensureMuseDir()
      const code = await runAgentCommand(process.argv.slice(3))
      process.exitCode = code
      break
    }
    default:
      console.error(`未知命令: ${command}`)
      console.error('用法: muse start | muse agent list|create|use')
      process.exit(1)
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
