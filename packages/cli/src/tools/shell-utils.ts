import { existsSync } from 'node:fs'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'

export interface ShellConfig {
  shell: string
  args: string[]
}

const EXIT_STDIO_GRACE_MS = 100

function findBashOnPath(): string | null {
  if (process.platform === 'win32') {
    try {
      const result = spawnSync('where', ['bash.exe'], {
        encoding: 'utf-8',
        timeout: 5000,
        windowsHide: true,
      })
      if (result.status === 0 && result.stdout) {
        const firstMatch = result.stdout.trim().split(/\r?\n/)[0]
        if (firstMatch && existsSync(firstMatch)) return firstMatch
      }
    } catch {
      // ignore
    }
    return null
  }

  try {
    const result = spawnSync('which', ['bash'], { encoding: 'utf-8', timeout: 5000 })
    if (result.status === 0 && result.stdout) {
      const firstMatch = result.stdout.trim().split(/\r?\n/)[0]
      if (firstMatch) return firstMatch
    }
  } catch {
    // ignore
  }
  return null
}

/** 解析 shell：Windows 优先 Git Bash；Unix 回退 sh */
export function getShellConfig(customShellPath?: string): ShellConfig {
  if (customShellPath) {
    if (existsSync(customShellPath)) {
      return { shell: customShellPath, args: ['-c'] }
    }
    throw new Error(`Custom shell path not found: ${customShellPath}`)
  }

  if (process.platform === 'win32') {
    const paths: string[] = []
    const programFiles = process.env.ProgramFiles
    if (programFiles) paths.push(`${programFiles}\\Git\\bin\\bash.exe`)
    const programFilesX86 = process.env['ProgramFiles(x86)']
    if (programFilesX86) paths.push(`${programFilesX86}\\Git\\bin\\bash.exe`)

    for (const path of paths) {
      if (existsSync(path)) return { shell: path, args: ['-c'] }
    }

    const bashOnPath = findBashOnPath()
    if (bashOnPath) return { shell: bashOnPath, args: ['-c'] }

    throw new Error('No bash shell found. Install Git for Windows or set shellPath in Muse config.\n' + `Searched:\n${paths.map(p => `  ${p}`).join('\n')}`)
  }

  if (existsSync('/bin/bash')) return { shell: '/bin/bash', args: ['-c'] }
  const bashOnPath = findBashOnPath()
  if (bashOnPath) return { shell: bashOnPath, args: ['-c'] }
  return { shell: 'sh', args: ['-c'] }
}

export function getShellEnv(): NodeJS.ProcessEnv {
  return { ...process.env }
}

export function killProcessTree(pid: number): void {
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/F', '/T', '/PID', String(pid)], {
        stdio: 'ignore',
        detached: true,
        windowsHide: true,
      })
    } catch {
      // ignore
    }
    return
  }

  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // already dead
    }
  }
}

/** 等待子进程结束，避免 Windows 上 inherited stdio 导致 hang */
export function waitForChildProcess(child: ChildProcess): Promise<number | null> {
  return new Promise((resolve, reject) => {
    let settled = false
    let exited = false
    let exitCode: number | null = null
    let postExitTimer: NodeJS.Timeout | undefined
    let stdoutEnded = child.stdout === null
    let stderrEnded = child.stderr === null

    const cleanup = () => {
      if (postExitTimer) clearTimeout(postExitTimer)
      child.removeListener('error', onError)
      child.removeListener('exit', onExit)
      child.removeListener('close', onClose)
      child.stdout?.removeListener('end', onStdoutEnd)
      child.stderr?.removeListener('end', onStderrEnd)
    }

    const finalize = (code: number | null) => {
      if (settled) return
      settled = true
      cleanup()
      child.stdout?.destroy()
      child.stderr?.destroy()
      resolve(code)
    }

    const maybeFinalizeAfterExit = () => {
      if (!exited || settled) return
      if (stdoutEnded && stderrEnded) finalize(exitCode)
    }

    const onStdoutEnd = () => {
      stdoutEnded = true
      maybeFinalizeAfterExit()
    }
    const onStderrEnd = () => {
      stderrEnded = true
      maybeFinalizeAfterExit()
    }
    const onError = (err: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(err)
    }
    const onExit = (code: number | null) => {
      exited = true
      exitCode = code
      maybeFinalizeAfterExit()
      if (!settled) {
        postExitTimer = setTimeout(() => finalize(code), EXIT_STDIO_GRACE_MS)
      }
    }
    const onClose = (code: number | null) => finalize(code)

    child.stdout?.once('end', onStdoutEnd)
    child.stderr?.once('end', onStderrEnd)
    child.once('error', onError)
    child.once('exit', onExit)
    child.once('close', onClose)
  })
}
