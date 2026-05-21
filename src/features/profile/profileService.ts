import { apiRequest } from '../../lib/apiClient'
import type { Medication, Profile } from '../../types'

/** 프로필, 건강 상태, 알레르기, 식이 제한, 복용 약물을 TiDB API에 저장합니다. */
export async function saveProfileBundle(profile: Profile, medications: Medication[]): Promise<string> {
  const result = await apiRequest<{ message: string }>('/api/profile', {
    method: 'POST',
    body: { profile, medications },
  })
  return result.message
}
