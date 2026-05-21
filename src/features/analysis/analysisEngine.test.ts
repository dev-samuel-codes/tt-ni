import { describe, expect, it } from 'vitest'
import { convertAmount, runAnalysis, getAge, findReferenceValue, statusLabel } from './analysisEngine'
import { createAnalysisReportFromServer } from './serverAnalysis'
import { findNutrientByName } from '../nutrition/nutritionData'
import type { Medication, Profile, SupplementProduct } from '../../types'

const defaultProfile: Profile = {
  gender: 'female',
  birthYear: 1998,
  pregnancyStatus: 'none',
  lactationStatus: false,
  conditions: [],
  allergies: [],
  dietaryRestrictions: [],
  consentAccepted: true,
}

function product(
  id: string,
  productName: string,
  nutrientId: string,
  standardName: string,
  amount: number,
  unit: 'mg' | 'mcg' | 'IU' | 'g' | 'CFU',
  dailyServings = 1,
): SupplementProduct {
  return {
    id,
    productName,
    brandName: 'Test',
    sourceType: 'manual',
    dailyServings,
    intakeTime: 'morning',
    confirmed: true,
    ingredients: [
      {
        id: `${id}-ingredient`,
        rawName: standardName,
        standardName,
        nutrientId,
        amount,
        unit,
        confidence: 1,
        rawText: 'manual',
        reviewRequired: false,
      },
    ],
  }
}

// ─── Unit Conversion Tests ───────────────────────────────────────
describe('convertAmount', () => {
  it('converts vitamin D IU to mcg', () => {
    expect(convertAmount(1000, 'IU', 'mcg', 'vitamin_d')).toBe(25)
    expect(convertAmount(400, 'IU', 'mcg', 'vitamin_d')).toBe(10)
    expect(convertAmount(25, 'mcg', 'IU', 'vitamin_d')).toBe(1000)
  })

  it('converts vitamin A IU to mcg', () => {
    expect(convertAmount(5000, 'IU', 'mcg', 'vitamin_a')).toBe(1500)
    expect(convertAmount(300, 'mcg', 'IU', 'vitamin_a')).toBe(1000)
  })

  it('converts vitamin E IU to mg', () => {
    expect(convertAmount(400, 'IU', 'mg', 'vitamin_e')).toBe(268)
    expect(convertAmount(15, 'mg', 'IU', 'vitamin_e')).toBeCloseTo(22.39, 0)
  })

  it('converts g to mg', () => {
    expect(convertAmount(1, 'g', 'mg', 'vitamin_c')).toBe(1000)
    expect(convertAmount(500, 'mg', 'g', 'vitamin_c')).toBe(0.5)
  })

  it('converts mg to mcg', () => {
    expect(convertAmount(1, 'mg', 'mcg', 'vitamin_b12')).toBe(1000)
    expect(convertAmount(500, 'mcg', 'mg', 'vitamin_b12')).toBe(0.5)
  })

  it('converts g to mcg', () => {
    expect(convertAmount(0.001, 'g', 'mcg', 'vitamin_b12')).toBe(1000)
    expect(convertAmount(1000000, 'mcg', 'g', 'vitamin_b12')).toBe(1)
  })

  it('returns same value for same unit', () => {
    expect(convertAmount(100, 'mg', 'mg', 'vitamin_c')).toBe(100)
  })

  it('returns null for unknown unit', () => {
    expect(convertAmount(100, 'unknown', 'mg', 'vitamin_c')).toBeNull()
    expect(convertAmount(100, 'mg', 'unknown', 'vitamin_c')).toBeNull()
  })

  it('returns null for unknown nutrient-specific conversion', () => {
    expect(convertAmount(400, 'IU', 'mg', 'vitamin_c')).toBeNull()
  })
})

// ─── getAge Tests ─────────────────────────────────────────────────
describe('getAge', () => {
  it('calculates current age from birth year', () => {
    expect(getAge({ birthYear: 1998 }, new Date('2026-05-21'))).toBe(28)
    expect(getAge({ birthYear: 2000 }, new Date('2026-05-21'))).toBe(26)
    expect(getAge({ birthYear: 1960 }, new Date('2026-05-21'))).toBe(66)
  })

  it('never returns negative age', () => {
    expect(getAge({ birthYear: 2030 }, new Date('2026-05-21'))).toBe(0)
  })
})

