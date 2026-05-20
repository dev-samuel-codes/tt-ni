import {
  interactionRules,
  nutrients,
  referenceValues,
} from '../nutrition/nutritionData'
import type {
  AnalysisReport,
  Medication,
  NutrientTotal,
  Profile,
  ReferenceValue,
  RiskStatus,
  SupplementProduct,
  Unit,
} from '../../types'

/**
 * 시너지 그룹
 * 사용자가 보유한 영양소 조합 중 상호 보완적인 효능을 발휘하는 조합을 정의합니다.
 * FULL 매치 (모든 구성 영양소 보유) 또는 PARTIAL 매치 (일부만 보유)로 구분됩니다.
 */
const SYNERGY_GROUPS = [
  {
    nutrients: ['coq10', 'omega3'],
    label: 'CoQ10 + 오메가3',
    benefit: '혈관 내피세포 건강과 항산화 네트워크가 강화되어 심혈관 보호 효과가 배가됩니다. CoQ10이 미토콘드리아 ATP 생성을, 오메가3가 혈류를 개선합니다.',
    reportReference: '보고서 2.1절',
  },
  {
    nutrients: ['vitamin_c', 'iron'],
    label: '비타민 C + 철분',
    benefit: '비타민 C가 비헴철(식물성 철분)을 흡수되기 쉬운 환원 상태(Fe²⁺)로 유지시켜 철분 흡수율을 극대화합니다. 빈혈 예방에 탁월한 조합입니다.',
    reportReference: '보고서 2.1절',
  },
  {
    nutrients: ['vitamin_e', 'omega3'],
    label: '비타민 E + 오메가3',
    benefit: '오메가3의 이중 결합이 활성산소에 의해 산화되는 것을 비타민 E가 방어합니다. 오메가3의 구조적 온전성을 보존하여 노화 방지 효능을 유지합니다.',
    reportReference: '보고서 2.1절',
  },
  {
    nutrients: ['vitamin_c', 'collagen'],
    label: '비타민 C + 콜라겐',
    benefit: '비타민 C는 콜라겐 합성의 필수 조효소로, 프롤린과 라이신의 수산화 반응을 촉진하여 피부 탄력과 관절 건강을 개선합니다.',
    reportReference: '보고서 2.1절',
  },
  {
    nutrients: ['vitamin_e', 'coq10'],
    label: '비타민 E + CoQ10',
    benefit: '지용성 항산화제인 비타민 E와 미토콘드리아 항산화제인 CoQ10이 이중 항산화 방어벽을 형성하여 세포막을 보호합니다.',
    reportReference: '보고서 2.1절',
  },
  {
    nutrients: ['iron', 'vitamin_c', 'selenium'],
    label: '철분 + 비타민 C + 셀레늄',
    benefit: '비타민 C가 철분 흡수를 돕고, 셀레늄이 흡수된 철분의 산화를 방지하여 조혈 기능과 조직 산소 공급을 강화합니다.',
    reportReference: '보고서 2.1절',
  },
]

/**
 * 길항작용 그룹
 * 동시 복용 시 흡수 경쟁이나 상호 간섭이 발생하는 영양소 쌍을 정의합니다.
 * 특정 시간 간격(minIntervalHours)을 두고 복용하는 것을 권장합니다.
 */
const ANTAGONISM_GROUPS = [
  {
    nutrients: ['calcium', 'iron'],
    label: '칼슘 ↔ 철분',
    reason: '장관 점막의 DMT1(2가 금속 수송체)를 공유하여 흡수 경쟁이 발생합니다. 동시 복용 시 철분 흡수율이 크게 저하됩니다.',
    minIntervalHours: 2,
    severity: 'caution' as const,
    reportReference: '보고서 2.2절',
  },
  {
    nutrients: ['calcium', 'magnesium'],
    label: '칼슘 ↔ 마그네슘',
    reason: '두 다가 양이온이 같은 흡수 채널을 두고 경쟁하여 상호 흡수율이 감소합니다.',
    minIntervalHours: 2,
    severity: 'caution' as const,
    reportReference: '보고서 2.2절',
  },
  {
    nutrients: ['calcium', 'zinc'],
    label: '칼슘 ↔ 아연',
    reason: '다가 양이온 간 흡수 경쟁으로 인해 아연의 생체이용률이 저하됩니다.',
    minIntervalHours: 2,
    severity: 'caution' as const,
    reportReference: '보고서 2.2절',
  },
  {
    nutrients: ['iron', 'zinc'],
    label: '철분 ↔ 아연',
    reason: 'DMT1 수송체를 공유하여 경쟁적 흡수 억제가 발생합니다.',
    minIntervalHours: 2,
    severity: 'caution' as const,
    reportReference: '보고서 2.2절',
  },
  {
    nutrients: ['calcium', 'magnesium', 'zinc'],
    label: '칼슘 ↔ 마그네슘 ↔ 아연',
    reason: '세 다가 양이온이 동일한 흡수 경로에서 경쟁하므로 동시 복용을 피해야 합니다.',
    minIntervalHours: 2,
    severity: 'caution' as const,
    reportReference: '보고서 2.2절',
  },
]

