import { describe, expect, it } from 'vitest'
import { extractIngredients, mapExaSearchResults } from './exaSearch'

describe('extractIngredients', () => {
  it('normalizes units and removes duplicates from search snippets', () => {
    const ingredients = extractIngredients('Vitamin C 500 MG. vitamin c 500 mg. Vitamin D 1000 iu. Folate 400 μg.')

    expect(ingredients).toEqual([
      { name: 'Vitamin C', amount: 500, unit: 'mg' },
      { name: 'Vitamin D', amount: 1000, unit: 'IU' },
    ])
  })
})

describe('mapExaSearchResults', () => {
  it('filters results with no extractable ingredients so the UI can use the first product', () => {
    const products = mapExaSearchResults([
      {
        title: 'Generic Vitamin Article',
        url: 'https://example.com/article',
        text: 'This article has no supplement facts.',
      },
      {
        title: 'Vitamin C 500 - iHerb',
        url: 'https://example.com/product',
        text: 'Supplement Facts: Vitamin C 500 mg.',
      },
    ])

    expect(products).toEqual([
      {
        name: 'Vitamin C 500',
        brand: '',
        ingredients: [{ name: 'Vitamin C', amount: 500, unit: 'mg' }],
        sourceUrl: 'https://example.com/product',
      },
    ])
  })
})
