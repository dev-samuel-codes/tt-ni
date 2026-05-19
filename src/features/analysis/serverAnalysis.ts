import type { AnalysisReport, RiskStatus, Unit } from '../../types'

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
  synergyRecommendations?: Array<{
    nutrients: string[]
    label: string
    benefit: string
    matchType: 'full' | 'partial'
    missingNutrients: string[]
    message: string
  }>
  antagonismWarnings?: Array<{
    nutrients: string[]
    label: string
    message: string
    severity: 'caution' | 'high'
  }>
}

const statusMessages: Record<RiskStatus, string> = {
  normal: '현재 등록된 영양제 기준으로 큰 중복 신호가 없습니다.',
  deficient: '현재 등록된 영양제 기준으로 기준량보다 낮을 수 있습니다.',
  caution: '현재 등록된 영양제 기준으로 상한 섭취량에 가까워 확인이 필요합니다.',
  excess: '현재 등록된 영양제 기준으로 상한 섭취량을 초과했습니다.',
  review: '기준 데이터가 아직 없어 직접 확인이 필요합니다.',
}

const validStatuses = new Set<RiskStatus>(['normal', 'deficient', 'caution', 'excess', 'review'])

function normalizeStatus(status: ServerRiskStatus): RiskStatus {
  return validStatuses.has(status as RiskStatus) ? status as RiskStatus : 'review'
}

export function createAnalysisReportFromServer(data: ServerAnalysisResponse): AnalysisReport {
  if (!data.analysis_report_id) throw new Error('서버 분석 리포트 ID를 받지 못했습니다.')

  const totals = (data.totalNutrients ?? []).map((item) => {
    const status = normalizeStatus(item.status)
    const sources = item.sources?.length ? item.sources : ['서버 분석']
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
      sourceNote: warning.sourceNote ?? '서버 분석',
    })),
    recommendations: (data.recommendations ?? []).map((recommendation) => ({
      status: recommendation.status ?? 'review',
      title: recommendation.title,
      detail: recommendation.detail,
    })),
    synergyRecommendations: (data.synergyRecommendations ?? []).map((synergy) => ({
      nutrients: synergy.nutrients,
      label: synergy.label,
      benefit: synergy.benefit,
      matchType: synergy.matchType,
      missingNutrients: synergy.missingNutrients,
      message: synergy.message,
    })),
    antagonismWarnings: (data.antagonismWarnings ?? []).map((antagonism) => ({
      nutrients: antagonism.nutrients,
      label: antagonism.label,
      message: antagonism.message,
      severity: antagonism.severity,
    })),
  }
}
