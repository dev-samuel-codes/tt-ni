import { useState } from 'react'
import { Send, Bot, User, Plus, MessageCircle, Info } from 'lucide-react'

export function ChatPage() {
  const [input, setInput] = useState('')

  // TODO: 사용자님 작업 영역 - AI 상담 로직 연동
  // 1. Supabase Edge Function 또는 별도 AI 백엔드 호출 로직을 handleSend에 구현하세요.
  // 2. 프로필, 영양제, 분석 리포트를 AI 모델 컨텍스트로 전송하세요.
  // 3. SSE 스트리밍 응답 처리를 구현하세요.

  // TODO: 사용자님 작업 영역 - 대화 세션 관리 (생성/전환/삭제) 로직 구현
  const [sessions] = useState([
    { id: '1', title: '새 대화', active: true },
  ])

  const [messages, setMessages] = useState([
    { role: 'assistant', text: '안녕하세요! 등록하신 영양제와 건강 상태에 대해 궁금한 점을 물어보세요.' }
  ])
  const [isLoading, setIsLoading] = useState(false)

  // TODO: 사용자님 작업 영역 - 실제 컨텍스트 데이터를 프로필/영양제/리포트에서 로드
  const contextBadges = ['프로필 정보', '영양제 3개', '최근 분석 리포트']

  const faqSuggestions = [
    '철분과 같이 먹으면 안 되는 영양제가 있나요?',
    '오메가3는 언제 먹는 게 좋나요?',
    '비타민 D 과다 복용 증상이 궁금해요',
    '유산균과 항생제 간격은 얼마나 둬야 하나요?',
  ]

  const handleSend = (text?: string) => {
    const msgText = text || input
    if (!msgText.trim()) return

    const newMessages = [...messages, { role: 'user', text: msgText }]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    // TODO: 사용자님 작업 영역 - API 호출 및 응답 처리
    // const response = await fetchAiResponse(msgText, contextData);
    // setMessages([...newMessages, { role: 'assistant', text: response }]);

    setTimeout(() => {
      setMessages([...newMessages, { role: 'assistant', text: '(모의 응답) 실제 AI 연동 로직을 구현해주세요.' }])
      setIsLoading(false)
    }, 1000)
  }

  const showFaq = messages.length <= 1 && !isLoading

  return (
    <div style={{ display: 'flex', gap: '16px', height: 'calc(100vh - 140px)' }}>
      {/* 대화 세션 사이드바 */}
      <div style={{ width: '200px', flexShrink: 0, background: '#f9fbfb', borderRadius: '12px', border: '1px solid #e1e8e5', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button type="button" className="button primary" style={{ width: '100%', fontSize: '13px' }}>
          <Plus size={14} /> 새 대화
        </button>
        {/* TODO: 사용자님 작업 영역 - 세션 목록을 DB에서 로드하여 렌더링 */}
        {sessions.map((s) => (
          <button key={s.id} type="button" style={{
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
      <section className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                {msg.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#18ae90', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                <Bot size={20} />
              </div>
              <div style={{ padding: '12px 16px', color: '#697771' }}>답변을 작성하고 있습니다...</div>
            </div>
          )}

          {/* FAQ 추천 칩 */}
          {showFaq && (
            <div style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '13px', color: '#8a9a95', marginBottom: '10px', fontWeight: 700 }}>💬 자주 묻는 질문</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {faqSuggestions.map((q) => (
                  <button key={q} type="button" onClick={() => handleSend(q)} style={{
                    padding: '8px 14px', borderRadius: '20px', border: '1px solid #e1e8e5', background: '#fff',
                    color: '#173c3c', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#f0f4f2')}
                  onMouseOut={(e) => (e.currentTarget.style.background = '#fff')}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #e1e8e5', display: 'flex', gap: '12px' }}>
          <input
            type="text" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="예: 철분과 같이 먹으면 안 되는 영양제가 있나요?"
            style={{ flex: 1, padding: '14px 16px', borderRadius: '8px', border: '1px solid #cbd5d0', fontSize: '15px' }}
            disabled={isLoading}
          />
          <button type="button" className="button primary mint" onClick={() => handleSend()}
            disabled={isLoading || !input.trim()} style={{ minWidth: '60px', padding: '0' }}>
            <Send size={20} />
          </button>
        </div>
      </section>
    </div>
  )
}
