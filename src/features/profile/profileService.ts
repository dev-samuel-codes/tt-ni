import { supabase } from '../../lib/supabaseClient'
import type { Medication, Profile } from '../../types'

/**
 * 프로필, 건강 상태, 알레르기, 식이 제한, 복용 약물을 한 번에 저장합니다.
 * user_profiles은 upsert(존재하면 갱신, 없으면 삽입),
 * user_conditions와 user_medications은 upsert 시도 → 실패 시 insert-only fallback으로 데이터 유실을 방지합니다.
 * condition_code prefix 규칙: 일반 질환(없음), allergy:(알레르기), diet:(식이 제한)
 */
export async function saveProfileBundle(profile: Profile, medications: Medication[]): Promise<string> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.')
  if (!authData.user) throw new Error('로그인 정보를 확인할 수 없습니다. 다시 로그인해주세요.')
  const userId = authData.user.id

  const profileResult = await supabase.from('user_profiles').upsert({
    user_id: userId,
    gender: profile.gender,
    birth_year: profile.birthYear,
    height_cm: profile.heightCm,
    weight_kg: profile.weightKg,
    pregnancy_status: profile.pregnancyStatus,
    lactation_status: profile.lactationStatus,
    consent_accepted: profile.consentAccepted,
  }, { onConflict: 'user_id' })
  if (profileResult.error) throw profileResult.error

  const conditionRows = [
    ...profile.conditions.map((name) => ({ condition_code: name.toLowerCase(), condition_name: name, severity: 'notice' })),
    ...profile.allergies.map((name) => ({ condition_code: `allergy:${name.toLowerCase()}`, condition_name: name, severity: 'caution' })),
    ...profile.dietaryRestrictions.map((name) => ({ condition_code: `diet:${name.toLowerCase()}`, condition_name: name, severity: 'notice' })),
  ]

  const newConditionCodes = new Set(conditionRows.map((r) => r.condition_code))

  if (conditionRows.length > 0) {
    const { data: existingConds } = await supabase
      .from('user_conditions')
      .select('condition_code')
      .eq('user_id', userId)

    const existingConditionCodes = new Set((existingConds ?? []).map((r: { condition_code: string }) => r.condition_code))
    const newOnly = conditionRows.filter((r) => !existingConditionCodes.has(r.condition_code))

    if (newOnly.length > 0) {
      const conditionResult = await supabase.from('user_conditions').insert(
        newOnly.map((row) => ({ ...row, user_id: userId }))
      )
      if (conditionResult.error) throw conditionResult.error
    }
  }

  const { data: existingConditions } = await supabase
    .from('user_conditions')
    .select('id, condition_code')
    .eq('user_id', userId)

  const staleConditionIds = (existingConditions ?? [])
    .filter((row: { id: string; condition_code: string }) => !newConditionCodes.has(row.condition_code))
    .map((row: { id: string }) => row.id)

  if (staleConditionIds.length > 0) {
    await supabase.from('user_conditions').delete().in('id', staleConditionIds)
  }

  const newMedicationNames = new Set(medications.map((m) => m.name.toLowerCase()))

  if (medications.length > 0) {
    const { data: existingMeds } = await supabase
      .from('user_medications')
      .select('medication_name')
      .eq('user_id', userId)

    const existingMedNames = new Set((existingMeds ?? []).map((r: { medication_name: string }) => r.medication_name.toLowerCase()))
    const newOnly = medications.filter((m) => !existingMedNames.has(m.name.toLowerCase()))

    if (newOnly.length > 0) {
      const medicationResult = await supabase.from('user_medications').insert(
        newOnly.map((medication) => ({
          user_id: userId,
          medication_name: medication.name,
          dosage_text: medication.purpose,
          frequency: medication.frequency,
          memo: medication.memo,
        })),
      )
      if (medicationResult.error) throw medicationResult.error
    }
  }

  const { data: existingMedications } = await supabase
    .from('user_medications')
    .select('id, medication_name')
    .eq('user_id', userId)

  const staleMedicationIds = (existingMedications ?? [])
    .filter((row: { id: string; medication_name: string }) => !newMedicationNames.has(row.medication_name.toLowerCase()))
    .map((row: { id: string }) => row.id)

  if (staleMedicationIds.length > 0) {
    await supabase.from('user_medications').delete().in('id', staleMedicationIds)
  }

  return '프로필과 복용 정보를 저장했습니다.'
}
