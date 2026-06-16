import { getModel } from '@earendil-works/pi-ai'
import type { Model } from '@earendil-works/pi-ai'

const DEFAULT_MODEL_REF = 'openai/deepseek-v4-flash'

function createOpenAiCompatibleModel(modelId: string): Model<'openai-completions'> {
  return {
    id: modelId,
    name: modelId,
    api: 'openai-completions',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
  }
}

/** 解析 provider/modelId 为 pi Model */
export function parseModelRef(ref: string): Model<string> {
  const slash = ref.indexOf('/')
  if (slash <= 0) {
    throw new Error(`无效的 model 引用: ${ref}`)
  }
  const provider = ref.slice(0, slash)
  const modelId = ref.slice(slash + 1)

  if (provider === 'openai') {
    try {
      const known = (getModel as (p: string, id: string) => Model<string>)(provider, modelId)
      if (known?.id && known.baseUrl) {
        return known
      }
    } catch {
      // 未知 OpenAI 兼容 model id，走通用 completions 配置
    }
    return createOpenAiCompatibleModel(modelId)
  }

  return (getModel as (p: string, id: string) => Model<string>)(provider, modelId)
}

export function formatModelRef(model: Model<string>): string {
  return `${model.provider}/${model.id}`
}

export { DEFAULT_MODEL_REF }
