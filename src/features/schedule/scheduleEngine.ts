import type { InteractionRule } from '../../types/index.js'
import { interactionRules } from '../nutrition/nutritionData.js'

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
 * 약물명 텍스트가 주어진 상호작용 규칙의 약물명 및 별칭(Aliases)과 매칭되는지 확인합니다.
 * 마스터 interactionRules의 medicationAliases 정보와 medicationKeyword를 활용하여 동적 매칭을 수행합니다.
 */
function medicationMatchesRule(text: string, rule: InteractionRule): boolean {
  const lower = text.toLowerCase()
  if (rule.medicationAliases && rule.medicationAliases.length > 0) {
    return rule.medicationAliases.some((alias) => lower.includes(alias.toLowerCase()))
  }
  if (rule.medicationKeyword) {
    return lower.includes(rule.medicationKeyword.toLowerCase())
  }
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
 * 약물-영양소 및 질환-영양소 상호작용(DNI)을 분석하여 충돌 목록을 반환합니다.
 * 각 약물/질환 규칙에 대해 매칭되는 영양제 성분이 있으면 충돌로 기록합니다.
 */
function analyzeDNI(
  supplements: ScheduleInput['supplements'],
  medications: ScheduleInput['medications'],
  conditions: string[],
): Conflict[] {
  const conflicts: Conflict[] = []
  const conditionText = conditions.join(' ').toLowerCase()

  for (const rule of interactionRules) {
    let matchedRule = false
    
    // 1. 약물 매칭 검사
    for (const med of medications) {
      const medText = `${med.name} ${med.memo}`
      if (medicationMatchesRule(medText, rule)) {
        matchedRule = true
        break
      }
    }

    // 2. 질환 매칭 검사
    if (!matchedRule) {
      if (rule.conditionAliases && rule.conditionAliases.length > 0) {
        if (rule.conditionAliases.some((alias) => conditionText.includes(alias.toLowerCase()))) {
          matchedRule = true
        }
      } else if (rule.conditionCode) {
        if (conditionText.includes(rule.conditionCode.toLowerCase())) {
          matchedRule = true
        }
      }
    }

    if (!matchedRule) continue

    for (const supp of supplements) {
      const matched = supp.ingredients.find((ing) => ing.nutrientId === rule.nutrientId)
      if (!matched) continue

      const severity: 'warning' | 'block' = rule.severity === 'high' ? 'block' : 'warning'
      
      let tip: string | undefined = undefined
      let message = rule.message

      if (rule.id === 'metformin-b12' || rule.id === 'statin-coq10') {
        tip = rule.message
        message = ''
      }

      conflicts.push({
        type: severity === 'block' ? 'dni_block' : 'dni_warning',
        supplementId: supp.id,
        supplementName: cleanProductName(supp.productName),
        nutrientId: matched.nutrientId,
        nutrientName: matched.standardName,
        message: message,
        tip: tip,
        severity: severity,
      })
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

  const dniConflicts = analyzeDNI(supplements, medications, conditions)
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
