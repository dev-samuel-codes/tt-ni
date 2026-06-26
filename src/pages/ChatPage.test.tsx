// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../lib/apiClient'
import { ChatPage } from './ChatPage'
import type { Medication, Profile, SupplementProduct } from '../types'

vi.mock('../lib/apiClient', () => ({
  apiRequest: vi.fn(),
  getAuthToken: vi.fn(),
}))

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

const profile: Profile = {
  gender: 'female',
  birthYear: 1998,
  heightCm: 165,
  weightKg: 55,
  pregnancyStatus: 'none',
  lactationStatus: false,
  conditions: [],
  allergies: [],
  dietaryRestrictions: [],
  consentAccepted: false,
  wakeTime: '08:00',
  mealTimes: ['09:00', '13:00', '19:00'],
}

const medications: Medication[] = []
const supplements: SupplementProduct[] = []
const mockedApiRequest = vi.mocked(apiRequest)

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  window.localStorage.clear()
  mockedApiRequest.mockReset()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ChatPage previous conversations', () => {
  it('keeps the selected conversation when an earlier message request resolves late', async () => {
    const firstSessionMessages = deferred<ChatMessage[]>()
    mockedApiRequest.mockImplementation((path: string) => {
      if (path === '/api/chat/sessions') {
        return Promise.resolve([
          { id: 'chat-empty', title: '새 대화', messageCount: 0 },
          { id: 'chat-vitamin', title: '비타민 D 과다 복용 증상', messageCount: 2 },
        ])
      }
      if (path === '/api/chat/sessions/chat-empty/messages') {
        return firstSessionMessages.promise
      }
      if (path === '/api/chat/sessions/chat-vitamin/messages') {
        return Promise.resolve([
          { role: 'user', content: '비타민 D 질문' },
          { role: 'assistant', content: '비타민 D 답변' },
        ])
      }
      return Promise.reject(new Error(`unexpected API path: ${path}`))
    })

    const user = userEvent.setup()
    render(<ChatPage profile={profile} medications={medications} supplements={supplements} report={null} />)

    const sidebar = document.querySelector('.chat-sidebar')
    expect(sidebar).toBeTruthy()
    await user.click(await within(sidebar as HTMLElement).findByRole('button', { name: /비타민 D 과다 복용 증상/ }))

    expect(await screen.findByText('비타민 D 질문')).toBeTruthy()
    expect(screen.getByText('비타민 D 답변')).toBeTruthy()

    await act(async () => {
      firstSessionMessages.resolve([{ role: 'user', content: '늦게 도착한 첫 번째 대화' }])
      await firstSessionMessages.promise
    })

    expect(screen.getByText('비타민 D 질문')).toBeTruthy()
    expect(screen.queryByText('늦게 도착한 첫 번째 대화')).toBeNull()
  })

  it('shows a retry state when a session with stored messages returns an empty message list', async () => {
    mockedApiRequest.mockImplementation((path: string) => {
      if (path === '/api/chat/sessions') {
        return Promise.resolve([
          { id: 'chat-vitamin', title: '비타민 D 과다 복용 증상', messageCount: 2 },
        ])
      }
      if (path === '/api/chat/sessions/chat-vitamin/messages') {
        return Promise.resolve([])
      }
      return Promise.reject(new Error(`unexpected API path: ${path}`))
    })

    render(<ChatPage profile={profile} medications={medications} supplements={supplements} report={null} />)

    expect(await screen.findByText('저장된 대화내용이 있지만 메시지를 불러오지 못했습니다. 다시 불러오기를 눌러주세요.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeTruthy()
    expect(screen.queryByText('안녕하세요! 등록하신 영양제와 건강 상태에 대해 궁금한 점을 물어보세요.')).toBeNull()
  })

  it('renders cached messages immediately while refreshing them in the background', async () => {
    const freshMessages = deferred<ChatMessage[]>()
    window.localStorage.setItem('tt-ni:chat-messages:v1:chat-vitamin', JSON.stringify({
      messages: [
        { role: 'user', content: '캐시된 질문' },
        { role: 'assistant', content: '캐시된 답변' },
      ],
      messageCount: 2,
      lastMessageAt: '2026-06-24T20:16:23.000Z',
      cachedAt: Date.now(),
    }))

    mockedApiRequest.mockImplementation((path: string) => {
      if (path === '/api/chat/sessions') {
        return Promise.resolve([
          {
            id: 'chat-vitamin',
            title: '비타민 D 과다 복용 증상',
            messageCount: 2,
            lastMessageAt: '2026-06-24T20:16:23.000Z',
          },
        ])
      }
      if (path === '/api/chat/sessions/chat-vitamin/messages') {
        return freshMessages.promise
      }
      return Promise.reject(new Error(`unexpected API path: ${path}`))
    })

    render(<ChatPage profile={profile} medications={medications} supplements={supplements} report={null} />)

    expect(await screen.findByText('캐시된 질문')).toBeTruthy()
    expect(screen.getByText('캐시된 답변')).toBeTruthy()
    expect(screen.queryByText('이전 대화내용을 불러오는 중입니다.')).toBeNull()

    await act(async () => {
      freshMessages.resolve([
        { role: 'user', content: '최신 질문' },
        { role: 'assistant', content: '최신 답변' },
      ])
      await freshMessages.promise
    })

    expect(screen.getByText('최신 질문')).toBeTruthy()
    expect(screen.getByText('최신 답변')).toBeTruthy()
    expect(screen.queryByText('캐시된 답변')).toBeNull()
  })

  it('prefetches stored session messages after loading the session list', async () => {
    const delayedRefresh = deferred<ChatMessage[]>()
    let vitaminMessageRequests = 0

    mockedApiRequest.mockImplementation((path: string) => {
      if (path === '/api/chat/sessions') {
        return Promise.resolve([
          {
            id: 'chat-iron',
            title: '철분과 같이 먹으면 안 되는 영양제',
            messageCount: 2,
            lastMessageAt: '2026-06-24T20:10:00.000Z',
          },
          {
            id: 'chat-vitamin',
            title: '비타민 D 과다 복용 증상',
            messageCount: 2,
            lastMessageAt: '2026-06-24T20:16:23.000Z',
          },
        ])
      }
      if (path === '/api/chat/sessions/chat-iron/messages') {
        return Promise.resolve([
          { role: 'user', content: '철분 질문' },
          { role: 'assistant', content: '철분 답변' },
        ])
      }
      if (path === '/api/chat/sessions/chat-vitamin/messages') {
        vitaminMessageRequests += 1
        if (vitaminMessageRequests === 1) {
          return Promise.resolve([
            { role: 'user', content: '프리패치 질문' },
            { role: 'assistant', content: '프리패치 답변' },
          ])
        }
        return delayedRefresh.promise
      }
      return Promise.reject(new Error(`unexpected API path: ${path}`))
    })

    const user = userEvent.setup()
    render(<ChatPage profile={profile} medications={medications} supplements={supplements} report={null} />)

    expect(await screen.findByText('철분 질문')).toBeTruthy()
    await waitFor(() => expect(vitaminMessageRequests).toBe(1))
    await waitFor(() => {
      const cached = JSON.parse(window.localStorage.getItem('tt-ni:chat-messages:v1:chat-vitamin') || '{}') as {
        messages?: ChatMessage[]
      }
      expect(cached.messages?.[0]?.content).toBe('프리패치 질문')
    })

    const sidebar = document.querySelector('.chat-sidebar')
    expect(sidebar).toBeTruthy()
    await user.click(await within(sidebar as HTMLElement).findByRole('button', { name: /비타민 D 과다 복용 증상/ }))

    expect(await screen.findByText('프리패치 질문')).toBeTruthy()
    expect(screen.getByText('프리패치 답변')).toBeTruthy()
    expect(screen.queryByText('이전 대화내용을 불러오는 중입니다.')).toBeNull()
    expect(vitaminMessageRequests).toBe(2)
  })
})
