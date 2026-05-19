import type { Provider } from '@supabase/supabase-js'

export type SocialProvider = Extract<Provider, 'google' | 'kakao'>

export type SocialProviderStatus = Record<SocialProvider, boolean | null>

export type AuthNoticeState = {
  tone: 'success' | 'warning'
  message: string
} | null

export const socialProviderLabels: Record<SocialProvider, string> = {
  google: '구글',
  kakao: '카카오',
}
