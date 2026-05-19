import { useState, useEffect } from 'react'
import { Clock, AlertCircle, Coffee, Pill, Loader } from 'lucide-react'
import type { SupplementProduct } from '../types'
import { supabase } from '../lib/supabaseClient'

interface TimelineSlot {
  time: string
  label: string
  items: string[]
  tip?: string
  warning?: string
  color: string
}

const TIMELINE_COLORS = ['#18ae90', '#30cdb0', '#d8a030', '#6b8aed', '#ea868f', '#9b5de5']

export function SchedulePage({ supplements }: { supplements: SupplementProduct[] }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [timeline, setTimeline] = useState<TimelineSlot[]>([])
  const [isLoading, setIsLoading] = useState(supplements.length > 0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!(supplements.length > 0)) return
    let cancelled = false
    supabase.functions.invoke('generate-schedule', {
      body: { supplementIds: supplements.map((s) => s.id), date: selectedDate },
    }).then(({ data, error: invokeError }) => {
      if (cancelled) return
      if (invokeError) throw new Error(invokeError.message || '스케줄 생성에 실패했습니다.')
      if (data?.timeline) {
        setTimeline(data.timeline.map((slot: Omit<TimelineSlot, 'color'>, idx: number) => ({
          ...slot,
          color: TIMELINE_COLORS[idx % TIMELINE_COLORS.length],
        })))
      } else {
        setTimeline([])
      }
    }).catch((err) => {
      if (cancelled) return
      setError(err instanceof Error ? err.message : '스케줄을 불러오는 중 문제가 발생했습니다.')
    }).finally(() => {
      if (!cancelled) setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [supplements, selectedDate])

  // 보고서 4.3절 기반 복용 팁
  const dosageTips = [
    { icon: Coffee, text: '커피(카페인) 섭취 후 최소 2시간 이후 영양제를 복용하세요. 탄닌이 흡수를 방해합니다.' },
    { icon: Pill, text: '모든 영양제는 약 200ml 실온 생수와 함께 복용하세요. 우유/주스와 병용 금지.' },
    { icon: AlertCircle, text: '알코올 섭취 시 간 대사 경로에 부하가 걸려 영양제 독성이 증가할 수 있습니다.' },
  ]

  if (!(supplements.length > 0)) {
    return (
      <div className="panel-grid">
        <section className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Clock size={48} color="#18ae90" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '20px', fontWeight: 850, color: '#173c3c', marginBottom: '8px' }}>영양제를 먼저 등록해주세요</h3>
          <p style={{ color: '#697771', fontSize: '15px', lineHeight: 1.7, maxWidth: '400px', margin: '0 auto' }}>
            등록된 영양제 정보를 바탕으로 시간약리학 기반의 맞춤형 복용 스케줄이 자동으로 생성됩니다.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="panel-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>스마트 복용 스케줄</h2>
            <p>시간약리학 기반으로 최적화된 영양제 복용 타임라인입니다.</p>
          </div>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e1e8e5' }} />
        </div>

        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#697771' }}>
              <Loader size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
              <p style={{ fontSize: '14px' }}>맞춤형 복용 스케줄을 생성하고 있습니다...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <AlertCircle size={24} color="#b96b00" style={{ marginBottom: '12px' }} />
              <p style={{ color: '#b96b00', fontSize: '14px' }}>{error}</p>
              <p style={{ color: '#8a9a95', fontSize: '13px', marginTop: '8px' }}>잠시 후 다시 시도해주세요.</p>
            </div>
          ) : timeline.length === 0 ? (
            <p style={{ color: '#8a9a95', textAlign: 'center', padding: '32px 0', fontSize: '14px' }}>
              아직 생성된 스케줄이 없어요. 분석 리포트를 먼저 확인해보세요.
            </p>
          ) : timeline.map((slot, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: slot.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={18} color="#fff" />
                </div>
                {idx < timeline.length - 1 && <div style={{ flex: 1, width: '2px', background: '#e1e8e5', margin: '8px 0' }} />}
              </div>
              <div style={{ flex: 1, background: '#f9fbfb', padding: '16px', borderRadius: '12px', border: '1px solid #e1e8e5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <strong style={{ fontSize: '16px', color: '#173c3c' }}>{slot.time}</strong>
                  <span style={{ fontSize: '12px', color: '#8a9a95', background: '#f0f4f2', padding: '2px 8px', borderRadius: '4px' }}>{slot.label}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {slot.items.map((item, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: slot.color }} />
                      {item}
                    </li>
                  ))}
                </ul>
                {slot.tip && (
                  <div style={{ marginTop: '10px', fontSize: '13px', color: '#52605b', fontStyle: 'italic' }}>
                    팁: {slot.tip}
                  </div>
                )}
                {slot.warning && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: '#b96b00', fontSize: '13px', background: '#fff8d9', padding: '8px 12px', borderRadius: '6px' }}>
                    <AlertCircle size={14} />
                    <span>{slot.warning}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 복용 팁 */}
      <section className="panel">
        <div className="section-heading">
          <div><h2>복용 시 주의사항</h2><p>보고서 기반 식이·기호식품 가이드라인</p></div>
        </div>
        {dosageTips.map((tip, idx) => {
          const Icon = tip.icon
          return (
            <div key={idx} style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: idx < dosageTips.length - 1 ? '1px solid #f0f4f2' : 'none', alignItems: 'flex-start' }}>
              <Icon size={20} color="#b96b00" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '14px', color: '#1a2c28', lineHeight: 1.6 }}>{tip.text}</span>
            </div>
          )
        })}
      </section>

      <p style={{ fontSize: '12px', color: '#8a9a95', textAlign: 'center', marginTop: '16px', lineHeight: 1.5 }}>
        본 스케줄은 참고용이며, 의학적 진단이나 처방을 대체하지 않습니다.
      </p>
    </div>
  )
}
