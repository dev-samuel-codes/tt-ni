import { useMemo } from 'react'
import type { Medication, Profile, SupplementProduct } from '../../types'
import { generateSchedule } from './scheduleEngine'

/** 오늘의 복용 스케줄 항목 (시간 + 영양제 목록) */
export interface TodaySlot {
  time: string
  items: string[]
}

/**
 * 오늘의 복용 스케줄을 생성하는 훅.
 * 입력 데이터가 변경될 때마다 useMemo로 scheduleEngine을 호출하여 타임라인을 재계산합니다.
 * enabled가 false이거나 영양제가 없으면 빈 배열을 반환합니다.
 */
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
        wakeTime: profile?.wakeTime || '08:00',
        mealTimes: profile?.mealTimes || ['09:00', '13:00', '19:00'],
      },
    })
  }, [enabled, supplements, medications, profile])

  return { todaySchedule, scheduleLoading: false }
}
