import { findNutrientByName } from '../nutrition/nutritionData'
import { createId } from '../../lib/utils'
import type { ParsedIngredient, Unit } from '../../types'

/** 검색 결과에서 받은 원시 성분 입력. Partial<ParsedIngredient>에 name 필드 추가. */
export type SearchIngredientInput = Partial<ParsedIngredient> & {
  name?: string
}

/**
 * Exa 검색 결과 또는 검색 API의 원시 성분을 ParsedIngredient로 변환합니다.
 * 1. 성분명을 기준으로 nutrients DB에서 표준 영양소 조회
 * 2. 매칭 성공 시 표준명, nutrientId, unit을 덮어씀
 * 3. 매칭 실패 시 reviewRequired=true로 설정
 */
export function mapSearchIngredientToParsed(
  ingredient: SearchIngredientInput,
  idFactory: (prefix: string) => string = createId,
): ParsedIngredient {
  const rawName = ingredient.rawName ?? ingredient.name ?? ingredient.standardName ?? '성분명 미확인'
  const submittedName = ingredient.standardName ?? rawName
  const nutrient = rawName === '성분명 미확인' ? undefined : findNutrientByName(submittedName)
  const standardName = nutrient?.standardName ?? submittedName
  const confidence = ingredient.confidence ?? 0.7
  const unit = ingredient.unit ?? 'mg'

  return {
    id: ingredient.id ?? idFactory('ing'),
    rawName,
    standardName,
    nutrientId: nutrient?.id ?? ingredient.nutrientId ?? '',
    amount: ingredient.amount ?? 0,
    unit: unit as Unit,
    confidence,
    rawText: ingredient.rawText ?? rawName,
    reviewRequired: ingredient.reviewRequired ?? (!nutrient || confidence < 0.8 || unit === 'unknown'),
  }
}
