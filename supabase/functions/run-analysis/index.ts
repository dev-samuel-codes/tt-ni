import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getCorsHeaders, jsonResponse } from '../_shared/cors.ts'
import { getServiceKey } from '../_shared/serviceKey.ts'

interface Ingredient {
  nutrientId: string
  standardName: string
  amount: number | null
  unit: 'mg' | 'mcg' | 'IU' | 'g' | 'CFU' | 'unknown'
}

interface Profile {
  gender: 'female' | 'male' | 'other'
  birthYear: number
  conditions: string[]
}

interface Medication {
  name: string
  memo?: string
}

interface Supplement {
  id: string
  productName: string
  dailyServings: number
  ingredients: Ingredient[]
  confirmed: boolean
}

type RiskStatus = 'normal' | 'deficient' | 'caution' | 'excess' | 'review'

interface Reference {
  nutrientId: string
  gender: Profile['gender'] | 'any'
  ageMin: number
  ageMax: number
  target?: number
  ul?: number
  unit: Ingredient['unit']
}

interface InteractionRule {
  nutrientId: string
  medicationKeyword?: string
  conditionCode?: string
  severity: 'notice' | 'caution' | 'high'
  nutrientName: string
  message: string
  sourceNote: string
}

/**
 * 데이터베이스에서 nutrients.default_unit을 로드합니다.
 * DB 조회 실패 시 하드코딩된 폴백 값을 사용합니다.
 */
async function loadDefaultUnits(supabase: ReturnType<typeof createClient>): Promise<Record<string, Ingredient['unit']>> {
  const fallback: Record<string, Ingredient['unit']> = {
    vitamin_a: 'mcg', vitamin_b1: 'mg', vitamin_b6: 'mg', vitamin_b12: 'mcg',
    vitamin_c: 'mg', vitamin_d: 'mcg', vitamin_e: 'mg', vitamin_k: 'mcg',
    calcium: 'mg', magnesium: 'mg', zinc: 'mg', iron: 'mg', omega3: 'mg',
    choline: 'mg', ginseng: 'mg', grapefruit: 'mg', coq10: 'mg', probiotics: 'CFU',
  }
  try {
    const { data } = await supabase.from('nutrients').select('id, default_unit')
    if (!data?.length) return fallback
    const units: Record<string, Ingredient['unit']> = { ...fallback }
    for (const row of data) {
      if (row.default_unit && !units[row.id]) {
        units[row.id] = row.default_unit as Ingredient['unit']
      }
    }
    return units
  } catch {
    return fallback
  }
}

/**
 * 데이터베이스에서 nutrient_reference_values를 로드합니다.
 * DB 조회 실패 시 하드코딩된 폴백 값을 사용합니다.
 */
