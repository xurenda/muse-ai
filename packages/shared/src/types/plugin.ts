/**
 * Plugin 根目录下的 manifest.json 结构。
 * 资源路径均相对于 Plugin 安装目录（如 plugins/muse/basic/）。
 */
export interface PluginManifest {
  /** 市场 id，与 registry 键及目录命名空间一致，如 muse/basic */
  id: string
  /** 用户可见名称 */
  name: string
  /** 用户可见描述 */
  description?: string
  version: string
  /** jiti 加载的 extension 模块路径，如 ./extensions/coding-tools.ts */
  extensions: string[]
  /** 随 Plugin 捆绑的 Skill 目录或文件路径 */
  skills: string[]
  /** 随 Plugin 捆绑的 Prompt 模板路径 */
  prompts: string[]
  /** 附带可执行文件路径 */
  bins: string[]
}
