import type { SessionMeta } from '@museai/shared'

/** 将 SSE 补丁合并进 Session 列表 */
export function mergeSessionList(sessions: SessionMeta[], patches: Record<string, Partial<SessionMeta>>): SessionMeta[] {
  if (Object.keys(patches).length === 0) return sessions
  return sessions.map(session => {
    const patch = patches[session.id]
    return patch ? { ...session, ...patch } : session
  })
}
