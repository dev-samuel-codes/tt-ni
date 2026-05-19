import type { SocialProvider, SocialProviderStatus } from './authTypes'

/**
 * Supabase Auth 설정을 조회하여 소셜 로그인 제공자의 활성화 상태를 확인합니다.
 * AbortSignal을 지원하여 컴포넌트 언마운트 시 요청을 취소할 수 있습니다.
 */
export async function loadSocialProviderStatus(signal: AbortSignal): Promise<SocialProviderStatus> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    signal,
  })
  if (!response.ok) throw new Error('OAuth provider 설정 상태를 불러오지 못했습니다.')
  const settings = await response.json() as { external?: Partial<Record<SocialProvider, boolean>> }
  return {
    google: settings.external?.google ?? false,
    kakao: settings.external?.kakao ?? false,
  }
}
