/**
 * OpenAI-compatible API 클라이언트.
 * 기본적으로 OpenAI API를 사용하지만, COMETAPI_KEY가 설정된 경우 Comet API로 폴백합니다.
 * 모델명은 환경변수 OPENAI_MODEL / OPENAI_CHAT_MODEL / OPENAI_VISION_MODEL 로 지정 가능합니다.
 */

/** API 키 조회 - OPENAI_API_KEY 우선, 없으면 COMETAPI_KEY 사용 */
export function openaiKey(): string {
  const key = process.env.OPENAI_API_KEY ?? process.env.COMETAPI_KEY
  if (!key) throw new Error('OPENAI_API_KEY or COMETAPI_KEY is required')
  return key
}

/** API Base URL 조회 - OPENAI_BASE_URL > COMETAPI_BASE_URL > COMETAPI_KEY 감지 > 기본 OpenAI */
export function openaiBaseUrl(): string {
  if (process.env.OPENAI_BASE_URL) return process.env.OPENAI_BASE_URL
  if (process.env.COMETAPI_BASE_URL) return process.env.COMETAPI_BASE_URL
  if (process.env.COMETAPI_KEY && !process.env.OPENAI_API_KEY) return 'https://api.cometapi.com/v1'
  return 'https://api.openai.com/v1'
}

/** Comet API 전용 키 */
export function cometApiKey(): string {
  const key = process.env.COMETAPI_KEY
  if (!key) throw new Error('COMETAPI_KEY is required')
  return key
}

/** Comet API 전용 Base URL */
export function cometBaseUrl(): string {
  return process.env.COMETAPI_BASE_URL ?? 'https://api.cometapi.com/v1'
}

/**
 * OpenAI-compatible Chat Completions API 호출.
 * @param body - API 요청 본문 (model, messages, stream, response_format 등)
 * @param signal - AbortController signal (요청 취소용)
 * @returns fetch Response 객체 (스트리밍 시 body를 직접 읽어야 함)
 */
export async function openaiChat(body: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch(`${openaiBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`AI request failed: ${detail}`)
  }
  return response
}

/**
 * Comet API Chat Completions 호출 (제품명 정제 등 경량 작업용).
 * OpenAI API와 동일한 인터페이스, 다른 엔드포인트/키 사용.
 */
export async function cometChat(body: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch(`${cometBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cometApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Comet API request failed: ${detail}`)
  }
  return response
}
