/** 检查进程是否仍在运行（不向目标进程发送信号） */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
