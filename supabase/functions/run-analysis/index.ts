import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

interface Ingredient {
  nutrientId: string
  standardName: string
  amount: number | null
  unit: 'mg' | 'mcg' | 'IU' | 'g' | 'CFU' | 'unknown'
}

interface Profile {
  gender: 'female' | 'male' | 'other'
  birthYear: number
  conditions: string[]
}

interface Medication {
  name: string
  memo?: string
}

interface Supplement {
  id: string
  productName: string
  dailyServings: number
  ingredients: Ingredient[]
  confirmed: boolean
}

type RiskStatus = 'normal' | 'deficient' | 'caution' | 'excess' | 'review'

interface Reference {
  nutrientId: string
  gender: Profile['gender'] | 'any'
  ageMin: number
  ageMax: number
  target?: number
  ul?: number
  unit: Ingredient['unit']
}

interface InteractionRule {
  nutrientId: string
  medicationKeyword?: string
  conditionCode?: string
  severity: 'notice' | 'caution' | 'high'
  nutrientName: string
  message: string
  sourceNote: string
}

const defaultUnits: Record<string, Ingredient['unit']> = {
  vitamin_a: 'mcg',
  vitamin_b1: 'mg',
  vitamin_b6: 'mg',
  vitamin_b12: 'mcg',
  vitamin_c: 'mg',
  vitamin_d: 'mcg',
  vitamin_e: 'mg',
  vitamin_k: 'mcg',
  calcium: 'mg',
  magnesium: 'mg',
  zinc: 'mg',
  iron: 'mg',
  omega3: 'mg',
}

const references: Reference[] = [
  { nutrientId: 'vitamin_a', gender: 'male', ageMin: 19, ageMax: 150, target: 900, ul: 3000, unit: 'mcg' },
  { nutrientId: 'vitamin_a', gender: 'female', ageMin: 19, ageMax: 150, target: 700, ul: 3000, unit: 'mcg' },
  { nutrientId: 'vitamin_b1', gender: 'male', ageMin: 19, ageMax: 150, target: 1.2, unit: 'mg' },
  { nutrientId: 'vitamin_b1', gender: 'female', ageMin: 19, ageMax: 150, target: 1.1, unit: 'mg' },
  { nutrientId: 'vitamin_b6', gender: 'any', ageMin: 19, ageMax: 50, target: 1.3, ul: 100, unit: 'mg' },
  { nutrientId: 'vitamin_b12', gender: 'any', ageMin: 19, ageMax: 150, target: 2.4, unit: 'mcg' },
  { nutrientId: 'vitamin_c', gender: 'male', ageMin: 19, ageMax: 150, target: 90, ul: 2000, unit: 'mg' },
  { nutrientId: 'vitamin_c', gender: 'female', ageMin: 19, ageMax: 150, target: 75, ul: 2000, unit: 'mg' },
  { nutrientId: 'vitamin_d', gender: 'any', ageMin: 19, ageMax: 70, target: 15, ul: 100, unit: 'mcg' },
  { nutrientId: 'vitamin_d', gender: 'any', ageMin: 71, ageMax: 150, target: 20, ul: 100, unit: 'mcg' },
  { nutrientId: 'vitamin_e', gender: 'any', ageMin: 19, ageMax: 150, target: 15, ul: 1000, unit: 'mg' },
  { nutrientId: 'vitamin_k', gender: 'male', ageMin: 19, ageMax: 150, target: 120, unit: 'mcg' },
  { nutrientId: 'vitamin_k', gender: 'female', ageMin: 19, ageMax: 150, target: 90, unit: 'mcg' },
  { nutrientId: 'calcium', gender: 'any', ageMin: 19, ageMax: 50, target: 1000, ul: 2500, unit: 'mg' },
  { nutrientId: 'calcium', gender: 'any', ageMin: 51, ageMax: 150, target: 1200, ul: 2000, unit: 'mg' },
  { nutrientId: 'magnesium', gender: 'male', ageMin: 19, ageMax: 150, target: 420, ul: 350, unit: 'mg' },
  { nutrientId: 'magnesium', gender: 'female', ageMin: 19, ageMax: 150, target: 320, ul: 350, unit: 'mg' },
  { nutrientId: 'zinc', gender: 'male', ageMin: 19, ageMax: 150, target: 11, ul: 40, unit: 'mg' },
  { nutrientId: 'zinc', gender: 'female', ageMin: 19, ageMax: 150, target: 8, ul: 40, unit: 'mg' },
  { nutrientId: 'iron', gender: 'male', ageMin: 19, ageMax: 150, target: 8, ul: 45, unit: 'mg' },
  { nutrientId: 'iron', gender: 'female', ageMin: 19, ageMax: 50, target: 18, ul: 45, unit: 'mg' },
  { nutrientId: 'iron', gender: 'female', ageMin: 51, ageMax: 150, target: 8, ul: 45, unit: 'mg' },
  { nutrientId: 'omega3', gender: 'any', ageMin: 19, ageMax: 150, target: 1100, unit: 'mg' },
]

