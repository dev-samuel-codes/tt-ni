import { describe, expect, it } from 'vitest'
import { mapSearchIngredientToParsed } from './searchResultMapper'

describe('mapSearchIngredientToParsed', () => {
  it('maps Exa search ingredients into the full ParsedIngredient shape', () => {
    expect(mapSearchIngredientToParsed(
      { name: 'Vitamin C', amount: 500, unit: 'mg' },
      () => 'ing_test',
    )).toEqual({
      id: 'ing_test',
      rawName: 'Vitamin C',
      standardName: '비타민 C',
      nutrientId: 'vitamin_c',
      amount: 500,
      unit: 'mg',
      confidence: 0.7,
      rawText: 'Vitamin C',
      reviewRequired: true,
    })
  })

  it('does not crash when a search ingredient has only partial fields', () => {
    expect(mapSearchIngredientToParsed({}, () => 'ing_empty')).toMatchObject({
      id: 'ing_empty',
      rawName: '성분명 미확인',
      standardName: '성분명 미확인',
      amount: 0,
      unit: 'mg',
    })
  })

  it('keeps ug units available for ingredient review', () => {
    expect(mapSearchIngredientToParsed(
      { name: 'Folate', amount: 400, unit: 'ug' },
      () => 'ing_folate',
    )).toMatchObject({
      id: 'ing_folate',
      amount: 400,
      unit: 'ug',
    })
  })
})
