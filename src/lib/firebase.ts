import { initializeApp, type FirebaseOptions } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
}

const requiredFirebaseKeys = [
  ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['VITE_FIREBASE_APP_ID', firebaseConfig.appId],
] as const

const missingFirebaseKeys = requiredFirebaseKeys
  .filter(([, value]) => !value)
  .map(([key]) => key)

export const firebaseConfigError = missingFirebaseKeys.length > 0
  ? `Firebase 환경 변수가 필요합니다. 누락: ${missingFirebaseKeys.join(', ')}`
  : null

export const isFirebaseConfigured = firebaseConfigError === null

const app = isFirebaseConfigured ? initializeApp(firebaseConfig as FirebaseOptions) : null

export const auth = app ? getAuth(app) : null

function requireFirebaseAuth() {
  if (!auth) {
    throw new Error(firebaseConfigError ?? 'Firebase 인증을 초기화할 수 없습니다.')
  }
  return auth
}

export async function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(requireFirebaseAuth(), email, password)
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(requireFirebaseAuth(), email, password)
}

export async function signInWithGoogle() {
  return signInWithPopup(requireFirebaseAuth(), new GoogleAuthProvider())
}

export async function signInWithKakao() {
  const provider = new OAuthProvider(import.meta.env.VITE_FIREBASE_KAKAO_PROVIDER_ID ?? 'oidc.kakao')
  return signInWithPopup(requireFirebaseAuth(), provider)
}

export async function signOutCurrentUser() {
  return signOut(requireFirebaseAuth())
}
