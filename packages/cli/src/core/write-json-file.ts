import { chmod, writeFile } from 'node:fs/promises'

export async function writeJsonFile(path: string, data: unknown, mode?: number): Promise<void> {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  if (mode !== undefined) {
    await chmod(path, mode)
  }
}
