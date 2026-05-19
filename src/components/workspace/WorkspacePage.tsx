import { useState, useEffect } from 'react'
import {
  Activity, AlertTriangle, Camera, Check, ChevronRight,
  FileImage, Pill, Plus, ShieldCheck, Sparkles, Trash2
} from 'lucide-react'
import type { AnalysisReport, Medication, ParsedIngredient, Profile, SupplementProduct, Unit } from '../../types'
import { findNutrientByName, nutrients } from '../../features/nutrition/nutritionData'
import { statusLabel } from '../../features/analysis/analysisEngine'
import { createId, getStatusTone, splitList } from '../../lib/utils'
import { saveProfileBundle } from '../../features/profile/profileService'
import { createManualIngredient, parseLabelImage, saveSupplementProduct } from '../../features/supplements/supplementService'
import { supabase } from '../../lib/supabaseClient'
import { MetricCard } from './Shared'

const knownNutrientIds = new Set(nutrients.map((nutrient) => nutrient.id))



export function Dashboard({
  report, supplements, onSupplements, onStart, onAnalyze, confirmedCount, needsReview,
  onSchedule, onChat, onProfile, profileIsSetup,
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
    if (!hasData || supplements.length === 0) return
    supabase.functions.invoke('generate-schedule', {
      body: { supplementIds: supplements.map((s) => s.id) },
    }).then(({ data }) => {
      if (data?.timeline) setTodaySchedule(data.timeline)
    }).catch(() => {}).finally(() => setScheduleLoading(false))
  }, [hasData, supplements])

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
          <section className="panel" style={{ padding: '32px 24px', marginBottom: '24px', background: '#f0f9f6', borderLeft: '4px solid #18ae90' }}>
            <Sparkles size={32} color="#18ae90" style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 850, color: '#0a6e58', margin: '0 0 10px' }}>프로필이 저장되었습니다</h3>
            <p style={{ color: '#3d5550', fontSize: '15px', lineHeight: 1.7, margin: '0 0 20px' }}>
              이제 영양제를 등록하고 분석을 시작할 수 있습니다. 사진, 검색, 수동 입력 중 편한 방법으로 등록하세요.
            </p>
            <button type="button" className="button primary" onClick={onStart} style={{ fontSize: '15px', padding: '12px 28px' }}>
              영양제 등록하기
            </button>
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
                const { error } = await supabase.from('supplement_products').delete().eq('id', s.id)
                if (error) {
                  alert('삭제 중 오류가 발생했습니다: ' + error.message)
                  return
                }
                onSupplements(supplements.filter((item) => item.id !== s.id))
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

