import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getCorsHeaders, jsonResponse } from '../_shared/cors.ts'
import { getServiceKey } from '../_shared/serviceKey.ts'

interface Profile {
  gender: string
  birthYear: number
  conditions: string[]
}

interface Ingredient {
  nutrientId: string
  standardName: string
  amount: number | null
  unit: string
}

interface Supplement {
  id: string
  productName: string
  dailyServings: number
  ingredients: Ingredient[]
}

interface Medication {
  name: string
  memo?: string
}

interface Preferences {
  wakeTime?: string
  mealTimes?: string[]
}

interface RequestBody {
  profile: Profile
  supplements: Supplement[]
  medications?: Medication[]
  preferences?: Preferences
}

interface SlotItem {
  time: string
  label: string
  items: string[]
  tip?: string
  warning?: string
}

// ---------------------------------------------------------------------------
// 시간대별 권장 영양소 (DB 우선, 폴백 포함)
// ---------------------------------------------------------------------------

type TimeCategory = 'empty_stomach' | 'after_meal' | 'evening' | 'evening_or_after'

interface AntagonismRule {
  a: string
  b: string
  hours: number
  reason: string
}

async function loadTimingCategories(supabase: ReturnType<typeof createClient>): Promise<Map<string, TimeCategory>> {
  const fallback = new Map<string, TimeCategory>([
    ['probiotics', 'empty_stomach'], ['vitamin_b1', 'empty_stomach'], ['vitamin_b6', 'empty_stomach'],
    ['vitamin_b12', 'empty_stomach'], ['vitamin_c', 'empty_stomach'], ['iron', 'empty_stomach'],
    ['ginseng', 'empty_stomach'], ['choline', 'empty_stomach'],
    ['vitamin_a', 'after_meal'], ['vitamin_d', 'after_meal'], ['vitamin_e', 'after_meal'],
    ['vitamin_k', 'after_meal'], ['omega3', 'after_meal'], ['coq10', 'after_meal'],
    ['calcium', 'evening'], ['magnesium', 'evening'], ['zinc', 'evening_or_after'],
  ])
  try {
    const { data } = await supabase.from('nutrient_timing').select('nutrient_id, time_category, priority')
      .order('priority', { ascending: false })
    if (!data?.length) return fallback
    const result = new Map<string, TimeCategory>()
    for (const row of data as Array<{ nutrient_id: string; time_category: string }>) {
      if (!result.has(row.nutrient_id)) {
        result.set(row.nutrient_id, row.time_category as TimeCategory)
      }
    }
    return result.size > 0 ? result : fallback
  } catch { return fallback }
}

function getTimingSet(categories: Map<string, TimeCategory>, target: TimeCategory): Set<string> {
  const set = new Set<string>()
  for (const [nutrientId, category] of categories) {
    if (category === target) set.add(nutrientId)
  }
  return set
}

// ---------------------------------------------------------------------------
// 약물 DNI 충돌 규칙 (DB의 interaction_rules + medication_aliases 기반)
// ---------------------------------------------------------------------------

interface DNIRule {
  medicationKeyword: string
  nutrientId: string
  severity: 'warning' | 'block'
  message: string
  tip?: string
}