// ─── findReferenceValue Tests ─────────────────────────────────────
describe('findReferenceValue', () => {
  it('finds age-appropriate reference for female', () => {
    const ref = findReferenceValue({ ...defaultProfile, gender: 'female', birthYear: 1970 }, 'iron')
    expect(ref).toBeDefined()
    expect(ref!.rda).toBe(8)
    expect(ref!.ul).toBe(45)
  })

  it('finds reference for elderly male', () => {
    const ref = findReferenceValue({ ...defaultProfile, gender: 'male', birthYear: 1950 }, 'vitamin_d')
    expect(ref).toBeDefined()
    expect(ref!.ai).toBe(15)
  })

  it('finds reference for young adult vitamin D', () => {
    const ref = findReferenceValue({ ...defaultProfile, gender: 'male', birthYear: 1995 }, 'vitamin_d')
    expect(ref).toBeDefined()
    expect(ref!.ai).toBe(10)
  })
})

// ─── statusLabel Tests ────────────────────────────────────────────
describe('statusLabel', () => {
  it('returns correct Korean labels', () => {
    expect(statusLabel('normal')).toBe('적정')
    expect(statusLabel('deficient')).toBe('부족 가능')
    expect(statusLabel('caution')).toBe('과다 주의')
    expect(statusLabel('excess')).toBe('초과 위험')
    expect(statusLabel('review')).toBe('확인 필요')
  })
})