/** 출생연도로부터 현재 만 나이를 계산합니다. */
export function getAge(profile: Pick<Profile, 'birthYear'>, now = new Date()): number {
  return Math.max(0, now.getFullYear() - profile.birthYear)
}

/** 65세 이상 여부를 확인합니다. */
export function isElderly(profile: Pick<Profile, 'birthYear'>): boolean {
  return getAge(profile) >= 65
}

/** 12세 이하 아동 여부를 확인합니다. */
export function isChild(profile: Pick<Profile, 'birthYear'>): boolean {
  const age = getAge(profile)
  return age >= 0 && age <= 12
}

/**
 * 성인 UL(상한섭취량)을 아동 체중 기준으로 비례 외삽합니다.
 * 성인 기준 체중 65kg 대비 비율로 환산합니다.
 */
export function extrapolateUlChild(ulAdult: number, weightChildKg: number): number {
  const WEIGHT_ADULT = 65
  return ulAdult * (weightChildKg / WEIGHT_ADULT)
}

/**
 * 성인 EAR(평균필요량)을 노년층 체중 기준으로 대사율 가중 외삽합니다.
 * 체중의 0.75승 비율로 환산하여 기초대사량 차이를 반영합니다.
 */
export function extrapolateEarElderly(earAdult: number, weightElderlyKg: number): number {
  const WEIGHT_ADULT = 65
  return earAdult * Math.pow(weightElderlyKg / WEIGHT_ADULT, 0.75)
}

/**
 * 영양소 단위를 변환합니다.
 * 기본 단위(g↔mg↔mcg) 및 비타민별 특수 단위(IU↔mcg↔mg)를 지원합니다.
 * 변환 불가능한 경우 null을 반환합니다.
 */
export function convertAmount(amount: number, fromUnit: Unit, toUnit: Unit, nutrientId: string): number | null {
  if (fromUnit === toUnit) return amount
  if (fromUnit === 'unknown' || toUnit === 'unknown') return null

  if (fromUnit === 'g' && toUnit === 'mg') return amount * 1000
  if (fromUnit === 'mg' && toUnit === 'g') return amount / 1000
  if (fromUnit === 'mg' && toUnit === 'mcg') return amount * 1000
  if (fromUnit === 'mcg' && toUnit === 'mg') return amount / 1000
  if (fromUnit === 'g' && toUnit === 'mcg') return amount * 1_000_000
  if (fromUnit === 'mcg' && toUnit === 'g') return amount / 1_000_000

  if (nutrientId === 'vitamin_d') {
    if (fromUnit === 'IU' && toUnit === 'mcg') return amount / 40
    if (fromUnit === 'mcg' && toUnit === 'IU') return amount * 40
  }

  if (nutrientId === 'vitamin_a') {
    if (fromUnit === 'IU' && toUnit === 'mcg') return amount * 0.3
    if (fromUnit === 'mcg' && toUnit === 'IU') return amount / 0.3
  }

  if (nutrientId === 'vitamin_e') {
    if (fromUnit === 'IU' && toUnit === 'mg') return amount * 0.67
    if (fromUnit === 'mg' && toUnit === 'IU') return amount / 0.67
  }

  return null
}

/**
 * 프로필 정보(성별, 연령)에 맞는 한국인 영양섭취기준(KDRIs) 참조치를 조회합니다.
 * 성별(gender)과 연령대(ageMin ~ ageMax)가 일치하는 기준을 반환합니다.
 */
export function findReferenceValue(profile: Profile, nutrientId: string): ReferenceValue | undefined {
  const age = getAge(profile)
  return referenceValues.find((reference) => {
    const genderMatches = reference.gender === 'any' || reference.gender === profile.gender
    return reference.nutrientId === nutrientId && genderMatches && age >= reference.ageMin && age <= reference.ageMax
  })
}

/**
 * 총 섭취량을 기준치와 비교하여 위험 상태를 판정합니다.
 * - excess: UL(상한섭취량) 초과
 * - caution: UL의 80% 이상 접근
 * - deficient: RDA/AI 대비 70% 미만
 * - normal: 위 조건에 해당하지 않음
 * - review: 기준 데이터 부재
 */