const interactionRules: InteractionRule[] = [
  {
    nutrientId: 'vitamin_k',
    medicationKeyword: 'warfarin',
    severity: 'high',
    nutrientName: '비타민 K',
    message: '와파린 계열 약 복용 중에는 비타민 K 섭취 변동을 전문가와 확인하세요.',
    sourceNote: 'MVP rule: anticoagulant nutrient consistency warning',
  },
  {
    nutrientId: 'omega3',
    medicationKeyword: 'warfarin',
    severity: 'caution',
    nutrientName: '오메가3',
    message: '항응고제 복용 중 고용량 오메가3는 출혈 위험 상담이 필요할 수 있습니다.',
    sourceNote: 'MVP rule: anticoagulant high-dose omega-3 caution',
  },
  {
    nutrientId: 'calcium',
    medicationKeyword: 'levothyroxine',
    severity: 'caution',
    nutrientName: '칼슘',
    message: '갑상선 호르몬제와 칼슘은 복용 간격을 확인하는 것이 좋습니다.',
    sourceNote: 'MVP rule: thyroid medication spacing',
  },
  {
    nutrientId: 'iron',
    medicationKeyword: 'levothyroxine',
    severity: 'caution',
    nutrientName: '철분',
    message: '갑상선 호르몬제와 철분은 흡수 간섭 가능성이 있어 복용 간격 확인이 필요합니다.',
    sourceNote: 'MVP rule: thyroid medication spacing',
  },
  {
    nutrientId: 'magnesium',
    conditionCode: 'kidney',
    severity: 'high',
    nutrientName: '마그네슘',
    message: '신장 질환이 있으면 마그네슘 보충제 복용 전 전문가 상담이 필요합니다.',
    sourceNote: 'MVP rule: renal condition mineral caution',
  },
]

function getServiceKey(): string {
  const projectKey = Deno.env.get('TT_NI_SERVICE_ROLE_KEY')
  if (projectKey) return projectKey
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  const secrets = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!secrets) throw new Error('TT_NI_SERVICE_ROLE_KEY, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_SECRET_KEYS is required')
  const parsed = JSON.parse(secrets) as Record<string, string>
  const first = Object.values(parsed)[0]
  if (!first) throw new Error('No Supabase secret key was found')
  return first
}

function convert(amount: number, from: Ingredient['unit'], to: Ingredient['unit'], nutrientId: string): number | null {
  if (from === to) return amount
  if (from === 'unknown' || to === 'unknown') return null
  if (from === 'g' && to === 'mg') return amount * 1000
  if (from === 'mg' && to === 'g') return amount / 1000
  if (from === 'mg' && to === 'mcg') return amount * 1000
  if (from === 'mcg' && to === 'mg') return amount / 1000
  if (from === 'g' && to === 'mcg') return amount * 1_000_000
  if (from === 'mcg' && to === 'g') return amount / 1_000_000
  if (nutrientId === 'vitamin_d' && from === 'IU' && to === 'mcg') return amount / 40
  if (nutrientId === 'vitamin_d' && from === 'mcg' && to === 'IU') return amount * 40
  if (nutrientId === 'vitamin_a' && from === 'IU' && to === 'mcg') return amount * 0.3
  if (nutrientId === 'vitamin_a' && from === 'mcg' && to === 'IU') return amount / 0.3
  if (nutrientId === 'vitamin_e' && from === 'IU' && to === 'mg') return amount * 0.67
  if (nutrientId === 'vitamin_e' && from === 'mg' && to === 'IU') return amount / 0.67
  return null
}

function getAge(profile: Profile): number {
  return Math.max(0, new Date().getFullYear() - profile.birthYear)
}

