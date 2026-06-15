#!/usr/bin/env node
import { loadCliConfig } from './config.js'
import { runAgentCommand } from './commands/agent.js'
import { runChatCommand } from './commands/chat.js'
import { runPairCommand } from './commands/pair.js'
import { createCliDaemonDeps } from './daemon/deps.js'
import { startCliServer } from './daemon/server.js'
import { ensureMuseDir } from './paths.js'

const command = process.argv[2]

async function main(): Promise<void> {
  switch (command) {
    case 'start':
    case undefined: {
      await ensureMuseDir()
      const deps = await createCliDaemonDeps()
      startCliServer(loadCliConfig(), deps)
      break
    }
    case 'agent': {
      await ensureMuseDir()
      const code = await runAgentCommand(process.argv.slice(3))
      process.exitCode = code
      break
    }
    case 'pair': {
      await ensureMuseDir()
      const code = await runPairCommand(process.argv.slice(3))
      process.exitCode = code
      break
    }
    case 'chat': {
      const code = await runChatCommand(process.argv.slice(3))
      process.exitCode = code
      break
    }
    default:
      console.error(`未知命令: ${command}`)
      console.error('用法: muse start | muse agent list|create|use | muse pair <code> | muse chat <消息>')
      process.exit(1)
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