async function loadDNIRules(supabase: ReturnType<typeof createClient>): Promise<DNIRule[]> {
  const fallback: DNIRule[] = [
    { medicationKeyword: 'warfarin', nutrientId: 'vitamin_k', severity: 'block', message: '와파린 복용 중 비타민 K 섭취 변동에 주의하세요.' },
    { medicationKeyword: 'warfarin', nutrientId: 'omega3', severity: 'warning', message: '항응고제와 오메가3 병용 시 출혈 위험이 있을 수 있습니다.' },
    { medicationKeyword: 'metformin', nutrientId: 'vitamin_b12', severity: 'warning', tip: '메트포르민 장기 복용 시 B12 보충을 권장합니다.', message: '' },
    { medicationKeyword: 'insulin', nutrientId: 'ginseng', severity: 'warning', message: '당뇨약과 홍삼 병용 시 저혈당 위험이 있습니다.' },
    { medicationKeyword: 'statin', nutrientId: 'grapefruit', severity: 'block', message: '스타틴과 자몽은 절대 병용할 수 없습니다.' },
    { medicationKeyword: 'statin', nutrientId: 'coq10', severity: 'warning', tip: '스타틴 복용 시 CoQ10 보충이 권장됩니다.', message: '' },
    { medicationKeyword: 'antibiotic', nutrientId: 'probiotics', severity: 'warning', message: '항생제와 유산균은 2시간 간격을 두고 복용하세요.' },
    { medicationKeyword: 'bisphosphonate', nutrientId: 'calcium', severity: 'warning', message: '골다공증약과 칼슘은 2~4시간 간격을 두세요.' },
    { medicationKeyword: 'bisphosphonate', nutrientId: 'magnesium', severity: 'warning', message: '골다공증약과 마그네슘은 2~4시간 간격을 두세요.' },
    { medicationKeyword: 'bisphosphonate', nutrientId: 'iron', severity: 'warning', message: '골다공증약과 철분은 2~4시간 간격을 두세요.' },
    { medicationKeyword: 'levothyroxine', nutrientId: 'calcium', severity: 'warning', message: '갑상선약과 칼슘은 4시간 간격을 두세요.' },
    { medicationKeyword: 'levothyroxine', nutrientId: 'magnesium', severity: 'warning', message: '갑상선약과 마그네슘은 4시간 간격을 두세요.' },
    { medicationKeyword: 'levothyroxine', nutrientId: 'iron', severity: 'warning', message: '갑상선약과 철분은 4시간 간격을 두세요.' },
  ]
  try {
    const { data } = await supabase.from('interaction_rules').select('*')
    if (!data?.length) return fallback
    return (data as Array<{ nutrient_id: string; medication_keyword: string; severity: string; message: string }>)
      .filter((r) => r.medication_keyword)
      .map((r) => ({
        medicationKeyword: r.medication_keyword,
        nutrientId: r.nutrient_id,
        severity: r.severity === 'high' ? 'block' as const : 'warning' as const,
        message: r.message,
      }))
  } catch { return fallback }
}

async function loadMedicationAliases(supabase: ReturnType<typeof createClient>): Promise<Map<string, string[]>> {
  const fallback = new Map<string, string[]>([
    ['warfarin', ['warfarin', '와파린', '쿠마딘', '항응고']],
    ['metformin', ['metformin', '메트포르민', '글루코파지']],
    ['insulin', ['insulin', '인슐린']],
    ['statin', ['statin', '스타틴', '로수바스타틴', '아토르바스타틴', '심바스타틴', '프라바스타틴', '피타바스타틴']],
    ['antibiotic', ['antibiotic', '항생제', '세파', '페니실린', '아목시실린', '독시사이클린', '아지트로마이신', '클래리스로마이신']],
    ['bisphosphonate', ['bisphosphonate', '비스포스포네이트', '알렌드로네이트', '리세드로네이트', '골다공증약']],
    ['levothyroxine', ['levothyroxine', '레보티록신', '씬지로이드', '갑상선']],
    ['aspirin', ['aspirin', '아스피린', '바이엘']],
  ])
  try {
    const { data } = await supabase.from('medication_aliases').select('medication_keyword, alias')
    if (!data?.length) return fallback
    const result = new Map<string, string[]>()
    for (const row of data as Array<{ medication_keyword: string; alias: string }>) {
      if (!result.has(row.medication_keyword)) result.set(row.medication_keyword, [])
      result.get(row.medication_keyword)!.push(row.alias)
    }
    return result.size > 0 ? result : fallback
  } catch { return fallback }
}

function medicationMatchesName(name: string, keyword: string, aliases: Map<string, string[]>): boolean {
  const lower = name.toLowerCase()
  const keywordAliases = aliases.get(keyword) ?? [keyword]
  return keywordAliases.some((a) => lower.includes(a.toLowerCase()))
}

// ---------------------------------------------------------------------------
// 길항작용 쌍 (nutrient_antagonism 테이블 로드)
// ---------------------------------------------------------------------------

