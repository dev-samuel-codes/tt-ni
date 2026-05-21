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

interface UserDataResponse {
  profile: Profile | null
  medications: Medication[]
  supplements: SupplementProduct[]
  report: AnalysisReport | null
}

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

function clearAuthCallbackUrl() {
  if (!window.location.search && !window.location.hash) return
  window.history.replaceState({}, document.title, window.location.pathname)
}

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

  const resetUserData = useCallback(() => {
    setProfileIsSetup(false)
    onProfile(defaultProfile)
    onMedications([])
    onSupplements([])
    onReport(null)
  }, [defaultProfile, onMedications, onProfile, onReport, onSupplements])

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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (cancelled) return
      setSessionEmail(user?.email ?? null)
      if (!user) {
        resetUserData()
        setIsAuthInitialized(true)
        return
      }
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
