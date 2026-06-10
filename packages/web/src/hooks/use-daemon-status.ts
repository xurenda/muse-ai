import { useEffect, useState } from 'react'
import { fetchDaemonHealth } from '@/services/daemon-api'

const POLL_INTERVAL_MS = 5_000

export function useDaemonStatus() {
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const health = await fetchDaemonHealth()
      if (!cancelled) {
        setOnline(health?.status === 'ok')
      }
    }

    void check()
    const timer = window.setInterval(() => {
      void check()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return { online }
}
