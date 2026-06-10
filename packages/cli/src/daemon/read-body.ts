import type { IncomingMessage } from 'node:http'

export async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) {
    throw new Error('请求体不能为空')
  }

  return JSON.parse(raw) as T
}
