import { useMemo } from 'react'
import type { Medication, Profile, SupplementProduct } from '../../types'
import { generateSchedule } from './scheduleEngine'

export interface TodaySlot {
  time: string
  items: string[]
}

export function useTodaySchedule({
  supplements,
  profile,
  medications,
  enabled,
}: {
  supplements: SupplementProduct[]
  profile: Profile
  medications: Medication[]
  enabled: boolean
}) {
  const todaySchedule = useMemo<TodaySlot[]>(() => {
    if (!enabled || supplements.length === 0) return []
    return generateSchedule({
      supplements: supplements.map((s) => ({
        id: s.id,
        productName: s.productName,
        dailyServings: s.dailyServings,
        ingredients: s.ingredients.map((ing) => ({
          nutrientId: ing.nutrientId,
          standardName: ing.standardName,
          amount: ing.amount ?? 0,
          unit: ing.unit,
        })),
      })),
      medications: medications.map((m) => ({
        name: m.name,
        memo: m.memo || '',
      })),
      conditions: profile.conditions,
      preferences: {
        wakeTime: '08:00',
        mealTimes: ['09:00', '13:00', '19:00'],
      },
    })
  }, [enabled, supplements, medications, profile])

  return { todaySchedule, scheduleLoading: false }
}