// ─── Analysis Engine Core Tests ───────────────────────────────────
describe('runAnalysis', () => {
  it('marks upper-limit nutrients as excess', () => {
    const report = runAnalysis(defaultProfile, [], [product('p1', '고함량 D', 'vitamin_d', '비타민 D', 5000, 'IU')])
    expect(report.totals[0].status).toBe('excess')
    expect(report.statusSummary.excess).toBe(1)
  })

  it('detects duplicate nutrients across products', () => {
    const report = runAnalysis(defaultProfile, [], [
      product('p1', '멀티비타민', 'zinc', '아연', 10, 'mg'),
      product('p2', '아연 단일제', 'zinc', '아연', 20, 'mg'),
    ])
    expect(report.duplicateItems).toHaveLength(1)
    expect(report.recommendations.some((item) => item.status === 'duplicate')).toBe(true)
  })

  it('matches medication interaction rules', () => {
    const medications: Medication[] = [
      { id: 'm1', name: 'warfarin', purpose: '항응고', frequency: '매일', memo: '' },
    ]
    const report = runAnalysis(defaultProfile, medications, [product('p1', 'K2', 'vitamin_k', '비타민 K', 90, 'mcg')])
    expect(report.interactionWarnings[0].message).toContain('와파린')
  })

  it('detects synergy when coq10 and omega3 are both present', () => {
    const report = runAnalysis(defaultProfile, [], [
      product('p1', 'CoQ10', 'coq10', '코엔자임 Q10', 100, 'mg'),
      product('p2', '오메가3', 'omega3', '오메가3', 1000, 'mg'),
    ])
    const synergy = report.synergyRecommendations.find((s) => s.label === 'CoQ10 + 오메가3')
    expect(synergy).toBeDefined()
    expect(synergy!.matchType).toBe('full')
  })

  it('detects partial synergy when only one nutrient is present', () => {
    const report = runAnalysis(defaultProfile, [], [
      product('p1', '비타민C', 'vitamin_c', '비타민 C', 500, 'mg'),
    ])
    const partialSynergy = report.synergyRecommendations.find((s) => s.label === '비타민 C + 철분')
    expect(partialSynergy).toBeDefined()
    expect(partialSynergy!.matchType).toBe('partial')
    expect(partialSynergy!.missingNutrients).toContain('iron')
  })

  it('detects antagonism when calcium and iron are both present', () => {
    const report = runAnalysis(defaultProfile, [], [
      product('p1', '칼슘', 'calcium', '칼슘', 500, 'mg'),
      product('p2', '철분', 'iron', '철분', 18, 'mg'),
    ])
    expect(report.antagonismWarnings.length).toBeGreaterThan(0)
    const caFeAntagonism = report.antagonismWarnings.find((a) => a.label === '칼슘 ↔ 철분')
    expect(caFeAntagonism).toBeDefined()
  })

  // C-06: Selenium synergy group fix verification
  it('requires selenium for full match on iron+vitaminC+selenium synergy', () => {
    // Without selenium → partial (not full)
    const reportNoSe = runAnalysis(defaultProfile, [], [
      product('p1', '철분', 'iron', '철분', 18, 'mg'),
      product('p2', '비타민C', 'vitamin_c', '비타민 C', 500, 'mg'),
    ])
    const synergyPartial = reportNoSe.synergyRecommendations.find((s) => s.label === '철분 + 비타민 C + 셀레늄')
    expect(synergyPartial).toBeDefined()
    expect(synergyPartial!.matchType).toBe('partial')

    // With selenium → full match
    const reportFull = runAnalysis(defaultProfile, [], [
      product('p1', '철분', 'iron', '철분', 18, 'mg'),
      product('p2', '비타민C', 'vitamin_c', '비타민 C', 500, 'mg'),
      product('p3', '셀레늄', 'selenium', '셀레늄', 75, 'mcg'),
    ])
    const synergyFull = reportFull.synergyRecommendations.find((s) => s.label === '철분 + 비타민 C + 셀레늄')
    expect(synergyFull).toBeDefined()
    expect(synergyFull!.matchType).toBe('full')
  })

  // C-07: Magnesium without UL should not show excess for moderate intake
  it('does not flag moderate magnesium as excess since UL removed', () => {
    const report = runAnalysis(
      { ...defaultProfile, gender: 'female', birthYear: 1998 },
      [],
      [product('p1', '마그네슘', 'magnesium', '마그네슘', 350, 'mg')],
    )
    const mgTotal = report.totals.find((t) => t.nutrientId === 'magnesium')
    expect(mgTotal).toBeDefined()
    expect(mgTotal!.status).not.toBe('excess')
  })

  it('flags magnesium as deficient when below RDA', () => {
    const report = runAnalysis(
      { ...defaultProfile, gender: 'female', birthYear: 1998 },
      [],
      [product('p1', '마그네슘', 'magnesium', '마그네슘', 96, 'mg')], // 30% of 320 RDA
    )
    const mgTotal = report.totals.find((t) => t.nutrientId === 'magnesium')
    expect(mgTotal).toBeDefined()
    expect(mgTotal!.status).toBe('deficient')
  })

  it('handles dailyServings multiplier', () => {
    const report = runAnalysis(defaultProfile, [], [
      product('p1', '비타민C 2회', 'vitamin_c', '비타민 C', 1000, 'mg', 2),
    ])
    const vcTotal = report.totals.find((t) => t.nutrientId === 'vitamin_c')
    expect(vcTotal).toBeDefined()
    expect(vcTotal!.totalAmount).toBe(2000)
  })

  it('filters out unconfirmed supplements', () => {
    const unconfirmed: SupplementProduct = {
      ...product('p1', '미확정', 'vitamin_c', '비타민 C', 1000, 'mg'),
      confirmed: false,
    }
    const report = runAnalysis(defaultProfile, [], [unconfirmed])
    expect(report.totals).toHaveLength(0)
  })

  it('skips ingredients with null amount', () => {
    const withNull: SupplementProduct = {
      ...product('p1', '널', 'vitamin_c', '비타민 C', 0, 'mg'),
      ingredients: [
        {
          id: 'ing1', rawName: '비타민 C', standardName: '비타민 C',
          nutrientId: 'vitamin_c', amount: null, unit: 'mg',
          confidence: 1, rawText: 'manual', reviewRequired: false,
        },
      ],
    }
    const report = runAnalysis(defaultProfile, [], [withNull])
    expect(report.totals).toHaveLength(0)
  })

  it('detects review status for nutrients without KDRIs reference', () => {
    const report = runAnalysis(defaultProfile, [], [
      product('p1', '유산균', 'probiotics', '유산균', 1000000, 'CFU'),
    ])
    const probTotal = report.totals.find((t) => t.nutrientId === 'probiotics')
    expect(probTotal).toBeDefined()
    expect(probTotal!.status).toBe('review')
  })

  it('detects all synergy groups correctly', () => {
    const report = runAnalysis(defaultProfile, [], [
      product('p1', 'CoQ10', 'coq10', '코엔자임 Q10', 100, 'mg'),
      product('p2', '오메가3', 'omega3', '오메가3', 1000, 'mg'),
      product('p3', '비타민C', 'vitamin_c', '비타민 C', 500, 'mg'),
      product('p4', '철분', 'iron', '철분', 18, 'mg'),
      product('p5', '비타민E', 'vitamin_e', '비타민 E', 15, 'mg'),
      product('p6', '콜라겐', 'collagen', '콜라겐', 1000, 'mg'),
      product('p7', '셀레늄', 'selenium', '셀레늄', 75, 'mcg'),
    ])
    expect(report.synergyRecommendations.length).toBeGreaterThanOrEqual(5)
    const fullMatches = report.synergyRecommendations.filter((s) => s.matchType === 'full')
    expect(fullMatches.length).toBeGreaterThanOrEqual(3)
  })

  it('detects calcium-magnesium-zinc triple antagonism', () => {
    const report = runAnalysis(defaultProfile, [], [
      product('p1', '칼슘', 'calcium', '칼슘', 500, 'mg'),
      product('p2', '마그네슘', 'magnesium', '마그네슘', 300, 'mg'),
      product('p3', '아연', 'zinc', '아연', 15, 'mg'),
    ])
    const triple = report.antagonismWarnings.find((a) => a.label === '칼슘 ↔ 마그네슘 ↔ 아연')
    expect(triple).toBeDefined()
  })

  it('marks status as caution when approaching UL', () => {
    const report = runAnalysis(defaultProfile, [], [
      product('p1', '비타민C', 'vitamin_c', '비타민 C', 1700, 'mg'), // 85% of 2000 UL
    ])
    const vcTotal = report.totals.find((t) => t.nutrientId === 'vitamin_c')
    expect(vcTotal).toBeDefined()
    expect(vcTotal!.status).toBe('caution')
  })

  it('marks status as normal when within range', () => {
    const report = runAnalysis(defaultProfile, [], [
      product('p1', '비타민C', 'vitamin_c', '비타민 C', 90, 'mg'), // Just at RDA
    ])
    const vcTotal = report.totals.find((t) => t.nutrientId === 'vitamin_c')
    expect(vcTotal).toBeDefined()
    expect(vcTotal!.status).toBe('normal')
  })
})

