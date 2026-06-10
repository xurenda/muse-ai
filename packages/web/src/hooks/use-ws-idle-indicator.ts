import { useCallback, useEffect, useRef, useState } from 'react'
import { shouldShowPlanningIndicator } from '@/utils/ws-idle'

const POLL_INTERVAL_MS = 200

/** 流式进行中检测 WS 静默，超时后提示「规划下一步」 */
export function useWsIdleIndicator(isSending: boolean) {
  const lastActivityRef = useRef(Date.now())
  const [isPlanning, setIsPlanning] = useState(false)

  const touchActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    setIsPlanning(false)
  }, [])

  useEffect(() => {
    if (!isSending) {
      setIsPlanning(false)
      return
    }

    lastActivityRef.current = Date.now()
    setIsPlanning(false)

    const interval = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current
      setIsPlanning(shouldShowPlanningIndicator(isSending, idleMs))
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [isSending])

  return { isPlanning, touchActivity }
}
