import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Medication, Profile, SupplementProduct, AnalysisReport } from '../../types'
import type { AuthNoticeState } from './authTypes'

type UseAuthOptions = {
  defaultProfile: Profile
  onProfile: (profile: Profile) => void
  onMedications: (medications: Medication[]) => void
  onSupplements: (supplements: SupplementProduct[]) => void
  onReport: (report: AnalysisReport | null) => void
  onSignedIn: () => void
}

/**
 * URL 해시/쿼리 파라미터에서 OAuth 콜백 정보를 추출합니다.
 * 로그인 성공 시 access_token 또는 code가 포함되고,
 * 실패 시 error, error_description, error_code가 포함됩니다.
 */
function parseAuthCallbackNotice(): { hasAuthCallback: boolean; initialAuthNotice: AuthNoticeState } {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(window.location.search)
  const error = hashParams.get('error') ?? searchParams.get('error')
  const errorDescription = hashParams.get('error_description') ?? searchParams.get('error_description')
  const errorCode = hashParams.get('error_code') ?? searchParams.get('error_code')

  if (error || errorDescription || errorCode) {
    return {
      hasAuthCallback: false,
      initialAuthNotice: {
        tone: 'warning',
        message: `소셜 로그인에 실패했습니다. ${errorDescription ?? error ?? errorCode}`,
      },
    }
  }

  return {
    hasAuthCallback: hashParams.has('access_token') || searchParams.has('code'),
    initialAuthNotice: null,
  }
}

/** OAuth 콜백 후 URL에서 인증 파라미터를 제거하여 깔끔한 URL을 유지합니다. */
function clearAuthCallbackUrl() {
  if (!window.location.search && !window.location.hash) return
  window.history.replaceState({}, document.title, window.location.pathname)
}

/**
 * 인증 상태 관리 훅
 *
 * 주요 기능:
 * - 세션 초기화 및 OAuth 콜백 처리
 * - 사용자 데이터(프로필, 약물, 영양제) 로드
 * - 인증 상태 변경 감지 및 데이터 동기화
 */
export function useAuth({
  defaultProfile,
  onProfile,
  onMedications,
  onSupplements,
  onReport,
  onSignedIn,
}: UseAuthOptions) {
  const [{ hasAuthCallback, initialAuthNotice }] = useState(parseAuthCallbackNotice)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState<AuthNoticeState>(initialAuthNotice)
  const [isAuthInitialized, setIsAuthInitialized] = useState(false)
  const [profileIsSetup, setProfileIsSetup] = useState(false)

  const sessionEmailRef = useRef<string | null>(null)

  useEffect(() => {
    sessionEmailRef.current = sessionEmail
  }, [sessionEmail])

  const loadUserData = useCallback(async (userId: string) => {
    const [profileResult, conditionsResult, medicationsResult, userSupplementsResult] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_conditions').select('*').eq('user_id', userId),
      supabase.from('user_medications').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase
        .from('user_supplements')
        .select('id, daily_servings, intake_time, active, memo, supplement_products(id, product_name, brand_name, source_type, label_image_path, supplement_ingredients(*))')
        .eq('user_id', userId).eq('active', true).order('created_at', { ascending: true }),
    ])

    if (profileResult.data) {
      setProfileIsSetup(true)
      const conditions = conditionsResult.data ?? []
      onProfile({
        gender: profileResult.data.gender,
        birthYear: profileResult.data.birth_year,
        heightCm: profileResult.data.height_cm ?? undefined,
        weightKg: profileResult.data.weight_kg ?? undefined,
        pregnancyStatus: profileResult.data.pregnancy_status ?? 'none',
        lactationStatus: Boolean(profileResult.data.lactation_status),
        consentAccepted: Boolean(profileResult.data.consent_accepted),
        conditions: conditions.filter((item) => !item.condition_code.startsWith('allergy:') && !item.condition_code.startsWith('diet:')).map((item) => item.condition_name),
        allergies: conditions.filter((item) => item.condition_code.startsWith('allergy:')).map((item) => item.condition_name),
        dietaryRestrictions: conditions.filter((item) => item.condition_code.startsWith('diet:')).map((item) => item.condition_name),
      })
    }

    onMedications((medicationsResult.data ?? []).map((medication) => ({
      id: medication.id,
      name: medication.medication_name,
      purpose: medication.dosage_text ?? '',
      frequency: medication.frequency ?? '',
      memo: medication.memo ?? '',
    })))

    onSupplements((userSupplementsResult.data ?? []).flatMap((row) => {
      const product = Array.isArray(row.supplement_products) ? row.supplement_products[0] : row.supplement_products
      if (!product) return []
      return [{
        id: product.id,
        productName: product.product_name,
        brandName: product.brand_name ?? '',
        sourceType: product.source_type,
        dailyServings: Number(row.daily_servings),
        intakeTime: row.intake_time ?? '',
        imageName: product.label_image_path ?? undefined,
        confirmed: true,
        ingredients: (product.supplement_ingredients ?? []).map((ingredient) => ({
          id: ingredient.id,
          rawName: ingredient.raw_name,
          standardName: ingredient.standard_name,
          nutrientId: ingredient.nutrient_id,
          amount: ingredient.amount === null ? null : Number(ingredient.amount),
          unit: ingredient.unit,
          confidence: Number(ingredient.confidence),
          rawText: ingredient.raw_name,
          reviewRequired: Boolean(ingredient.review_required),
        })),
      }]
    }))
  }, [onMedications, onProfile, onSupplements])

  useEffect(() => {
    let cancelled = false

    async function initSession() {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (cancelled) return

      if (sessionError || !sessionData.session) {
        if (initialAuthNotice) {
          setAuthNotice({ tone: 'warning', message: `로그인 세션을 확인할 수 없습니다. ${sessionError?.message ?? ''}` })
          clearAuthCallbackUrl()
        }
        setIsAuthInitialized(true)
        return
      }

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (cancelled) return

      if (userError || !userData.user) {
        setSessionEmail(null)
        setIsAuthInitialized(true)
        return
      }

      setSessionEmail(userData.user.email ?? null)
      if (hasAuthCallback) {
        onSignedIn()
        clearAuthCallbackUrl()
      }
      void loadUserData(userData.user.id)
      setIsAuthInitialized(true)
    }

    initSession()

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      const newEmail = session?.user.email ?? null
      const wasLoggedOut = !sessionEmailRef.current
      setSessionEmail(newEmail)
      if (session?.user) {
        if (event === 'SIGNED_IN' && wasLoggedOut) {
          onSignedIn()
        }
        void loadUserData(session.user.id)
      } else {
        setProfileIsSetup(false)
        onProfile(defaultProfile)
        onMedications([])
        onSupplements([])
        onReport(null)
      }
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [defaultProfile, hasAuthCallback, initialAuthNotice, loadUserData, onMedications, onProfile, onReport, onSignedIn, onSupplements])

  return {
    sessionEmail,
    setSessionEmail,
    authNotice,
    setAuthNotice,
    isAuthInitialized,
    profileIsSetup,
  }
}
