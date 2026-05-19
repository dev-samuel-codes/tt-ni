export type Gender = 'female' | 'male' | 'other'

export type RiskStatus = 'normal' | 'deficient' | 'caution' | 'excess' | 'review'

export type Unit = 'mg' | 'mcg' | 'IU' | 'g' | 'CFU' | 'unknown'

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

export interface Medication {
  id: string
  name: string
  purpose: string
  frequency: string
  memo: string
}

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

export interface Nutrient {
  id: string
  standardName: string
  category: string
  aliases: string[]
  defaultUnit: Unit
  riskLevel: 'low' | 'medium' | 'high'
}

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

export interface InteractionRule {
  id: string
  nutrientId: string
  medicationKeyword?: string
  conditionCode?: string
  severity: 'notice' | 'caution' | 'high'
  message: string
  sourceNote: string
}

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

export interface ParseResult {
  productName: string | null
  servingSize: {
    amount: number | null
    unit: string | null
  }
  dailyServingsRecommended: number | null
  ingredients: ParsedIngredient[]
  warnings: string[]
}