async function loadReferences(supabase: ReturnType<typeof createClient>): Promise<Reference[]> {
  const fallback: Reference[] = [
    { nutrientId: 'vitamin_a', gender: 'male', ageMin: 19, ageMax: 150, target: 900, ul: 3000, unit: 'mcg' },
    { nutrientId: 'vitamin_a', gender: 'female', ageMin: 19, ageMax: 150, target: 700, ul: 3000, unit: 'mcg' },
    { nutrientId: 'vitamin_b1', gender: 'male', ageMin: 19, ageMax: 150, target: 1.2, unit: 'mg' },
    { nutrientId: 'vitamin_b1', gender: 'female', ageMin: 19, ageMax: 150, target: 1.1, unit: 'mg' },
    { nutrientId: 'vitamin_b6', gender: 'any', ageMin: 19, ageMax: 50, target: 1.3, ul: 100, unit: 'mg' },
    { nutrientId: 'vitamin_b6', gender: 'any', ageMin: 51, ageMax: 150, target: 1.5, ul: 100, unit: 'mg' },
    { nutrientId: 'vitamin_b12', gender: 'any', ageMin: 19, ageMax: 150, target: 2.4, unit: 'mcg' },
    { nutrientId: 'vitamin_c', gender: 'male', ageMin: 19, ageMax: 150, target: 90, ul: 2000, unit: 'mg' },
    { nutrientId: 'vitamin_c', gender: 'female', ageMin: 19, ageMax: 150, target: 75, ul: 2000, unit: 'mg' },
    { nutrientId: 'vitamin_d', gender: 'any', ageMin: 19, ageMax: 70, target: 15, ul: 100, unit: 'mcg' },
    { nutrientId: 'vitamin_d', gender: 'any', ageMin: 71, ageMax: 150, target: 20, ul: 100, unit: 'mcg' },
    { nutrientId: 'vitamin_e', gender: 'any', ageMin: 19, ageMax: 150, target: 15, ul: 1000, unit: 'mg' },
    { nutrientId: 'vitamin_k', gender: 'male', ageMin: 19, ageMax: 150, target: 120, unit: 'mcg' },
    { nutrientId: 'vitamin_k', gender: 'female', ageMin: 19, ageMax: 150, target: 90, unit: 'mcg' },
    { nutrientId: 'calcium', gender: 'any', ageMin: 19, ageMax: 50, target: 1000, ul: 2500, unit: 'mg' },
    { nutrientId: 'calcium', gender: 'any', ageMin: 51, ageMax: 150, target: 1200, ul: 2000, unit: 'mg' },
    { nutrientId: 'magnesium', gender: 'male', ageMin: 19, ageMax: 150, target: 420, ul: 3500, unit: 'mg' },
    { nutrientId: 'magnesium', gender: 'female', ageMin: 19, ageMax: 150, target: 320, ul: 3500, unit: 'mg' },
    { nutrientId: 'zinc', gender: 'male', ageMin: 19, ageMax: 150, target: 11, ul: 40, unit: 'mg' },
    { nutrientId: 'zinc', gender: 'female', ageMin: 19, ageMax: 150, target: 8, ul: 40, unit: 'mg' },
    { nutrientId: 'iron', gender: 'male', ageMin: 19, ageMax: 150, target: 8, ul: 45, unit: 'mg' },
    { nutrientId: 'iron', gender: 'female', ageMin: 19, ageMax: 50, target: 18, ul: 45, unit: 'mg' },
    { nutrientId: 'iron', gender: 'female', ageMin: 51, ageMax: 150, target: 8, ul: 45, unit: 'mg' },
    { nutrientId: 'omega3', gender: 'any', ageMin: 19, ageMax: 150, target: 1100, unit: 'mg' },
    { nutrientId: 'choline', gender: 'male', ageMin: 19, ageMax: 150, target: 550, ul: 3500, unit: 'mg' },
    { nutrientId: 'choline', gender: 'female', ageMin: 19, ageMax: 150, target: 425, ul: 3500, unit: 'mg' },
    { nutrientId: 'selenium', gender: 'male', ageMin: 19, ageMax: 150, target: 85, ul: 400, unit: 'mcg' },
    { nutrientId: 'selenium', gender: 'female', ageMin: 19, ageMax: 150, target: 75, ul: 400, unit: 'mcg' },
    { nutrientId: 'ginseng', gender: 'any', ageMin: 19, ageMax: 150, unit: 'mg' },
    { nutrientId: 'grapefruit', gender: 'any', ageMin: 19, ageMax: 150, unit: 'mg' },
    { nutrientId: 'coq10', gender: 'any', ageMin: 19, ageMax: 150, unit: 'mg' },
    { nutrientId: 'probiotics', gender: 'any', ageMin: 19, ageMax: 150, unit: 'CFU' },
  ]
  try {
    const { data } = await supabase.from('nutrient_reference_values').select('*')
    if (!data?.length) return fallback
    const dbReferences = data.map((row: Record<string, unknown>) => ({
      nutrientId: row.nutrient_id as string,
      gender: (row.gender as Profile['gender'] | 'any') || 'any',
      ageMin: Number(row.age_min ?? 0),
      ageMax: Number(row.age_max ?? 150),
      target: row.rda != null ? Number(row.rda) : (row.ai != null ? Number(row.ai) : undefined),
      ul: row.ul != null ? Number(row.ul) : undefined,
      unit: (row.unit as Ingredient['unit']) || 'mg',
    }))
    if (dbReferences.length > 0) return [...fallback.filter((f) => !dbReferences.some((d: Reference) => d.nutrientId === f.nutrientId && d.gender === f.gender && d.ageMin === f.ageMin)), ...dbReferences]
    return fallback
  } catch {
    return fallback
  }
}

