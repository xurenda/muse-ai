import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ensureMuseDir, getMusePaths, loadMuseConfig, MUSE_CONFIG_VERSION } from '@/paths.js'

describe('paths', () => {
  let tempHome: string

  afterEach(() => {
    delete process.env.MUSE_HOME
  })

  it('getMusePaths 应解析 MUSE_HOME 下的标准子目录', () => {
    tempHome = '/tmp/muse-test-home'
    process.env.MUSE_HOME = tempHome
    const paths = getMusePaths()

    expect(paths.home).toBe(tempHome)
    expect(paths.config).toBe(join(tempHome, 'config.json'))
    expect(paths.sessions).toBe(join(tempHome, 'sessions'))
    expect(paths.mcps).toBe(join(tempHome, 'mcps'))
  })

  it('ensureMuseDir 应创建目录与默认 config.json', async () => {
    tempHome = await mkdtemp(join(tmpdir(), 'muse-cli-'))
    process.env.MUSE_HOME = tempHome
    const paths = getMusePaths()

    const result = await ensureMuseDir(paths)
    expect(result.createdConfig).toBe(true)

    const entries = await readdir(paths.home)
    expect(entries).toEqual(expect.arrayContaining(['config.json', 'sessions', 'agents', 'personas', 'skills', 'mcps']))

    const config = await loadMuseConfig(paths)
    expect(config.version).toBe(MUSE_CONFIG_VERSION)
  })

  it('ensureMuseDir 再次调用不应覆盖已有 config', async () => {
    tempHome = await mkdtemp(join(tmpdir(), 'muse-cli-'))
    process.env.MUSE_HOME = tempHome
    const paths = getMusePaths()

    await ensureMuseDir(paths)
    const first = await readFile(paths.config, 'utf8')

    const result = await ensureMuseDir(paths)
    expect(result.createdConfig).toBe(false)

    const second = await readFile(paths.config, 'utf8')
    expect(second).toBe(first)
  })
})
