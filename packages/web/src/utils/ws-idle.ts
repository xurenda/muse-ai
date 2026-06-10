/** WebSocket 无下行消息超过该时长时，显示「规划下一步」 */
export const PLANNING_IDLE_MS = 2000

export function shouldShowPlanningIndicator(isSending: boolean, idleMs: number): boolean {
  return isSending && idleMs >= PLANNING_IDLE_MS
}
