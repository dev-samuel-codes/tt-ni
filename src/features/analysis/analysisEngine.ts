import {
  interactionRules,
  nutrients,
  referenceValues,
} from '../nutrition/nutritionData.js'
import type {
  AnalysisReport,
  Medication,
  NutrientTotal,
  Profile,
  ReferenceValue,
  RiskStatus,
  SupplementProduct,
  Unit,
} from '../../types/index.js'

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
  },
  {
    nutrients: ['vitamin_c', 'iron'],
    label: '비타민 C + 철분',
    benefit: '비타민 C가 비헴철(식물성 철분)을 흡수되기 쉬운 환원 상태(Fe²⁺)로 유지시켜 철분 흡수율을 극대화합니다. 빈혈 예방에 탁월한 조합입니다.',
  },
  {
    nutrients: ['vitamin_e', 'omega3'],
    label: '비타민 E + 오메가3',
    benefit: '오메가3의 이중 결합이 활성산소에 의해 산화되는 것을 비타민 E가 방어합니다. 오메가3의 구조적 온전성을 보존하여 노화 방지 효능을 유지합니다.',
  },
  {
    nutrients: ['vitamin_c', 'collagen'],
    label: '비타민 C + 콜라겐',
    benefit: '비타민 C는 콜라겐 합성의 필수 조효소로, 프롤린과 라이신의 수산화 반응을 촉진하여 피부 탄력과 관절 건강을 개선합니다.',
  },
  {
    nutrients: ['vitamin_e', 'coq10'],
    label: '비타민 E + CoQ10',
    benefit: '지용성 항산화제인 비타민 E와 미토콘드리아 항산화제인 CoQ10이 이중 항산화 방어벽을 형성하여 세포막을 보호합니다.',
  },
  {
    nutrients: ['iron', 'vitamin_c', 'selenium'],
    label: '철분 + 비타민 C + 셀레늄',
    benefit: '비타민 C가 철분 흡수를 돕고, 셀레늄이 흡수된 철분의 산화를 방지하여 조혈 기능과 조직 산소 공급을 강화합니다.',
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

/**
 * 영양소 단위를 변환합니다.
 * 기본 단위(g↔mg↔mcg) 및 비타민별 특수 단위(IU↔mcg↔mg)를 지원합니다.
 * 변환 불가능한 경우 null을 반환합니다.
 */
export function convertAmount(amount: number, fromUnit: Unit, toUnit: Unit, nutrientId: string): number | null {
  const sourceUnit = fromUnit === 'ug' || fromUnit === 'µg' ? 'mcg' : fromUnit
  const targetUnit = toUnit === 'ug' || toUnit === 'µg' ? 'mcg' : toUnit

  if (sourceUnit === targetUnit) return amount
  if (sourceUnit === 'unknown' || targetUnit === 'unknown') return null

  if (sourceUnit === 'g' && targetUnit === 'mg') return amount * 1000
  if (sourceUnit === 'mg' && targetUnit === 'g') return amount / 1000
  if (sourceUnit === 'mg' && targetUnit === 'mcg') return amount * 1000
  if (sourceUnit === 'mcg' && targetUnit === 'mg') return amount / 1000
  if (sourceUnit === 'g' && targetUnit === 'mcg') return amount * 1_000_000
  if (sourceUnit === 'mcg' && targetUnit === 'g') return amount / 1_000_000

  if (nutrientId === 'vitamin_d') {
    if (sourceUnit === 'IU' && targetUnit === 'mcg') return amount / 40
    if (sourceUnit === 'mcg' && targetUnit === 'IU') return amount * 40
  }

  if (nutrientId === 'vitamin_a') {
    if (sourceUnit === 'IU' && targetUnit === 'mcg') return amount * 0.3
    if (sourceUnit === 'mcg' && targetUnit === 'IU') return amount / 0.3
  }

  if (nutrientId === 'vitamin_e') {
    if (sourceUnit === 'IU' && targetUnit === 'mg') return amount * 0.67
    if (sourceUnit === 'mg' && targetUnit === 'IU') return amount / 0.67
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
interface NutrientGuide {
  role: string
  deficientGuide: string
  excessGuide: string
  normalGuide: string
}

const NUTRIENT_GUIDES: Record<string, NutrientGuide> = {
  vitamin_a: {
    role: '시각 기능 유지, 상피 세포 건강 및 면역 반응에 핵심적인 지용성 비타민입니다.',
    deficientGuide: '야맹증, 안구 건조증, 피부 건조 및 면역 기능 약화가 생길 수 있습니다. 당근, 시금치 같은 녹황색 채소 섭취를 늘려보세요.',
    excessGuide: '지용성 비타민으로 체내에 축적되어 두통, 피로감, 구토 및 고칼슘혈증이나 간 손상을 유발할 수 있어 즉각적인 감량이 권장됩니다.',
    normalGuide: '눈 건강과 상피 세포 보호를 위해 아주 이상적인 수준으로 잘 섭취하고 계십니다.'
  },
  vitamin_b1: {
    role: '탄수화물과 에너지 대사에 관여하여 피로 물질 축적을 방지하는 수용성 비타민입니다.',
    deficientGuide: '에너지 생성 저하로 만성 피로, 무기력증, 소화 불량이 발생할 수 있으며 심하면 각기병으로 이어질 수 있습니다. 돼지고기나 통곡물을 병행 섭취해 보세요.',
    excessGuide: '수용성 비타민으로 필요 이상 흡수 시 대부분 소변으로 배출되어 안전한 편이나, 과도한 고함량 복용은 피하는 것이 좋습니다.',
    normalGuide: '원활한 체내 에너지 대사와 피로 회복을 위해 충분한 섭취 상태를 유지하고 계십니다.'
  },
  vitamin_b6: {
    role: '단백질 및 아미노산 대사, 적혈구의 헤모글로빈 합성에 관여하는 조효소 비타민입니다.',
    deficientGuide: '피부염, 구순염, 설염이 나타날 수 있으며 신경전달물질 합성 저하로 불면이나 우울감이 올 수 있습니다. 바나나, 닭고기에 풍부합니다.',
    excessGuide: '장기적인 과다 섭취 시 가역적인 말초 신경 장애나 감각 이상을 유발할 수 있으므로, 하루 복용량을 확인해 보세요.',
    normalGuide: '단백질 대사와 신경 기능 안정을 위해 안정적인 권장 수준을 복용 중이십니다.'
  },
  vitamin_b12: {
    role: '엽산 대사, 신경세포의 유지, 뇌 기능 활성화 및 적혈구 생성에 필수적인 비타민입니다.',
    deficientGuide: '피로감, 기억력 감퇴, 말초 신경 장애 및 악성 빈혈의 발병 위험이 높습니다. 채식주의자의 경우 특히 부족하기 쉬우니 유의하세요.',
    excessGuide: '독성이 매우 낮아 과다 복용 시에도 대부분 안전하게 배출되나 과한 보충은 무의미합니다.',
    normalGuide: '신경 건강 유지와 건강한 적혈구 생성을 위해 훌륭한 수준으로 잘 섭취하고 계십니다.'
  },
  vitamin_c: {
    role: '강력한 항산화 작용으로 세포를 보호하고 콜라겐 합성을 도우며, 면역력을 높여주는 비타민입니다.',
    deficientGuide: '만성 피로, 상처 치유 지연, 잇몸 출혈 및 면역력 약화가 일어날 수 있습니다. 신선한 과일과 채소 복용량을 늘려주세요.',
    excessGuide: '수용성이라 안전한 편이나, 상한섭취량 초과 복용 시 위산 과다로 인한 속쓰림, 설사, 수산 칼슘 결석 위험이 증가하므로 감량을 권장합니다.',
    normalGuide: '우수한 항산화 방어벽 유지와 면역 케어를 위해 충분한 용량을 복용하고 계십니다.'
  },
  vitamin_d: {
    role: '칼슘과 인의 흡수를 도와 뼈의 형성 및 유지에 필수적이며, 면역 조절에 기여하는 지용성 호르몬성 비타민입니다.',
    deficientGuide: '골밀도 감소로 골다공증, 골연화증 위험이 증가하고 만성 피로와 면역력 저하가 올 수 있습니다. 적절한 일광욕을 병행하면 흡수에 더욱 좋습니다.',
    excessGuide: '지용성으로 체내 축적 시 고칼슘혈증, 고칼슘뇨증을 유발하고 혈관이나 신장의 석회화를 초래할 수 있어 상한치 이하로 복용량을 제한해야 합니다.',
    normalGuide: '뼈 건강 증진과 골밀도 보존 및 면역 균형을 위해 매우 적절하고 안전한 수준을 섭취 중이십니다.'
  },
  vitamin_e: {
    role: '세포막의 불포화지방산 산화를 방지하여 노화를 지연시키고 심혈관 건강을 돕는 강력한 항산화제입니다.',
    deficientGuide: '적혈구 용혈 현상, 신경근육 장애 및 활성산소로 인한 세포 손상이 가속화될 수 있습니다. 견과류, 식물성 기름에 많이 들어있습니다.',
    excessGuide: '고용량 장기 복용 시 비타민 K 작용을 간섭하여 출혈 성향(혈액 응고 지연)을 높이고 뇌졸중 위험을 증가시킬 수 있어 주의가 요구됩니다.',
    normalGuide: '활성산소로부터 세포막을 효과적으로 보호하는 수준의 우수한 항산화 상태를 유지하고 계십니다.'
  },
  vitamin_k: {
    role: '혈액 응고 정상화와 칼슘을 뼈에 결합시켜 골다공증 예방에 기여하는 지용성 비타민입니다.',
    deficientGuide: '상처 시 피가 잘 멈추지 않고 잇몸 출혈, 멍이 쉽게 들며 뼈가 약해질 수 있습니다. 낫또나 시금치 같은 녹색 잎채소 섭취를 고려해 보세요.',
    excessGuide: '와파린 등 항응고제를 복용 중인 경우 약효를 전면 방해할 수 있으므로, 섭취량 변동 시 반드시 의사와 상담해야 합니다.',
    normalGuide: '정상적인 혈류 순환 및 뼈 기질 칼슘 정착을 돕기 위해 잘 복용하고 계십니다.'
  },
  calcium: {
    role: '뼈와 치아의 주성분이며 신경 전달, 근육 수축, 혈액 응고에 핵심적인 역할을 담당하는 필수 미네랄입니다.',
    deficientGuide: '체내 골밀도가 감소하여 골다공증, 골연화증, 근육 경련(눈 떨림 등)이 생기기 쉽습니다. 흡수 촉진을 위해 비타민 D와 병용을 권장합니다.',
    excessGuide: '과다 복용 시 변비, 신장 결석, 혈관 석회화 및 철분이나 아연 등 다른 미네랄의 체내 흡수를 크게 방해하므로 상한섭취량 이하로 낮추어야 합니다.',
    normalGuide: '튼튼한 골격 유지와 신경 근육 기능 제어를 위해 아주 훌륭한 수준으로 잘 보충하고 계십니다.'
  },
  magnesium: {
    role: '체내 300가지 이상의 효소 작용을 돕고 신경 및 근육 기능 유지와 에너지 생성에 필수적인 미네랄입니다.',
    deficientGuide: '근육 경련(눈밑 떨림), 불면증, 불안감, 만성 피로와 부정맥이 올 수 있습니다. 바나나, 아보카도, 아몬드 섭취가 도움을 줄 수 있습니다.',
    excessGuide: '보충제 형태로 과다 섭취 시 설사, 복통 등 위장 장애를 유발하기 매우 쉬우며 심한 경우 저혈압이 올 수 있으므로 복용량을 낮춰주세요.',
    normalGuide: '스트레스 완화, 신경 안정 및 근육 이완을 돕는 매우 편안하고 적절한 섭취 상태입니다.'
  },
  iron: {
    role: '헤모글로빈과 미오글로빈의 핵심 구성 요소로 전신 세포에 산소를 공급해주는 필수 미네랄입니다.',
    deficientGuide: '전신 산소 공급 부족으로 철 결핍성 빈혈, 극심한 피로, 두통, 창백한 안색이 발생할 수 있습니다. 비타민 C와 복용 시 흡수율이 높아집니다.',
    excessGuide: '간 및 장기에 과도하게 축적되어 장기 손상을 유발하고 위장 장애(흑변, 변비)를 초래할 수 있으므로 권장량 수준으로의 즉시 제한이 필요합니다.',
    normalGuide: '활력 넘치는 세포 내 산소 전달과 빈혈 예방을 위해 안정적인 수준을 유지하고 계십니다.'
  },
  zinc: {
    role: 'DNA 합성, 세포 분열, 상처 치유 및 정상적인 면역 기능 작동에 기여하는 필수 미네랄입니다.',
    deficientGuide: '면역력 약화로 감기에 자주 걸리며 상처 회복 지연, 미각 이상, 원형 탈모가 발생할 수 있습니다. 굴, 육류 섭취가 도움을 줍니다.',
    excessGuide: '만성적인 과잉 섭취 시 구리 결핍증을 일으키고 면역 기능을 오히려 저하시키며 고콜레스테롤혈증을 촉진할 수 있으므로 상량을 조절해야 합니다.',
    normalGuide: '활발한 세포 분열 및 정상적인 면역력 유지를 위해 든든한 섭취 기준을 충족하고 계십니다.'
  },
  omega3: {
    role: '혈중 중성지질 개선, 혈행 원활화, 안구 건조 완화 및 기억력 개선에 유익한 필수 지방산입니다.',
    deficientGuide: '피부 건조, 눈 피로, 혈류 흐름 둔화 및 심혈관계 만성 염증 상태가 심화될 수 있습니다. 등푸른생선 섭취를 늘려보세요.',
    excessGuide: '고용량 섭취 시 피가 묽어져 지혈 지연을 유발할 수 있으므로, 아스피린/와파린 같은 항응고제 복용자는 주의 깊게 모니터링해야 합니다.',
    normalGuide: '혈관 탄성 유지, 혈류 촉진 및 뇌 기능 활성화를 위해 이상적으로 섭취하고 계십니다.'
  }
}

function summarizeStatus(
  nutrientId: string,
  total: number,
  reference?: ReferenceValue
): { status: RiskStatus; message: string; percentOfTarget?: number; percentOfUl?: number } {
  if (!reference) {
    return {
      status: 'review',
      message: '기준 데이터가 아직 없어 직접 확인이 필요합니다. 제품 라벨 정보를 기반으로 직접 점검해 주세요.',
    }
  }

  const target = reference.rda ?? reference.ai
  const percentOfTarget = target ? Math.round((total / target) * 100) : undefined
  const percentOfUl = reference.ul ? Math.round((total / reference.ul) * 100) : undefined

  const guide = NUTRIENT_GUIDES[nutrientId]

  let status: RiskStatus
  let msg: string

  if (reference.ul && total > reference.ul) {
    status = 'excess'
    msg = `[초과 위험] 1일 섭취량(${total}${reference.unit})이 안전 상한선(${reference.ul}${reference.unit})을 초과했습니다.`
    if (guide) {
      msg += ` ${guide.role} ${guide.excessGuide}`
    } else {
      msg += ` 과도한 장기 섭취는 체내 장기 손상 등 심각한 부작용을 일으킬 수 있어 즉시 전문가 상담 및 감량이 강력히 권장됩니다.`
    }
  } else if (reference.ul && total >= reference.ul * 0.8) {
    status = 'caution'
    msg = `[과다 주의] 1일 섭취량(${total}${reference.unit})이 상한섭취량(${reference.ul}${reference.unit})에 80% 이상 접근했습니다.`
    if (guide) {
      msg += ` ${guide.role} ${guide.excessGuide}`
    } else {
      msg += ` 중복 제품의 섭취량을 검토하거나 감량을 고려하여 부작용을 미연에 방지할 필요가 있습니다.`
    }
  } else if (target && total < target * 0.7) {
    status = 'deficient'
    msg = `[부족 가능] 1일 섭취량(${total}${reference.unit})이 일일 권장치(${target}${reference.unit})의 70% 미만으로 크게 부족합니다.`
    if (guide) {
      msg += ` ${guide.role} ${guide.deficientGuide}`
    } else {
      msg += ` 지속적인 결핍 상태는 신체 기능 저하를 초래할 수 있으므로, 일상 식사 균형을 점검하거나 보충제 복용 조정을 권장합니다.`
    }
  } else {
    status = 'normal'
    msg = `[섭취 적정] 권장량 대비 적절한 섭취 상태를 안전하게 잘 유지 중입니다.`
    if (guide) {
      msg += ` ${guide.role} ${guide.normalGuide}`
    } else {
      msg += ` 현재 용량으로 꾸준히 섭취하시어 활력 있는 일상을 누리시기를 권장합니다.`
    }
  }

  return {
    status,
    message: msg,
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
    const summary = summarizeStatus(total.nutrientId, total.totalAmount, total.reference)
    return { ...total, ...summary }
  })

  const duplicateItems = totals.filter((total) => total.sourceProducts.length >= 2)
  const medicationText = medications.map((medication) => `${medication.name} ${medication.memo}`.toLowerCase()).join(' ')
  const conditionText = profile.conditions.join(' ').toLowerCase()

  const interactionWarnings = interactionRules
    .filter((rule) => totals.some((total) => total.nutrientId === rule.nutrientId))
    .filter((rule) => {
      const medicationMatch = rule.medicationAliases && rule.medicationAliases.length > 0
        ? rule.medicationAliases.some((alias) => medicationText.includes(alias.toLowerCase()))
        : rule.medicationKeyword
        ? medicationText.includes(rule.medicationKeyword.toLowerCase())
        : false

      const conditionMatch = rule.conditionAliases && rule.conditionAliases.length > 0
        ? rule.conditionAliases.some((alias) => conditionText.includes(alias.toLowerCase()))
        : rule.conditionCode
        ? conditionText.includes(rule.conditionCode.toLowerCase())
        : false

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
