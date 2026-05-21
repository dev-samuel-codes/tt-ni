import { useMemo, useState } from 'react'
import { Clock, AlertCircle, Coffee, Pill, Lightbulb, AlertTriangle } from 'lucide-react'
import type { Medication, Profile, SupplementProduct } from '../types'
import { generateSchedule, cleanProductName } from '../features/schedule/scheduleEngine'

interface TimelineSlot {
  time: string
  label: string
  items: string[]
  tip?: string
  warning?: string
  tips?: string[]
  warnings?: string[]
  color: string
}

const TIMELINE_COLORS = ['#18ae90', '#30cdb0', '#d8a030', '#6b8aed', '#ea868f', '#9b5de5']

export function SchedulePage({
  supplements,
  profile,
  medications,
}: {
  supplements: SupplementProduct[]
  profile: Profile
  medications: Medication[]
}) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  const timeline = useMemo<TimelineSlot[]>(() => {
    if (!(supplements.length > 0)) return []
    const requestSupplements = supplements.map((s) => ({
      id: s.id,
      productName: s.productName,
      dailyServings: s.dailyServings,
      ingredients: s.ingredients.map((ing) => ({
        nutrientId: ing.nutrientId,
        standardName: ing.standardName,
        amount: ing.amount ?? 0,
        unit: ing.unit
      }))
    }))
    const requestMedications = medications.map((m) => ({
      name: m.name,
      memo: m.memo || ''
    }))
    const requestPreferences = {
      wakeTime: profile?.wakeTime || '08:00',
      mealTimes: profile?.mealTimes || ['09:00', '13:00', '19:00']
    }

    return generateSchedule({
      supplements: requestSupplements,
      medications: requestMedications,
      conditions: profile.conditions,
      preferences: requestPreferences,
    }).map((slot, idx) => ({
      ...slot,
      color: TIMELINE_COLORS[idx % TIMELINE_COLORS.length],
    }))
  }, [supplements, medications, profile])

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
    <>
      <div className="panel-grid two">
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
            {timeline.length === 0 ? (
              <p style={{ color: '#8a9a95', textAlign: 'center', padding: '32px 0', fontSize: '14px' }}>
                아직 생성된 스케줄이 없어요. 분석 리포트를 먼저 확인해보세요.
              </p>
            ) : timeline.map((slot, idx) => (
              <div key={idx} className="timeline-slot" style={{ display: 'flex', gap: '20px' }}>
                {/* 좌측 프리미엄 타임라인 커넥터 축 */}
                <div className="timeline-axis" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
                  <div 
                    className="timeline-badge-glow"
                    style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%', 
                      background: slot.color, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      cursor: 'default'
                    }}
                  >
                    <Clock size={20} color="#fff" />
                  </div>
                  {idx < timeline.length - 1 && <div className="timeline-connector" />}
                </div>

                {/* 프리미엄 타임라인 카드 */}
                <div className="premium-timeline-card" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <strong style={{ fontSize: '18px', color: '#173c3c', letterSpacing: '-0.3px' }}>{slot.time}</strong>
                    <span 
                      style={{ 
                        fontSize: '12px', 
                        color: '#0a6e58', 
                        background: '#e6f9f4', 
                        padding: '4px 10px', 
                        borderRadius: '20px',
                        fontWeight: 800
                      }}
                    >
                      {slot.label}
                    </span>
                  </div>
                  
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {slot.items.map((item, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 650, color: '#2c3a37' }}>
                        <span 
                          style={{ 
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            background: slot.color,
                            boxShadow: `0 0 8px ${slot.color}`
                          }} 
                        />
                        {cleanProductName(item)}
                      </li>
                    ))}
                  </ul>

                  {slot.tip && (
                    <div 
                      style={{ 
                        marginTop: '12px', 
                        fontSize: '13px', 
                        color: '#52605b', 
                        background: '#f8fafa', 
                        padding: '10px 14px', 
                        borderRadius: '8px',
                        borderLeft: `3px solid ${slot.color}`,
                        lineHeight: 1.5,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: '#173c3c' }}>
                        <Lightbulb size={14} color={slot.color} style={{ flexShrink: 0 }} />
                        <span>복용 가이드</span>
                      </div>
                      <div>{slot.tip}</div>
                    </div>
                  )}

                  {slot.warnings && slot.warnings.length > 0 ? (
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {slot.warnings.map((warn, wIdx) => {
                        const isBlock = warn.includes('금지') || warn.includes('수 없습니다') || warn.includes('금지됩니다')
                        let title = '복용 주의'
                        let desc = warn
                        if (warn.includes(':')) {
                          const parts = warn.split(':')
                          title = parts[0].trim()
                          desc = parts.slice(1).join(':').trim()
                        }

                        return (
                          <div 
                            key={wIdx}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              background: isBlock ? '#fff1f0' : '#fffbe6',
                              border: `1px solid ${isBlock ? '#ffa39e' : '#ffe58f'}`,
                              borderLeft: `4px solid ${isBlock ? '#ff4d4f' : '#faad14'}`,
                              borderRadius: '10px',
                              padding: '12px 16px',
                              lineHeight: 1.5,
                              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                              transition: 'transform 0.2s ease',
                            }}
                            className="warning-card"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {isBlock ? (
                                  <AlertCircle size={15} color="#ff4d4f" style={{ flexShrink: 0 }} />
                                ) : (
                                  <AlertTriangle size={15} color="#d46b08" style={{ flexShrink: 0 }} />
                                )}
                                <strong style={{ fontSize: '13.5px', color: isBlock ? '#cf1322' : '#d46b08', fontWeight: 800 }}>
                                  {title}
                                </strong>
                              </div>
                              <span style={{
                                fontSize: '11px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 800,
                                background: isBlock ? '#ffccc7' : '#fffb8f',
                                color: isBlock ? '#a8071a' : '#ad6800',
                                letterSpacing: '-0.2px'
                              }}>
                                {isBlock ? '병용 금지' : '시간차 복용 권장'}
                              </span>
                            </div>
                            <div style={{ fontSize: '13px', color: '#434343', paddingLeft: '21px', fontWeight: 550 }}>
                              {desc}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : slot.warning ? (
                    <div 
                      style={{ 
                        marginTop: '12px', 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '8px', 
                        color: '#b96b00', 
                        fontSize: '13px', 
                        background: '#fff8d9', 
                        padding: '10px 14px', 
                        borderRadius: '10px',
                        border: '1px solid #f2dfb1',
                        lineHeight: 1.5
                      }}
                    >
                      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{slot.warning}</span>
                    </div>
                  ) : null}
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
      </div>

      <p style={{ fontSize: '12px', color: '#8a9a95', textAlign: 'center', marginTop: '24px', lineHeight: 1.5 }}>
        본 스케줄은 참고용이며, 의학적 진단이나 처방을 대체하지 않습니다.
      </p>
    </>
  )
}
