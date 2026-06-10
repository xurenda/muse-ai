import { linkPlugin } from '../core/plugin-link'

export async function runPluginLink(sourcePath: string | undefined): Promise<void> {
  if (!sourcePath) {
    throw new Error('缺少 Plugin 源目录路径')
  }

  const result = await linkPlugin(sourcePath)

  console.log(`Plugin 已链接: ${result.pluginId}`)
  console.log(`  源目录: ${result.sourcePath}`)
  console.log(`  安装路径: ${result.installPath}`)
  if (result.linkStatus === 'created') {
    console.log('  符号链接: 已创建')
  } else {
    console.log('  符号链接: 已存在，未改动')
  }
  console.log(`  registry: 已更新 (${result.pluginId})`)
  if (result.enabledForDefaultAgent) {
    console.log(`  默认 Agent: 已启用 ${result.pluginId}`)
  } else {
    console.log(`  默认 Agent: ${result.pluginId} 此前已启用`)
  }
}
