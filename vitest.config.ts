import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/shared', 'packages/basic-kit', 'packages/core', 'packages/cli', 'packages/server', 'packages/web'],
  },
})
