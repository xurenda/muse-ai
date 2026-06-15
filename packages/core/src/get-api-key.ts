import type { Model } from '@earendil-works/pi-ai'

/** 阶段 3 之前未配置 LLM Provider 时的占位回调 */
export async function placeholderGetApiKeyAndHeaders(_model: Model<string>): Promise<{ apiKey: string; headers?: Record<string, string> } | undefined> {
  return undefined
}
