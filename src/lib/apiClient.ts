import { auth } from './firebase'

/** API 오류 클래스. HTTP 상태 코드를 함께 보관합니다. */
export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** API 기본 URL. VITE_API_BASE_URL 환경변수로 재정의 가능 (기본: 동일 오리진). */
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

/**
 * Firebase ID 토큰을 획득합니다.
 * 현재 로그인된 사용자가 없으면 401 ApiError throw.
 */
export async function getAuthToken(): Promise<string> {
  const user = auth?.currentUser
  if (!user) throw new ApiError('로그인 후 이용할 수 있습니다.', 401)
  return user.getIdToken()
}

/** apiRequest 옵션 타입. RequestInit을 확장하고 body에 JSON 직렬화 가능한 값 허용. */
type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

/**
 * 인증된 API 요청 래퍼.
 * 1. Firebase ID 토큰을 Authorization 헤더에 포함
 * 2. body가 FormData면 그대로 전송, 아니면 JSON 직렬화
 * 3. 응답이 2xx가 아니면 ApiError throw
 * 4. 204 No Content면 undefined 반환
 */
export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = await getAuthToken()
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)

  let body: BodyInit | undefined
  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
    body,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null
    throw new ApiError(payload?.error ?? `API 요청에 실패했습니다. (${response.status})`, response.status)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
