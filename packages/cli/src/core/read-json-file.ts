import { readFile } from 'node:fs/promises'
import type { AuthStorageData } from '@muse-ai/shared'

export async function readJsonFile<T>(path: string): Promise<T> {
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw) as T
}

export async function readJsonFileIfExists<T>(path: string): Promise<T | null> {
  try {
    return await readJsonFile<T>(path)
  } catch {
    return null
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function readAuthData(path: string): Promise<AuthStorageData> {
  const data = await readJsonFileIfExists<unknown>(path)
  if (!data) {
    return {}
  }
  if (!isRecord(data)) {
    throw new Error(`auth.json 格式无效: 期望对象`)
  }
  return data as AuthStorageData
}