async function loadAntagonismRules(supabase: ReturnType<typeof createClient>): Promise<AntagonismRule[]> {
  const fallback: AntagonismRule[] = [
    { a: 'calcium', b: 'iron', hours: 2, reason: 'DMT1 수용체 경쟁으로 인해 칼슘과 철분은 2시간 이상 간격을 두는 것이 좋습니다.' },
    { a: 'calcium', b: 'magnesium', hours: 2, reason: '2가 양이온 간 흡수 경쟁으로 칼슘과 마그네슘은 2시간 이상 간격을 두는 것이 좋습니다.' },
    { a: 'calcium', b: 'zinc', hours: 2, reason: '2가 양이온 간 흡수 경쟁으로 칼슘과 아연은 2시간 이상 간격을 두는 것이 좋습니다.' },
  ]
  try {
    const { data } = await supabase.from('nutrient_antagonism').select('*')
    if (!data?.length) return fallback
    return (data as Array<{ nutrient_ids: string[]; reason: string; min_interval_hours: number }>)
      .filter((r) => r.nutrient_ids.length === 2)
      .map((r) => ({ a: r.nutrient_ids[0], b: r.nutrient_ids[1], hours: r.min_interval_hours, reason: r.reason }))
  } catch { return fallback }
}

// ---------------------------------------------------------------------------
// 위장장애 여부 확인
// ---------------------------------------------------------------------------

function hasGIissues(conditions: string[]): boolean {
  const giKeywords = /위장|위염|속쓰림|소화불량|위궤양|십이지장|과민성대장|역류성식도|소화기/
  return conditions.some((c) => giKeywords.test(c))
}

// ---------------------------------------------------------------------------
// 보충제별 최적 시간대 결정
// ---------------------------------------------------------------------------

function categorizeSupplement(supplement: Supplement, hasGI: boolean, timings: Map<string, TimeCategory>): TimeCategory {
  const nutrientIds = supplement.ingredients.map((ing) => ing.nutrientId)
  const MORNING = getTimingSet(timings, 'empty_stomach')
  const AFTER = getTimingSet(timings, 'after_meal')
  const EVE = getTimingSet(timings, 'evening')
  const EVE_OR_AFTER = getTimingSet(timings, 'evening_or_after')

  const hasFatSoluble = nutrientIds.some((id) => AFTER.has(id) && !EVE.has(id))
  const hasEvening = nutrientIds.some((id) => EVE.has(id))
  const hasEveningOrAfter = nutrientIds.some((id) => EVE_OR_AFTER.has(id))
  const hasEmptyStomach = nutrientIds.some((id) => MORNING.has(id))

  if (nutrientIds.includes('grapefruit')) return 'after_meal'

  if (hasFatSoluble) {
    if (hasEvening) return 'evening'
    return 'after_meal'
  }

  if (hasEvening) return 'evening'

  if (hasEmptyStomach) {
    const hasIron = nutrientIds.includes('iron')
    if (hasIron && hasGI) return 'after_meal'
    return 'empty_stomach'
  }

  if (hasEveningOrAfter) return 'evening'

  return 'after_meal'
}

// ---------------------------------------------------------------------------
// 시간 슬롯 정의
// ---------------------------------------------------------------------------

interface TimeSlot {
  key: string
  time: string
  label: string
  category: TimeCategory
}

function buildSlots(preferences?: Preferences): TimeSlot[] {
  const wakeTime = preferences?.wakeTime ?? '07:00'
  const meals = preferences?.mealTimes ?? ['08:00', '12:30', '19:00']

  const addMinutes = (time: string, minutes: number): string => {
    const [h, m] = time.split(':').map(Number)
    const total = h * 60 + m + minutes
    const newH = Math.floor(total / 60) % 24
    const newM = total % 60
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
  }

  return [
    { key: 'wake', time: wakeTime, label: '기상 직후 (공복)', category: 'empty_stomach' },
    { key: 'breakfast', time: addMinutes(meals[0], 30), label: '아침 식후', category: 'after_meal' },
    { key: 'lunch', time: addMinutes(meals[1], 30), label: '점심 식후', category: 'after_meal' },
    { key: 'dinner', time: addMinutes(meals[2], 30), label: '저녁 식후', category: 'evening' },
    { key: 'bedtime', time: addMinutes(meals[2], 180), label: '취침 전', category: 'evening' },
  ]
}

// ---------------------------------------------------------------------------
// 시간 차이 계산 (분 단위)
// ---------------------------------------------------------------------------

function timeDiffMinutes(a: string, b: string): number {
  const parseMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  return Math.abs(parseMin(a) - parseMin(b))
}

// ---------------------------------------------------------------------------
// DNI 분석
// ---------------------------------------------------------------------------

interface Conflict {
  type: 'dni_warning' | 'dni_block' | 'antagonism'
  supplementId: string
  supplementName: string
  nutrientId: string
  nutrientName: string
  message: string
  tip?: string
  severity: 'warning' | 'block'
}

