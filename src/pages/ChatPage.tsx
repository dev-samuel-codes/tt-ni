import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Send, Bot, User, Plus, MessageCircle, Info, AlertCircle } from 'lucide-react'
import { apiRequest, getAuthToken } from '../lib/apiClient'
import type { AnalysisReport, Medication, Profile, SupplementProduct } from '../types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatSession {
  id: string
  title: string
  active: boolean
}

export function ChatPage({
  profile,
  medications,
  supplements,
  report,
}: {
  profile: Profile
  medications: Medication[]
  supplements: SupplementProduct[]
  report: AnalysisReport | null
}) {
  const [input, setInput] = useState('')
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '안녕하세요! 등록하신 영양제와 건강 상태에 대해 궁금한 점을 물어보세요.' }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fullTextRef = useRef('')
  const abortControllerRef = useRef<AbortController | null>(null)

  const contextBadges = useMemo(() => {
    const badges: string[] = []
    if (profile.consentAccepted || profile.gender) badges.push('프로필 정보')
    if (supplements.length > 0) badges.push(`영양제 ${supplements.length}개`)
    if (report && report.totals.length > 0) badges.push('최근 분석 리포트')
    return badges
  }, [profile, supplements, report])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => { abortControllerRef.current?.abort() }
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      const data = await apiRequest<Array<{ id: string; title: string }>>('/api/chat/sessions')

      const loaded: ChatSession[] = data.map((s) => ({
        id: s.id,
        title: s.title || '새 대화',
        active: false,
      }))

      if (loaded.length > 0) {
        loaded[0].active = true
        setActiveSessionId(loaded[0].id)
        loadMessages(loaded[0].id)
      }
      setSessions(loaded)
    } catch {
      setSessions([{ id: 'local', title: '새 대화', active: true }])
      setActiveSessionId('local')
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  async function loadMessages(sessionId: string) {
    try {
      const data = await apiRequest<ChatMessage[]>(`/api/chat/sessions/${sessionId}/messages`)

      if (data && data.length > 0) {
        setMessages(data)
      } else {
        setMessages([
          { role: 'assistant', content: '안녕하세요! 등록하신 영양제와 건강 상태에 대해 궁금한 점을 물어보세요.' }
        ])
      }
    } catch {
      // fallback: use current messages
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSessions()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadSessions])

  async function createSession(title?: string): Promise<string | null> {
    try {
      const data = await apiRequest<{ id: string; title: string }>('/api/chat/sessions', {
        method: 'POST',
        body: { title: title || '새 대화' },
      })
      return data.id
    } catch {
      return null
    }
  }

  const chatContext = useMemo(() => ({
    profile: {
      gender: profile.gender,
      birthYear: profile.birthYear,
      conditions: profile.conditions,
      medications: medications.map((m) => ({
        name: m.name,
        memo: m.memo || undefined,
      })),
    },
    supplements: supplements.map((s) => ({
      productName: s.productName,
      confirmed: s.confirmed,
      ingredients: s.ingredients.map((ing) => ({
        standardName: ing.standardName,
        amount: ing.amount,
        unit: ing.unit,
      })),
    })),
    report: report ? {
      statusSummary: report.statusSummary,
      totals: report.totals,
      duplicateItems: report.duplicateItems,
      interactionWarnings: report.interactionWarnings,
      recommendations: report.recommendations,
      synergyRecommendations: report.synergyRecommendations,
      antagonismWarnings: report.antagonismWarnings,
    } : undefined,
  }), [profile, medications, supplements, report])

  const handleSend = async (text?: string) => {
    const msgText = text || input
    if (!msgText.trim() || isLoading || rateLimited) return

    const userMsg: ChatMessage = { role: 'user', content: msgText }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    setRateLimited(false)

    let sessionId = activeSessionId
    if (!sessionId || sessionId === 'local') {
      const newId = await createSession(msgText.slice(0, 30))
      if (newId) {
        sessionId = newId
        setActiveSessionId(newId)
        setSessions((prev) => {
          const updated = prev.map((s) => ({ ...s, active: false }))
          return [{ id: newId, title: msgText.slice(0, 30), active: true }, ...updated]
        })
      } else {
        sessionId = 'local'
      }
    } else {
      if (sessions.find((s) => s.id === sessionId)?.title === '새 대화') {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title: msgText.slice(0, 30) } : s))
        )
        try {
          await apiRequest(`/api/chat/sessions/${sessionId}`, {
            method: 'PATCH',
            body: { title: msgText.slice(0, 30) },
          })
        } catch { /* best-effort */ }
      }
    }

    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const token = await getAuthToken()
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller
      const response = await fetch(
        `${(import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''}/api/chat/completion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: msgText,
            sessionId: sessionId !== 'local' ? sessionId : undefined,
            context: chatContext,
          }),
          signal: controller.signal,
        }
      )

      if (response.status === 429) {
        setRateLimited(true)
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: '일일 AI/API 호출 한도를 초과했습니다. 내일 다시 이용해주세요.',
          }
          return updated
        })
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error(`서버 응답 오류 (${response.status})`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('응답 스트림을 읽을 수 없습니다.')
      }

      const decoder = new TextDecoder()
      fullTextRef.current = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                fullTextRef.current += content
                setMessages((prev) => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role: 'assistant', content: fullTextRef.current }
                  return updated
                })
              }
            } catch {
              // Skip malformed SSE chunks
            }
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: '죄송합니다. 응답을 받아오는 중 문제가 발생했어요. 다시 시도해주세요.',
        }
          return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  const faqSuggestions = [
    '철분과 같이 먹으면 안 되는 영양제가 있나요?',
    '오메가3는 언제 먹는 게 좋나요?',
    '비타민 D 과다 복용 증상이 궁금해요',
    '유산균과 항생제 간격은 얼마나 둬야 하나요?',
  ]

  const showFaq = messages.length <= 1 && !isLoading

  return (
    <div className="chat-page-container">
      {/* 대화 세션 사이드바 */}
      <div className="chat-sidebar">
        <button type="button" className="button primary" style={{ width: '100%', fontSize: '13px', marginBottom: '8px' }} onClick={() => {
          const newId = 'local'
          setActiveSessionId(newId)
          setSessions((prev) => {
            const updated = prev.map((s) => ({ ...s, active: false }))
            return [{ id: newId, title: '새 대화', active: true }, ...updated]
          })
          setMessages([{ role: 'assistant', content: '안녕하세요! 등록하신 영양제와 건강 상태에 대해 궁금한 점을 물어보세요.' }])
          setRateLimited(false)
        }}>
          <Plus size={14} /> 새 대화
        </button>
        {sessionsLoading ? (
          <p style={{ color: '#8a9a95', fontSize: '13px', textAlign: 'center', padding: '8px 0' }}>불러오는 중...</p>
        ) : sessions.map((s) => (
          <button 
            key={s.id} 
            type="button" 
            className={s.active ? 'active-session' : 'inactive-session'}
            onClick={() => {
              setSessions((prev) => prev.map((item) => ({ ...item, active: item.id === s.id })))
              setActiveSessionId(s.id)
              setRateLimited(false)
              if (s.id !== 'local') loadMessages(s.id)
              else setMessages([{ role: 'assistant', content: '안녕하세요! 등록하신 영양제와 건강 상태에 대해 궁금한 점을 물어보세요.' }])
            }} 
            style={{
              width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: '8px', border: 'none',
              fontSize: '13px', fontWeight: 750, cursor: 'pointer',
              display: 'flex', alignItems: 'center', transition: 'all 0.2s',
            }}
          >
            <MessageCircle size={14} style={{ marginRight: '6px', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
          </button>
        ))}
      </div>

      {/* 메인 채팅 영역 */}
      <section className="panel chat-main-panel">
        <div className="section-heading">
          <div>
            <h2>맞춤형 AI 상담</h2>
            <p>나의 데이터를 바탕으로 AI가 질문에 답변합니다.</p>
          </div>
        </div>

        {/* 컨텍스트 배지 영역 */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#8a9a95', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
            <Info size={14} />
            연결된 정보:
          </span>
          {contextBadges.map((badge) => (
            <span 
              key={badge} 
              style={{ 
                fontSize: '11.5px', 
                color: '#0a6e58', 
                background: '#e6f9f4', 
                border: '1px solid rgba(24, 174, 144, 0.15)',
                padding: '4px 12px', 
                borderRadius: '20px', 
                fontWeight: 800,
                boxShadow: '0 2px 6px rgba(24, 174, 144, 0.03)'
              }}
            >
              ✓ {badge}
            </span>
          ))}
          {contextBadges.length === 0 && (
            <span style={{ fontSize: '12px', color: '#8a9a95' }}>없음 (수동 상담 모드)</span>
          )}
        </div>

        {/* 채팅 영역 본체 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', margin: '6px 0' }}>
              <div 
                className="timeline-badge-glow"
                style={{ 
                  width: '38px', 
                  height: '38px', 
                  borderRadius: '50%', 
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #173c3c 0%, #0d2626 100%)' : 'linear-gradient(135deg, #18ae90 0%, #11846d 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: '#fff', 
                  flexShrink: 0,
                  boxShadow: msg.role === 'user' ? '0 4px 12px rgba(23, 60, 60, 0.2)' : '0 4px 12px rgba(24, 174, 144, 0.25)'
                }}
              >
                {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div 
                className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}
                style={{
                  padding: '14px 18px', 
                  maxWidth: '75%', 
                  fontSize: '15px', 
                  lineHeight: '1.65'
                }}
              >
                {msg.content === '' ? (
                  <div className="bouncing-dots" aria-label="답변을 작성하는 중">
                    <span />
                    <span />
                    <span />
                  </div>
                ) : (
                  <MarkdownRenderer content={msg.content} />
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />

          {/* FAQ 추천 칩 */}
          {showFaq && (
            <div style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '13px', color: '#8a9a95', marginBottom: '10px', fontWeight: 700 }}>자주 묻는 질문</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {faqSuggestions.map((q) => (
                  <button key={q} type="button" onClick={() => handleSend(q)} className="faq-chip" style={{
                    padding: '8px 14px', borderRadius: '20px', border: '1px solid #e1e8e5', background: '#fff',
                    color: '#173c3c', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #e1e8e5' }}>
          {rateLimited && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b96b00', fontSize: '13px', background: '#fff8d9', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px' }}>
              <AlertCircle size={14} />
              <span>일일 AI/API 호출 한도를 초과했습니다. 내일 다시 이용해주세요.</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={rateLimited ? '잠시 후 다시 시도해주세요...' : '예: 철분과 같이 먹으면 안 되는 영양제가 있나요?'}
              style={{ flex: 1, padding: '14px 16px', borderRadius: '8px', border: '1px solid #cbd5d0', fontSize: '15px' }}
              disabled={isLoading || rateLimited}
            />
            <button type="button" className="button primary mint" onClick={() => handleSend()}
              disabled={isLoading || !input.trim() || rateLimited} style={{ minWidth: '60px', padding: '0' }}>
              <Send size={20} />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

/**
 * AI 실시간 스트리밍 분석 답변을 수려하게 렌더링해주는 순수 React용 마크다운 파서 컴포넌트
 */
function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null

  // 줄 단위 분리
  const lines = content.split('\n')

  return (
    <div className="markdown-body">
      {lines.map((line, idx) => {
        const trimmed = line.trim()

        // 1. blockquote 인용구
        if (trimmed.startsWith('>')) {
          return (
            <blockquote key={idx}>
              {renderInline(trimmed.slice(1).trim())}
            </blockquote>
          )
        }

        // 2. 글머리 리스트 (- , * )
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '6px 0 6px 12px' }}>
              <span style={{ color: '#18ae90', marginTop: '6px', fontSize: '8px', flexShrink: 0 }}>●</span>
              <span>{renderInline(trimmed.slice(1).trim())}</span>
            </div>
          )
        }

        // 3. 숫자 리스트 (1. )
        const numMatch = trimmed.match(/^(\d+)\.\s(.*)/)
        if (numMatch) {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '6px 0 6px 12px' }}>
              <span style={{ color: '#18ae90', fontWeight: 'bold', flexShrink: 0 }}>{numMatch[1]}.</span>
              <span>{renderInline(numMatch[2].trim())}</span>
            </div>
          )
        }

        // 4. 빈 줄 간격 조절
        if (trimmed === '') {
          return <div key={idx} style={{ height: '8px' }} />
        }

        // 5. 일반 단락
        return <p key={idx} style={{ margin: '4px 0' }}>{renderInline(line)}</p>
      })}
    </div>
  )
}

/**
 * 인라인 마크다운 (굵은 글씨 및 인라인 코드) 렌더링 헬퍼 함수
 */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>
    }
    return part
  })
}
