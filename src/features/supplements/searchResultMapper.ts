import { findNutrientByName } from '../nutrition/nutritionData'
import { createId } from '../../lib/utils'
import type { ParsedIngredient, Unit } from '../../types'

export type SearchIngredientInput = Partial<ParsedIngredient> & {
  name?: string
}

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
