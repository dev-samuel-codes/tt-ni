import '@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders, getCorsHeaders, jsonResponse } from '../_shared/cors.ts'

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
// 시간대별 권장 영양소
// ---------------------------------------------------------------------------

const MORNING_EMPTY_STOMACH = new Set([
  'probiotics',
  'vitamin_b1',
  'vitamin_b6',
  'vitamin_b12',
  'vitamin_c',
  'iron',
  'ginseng',
  'choline',
])

const AFTER_MEAL = new Set([
  'vitamin_a',
  'vitamin_d',
  'vitamin_e',
  'vitamin_k',
  'omega3',
  'coq10',
])

const EVENING = new Set([
  'calcium',
  'magnesium',
])

// zinc도 2가 양이온이라 evening에 가깝지만,
// evening에 Ca/Mg가 많으면 분리 배치하기 위해 after_meal로도 쓸 수 있게 둔다.
const EVENING_OR_AFTER = new Set(['zinc'])

// ---------------------------------------------------------------------------
// 약물 DNI 충돌 규칙
// ---------------------------------------------------------------------------

interface DNIRule {
  medicationKeyword: string
  nutrientId: string
  severity: 'warning' | 'block'
  message: string
  tip?: string
}

const DNI_RULES: DNIRule[] = [
  {
    medicationKeyword: 'warfarin',
    nutrientId: 'vitamin_k',
    severity: 'warning',
    message: '와파린 복용 중에는 비타민 K 섭취량을 일정하게 유지해야 합니다.',
  },
  {
    medicationKeyword: 'warfarin',
    nutrientId: 'omega3',
    severity: 'warning',
    message: '항응고제와 오메가3를 함께 복용 시 출혈 위험이 있을 수 있습니다.',
  },
  {
    medicationKeyword: 'metformin',
    nutrientId: 'vitamin_b12',
    severity: 'warning',
    tip: '메트포르민 장기 복용 시 비타민 B12 결핍 위험이 있으므로 B12 보충을 권장합니다.',
    message: '',
  },
  {
    medicationKeyword: 'insulin',
    nutrientId: 'ginseng',
    severity: 'warning',
    message: '인슐린과 홍삼을 함께 복용 시 혈당 저하 위험이 있으므로 용량 조절이 필요합니다.',
  },
  {
    medicationKeyword: 'statin',
    nutrientId: 'grapefruit',
    severity: 'block',
    message: '스타틴 계열 약물과 자몽(주스)은 절대 함께 복용할 수 없습니다.',
  },
  {
    medicationKeyword: 'statin',
    nutrientId: 'coq10',
    severity: 'warning',
    tip: '스타틴 복용 시 코엔자임 Q10을 함께 섭취하면 근육 부작용 완화에 도움이 될 수 있습니다.',
    message: '',
  },
  {
    medicationKeyword: 'antibiotic',
    nutrientId: 'probiotics',
    severity: 'warning',
    message: '항생제와 유산균은 2시간 이상 간격을 두고 복용하세요.',
  },
  {
    medicationKeyword: 'bisphosphonate',
    nutrientId: 'calcium',
    severity: 'warning',
    message: '골다공증약과 칼슘은 2~4시간 간격을 두고 복용하세요.',
  },
  {
    medicationKeyword: 'bisphosphonate',
    nutrientId: 'magnesium',
    severity: 'warning',
    message: '골다공증약과 마그네슘은 2~4시간 간격을 두고 복용하세요.',
  },
  {
    medicationKeyword: 'bisphosphonate',
    nutrientId: 'iron',
    severity: 'warning',
    message: '골다공증약과 철분은 2~4시간 간격을 두고 복용하세요.',
  },
  {
    medicationKeyword: 'levothyroxine',
    nutrientId: 'calcium',
    severity: 'warning',
    message: '갑상선약(레보티록신)과 칼슘은 4시간 이상 간격을 두고 복용하세요.',
  },
  {
    medicationKeyword: 'levothyroxine',
    nutrientId: 'magnesium',
    severity: 'warning',
    message: '갑상선약(레보티록신)과 마그네슘은 4시간 이상 간격을 두고 복용하세요.',
  },
  {
    medicationKeyword: 'levothyroxine',
    nutrientId: 'iron',
    severity: 'warning',
    message: '갑상선약(레보티록신)과 철분은 4시간 이상 간격을 두고 복용하세요.',
  },
]