function analyzeDNI(supplements: Supplement[], medications: Medication[], rules: DNIRule[], aliases: Map<string, string[]>): Conflict[] {
  const conflicts: Conflict[] = []

  for (const med of medications) {
    const medText = `${med.name} ${med.memo ?? ''}`

    for (const rule of rules) {
      if (!medicationMatchesName(medText, rule.medicationKeyword, aliases)) continue

      for (const supp of supplements) {
        const matched = supp.ingredients.find((ing) => ing.nutrientId === rule.nutrientId)
        if (!matched) continue

        conflicts.push({
          type: rule.severity === 'block' ? 'dni_block' : 'dni_warning',
          supplementId: supp.id,
          supplementName: supp.productName,
          nutrientId: matched.nutrientId,
          nutrientName: matched.standardName,
          message: rule.message,
          tip: rule.tip,
          severity: rule.severity,
        })
      }
    }
  }

  return conflicts
}

// ---------------------------------------------------------------------------
// 길항작용 분석
// ---------------------------------------------------------------------------

function analyzeAntagonism(supplements: Supplement[], slotAssignments: Map<string, TimeCategory>, rules: AntagonismRule[]): Conflict[] {
  const conflicts: Conflict[] = []

  for (const rule of rules) {
    const suppA = supplements.filter((s) => s.ingredients.some((ing) => ing.nutrientId === rule.a))
    const suppB = supplements.filter((s) => s.ingredients.some((ing) => ing.nutrientId === rule.b))

    for (const sa of suppA) {
      for (const sb of suppB) {
        if (sa.id === sb.id) continue
        const catA = slotAssignments.get(sa.id)
        const catB = slotAssignments.get(sb.id)
        if (catA === catB) {
          const ingA = sa.ingredients.find((ing) => ing.nutrientId === rule.a)!
          const ingB = sb.ingredients.find((ing) => ing.nutrientId === rule.b)!
          conflicts.push({
            type: 'antagonism',
            supplementId: sa.id,
            supplementName: `${sa.productName} ↔ ${sb.productName}`,
            nutrientId: `${rule.a}/${rule.b}`,
            nutrientName: `${ingA.standardName} ↔ ${ingB.standardName}`,
            message: rule.reason,
            severity: 'warning',
          })
        }
      }
    }
  }

  return conflicts
}

// ---------------------------------------------------------------------------
// 충돌 해결: 2시간 이상 분리
// ---------------------------------------------------------------------------

function resolveSlotConflicts(
  assignments: Map<string, string>,
  slots: TimeSlot[],
  supplements: Supplement[],
  conflicts: Conflict[],
  hasGI: boolean,
  antRules: AntagonismRule[],
): Map<string, string> {
  const resolved = new Map(assignments)
  const slotTimes = new Map(slots.map((s) => [s.key, s.time]))

  for (const rule of antRules) {
    const suppsWithA = supplements.filter((s) => s.ingredients.some((ing) => ing.nutrientId === rule.a))
    const suppsWithB = supplements.filter((s) => s.ingredients.some((ing) => ing.nutrientId === rule.b))

    for (const sa of suppsWithA) {
      for (const sb of suppsWithB) {
        if (sa.id === sb.id) continue
        const slotA = resolved.get(sa.id)
        const slotB = resolved.get(sb.id)
        if (!slotA || !slotB) continue
        if (slotA !== slotB) continue

        const timeA = slotTimes.get(slotA)
        const timeB = slotTimes.get(slotB)
        if (!timeA || !timeB) continue

        if (timeDiffMinutes(timeA, timeB) < rule.hours * 60) {
          const altSlots = slots.filter((s) => {
            if (s.key === slotA) return false
            const t = s.time
            const otherTime = slotTimes.get(slotA)!
            return timeDiffMinutes(t, otherTime) >= rule.hours * 60
          })

          if (altSlots.length > 0) {
            const preferred = altSlots.find((s) => s.category === categorizeSupplement(sb, hasGI)) ?? altSlots[0]
            resolved.set(sb.id, preferred.key)
          }
        }
      }
    }
  }

  return resolved
}

// ---------------------------------------------------------------------------
// 슬롯별 팁 / 경고 생성
// ---------------------------------------------------------------------------

