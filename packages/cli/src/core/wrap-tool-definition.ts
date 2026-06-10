import type { AgentTool } from '@earendil-works/pi-agent-core'
import type { ExtensionContext, ToolDefinition } from '@earendil-works/pi-coding-agent'

/** Muse daemon 运行时仅需 session cwd；其余 ExtensionContext 字段由扩展按需访问时再补全 */
export function createExtensionContext(cwd: string): ExtensionContext {
  return { cwd } as ExtensionContext
}

export function wrapToolDefinitionForCwd(
  definition: ToolDefinition,
  cwd: string,
): AgentTool {
  const ctx = createExtensionContext(cwd)
  return {
    name: definition.name,
    label: definition.label,
    description: definition.description,
    parameters: definition.parameters,
    prepareArguments: definition.prepareArguments,
    executionMode: definition.executionMode,
    execute: (toolCallId, params, signal, onUpdate) =>
      definition.execute(toolCallId, params, signal, onUpdate, ctx),
  }
}

export function wrapToolDefinitionsForCwd(
  definitions: ToolDefinition[],
  cwd: string,
): AgentTool[] {
  return definitions.map((definition) => wrapToolDefinitionForCwd(definition, cwd))
}