/**
 * 데이터베이스에서 interaction_rules를 로드합니다.
 * DB 조회 실패 시 하드코딩된 폴백 값을 사용합니다.
 */
async function loadInteractionRules(supabase: ReturnType<typeof createClient>): Promise<InteractionRule[]> {
  const fallback: InteractionRule[] = [
    { nutrientId: 'vitamin_k', medicationKeyword: 'warfarin', severity: 'high', nutrientName: '비타민 K', message: '와파린 계열 약 복용 중에는 비타민 K 섭취 변동을 전문가와 확인하세요.', sourceNote: 'MVP rule: anticoagulant nutrient consistency warning' },
    { nutrientId: 'omega3', medicationKeyword: 'warfarin', severity: 'caution', nutrientName: '오메가3', message: '항응고제 복용 중 고용량 오메가3는 출혈 위험 상담이 필요할 수 있습니다.', sourceNote: 'MVP rule: anticoagulant high-dose omega-3 caution' },
    { nutrientId: 'calcium', medicationKeyword: 'levothyroxine', severity: 'caution', nutrientName: '칼슘', message: '갑상선 호르몬제와 칼슘은 복용 간격을 확인하는 것이 좋습니다.', sourceNote: 'MVP rule: thyroid medication spacing' },
    { nutrientId: 'iron', medicationKeyword: 'levothyroxine', severity: 'caution', nutrientName: '철분', message: '갑상선 호르몬제와 철분은 흡수 간섭 가능성이 있어 복용 간격 확인이 필요합니다.', sourceNote: 'MVP rule: thyroid medication spacing' },
    { nutrientId: 'magnesium', conditionCode: 'kidney', severity: 'high', nutrientName: '마그네슘', message: '신장 질환이 있으면 마그네슘 보충제 복용 전 전문가 상담이 필요합니다.', sourceNote: 'MVP rule: renal condition mineral caution' },
    { nutrientId: 'ginseng', medicationKeyword: 'insulin', severity: 'high', nutrientName: '홍삼', message: '인슐린/당뇨약 복용 중 홍삼(진세노사이드) 고용량 섭취는 중증 저혈당 쇼크 위험이 있습니다.', sourceNote: 'Report: Ginsenoside insulin sensitivity amplification' },
    { nutrientId: 'grapefruit', medicationKeyword: 'statin', severity: 'high', nutrientName: '자몽 추출물', message: '스타틴 계열 고지혈증 약 복용 중 자몽 추출물 섭취는 절대 금기입니다 (횡문근융해증 위험).', sourceNote: 'Report: CYP3A4 inhibition by furanocoumarin' },
    { nutrientId: 'vitamin_b12', medicationKeyword: 'metformin', severity: 'notice', nutrientName: '비타민 B12', message: '메트포르민 장기 복용자는 비타민 B12 결핍 위험이 있으므로 정기적 혈중 농도 확인과 보충을 권장합니다.', sourceNote: 'Report: Metformin induces B12 depletion' },
    { nutrientId: 'coq10', medicationKeyword: 'statin', severity: 'notice', nutrientName: '코엔자임 Q10', message: '스타틴 계열 약물은 체내 코엔자임 Q10을 고갈시키므로 병용 섭취가 권장됩니다.', sourceNote: 'Report: Statin induces CoQ10 depletion' },
    { nutrientId: 'probiotics', medicationKeyword: 'antibiotic', severity: 'high', nutrientName: '유산균', message: '항생제 복용 시 유산균이 사멸하므로 최소 2시간 이상의 간격을 두고 섭취하세요.', sourceNote: 'Report: Antibiotics destroy probiotics' },
    { nutrientId: 'calcium', medicationKeyword: 'bisphosphonate', severity: 'high', nutrientName: '칼슘', message: '골다공증 약(비스포스포네이트)과 칼슘은 킬레이트를 형성하므로 최소 2시간 간격을 두고 복용하세요.', sourceNote: 'Report: Bisphosphonate chelation with calcium' },
    { nutrientId: 'vitamin_c', medicationKeyword: 'aspirin', severity: 'high', nutrientName: '비타민 C', message: '아스피린 복용 중 고용량 비타민 C는 위장관 출혈 위험을 높일 수 있으므로 중성화된 비타민 C를 권장하거나 식후 복용하세요.', sourceNote: 'Report: Aspirin + high-dose vitamin C GI bleeding risk' },
    { nutrientId: 'ginseng', medicationKeyword: 'warfarin', severity: 'high', nutrientName: '홍삼', message: '와파린 복용 중 홍삼(진세노사이드) 섭취는 출혈 위험을 높일 수 있으므로 주의가 필요합니다.', sourceNote: 'Report: Ginseng antiplatelet effect with warfarin' },
    { nutrientId: 'vitamin_e', medicationKeyword: 'warfarin', severity: 'caution', nutrientName: '비타민 E', message: '와파린 복용 중 고용량 비타민 E는 혈소판 응집을 억제하여 출혈 위험을 증가시킬 수 있습니다.', sourceNote: 'Report: Vitamin E antiplatelet with warfarin' },
    { nutrientId: 'magnesium', medicationKeyword: 'bisphosphonate', severity: 'high', nutrientName: '마그네슘', message: '골다공증 약(비스포스포네이트)과 마그네슘은 킬레이트 형성을 방지하기 위해 2시간 이상 간격을 두세요.', sourceNote: 'Report: Bisphosphonate chelation' },
  ]
  try {
    const { data } = await supabase.from('interaction_rules').select('*')
    if (!data?.length) return fallback
    const dbRules = (data as Array<Record<string, unknown>>).map((row) => {
      const nutrientRow = row.nutrient_id ? { standardName: '' } as { standard_name?: string } : null
      let nutrientName = ''
      if (nutrientRow?.standard_name) nutrientName = nutrientRow.standard_name
      return {
        nutrientId: (row.nutrient_id as string) || '',
        medicationKeyword: (row.medication_keyword as string) || undefined,
        conditionCode: (row.condition_code as string) || undefined,
        severity: (row.severity as InteractionRule['severity']) || 'notice',
        nutrientName,
        message: (row.message as string) || '',
        sourceNote: (row.source_note as string) || '',
      }
    })
    const enriched = await enrichNutrientNames(supabase, dbRules)
    if (enriched.length > 0) return enriched
    return fallback
  } catch {
    return fallback
  }
}

