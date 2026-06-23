import { DEFAULT_PORTS } from '@muse-ai/shared'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => {
  return {
    plugins: [
      ...(command === 'serve'
        ? [
            codeInspectorPlugin({
              bundler: 'vite',
              dev: true,
              editor: 'code',
            }),
          ]
        : []),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
      },
    },
    server: {
      port: DEFAULT_PORTS.WEB_DEV,
    },
  }
})