function generateSlotWarnings(
  slotKey: string,
  slotItems: Supplement[],
  conflicts: Conflict[],
  medications: Medication[],
  hasGI: boolean,
): { tips: string[]; warnings: string[] } {
  const tips: string[] = []
  const warnings: string[] = []

  for (const item of slotItems) {
    const itemConflicts = conflicts.filter((c) => c.supplementId === item.id)
    for (const c of itemConflicts) {
      if (c.tip) tips.push(`${c.supplementName}: ${c.tip}`)
      if (c.message) warnings.push(`${c.supplementName}: ${c.message}`)

      if (c.severity === 'block') {
        warnings.push(`${c.supplementName}은(는) 현재 복용 중인 약물과 함께 섭취할 수 없습니다. 담당 의사와 상담하세요.`)
      }
    }
  }

  if (slotKey === 'wake') {
    for (const item of slotItems) {
      const hasIron = item.ingredients.some((ing) => ing.nutrientId === 'iron')
      if (hasIron && hasGI) {
        warnings.push(`${item.productName}: 위장 장애가 있는 경우 철분은 식후 복용을 권장합니다.`)
      }
    }
  }

  for (const item of slotItems) {
    if (item.dailyServings > 1) {
      tips.push(`${item.productName}: 1일 ${item.dailyServings}회 복용이 권장됩니다.`)
    }
  }

  const blockConflicts = conflicts.filter((c) => c.severity === 'block')
  for (const bc of blockConflicts) {
    if (slotItems.some((item) => item.id === bc.supplementId)) {
      warnings.push(`${bc.nutrientName}이 포함된 제품은 현재 약물과 병용이 금지됩니다.`)
    }
  }

  return {
    tips: [...new Set(tips)],
    warnings: [...new Set(warnings)],
  }
}

// ---------------------------------------------------------------------------
// 메인 핸들러
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse(req, { error: 'Authorization header is required' }, 401)

    const body: RequestBody = await req.json()
    const { profile, supplements, medications = [], preferences } = body

    if (!profile) return jsonResponse(req, { error: 'profile is required' }, 400)
    if (!supplements || !Array.isArray(supplements) || supplements.length === 0) {
      return jsonResponse(req, { error: 'supplements is required and must be a non-empty array' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    if (!supabaseUrl) throw new Error('SUPABASE_URL is required')

    const supabase = createClient(supabaseUrl, getServiceKey(), {
      global: { headers: { Authorization: authHeader } },
    })

    const [timings, dniRules, aliases, antRules] = await Promise.all([
      loadTimingCategories(supabase),
      loadDNIRules(supabase),
      loadMedicationAliases(supabase),
      loadAntagonismRules(supabase),
    ])

    const hasGI = hasGIissues(profile.conditions)
    const slots = buildSlots(preferences)

    const categoryToSlotKey = new Map<TimeCategory, string>()
    for (const slot of slots) {
      if (!categoryToSlotKey.has(slot.category)) {
        categoryToSlotKey.set(slot.category, slot.key)
      }
    }

    const assignments = new Map<string, string>()
    for (const supplement of supplements) {
      const category = categorizeSupplement(supplement, hasGI, timings)
      const slotKey = categoryToSlotKey.get(category) ?? slots[1].key
      assignments.set(supplement.id, slotKey)
    }

    const dniConflicts = analyzeDNI(supplements, medications, dniRules, aliases)

    const antagonismConflicts = analyzeAntagonism(supplements, assignments, antRules)

    const allConflicts = [...dniConflicts, ...antagonismConflicts]

    const resolved = resolveSlotConflicts(assignments, slots, supplements, allConflicts, hasGI, antRules)

    const slotItems = new Map<string, Supplement[]>()
    for (const supplement of supplements) {
      const slotKey = resolved.get(supplement.id) ?? slots[0].key
      if (!slotItems.has(slotKey)) slotItems.set(slotKey, [])
      slotItems.get(slotKey)!.push(supplement)
    }

    const resultSlots: SlotItem[] = []

    for (const slot of slots) {
      const items = slotItems.get(slot.key)
      if (!items || items.length === 0) continue

      const { tips, warnings } = generateSlotWarnings(slot.key, items, allConflicts, medications, hasGI)

      const output: SlotItem = {
        time: slot.time,
        label: slot.label,
        items: items.map((s) => s.productName),
      }

      if (tips.length > 0) output.tip = tips.join(' ')
      if (warnings.length > 0) output.warning = warnings.join(' ')

      resultSlots.push(output)
    }

    return jsonResponse(req, { slots: resultSlots, timeline: resultSlots })
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})
