import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BASIC_KIT_PACKAGE_ID, RESERVED_USERNAMES, isReservedUsername } from '@/constants/market.js'
import { DEFAULT_AGENT_ID } from '@/constants/default-agent.js'
import { basicKitAssetId } from '@/utils/market-asset-id.js'
import { packageIdSchema, scopedAssetIdSchema, usernameSchema } from '@/schemas/market-id.js'
import { inferAssetSource, installedPackagesFileSchema, marketManifestSchema } from '@/types/market.js'

describe('market id schemas', () => {
  it('packageIdSchema 接受两段 slug', () => {
    expect(packageIdSchema.safeParse('museai/basic-kit').success).toBe(true)
    expect(packageIdSchema.safeParse('kingen/code-reviewer').success).toBe(true)
  })

  it('packageIdSchema 拒绝非法格式', () => {
    expect(packageIdSchema.safeParse('general').success).toBe(false)
    expect(packageIdSchema.safeParse('MuseAI/basic').success).toBe(false)
  })

  it('scopedAssetIdSchema 至少两段路径', () => {
    expect(scopedAssetIdSchema.safeParse('museai/basic-kit/general').success).toBe(true)
    expect(scopedAssetIdSchema.safeParse('local/my-draft').success).toBe(true)
    expect(scopedAssetIdSchema.safeParse('general').success).toBe(false)
  })
})

describe('usernameSchema', () => {
  it('规范化小写并拒绝保留名', () => {
    expect(usernameSchema.safeParse('Kingen').data).toBe('kingen')
    expect(usernameSchema.safeParse('museai').success).toBe(false)
    expect(usernameSchema.safeParse('local').success).toBe(false)
  })
})

describe('RESERVED_USERNAMES', () => {
  it('包含文档规定的保留名', () => {
    for (const name of ['local', 'muse', 'museai', 'muse-ai', 'admin', 'api']) {
      expect(RESERVED_USERNAMES.has(name)).toBe(true)
      expect(isReservedUsername(name)).toBe(true)
    }
  })
})

describe('marketManifestSchema', () => {
  it('接受 basic-kit manifest（无 assets）', () => {
    const root = join(import.meta.dirname, '../../../basic-kit')
    const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))
    expect(marketManifestSchema.safeParse(manifest).success).toBe(true)
  })

  it('接受可选资产目录覆盖', () => {
    const result = marketManifestSchema.safeParse({
      id: 'kingen/reviewer',
      version: '1.0.0',
      kind: 'kit',
      name: '审查套件',
      author: 'kingen',
      personas: './my-personas',
    })
    expect(result.success).toBe(true)
  })
})

describe('installedPackagesFileSchema', () => {
  it('接受含 agent 的 installed.json 结构', () => {
    const result = installedPackagesFileSchema.safeParse({
      packages: {
        'museai/basic-kit': {
          version: '1.0.0',
          installedAt: '2026-06-25T12:00:00.000Z',
          assets: [
            { type: 'persona', id: 'museai/basic-kit/general' },
            { type: 'agent', id: DEFAULT_AGENT_ID },
          ],
        },
      },
    })
    expect(result.success).toBe(true)
  })
})

describe('basicKitAssetId', () => {
  it('应生成 scoped 资产 id', () => {
    expect(basicKitAssetId('general')).toBe(`${BASIC_KIT_PACKAGE_ID}/general`)
    expect(basicKitAssetId('git')).toBe(`${BASIC_KIT_PACKAGE_ID}/git`)
  })
})

describe('inferAssetSource', () => {
  it('local/ 前缀为 local；有 origin 为 market', () => {
    expect(inferAssetSource('local/my-draft', false)).toBe('local')
    expect(inferAssetSource('museai/basic-kit/git', true)).toBe('market')
    expect(inferAssetSource('museai/basic-kit/git', false)).toBe('local')
  })
})