/** DB interation_rules의 nutrient_id를 기준으로 nutrients.standard_name을 조회하여 nutrientName을 채웁니다. */
async function enrichNutrientNames(supabase: ReturnType<typeof createClient>, rules: InteractionRule[]): Promise<InteractionRule[]> {
  try {
    const { data } = await supabase.from('nutrients').select('id, standard_name')
    if (!data?.length) return rules
    const nameMap = new Map((data as Array<{ id: string; standard_name: string }>).map((r) => [r.id, r.standard_name]))
    return rules.map((rule) => ({
      ...rule,
      nutrientName: rule.nutrientName || nameMap.get(rule.nutrientId) || rule.nutrientId,
    }))
  } catch {
    return rules
  }
}

/** DB에서 synergy_groups를 로드합니다. 실패 시 하드코딩 폴백을 사용합니다. */
async function loadSynergyGroups(supabase: ReturnType<typeof createClient>) {
  const fallback = [
    { nutrients: ['coq10', 'omega3'], label: 'CoQ10 + 오메가3', benefit: '혈관 내피세포 건강과 항산화 네트워크가 강화되어 심혈관 보호 효과가 배가됩니다.' },
    { nutrients: ['vitamin_c', 'iron'], label: '비타민 C + 철분', benefit: '비타민 C가 비헴철을 흡수되기 쉬운 환원 상태로 유지시켜 철분 흡수율을 극대화합니다.' },
    { nutrients: ['vitamin_e', 'omega3'], label: '비타민 E + 오메가3', benefit: '오메가3의 이중 결합이 활성산소에 의해 산화되는 것을 비타민 E가 방어합니다.' },
    { nutrients: ['vitamin_c', 'collagen'], label: '비타민 C + 콜라겐', benefit: '비타민 C는 콜라겐 합성의 필수 조효소로, 프롤린과 라이신의 수산화 반응을 촉진합니다.' },
    { nutrients: ['vitamin_e', 'coq10'], label: '비타민 E + CoQ10', benefit: '지용성 항산화제인 비타민 E와 미토콘드리아 항산화제인 CoQ10이 이중 항산화 방어벽을 형성합니다.' },
    { nutrients: ['iron', 'vitamin_c', 'selenium'], label: '철분 + 비타민 C + 셀레늄', benefit: '비타민 C가 철분 흡수를 돕고, 셀레늄이 흡수된 철분의 산화를 방지합니다.' },
  ]
  try {
    const { data } = await supabase.from('synergy_groups').select('*')
    if (!data?.length) return fallback
    return (data as Array<{ label: string; nutrient_ids: string[]; benefit: string }>).map((r) => ({
      nutrients: r.nutrient_ids, label: r.label, benefit: r.benefit,
    }))
  } catch { return fallback }
}

