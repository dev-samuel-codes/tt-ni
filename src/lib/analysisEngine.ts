import {
  interactionRules,
  nutrients,
  referenceValues,
} from './nutritionData'
import type {
  AnalysisReport,
  Medication,
  NutrientTotal,
  Profile,
  ReferenceValue,
  RiskStatus,
  SupplementProduct,
  Unit,
} from './types'

export function getAge(profile: Pick<Profile, 'birthYear'>, now = new Date()): number {
  return Math.max(0, now.getFullYear() - profile.birthYear)
}

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

export function findReferenceValue(profile: Profile, nutrientId: string): ReferenceValue | undefined {
  const age = getAge(profile)
  return referenceValues.find((reference) => {
    const genderMatches = reference.gender === 'any' || reference.gender === profile.gender
    return reference.nutrientId === nutrientId && genderMatches && age >= reference.ageMin && age <= reference.ageMax
  })
}

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
  }
}

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
