import { useCallback, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, firebaseConfigError } from '../../lib/firebase'
import { apiRequest } from '../../lib/apiClient'
import type { Medication, Profile, SupplementProduct, AnalysisReport } from '../../types'
import type { AuthNoticeState } from './authTypes'

type UseAuthOptions = {
  defaultProfile: Profile
  onProfile: (profile: Profile) => void
  onMedications: (medications: Medication[]) => void
  onSupplements: (supplements: SupplementProduct[]) => void
  onReport: (report: AnalysisReport | null) => void
}

/** /api/user-data 응답 타입 */
interface UserDataResponse {
  profile: Profile | null
  medications: Medication[]
  supplements: SupplementProduct[]
  report: AnalysisReport | null
}

/**
 * OAuth 리디렉션 콜백 URL의 에러 파라미터를 파싱하여 알림 상태로 변환합니다.
 * Firebase Auth 리디렉션 실패 시 URL에 ?error=...&error_description=... 파라미터가 추가됩니다.
 */
function parseAuthCallbackNotice(): AuthNoticeState {
  const searchParams = new URLSearchParams(window.location.search)
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  if (!error && !errorDescription) return null
  return {
    tone: 'warning',
    message: `로그인에 실패했습니다. ${errorDescription ?? error}`,
  }
}

/** OAuth 리디렉션 후 URL에서 쿼리 파라미터를 제거하여 깔끔한 URL 유지 */
function clearAuthCallbackUrl() {
  if (!window.location.search && !window.location.hash) return
  window.history.replaceState({}, document.title, window.location.pathname)
}

/**
 * 인증 상태 관리 훅.
 * Firebase onAuthStateChanged를 구독하여 로그인/로그아웃 상태 변화를 감지하고,
 * 로그인 시 서버에서 사용자 데이터를 불러와 부모 컴포넌트(App)의 상태를 초기화합니다.
 */
export function useAuth({
  defaultProfile,
  onProfile,
  onMedications,
  onSupplements,
  onReport,
}: UseAuthOptions) {
  const [authNotice, setAuthNotice] = useState<AuthNoticeState>(parseAuthCallbackNotice)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [isAuthInitialized, setIsAuthInitialized] = useState(false)
  const [profileIsSetup, setProfileIsSetup] = useState(false)

  /** 로그아웃 또는 인증 실패 시 사용자 데이터를 기본값으로 초기화 */
  const resetUserData = useCallback(() => {
    setProfileIsSetup(false)
    onProfile(defaultProfile)
    onMedications([])
    onSupplements([])
    onReport(null)
  }, [defaultProfile, onMedications, onProfile, onReport, onSupplements])

  /** 서버에서 사용자 데이터(프로필, 약물, 영양제, 분석 리포트)를 조회 */
  const loadUserData = useCallback(async () => {
    const data = await apiRequest<UserDataResponse>('/api/user-data')
    if (data.profile) {
      setProfileIsSetup(true)
      onProfile(data.profile)
    } else {
      setProfileIsSetup(false)
      onProfile(defaultProfile)
    }
    onMedications(data.medications ?? [])
    onSupplements(data.supplements ?? [])
    onReport(data.report ?? null)
  }, [defaultProfile, onMedications, onProfile, onReport, onSupplements])

  useEffect(() => {
    // Firebase가 설정되지 않은 경우 바로 초기화 완료 처리
    if (!auth) {
      queueMicrotask(() => {
        resetUserData()
        setAuthNotice({
          tone: 'warning',
          message: firebaseConfigError ?? 'Firebase 인증 설정을 확인할 수 없습니다.',
        })
        setIsAuthInitialized(true)
      })
      return
    }

    let cancelled = false
    // Firebase 인증 상태 변경 구독
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (cancelled) return
      setSessionEmail(user?.email ?? null)
      if (!user) {
        resetUserData()
        setIsAuthInitialized(true)
        return
      }
      // 로그인 성공 → 사용자 데이터 로드
      void loadUserData()
        .catch((error) => {
          setAuthNotice({
            tone: 'warning',
            message: error instanceof Error ? error.message : '사용자 데이터를 불러오지 못했습니다.',
          })
        })
        .finally(() => {
          if (!cancelled) setIsAuthInitialized(true)
        })
      clearAuthCallbackUrl()
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [loadUserData, resetUserData])

  return {
    sessionEmail,
    setSessionEmail,
    authNotice,
    setAuthNotice,
    isAuthInitialized,
    profileIsSetup,
  }
}
