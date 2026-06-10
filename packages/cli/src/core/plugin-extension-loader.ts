import { createJiti } from 'jiti'
import type { ExtensionAPI, ExtensionFactory, ToolDefinition } from '@earendil-works/pi-coding-agent'
import { createEventBus } from '@earendil-works/pi-coding-agent'

function createLoadOnlyExtensionApi(registerTool: (tool: ToolDefinition) => void): ExtensionAPI {
  const unavailable = (): never => {
    throw new Error('Muse daemon 扩展加载阶段不支持此 API')
  }

  return {
    on: () => {},
    registerTool,
    registerCommand: unavailable,
    registerShortcut: unavailable,
    registerFlag: unavailable,
    registerMessageRenderer: unavailable,
    getFlag: () => undefined,
    sendMessage: unavailable,
    sendUserMessage: unavailable,
    appendEntry: unavailable,
    setSessionName: unavailable,
    getSessionName: unavailable,
    setLabel: unavailable,
    exec: unavailable,
    getActiveTools: unavailable,
    getAllTools: unavailable,
    setActiveTools: unavailable,
    getCommands: unavailable,
    setModel: unavailable,
    getThinkingLevel: unavailable,
    setThinkingLevel: unavailable,
    registerProvider: unavailable,
    unregisterProvider: unavailable,
    events: createEventBus(),
  } as ExtensionAPI
}

async function loadExtensionFactory(extensionPath: string): Promise<ExtensionFactory | undefined> {
  const jiti = createJiti(import.meta.url, {
    moduleCache: false,
  })
  const moduleExport = await jiti.import(extensionPath, { default: true })
  return typeof moduleExport === 'function' ? (moduleExport as ExtensionFactory) : undefined
}

export async function loadExtensionTools(extensionPath: string): Promise<ToolDefinition[]> {
  const tools: ToolDefinition[] = []
  const factory = await loadExtensionFactory(extensionPath)

  if (!factory) {
    throw new Error(`Extension 未导出默认工厂函数: ${extensionPath}`)
  }

  const api = createLoadOnlyExtensionApi((tool) => {
    tools.push(tool)
  })
  await factory(api)
  return tools
}
