import { auth } from './firebase'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export async function getAuthToken(): Promise<string> {
  const user = auth?.currentUser
  if (!user) throw new ApiError('로그인 후 이용할 수 있습니다.', 401)
  return user.getIdToken()
}

type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

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
