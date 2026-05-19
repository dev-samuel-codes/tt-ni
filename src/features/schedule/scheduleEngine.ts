import { supabase } from '../../lib/supabaseClient'

export interface TimeSlot {
  time: string
  label: string
  items: string[]
  tip?: string
  warning?: string
}

export interface ScheduleInput {
  supplements: Array<{
    id: string
    productName: string
    dailyServings: number
    ingredients: Array<{ nutrientId: string; standardName: string; amount: number; unit: string }>
  }>
  medications: Array<{ name: string; memo: string }>
  conditions: string[]
  preferences: { wakeTime?: string; mealTimes?: string[] }
}

type TimeCategory = 'empty_stomach' | 'after_meal' | 'evening'

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

const EVENING_OR_AFTER = new Set(['zinc'])

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
    severity: 'block',
    message: '와파린 복용 중에는 비타민 K 섭취가 금지됩니다. 비타민 K는 혈액 응고 인자 합성에 관여하여 약효를 무력화시킵니다.',
  },
  {
    medicationKeyword: 'warfarin',
    nutrientId: 'omega3',
    severity: 'warning',
    message: '항응고제와 오메가3를 함께 복용 시 출혈 위험이 있을 수 있습니다. 담당 의사와 상담하세요.',
  },
  {
    medicationKeyword: 'warfarin',
    nutrientId: 'vitamin_e',
    severity: 'warning',
    message: '항응고제와 고용량 비타민 E 병용 시 출혈 위험 증가 가능성이 있으므로 주의가 필요합니다.',
  },
  {
    medicationKeyword: 'warfarin',
    nutrientId: 'ginseng',
    severity: 'warning',
    message: '와파린과 홍삼(진세노사이드) 병용 시 INR 변동 위험이 있어 주의가 필요합니다.',
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
    message: '인슐린과 홍삼을 함께 복용 시 저혈당 위험이 있으므로 용량을 줄이거나 담당 의사와 상담하세요.',
  },
  {
    medicationKeyword: 'statin',
    nutrientId: 'grapefruit',
    severity: 'block',
    message: '스타틴 계열 약물과 자몽(추출물)은 절대 함께 복용할 수 없습니다. CYP3A4 효소 억제로 인한 횡문근융해증 위험이 있습니다.',
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
    message: '골다공증약(비스포스포네이트)과 칼슘은 2~4시간 간격을 두고 복용하세요.',
  },
  {
    medicationKeyword: 'bisphosphonate',
    nutrientId: 'magnesium',
    severity: 'warning',
    message: '골다공증약(비스포스포네이트)과 마그네슘은 2~4시간 간격을 두고 복용하세요.',
  },
  {
    medicationKeyword: 'bisphosphonate',
    nutrientId: 'iron',
    severity: 'warning',
    message: '골다공증약(비스포스포네이트)과 철분은 2~4시간 간격을 두고 복용하세요.',
  },
  {
    medicationKeyword: 'levothyroxine',
    nutrientId: 'calcium',
    severity: 'warning',
    message: '갑상선약(레보티록신)과 칼슘은 2시간 이상 간격을 두고 복용하세요.',
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
  {
    medicationKeyword: 'aspirin',
    nutrientId: 'vitamin_c',
    severity: 'warning',
    message: '아스피린과 고용량 비타민 C 병용 시 위장 장애 및 신장 결석 위험이 증가할 수 있습니다.',
  },
]

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

interface SlotDef {
  key: string
  time: string
  label: string
  category: TimeCategory
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const newH = Math.floor(total / 60) % 24
  const newM = total % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
}

function buildSlots(preferences?: ScheduleInput['preferences']): SlotDef[] {
  const wakeTime = preferences?.wakeTime ?? '07:00'
  const meals = preferences?.mealTimes ?? ['08:00', '12:30', '19:00']

  return [
    { key: 'wake', time: wakeTime, label: '기상 직후', category: 'empty_stomach' },
    { key: 'breakfast', time: addMinutes(meals[0], 30), label: '아침 식후', category: 'after_meal' },
    { key: 'lunch', time: addMinutes(meals[1], 30), label: '점심 식후', category: 'after_meal' },
    { key: 'dinner', time: addMinutes(meals[2], 30), label: '저녁 식후', category: 'evening' },
    { key: 'bedtime', time: addMinutes(meals[2], 180), label: '취침 전', category: 'evening' },
  ]
}

function timeDiffMinutes(a: string, b: string): number {
  const parseMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  return Math.abs(parseMin(a) - parseMin(b))
}

