import { useState } from 'react'
import {
  Activity, AlertTriangle, ArrowLeft, Camera, Check, ChevronRight,
  ClipboardList, FileImage, Pill, Plus, ShieldCheck, Sparkles, Trash2, User
} from 'lucide-react'
import type { AnalysisReport, Medication, ParsedIngredient, Profile, SupplementProduct, Unit } from '../../types'
import { findNutrientByName, nutrients } from '../../features/nutrition/nutritionData'
import { statusLabel } from '../../features/analysis/analysisEngine'
import { createId, getStatusTone, splitList } from '../../lib/utils'
import { saveProfileBundle } from '../../features/profile/profileService'
import { createManualIngredient, parseLabelImage, saveSupplementProduct } from '../../features/supplements/supplementService'
import { AuthPanel } from '../auth/AuthPanel'
import { MetricCard, LegalNotice } from './Shared'

const knownNutrientIds = new Set(nutrients.map((nutrient) => nutrient.id))
type WorkspaceTab = 'overview' | 'profile' | 'supplements' | 'analysis'

export function WorkspacePage({
  sessionEmail, onSessionEmail, onBackHome, activeTab, onTabChange,
  confirmedCount, needsReview, previewReport, profile, medications, supplements,
  report, analysisSyncMessage, onProfile, onMedications, onSupplements, onAnalyze,
}: {
  sessionEmail: string | null
  onSessionEmail: (email: string | null) => void
  onBackHome: () => void
  activeTab: WorkspaceTab
  onTabChange: (tab: WorkspaceTab) => void
  confirmedCount: number
  needsReview: number
  previewReport: AnalysisReport
  profile: Profile
  medications: Medication[]
  supplements: SupplementProduct[]
  report: AnalysisReport | null
  analysisSyncMessage: string
  onProfile: (profile: Profile) => void
  onMedications: (medications: Medication[]) => void
  onSupplements: (supplements: SupplementProduct[]) => void
  onAnalyze: () => void
}) {
  const tabs = [
    ['overview', '대시보드', Activity],
    ['profile', '내 정보', User],
    ['supplements', '성분 분석', Pill],
    ['analysis', '복용 관리', ClipboardList],
  ] as const

  return (
    <section className="workspace-page" aria-label="tt-ni 작업공간">
      <header className="workspace-page-header">
        <button type="button" className="login-back-button" onClick={onBackHome}>
          <ArrowLeft size={18} />
          홈으로
        </button>
        <a className="logo-lockup" href="/" onClick={(event) => {
          event.preventDefault()
          onBackHome()
        }} aria-label="tt-ni 홈">
          <img src="/tt-ni-logo.svg" alt="+-ni" />
        </a>
      </header>

      <section id="analysis-workspace" className="workspace-dock workspace-page-dock open" aria-label="분석 작업공간">
        <div className="workspace-dock-header">
          <div>
            <span>tt-ni 작업공간</span>
            <h2>사진 업로드부터 분석 결과까지 바로 이어서 진행하세요.</h2>
          </div>
          <AuthPanel sessionEmail={sessionEmail} onSessionEmail={onSessionEmail} />
        </div>

        <nav className="dock-tabs" aria-label="분석 기능">
          {tabs.map(([id, label, Icon]) => (
            <button
              className={activeTab === id ? 'dock-tab active' : 'dock-tab'}
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <section className="status-grid" aria-label="요약 상태">
          <MetricCard label="확정 영양제" value={`${confirmedCount}개`} tone="success" icon={<Pill size={20} />} />
          <MetricCard label="확인 필요 성분" value={`${needsReview}개`} tone={needsReview ? 'warning' : 'success'} icon={<AlertTriangle size={20} />} />
          <MetricCard label="과다/초과" value={`${previewReport.statusSummary.caution + previewReport.statusSummary.excess}개`} tone="danger" icon={<Activity size={20} />} />
          <MetricCard label="약물/질환 주의" value={`${previewReport.interactionWarnings.length}개`} tone="warning" icon={<ShieldCheck size={20} />} />
        </section>

        {activeTab === 'overview' && (
          <Dashboard
            report={previewReport}
            supplements={supplements}
            onStart={() => onTabChange('supplements')}
            onAnalyze={onAnalyze}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileAndMedication profile={profile} medications={medications} onProfile={onProfile} onMedications={onMedications} />
        )}
        {activeTab === 'supplements' && (
          <SupplementWorkspace supplements={supplements} onSupplements={onSupplements} onAnalyze={onAnalyze} />
        )}
        {activeTab === 'analysis' && <AnalysisResult report={report} syncMessage={analysisSyncMessage} onAnalyze={onAnalyze} />}

        <LegalNotice />
      </section>
    </section>
  )
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action: () => void }) {
  return (
    <div className="empty-state">
      <Sparkles size={26} />
      <h3>{title}</h3>
      <p>{detail}</p>
      <button type="button" className="button primary" onClick={action}>
        영양제 등록
      </button>
    </div>
  )
}

export function Dashboard({
  report, supplements, onStart, onAnalyze,
}: {
  report: AnalysisReport
  supplements: SupplementProduct[]
  onStart: () => void
  onAnalyze: () => void
}) {
  const hasData = report.totals.length > 0

  return (
    <div className="panel-grid two">
      <section className="panel wide">
        <div className="section-heading">
          <div>
            <h2>영양 성분 현황</h2>
            <p>{hasData ? '성분별 섭취 상태를 한눈에 확인하세요.' : '영양제를 등록하고 분석을 실행해보세요.'}</p>
          </div>
          {hasData && (
            <button type="button" className="button primary" onClick={onAnalyze}>
              분석 실행
              <ChevronRight size={16} />
            </button>
          )}
        </div>
        <div className="risk-board">
          {!hasData ? (
            <EmptyState title="아직 확정된 성분이 없습니다." detail="성분표 사진을 올리거나 수동으로 성분을 입력해 주세요." action={onStart} />
          ) : (
            <>
              {report.totals
                .filter((total) => total.status !== 'normal')
                .slice(0, 4)
                .map((total) => (
                  <article className={`risk-row ${getStatusTone(total.status)}`} key={total.nutrientId}>
                    <div>
                      <strong>{total.standardName}</strong>
                      <span>{Math.round(total.totalAmount * 100) / 100}{total.unit}</span>
                    </div>
                    <span className="status-pill">{statusLabel(total.status)}</span>
                    <p>{total.message}</p>
                  </article>
                ))}
              {report.totals.filter((total) => total.status !== 'normal').length === 0 && (
                <div className="empty-state" style={{ padding: '24px' }}>
                  <Check size={26} />
                  <h3>모든 성분이 적정 수준입니다</h3>
                  <p>현재 등록된 영양제 기준으로 과다·부족 신호가 없습니다.</p>
                </div>
              )}
            </>
          )}
        </div>
        {hasData && (
          <div style={{ marginTop: '16px', textAlign: 'right' }}>
            <button type="button" className="button ghost" onClick={() => onAnalyze()}>
              전체 분석 보기
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>등록 제품</h2>
            <p>{supplements.length ? `${supplements.length}개 등록됨` : '검수 완료 여부'}</p>
          </div>
          <button type="button" className="button ghost" onClick={onStart}>
            <Plus size={16} />
            등록
          </button>
        </div>
        <div className="product-list">
          {supplements.length === 0 && <p className="muted">등록된 영양제가 없습니다.</p>}
          {supplements.map((supplement) => (
            <article className="product-row" key={supplement.id}>
              <div>
                <strong>{supplement.productName}</strong>
                <span>{supplement.ingredients.length}개 성분 · {supplement.brandName || '일반'}</span>
              </div>
              <span className={supplement.confirmed ? 'status-pill success' : 'status-pill warning'}>
                {supplement.confirmed ? '확정' : '검수 전'}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
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
      setSyncMessage(error instanceof Error ? error.message : 'Supabase 저장에 실패했습니다.')
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
            <input placeholder="예: kidney, 신장, 당뇨" value={profile.conditions.join(', ')} onChange={(e) => onProfile({ ...profile, conditions: splitList(e.target.value) })} />
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
          <input placeholder="약명: warfarin, levothyroxine" value={draftMedication.name} onChange={(e) => setDraftMedication({ ...draftMedication, name: e.target.value })} />
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
      setSyncMessage(error instanceof Error ? error.message : 'Supabase 저장에 실패했습니다.')
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
          <div><h2>영양제 등록</h2><p>사진 업로드 후 추출값을 수정하고 확정하세요.</p></div>
        </div>
        <div className="supplement-layout">
          <div className="upload-zone">
            <FileImage size={28} />
            <strong>{imageName || '성분표 사진 업로드'}</strong>
            <span>{parsing ? 'AI가 성분표를 분석하는 중입니다.' : 'JPG, PNG, WEBP 파일을 선택하면 parse-label 흐름을 실행합니다.'}</span>
            <label className="button ghost">
              <Camera size={16} />파일 선택
              <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) parseLabel(file)
              }} />
            </label>
          </div>
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
          <div><h2>분석 결과</h2><p>Supabase에 저장된 분석 리포트만 결과로 표시합니다.</p></div>
          <button type="button" className="button primary" onClick={onAnalyze}>분석 실행</button>
        </div>
        {syncMessage ? (
          <div className="notice warning"><AlertTriangle size={16} /><span>{syncMessage}</span></div>
        ) : (
          <p className="muted">분석을 실행하면 원격 Edge Function 저장이 성공한 뒤 결과가 표시됩니다.</p>
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
