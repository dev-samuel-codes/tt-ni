import { supabase } from '../../lib/supabaseClient'
import type { Medication, Profile } from '../../types'

/**
 * 프로필, 건강 상태, 알레르기, 식이 제한, 복용 약물을 한 번에 저장합니다.
 * user_profiles은 upsert(존재하면 갱신, 없으면 삽입),
 * user_conditions와 user_medications은 기존 데이터와 비교하여 증분 삽입/삭제합니다.
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
    ...profile.conditions.map((name) => ({ condition_code: name.toLowerCase(), condition_name: name, severity: 'notice' as const })),
    ...profile.allergies.map((name) => ({ condition_code: `allergy:${name.toLowerCase()}`, condition_name: name, severity: 'caution' as const })),
    ...profile.dietaryRestrictions.map((name) => ({ condition_code: `diet:${name.toLowerCase()}`, condition_name: name, severity: 'notice' as const })),
  ]

  const newConditionCodes = new Set(conditionRows.map((r) => r.condition_code))

  // 기존 상태를 한 번에 조회 (id + condition_code)
  const { data: existingConditions } = await supabase
    .from('user_conditions')
    .select('id, condition_code')
    .eq('user_id', userId)

  const existingConditionCodes = new Set((existingConditions ?? []).map((r: { condition_code: string }) => r.condition_code))
  const conditionsToInsert = conditionRows.filter((r) => !existingConditionCodes.has(r.condition_code))
  const staleConditionIds = (existingConditions ?? [])
    .filter((row: { id: string; condition_code: string }) => !newConditionCodes.has(row.condition_code))
    .map((row: { id: string }) => row.id)

  // 병렬로 삽입 + 삭제
  const conditionOps: Promise<unknown>[] = []
  if (conditionsToInsert.length > 0) {
    conditionOps.push(supabase.from('user_conditions').insert(conditionsToInsert.map((row) => ({ ...row, user_id: userId }))).then((r) => { if (r.error) throw r.error }))
  }
  if (staleConditionIds.length > 0) {
    conditionOps.push(supabase.from('user_conditions').delete().in('id', staleConditionIds).then((r) => { if (r.error) throw r.error }))
  }
  await Promise.all(conditionOps)

  const newMedicationNames = new Set(medications.map((m) => m.name.toLowerCase()))

  // 기존 약물을 한 번에 조회 (id + medication_name)
  const { data: existingMedications } = await supabase
    .from('user_medications')
    .select('id, medication_name')
    .eq('user_id', userId)

  const existingMedNames = new Set((existingMedications ?? []).map((r: { medication_name: string }) => r.medication_name.toLowerCase()))
  const medsToInsert = medications.filter((m) => !existingMedNames.has(m.name.toLowerCase()))
  const staleMedicationIds = (existingMedications ?? [])
    .filter((row: { id: string; medication_name: string }) => !newMedicationNames.has(row.medication_name.toLowerCase()))
    .map((row: { id: string }) => row.id)

  // 병렬로 삽입 + 삭제
  const medicationOps: Promise<unknown>[] = []
  if (medsToInsert.length > 0) {
    medicationOps.push(supabase.from('user_medications').insert(
      medsToInsert.map((medication) => ({
        user_id: userId,
        medication_name: medication.name,
        dosage_text: medication.purpose,
        frequency: medication.frequency,
        memo: medication.memo,
      })),
    ).then((r) => { if (r.error) throw r.error }))
  }
  if (staleMedicationIds.length > 0) {
    medicationOps.push(supabase.from('user_medications').delete().in('id', staleMedicationIds).then((r) => { if (r.error) throw r.error }))
  }
  await Promise.all(medicationOps)

  return '프로필과 복용 정보를 저장했습니다.'
}