import type { InteractionRule, Nutrient, ReferenceValue } from '../../types/index.js'

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
    id: 'selenium',
    standardName: '셀레늄',
    category: '미네랄',
    aliases: ['selenium', 'se', '셀레늄', '셀렌'],
    defaultUnit: 'mcg',
    riskLevel: 'high',
  },
  {
    id: 'magnesium',
    standardName: '마그네슘',
    category: '미네랄',
    aliases: ['magnesium', '마그네슘'],
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
  {
    id: 'vitamin_b2',
    standardName: '비타민 B2',
    category: '비타민',
    aliases: ['b2', 'riboflavin', '리보플라빈', '비타민b2'],
    defaultUnit: 'mg',
    riskLevel: 'low',
  },
  {
    id: 'catechin',
    standardName: '카테킨',
    category: '허브/추출물',
    aliases: ['catechin', 'catechins', '카테킨', 'egcg', '녹차추출물', 'green tea extract'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'corosolic_acid',
    standardName: '코로솔산',
    category: '허브/추출물',
    aliases: ['corosolic acid', '코로솔산', '바나바잎', 'banaba', 'banaba leaf'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'lutein',
    standardName: '루테인',
    category: '허브/추출물',
    aliases: ['lutein', '루테인', '지아잔틴', 'zeaxanthin'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'collagen',
    standardName: '콜라겐',
    category: '단백질',
    aliases: ['collagen', '콜라겐', 'hydrolyzed collagen', '가수분해콜라겐'],
    defaultUnit: 'mg',
    riskLevel: 'low',
  },
  {
    id: 'glucosamine',
    standardName: '글루코사민',
    category: '허브/추출물',
    aliases: ['glucosamine', '글루코사민'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'iodine',
    standardName: '요오드',
    category: '미네랄',
    aliases: ['iodine', '요오드', 'iodine'],
    defaultUnit: 'mcg',
    riskLevel: 'medium',
  },
  {
    id: 'folate',
    standardName: '엽산',
    category: '비타민',
    aliases: ['folate', 'folic acid', '엽산', '폴산'],
    defaultUnit: 'mcg',
    riskLevel: 'low',
  },
  {
    id: 'niacin',
    standardName: '나이아신',
    category: '비타민',
    aliases: ['niacin', 'b3', '나이아신', 'nicotinic acid'],
    defaultUnit: 'mg',
    riskLevel: 'low',
  },
  {
    id: 'biotin',
    standardName: '비오틴',
    category: '비타민',
    aliases: ['biotin', 'b7', '비오틴', '비타민h'],
    defaultUnit: 'mcg',
    riskLevel: 'low',
  },
  {
    id: 'pantothenic_acid',
    standardName: '판토텐산',
    category: '비타민',
    aliases: ['pantothenic acid', 'b5', '판토텐산'],
    defaultUnit: 'mg',
    riskLevel: 'low',
  },
  {
    id: 'chromium',
    standardName: '크롬',
    category: '미네랄',
    aliases: ['chromium', '크롬', 'cr'],
    defaultUnit: 'mcg',
    riskLevel: 'medium',
  },
  {
    id: 'manganese',
    standardName: '망간',
    category: '미네랄',
    aliases: ['manganese', '망간', 'mn'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'copper',
    standardName: '구리',
    category: '미네랄',
    aliases: ['copper', '구리', 'cu'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'phosphorus',
    standardName: '인',
    category: '미네랄',
    aliases: ['phosphorus', '인', 'p'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'potassium',
    standardName: '칼륨',
    category: '미네랄',
    aliases: ['potassium', '칼륨', 'k'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'sodium',
    standardName: '나트륨',
    category: '미네랄',
    aliases: ['sodium', '나트륨', 'na'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'ashwagandha',
    standardName: '아슈와간다',
    category: '허브/추출물',
    aliases: ['ashwagandha', '아슈와간다', '위타니아'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'turmeric',
    standardName: '강황/커큐민',
    category: '허브/추출물',
    aliases: ['turmeric', 'curcumin', '강황', '커큐민'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'milk_thistle',
    standardName: '밀크씨슬',
    category: '허브/추출물',
    aliases: ['milk thistle', 'silymarin', '밀크씨슬', '실리마린'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'berberine',
    standardName: '베르베린',
    category: '허브/추출물',
    aliases: ['berberine', '베르베린'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'spirulina',
    standardName: '스피루리나',
    category: '허브/추출물',
    aliases: ['spirulina', '스피루리나'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'l_arginine',
    standardName: 'L-아르기닌',
    category: '아미노산',
    aliases: ['l-arginine', '아르기닌', 'arginine'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'l_theanine',
    standardName: 'L-테아닌',
    category: '아미노산',
    aliases: ['l-theanine', '테아닌', 'theanine'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'melatonin',
    standardName: '멜라토닌',
    category: '호르몬',
    aliases: ['melatonin', '멜라토닌'],
    defaultUnit: 'mg',
    riskLevel: 'high',
  },
  {
    id: 'glutathione',
    standardName: '글루타치온',
    category: '항산화제',
    aliases: ['glutathione', '글루타치온', 'gsh'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'resveratrol',
    standardName: '레스베라트롤',
    category: '항산화제',
    aliases: ['resveratrol', '레스베라트롤'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
  {
    id: 'quercetin',
    standardName: '케르세틴',
    category: '항산화제',
    aliases: ['quercetin', '케르세틴'],
    defaultUnit: 'mg',
    riskLevel: 'medium',
  },
]

/**
 * 한국인 영양섭취기준(KDRIs 2025) 참조치
 * 성별·연령대별 RDA(권장섭취량), AI(충분섭취량), UL(상한섭취량)을 정의합니다.
 * gender가 'any'면 모든 성별에 적용됩니다.
 */
export const referenceValues: ReferenceValue[] = [
  // 1. 비타민 A (2020 KDRIs)
  { nutrientId: 'vitamin_a', gender: 'male', ageMin: 19, ageMax: 29, rda: 800, ul: 3000, unit: 'mcg' },
  { nutrientId: 'vitamin_a', gender: 'female', ageMin: 19, ageMax: 29, rda: 650, ul: 3000, unit: 'mcg' },
  { nutrientId: 'vitamin_a', gender: 'male', ageMin: 30, ageMax: 150, rda: 750, ul: 3000, unit: 'mcg' },
  { nutrientId: 'vitamin_a', gender: 'female', ageMin: 30, ageMax: 150, rda: 650, ul: 3000, unit: 'mcg' },

  // 2. 비타민 B1 (2020 KDRIs)
  { nutrientId: 'vitamin_b1', gender: 'male', ageMin: 19, ageMax: 150, rda: 1.2, unit: 'mg' },
  { nutrientId: 'vitamin_b1', gender: 'female', ageMin: 19, ageMax: 150, rda: 1.1, unit: 'mg' },

  // 3. 비타민 B6 (2020 KDRIs)
  { nutrientId: 'vitamin_b6', gender: 'male', ageMin: 19, ageMax: 49, rda: 1.5, ul: 100, unit: 'mg' },
  { nutrientId: 'vitamin_b6', gender: 'female', ageMin: 19, ageMax: 49, rda: 1.4, ul: 100, unit: 'mg' },
  { nutrientId: 'vitamin_b6', gender: 'any', ageMin: 50, ageMax: 150, rda: 1.5, ul: 100, unit: 'mg' },

  // 4. 비타민 B12 (2020 KDRIs)
  { nutrientId: 'vitamin_b12', gender: 'any', ageMin: 19, ageMax: 150, rda: 2.4, unit: 'mcg' },

  // 5. 비타민 C (2020 KDRIs - 미국 FNB 남90/여75에서 한국 기준 공통 100mg으로 전면 교정)
  { nutrientId: 'vitamin_c', gender: 'any', ageMin: 19, ageMax: 150, rda: 100, ul: 2000, unit: 'mg' },

  // 6. 비타민 D (2020 KDRIs - 미국 FNB RDA 기준 오표기에서 한국 충분섭취량(AI) 및 65세 기준 세분화 교정)
  { nutrientId: 'vitamin_d', gender: 'any', ageMin: 19, ageMax: 64, ai: 10, ul: 100, unit: 'mcg' },
  { nutrientId: 'vitamin_d', gender: 'any', ageMin: 65, ageMax: 150, ai: 15, ul: 100, unit: 'mcg' },

  // 7. 비타민 E (2020 KDRIs - 미국 FNB 기준 RDA에서 한국 충분섭취량(AI) 12mg 및 상한 540mg 전면 교정)
  { nutrientId: 'vitamin_e', gender: 'any', ageMin: 19, ageMax: 150, ai: 12, ul: 540, unit: 'mg' },

  // 8. 비타민 K (2020 KDRIs)
  { nutrientId: 'vitamin_k', gender: 'male', ageMin: 19, ageMax: 150, ai: 75, unit: 'mcg' },
  { nutrientId: 'vitamin_k', gender: 'female', ageMin: 19, ageMax: 150, ai: 65, unit: 'mcg' },

  // 9. 칼슘 (2020 KDRIs - 성인 남녀 700~800mg 연령대별 정교화 및 상한 2500mg 교정)
  { nutrientId: 'calcium', gender: 'any', ageMin: 19, ageMax: 29, rda: 800, ul: 2500, unit: 'mg' },
  { nutrientId: 'calcium', gender: 'any', ageMin: 30, ageMax: 49, rda: 700, ul: 2500, unit: 'mg' },
  { nutrientId: 'calcium', gender: 'male', ageMin: 50, ageMax: 64, rda: 700, ul: 2500, unit: 'mg' },
  { nutrientId: 'calcium', gender: 'female', ageMin: 50, ageMax: 64, rda: 800, ul: 2500, unit: 'mg' },
  { nutrientId: 'calcium', gender: 'male', ageMin: 65, ageMax: 150, rda: 750, ul: 2500, unit: 'mg' },
  { nutrientId: 'calcium', gender: 'female', ageMin: 65, ageMax: 150, rda: 800, ul: 2500, unit: 'mg' },

  // 10. 마그네슘 (2020 KDRIs - 19~64세 남350/여280, 65세이상 남370/여280으로 정교화 및 식품외상한 350mg 지정)
  { nutrientId: 'magnesium', gender: 'male', ageMin: 19, ageMax: 64, rda: 350, ul: 350, unit: 'mg' },
  { nutrientId: 'magnesium', gender: 'female', ageMin: 19, ageMax: 64, rda: 280, ul: 350, unit: 'mg' },
  { nutrientId: 'magnesium', gender: 'male', ageMin: 65, ageMax: 150, rda: 370, ul: 350, unit: 'mg' },
  { nutrientId: 'magnesium', gender: 'female', ageMin: 65, ageMax: 150, rda: 280, ul: 350, unit: 'mg' },

  // 11. 아연 (2020 KDRIs)
  { nutrientId: 'zinc', gender: 'male', ageMin: 19, ageMax: 150, rda: 10, ul: 35, unit: 'mg' },
  { nutrientId: 'zinc', gender: 'female', ageMin: 19, ageMax: 150, rda: 8, ul: 35, unit: 'mg' },

  // 12. 철분 (2020 KDRIs - 남성 10mg, 가임기 여성 14mg, 폐경기 여성 8mg 교정)
  { nutrientId: 'iron', gender: 'male', ageMin: 19, ageMax: 150, rda: 10, ul: 45, unit: 'mg' },
  { nutrientId: 'iron', gender: 'female', ageMin: 19, ageMax: 49, rda: 14, ul: 45, unit: 'mg' },
  { nutrientId: 'iron', gender: 'female', ageMin: 50, ageMax: 150, rda: 8, ul: 45, unit: 'mg' },

  // 13. 오메가3 (2020 KDRIs)
  { nutrientId: 'omega3', gender: 'any', ageMin: 19, ageMax: 150, ai: 1100, unit: 'mg' },

  // 14. 셀레늄 (2020 KDRIs - 기존 FNB 기준 남85/여75에서 한국 기준 공통 60mcg로 교정)
  { nutrientId: 'selenium', gender: 'any', ageMin: 19, ageMax: 150, rda: 60, ul: 400, unit: 'mcg' },

  // 15. 콜린 (2025 KDRIs 신규 편입 반영 - rda가 아닌 ai 충분섭취량 속성으로 정교화)
  { nutrientId: 'choline', gender: 'male', ageMin: 19, ageMax: 150, ai: 550, ul: 3500, unit: 'mg' },
  { nutrientId: 'choline', gender: 'female', ageMin: 19, ageMax: 150, ai: 425, ul: 3500, unit: 'mg' },

  // 16. 비타민 B2 (2020 KDRIs)
  { nutrientId: 'vitamin_b2', gender: 'male', ageMin: 19, ageMax: 150, rda: 1.5, unit: 'mg' },
  { nutrientId: 'vitamin_b2', gender: 'female', ageMin: 19, ageMax: 150, rda: 1.2, unit: 'mg' },

  // 17. 나이아신 (2020 KDRIs)
  { nutrientId: 'niacin', gender: 'male', ageMin: 19, ageMax: 150, rda: 16, ul: 35, unit: 'mg' },
  { nutrientId: 'niacin', gender: 'female', ageMin: 19, ageMax: 150, rda: 14, ul: 35, unit: 'mg' },

  // 18. 엽산 (2020 KDRIs)
  { nutrientId: 'folate', gender: 'any', ageMin: 19, ageMax: 150, rda: 400, ul: 1000, unit: 'mcg' },

  // 19. 비오틴 (2020 KDRIs)
  { nutrientId: 'biotin', gender: 'any', ageMin: 19, ageMax: 150, ai: 30, unit: 'mcg' },

  // 20. 판토텐산 (2020 KDRIs)
  { nutrientId: 'pantothenic_acid', gender: 'any', ageMin: 19, ageMax: 150, ai: 5, unit: 'mg' },

  // 21. 요오드 (2020 KDRIs - 상한섭취량 기존 오류치 500mcg에서 한국인 공식 기준인 2400mcg로 교정)
  { nutrientId: 'iodine', gender: 'any', ageMin: 19, ageMax: 150, rda: 150, ul: 2400, unit: 'mcg' },

  // 22. 구리 (2020 KDRIs)
  { nutrientId: 'copper', gender: 'any', ageMin: 19, ageMax: 150, rda: 0.8, ul: 10, unit: 'mg' },

  // 23. 망간 (2020 KDRIs)
  { nutrientId: 'manganese', gender: 'male', ageMin: 19, ageMax: 150, ai: 4.0, ul: 11, unit: 'mg' },
  { nutrientId: 'manganese', gender: 'female', ageMin: 19, ageMax: 150, ai: 3.5, ul: 11, unit: 'mg' },

  // 24. 크롬 (2020 KDRIs - 50세 이상 노령층 누락 수치 전면 보완 교정)
  { nutrientId: 'chromium', gender: 'male', ageMin: 19, ageMax: 49, ai: 35, unit: 'mcg' },
  { nutrientId: 'chromium', gender: 'female', ageMin: 19, ageMax: 49, ai: 25, unit: 'mcg' },
  { nutrientId: 'chromium', gender: 'male', ageMin: 50, ageMax: 64, ai: 30, unit: 'mcg' },
  { nutrientId: 'chromium', gender: 'female', ageMin: 50, ageMax: 64, ai: 20, unit: 'mcg' },
  { nutrientId: 'chromium', gender: 'male', ageMin: 65, ageMax: 150, ai: 25, unit: 'mcg' },
  { nutrientId: 'chromium', gender: 'female', ageMin: 65, ageMax: 150, ai: 20, unit: 'mcg' },

  // 25. 인 (2020 KDRIs)
  { nutrientId: 'phosphorus', gender: 'any', ageMin: 19, ageMax: 150, rda: 700, ul: 3500, unit: 'mg' },

  // 26. 칼륨 (2020 KDRIs)
  { nutrientId: 'potassium', gender: 'any', ageMin: 19, ageMax: 150, ai: 3500, unit: 'mg' },

  // 27. 나트륨 (2020 KDRIs)
  { nutrientId: 'sodium', gender: 'any', ageMin: 19, ageMax: 150, ai: 1500, ul: 2300, unit: 'mg' },
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
    medicationAliases: ['warfarin', '와파린', '쿠마딘', '항응고'],
    severity: 'high',
    message: '와파린 계열 약 복용 중에는 비타민 K 섭취 변동을 전문가와 확인하세요.',
    sourceNote: 'MVP rule: anticoagulant nutrient consistency warning',
  },
  {
    id: 'warfarin-omega3',
    nutrientId: 'omega3',
    medicationKeyword: 'warfarin',
    medicationAliases: ['warfarin', '와파린', '쿠마딘', '항응고'],
    severity: 'caution',
    message: '항응고제 복용 중 고용량 오메가3는 출혈 위험 상담이 필요할 수 있습니다.',
    sourceNote: 'MVP rule: anticoagulant high-dose omega-3 caution',
  },
  {
    id: 'thyroid-calcium',
    nutrientId: 'calcium',
    medicationKeyword: 'levothyroxine',
    medicationAliases: ['levothyroxine', '레보티록신', '씬지로이드', '갑상선'],
    severity: 'caution',
    message: '갑상선 호르몬제와 칼슘은 복용 간격을 확인하는 것이 좋습니다.',
    sourceNote: 'MVP rule: thyroid medication spacing',
  },
  {
    id: 'thyroid-iron',
    nutrientId: 'iron',
    medicationKeyword: 'levothyroxine',
    medicationAliases: ['levothyroxine', '레보티록신', '씬지로이드', '갑상선'],
    severity: 'caution',
    message: '갑상선 호르몬제와 철분은 흡수 간섭 가능성이 있어 복용 간격 확인이 필요합니다.',
    sourceNote: 'MVP rule: thyroid medication spacing',
  },
  {
    id: 'kidney-magnesium',
    nutrientId: 'magnesium',
    conditionCode: 'kidney',
    conditionAliases: ['kidney', '신장', '콩팥', '만성신부전'],
    severity: 'high',
    message: '신장 질환이 있으면 마그네슘 보충제 복용 전 전문가 상담이 필요합니다.',
    sourceNote: 'MVP rule: renal condition mineral caution',
  },
  {
    id: 'diabetes-ginseng',
    nutrientId: 'ginseng',
    medicationKeyword: 'insulin',
    medicationAliases: ['insulin', '인슐린'],
    severity: 'high',
    message: '인슐린/당뇨약 복용 중 홍삼(진세노사이드) 고용량 섭취는 중증 저혈당 쇼크 위험이 있습니다.',
    sourceNote: 'Report: Ginsenoside insulin sensitivity amplification',
  },
  {
    id: 'statin-grapefruit',
    nutrientId: 'grapefruit',
    medicationKeyword: 'statin',
    medicationAliases: ['statin', '스타틴', '로수바스타틴', '아토르바스타틴', '심바스타틴', '프라바스타틴', '피타바스타틴', '플루바스타틴', '리피토', '크레스토'],
    severity: 'high',
    message: '스타틴 계열 고지혈증 약 복용 중 자몽 추출물 섭취는 절대 금기입니다 (횡문근융해증 위험).',
    sourceNote: 'Report: CYP3A4 inhibition by furanocoumarin',
  },
  {
    id: 'metformin-b12',
    nutrientId: 'vitamin_b12',
    medicationKeyword: 'metformin',
    medicationAliases: ['metformin', '메트포르민', '글루코파지'],
    severity: 'caution',
    message: '메트포르민 장기 복용은 비타민 B12 고갈을 유발할 수 있으므로 보충이 권장됩니다.',
    sourceNote: 'Report: Metformin induces B12 depletion',
  },
  {
    id: 'statin-coq10',
    nutrientId: 'coq10',
    medicationKeyword: 'statin',
    medicationAliases: ['statin', '스타틴', '로수바스타틴', '아토르바스타틴', '심바스타틴', '프라바스타틴', '피타바스타틴', '플루바스타틴', '리피토', '크레스토'],
    severity: 'caution',
    message: '스타틴 계열 약물은 체내 코엔자임 Q10을 고갈시키므로 병용 섭취가 권장됩니다.',
    sourceNote: 'Report: Statin induces CoQ10 depletion',
  },
  {
    id: 'antibiotics-probiotics',
    nutrientId: 'probiotics',
    medicationKeyword: 'antibiotic',
    medicationAliases: ['antibiotic', '항생제', '세파', '페니실린', '아목시실린', '독시사이클린', '아지트로마이신', '클래리스로마이신'],
    severity: 'high',
    message: '항생제 복용 시 유산균이 사멸하므로 최소 2시간 이상의 간격을 두고 섭취하세요.',
    sourceNote: 'Report: Antibiotics destroy probiotics',
  },
  {
    id: 'osteoporosis-calcium',
    nutrientId: 'calcium',
    medicationKeyword: 'bisphosphonate',
    medicationAliases: ['bisphosphonate', '비스포스포네이트', '알렌드로네이트', '리세드로네이트', '골다공증약'],
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
  },
  {
    id: 'aspirin-vitamin-c',
    nutrientId: 'vitamin_c',
    medicationKeyword: 'aspirin',
    medicationAliases: ['aspirin', '아스피린', '바이엘'],
    severity: 'high',
    message: '아스피린 복용 중 고용량 비타민 C는 위장관 출혈 위험을 높일 수 있으므로 중성화된 비타민 C를 권장하거나 식후 복용하세요.',
    sourceNote: 'Report: Aspirin + high-dose vitamin C GI bleeding risk',
  },
  {
    id: 'warfarin-ginseng',
    nutrientId: 'ginseng',
    medicationKeyword: 'warfarin',
    medicationAliases: ['warfarin', '와파린', '쿠마딘', '항응고'],
    severity: 'high',
    message: '와파린 복용 중 홍삼(진세노사이드) 섭취는 출혈 위험을 높일 수 있으므로 주의가 필요합니다.',
    sourceNote: 'Report: Ginseng antiplatelet effect with warfarin',
  },
  {
    id: 'warfarin-vitamin-e',
    nutrientId: 'vitamin_e',
    medicationKeyword: 'warfarin',
    medicationAliases: ['warfarin', '와파린', '쿠마딘', '항응고'],
    severity: 'caution',
    message: '와파린 복용 중 고용량 비타민 E는 혈소판 응집을 억제하여 출혈 위험을 증가시킬 수 있습니다.',
    sourceNote: 'Report: Vitamin E antiplatelet with warfarin',
  },
  {
    id: 'bisphosphonate-magnesium',
    nutrientId: 'magnesium',
    medicationKeyword: 'bisphosphonate',
    medicationAliases: ['bisphosphonate', '비스포스포네이트', '알렌드로네이트', '리세드로네이트', '골다공증약'],
    severity: 'high',
    message: '골다공증 약(비스포스포네이트)과 마그네슘은 킬레이트 형성을 방지하기 위해 2시간 이상 간격을 두세요.',
    sourceNote: 'Report: Bisphosphonate chelation',
  },
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