export function SupplementWorkspace({
  supplements, onSupplements, onAnalyze,
}: {
  supplements: SupplementProduct[]
  onSupplements: (supplements: SupplementProduct[]) => void
  onAnalyze: () => void
}) {
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

  const canConfirm =
    productName.trim().length > 0 && Number.isFinite(dailyServings) && dailyServings > 0 &&
    draftIngredients.length > 0 &&
    draftIngredients.every((ingredient) =>
      ingredient.standardName.trim().length > 0 && knownNutrientIds.has(ingredient.nutrientId) &&
      ingredient.amount !== null && Number.isFinite(ingredient.amount) && ingredient.amount >= 0 &&
      ingredient.unit !== 'unknown',
    )

  async function parseLabel(file?: File) {
    setParsing(true)
    setParseWarnings([])
    try {
      const parsed = await parseLabelImage(file)
      setImageName(parsed.imageName)
      setLabelImagePath('')
      setDraftIngredients([])
      setLabelImagePath(parsed.labelImagePath)
      if (parsed.productName) setProductName(parsed.productName)
      if (parsed.dailyServingsRecommended) setDailyServings(parsed.dailyServingsRecommended)
      setDraftIngredients(parsed.ingredients)
      setParseWarnings(parsed.warnings)
    } catch (error) {
      setLabelImagePath('')
      setDraftIngredients([])
      setParseWarnings([error instanceof Error ? error.message : '이미지 파싱 실패'])
    } finally {
      setParsing(false)
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
      if (!data?.ingredients || data.ingredients.length === 0) {
        setParseWarnings(['검색 결과에서 성분 정보를 찾을 수 없습니다. 제품명을 다시 확인해주세요.'])
        return
      }
      setProductName(data.productName || searchQuery)
      setBrandName(data.brandName || '')
      setDraftIngredients(data.ingredients.map((ing: ParsedIngredient & { id?: string }) => ({
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
    const supplement: SupplementProduct = {
      id: createId('supplement'), productName, brandName,
      sourceType: labelImagePath ? 'photo' : 'manual',
      dailyServings, intakeTime, imageName,
      ingredients: draftIngredients, confirmed: true,
    }
    try {
      const saved = await saveSupplementProduct(supplement, labelImagePath)
      supplement.id = saved.productId
      setSyncMessage(saved.message)
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
      <section className="panel">
        <div className="section-heading">
          <div><h2>영양제 등록</h2><p>세 가지 방식 중 하나를 선택해 영양제를 등록하세요.</p></div>
        </div>
        
        <div className="registration-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e1e8e5', paddingBottom: '12px' }}>
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
              <FileImage size={28} />
              <strong>{imageName || '성분표 사진 업로드'}</strong>
              <span>{parsing ? 'AI가 성분표를 분석하는 중입니다.' : 'JPG, PNG, WEBP 파일을 선택하면 parse-label 흐름을 실행합니다.'}</span>
              <label className="button ghost">
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
        <div className="table-wrap">
          <table>
            <thead><tr><th>성분명</th><th>함량</th><th>단위</th><th>신뢰도</th><th>상태</th><th></th></tr></thead>
            <tbody>
              {draftIngredients.map((ingredient) => (
                <tr key={ingredient.id}>
                  <td><input value={ingredient.standardName} onChange={(e) => updateIngredient(ingredient.id, { standardName: e.target.value })} /></td>
                  <td><input type="number" value={ingredient.amount ?? ''} onChange={(e) => updateIngredient(ingredient.id, { amount: Number(e.target.value) })} /></td>
                  <td>
                    <select value={ingredient.unit} onChange={(e) => updateIngredient(ingredient.id, { unit: e.target.value as Unit })}>
                      {['mg', 'mcg', 'IU', 'g', 'CFU', 'unknown'].map((unit) => (<option key={unit} value={unit}>{unit}</option>))}
                    </select>
                  </td>
                  <td>{Math.round(ingredient.confidence * 100)}%</td>
                  <td><span className={ingredient.reviewRequired ? 'status-pill warning' : 'status-pill success'}>{ingredient.reviewRequired ? '확인 필요' : '확인됨'}</span></td>
                  <td><button type="button" className="icon-button" aria-label="성분 삭제" onClick={() => setDraftIngredients(draftIngredients.filter((item) => item.id !== ingredient.id))}><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="action-row">
          <button type="button" className="button primary" onClick={confirmSupplement} disabled={!canConfirm}><Check size={16} />검수 완료 및 저장</button>
          <button type="button" className="button secondary" onClick={onAnalyze}>분석 결과 보기</button>
        </div>
      </section>
    </div>
  )
}

export function AnalysisResult({ report, syncMessage, onAnalyze }: { report: AnalysisReport | null; syncMessage: string; onAnalyze: () => void }) {
  const [filter, setFilter] = useState<'all' | 'excess' | 'deficient' | 'duplicates' | 'medication'>('all')
  if (!report) {
    return (
      <section className="panel">
        <div className="section-heading">
            <div><h2>분석 결과</h2><p>저장된 분석 결과를 표시합니다.</p></div>
          <button type="button" className="button primary" onClick={onAnalyze}>분석 실행</button>
        </div>
        {syncMessage ? (
          <div className="notice warning"><AlertTriangle size={16} /><span>{syncMessage}</span></div>
        ) : (
          <p className="muted">분석을 실행하면 결과가 표시됩니다.</p>
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
      <div className="section-heading">
        <div><h2>분석 결과</h2><p>{new Date(report.createdAt).toLocaleString()} 기준 스냅샷</p></div>
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
