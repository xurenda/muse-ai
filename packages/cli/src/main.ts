import { runDaemonStart } from './commands/daemon-start'
import { runDaemonStatus } from './commands/daemon-status'
import { runDaemonStop } from './commands/daemon-stop'
import { runInit } from './commands/init'

interface ParsedArgs {
  command?: string
  subcommand?: string
  port?: number
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, subcommand, ...rest] = argv
  const parsed: ParsedArgs = { command, subcommand }

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]
    if (token === '--port' || token === '-p') {
      const value = rest[index + 1]
      if (!value) {
        throw new Error('缺少 --port 参数值')
      }
      parsed.port = Number.parseInt(value, 10)
      if (Number.isNaN(parsed.port)) {
        throw new Error(`无效的端口号: ${value}`)
      }
      index += 1
    }
  }

  return parsed
}

function printUsage(): void {
  console.log(`用法:
  muse init
  muse daemon start [--port <port>]
  muse daemon stop
  muse daemon status`)
}

export async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv)

  if (args.command === 'init') {
    await runInit()
    return
  }

  if (args.command === 'daemon') {
    switch (args.subcommand) {
      case 'start':
        await runDaemonStart(args.port)
        return
      case 'stop':
        await runDaemonStop()
        return
      case 'status':
        await runDaemonStatus()
        return
      default:
        printUsage()
        process.exit(1)
    }
  }

  printUsage()
  process.exit(1)
}
