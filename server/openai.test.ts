import { afterEach, describe, expect, it } from 'vitest'
import { cometBaseUrl, openaiBaseUrl } from './openai'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('openaiBaseUrl', () => {
  it('defaults to the Comet API base URL when only a Comet key is configured', () => {
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENAI_BASE_URL
    delete process.env.COMETAPI_BASE_URL
    process.env.COMETAPI_KEY = 'test-comet-key'

    expect(openaiBaseUrl()).toBe('https://api.cometapi.com/v1')
  })

  it('keeps explicit provider base URLs first', () => {
    process.env.OPENAI_BASE_URL = 'https://example.com/openai/v1'
    process.env.COMETAPI_BASE_URL = 'https://example.com/comet/v1'
    process.env.COMETAPI_KEY = 'test-comet-key'

    expect(openaiBaseUrl()).toBe('https://example.com/openai/v1')
  })
})

describe('cometBaseUrl', () => {
  it('uses the Comet API base URL by default', () => {
    delete process.env.COMETAPI_BASE_URL

    expect(cometBaseUrl()).toBe('https://api.cometapi.com/v1')
  })

  it('allows an explicit Comet base URL override', () => {
    process.env.COMETAPI_BASE_URL = 'https://example.com/comet/v1'

    expect(cometBaseUrl()).toBe('https://example.com/comet/v1')
  })
})