// ---------------------------------------------------------------------------
// 길항작용 쌍
// ---------------------------------------------------------------------------

interface AntagonismRule {
  a: string
  b: string
  hours: number
  reason: string
}

const ANTAGONISM_RULES: AntagonismRule[] = [
  { a: 'calcium', b: 'iron', hours: 2, reason: 'DMT1 수용체 경쟁으로 인해 칼슘과 철분은 2시간 이상 간격을 두는 것이 좋습니다.' },
  { a: 'calcium', b: 'magnesium', hours: 2, reason: '2가 양이온 간 흡수 경쟁으로 칼슘과 마그네슘은 2시간 이상 간격을 두는 것이 좋습니다.' },
  { a: 'calcium', b: 'zinc', hours: 2, reason: '2가 양이온 간 흡수 경쟁으로 칼슘과 아연은 2시간 이상 간격을 두는 것이 좋습니다.' },
]

// ---------------------------------------------------------------------------
// 약물 키워드 매칭
// ---------------------------------------------------------------------------

function medicationMatchesName(name: string, keyword: string): boolean {
  const lower = name.toLowerCase()
  if (keyword === 'warfarin') return lower.includes('warfarin') || lower.includes('와파린') || lower.includes('쿠마딘') || lower.includes('항응고')
  if (keyword === 'metformin') return lower.includes('metformin') || lower.includes('메트포르민') || lower.includes('글루코파지')
  if (keyword === 'insulin') return lower.includes('insulin') || lower.includes('인슐린')
  if (keyword === 'statin') return lower.includes('statin') || lower.includes('스타틴') || lower.includes('로수바스타틴') || lower.includes('아토르바스타틴') || lower.includes('심바스타틴') || lower.includes('프라바스타틴') || lower.includes('피타바스타틴')
  if (keyword === 'antibiotic') return lower.includes('antibiotic') || lower.includes('항생제') || lower.includes('세파') || lower.includes('페니실린') || lower.includes('아목시실린') || lower.includes('독시사이클린') || lower.includes('아지트로마이신') || lower.includes('클래리스로마이신')
  if (keyword === 'bisphosphonate') return lower.includes('bisphosphonate') || lower.includes('비스포스포네이트') || lower.includes('알렌드로네이트') || lower.includes('리세드로네이트') || lower.includes('골다공증약')
  if (keyword === 'levothyroxine') return lower.includes('levothyroxine') || lower.includes('레보티록신') || lower.includes('씬지로이드') || lower.includes('갑상선')
  return false
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

type TimeCategory = 'empty_stomach' | 'after_meal' | 'evening'

function categorizeSupplement(supplement: Supplement, hasGI: boolean): TimeCategory {
  const nutrientIds = supplement.ingredients.map((ing) => ing.nutrientId)

  const hasFatSoluble = nutrientIds.some((id) => AFTER_MEAL.has(id) && !EVENING.has(id))
  const hasEvening = nutrientIds.some((id) => EVENING.has(id))
  const hasEveningOrAfter = nutrientIds.some((id) => EVENING_OR_AFTER.has(id))
  const hasEmptyStomach = nutrientIds.some((id) => MORNING_EMPTY_STOMACH.has(id))

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

function analyzeDNI(supplements: Supplement[], medications: Medication[]): Conflict[] {
  const conflicts: Conflict[] = []

  for (const med of medications) {
    const medText = `${med.name} ${med.memo ?? ''}`

    for (const rule of DNI_RULES) {
      if (!medicationMatchesName(medText, rule.medicationKeyword)) continue

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

function analyzeAntagonism(supplements: Supplement[], slotAssignments: Map<string, TimeCategory>): Conflict[] {
  const conflicts: Conflict[] = []

  for (const rule of ANTAGONISM_RULES) {
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
): Map<string, string> {
  const resolved = new Map(assignments)
  const slotTimes = new Map(slots.map((s) => [s.key, s.time]))

  for (const rule of ANTAGONISM_RULES) {
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
      const category = categorizeSupplement(supplement, hasGI)
      const slotKey = categoryToSlotKey.get(category) ?? slots[1].key
      assignments.set(supplement.id, slotKey)
    }

    const dniConflicts = analyzeDNI(supplements, medications)

    const antagonismConflicts = analyzeAntagonism(supplements, assignments)

    const allConflicts = [...dniConflicts, ...antagonismConflicts]

    const resolved = resolveSlotConflicts(assignments, slots, supplements, allConflicts, hasGI)

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
