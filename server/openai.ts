export function openaiKey(): string {
  const key = process.env.OPENAI_API_KEY ?? process.env.COMETAPI_KEY
  if (!key) throw new Error('OPENAI_API_KEY or COMETAPI_KEY is required')
  return key
}

export function openaiBaseUrl(): string {
  return process.env.OPENAI_BASE_URL ?? process.env.COMETAPI_BASE_URL ?? 'https://api.openai.com/v1'
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
