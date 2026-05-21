/** 하루 중 특정 시간대의 복용 정보 */
export interface TimeSlot {
  time: string
  label: string
  items: string[]
  tip?: string
  warning?: string
  tips?: string[]
  warnings?: string[]
}

/**
 * 장황하고 지저분한 영양제 제품명을 핵심 브랜드와 제품명만 남기고 정제하는 유틸리티
 */
export function cleanProductName(name: string): string {
  if (!name) return ''
  // 1. "영양제1 ↔ " 또는 "영양제[숫자] ↔ " 같은 머리글 제거
  let cleaned = name.replace(/^영양제\d+\s*↔\s*/, '')
  // 2. "상품 상세보기 : " 또는 "상품 상세보기 :" 등 제거
  cleaned = cleaned.replace(/상품\s*상세보기\s*:\s*/g, '')
  // 3. 앞뒤 공백 및 기호 제거
  cleaned = cleaned.trim().replace(/^[-~+=>↔:\s]+/g, '').replace(/[-~+=>↔:\s]+$/g, '')
  // 4. 쉼표(,)로 구분된 세부 정보가 있으면 첫 번째 핵심 이름만 추출
  if (cleaned.includes(',')) {
    cleaned = cleaned.split(',')[0].trim()
  }
  // 5. 다시 한 번 앞뒤 공백 및 기호 최종 정리
  cleaned = cleaned.replace(/^[-~+=>↔:\s]+/g, '').replace(/[-~+=>↔:\s]+$/g, '')
  return cleaned.trim()
}

/** 스케줄 생성을 위한 입력 데이터 */
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

/**
 * 복용 시간대 카테고리
 * - empty_stomach: 기상 직후 공복 복용 (수용성 비타민, 유산균, 철분 등)
 * - after_meal: 식후 복용 (지용성 비타민, 오메가3, CoQ10 등)
 * - evening: 저녁/취침 전 복용 (칼슘, 마그네슘, 아연 등)
 */
type TimeCategory = 'empty_stomach' | 'after_meal' | 'evening'

/**
 * 공복 복용이 권장되는 영양소 (아침 기상 직후)
 * 수용성 비타민, 유산균, 철분, 홍삼, 콜린 등은 공복에 흡수율이 높습니다.
 */
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

/**
 * 식후 복용이 권장되는 영양소
 * 지용성 비타민(A, D, E, K)과 오메가3, CoQ10은 음식의 지방과 함께 섭취해야 흡수율이 높아집니다.
 */
const AFTER_MEAL = new Set([
  'vitamin_a',
  'vitamin_d',
  'vitamin_e',
  'vitamin_k',
  'omega3',
  'coq10',
])

/**
 * 저녁 복용이 권장되는 영양소
 * 칼슘, 마그네슘은 숙면을 돕고 밤 시간대 골 흡수를 최적화합니다.
 */
const EVENING = new Set([
  'calcium',
  'magnesium',
])

// 아연은 저녁-식후 모두 가능: 저녁에 Ca/Mg와 겹치면 식후로 분리 배치
const EVENING_OR_AFTER = new Set(['zinc'])

interface DNIRule {
  medicationKeyword: string
  nutrientId: string
  severity: 'warning' | 'block'
  message: string
  tip?: string
}

/**
 * DNI (약물-영양소 상호작용) 규칙
 * 특정 약물과 영양소의 병용 시 주의사항 또는 금기사항을 정의합니다.
 * severity: 'warning'(주의) 또는 'block'(병용 금지)
 */
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

/** 길항작용 쌍: 동시 복용 시 a와 b가 흡수 경쟁하여 최소 hours 시간 간격이 필요합니다. */
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

/** 슬롯 정의: key(식별자), time(시간 문자열), label(표시 라벨), category(복용 타입) */
interface SlotDef {
  key: string
  time: string
  label: string
  category: TimeCategory
}

