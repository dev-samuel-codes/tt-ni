import { describe, expect, it } from 'vitest'
import { convertAmount, runAnalysis } from './analysisEngine'
import { createAnalysisReportFromServer } from './serverAnalysis'
import type { Medication, Profile, SupplementProduct } from '../../types'

const profile: Profile = {
  gender: 'female',
  birthYear: 1998,
  pregnancyStatus: 'none',
  lactationStatus: false,
  conditions: [],
  allergies: [],
  dietaryRestrictions: [],
  consentAccepted: true,
}

function product(id: string, productName: string, nutrientId: string, standardName: string, amount: number, unit: 'mg' | 'mcg' | 'IU'): SupplementProduct {
  return {
    id,
    productName,
    brandName: 'Test',
    sourceType: 'manual',
    dailyServings: 1,
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

describe('analysis engine', () => {
  it('converts vitamin D IU to mcg', () => {
    expect(convertAmount(1000, 'IU', 'mcg', 'vitamin_d')).toBe(25)
  })

  it('marks upper-limit nutrients as excess', () => {
    const report = runAnalysis(profile, [], [product('p1', '고함량 D', 'vitamin_d', '비타민 D', 5000, 'IU')])
    expect(report.totals[0].status).toBe('excess')
    expect(report.statusSummary.excess).toBe(1)
  })

  it('detects duplicate nutrients across products', () => {
    const report = runAnalysis(profile, [], [
      product('p1', '멀티비타민', 'zinc', '아연', 10, 'mg'),
      product('p2', '아연 단일제', 'zinc', '아연', 20, 'mg'),
    ])
    expect(report.duplicateItems).toHaveLength(1)
    expect(report.recommendations.some((item) => item.status === 'duplicate')).toBe(true)
  })

  it('matches medication interaction rules', () => {
    const medications: Medication[] = [
      {
        id: 'm1',
        name: 'warfarin',
        purpose: '항응고',
        frequency: '매일',
        memo: '',
      },
    ]
    const report = runAnalysis(profile, medications, [product('p1', 'K2', 'vitamin_k', '비타민 K', 90, 'mcg')])
    expect(report.interactionWarnings[0].message).toContain('와파린')
  })

  it('builds the displayed report from the Supabase analysis response', () => {
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

  it('detects synergy when coq10 and omega3 are both present', () => {
    const report = runAnalysis(profile, [], [
      product('p1', 'CoQ10', 'coq10', '코엔자임 Q10', 100, 'mg'),
      product('p2', '오메가3', 'omega3', '오메가3', 1000, 'mg'),
    ])
    const synergy = report.synergyRecommendations.find((s) => s.label === 'CoQ10 + 오메가3')
    expect(synergy).toBeDefined()
    expect(synergy!.matchType).toBe('full')
  })

  it('detects partial synergy when only one nutrient is present', () => {
    const report = runAnalysis(profile, [], [
      product('p1', '비타민C', 'vitamin_c', '비타민 C', 500, 'mg'),
    ])
    const partialSynergy = report.synergyRecommendations.find((s) => s.label === '비타민 C + 철분')
    expect(partialSynergy).toBeDefined()
    expect(partialSynergy!.matchType).toBe('partial')
    expect(partialSynergy!.missingNutrients).toContain('iron')
  })

  it('detects antagonism when calcium and iron are both present', () => {
    const report = runAnalysis(profile, [], [
      product('p1', '칼슘', 'calcium', '칼슘', 500, 'mg'),
      product('p2', '철분', 'iron', '철분', 18, 'mg'),
    ])
    expect(report.antagonismWarnings.length).toBeGreaterThan(0)
    const caFeAntagonism = report.antagonismWarnings.find((a) => a.label === '칼슘 ↔ 철분')
    expect(caFeAntagonism).toBeDefined()
  })
})