function summarizeStatus(total: number, reference?: ReferenceValue): { status: RiskStatus; message: string; percentOfTarget?: number; percentOfUl?: number } {
  if (!reference) {
    return {
      status: 'review',
      message: '기준 데이터가 아직 없어 직접 확인이 필요합니다.',
    }
  }

  const target = reference.rda ?? reference.ai
  const percentOfTarget = target ? Math.round((total / target) * 100) : undefined
  const percentOfUl = reference.ul ? Math.round((total / reference.ul) * 100) : undefined

  if (reference.ul && total > reference.ul) {
    return {
      status: 'excess',
      message: '상한 섭취량을 초과했습니다. 제품 복용량을 바꾸기 전 전문가와 상담하세요.',
      percentOfTarget,
      percentOfUl,
    }
  }

  if (reference.ul && total >= reference.ul * 0.8) {
    return {
      status: 'caution',
      message: '상한 섭취량에 가까워 중복 제품과 복용량 확인이 필요합니다.',
      percentOfTarget,
      percentOfUl,
    }
  }

  if (target && total < target * 0.7) {
    return {
      status: 'deficient',
      message: '등록된 영양제 기준으로는 기준량보다 낮습니다. 식사 섭취까지 함께 확인하세요.',
      percentOfTarget,
      percentOfUl,
    }
  }

  return {
    status: 'normal',
    message: '현재 등록된 영양제 기준으로 큰 중복 신호가 없습니다.',
    percentOfTarget,
    percentOfUl,
  }
}

/**
 * 영양제 분석 리포트를 생성하는 메인 함수입니다.
 *
 * 처리 흐름:
 * 1. 확정된(confirmed) 영양제만 집계
 * 2. 각 원재료의 단위를 기준 단위로 환산 후 1일 총 섭취량 합산
 * 3. KDRIs 기준치와 비교하여 각 영양소별 상태(normal/deficient/caution/excess/review) 평가
 * 4. 중복 성분 식별 (여러 제품에 동일 영양소가 포함된 경우)
 * 5. 약물-영양소 상호작용(DNI) 경고 생성
 * 6. 시너지 조합 추천 (full/partial 매치)
 * 7. 길항작용 경고 (동시 복용 시 흡수 경쟁 발생)
 */
