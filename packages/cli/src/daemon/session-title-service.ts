import { deriveSessionTitle, type MuseSessionStore } from '@museai/core'
import { MUSE_PROXY_HEADERS, type SessionBranchMessage, type SessionMeta } from '@museai/shared'
import { buildMuseProxyRequestHeaders } from '../backend/muse-proxy-context.js'
import type { BackendLlmAuthConfig } from '../backend/llm-auth.js'
import type { SessionEventHub } from './event-hub.js'

const TITLE_SYSTEM_PROMPT =
  'Generate a short chat title. Reply with ONLY the title text: no quotes, no trailing punctuation, max 20 characters. Use the same language as the user message.'

const TITLE_FETCH_TIMEOUT_MS = 15_000
const ASSISTANT_SNIPPET_MAX = 200
const TITLE_MAX_TOKENS = 32

/** DeepSeek 等推理模型：标题生成关闭 thinking，与 pi-ai deepseek 格式一致 */
const TITLE_REQUEST_EXTRA = {
  thinking: { type: 'disabled' as const },
}

interface TitleTurnContext {
  userMessage: string
  assistantMessage?: string
}

function extractFirstTurnContext(branch: SessionBranchMessage[]): TitleTurnContext | null {
  let userMessage: string | undefined
  let assistantMessage: string | undefined

  for (const message of branch) {
    if (message.role === 'user' && !userMessage) {
      userMessage = message.text.trim()
      continue
    }
    if (message.role === 'assistant' && userMessage && !assistantMessage) {
      assistantMessage = message.text.trim()
      break
    }
  }

  if (!userMessage) return null
  return { userMessage, assistantMessage }
}

function sanitizeGeneratedTitle(raw: string): string | null {
  const trimmed = raw
    .replace(/^[\s"'「『]+|[\s"'」』]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!trimmed) return null
  return deriveSessionTitle(trimmed, 100)
}

function buildTitleUserPrompt(context: TitleTurnContext): string {
  const assistant = context.assistantMessage ? context.assistantMessage.slice(0, ASSISTANT_SNIPPET_MAX) : '(no assistant reply yet)'
  return `User: ${context.userMessage}\nAssistant: ${assistant}`
}

function extractCompletionText(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('choices' in body)) return null
  const choices = (body as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return null
  const first = choices[0]
  if (typeof first !== 'object' || first === null || !('message' in first)) return null
  const message = (first as { message?: unknown }).message
  if (typeof message !== 'object' || message === null || !('content' in message)) return null
  const content = (message as { content?: unknown }).content
  if (typeof content === 'string') {
    return content.trim() ? content : null
  }
  if (Array.isArray(content)) {
    const text = content
      .filter((part): part is { type: string; text?: string } => typeof part === 'object' && part !== null)
      .filter(part => part.type === 'text' && typeof part.text === 'string')
      .map(part => part.text)
      .join('')
    return text.trim() ? text : null
  }
  return null
}

/** 首轮结束后用 LLM 润色会话标题，并通过 SSE 通知 Web */
export class SessionTitleService {
  constructor(
    private readonly sessionStore: MuseSessionStore,
    private readonly eventHub: SessionEventHub,
    private readonly resolveBackendAuth: () => Promise<BackendLlmAuthConfig | undefined>,
  ) {}

  async publishMetaUpdate(meta: SessionMeta): Promise<void> {
    if (!meta.name?.trim()) return
    await this.eventHub.publish(meta.id, {
      type: 'session_meta_updated',
      sessionId: meta.id,
      name: meta.name.trim(),
      nameSource: meta.nameSource,
      updatedAt: meta.updatedAt,
    })
  }

  async maybeGenerateAfterTurn(sessionId: string): Promise<void> {
    const meta = await this.sessionStore.get(sessionId)
    if (!meta || meta.nameSource !== 'first_message') return

    const tree = await this.sessionStore.getTree(sessionId)
    const context = extractFirstTurnContext(tree.branch)
    if (!context?.assistantMessage) return

    const backendAuth = await this.resolveBackendAuth()
    if (!backendAuth?.deviceToken) return

    const title = await this.generateTitle(sessionId, context, backendAuth, meta)
    if (!title) return

    const updated = await this.sessionStore.updateName(sessionId, title, 'auto_llm')
    if (!updated) return
    await this.publishMetaUpdate(updated)
  }

  private async generateTitle(sessionId: string, context: TitleTurnContext, backendAuth: BackendLlmAuthConfig, meta: SessionMeta): Promise<string | null> {
    try {
      const proxyHeaders = buildMuseProxyRequestHeaders('titleGeneration', meta.modelSelection)
      const response = await fetch(`${backendAuth.backendUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${backendAuth.deviceToken}`,
          ...proxyHeaders,
        },
        body: JSON.stringify({
          model: 'proxy',
          ...TITLE_REQUEST_EXTRA,
          messages: [
            { role: 'system', content: TITLE_SYSTEM_PROMPT },
            { role: 'user', content: buildTitleUserPrompt(context) },
          ],
          max_tokens: TITLE_MAX_TOKENS,
          temperature: 0.3,
          stream: false,
        }),
        signal: AbortSignal.timeout(TITLE_FETCH_TIMEOUT_MS),
      })

      const modelRef = response.headers.get(MUSE_PROXY_HEADERS.RESOLVED_MODEL)
      if (modelRef) {
        await this.eventHub.publish(sessionId, {
          type: 'model_resolved',
          modelRef,
          task: 'titleGeneration',
          usedFallback: response.headers.get(MUSE_PROXY_HEADERS.FALLBACK_USED) === 'true' || undefined,
        })
      }

      if (!response.ok) return null
      const body: unknown = await response.json()
      const raw = extractCompletionText(body)
      if (!raw) return null
      return sanitizeGeneratedTitle(raw)
    } catch {
      return null
    }
  }
}
