// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { apiRequest } from '../lib/apiClient'

type MockAuthState = {
  readonly sessionEmail: string | null
  readonly setSessionEmail: (email: string | null) => void
  readonly authNotice: null
  readonly setAuthNotice: (notice: null) => void
  readonly isAuthInitialized: boolean
  readonly profileIsSetup: boolean
}

let mockAuthState: MockAuthState

vi.mock('../features/auth/useAuth', () => ({
  useAuth: () => mockAuthState,
}))

vi.mock('../features/schedule/useTodaySchedule', () => ({
  useTodaySchedule: () => ({
    todaySchedule: [],
    scheduleLoading: false,
  }),
}))

vi.mock('../components/layout/SidebarLayout', () => ({
  SidebarLayout: ({ children }: { readonly children?: import('react').ReactNode }) => (
    <div data-testid="workspace-layout">{children}</div>
  ),
}))

vi.mock('../lib/apiClient', () => ({
  apiRequest: vi.fn(),
  getAuthToken: vi.fn(),
}))

const mockedApiRequest = vi.mocked(apiRequest)

function setMockAuthState(isAuthInitialized: boolean): void {
  mockAuthState = {
    sessionEmail: isAuthInitialized ? 'user@example.com' : null,
    setSessionEmail: vi.fn(),
    authNotice: null,
    setAuthNotice: vi.fn(),
    isAuthInitialized,
    profileIsSetup: true,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  window.history.pushState({}, '', '/workspace/chat')
  setMockAuthState(false)
  mockedApiRequest.mockReset()
  mockedApiRequest.mockImplementation((path: string) => {
    if (path === '/api/chat/sessions') {
      return Promise.resolve([{ id: 'chat-1', title: '이전 상담' }])
    }
    if (path === '/api/chat/sessions/chat-1/messages') {
      return Promise.resolve([
        { role: 'user', content: '예전 질문' },
        { role: 'assistant', content: '예전 답변' },
      ])
    }
    return Promise.reject(new Error(`unexpected API path: ${path}`))
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('App workspace auth gate', () => {
  it('loads previous AI consultation records only after auth initialization', async () => {
    const { rerender } = render(<App />)

    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })
    expect(mockedApiRequest).not.toHaveBeenCalled()

    setMockAuthState(true)
    rerender(<App />)
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
      await Promise.resolve()
    })

    expect(mockedApiRequest).toHaveBeenCalledWith('/api/chat/sessions')
    expect(screen.getByText('예전 질문')).toBeTruthy()
    expect(screen.getByText('예전 답변')).toBeTruthy()
  })
})
