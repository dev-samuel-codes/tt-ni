import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Medication, Profile, SupplementProduct } from '../../types'

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
  const [todaySchedule, setTodaySchedule] = useState<TodaySlot[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)

  const profileJson = useMemo(() => JSON.stringify(profile), [profile])
  const supplementsJson = useMemo(() => JSON.stringify(supplements), [supplements])
  const medicationsJson = useMemo(() => JSON.stringify(medications), [medications])

  useEffect(() => {
    if (!enabled || supplements.length === 0 || !profile) {
      setTodaySchedule([])
      return
    }
    let cancelled = false
    setScheduleLoading(true)

    const requestProfile = {
      gender: profile.gender,
      birthYear: profile.birthYear,
      conditions: profile.conditions,
    }
    const requestSupplements = supplements.map((s) => ({
      id: s.id,
      productName: s.productName,
      dailyServings: s.dailyServings,
      ingredients: s.ingredients.map((ing) => ({
        nutrientId: ing.nutrientId,
        standardName: ing.standardName,
        amount: ing.amount,
        unit: ing.unit,
      })),
    }))
    const requestMedications = medications.map((m) => ({
      name: m.name,
      memo: m.memo || undefined,
    }))
    const requestPreferences = {
      wakeTime: '08:00',
      mealTimes: ['09:00', '13:00', '19:00'],
    }

    supabase.functions.invoke('generate-schedule', {
      body: {
        profile: requestProfile,
        supplements: requestSupplements,
        medications: requestMedications,
        preferences: requestPreferences,
      },
    }).then(({ data }) => {
      if (cancelled) return
      const timelineData = data?.timeline || data?.slots
      if (timelineData) setTodaySchedule(timelineData)
    }).catch(() => {
    }).finally(() => {
      if (!cancelled) setScheduleLoading(false)
    })
    return () => { cancelled = true }
  }, [enabled, supplementsJson, profileJson, medicationsJson])

  return { todaySchedule, scheduleLoading }
}