function findReference(profile: Profile, nutrientId: string): Reference | undefined {
  const age = getAge(profile)
  return references.find((reference) => {
    const genderMatches = reference.gender === 'any' || reference.gender === profile.gender
    return reference.nutrientId === nutrientId && genderMatches && age >= reference.ageMin && age <= reference.ageMax
  })
}

function summarizeStatus(total: number, reference?: Reference): RiskStatus {
  if (!reference) return 'review'
  if (reference.ul && total > reference.ul) return 'excess'
  if (reference.ul && total >= reference.ul * 0.8) return 'caution'
  if (reference.target && total < reference.target * 0.7) return 'deficient'
  return 'normal'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Authorization header is required' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    if (!supabaseUrl) throw new Error('SUPABASE_URL is required')

    const supabase = createClient(supabaseUrl, getServiceKey(), {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) return jsonResponse({ error: 'Invalid user session' }, 401)

    const { profile, medications = [], supplements } = await req.json() as { profile: Profile; medications?: Medication[]; supplements: Supplement[] }
    const totals = new Map<string, { nutrientId: string; standardName: string; totalAmount: number; unit: Ingredient['unit']; sources: string[] }>()

    supplements.filter((supplement) => supplement.confirmed).forEach((supplement) => {
      supplement.ingredients.forEach((ingredient) => {
        if (ingredient.amount === null) return
        const reference = findReference(profile, ingredient.nutrientId)
        const targetUnit = reference?.unit ?? defaultUnits[ingredient.nutrientId] ?? ingredient.unit
        const amount = convert(ingredient.amount * supplement.dailyServings, ingredient.unit, targetUnit, ingredient.nutrientId)
        if (amount === null) return
        const existing = totals.get(ingredient.nutrientId)
        if (existing) {
          existing.totalAmount += amount
          existing.sources.push(supplement.productName)
        } else {
          totals.set(ingredient.nutrientId, {
            nutrientId: ingredient.nutrientId,
            standardName: ingredient.standardName,
            totalAmount: amount,
            unit: targetUnit,
            sources: [supplement.productName],
          })
        }
      })
    })

    const totalNutrients = Array.from(totals.values()).map((item) => {
      const status = summarizeStatus(item.totalAmount, findReference(profile, item.nutrientId))
      return { ...item, status }
    })

    const riskItems = totalNutrients.filter((item) => item.status !== 'normal' || item.sources.length > 1)
    const medicationText = medications.map((medication) => `${medication.name} ${medication.memo ?? ''}`.toLowerCase()).join(' ')
    const conditionText = profile.conditions.join(' ').toLowerCase()
    const interactionWarnings = interactionRules
      .filter((rule) => totalNutrients.some((total) => total.nutrientId === rule.nutrientId))
      .filter((rule) => {
        const medicationMatch = rule.medicationKeyword ? medicationText.includes(rule.medicationKeyword.toLowerCase()) : false
        const conditionMatch = rule.conditionCode ? conditionText.includes(rule.conditionCode.toLowerCase()) || conditionText.includes('신장') : false
        return medicationMatch || conditionMatch
      })
      .map((rule) => ({
        severity: rule.severity,
        nutrientName: rule.nutrientName,
        message: rule.message,
        sourceNote: rule.sourceNote,
      }))
    const recommendations = riskItems.map((item) => ({
      status: item.sources.length > 1 ? 'duplicate' : item.status,
      title: `${item.standardName} 확인`,
      detail: item.sources.length > 1 ? `${item.sources.join(', ')}에서 중복됩니다.` : '기준치와 비교해 복용량 확인이 필요합니다.',
    })).concat(interactionWarnings.map((warning) => ({
      status: 'medication',
      title: `${warning.nutrientName} 약물/질환 주의`,
      detail: warning.message,
    })))
    const statusSummary = totalNutrients.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1
      return acc
    }, {})

    const { data, error } = await supabase.from('analysis_reports').insert({
      user_id: userData.user.id,
      status_summary: statusSummary,
      total_nutrients_json: totalNutrients,
      risk_items_json: riskItems,
      recommendations_json: recommendations,
    }).select('id').single()
    if (error) throw error

    return jsonResponse({ analysis_report_id: data.id, summary: statusSummary, totalNutrients, riskItems, interactionWarnings, recommendations })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected analysis error' }, 500)
  }
})
