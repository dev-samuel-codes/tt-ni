import type { AnalysisReport, RiskStatus, Unit } from './types'

type ServerRiskStatus = RiskStatus | string

interface ServerTotalNutrient {
  nutrientId: string
  standardName: string
  totalAmount: number
  unit: Unit
  status: ServerRiskStatus
  sources?: string[]
}

interface ServerRecommendation {
  title: string
  detail: string
  status?: RiskStatus | 'duplicate' | 'medication'
}

interface ServerInteractionWarning {
  severity: 'notice' | 'caution' | 'high'
  nutrientName: string
  message: string
  sourceNote?: string
}

export interface ServerAnalysisResponse {
  analysis_report_id?: string
  summary?: Partial<Record<RiskStatus, number>>
  totalNutrients?: ServerTotalNutrient[]
  interactionWarnings?: ServerInteractionWarning[]
  recommendations?: ServerRecommendation[]
}

const statusMessages: Record<RiskStatus, string> = {
  normal: 'Supabase 분석 기준으로 큰 중복 신호가 없습니다.',
  deficient: 'Supabase 분석 기준으로 기준량보다 낮을 수 있습니다.',
  caution: 'Supabase 분석 기준으로 상한 섭취량에 가까워 확인이 필요합니다.',
  excess: 'Supabase 분석 기준으로 상한 섭취량을 초과했습니다.',
  review: 'Supabase 분석 기준 데이터 확인이 필요합니다.',
}

const validStatuses = new Set<RiskStatus>(['normal', 'deficient', 'caution', 'excess', 'review'])

function normalizeStatus(status: ServerRiskStatus): RiskStatus {
  return validStatuses.has(status as RiskStatus) ? status as RiskStatus : 'review'
}

export function createAnalysisReportFromServer(data: ServerAnalysisResponse): AnalysisReport {
  if (!data.analysis_report_id) throw new Error('서버 분석 리포트 ID를 받지 못했습니다.')

  const totals = (data.totalNutrients ?? []).map((item) => {
    const status = normalizeStatus(item.status)
    const sources = item.sources?.length ? item.sources : ['Supabase 분석']
    const perSourceAmount = item.totalAmount / sources.length
    return {
      nutrientId: item.nutrientId,
      standardName: item.standardName,
      totalAmount: item.totalAmount,
      unit: item.unit,
      status,
      sourceProducts: sources.map((source) => ({
        productId: `${item.nutrientId}-${source}`,
        productName: source,
        amount: perSourceAmount,
        unit: item.unit,
      })),
      message: statusMessages[status],
    }
  })

  const statusSummary = {
    normal: data.summary?.normal ?? totals.filter((total) => total.status === 'normal').length,
    deficient: data.summary?.deficient ?? totals.filter((total) => total.status === 'deficient').length,
    caution: data.summary?.caution ?? totals.filter((total) => total.status === 'caution').length,
    excess: data.summary?.excess ?? totals.filter((total) => total.status === 'excess').length,
    review: data.summary?.review ?? totals.filter((total) => total.status === 'review').length,
  }

  return {
    id: data.analysis_report_id,
    createdAt: new Date().toISOString(),
    statusSummary,
    totals,
    duplicateItems: totals.filter((total) => total.sourceProducts.length >= 2),
    interactionWarnings: (data.interactionWarnings ?? []).map((warning) => ({
      severity: warning.severity,
      nutrientName: warning.nutrientName,
      message: warning.message,
      sourceNote: warning.sourceNote ?? 'Supabase Edge Function',
    })),
    recommendations: (data.recommendations ?? []).map((recommendation) => ({
      status: recommendation.status ?? 'review',
      title: recommendation.title,
      detail: recommendation.detail,
    })),
  }
}
