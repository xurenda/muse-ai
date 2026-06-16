import { CLI_API_PATHS, sessionEventsPath, type MuseSseEvent } from '@muse-ai/shared'
import { loadCliConfig } from '../config.js'
import { getMusePaths, loadMuseConfig } from '../paths.js'

function buildAuthHeaders(deviceToken?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (deviceToken) {
    headers.Authorization = `Bearer ${deviceToken}`
  }
  return headers
}

async function createSession(baseUrl: string, headers: Record<string, string>): Promise<string> {
  const res = await fetch(`${baseUrl}${CLI_API_PATHS.SESSIONS}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    throw new Error(`创建 Session 失败: ${res.status}`)
  }
  const body = (await res.json()) as { session: { id: string } }
  return body.session.id
}

export async function runChatCommand(args: string[]): Promise<number> {
  const showThinking = args.includes('--show-thinking')
  const messageArgs = showThinking ? args.filter(a => a !== '--show-thinking') : args
  const message = messageArgs.join(' ').trim()
  if (!message) {
    console.error('用法: muse chat [--show-thinking] <消息>')
    return 1
  }

  const cliConfig = loadCliConfig()
  const baseUrl = `http://${cliConfig.host === '0.0.0.0' ? '127.0.0.1' : cliConfig.host}:${cliConfig.port}`

  let deviceToken: string | undefined
  try {
    const museConfig = await loadMuseConfig(getMusePaths())
    deviceToken = museConfig.deviceToken
  } catch {
    deviceToken = undefined
  }

  const headers = buildAuthHeaders(deviceToken)

  try {
    const sessionId = await createSession(baseUrl, headers)

    const sseRes = await fetch(`${baseUrl}${sessionEventsPath(sessionId)}`, { headers })
    if (!sseRes.ok || !sseRes.body) {
      throw new Error(`订阅 SSE 失败: ${sseRes.status}`)
    }

    const reader = sseRes.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let done = false

    const readLoop = (async () => {
      while (!done) {
        const { value, done: streamDone } = await reader.read()
        if (streamDone) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice('data: '.length)
          try {
            const event = JSON.parse(payload) as MuseSseEvent
            if (event.type === 'text_delta') {
              process.stdout.write(event.delta)
            }
            if (event.type === 'thinking_delta' && showThinking) {
              process.stderr.write(event.delta)
            }
            if (event.type === 'error') {
              process.stderr.write(`\n[error] ${event.message}\n`)
            }
            if (event.type === 'agent_end' || event.type === 'error') {
              done = true
              await reader.cancel()
              break
            }
          } catch {
            // 忽略解析失败行
          }
        }
      }
    })()

    const chatRes = await fetch(`${baseUrl}${CLI_API_PATHS.CHAT}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId, message, mode: 'prompt' }),
    })
    if (chatRes.status !== 202) {
      const body = await chatRes.text()
      throw new Error(`发起对话失败: ${chatRes.status} ${body}`)
    }

    await readLoop
    process.stdout.write('\n')
    return 0
  } catch (error: unknown) {
    const text = error instanceof Error ? error.message : String(error)
    console.error(text)
    return 1
  }
}
