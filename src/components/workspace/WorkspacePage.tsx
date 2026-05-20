import { useState, useEffect } from 'react'
import {
  Activity, AlertTriangle, Camera, Check, ChevronRight,
  FileImage, Lock, LogIn, Pill, Plus, ShieldCheck, Sparkles, Trash2
} from 'lucide-react'
import type { AnalysisReport, Medication, ParsedIngredient, Profile, SupplementProduct, Unit } from '../../types'
import { findNutrientByName } from '../../features/nutrition/nutritionData'
import { statusLabel } from '../../features/analysis/analysisEngine'
import { createId, getStatusTone, splitList } from '../../lib/utils'
import { saveProfileBundle } from '../../features/profile/profileService'
import { createManualIngredient, parseLabelImage, saveSupplementProduct, updateSupplementProduct, updateSupplementIngredient, deleteSupplementProduct, refineIngredients } from '../../features/supplements/supplementService'
import { supabase } from '../../lib/supabaseClient'
import { MetricCard } from './Shared'




/**
 * 대시보드 컴포넌트
 * 분석 결과 요약, 등록 제품 목록, 주의 사항, 오늘의 복용 스케줄, 추천 조합을 표시합니다.
 * 프로필이 설정되지 않은 경우 프로필 입력 안내를 먼저 보여줍니다.
 */