/** DB에서 nutrient_antagonism을 로드합니다. 실패 시 하드코딩 폴백을 사용합니다. */
async function loadAntagonismGroups(supabase: ReturnType<typeof createClient>) {
  const fallback = [
    { nutrients: ['calcium', 'iron'], label: '칼슘 ↔ 철분', reason: 'DMT1 수송체를 공유하여 흡수 경쟁이 발생합니다.', minIntervalHours: 2, severity: 'caution' as const },
    { nutrients: ['calcium', 'magnesium'], label: '칼슘 ↔ 마그네슘', reason: '두 다가 양이온이 같은 흡수 채널을 두고 경쟁합니다.', minIntervalHours: 2, severity: 'caution' as const },
    { nutrients: ['calcium', 'zinc'], label: '칼슘 ↔ 아연', reason: '다가 양이온 간 흡수 경쟁으로 인해 아연의 생체이용률이 저하됩니다.', minIntervalHours: 2, severity: 'caution' as const },
    { nutrients: ['iron', 'zinc'], label: '철분 ↔ 아연', reason: 'DMT1 수송체를 공유하여 경쟁적 흡수 억제가 발생합니다.', minIntervalHours: 2, severity: 'caution' as const },
    { nutrients: ['calcium', 'magnesium', 'zinc'], label: '칼슘 ↔ 마그네슘 ↔ 아연', reason: '세 다가 양이온이 동일한 흡수 경로에서 경쟁합니다.', minIntervalHours: 2, severity: 'caution' as const },
  ]
  try {
    const { data } = await supabase.from('nutrient_antagonism').select('*')
    if (!data?.length) return fallback
    return (data as Array<{ label: string; nutrient_ids: string[]; reason: string; min_interval_hours: number; severity: string }>).map((r) => ({
      nutrients: r.nutrient_ids, label: r.label, reason: r.reason, minIntervalHours: r.min_interval_hours, severity: r.severity as 'caution' | 'high',
    }))
  } catch { return fallback }
}