// ─── Server Analysis Report Tests ─────────────────────────────────
describe('createAnalysisReportFromServer', () => {
  it('builds the displayed report from the server analysis response', () => {
    const report = createAnalysisReportFromServer({
      analysis_report_id: 'remote-report',
      summary: { caution: 1 },
      totalNutrients: [
        {
          nutrientId: 'zinc',
          standardName: '아연',
          totalAmount: 32,
          unit: 'mg',
          status: 'caution',
          sources: ['멀티비타민', '아연 단일제'],
        },
      ],
      recommendations: [
        {
          title: '아연 확인',
          detail: '멀티비타민, 아연 단일제에서 중복됩니다.',
        },
      ],
      interactionWarnings: [
        {
          severity: 'high',
          nutrientName: '비타민 K',
          message: '와파린 계열 약 복용 중에는 비타민 K 섭취 변동을 전문가와 확인하세요.',
        },
      ],
    })

    expect(report.id).toBe('remote-report')
    expect(report.statusSummary.caution).toBe(1)
    expect(report.duplicateItems).toHaveLength(1)
    expect(report.interactionWarnings[0].severity).toBe('high')
    expect(report.totals[0].sourceProducts.map((source) => source.productName)).toEqual(['멀티비타민', '아연 단일제'])
    expect(report.recommendations[0].title).toBe('아연 확인')
  })
})

// ─── Nutrient Name Matching Tests (W-09 fix) ──────────────────────
describe('findNutrientByName', () => {
  it('matches by standard name exactly', () => {
    const result = findNutrientByName('마그네슘')
    expect(result).toBeDefined()
    expect(result!.id).toBe('magnesium')
  })

  it('matches by alias', () => {
    const result = findNutrientByName('thiamine')
    expect(result).toBeDefined()
    expect(result!.id).toBe('vitamin_b1')
  })

  it('does not match mg unit as magnesium', () => {
    const result = findNutrientByName('1000mg')
    expect(result?.id).toBeUndefined()
  })

  it('does not match omega3 with mg suffix as magnesium', () => {
    const result = findNutrientByName('오메가3 1000mg')
    expect(result?.id === 'magnesium').toBe(false)
  })

  it('matches cholecalciferol as vitamin D', () => {
    const result = findNutrientByName('cholecalciferol')
    expect(result).toBeDefined()
    expect(result!.id).toBe('vitamin_d')
  })

  it('matches selenium', () => {
    const result = findNutrientByName('셀레늄')
    expect(result).toBeDefined()
    expect(result!.id).toBe('selenium')
  })
})
