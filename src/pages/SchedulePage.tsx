import { useState } from 'react'
import { Clock, AlertCircle, Coffee, Pill } from 'lucide-react'
import type { SupplementProduct } from '../types'

export function SchedulePage({ supplements }: { supplements: SupplementProduct[] }) {
  void supplements
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const hasSupplements = supplements.length > 0

  // TODO: 사용자님 작업 영역 - scheduleEngine.ts에서 supplements 기반으로 스케줄 생성
  // 보고서 제4장의 시간약리학 원칙을 반영하여 슬롯을 자동 배치하세요
  const mockTimeline = [
    {
      time: 'AM 공복 (07:00)',
      label: '아침 공복',
      items: ['유산균 (종근당)', '비타민 B군 복합체'],
      tip: '위산 분비가 적은 공복에 수용성 물질 흡수 극대화',
      warning: '항생제 복용 중이라면 유산균은 2시간 이후 복용',
      color: '#18ae90',
    },
    {
      time: '아침 식후 (08:30)',
      label: '아침 식후',
      items: ['오메가3 (스포츠리서치)', '비타민 D'],
      tip: '지용성 영양소는 식이 지방과 담즙의 미셀 형성이 필수',
      color: '#30cdb0',
    },
    {
      time: '점심 식전 (12:00)',
      label: '점심 식전',
      items: ['홍삼'],
      tip: '식곤증 예방 및 오후 피로 개선에 최적',
      color: '#d8a030',
    },
    {
      time: '저녁 식후 (19:00)',
      label: '저녁 식후',
      items: ['칼슘', '마그네슘', '밀크씨슬'],
      tip: '부교감 신경 활성화 → 근육 이완 → 숙면 유도',
      warning: '칼슘과 철분은 동시 복용 금지! 최소 2~4시간 간격',
      color: '#6b8aed',
    },
  ]

  // 보고서 4.3절 기반 복용 팁
  const dosageTips = [
    { icon: Coffee, text: '커피(카페인) 섭취 후 최소 2시간 이후 영양제를 복용하세요. 탄닌이 흡수를 방해합니다.' },
    { icon: Pill, text: '모든 영양제는 약 200ml 실온 생수와 함께 복용하세요. 우유/주스와 병용 금지.' },
    { icon: AlertCircle, text: '알코올 섭취 시 간 대사 경로에 부하가 걸려 영양제 독성이 증가할 수 있습니다.' },
  ]

  if (!hasSupplements) {
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
          {/* TODO: 사용자님 작업 영역 - 실제 스케줄 데이터를 매핑하여 렌더링하세요 */}
          {mockTimeline.map((slot, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: slot.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={18} color="#fff" />
                </div>
                {idx < mockTimeline.length - 1 && <div style={{ flex: 1, width: '2px', background: '#e1e8e5', margin: '8px 0' }} />}
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
                    💡 {slot.tip}
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
          <div><h2>💡 복용 시 주의사항</h2><p>보고서 기반 식이·기호식품 가이드라인</p></div>
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
