import { describe, expect, it } from 'vitest'
import { PLANNING_IDLE_MS, shouldShowPlanningIndicator } from '@/utils/ws-idle'

describe('shouldShowPlanningIndicator', () => {
  it('流式中且静默超过阈值时显示', () => {
    expect(shouldShowPlanningIndicator(true, PLANNING_IDLE_MS)).toBe(true)
    expect(shouldShowPlanningIndicator(true, PLANNING_IDLE_MS - 1)).toBe(false)
  })

  it('未在流式时不显示', () => {
    expect(shouldShowPlanningIndicator(false, PLANNING_IDLE_MS + 1000)).toBe(false)
  })
})
