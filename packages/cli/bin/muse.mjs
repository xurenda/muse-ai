#!/usr/bin/env node
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'tsx/esm/api'

const packageRoot = dirname(fileURLToPath(import.meta.url))
register()

await import(pathToFileURL(join(packageRoot, '../src/cli.ts')).href)
