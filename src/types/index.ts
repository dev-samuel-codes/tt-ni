/** 성별 */
type Gender = 'female' | 'male' | 'other'

/** 영양소 위험 상태 */
export type RiskStatus = 'normal' | 'deficient' | 'caution' | 'excess' | 'review'

/** 영양소 함량 단위 */
export type Unit = 'mg' | 'mcg' | 'IU' | 'g' | 'CFU' | 'unknown'

/** 사용자 건강 프로필 */
export interface Profile {
  gender: Gender
  birthYear: number
  heightCm?: number
  weightKg?: number
  pregnancyStatus: 'none' | 'pregnant' | 'planning' | 'unknown'
  lactationStatus: boolean
  conditions: string[]
  allergies: string[]
  dietaryRestrictions: string[]
  consentAccepted: boolean
}

/** 사용자 복용 약물 */
export interface Medication {
  id: string
  name: string
  purpose: string
  frequency: string
  memo: string
}

/** 파싱된 영양성분 (라벨 인식/검색/수동 입력 공통) */
export interface ParsedIngredient {
  id: string
  rawName: string
  standardName: string
  nutrientId: string
  amount: number | null
  unit: Unit
  confidence: number
  rawText: string
  reviewRequired: boolean
  benefit?: string
  recommendedDaily?: string
  caution?: string
}

/** 등록된 영양제 제품 (사용자별) */
export interface SupplementProduct {
  id: string
  productName: string
  brandName: string
  sourceType: 'manual' | 'photo'
  dailyServings: number
  intakeTime: string
  imageName?: string
  ingredients: ParsedIngredient[]
  confirmed: boolean
}

/** 영양소 메타데이터 (표준명, 카테고리, 별칭, 기본단위 등) */
export interface Nutrient {
  id: string
  standardName: string
  category: string
  aliases: string[]
  defaultUnit: Unit
  riskLevel: 'low' | 'medium' | 'high'
}

/** KDRIs 영양소별 참조 섭취량 기준 (성별·연령대별) */
export interface ReferenceValue {
  nutrientId: string
  gender: Gender | 'any'
  ageMin: number
  ageMax: number
  rda?: number
  ai?: number
  ul?: number
  unit: Unit
}

/** 약물/질환-영양소 상호작용 규칙 */
export interface InteractionRule {
  id: string
  nutrientId: string
  medicationKeyword?: string
  conditionCode?: string
  severity: 'notice' | 'caution' | 'high'
  message: string
  sourceNote: string
}

/** 영양소별 1일 총 섭취량 집계 결과 */
export interface NutrientTotal {
  nutrientId: string
  standardName: string
  totalAmount: number
  unit: Unit
  reference?: ReferenceValue
  status: RiskStatus
  percentOfTarget?: number
  percentOfUl?: number
  sourceProducts: Array<{
    productId: string
    productName: string
    amount: number
    unit: Unit
  }>
  message: string
}

/** 분석 리포트 (영양소별 상태, 상호작용, 추천 사항 포함) */
export interface AnalysisReport {
  id: string
  createdAt: string
  statusSummary: {
    normal: number
    deficient: number
    caution: number
    excess: number
    review: number
  }
  totals: NutrientTotal[]
  duplicateItems: NutrientTotal[]
  interactionWarnings: Array<{
    severity: InteractionRule['severity']
    nutrientName: string
    message: string
    sourceNote: string
  }>
  recommendations: Array<{
    status: RiskStatus | 'duplicate' | 'medication'
    title: string
    detail: string
  }>
  synergyRecommendations: Array<{
    nutrients: string[]
    label: string
    benefit: string
    matchType: 'full' | 'partial'
    missingNutrients: string[]
    message: string
  }>
  antagonismWarnings: Array<{
    nutrients: string[]
    label: string
    message: string
    severity: 'caution' | 'high'
  }>
}


