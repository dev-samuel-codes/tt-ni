import type { InteractionRule, Nutrient, ReferenceValue } from '../../types'

/**
 * 지원 영양소 데이터베이스
 * 각 영양소의 ID, 표준명, 카테고리, 별칭, 기본 단위, 위험도를 정의합니다.
 * 별칭(aliases)은 성분표 파싱/검색 시 매칭에 사용됩니다.
 */
export const nutrients: Nutrient[] = [
  {
    id: 'vitamin_a',
    standardName: '비타민 A',
    category: '비타민',
    aliases: ['vitamin a', 'retinol', '레티놀', '베타카로틴', 'beta carotene'],
    defaultUnit: 'mcg',
    riskLevel: 'high',
  },
  {
    id: 'vitamin_b1',
    standardName: '비타민 B1',
    category: '비타민',
    aliases: ['b1', 'thiamine', '티아민'],
    defaultUnit: 'mg',
    riskLevel: 'low',
  },
  {
    id: 'vitamin_b6',
    standardName: '비타민 B6',
    category: '비타민',
    aliases: ['b6', 'pyridoxine', '피리독신'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'vitamin_b12',
    standardName: '비타민 B12',
    category: '비타민',
    aliases: ['b12', 'cobalamin', '코발라민'],
    defaultUnit: 'mcg',
    riskLevel: 'low',
  },
  {
    id: 'vitamin_c',
    standardName: '비타민 C',
    category: '비타민',
    aliases: ['vitamin c', 'ascorbic acid', '아스코르브산'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'vitamin_d',
    standardName: '비타민 D',
    category: '비타민',
    aliases: ['vitamin d', 'd3', 'cholecalciferol', '콜레칼시페롤'],
    defaultUnit: 'mcg',
    riskLevel: 'high',
  },
  {
    id: 'vitamin_e',
    standardName: '비타민 E',
    category: '비타민',
    aliases: ['vitamin e', 'tocopherol', '토코페롤'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'vitamin_k',
    standardName: '비타민 K',
    category: '비타민',
    aliases: ['vitamin k', 'k1', 'k2', 'phylloquinone', 'menaquinone'],
    defaultUnit: 'mcg',
    riskLevel: 'high',
  },
  {
    id: 'calcium',
    standardName: '칼슘',
    category: '미네랄',
    aliases: ['calcium', 'ca', '칼슘'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'magnesium',
    standardName: '마그네슘',
    category: '미네랄',
    aliases: ['magnesium', 'mg ', '마그네슘'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'zinc',
    standardName: '아연',
    category: '미네랄',
    aliases: ['zinc', 'zn', '아연'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'iron',
    standardName: '철분',
    category: '미네랄',
    aliases: ['iron', 'fe', '철'],
    defaultUnit: 'mg',
    riskLevel: 'high',
  },
  {
    id: 'omega3',
    standardName: '오메가3',
    category: '지방산',
    aliases: ['omega 3', 'omega-3', 'epa', 'dha', '오메가'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'choline',
    standardName: '콜린',
    category: '비타민',
    aliases: ['choline', '콜린'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'ginseng',
    standardName: '홍삼',
    category: '허브/추출물',
    aliases: ['ginseng', 'red ginseng', '홍삼', '인삼', '진세노사이드', 'ginsenoside'],
    defaultUnit: 'mg',
    riskLevel: 'high',
  },
  {
    id: 'grapefruit',
    standardName: '자몽 추출물',
    category: '허브/추출물',
    aliases: ['grapefruit', '자몽', '자몽추출물'],
    defaultUnit: 'mg',
    riskLevel: 'high',
  },
  {
    id: 'coq10',
    standardName: '코엔자임 Q10',
    category: '항산화제',
    aliases: ['coq10', '코엔자임', '코엔자임큐텐', 'ubiquinone', '유비퀴논'],
    defaultUnit: 'mg',
    riskLevel: 'low',
  },
  {
    id: 'probiotics',
    standardName: '유산균',
    category: '유익균',
    aliases: ['probiotics', '프로바이오틱스', '유산균', 'lactobacillus'],
    defaultUnit: 'CFU',
    riskLevel: 'low',
  },
]

/**
 * 한국인 영양섭취기준(KDRIs 2025) 참조치
 * 성별·연령대별 RDA(권장섭취량), AI(충분섭취량), UL(상한섭취량)을 정의합니다.
 * gender가 'any'면 모든 성별에 적용됩니다.
 */
export const referenceValues: ReferenceValue[] = [
  { nutrientId: 'vitamin_a', gender: 'male', ageMin: 19, ageMax: 150, rda: 900, ul: 3000, unit: 'mcg' },
  { nutrientId: 'vitamin_a', gender: 'female', ageMin: 19, ageMax: 150, rda: 700, ul: 3000, unit: 'mcg' },
  { nutrientId: 'vitamin_b1', gender: 'male', ageMin: 19, ageMax: 150, rda: 1.2, unit: 'mg' },
  { nutrientId: 'vitamin_b1', gender: 'female', ageMin: 19, ageMax: 150, rda: 1.1, unit: 'mg' },
  { nutrientId: 'vitamin_b6', gender: 'any', ageMin: 19, ageMax: 50, rda: 1.3, ul: 100, unit: 'mg' },
  { nutrientId: 'vitamin_b12', gender: 'any', ageMin: 19, ageMax: 150, rda: 2.4, unit: 'mcg' },
  { nutrientId: 'vitamin_c', gender: 'male', ageMin: 19, ageMax: 150, rda: 90, ul: 2000, unit: 'mg' },
  { nutrientId: 'vitamin_c', gender: 'female', ageMin: 19, ageMax: 150, rda: 75, ul: 2000, unit: 'mg' },
  { nutrientId: 'vitamin_d', gender: 'any', ageMin: 19, ageMax: 70, rda: 15, ul: 100, unit: 'mcg' },
  { nutrientId: 'vitamin_d', gender: 'any', ageMin: 71, ageMax: 150, rda: 20, ul: 100, unit: 'mcg' },
  { nutrientId: 'vitamin_e', gender: 'any', ageMin: 19, ageMax: 150, rda: 15, ul: 1000, unit: 'mg' },
  { nutrientId: 'vitamin_k', gender: 'male', ageMin: 19, ageMax: 150, ai: 120, unit: 'mcg' },
  { nutrientId: 'vitamin_k', gender: 'female', ageMin: 19, ageMax: 150, ai: 90, unit: 'mcg' },
  { nutrientId: 'calcium', gender: 'any', ageMin: 19, ageMax: 50, rda: 1000, ul: 2500, unit: 'mg' },
  { nutrientId: 'calcium', gender: 'any', ageMin: 51, ageMax: 150, rda: 1200, ul: 2000, unit: 'mg' },
  { nutrientId: 'magnesium', gender: 'male', ageMin: 19, ageMax: 150, rda: 420, ul: 350, unit: 'mg' },
  { nutrientId: 'magnesium', gender: 'female', ageMin: 19, ageMax: 150, rda: 320, ul: 350, unit: 'mg' },
  { nutrientId: 'zinc', gender: 'male', ageMin: 19, ageMax: 150, rda: 11, ul: 40, unit: 'mg' },
  { nutrientId: 'zinc', gender: 'female', ageMin: 19, ageMax: 150, rda: 8, ul: 40, unit: 'mg' },
  { nutrientId: 'iron', gender: 'male', ageMin: 19, ageMax: 150, rda: 8, ul: 45, unit: 'mg' },
  { nutrientId: 'iron', gender: 'female', ageMin: 19, ageMax: 50, rda: 18, ul: 45, unit: 'mg' },
  { nutrientId: 'iron', gender: 'female', ageMin: 51, ageMax: 150, rda: 8, ul: 45, unit: 'mg' },
  { nutrientId: 'omega3', gender: 'any', ageMin: 19, ageMax: 150, ai: 1100, unit: 'mg' },
]

/**
 * 약물-영양소 및 질환-영양소 상호작용 규칙
 * medicationKeyword: 약물명 키워드(소문자). medicationText에 포함되면 매칭
 * conditionCode: 건강 상태 코드. conditionText에 포함되면 매칭
 * severity: notice(참고), caution(주의), high(위험)
 */
export const interactionRules: InteractionRule[] = [
  {
    id: 'warfarin-vitamin-k',
    nutrientId: 'vitamin_k',
    medicationKeyword: 'warfarin',
    severity: 'high',
    message: '와파린 계열 약 복용 중에는 비타민 K 섭취 변동을 전문가와 확인하세요.',
    sourceNote: 'MVP rule: anticoagulant nutrient consistency warning',
  },
  {
    id: 'warfarin-omega3',
    nutrientId: 'omega3',
    medicationKeyword: 'warfarin',
    severity: 'caution',
    message: '항응고제 복용 중 고용량 오메가3는 출혈 위험 상담이 필요할 수 있습니다.',
    sourceNote: 'MVP rule: anticoagulant high-dose omega-3 caution',
  },
  {
    id: 'thyroid-calcium',
    nutrientId: 'calcium',
    medicationKeyword: 'levothyroxine',
    severity: 'caution',
    message: '갑상선 호르몬제와 칼슘은 복용 간격을 확인하는 것이 좋습니다.',
    sourceNote: 'MVP rule: thyroid medication spacing',
  },
  {
    id: 'thyroid-iron',
    nutrientId: 'iron',
    medicationKeyword: 'levothyroxine',
    severity: 'caution',
    message: '갑상선 호르몬제와 철분은 흡수 간섭 가능성이 있어 복용 간격 확인이 필요합니다.',
    sourceNote: 'MVP rule: thyroid medication spacing',
  },
  {
    id: 'kidney-magnesium',
    nutrientId: 'magnesium',
    conditionCode: 'kidney',
    severity: 'high',
    message: '신장 질환이 있으면 마그네슘 보충제 복용 전 전문가 상담이 필요합니다.',
    sourceNote: 'MVP rule: renal condition mineral caution',
  },
  {
    id: 'diabetes-ginseng',
    nutrientId: 'ginseng',
    medicationKeyword: 'insulin',
    severity: 'high',
    message: '인슐린/당뇨약 복용 중 홍삼(진세노사이드) 고용량 섭취는 중증 저혈당 쇼크 위험이 있습니다.',
    sourceNote: 'Report: Ginsenoside insulin sensitivity amplification',
  },
  {
    id: 'statin-grapefruit',
    nutrientId: 'grapefruit',
    medicationKeyword: 'statin',
    severity: 'high',
    message: '스타틴 계열 고지혈증 약 복용 중 자몽 추출물 섭취는 절대 금기입니다 (횡문근융해증 위험).',
    sourceNote: 'Report: CYP3A4 inhibition by furanocoumarin',
  },
  {
    id: 'metformin-b12',
    nutrientId: 'vitamin_b12',
    medicationKeyword: 'metformin',
    severity: 'caution',
    message: '메트포르민 장기 복용은 비타민 B12 고갈을 유발할 수 있으므로 보충이 권장됩니다.',
    sourceNote: 'Report: Metformin induces B12 depletion',
  },
  {
    id: 'statin-coq10',
    nutrientId: 'coq10',
    medicationKeyword: 'statin',
    severity: 'caution',
    message: '스타틴 계열 약물은 체내 코엔자임 Q10을 고갈시키므로 병용 섭취가 권장됩니다.',
    sourceNote: 'Report: Statin induces CoQ10 depletion',
  },
  {
    id: 'antibiotics-probiotics',
    nutrientId: 'probiotics',
    medicationKeyword: 'antibiotic',
    severity: 'high',
    message: '항생제 복용 시 유산균이 사멸하므로 최소 2시간 이상의 간격을 두고 섭취하세요.',
    sourceNote: 'Report: Antibiotics destroy probiotics',
  },
  {
    id: 'osteoporosis-calcium',
    nutrientId: 'calcium',
    medicationKeyword: 'bisphosphonate',
    severity: 'high',
    message: '골다공증 약(비스포스포네이트)은 미네랄과 킬레이트를 형성하므로 최소 2~4시간 간격을 두세요.',
    sourceNote: 'Report: Bisphosphonate chelation with minerals',
  },
  {
    id: 'calcium-iron-antagonism',
    nutrientId: 'iron',
    conditionCode: '',
    severity: 'caution',
    message: '칼슘과 철분은 동시 복용 시 흡수 경쟁이 발생하므로 2~4시간 간격을 두는 것이 좋습니다.',
    sourceNote: 'Report: DMT1 transporter competition',
  }
]


/**
 * 성분명으로 영양소를 검색합니다.
 * 표준명 정확 일치 또는 별칭 포함 여부로 매칭합니다.
 * 검색어는 소문자로 정규화하여 비교합니다.
 */
export function findNutrientByName(name: string): Nutrient | undefined {
  const normalized = name.trim().toLowerCase()
  return nutrients.find((nutrient) => {
    return (
      nutrient.standardName.toLowerCase() === normalized ||
      nutrient.aliases.some((alias) => normalized.includes(alias.toLowerCase()))
    )
  })
}
