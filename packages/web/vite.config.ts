import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { codeInspectorPlugin } from 'code-inspector-plugin'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ command }) => ({
  plugins: [...(command === 'serve' ? [codeInspectorPlugin({ bundler: 'vite' })] : []), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
      /** 与 renderer/tsconfig paths 一致，直接映射到 shared 源码子路径，无需 package exports */
      '@muse-agent/shared': path.resolve(rootDir, '../shared/src'),
    },
  },
  // 使用相对路径，便于 Electron file:// 加载打包产物
  base: './',
  server: {
    port: 3000,
    strictPort: true,
  },
}))
