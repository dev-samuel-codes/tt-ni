import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Bot, User, Plus, MessageCircle, Info, Loader, AlertCircle } from 'lucide-react'
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
      profile: { gender: 'female', birthYear: 1998, conditions: [], medications: [] },
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
            gender: profileData?.gender || 'female',
            birthYear: profileData?.birth_year || 1998,
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
        <button type="button" className="button primary" style={{ width: '100%', fontSize: '13px' }} onClick={() => {
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
          <button key={s.id} type="button" onClick={() => {
            setSessions((prev) => prev.map((item) => ({ ...item, active: item.id === s.id })))
            setActiveSessionId(s.id)
            setRateLimited(false)
            if (s.id !== 'local') loadMessages(s.id)
            else setMessages([{ role: 'assistant', content: '안녕하세요! 등록하신 영양제와 건강 상태에 대해 궁금한 점을 물어보세요.' }])
          }} style={{
            width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: '8px', border: 'none',
            background: s.active ? '#173c3c' : 'transparent', color: s.active ? '#fff' : '#52605b',
            fontSize: '13px', fontWeight: 750, cursor: 'pointer',
          }}>
            <MessageCircle size={14} style={{ marginRight: '6px' }} />
            {s.title}
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

        {/* 컨텍스트 배지 */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <Info size={14} color="#8a9a95" />
          {contextBadges.map((badge) => (
            <span key={badge} style={{ fontSize: '12px', color: '#52605b', background: '#f0f4f2', padding: '3px 10px', borderRadius: '12px', fontWeight: 700 }}>
              🔗 {badge}
            </span>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: msg.role === 'user' ? '#173c3c' : '#18ae90', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
              </div>
              <div style={{
                background: msg.role === 'user' ? '#f0f4f2' : '#ffffff',
                border: msg.role === 'user' ? 'none' : '1px solid #e1e8e5',
                padding: '12px 16px', borderRadius: '12px', maxWidth: '75%', fontSize: '15px', lineHeight: '1.6', color: '#1a2c28'
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#18ae90', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                <Bot size={20} />
              </div>
              <div style={{ padding: '12px 16px', color: '#697771' }}>
                <Loader size={16} style={{ display: 'inline', marginRight: '8px', animation: 'spin 1s linear infinite' }} />
                답변을 작성하고 있습니다...
              </div>
            </div>
          )}
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
