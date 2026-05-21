import { initializeApp, type FirebaseOptions } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'

/** Vite 환경변수에서 Firebase 클라이언트 설정 값을 읽습니다. VITE_ 접두사 필수. */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
}

/** 필수 Firebase 환경변수 목록 */
const requiredFirebaseKeys = [
  ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['VITE_FIREBASE_APP_ID', firebaseConfig.appId],
] as const

/** 설정되지 않은 Firebase 환경변수 감지 */
const missingFirebaseKeys = requiredFirebaseKeys
  .filter(([, value]) => !value)
  .map(([key]) => key)

/** Firebase 설정 오류 메시지. null이면 정상 설정됨. */
export const firebaseConfigError = missingFirebaseKeys.length > 0
  ? `Firebase 환경 변수가 필요합니다. 누락: ${missingFirebaseKeys.join(', ')}`
  : null

/** 모든 필수 Firebase 환경변수가 설정되었는지 여부 */
export const isFirebaseConfigured = firebaseConfigError === null

/** Firebase App 인스턴스 (설정되지 않으면 null) */
const app = isFirebaseConfigured ? initializeApp(firebaseConfig as FirebaseOptions) : null

/** Firebase Auth 인스턴스 (설정되지 않으면 null) */
export const auth = app ? getAuth(app) : null

/** 소셜 로그인 제공자 활성화 상태. 환경변수로 Google / Kakao 각각 제어 가능. */
export const socialAuthEnabled = {
  google: import.meta.env.VITE_FIREBASE_GOOGLE_ENABLED === 'true',
  kakao: import.meta.env.VITE_FIREBASE_KAKAO_ENABLED === 'true',
}

/** Firebase Auth가 설정되지 않은 경우 에러를 throw하는 가드 함수 */
function requireFirebaseAuth() {
  if (!auth) {
    throw new Error(firebaseConfigError ?? 'Firebase 인증을 초기화할 수 없습니다.')
  }
  return auth
}

/** 이메일로 회원가입 */
export async function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(requireFirebaseAuth(), email, password)
}

/** 이메일로 로그인 */
export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(requireFirebaseAuth(), email, password)
}

/**
 * Google 소셜 로그인.
 * 팝업 차단 감지 시 signInWithRedirect로 폴백.
 */
export async function signInWithGoogle() {
  const firebaseAuth = requireFirebaseAuth()
  try {
    return await signInWithPopup(firebaseAuth, new GoogleAuthProvider())
  } catch (error) {
    if (error instanceof Error && error.message.includes('popup-blocked')) {
      await signInWithRedirect(firebaseAuth, new GoogleAuthProvider())
      return null
    }
    throw error
  }
}

/**
 * Kakao 소셜 로그인.
 * Firebase OIDC 제공업체로 등록된 Kakao를 사용하며,
 * 제공업체 ID는 VITE_FIREBASE_KAKAO_PROVIDER_ID 환경변수 또는 기본값 'oidc.kakao' 사용.
 */
export async function signInWithKakao() {
  const firebaseAuth = requireFirebaseAuth()
  const provider = new OAuthProvider(import.meta.env.VITE_FIREBASE_KAKAO_PROVIDER_ID ?? 'oidc.kakao')
  try {
    return await signInWithPopup(firebaseAuth, provider)
  } catch (error) {
    if (error instanceof Error && error.message.includes('popup-blocked')) {
      await signInWithRedirect(firebaseAuth, provider)
      return null
    }
    throw error
  }
}

/** 현재 사용자 로그아웃 */
export async function signOutCurrentUser() {
  return signOut(requireFirebaseAuth())
}