/** 시간 문자열에 분을 더한 결과를 반환합니다. (HH:MM 형식, 24시간제) */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const newH = Math.floor(total / 60) % 24
  const newM = total % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
}

/**
 * 기상 시간과 식사 시간을 기준으로 하루 5개 복용 슬롯을 생성합니다.
 * 기상 직후(공복), 아침 식후, 점심 식후, 저녁 식후, 취침 전
 */
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

/** 두 시간 문자열 간 차이를 분 단위로 계산합니다. */
function timeDiffMinutes(a: string, b: string): number {
  const parseMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  return Math.abs(parseMin(a) - parseMin(b))
}

/**
 * 약물명 텍스트가 주어진 키워드와 매칭되는지 확인합니다.
 * 영문/한글 약물명, 브랜드명, 계열명을 종합적으로 검사합니다.
 */
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

/** 사용자의 건강 상태 목록에 위장장애 관련 키워드가 포함되어 있는지 확인합니다. */
function hasGIissues(conditions: string[]): boolean {
  const giKeywords = /위장|위염|속쓰림|소화불량|위궤양|십이지장|과민성대장|역류성식도|소화기/
  return conditions.some((c) => giKeywords.test(c))
}

/**
 * 영양제의 포함 성분을 분석하여 최적 복용 시간대를 결정합니다.
 * 우선순위: 자몽(식후) > 지용성(식후/저녁) > 저녁 성분 > 공복 성분 > 기본(식후)
 * 위장장애가 있고 철분이 포함된 경우 공복 대신 식후로 조정합니다.
 */
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

/** 충돌 정보: DNI(약물-영양소 상호작용) 또는 길항작용으로 인한 주의/경고 */
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

/**
 * 약물-영양소 상호작용(DNI)을 분석하여 충돌 목록을 반환합니다.
 * 각 약물-규칙-영양소 조합에 대해 매칭되는 영양제 성분이 있으면 충돌로 기록합니다.
 */
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
          supplementName: cleanProductName(supp.productName),
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

/**
 * 길항작용을 분석합니다.
 * 같은 슬롯에 배정된 길항 관계의 영양소 쌍이 있는지 검사하여 충돌으로 기록합니다.
 */
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
            supplementName: `${cleanProductName(sa.productName)} ↔ ${cleanProductName(sb.productName)}`,
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

/**
 * 길항작용 충돌이 발견된 경우, 충돌 영양소를 다른 시간 슬롯으로 재배치합니다.
 * 충돌하는 두 영양소가 같은 슬롯에 있고 시간 간격이 충분하지 않으면,
 * B 영양소를 충분한 간격이 확보된 대체 슬롯으로 이동시킵니다.
 */
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

/**
 * 특정 시간 슬롯에 배정된 영양제 목록을 바탕으로 팁과 경고를 생성합니다.
 * 충돌 정보, 위장장애 여부, 1일 복용 횟수, 병용 금기 등을 종합적으로 검토합니다.
 */
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
        warnings.push(`${cleanProductName(item.productName)}: 위장 장애가 있는 경우 철분은 식후 복용을 권장합니다.`)
      }
    }
  }

  for (const item of slotItems) {
    if (item.dailyServings > 1) {
      tips.push(`${cleanProductName(item.productName)}: 1일 ${item.dailyServings}회 복용이 권장됩니다.`)
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

/**
 * 시간약리학 기반 복용 스케줄을 생성하는 메인 함수입니다.
 *
 * 처리 흐름:
 * 1. 영양제별 최적 시간대 분류 (공복/식후/저녁)
 * 2. 약물-영양소 상호작용(DNI) 분석
 * 3. 길항작용 분석 및 충돌 해결
 * 4. 시간 슬롯별 배정 및 팁/경고 생성
 */
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

    if (tips.length > 0) {
      output.tip = tips.join(' ')
      output.tips = tips
    }
    if (warnings.length > 0) {
      output.warning = warnings.join(' ')
      output.warnings = warnings
    }

    resultSlots.push(output)
  }

  return resultSlots
}