export function Dashboard({
  report, supplements, onSupplements, onStart, onAnalyze, confirmedCount, needsReview,
  onSchedule, onChat, onProfile, profileIsSetup,
  profile, medications,
}: {
  report: AnalysisReport
  supplements: SupplementProduct[]
  onSupplements: (supplements: SupplementProduct[]) => void
  onStart: () => void
  onAnalyze: () => void
  confirmedCount: number
  needsReview: number
  onSchedule?: () => void
  onChat?: () => void
  onProfile: () => void
  profileIsSetup: boolean
  profile: Profile
  medications: Medication[]
}) {
  const hasData = report.totals.length > 0
  const [userName, setUserName] = useState('사용자')
  const [todaySchedule, setTodaySchedule] = useState<Array<{ time: string; items: string[] }>>([])
  const [scheduleLoading, setScheduleLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const name = data.user.user_metadata?.name || data.user.email?.split('@')[0] || '사용자'
        setUserName(name)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!hasData || supplements.length === 0 || !profile) return
    const requestProfile = {
      gender: profile.gender,
      birthYear: profile.birthYear,
      conditions: profile.conditions
    }
    const requestSupplements = supplements.map((s) => ({
      id: s.id,
      productName: s.productName,
      dailyServings: s.dailyServings,
      ingredients: s.ingredients.map((ing) => ({
        nutrientId: ing.nutrientId,
        standardName: ing.standardName,
        amount: ing.amount,
        unit: ing.unit
      }))
    }))
    const requestMedications = medications.map((m) => ({
      name: m.name,
      memo: m.memo || undefined
    }))
    const requestPreferences = {
      wakeTime: '08:00',
      mealTimes: ['09:00', '13:00', '19:00']
    }

    supabase.functions.invoke('generate-schedule', {
      body: {
        profile: requestProfile,
        supplements: requestSupplements,
        medications: requestMedications,
        preferences: requestPreferences
      },
    }).then(({ data }) => {
      const timelineData = data?.timeline || data?.slots
      if (timelineData) setTodaySchedule(timelineData)
    }).catch(() => {}).finally(() => setScheduleLoading(false))
  }, [hasData, supplements, profile, medications])

  const today = new Date()
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 ${'일월화수목금토'[today.getDay()]}요일`

  const synergies = report.synergyRecommendations.map((s) => ({ combo: s.label, benefit: s.benefit }))

  if (!hasData) {
    return (
      <>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#173c3c', margin: '0 0 6px' }}>안녕하세요, {userName}님</h2>
          <p style={{ color: '#697771', fontSize: '15px', margin: 0 }}>{dateStr}</p>
        </div>

        {!profileIsSetup ? (
          <section className="panel" style={{ padding: '32px 24px', marginBottom: '24px', background: '#f0f9f6', borderLeft: '4px solid #18ae90' }}>
            <Sparkles size={32} color="#18ae90" style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 850, color: '#0a6e58', margin: '0 0 10px' }}>환영합니다!</h3>
            <p style={{ color: '#3d5550', fontSize: '15px', lineHeight: 1.7, margin: '0 0 20px' }}>
              원활한 분석을 위해 먼저 프로필 정보를 입력해주세요. 성별, 출생연도, 건강 상태에 따라 맞춤형 기준이 적용됩니다.
            </p>
            <button type="button" className="button primary" onClick={onProfile} style={{ fontSize: '15px', padding: '12px 28px' }}>
              프로필 입력하기
            </button>
          </section>
        ) : (
          <section className="panel" style={{ padding: '24px', marginBottom: '24px', background: '#f0f9f6', borderLeft: '4px solid #18ae90', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: '#e0f2ed', width: '48px', height: '48px', borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Sparkles size={24} color="#18ae90" />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '18px', fontWeight: 850, color: '#0a6e58', margin: '0 0 4px' }}>프로필이 성공적으로 저장되었습니다</h3>
              <p style={{ color: '#3d5550', fontSize: '14px', lineHeight: 1.5, margin: 0 }}>
                이제 아래 단계를 따라 영양제를 등록하고 나만의 맞춤 영양 분석을 시작해보세요!
              </p>
            </div>
          </section>
        )}

        <section className="panel" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 850, color: '#173c3c', marginBottom: '8px' }}>3단계로 완성하는 맞춤 분석</h3>
          <p style={{ color: '#52605b', fontSize: '14px', lineHeight: 1.6, maxWidth: '440px', margin: '0 auto 28px' }}>
            다음 단계를 따라 나만의 영양 분석을 시작하세요.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap', marginBottom: '32px' }}>
            {[
              { step: '1', label: '프로필 작성', desc: '성별·연령·건강 상태' },
              { step: '2', label: '영양제 등록', desc: '사진·검색·수동 입력' },
              { step: '3', label: '분석 시작', desc: '과다·부족·상호작용' },
            ].map((s) => (
              <div key={s.step} style={{ textAlign: 'center', minWidth: '120px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: s.step === '1' && profileIsSetup ? '#b8d9cd' : '#18ae90', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '18px', marginBottom: '10px' }}>
                  {s.step === '1' && profileIsSetup ? <Check size={20} /> : s.step}
                </div>
                <strong style={{ display: 'block', fontSize: '14px', color: '#173c3c' }}>{s.label}</strong>
                <small style={{ color: '#8a9a95', fontSize: '12px' }}>{s.desc}</small>
              </div>
            ))}
          </div>
          <button type="button" className="button primary" onClick={profileIsSetup ? onStart : onProfile}>
            {profileIsSetup ? '영양제 등록하기' : '프로필 입력하기'}
          </button>
        </section>
      </>
    )
  }

  return (
    <>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#173c3c', margin: '0 0 6px' }}>안녕하세요, {userName}님</h2>
        <p style={{ color: '#697771', fontSize: '15px', margin: 0 }}>{dateStr}</p>
      </div>

      <section className="status-grid" aria-label="요약 상태" style={{ marginBottom: '24px' }}>
        <MetricCard label="확정 영양제" value={`${confirmedCount}개`} tone="success" icon={<Pill size={20} />} />
        <MetricCard label="확인 필요 성분" value={`${needsReview}개`} tone={needsReview ? 'warning' : 'success'} icon={<AlertTriangle size={20} />} />
        <MetricCard label="과다/초과" value={`${report.statusSummary.caution + report.statusSummary.excess}개`} tone="danger" icon={<Activity size={20} />} />
        <MetricCard label="약물/질환 주의" value={`${report.interactionWarnings.length}개`} tone="warning" icon={<ShieldCheck size={20} />} />
      </section>

      {/* 프리미엄 영양 성분 섭취 시각화 그래프 */}
      <section className="nutrient-dashboard-chart" style={{ marginBottom: '24px' }}>
        <h3>
          <Activity size={20} color="#18ae90" />
          실시간 영양 성분 섭취 현황
        </h3>
        <div className="nutrient-chart-container">
          {report.totals.map((total) => {
            const targetVal = total.reference?.rda || total.reference?.ai
            const percent = targetVal ? Math.round((total.totalAmount / targetVal) * 100) : 0
            const displayPercent = Math.min(percent, 100) // 100% 게이지 한도

            let statusClass = 'bar-normal'
            if (total.status === 'deficient') statusClass = 'bar-deficient'
            else if (total.status === 'caution') statusClass = 'bar-caution'
            else if (total.status === 'excess') statusClass = 'bar-excess'

            return (
              <article className="nutrient-chart-card" key={total.nutrientId}>
                <div className="nutrient-chart-header">
                  <span className="nutrient-chart-name">{total.standardName}</span>
                  <span className="nutrient-chart-value">
                    {Math.round(total.totalAmount * 10) / 10}{total.unit}
                    {percent > 0 && ` (${percent}%)`}
                  </span>
                </div>
                <div className="nutrient-chart-bar-outer">
                  <div
                    className={`nutrient-chart-bar-inner ${statusClass}`}
                    style={{ width: `${displayPercent}%` }}
                  />
                </div>
                <div className="nutrient-chart-footer">
                  <span>0%</span>
                  {targetVal ? (
                    <span>목표: {targetVal}{total.unit}</span>
                  ) : (
                    <span>-</span>
                  )}
                  {total.reference?.ul ? (
                    <span style={{ color: '#ff7875' }}>상한: {total.reference.ul}{total.unit}</span>
                  ) : (
                    <span>-</span>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <div className="panel-grid two">
        <section className="panel wide">
          <div className="section-heading">
            <div><h2>영양 성분 현황</h2><p>성분별 섭취 상태를 한눈에 확인하세요.</p></div>
            <button type="button" className="button primary" onClick={onAnalyze}>분석 실행<ChevronRight size={16} /></button>
          </div>
          <div className="risk-board">
            {report.totals.filter((t) => t.status !== 'normal').slice(0, 4).map((total) => (
              <article className={`risk-row ${getStatusTone(total.status)}`} key={total.nutrientId}>
                <div><strong>{total.standardName}</strong><span>{Math.round(total.totalAmount * 100) / 100}{total.unit}</span></div>
                <span className="status-pill">{statusLabel(total.status)}</span>
                <p>{total.message}</p>
              </article>
            ))}
            {report.totals.filter((t) => t.status !== 'normal').length === 0 && (
              <div className="empty-state" style={{ padding: '24px' }}><Check size={26} /><h3>모든 성분이 적정 수준입니다</h3></div>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="section-heading">
            <div><h2>등록 제품</h2><p>{supplements.length}개 등록됨</p></div>
            <button type="button" className="button ghost" onClick={onStart}><Plus size={16} />등록</button>
          </div>
          <div className="product-list">
            {supplements.map((s) => {
              async function handleDelete() {
                if (!window.confirm('정말 삭제하시겠습니까?')) return
                try {
                  await deleteSupplementProduct(s.id)
                  onSupplements(supplements.filter((item) => item.id !== s.id))
                } catch (error) {
                  alert(error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.')
                }
              }
              return (
                <article className="product-row" key={s.id}>
                  <div><strong>{s.productName}</strong><span>{s.ingredients.length}개 성분 · {s.brandName || '일반'}</span></div>
                  <span className={s.confirmed ? 'status-pill success' : 'status-pill warning'}>{s.confirmed ? '확정' : '검수 전'}</span>
                  <button type="button" className="icon-button" aria-label={`${s.productName} 삭제`} onClick={handleDelete}>
                    <Trash2 size={16} />
                  </button>
                </article>
              )
            })}
          </div>
        </section>
      </div>

      {report.interactionWarnings.length > 0 && (
        <section className="panel" style={{ marginTop: '24px' }}>
          <div className="section-heading"><div><h2>주의 사항</h2><p>약물/영양소 상호작용 경고</p></div></div>
          <div className="risk-board">
            {report.interactionWarnings.slice(0, 3).map((w) => (
              <article className={`risk-row ${getStatusTone(w.severity)}`} key={`${w.nutrientName}-${w.message}`}>
                <div><strong>{w.nutrientName}</strong><span className="status-pill">{w.severity === 'high' ? '[금기]' : '[주의]'}</span></div>
                <p>{w.message}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="panel-grid two" style={{ marginTop: '24px' }}>
        <section className="panel">
          <div className="section-heading">
            <div><h2>📅 오늘의 복용</h2><p>시간약리학 기반 타임라인</p></div>
            {onSchedule && <button type="button" className="button ghost" onClick={onSchedule}>전체 보기<ChevronRight size={16} /></button>}
          </div>
          {scheduleLoading ? (
            <p style={{ color: '#8a9a95', padding: '12px 0', fontSize: '14px' }}>오늘의 복용 스케줄을 생성하고 있습니다...</p>
          ) : todaySchedule.length === 0 ? (
            <p style={{ color: '#8a9a95', padding: '12px 0', fontSize: '14px' }}>스케줄을 아직 생성하지 못했어요. 분석을 먼저 실행해보세요.</p>
          ) : todaySchedule.map((slot, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: idx < todaySchedule.length - 1 ? '1px solid #f0f4f2' : 'none' }}>
              <span style={{ minWidth: '80px', color: '#18ae90', fontWeight: 800, fontSize: '13px' }}>{slot.time}</span>
              <span style={{ color: '#1a2c28', fontSize: '14px' }}>{slot.items.join(', ')}</span>
            </div>
          ))}
        </section>
        <section className="panel">
          <div className="section-heading">
            <div><h2>추천 조합</h2><p>시너지 효과가 높은 조합</p></div>
            {onChat && <button type="button" className="button ghost" onClick={onChat}>AI에게 물어보기<ChevronRight size={16} /></button>}
          </div>
          {synergies.length === 0 ? (
            <p style={{ color: '#8a9a95', padding: '12px 0', fontSize: '14px' }}>아직 발견된 시너지 조합이 없어요. 영양제를 더 등록해보세요.</p>
          ) : synergies.map((s, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: idx < synergies.length - 1 ? '1px solid #f0f4f2' : 'none' }}>
              <strong style={{ minWidth: '140px', color: '#173c3c', fontSize: '14px' }}>{s.combo}</strong>
              <span style={{ color: '#52605b', fontSize: '13px' }}>{s.benefit}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}

/**
 * 프로필 및 약물 관리 컴포넌트
 * 기본 정보(성별, 연령, 체중 등), 건강 상태(기저질환, 알레르기, 식이 제한),
 * 복용 약물 목록을 편집하고 Supabase에 저장합니다.
 */
export function ProfileAndMedication({
  profile, medications, onProfile, onMedications,
}: {
  profile: Profile
  medications: Medication[]
  onProfile: (profile: Profile) => void
  onMedications: (medications: Medication[]) => void
}) {
  const [draftMedication, setDraftMedication] = useState<Medication>({
    id: '', name: '', purpose: '', frequency: '', memo: '',
  })
  const [syncMessage, setSyncMessage] = useState('')

  function addMedication() {
    if (!draftMedication.name.trim()) return
    onMedications([...medications, { ...draftMedication, id: createId('med') }])
    setDraftMedication({ id: '', name: '', purpose: '', frequency: '', memo: '' })
  }

  async function saveProfileToSupabase() {
    setSyncMessage('')
    try {
      setSyncMessage(await saveProfileBundle(profile, medications))
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : '저장에 실패했습니다.')
    }
  }

  return (
    <div className="panel-grid two">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>기본 정보</h2>
            <p>기준 섭취량 비교에 사용됩니다.</p>
          </div>
          <button type="button" className="button primary" onClick={saveProfileToSupabase}>저장</button>
        </div>
        <div className="form-grid">
          <label>성별
            <select value={profile.gender} onChange={(e) => onProfile({ ...profile, gender: e.target.value as Profile['gender'] })}>
              <option value="female">여성</option>
              <option value="male">남성</option>
              <option value="other">기타/미입력</option>
            </select>
          </label>
          <label>출생연도
            <input type="number" value={profile.birthYear} onChange={(e) => onProfile({ ...profile, birthYear: Number(e.target.value) })} />
          </label>
          <label>키(cm)
            <input type="number" value={profile.heightCm ?? ''} onChange={(e) => onProfile({ ...profile, heightCm: Number(e.target.value) })} />
          </label>
          <label>몸무게(kg)
            <input type="number" value={profile.weightKg ?? ''} onChange={(e) => onProfile({ ...profile, weightKg: Number(e.target.value) })} />
          </label>
          <label>임신/계획
            <select value={profile.pregnancyStatus} onChange={(e) => onProfile({ ...profile, pregnancyStatus: e.target.value as Profile['pregnancyStatus'] })}>
              <option value="none">해당 없음</option>
              <option value="pregnant">임신 중</option>
              <option value="planning">계획 중</option>
              <option value="unknown">모름</option>
            </select>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={profile.lactationStatus} onChange={(e) => onProfile({ ...profile, lactationStatus: e.target.checked })} />수유 중
          </label>
          <label className="full">기저질환
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
              {['고혈압', '당뇨', '고지혈증', '신장질환', '갑상선질환', '골다공증', '간질환', '빈혈', '심부정맥', '천식', '관절염', '우울증', '불면증', '위궤양', '통풍'].map((c) => {
                const active = profile.conditions.includes(c)
                return (
                  <button key={c} type="button" onClick={() => {
                    const next = active ? profile.conditions.filter((x) => x !== c) : [...profile.conditions, c]
                    onProfile({ ...profile, conditions: next })
                  }} style={{
                    padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 750, cursor: 'pointer',
                    border: active ? '1px solid #18ae90' : '1px solid #e1e8e5',
                    background: active ? '#e6f9f4' : '#fff', color: active ? '#0a6e58' : '#52605b',
                  }}>
                    {active ? '✓ ' : ''}{c}
                  </button>
                )
              })}
            </div>
            <input placeholder="기타 질환 직접 입력 (쉼표 구분)" value={profile.conditions.filter((c) => !['고혈압','당뇨','고지혈증','신장질환','갑상선질환','골다공증','간질환','빈혈','심부정맥','천식','관절염','우울증','불면증','위궤양','통풍'].includes(c)).join(', ')} onChange={(e) => {
              const presets = profile.conditions.filter((c) => ['고혈압','당뇨','고지혈증','신장질환','갑상선질환','골다공증','간질환','빈혈','심부정맥','천식','관절염','우울증','불면증','위궤양','통풍'].includes(c))
              onProfile({ ...profile, conditions: [...presets, ...splitList(e.target.value)] })
            }} style={{ marginTop: '8px' }} />
          </label>
          <label className="full">알레르기
            <input value={profile.allergies.join(', ')} onChange={(e) => onProfile({ ...profile, allergies: splitList(e.target.value) })} />
          </label>
          <label className="full">식이 제한
            <input placeholder="예: vegan, 저염식" value={profile.dietaryRestrictions.join(', ')} onChange={(e) => onProfile({ ...profile, dietaryRestrictions: splitList(e.target.value) })} />
          </label>
          <label className="check-row full">
            <input type="checkbox" checked={profile.consentAccepted} onChange={(e) => onProfile({ ...profile, consentAccepted: e.target.checked })} />민감 정보 수집 및 AI 분석 한계 안내를 확인했습니다.
          </label>
        </div>
        {syncMessage && (
          <div className="notice"><Check size={16} /><span>{syncMessage}</span></div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>복용 약</h2>
            <p>룰 기반 주의 메시지에 사용됩니다.</p>
          </div>
        </div>
        <div className="form-grid medication-form">
          <input placeholder="약명: 와파린, 메트포르민, 레보티록신 등" value={draftMedication.name} onChange={(e) => setDraftMedication({ ...draftMedication, name: e.target.value })} />
          <input placeholder="복용 목적" value={draftMedication.purpose} onChange={(e) => setDraftMedication({ ...draftMedication, purpose: e.target.value })} />
          <input placeholder="복용 빈도" value={draftMedication.frequency} onChange={(e) => setDraftMedication({ ...draftMedication, frequency: e.target.value })} />
          <input placeholder="메모" value={draftMedication.memo} onChange={(e) => setDraftMedication({ ...draftMedication, memo: e.target.value })} />
          <button type="button" className="button primary full" onClick={addMedication}>
            <Plus size={16} />약 추가
          </button>
        </div>
        <div className="product-list">
          {medications.length === 0 && <p className="muted">나중에 입력해도 됩니다.</p>}
          {medications.map((medication) => (
            <article className="product-row" key={medication.id}>
              <div>
                <strong>{medication.name}</strong>
                <span>{[medication.purpose, medication.frequency].filter(Boolean).join(' · ') || '메모 없음'}</span>
              </div>
              <button type="button" className="icon-button" aria-label={`${medication.name} 삭제`} onClick={() => onMedications(medications.filter((item) => item.id !== medication.id))}>
                <Trash2 size={16} />
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

/**
 * 영양제 등록 워크스페이스 컴포넌트
 *
 * 세 가지 등록 방식을 지원합니다:
 * 1. 사진 촬영/업로드 → OpenAI Vision으로 성분표 파싱
 * 2. 제품명 검색 → Exa.ai API로 웹 검색
 * 3. 수동 입력 → 직접 성분명/함량/단위 입력
 *
 * 등록 전 성분 검수(표준명 매칭, 단위 확인, 신뢰도 평가)를 수행하고
 * refine-ingredients Edge Function을 통해 성분 정보를 보강합니다.
 */
export function SupplementWorkspace({
  supplements, onSupplements, onAnalyze, sessionEmail,
}: {
  supplements: SupplementProduct[]
  onSupplements: (supplements: SupplementProduct[]) => void
  onAnalyze: () => void
  sessionEmail: string
}) {
  const [parsingStep, setParsingStep] = useState('')
  const [registrationMethod, setRegistrationMethod] = useState<'photo' | 'search' | 'manual'>('photo')
  const [searchQuery, setSearchQuery] = useState('')
  const [productName, setProductName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [dailyServings, setDailyServings] = useState(1)
  const [intakeTime, setIntakeTime] = useState('아침 식후')
  const [imageName, setImageName] = useState('')
  const [labelImagePath, setLabelImagePath] = useState('')
  const [parseWarnings, setParseWarnings] = useState<string[]>([])
  const [syncMessage, setSyncMessage] = useState('')
  const [parsing, setParsing] = useState(false)
  const [draftIngredients, setDraftIngredients] = useState<ParsedIngredient[]>([])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editProductName, setEditProductName] = useState('')
  const [editBrandName, setEditBrandName] = useState('')
  const [editDailyServings, setEditDailyServings] = useState(1)
  const [editIntakeTime, setEditIntakeTime] = useState('')
  const [editIngredients, setEditIngredients] = useState<ParsedIngredient[]>([])
  const [editMessage, setEditMessage] = useState('')

  const canConfirm =
    productName.trim().length > 0 && Number.isFinite(dailyServings) && dailyServings > 0 &&
    draftIngredients.length > 0 &&
    draftIngredients.every((ingredient) =>
      ingredient.standardName.trim().length > 0 &&
      ingredient.amount !== null && Number.isFinite(ingredient.amount) && ingredient.amount >= 0 &&
      ingredient.unit !== 'unknown',
    )

  function startEdit(supplement: SupplementProduct) {
    setEditingId(supplement.id)
    setEditProductName(supplement.productName)
    setEditBrandName(supplement.brandName)
    setEditDailyServings(supplement.dailyServings)
    setEditIntakeTime(supplement.intakeTime)
    setEditIngredients(supplement.ingredients.map((ing) => ({ ...ing })))
    setEditMessage('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditMessage('')
  }

  function updateEditIngredient(id: string, patch: Partial<ParsedIngredient>) {
    setEditIngredients((items) =>
      items.map((item) => {
        if (item.id !== id) return item
        const standardName = patch.standardName ?? item.standardName
        const nutrient = findNutrientByName(standardName)
        return {
          ...item, ...patch,
          nutrientId: nutrient?.id ?? '',
          standardName: nutrient?.standardName ?? standardName,
          reviewRequired: !nutrient || (patch.confidence ?? item.confidence) < 0.8 || (patch.unit ?? item.unit) === 'unknown',
        }
      }),
    )
  }

  async function saveEdit() {
    if (!editingId) return
    setEditMessage('')
    try {
      await updateSupplementProduct(editingId, {
        productName: editProductName,
        brandName: editBrandName,
        dailyServings: editDailyServings,
        intakeTime: editIntakeTime,
      })
      for (const ing of editIngredients) {
        await updateSupplementIngredient(ing.id, {
          standardName: ing.standardName,
          amount: ing.amount ?? 0,
          unit: ing.unit,
        })
      }
      const updated = supplements.map((s) =>
        s.id === editingId
          ? { ...s, productName: editProductName, brandName: editBrandName, dailyServings: editDailyServings, intakeTime: editIntakeTime, ingredients: editIngredients }
          : s,
      )
      onSupplements(updated)
      setEditMessage('수정이 완료되었습니다.')
      setEditingId(null)
    } catch (error) {
      setEditMessage(error instanceof Error ? error.message : '수정에 실패했습니다.')
    }
  }

  async function handleDeleteSupplement(productId: string, name: string) {
    if (!window.confirm(`'${name}'을(를) 정말 삭제하시겠습니까?`)) return
    try {
      await deleteSupplementProduct(productId)
      onSupplements(supplements.filter((s) => s.id !== productId))
    } catch (error) {
      alert(error instanceof Error ? error.message : '삭제에 실패했습니다.')
    }
  }

  async function parseLabel(file?: File) {
    if (!sessionEmail) {
      setParseWarnings(['로그인 후 이용할 수 있는 기능입니다. 상단 메뉴에서 로그인해주세요.'])
      return
    }
    setParsing(true)
    setParsingStep('준비 중...')
    setParseWarnings([])
    try {
      const parsed = await parseLabelImage(file, (step) => {
        if (step === 'converting') setParsingStep('HEIC 이미지 변환 중...')
        else if (step === 'uploading') setParsingStep('이미지 업로드 중...')
        else if (step === 'parsing') setParsingStep('AI가 성분을 추출 중...')
      })
      setParsingStep('정제 완료!')
      setImageName(parsed.imageName)
      setLabelImagePath('')
      setDraftIngredients([])
      setLabelImagePath(parsed.labelImagePath)
      if (parsed.productName) setProductName(parsed.productName)
      if (parsed.dailyServingsRecommended) setDailyServings(parsed.dailyServingsRecommended)

      const autoFixedIngredients = parsed.ingredients.map((ing) => {
        const fixed = { ...ing }
        if (fixed.amount === null || fixed.amount === undefined) {
          fixed.amount = 0
          fixed.reviewRequired = true
        }
        if (fixed.unit === 'unknown') {
          fixed.unit = 'mg'
          fixed.reviewRequired = true
        }
        if (!fixed.standardName?.trim()) {
          fixed.standardName = fixed.rawName || '성분명 미확인'
          fixed.reviewRequired = true
        }
        return fixed
      })

      const autoFixedCount = autoFixedIngredients.filter(
        (ing, idx) => ing.amount !== parsed.ingredients[idx]?.amount || ing.unit !== parsed.ingredients[idx]?.unit
      ).length

      setDraftIngredients(autoFixedIngredients)
      const warnings = [...parsed.warnings]
      if (autoFixedCount > 0) {
        warnings.unshift(`${autoFixedCount}개 성분의 함량/단위가 자동 보정되었습니다. 검수 후 저장해주세요.`)
      }
      setParseWarnings(warnings)
    } catch (error) {
      setLabelImagePath('')
      setDraftIngredients([])
      setParseWarnings([error instanceof Error ? error.message : '이미지 파싱 실패'])
    } finally {
      setParsing(false)
      setTimeout(() => setParsingStep(''), 2000)
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setParsing(true)
    setParseWarnings([])
    setSyncMessage('')
    try {
      const { data, error } = await supabase.functions.invoke('exa-search', {
        body: { query: searchQuery },
      })
      if (error) throw new Error(error.message || '검색 중 오류가 발생했습니다.')
      const product = data?.products?.[0]
      if (!product || !product.ingredients || product.ingredients.length === 0) {
        setParseWarnings(['검색 결과에서 성분 정보를 찾을 수 없습니다. 제품명을 다시 확인해주세요.'])
        return
      }
      setProductName(product.name || searchQuery)
      setBrandName(product.brand || '')
      setDraftIngredients(product.ingredients.map((ing: ParsedIngredient & { id?: string }) => ({
        ...ing,
        id: ing.id || createId('ing'),
        confidence: ing.confidence ?? 0.7,
        reviewRequired: ing.reviewRequired ?? true,
      })))
    } catch (error) {
      setParseWarnings([error instanceof Error ? error.message : '검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'])
    } finally {
      setParsing(false)
    }
  }

  function updateIngredient(id: string, patch: Partial<ParsedIngredient>) {
    setDraftIngredients((items) =>
      items.map((item) => {
        if (item.id !== id) return item
        const standardName = patch.standardName ?? item.standardName
        const nutrient = findNutrientByName(standardName)
        return {
          ...item, ...patch,
          nutrientId: nutrient?.id ?? '',
          standardName: nutrient?.standardName ?? standardName,
          reviewRequired: !nutrient || (patch.confidence ?? item.confidence) < 0.8 || (patch.unit ?? item.unit) === 'unknown',
        }
      }),
    )
  }

  function addManualIngredient() {
    setDraftIngredients([...draftIngredients, createManualIngredient()])
  }

  async function confirmSupplement() {
    setSyncMessage('')
    if (!canConfirm) {
      setSyncMessage('제품명, 1일 복용 횟수, 등록 가능한 표준 성분명, 함량, 단위를 모두 확인해야 저장할 수 있습니다.')
      return
    }

    setSyncMessage('영양성분을 정제하고 있습니다...')
    let finalIngredients = draftIngredients

    try {
      const refined = await refineIngredients(
        productName,
        brandName,
        draftIngredients.map((ing) => ({
          name: ing.standardName || ing.rawName,
          amount: ing.amount,
          unit: ing.unit,
        })),
      )
      if (refined.ingredients && refined.ingredients.length > 0) {
        finalIngredients = refined.ingredients.map((ing) => ({
          ...ing,
          id: ing.id || createId('ingredient'),
        }))
        setDraftIngredients(finalIngredients)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : ''
      if (msg.includes('일일 API 호출 한도')) {
        setSyncMessage(msg)
        return
      }
      // LLM refine failed, continue with original ingredients
    }

    const supplement: SupplementProduct = {
      id: createId('supplement'), productName, brandName,
      sourceType: labelImagePath ? 'photo' : 'manual',
      dailyServings, intakeTime, imageName,
      ingredients: finalIngredients, confirmed: true,
    }
    try {
      const saved = await saveSupplementProduct(supplement, labelImagePath)
      supplement.id = saved.productId
      setSyncMessage('저장되었습니다.')
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : '저장에 실패했습니다.')
      return
    }
    onSupplements([...supplements, supplement])
    setProductName('')
    setBrandName('')
    setImageName('')
    setLabelImagePath('')
    setDailyServings(1)
    setDraftIngredients([])
  }

  return (
    <div className="panel-grid">
      {supplements.length > 0 && (
        <section className="panel">
          <div className="section-heading">
            <div><h2>등록된 영양제</h2><p>{supplements.length}개 등록됨</p></div>
          </div>
          <div className="product-list">
            {supplements.map((s) => (
              <article className="product-row" key={s.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
                {editingId === s.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="form-grid">
                      <label>제품명<input value={editProductName} onChange={(e) => setEditProductName(e.target.value)} /></label>
                      <label>브랜드<input value={editBrandName} onChange={(e) => setEditBrandName(e.target.value)} /></label>
                      <label>1일 복용 횟수<input type="number" min="0.25" step="0.25" value={editDailyServings} onChange={(e) => setEditDailyServings(Number(e.target.value))} /></label>
                      <label>복용 시간<input value={editIntakeTime} onChange={(e) => setEditIntakeTime(e.target.value)} /></label>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>성분명</th><th>함량</th><th>단위</th><th></th></tr></thead>
                        <tbody>
                          {editIngredients.map((ing) => (
                            <tr key={ing.id}>
                              <td><input value={ing.standardName} onChange={(e) => updateEditIngredient(ing.id, { standardName: e.target.value })} /></td>
                              <td><input type="number" value={ing.amount ?? ''} onChange={(e) => updateEditIngredient(ing.id, { amount: Number(e.target.value) })} /></td>
                              <td>
                                <select value={ing.unit} onChange={(e) => updateEditIngredient(ing.id, { unit: e.target.value as Unit })}>
                                  {['mg', 'mcg', 'IU', 'g', 'CFU', 'unknown'].map((u) => (<option key={u} value={u}>{u}</option>))}
                                </select>
                              </td>
                              <td><button type="button" className="icon-button" aria-label="성분 삭제" onClick={() => setEditIngredients(editIngredients.filter((item) => item.id !== ing.id))}><Trash2 size={16} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" className="button primary" onClick={saveEdit}><Check size={16} />저장</button>
                      <button type="button" className="button ghost" onClick={cancelEdit}>취소</button>
                    </div>
                    {editMessage && <div className="notice"><Check size={16} /><span>{editMessage}</span></div>}
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <strong>{s.productName}</strong>
                        <span style={{ marginLeft: '8px', color: '#8a9a95', fontSize: '13px' }}>{s.ingredients.length}개 성분 · {s.brandName || '일반'} · {s.dailyServings}회/일 · {s.intakeTime}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button type="button" className="icon-button" aria-label={`${s.productName} 수정`} onClick={() => startEdit(s)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                        </button>
                        <button type="button" className="icon-button" aria-label={`${s.productName} 삭제`} onClick={() => handleDeleteSupplement(s.id, s.productName)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    {s.ingredients.some((ing) => ing.benefit || ing.recommendedDaily || ing.caution) && (
                      <div style={{ marginTop: '12px', borderTop: '1px solid #f0f4f2', paddingTop: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#173c3c', marginBottom: '8px' }}>성분 정보</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {s.ingredients.filter((ing) => ing.benefit || ing.recommendedDaily || ing.caution).map((ing) => (
                            <div key={ing.id} style={{ background: '#f8fafa', padding: '8px 12px', borderRadius: '8px', fontSize: '12px' }}>
                              <div style={{ fontWeight: 700, color: '#173c3c', marginBottom: '4px' }}>{ing.standardName} <span style={{ color: '#8a9a95', fontWeight: 400 }}>{ing.amount}{ing.unit}</span></div>
                              {ing.benefit && <div style={{ color: '#3d5550', marginBottom: '2px' }}><span style={{ color: '#18ae90', fontWeight: 600 }}>효능:</span> {ing.benefit}</div>}
                              {ing.recommendedDaily && <div style={{ color: '#3d5550', marginBottom: '2px' }}><span style={{ color: '#18ae90', fontWeight: 600 }}>권장 섭취량:</span> {ing.recommendedDaily}</div>}
                              {ing.caution && <div style={{ color: '#c5392f' }}><span style={{ fontWeight: 600 }}>주의:</span> {ing.caution}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="section-heading">
          <div><h2>영양제 등록</h2><p>세 가지 방식 중 하나를 선택해 영양제를 등록하세요.</p></div>
        </div>
        
        <div className="registration-tabs">
          <button type="button" className={`button ${registrationMethod === 'photo' ? 'primary' : 'ghost'}`} onClick={() => setRegistrationMethod('photo')}>
            <FileImage size={16} /> 사진 촬영/업로드
          </button>
          <button type="button" className={`button ${registrationMethod === 'search' ? 'primary' : 'ghost'}`} onClick={() => setRegistrationMethod('search')}>
            <Sparkles size={16} /> 제품명 검색 (Exa.ai)
          </button>
          <button type="button" className={`button ${registrationMethod === 'manual' ? 'primary' : 'ghost'}`} onClick={() => setRegistrationMethod('manual')}>
            <Plus size={16} /> 수동 입력
          </button>
        </div>

        <div className="supplement-layout">
          {registrationMethod === 'photo' && (
            <div className="upload-zone">
              {!sessionEmail && (
                <div className="login-lock-banner">
                  <Lock size={18} />
                  <span>로그인 후 이용할 수 있는 기능입니다</span>
                </div>
              )}
              <FileImage size={28} />
              <strong>{imageName || '성분표 사진 업로드'}</strong>
              <span>
                {parsing
                  ? (parsingStep || 'AI가 성분표를 분석하는 중입니다.')
                  : 'JPG, PNG, WEBP, HEIC 파일을 선택하면 AI가 자동으로 성분을 추출합니다.'}
              </span>
              {parsing && parsingStep && (
                <div className="parsing-step-indicator">
                  <div className="parsing-step-spinner" />
                  <span>{parsingStep}</span>
                </div>
              )}
              <label className={`button ghost ${!sessionEmail ? 'disabled-upload' : ''}`}>
                <Camera size={16} />파일 선택
                <input hidden type="file" accept="image/jpeg,image/png,image/webp,.heic,.heif" onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) parseLabel(file)
                }} />
              </label>
            </div>
          )}
          
          {registrationMethod === 'search' && (
            <div className="upload-zone" style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <input 
                type="text" 
                placeholder="영양제 브랜드명이나 제품명을 검색하세요" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, maxWidth: '400px' }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button type="button" className="button primary" onClick={handleSearch} disabled={parsing}>
                {parsing ? '검색 중...' : '검색'}
              </button>
            </div>
          )}

          {registrationMethod === 'manual' && (
            <div className="upload-zone">
              <strong>직접 정보 입력</strong>
              <span>아래 폼에 제품 정보를 직접 입력하고 수동으로 성분을 추가하세요.</span>
            </div>
          )}

          <div className="form-grid">
            <label>제품명<input placeholder="제품명을 입력하거나 성분표를 업로드하세요" value={productName} onChange={(e) => setProductName(e.target.value)} /></label>
            <label>브랜드<input placeholder="브랜드명" value={brandName} onChange={(e) => setBrandName(e.target.value)} /></label>
            <label>1일 복용 횟수<input type="number" min="0.25" step="0.25" value={dailyServings} onChange={(e) => setDailyServings(Number(e.target.value))} /></label>
            <label>복용 시간<input value={intakeTime} onChange={(e) => setIntakeTime(e.target.value)} /></label>
          </div>
        </div>
        {parseWarnings.length > 0 && (
          <div className="notice warning"><AlertTriangle size={16} /><span>{parseWarnings.join(' ')}</span></div>
        )}
        {syncMessage && (
          <div className="notice"><Check size={16} /><span>{syncMessage}</span></div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div><h2>성분 검수</h2><p>신뢰도 낮음 또는 단위 불명은 노란색으로 표시됩니다.</p></div>
          <button type="button" className="button ghost" onClick={addManualIngredient}><Plus size={16} />수동 성분</button>
        </div>
        <div className="table-wrap med-review-table">
          <table>
            <thead><tr><th>성분명</th><th>함량</th><th>단위</th><th>신뢰도</th><th>상태</th><th></th></tr></thead>
            <tbody>
              {draftIngredients.map((ingredient) => (
                <tr key={ingredient.id} data-label-name={ingredient.standardName || ingredient.rawName}>
                  <td data-label="성분명"><input value={ingredient.standardName} onChange={(e) => updateIngredient(ingredient.id, { standardName: e.target.value })} /></td>
                  <td data-label="함량"><input type="number" value={ingredient.amount ?? ''} onChange={(e) => updateIngredient(ingredient.id, { amount: Number(e.target.value) })} /></td>
                  <td data-label="단위">
                    <select value={ingredient.unit} onChange={(e) => updateIngredient(ingredient.id, { unit: e.target.value as Unit })}>
                      {['mg', 'mcg', 'IU', 'g', 'CFU', 'unknown'].map((unit) => (<option key={unit} value={unit}>{unit}</option>))}
                    </select>
                  </td>
                  <td data-label="신뢰도">{Math.round(ingredient.confidence * 100)}%</td>
                  <td data-label="상태"><span className={ingredient.reviewRequired ? 'status-pill warning' : 'status-pill success'}>{ingredient.reviewRequired ? '확인 필요' : '확인됨'}</span></td>
                  <td data-label=""><button type="button" className="icon-button" aria-label="성분 삭제" onClick={() => setDraftIngredients(draftIngredients.filter((item) => item.id !== ingredient.id))}><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* 통합 액션 허브 카드 */}
        <div className="review-action-hub">
          <div className="action-hub-header">
            <h3>
              <Sparkles size={18} color="#18ae90" />
              영양제 검수 완료 및 맞춤 건강 분석
            </h3>
            <p>성분 검수가 완료되면 아래 버튼을 눌러 저장하고, 실시간 종합 분석 결과를 즉시 확인해보세요!</p>
          </div>
          <div className="action-hub-buttons">
            <button
              type="button"
              className="button primary"
              onClick={confirmSupplement}
              disabled={!canConfirm}
              style={{ fontSize: '14px', padding: '0 24px', minHeight: '44px' }}
            >
              <Check size={18} />
              검수 완료 및 저장
            </button>
            <button
              type="button"
              className="button secondary-action"
              onClick={onAnalyze}
              style={{ fontSize: '14px', padding: '0 24px', minHeight: '44px' }}
            >
              <Activity size={18} />
              실시간 분석 결과 보기
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

/**
 * 분석 결과 컴포넌트
 * 영양소별 상태, 약물 상호작용 경고, 복용량 조정 후보를 탭과 필터로 표시합니다.
 * 분석이 실행되지 않은 경우 실행 버튼을 표시합니다.
 */
export function AnalysisResult({ report, syncMessage, onAnalyze, isLocalFallback, sessionEmail, onLogin }: {
  report: AnalysisReport | null
  syncMessage: string
  onAnalyze: () => void
  isLocalFallback?: boolean
  sessionEmail?: string
  onLogin?: () => void
}) {
  const [filter, setFilter] = useState<'all' | 'excess' | 'deficient' | 'duplicates' | 'medication'>('all')
  if (!report || report.totals.length === 0) {
    return (
      <section className="panel">
        <div className="section-heading">
            <div><h2>분석 결과</h2><p>저장된 분석 결과를 표시합니다.</p></div>
          <button type="button" className="button primary" onClick={onAnalyze}>분석 실행</button>
        </div>
        {syncMessage ? (
          <div className="notice warning"><AlertTriangle size={16} /><span>{syncMessage}</span></div>
        ) : (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <p style={{ color: '#697771', fontSize: '15px', marginBottom: '12px' }}>
              {!report ? '분석을 실행하면 결과가 여기에 표시됩니다.' : '등록된 영양제의 성분 정보를 분석한 결과입니다.'}
            </p>
            <button type="button" className="button primary" onClick={onAnalyze}>분석 실행하기</button>
          </div>
        )}
      </section>
    )
  }

  const filteredTotals = report.totals.filter((total) => {
    if (filter === 'all') return true
    if (filter === 'duplicates') return total.sourceProducts.length >= 2
    if (filter === 'medication') return false
    return total.status === filter || (filter === 'excess' && total.status === 'caution')
  })

  return (
    <section className="panel">
      {isLocalFallback && (
        <div className="local-fallback-banner">
          <div className="fallback-banner-content">
            <Sparkles size={18} />
            <div>
              <strong>로컬 분석 결과입니다</strong>
              <p>{!sessionEmail ? '로그인하면 분석 결과를 서버에 안전하게 저장할 수 있습니다.' : '서버 연결에 실패했지만, 로컬 분석 엔진으로 결과를 생성했습니다.'}</p>
            </div>
          </div>
          {!sessionEmail && onLogin && (
            <button type="button" className="button primary fallback-login-btn" onClick={onLogin}>
              <LogIn size={16} />로그인하기
            </button>
          )}
        </div>
      )}
      <div className="section-heading">
        <div><h2>분석 결과</h2><p>{new Date(report.createdAt).toLocaleString()} 기준 {isLocalFallback ? '로컬 분석' : '스냅샷'}</p></div>
        <button type="button" className="button primary" onClick={onAnalyze}>재분석</button>
      </div>
      {syncMessage && (
        <div className="notice"><Check size={16} /><span>{syncMessage}</span></div>
      )}
      <div className="tabs">
        {[['all', '전체'], ['excess', '과다/초과'], ['deficient', '부족 가능'], ['duplicates', '중복'], ['medication', '약물 주의']].map(([id, label]) => (
          <button key={id} type="button" className={filter === id ? 'active' : ''} onClick={() => setFilter(id as typeof filter)}>{label}</button>
        ))}
      </div>
      {filter === 'medication' ? (
        <div className="risk-board">
          {report.interactionWarnings.length === 0 && <p className="muted">등록된 약/질환 기준 주의 메시지가 없습니다.</p>}
          {report.interactionWarnings.map((warning) => (
            <article className={`risk-row ${getStatusTone(warning.severity)}`} key={`${warning.nutrientName}-${warning.message}`}>
              <div><strong>{warning.nutrientName}</strong><span>{warning.severity}</span></div>
              <p>{warning.message}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="analysis-list">
          {filteredTotals.length === 0 && <p className="muted">해당하는 성분이 없습니다.</p>}
          {filteredTotals.map((total) => (
            <article className={`analysis-item ${getStatusTone(total.status)}`} key={total.nutrientId}>
              <div className="analysis-main">
                <strong>{total.standardName}</strong>
                <span>{Math.round(total.totalAmount * 100) / 100}{total.unit}</span>
                <span className="status-pill">{statusLabel(total.status)}</span>
              </div>
              <p>{total.message}</p>
              <div className="breakdown">
                {total.sourceProducts.map((source) => (
                  <span key={`${total.nutrientId}-${source.productId}`}>{source.productName}: {Math.round(source.amount * 100) / 100}{source.unit}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="recommendation-panel">
        <h3>복용량 조정 후보</h3>
        {report.recommendations.length === 0 && <p className="muted">현재 등록 정보에서는 별도 조정 후보가 없습니다.</p>}
        {report.recommendations.map((recommendation) => (
          <article key={`${recommendation.title}-${recommendation.detail}`}>
            <strong>{recommendation.title}</strong>
            <p>{recommendation.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