export function runAnalysis(profile: Profile, medications: Medication[], supplements: SupplementProduct[]): AnalysisReport {
  const confirmedSupplements = supplements.filter((supplement) => supplement.confirmed)
  const totalsByNutrient = new Map<string, NutrientTotal>()

  confirmedSupplements.forEach((supplement) => {
    supplement.ingredients.forEach((ingredient) => {
      const reference = findReferenceValue(profile, ingredient.nutrientId)
      const nutrient = nutrients.find((item) => item.id === ingredient.nutrientId)
      const targetUnit = reference?.unit ?? nutrient?.defaultUnit ?? ingredient.unit

      if (ingredient.amount === null) return
      const converted = convertAmount(
        ingredient.amount * supplement.dailyServings,
        ingredient.unit,
        targetUnit,
        ingredient.nutrientId,
      )
      if (converted === null) return

      const existing = totalsByNutrient.get(ingredient.nutrientId)
      if (existing) {
        existing.totalAmount += converted
        existing.sourceProducts.push({
          productId: supplement.id,
          productName: supplement.productName,
          amount: converted,
          unit: targetUnit,
        })
        return
      }

      totalsByNutrient.set(ingredient.nutrientId, {
        nutrientId: ingredient.nutrientId,
        standardName: ingredient.standardName,
        totalAmount: converted,
        unit: targetUnit,
        reference,
        status: 'review',
        sourceProducts: [
          {
            productId: supplement.id,
            productName: supplement.productName,
            amount: converted,
            unit: targetUnit,
          },
        ],
        message: '',
      })
    })
  })

  const totals = Array.from(totalsByNutrient.values()).map((total) => {
    const summary = summarizeStatus(total.totalAmount, total.reference)
    return { ...total, ...summary }
  })

  const duplicateItems = totals.filter((total) => total.sourceProducts.length >= 2)
  const medicationText = medications.map((medication) => `${medication.name} ${medication.memo}`.toLowerCase()).join(' ')
  const conditionText = profile.conditions.join(' ').toLowerCase()

  const interactionWarnings = interactionRules
    .filter((rule) => totals.some((total) => total.nutrientId === rule.nutrientId))
    .filter((rule) => {
      const medicationMatch = rule.medicationKeyword ? medicationText.includes(rule.medicationKeyword.toLowerCase()) : false
      const conditionMatch = rule.conditionCode ? conditionText.includes(rule.conditionCode.toLowerCase()) || conditionText.includes('신장') : false
      return medicationMatch || conditionMatch
    })
    .map((rule) => {
      const nutrient = nutrients.find((item) => item.id === rule.nutrientId)
      return {
        severity: rule.severity,
        nutrientName: nutrient?.standardName ?? rule.nutrientId,
        message: rule.message,
        sourceNote: rule.sourceNote,
      }
    })

  const userNutrientIds = new Set(totals.map((total) => total.nutrientId))

  const synergyRecommendations: AnalysisReport['synergyRecommendations'] = SYNERGY_GROUPS.map((group) => {
    const matched = group.nutrients.filter((id) => userNutrientIds.has(id))
    const missing = group.nutrients.filter((id) => !userNutrientIds.has(id))
    if (matched.length < 1) return null
    if (matched.length === group.nutrients.length) {
      return {
        nutrients: group.nutrients,
        label: group.label,
        benefit: group.benefit,
        matchType: 'full' as const,
        missingNutrients: [],
        message: `보유하신 ${group.label} 조합은 ${group.benefit}`,
      }
    }
    const matchedNames = matched.map((id) => nutrients.find((n) => n.id === id)?.standardName ?? id)
    const missingNames = missing.map((id) => nutrients.find((n) => n.id === id)?.standardName ?? id)
    return {
      nutrients: group.nutrients,
      label: group.label,
      benefit: group.benefit,
      matchType: 'partial' as const,
      missingNutrients: missing,
      message: `${matchedNames.join('과 ')}를 보유 중입니다. ${missingNames.join('을')} 함께 섭취하면 ${group.benefit}`,
    }
  }).filter((item): item is NonNullable<typeof item> => item !== null)

  const antagonismWarnings: AnalysisReport['antagonismWarnings'] = ANTAGONISM_GROUPS
    .filter((group) => group.nutrients.every((id) => userNutrientIds.has(id)))
    .map((group) => ({
      nutrients: group.nutrients,
      label: group.label,
      message: `${group.reason} 최소 ${group.minIntervalHours}시간 이상 간격을 두고 복용하는 것이 좋습니다.`,
      severity: group.severity,
    }))

  const statusSummary = totals.reduce(
    (acc, total) => {
      acc[total.status] += 1
      return acc
    },
    { normal: 0, deficient: 0, caution: 0, excess: 0, review: 0 } satisfies AnalysisReport['statusSummary'],
  )

  const recommendations: AnalysisReport['recommendations'] = [
    ...totals
      .filter((total) => total.status === 'excess' || total.status === 'caution')
      .map((total) => {
        const topSource = [...total.sourceProducts].sort((a, b) => b.amount - a.amount)[0]
        return {
          status: total.status,
          title: `${total.standardName} 복용량 확인`,
          detail: `${topSource.productName}의 기여량이 가장 큽니다. 감량 여부는 의사/약사와 확인하세요.`,
        }
      }),
    ...totals
      .filter((total) => total.status === 'deficient')
      .map((total) => ({
        status: total.status,
        title: `${total.standardName} 부족 가능`,
        detail: '음식 섭취량과 건강 상태에 따라 달라질 수 있으니 필요 시 추가 보충 검토가 필요합니다.',
      })),
    ...duplicateItems.map((total) => ({
      status: 'duplicate' as const,
      title: `${total.standardName} 중복 섭취`,
      detail: `${total.sourceProducts.map((source) => source.productName).join(', ')}에서 같은 성분이 확인됐습니다.`,
    })),
    ...interactionWarnings.map((warning) => ({
      status: 'medication' as const,
      title: `${warning.nutrientName} 약물/질환 주의`,
      detail: warning.message,
    })),
  ]

  return {
    id: `report-${Date.now()}`,
    createdAt: new Date().toISOString(),
    statusSummary,
    totals,
    duplicateItems,
    interactionWarnings,
    recommendations,
    synergyRecommendations,
    antagonismWarnings,
  }
}

/** 위험 상태 enum 값을 사용자에게 표시할 한글 라벨로 변환합니다. */
export function statusLabel(status: RiskStatus): string {
  const labels: Record<RiskStatus, string> = {
    normal: '적정',
    deficient: '부족 가능',
    caution: '과다 주의',
    excess: '초과 위험',
    review: '확인 필요',
  }
  return labels[status]
}
