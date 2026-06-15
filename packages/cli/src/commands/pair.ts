import { BackendClient, BackendClientError, buildCliEndpoint, defaultBackendUrl } from '../backend/client.js'
import { loadCliConfig } from '../config.js'
import { saveMuseConfig } from '../paths.js'

export async function runPairCommand(args: string[]): Promise<number> {
  const pairCode = args[0]?.trim()
  if (!pairCode) {
    console.error('用法: muse pair <配对码> [--name <设备名>] [--backend <url>]')
    return 1
  }

  let name = 'CLI Device'
  let backendUrl = defaultBackendUrl()

  for (let i = 1; i < args.length; i += 1) {
    const flag = args[i]
    if (flag === '--name' && args[i + 1]) {
      name = args[i + 1]!
      i += 1
      continue
    }
    if (flag === '--backend' && args[i + 1]) {
      backendUrl = args[i + 1]!
      i += 1
    }
  }

  const cliConfig = loadCliConfig()
  const endpoint = buildCliEndpoint(cliConfig.host, cliConfig.port)

  try {
    const client = new BackendClient(backendUrl)
    const result = await client.pair({ pairCode, name, endpoint })
    await saveMuseConfig({
      backendUrl,
      deviceId: result.device.id,
      deviceToken: result.accessToken,
    })
    console.log(`配对成功：${result.device.name} (${result.device.id})`)
    console.log(`Backend: ${backendUrl}`)
    console.log(`Endpoint: ${endpoint}`)
    return 0
  } catch (error: unknown) {
    if (error instanceof BackendClientError) {
      console.error(`配对失败: ${error.message}`)
      return 1
    }
    throw error
  }
}