/** 영양소 단위 변환 (프론트엔드 convertAmount와 동일 로직) */
function convert(amount: number, from: Ingredient['unit'], to: Ingredient['unit'], nutrientId: string): number | null {
  if (from === to) return amount
  if (from === 'unknown' || to === 'unknown') return null
  if (from === 'g' && to === 'mg') return amount * 1000
  if (from === 'mg' && to === 'g') return amount / 1000
  if (from === 'mg' && to === 'mcg') return amount * 1000
  if (from === 'mcg' && to === 'mg') return amount / 1000
  if (from === 'g' && to === 'mcg') return amount * 1_000_000
  if (from === 'mcg' && to === 'g') return amount / 1_000_000
  if (nutrientId === 'vitamin_d' && from === 'IU' && to === 'mcg') return amount / 40
  if (nutrientId === 'vitamin_d' && from === 'mcg' && to === 'IU') return amount * 40
  if (nutrientId === 'vitamin_a' && from === 'IU' && to === 'mcg') return amount * 0.3
  if (nutrientId === 'vitamin_a' && from === 'mcg' && to === 'IU') return amount / 0.3
  if (nutrientId === 'vitamin_e' && from === 'IU' && to === 'mg') return amount * 0.67
  if (nutrientId === 'vitamin_e' && from === 'mg' && to === 'IU') return amount / 0.67
  return null
}

function getAge(profile: Profile): number {
  return Math.max(0, new Date().getFullYear() - profile.birthYear)
}

function findReference(references: Reference[], profile: Profile, nutrientId: string): Reference | undefined {
  const age = getAge(profile)
  return references.find((reference) => {
    const genderMatches = reference.gender === 'any' || reference.gender === profile.gender
    return reference.nutrientId === nutrientId && genderMatches && age >= reference.ageMin && age <= reference.ageMax
  })
}

