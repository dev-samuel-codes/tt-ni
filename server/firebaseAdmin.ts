import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

/** FIREBASE_PRIVATE_KEY 환경변수에서 줄바꿈 이스케이프(\n)를 실제 줄바꿈으로 변환 */
function privateKey(): string | undefined {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
}

// Firebase Admin SDK 초기화 (앱이 이미 초기화된 경우 건너뜀)
// 우선순위: 1) FIREBASE_SERVICE_ACCOUNT_JSON 환경변수 2) 개별 환경변수 조합 3) Application Default Credentials
if (getApps().length === 0) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (serviceAccountJson) {
    initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) })
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey()) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey(),
      }),
    })
  } else {
    initializeApp({ credential: applicationDefault() })
  }
}

/** 서버에서 Firebase ID 토큰 검증에 사용할 Auth 인스턴스 */
export const firebaseAuth = getAuth()
