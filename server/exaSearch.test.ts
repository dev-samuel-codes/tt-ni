import { describe, expect, it } from 'vitest'
import { extractIngredients, mapExaSearchResults, refinedNameMap, refineProductNamesWithComet } from './exaSearch'

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

describe('refinedNameMap', () => {
  it('parses cleaned product names from a JSON response', () => {
    expect(refinedNameMap('{"products":[{"index":0,"name":"Vitamin C Tablet"}]}')).toEqual(
      new Map([[0, 'Vitamin C Tablet']]),
    )
  })

  it('ignores malformed product name entries', () => {
    expect(refinedNameMap('{"products":[{"index":"x","name":"  "},{"index":1,"name":"Zinc"}]}')).toEqual(
      new Map([[1, 'Zinc']]),
    )
  })
})

describe('refineProductNamesWithComet', () => {
  it('uses the chat completion response to replace Exa product names', async () => {
    const products = await refineProductNamesWithComet(
      'vitamin c',
      [{
        name: 'Label: VITAMIN C- ascorbic acid tablet | DailyMed',
        brand: '',
        ingredients: [{ name: 'Vitamin C', amount: 500, unit: 'mg' }],
        sourceUrl: 'https://example.com/product',
      }],
      async () => new Response(JSON.stringify({
        choices: [{ message: { content: '{"products":[{"index":0,"name":"Vitamin C Ascorbic Acid Tablet"}]}' } }],
      })),
    )

    expect(products[0].name).toBe('Vitamin C Ascorbic Acid Tablet')
  })

  it('keeps the original product name when Comet omits an index', async () => {
    const products = await refineProductNamesWithComet(
      'vitamin c',
      [{
        name: 'Vitamin C 500',
        brand: '',
        ingredients: [{ name: 'Vitamin C', amount: 500, unit: 'mg' }],
        sourceUrl: 'https://example.com/product',
      }],
      async () => new Response(JSON.stringify({
        choices: [{ message: { content: '{"products":[]}' } }],
      })),
    )

    expect(products[0].name).toBe('Vitamin C 500')
  })
})