function summarizeStatus(total: number, reference?: Reference): RiskStatus {
  if (!reference) return 'review'
  if (reference.ul && total > reference.ul) return 'excess'
  if (reference.ul && total >= reference.ul * 0.8) return 'caution'
  if (reference.target && total < reference.target * 0.7) return 'deficient'
  return 'normal'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse(req, { error: 'Authorization header is required' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    if (!supabaseUrl) throw new Error('SUPABASE_URL is required')

    const supabase = createClient(supabaseUrl, getServiceKey(), {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) return jsonResponse(req, { error: 'Invalid user session' }, 401)

    const [references, interactionRules, defaultUnits, synergyGroups, antagonismGroups] = await Promise.all([
      loadReferences(supabase),
      loadInteractionRules(supabase),
      loadDefaultUnits(supabase),
      loadSynergyGroups(supabase),
      loadAntagonismGroups(supabase),
    ])

    const { profile, medications = [], supplements } = await req.json() as { profile: Profile; medications?: Medication[]; supplements: Supplement[] }
    const totals = new Map<string, { nutrientId: string; standardName: string; totalAmount: number; unit: Ingredient['unit']; sources: string[] }>()

    supplements.filter((supplement) => supplement.confirmed).forEach((supplement) => {
      supplement.ingredients.forEach((ingredient) => {
        if (ingredient.amount === null) return
        const reference = findReference(references, profile, ingredient.nutrientId)
        const targetUnit = reference?.unit ?? defaultUnits[ingredient.nutrientId] ?? ingredient.unit
        const amount = convert(ingredient.amount * supplement.dailyServings, ingredient.unit, targetUnit, ingredient.nutrientId)
        if (amount === null) return
        const existing = totals.get(ingredient.nutrientId)
        if (existing) {
          existing.totalAmount += amount
          existing.sources.push(supplement.productName)
        } else {
          totals.set(ingredient.nutrientId, {
            nutrientId: ingredient.nutrientId,
            standardName: ingredient.standardName,
            totalAmount: amount,
            unit: targetUnit,
            sources: [supplement.productName],
          })
        }
      })
    })

    const totalNutrients = Array.from(totals.values()).map((item) => {
      const status = summarizeStatus(item.totalAmount, findReference(references, profile, item.nutrientId))
      return { ...item, status }
    })

    const riskItems = totalNutrients.filter((item) => item.status !== 'normal' || item.sources.length > 1)
    const medicationText = medications.map((medication) => `${medication.name} ${medication.memo ?? ''}`.toLowerCase()).join(' ')
    const conditionText = profile.conditions.join(' ').toLowerCase()
    const interactionWarnings = interactionRules
      .filter((rule) => totalNutrients.some((total) => total.nutrientId === rule.nutrientId))
      .filter((rule) => {
        const medicationMatch = rule.medicationKeyword ? medicationText.includes(rule.medicationKeyword.toLowerCase()) : false
        const conditionMatch = rule.conditionCode ? conditionText.includes(rule.conditionCode.toLowerCase()) || conditionText.includes('신장') : false
        return medicationMatch || conditionMatch
      })
      .map((rule) => ({
        severity: rule.severity,
        nutrientName: rule.nutrientName,
        message: rule.message,
        sourceNote: rule.sourceNote,
      }))

    const userNutrientIds = new Set(totalNutrients.map((total) => total.nutrientId))

    const synergyRecommendations = synergyGroups.map((group) => {
      const matched = group.nutrients.filter((id) => userNutrientIds.has(id))
      const missing = group.nutrients.filter((id) => !userNutrientIds.has(id))
      if (matched.length < 1) return null
      if (matched.length === group.nutrients.length) {
        return {
          nutrients: group.nutrients,
          label: group.label,
          benefit: group.benefit,
          matchType: 'full' as const,
          missingNutrients: [] as string[],
          message: `${group.label} 조합을 보유 중입니다. ${group.benefit}`,
        }
      }
      return {
        nutrients: group.nutrients,
        label: group.label,
        benefit: group.benefit,
        matchType: 'partial' as const,
        missingNutrients: missing,
        message: `${group.label} 조합에서 일부 영양소를 보유 중입니다. 함께 섭취하면 ${group.benefit}`,
      }
    }).filter((item): item is NonNullable<typeof item> => item !== null)

    const antagonismWarnings = antagonismGroups
      .filter((group) => group.nutrients.every((id) => userNutrientIds.has(id)))
      .map((group) => ({
        nutrients: group.nutrients,
        label: group.label,
        message: `${group.reason} 최소 ${group.minIntervalHours}시간 이상 간격을 두고 복용하는 것이 좋습니다.`,
        severity: group.severity,
      }))

    const recommendations = riskItems.map((item) => ({
      status: item.sources.length > 1 ? 'duplicate' : item.status,
      title: `${item.standardName} 확인`,
      detail: item.sources.length > 1 ? `${item.sources.join(', ')}에서 중복됩니다.` : '기준치와 비교해 복용량 확인이 필요합니다.',
    })).concat(interactionWarnings.map((warning) => ({
      status: 'medication',
      title: `${warning.nutrientName} 약물/질환 주의`,
      detail: warning.message,
    })))
    const statusSummary = totalNutrients.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1
      return acc
    }, {})

    const { data, error } = await supabase.from('analysis_reports').insert({
      user_id: userData.user.id,
      status_summary: statusSummary,
      total_nutrients_json: totalNutrients,
      risk_items_json: riskItems,
      recommendations_json: recommendations,
      synergy_recommendations_json: synergyRecommendations,
      antagonism_warnings_json: antagonismWarnings,
    }).select('id').single()
    if (error) throw error

    return jsonResponse(req, { analysis_report_id: data.id, summary: statusSummary, totalNutrients, riskItems, interactionWarnings, recommendations, synergyRecommendations, antagonismWarnings })
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected analysis error' }, 500)
  }
})
