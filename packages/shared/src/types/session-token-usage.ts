import { z } from 'zod'

/** 单轮 turn 的 token 用量（SSE turn_end 携带） */
export const turnTokenUsageSchema = z.object({
  input: z.number().nonnegative(),
  output: z.number().nonnegative(),
  cacheRead: z.number().nonnegative().optional(),
  cacheWrite: z.number().nonnegative().optional(),
  total: z.number().nonnegative(),
  costTotal: z.number().nonnegative().optional(),
})

export type TurnTokenUsage = z.infer<typeof turnTokenUsageSchema>

/** Session 级累计 token 用量 */
export const sessionTokenUsageSchema = z.object({
  input: z.number().nonnegative(),
  output: z.number().nonnegative(),
  cacheRead: z.number().nonnegative(),
  cacheWrite: z.number().nonnegative(),
  total: z.number().nonnegative(),
  costTotal: z.number().nonnegative().optional(),
  turnCount: z.number().int().nonnegative(),
})

export type SessionTokenUsage = z.infer<typeof sessionTokenUsageSchema>

export const EMPTY_SESSION_TOKEN_USAGE: SessionTokenUsage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  total: 0,
  turnCount: 0,
}

/** 将单轮用量累加到 Session 累计 */
export function addTurnToSessionUsage(session: SessionTokenUsage, turn: TurnTokenUsage): SessionTokenUsage {
  return {
    input: session.input + turn.input,
    output: session.output + turn.output,
    cacheRead: session.cacheRead + (turn.cacheRead ?? 0),
    cacheWrite: session.cacheWrite + (turn.cacheWrite ?? 0),
    total: session.total + turn.total,
    costTotal: turn.costTotal === undefined && session.costTotal === undefined ? undefined : (session.costTotal ?? 0) + (turn.costTotal ?? 0),
    turnCount: session.turnCount + 1,
  }
}
