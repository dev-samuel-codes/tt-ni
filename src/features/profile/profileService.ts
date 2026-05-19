import { supabase } from '../../lib/supabaseClient'
import type { Medication, Profile } from '../../types'

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
  await supabase.from('user_conditions').delete().eq('user_id', userId)
  if (conditionRows.length > 0) {
    const conditionResult = await supabase.from('user_conditions').insert(conditionRows.map((row) => ({ ...row, user_id: userId })))
    if (conditionResult.error) throw conditionResult.error
  }

  await supabase.from('user_medications').delete().eq('user_id', userId)
  if (medications.length > 0) {
    const medicationResult = await supabase.from('user_medications').insert(
      medications.map((medication) => ({
        user_id: userId,
        medication_name: medication.name,
        dosage_text: medication.purpose,
        frequency: medication.frequency,
        memo: medication.memo,
      })),
    )
    if (medicationResult.error) throw medicationResult.error
  }

  return '프로필과 복용 정보를 저장했습니다.'
}
