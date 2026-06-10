import { ensureMuseDataLayout } from '../data/init-layout'
import { getMuseHomeDir } from '../data/paths'

export async function runInit(): Promise<void> {
  await ensureMuseDataLayout()
  console.log(`Muse 数据目录已就绪: ${getMuseHomeDir()}`)
}