function medicationMatchesName(text: string, keyword: string): boolean {
  const lower = text.toLowerCase()
  if (keyword === 'warfarin') return lower.includes('warfarin') || lower.includes('와파린') || lower.includes('쿠마딘') || lower.includes('항응고')
  if (keyword === 'metformin') return lower.includes('metformin') || lower.includes('메트포르민') || lower.includes('글루코파지')
  if (keyword === 'insulin') return lower.includes('insulin') || lower.includes('인슐린')
  if (keyword === 'statin') return lower.includes('statin') || lower.includes('스타틴') || lower.includes('로수바스타틴') || lower.includes('아토르바스타틴') || lower.includes('심바스타틴') || lower.includes('프라바스타틴') || lower.includes('피타바스타틴')
  if (keyword === 'antibiotic') return lower.includes('antibiotic') || lower.includes('항생제') || lower.includes('세파') || lower.includes('페니실린') || lower.includes('아목시실린') || lower.includes('독시사이클린') || lower.includes('아지트로마이신') || lower.includes('클래리스로마이신')
  if (keyword === 'bisphosphonate') return lower.includes('bisphosphonate') || lower.includes('비스포스포네이트') || lower.includes('알렌드로네이트') || lower.includes('리세드로네이트') || lower.includes('골다공증약')
  if (keyword === 'levothyroxine') return lower.includes('levothyroxine') || lower.includes('레보티록신') || lower.includes('씬지로이드') || lower.includes('갑상선')
  if (keyword === 'aspirin') return lower.includes('aspirin') || lower.includes('아스피린') || lower.includes('바이엘')
  return false
}

function hasGIissues(conditions: string[]): boolean {
  const giKeywords = /위장|위염|속쓰림|소화불량|위궤양|십이지장|과민성대장|역류성식도|소화기/
  return conditions.some((c) => giKeywords.test(c))
}

function categorizeSupplement(
  supplement: ScheduleInput['supplements'][number],
  hasGI: boolean,
): TimeCategory {
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

function analyzeDNI(
  supplements: ScheduleInput['supplements'],
  medications: ScheduleInput['medications'],
): Conflict[] {
  const conflicts: Conflict[] = []

  for (const med of medications) {
    const medText = `${med.name} ${med.memo}`

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

function analyzeAntagonism(
  supplements: ScheduleInput['supplements'],
  slotAssignments: Map<string, string>,
): Conflict[] {
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

function resolveSlotConflicts(
  assignments: Map<string, string>,
  slots: SlotDef[],
  supplements: ScheduleInput['supplements'],
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

function generateSlotWarnings(
  slotKey: string,
  slotItems: ScheduleInput['supplements'],
  conflicts: Conflict[],
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

export function generateSchedule(input: ScheduleInput): TimeSlot[] {
  const { supplements, medications, conditions, preferences } = input

  if (!supplements || supplements.length === 0) return []

  const hasGI = hasGIissues(conditions)
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

  const resolved = resolveSlotConflicts(assignments, slots, supplements, hasGI)

  const slotItems = new Map<string, ScheduleInput['supplements']>()
  for (const supplement of supplements) {
    const slotKey = resolved.get(supplement.id) ?? slots[0].key
    if (!slotItems.has(slotKey)) slotItems.set(slotKey, [])
    slotItems.get(slotKey)!.push(supplement)
  }

  const resultSlots: TimeSlot[] = []

  for (const slot of slots) {
    const items = slotItems.get(slot.key)
    if (!items || items.length === 0) continue

    const { tips, warnings } = generateSlotWarnings(slot.key, items, allConflicts, hasGI)

    const output: TimeSlot = {
      time: slot.time,
      label: slot.label,
      items: items.map((s) => s.productName),
    }

    if (tips.length > 0) output.tip = tips.join(' ')
    if (warnings.length > 0) output.warning = warnings.join(' ')

    resultSlots.push(output)
  }

  return resultSlots
}

export async function getScheduleForDate(date: Date): Promise<TimeSlot[]> {
  const { data: authData } = await supabase.auth.getUser()
  if (!authData?.user) return []

  const dateStr = date.toISOString().split('T')[0]

  const { data: savedSchedule } = await supabase
    .from('schedules')
    .select('schedule_data')
    .eq('user_id', authData.user.id)
    .eq('schedule_date', dateStr)
    .single()

  if (savedSchedule?.schedule_data) {
    return savedSchedule.schedule_data as TimeSlot[]
  }

  const [{ data: profile }, { data: userSupplements }, { data: medications }] = await Promise.all([
    supabase.from('profiles').select('conditions').eq('user_id', authData.user.id).single(),
    supabase.from('user_supplements').select(`
      daily_servings,
      supplement_products!inner (
        id,
        product_name,
        supplement_ingredients (
          nutrient_id,
          standard_name,
          amount,
          unit
        )
      )
    `).eq('user_id', authData.user.id).eq('active', true),
    supabase.from('user_medications').select('name, memo').eq('user_id', authData.user.id),
  ])

  if (!userSupplements || userSupplements.length === 0) return []

  const supplements: ScheduleInput['supplements'] = (userSupplements as unknown as Array<{
    daily_servings: number
    supplement_products: {
      id: string
      product_name: string
      supplement_ingredients: Array<{
        nutrient_id: string
        standard_name: string
        amount: number
        unit: string
      }>
    }
  }>).map((us) => ({
    id: us.supplement_products.id,
    productName: us.supplement_products.product_name,
    dailyServings: us.daily_servings,
    ingredients: us.supplement_products.supplement_ingredients.map((ing) => ({
      nutrientId: ing.nutrient_id,
      standardName: ing.standard_name,
      amount: ing.amount,
      unit: ing.unit,
    })),
  }))

  const input: ScheduleInput = {
    supplements,
    medications: (medications ?? []).map((m: { name: string; memo: string | null }) => ({
      name: m.name,
      memo: m.memo ?? '',
    })),
    conditions: profile?.conditions ?? [],
    preferences: {},
  }

  return generateSchedule(input)
}
