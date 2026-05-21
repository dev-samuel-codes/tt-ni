/** 지원하는 소셜 로그인 제공자 */
export type SocialProvider = 'google' | 'kakao'

/** 소셜 로그인 제공자별 활성화 상태 (null = 로딩 중) */
export type SocialProviderStatus = Record<SocialProvider, boolean | null>

/** 인증 알림 상태 (로그인 성공/실패 메시지) */
export type AuthNoticeState = {
  tone: 'success' | 'warning'
  message: string
} | null

/** 소셜 로그인 제공자 한글 라벨 */
export const socialProviderLabels: Record<SocialProvider, string> = {
  google: '구글',
  kakao: '카카오',
}
