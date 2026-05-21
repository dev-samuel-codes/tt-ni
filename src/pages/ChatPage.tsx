import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Bot, User, Plus, MessageCircle, Info, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatSession {
  id: string
  title: string
  active: boolean
}

export function ChatPage() {
  const [input, setInput] = useState('')
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '안녕하세요! 등록하신 영양제와 건강 상태에 대해 궁금한 점을 물어보세요.' }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)
  const [contextBadges, setContextBadges] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fullTextRef = useRef('')

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadSessions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('id, title')
        .order('created_at', { ascending: false })

      if (error) throw error

      const loaded: ChatSession[] = (data || []).map((s: { id: string; title: string }) => ({
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
      const { data } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (data && data.length > 0) {
        setMessages(data as ChatMessage[])
      } else {
        setMessages([
          { role: 'assistant', content: '안녕하세요! 등록하신 영양제와 건강 상태에 대해 궁금한 점을 물어보세요.' }
        ])
      }
    } catch {
      // fallback: use current messages
    }
  }

  const loadContextBadges = useCallback(async () => {
    const badges: string[] = []
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: profiles }, { data: supplements }, { data: reports }] = await Promise.all([
        supabase.from('user_profiles').select('id').limit(1),
        supabase.from('supplement_products').select('id'),
        supabase.from('analysis_reports').select('id').order('created_at', { ascending: false }).limit(1),
      ])

      if (profiles && profiles.length > 0) badges.push('프로필 정보')
      if (supplements && supplements.length > 0) badges.push(`영양제 ${supplements.length}개`)
      if (reports && reports.length > 0) badges.push('최근 분석 리포트')
    } catch {
      // context loading is best-effort
    }
    setContextBadges(badges)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSessions()
    loadContextBadges()
  }, [loadSessions, loadContextBadges])

  async function createSession(title?: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({ title: title || '새 대화' })
        .select('id, title')
        .single()

      if (error) throw error
      return data.id
    } catch {
      return null
    }
  }

  async function saveMessage(sessionId: string, msg: ChatMessage) {
    try {
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        role: msg.role,
        content: msg.content,
      })
    } catch {
      // best-effort save
    }
  }

  const handleSend = async (text?: string) => {
    const msgText = text || input
    if (!msgText.trim() || isLoading || rateLimited) return

    const userMsg: ChatMessage = { role: 'user', content: msgText }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
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
      // Update session title on first message if it's still default
      if (sessions.find((s) => s.id === sessionId)?.title === '새 대화') {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title: msgText.slice(0, 30) } : s))
        )
        try {
          await supabase.from('chat_sessions').update({ title: msgText.slice(0, 30) }).eq('id', sessionId)
        } catch { /* best-effort */ }
      }
    }

    if (sessionId !== 'local') {
      await saveMessage(sessionId, userMsg)
    }

    // Placeholder for AI response while streaming
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    // AI 개인화 컨텍스트 데이터 수집
    let chatContext: Record<string, unknown> = {
      profile: { conditions: [], medications: [] },
      supplements: [],
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const [profileRes, conditionsRes, medicationsRes, userSupplementsRes, reportRes] = await Promise.all([
          supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle(),
          supabase.from('user_conditions').select('*').eq('user_id', user.id),
          supabase.from('user_medications').select('*').eq('user_id', user.id),
          supabase
            .from('user_supplements')
            .select('id, daily_servings, intake_time, active, supplement_products(id, product_name, brand_name, source_type, supplement_ingredients(*))')
            .eq('user_id', user.id).eq('active', true),
          supabase
            .from('analysis_reports')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        ])

        const conditions = conditionsRes.data ?? []
        const profileData = profileRes.data

        chatContext = {
          profile: {
            gender: profileData?.gender,
            birthYear: profileData?.birth_year,
            conditions: conditions
              .filter((item) => !item.condition_code.startsWith('allergy:') && !item.condition_code.startsWith('diet:'))
              .map((item) => item.condition_name),
            medications: (medicationsRes.data ?? []).map((med) => ({
              name: med.medication_name,
              memo: med.memo || undefined
            }))
          },
          supplements: (userSupplementsRes.data ?? []).flatMap((row) => {
            const product = Array.isArray(row.supplement_products) ? row.supplement_products[0] : row.supplement_products
            if (!product) return []
            return [{
              productName: product.product_name,
              confirmed: true,
              ingredients: (product.supplement_ingredients ?? []).map((ing) => ({
                standardName: ing.standard_name,
                amount: ing.amount === null ? null : Number(ing.amount),
                unit: ing.unit,
              }))
            }]
          }),
          report: reportRes.data ? {
            statusSummary: reportRes.data.status_summary,
            totals: reportRes.data.totals,
            duplicateItems: reportRes.data.duplicate_items,
            interactionWarnings: reportRes.data.interaction_warnings,
            recommendations: reportRes.data.recommendations,
            synergyRecommendations: reportRes.data.synergy_recommendations,
            antagonismWarnings: reportRes.data.antagonism_warnings
          } : undefined
        }
      }
    } catch {
      // best-effort context load
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
          },
          body: JSON.stringify({
            message: msgText,
            sessionId: sessionId !== 'local' ? sessionId : undefined,
            context: chatContext,
          }),
        }
      )

      if (response.status === 429) {
        setRateLimited(true)
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: '요청이 너무 많아 잠시 제한되었습니다. 1분 후에 다시 물어봐 주세요.',
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

      // Save final message
      if (sessionId !== 'local' && fullTextRef.current) {
        await saveMessage(sessionId, { role: 'assistant', content: fullTextRef.current })
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
              <span>요청이 너무 많아 잠시 제한되었습니다. 1분 후에 다시 시도해주세요.</span>
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
