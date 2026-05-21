export function openaiKey(): string {
  const key = process.env.OPENAI_API_KEY ?? process.env.COMETAPI_KEY
  if (!key) throw new Error('OPENAI_API_KEY or COMETAPI_KEY is required')
  return key
}

export function openaiBaseUrl(): string {
  if (process.env.OPENAI_BASE_URL) return process.env.OPENAI_BASE_URL
  if (process.env.COMETAPI_BASE_URL) return process.env.COMETAPI_BASE_URL
  if (process.env.COMETAPI_KEY && !process.env.OPENAI_API_KEY) return 'https://api.cometapi.com/v1'
  return 'https://api.openai.com/v1'
}

export function cometApiKey(): string {
  const key = process.env.COMETAPI_KEY
  if (!key) throw new Error('COMETAPI_KEY is required')
  return key
}

export function cometBaseUrl(): string {
  return process.env.COMETAPI_BASE_URL ?? 'https://api.cometapi.com/v1'
}

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
