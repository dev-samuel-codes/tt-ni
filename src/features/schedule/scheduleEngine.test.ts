import { describe, expect, it } from 'vitest'
import { generateSchedule, type ScheduleInput } from './scheduleEngine'

function makeInput(overrides?: Partial<ScheduleInput>): ScheduleInput {
  return {
    supplements: [],
    medications: [],
    conditions: [],
    preferences: {},
    ...overrides,
  }
}

function makeSupplement(
  id: string,
  productName: string,
  ingredients: Array<{ nutrientId: string; standardName: string; amount: number; unit: string }>,
  dailyServings = 1,
): ScheduleInput['supplements'][number] {
  return { id, productName, dailyServings, ingredients }
}

describe('generateSchedule', () => {
  it('returns empty array for empty supplements', () => {
    const result = generateSchedule(makeInput())
    expect(result).toEqual([])
  })

  it('returns empty array for undefined supplements', () => {
    const result = generateSchedule({ supplements: undefined as unknown as ScheduleInput['supplements'], medications: [], conditions: [], preferences: {} })
    expect(result).toEqual([])
  })

  it('places fat-soluble vitamins in after-meal slots', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '비타민 D', [{ nutrientId: 'vitamin_d', standardName: '비타민 D', amount: 1000, unit: 'IU' }]),
      ],
    }))
    expect(result.length).toBeGreaterThan(0)
    const slot = result[0]
    expect(slot.label).toMatch(/식후/)
    expect(slot.items).toContain('비타민 D')
  })

  it('places water-soluble vitamins in empty-stomach slots', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '비타민 C', [{ nutrientId: 'vitamin_c', standardName: '비타민 C', amount: 1000, unit: 'mg' }]),
      ],
    }))
    const slot = result[0]
    expect(slot.label).toMatch(/기상/)
    expect(slot.items).toContain('비타민 C')
  })

  it('places probiotics in empty-stomach slot', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '유산균', [{ nutrientId: 'probiotics', standardName: '유산균', amount: 1000000, unit: 'CFU' }]),
      ],
    }))
    const slot = result[0]
    expect(slot.label).toMatch(/기상/)
    expect(slot.items).toContain('유산균')
  })

  it('places iron in empty-stomach slot', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '철분', [{ nutrientId: 'iron', standardName: '철분', amount: 18, unit: 'mg' }]),
      ],
    }))
    const slot = result[0]
    expect(slot.label).toMatch(/기상/)
    expect(slot.items).toContain('철분')
  })

  it('moves iron to after-meal slot for GI issues', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '철분', [{ nutrientId: 'iron', standardName: '철분', amount: 18, unit: 'mg' }]),
      ],
      conditions: ['위염'],
    }))
    const wakeSlot = result.find((s) => s.label === '기상 직후')
    expect(wakeSlot).toBeUndefined()
    const afterSlot = result.find((s) => s.label.includes('식후'))
    expect(afterSlot).toBeDefined()
    expect(afterSlot!.items).toContain('철분')
  })

  it('places calcium in evening slots', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '칼슘', [{ nutrientId: 'calcium', standardName: '칼슘', amount: 500, unit: 'mg' }]),
      ],
    }))
    const slot = result[0]
    expect(slot.label).toMatch(/저녁|취침/)
    expect(slot.items).toContain('칼슘')
  })

  it('places magnesium in evening slots', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '마그네슘', [{ nutrientId: 'magnesium', standardName: '마그네슘', amount: 300, unit: 'mg' }]),
      ],
    }))
    const slot = result[0]
    expect(slot.label).toMatch(/저녁|취침/)
    expect(slot.items).toContain('마그네슘')
  })

  it('detects DNI warnings for warfarin and vitamin K', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '비타민 K', [{ nutrientId: 'vitamin_k', standardName: '비타민 K', amount: 90, unit: 'mcg' }]),
      ],
      medications: [{ name: '와파린', memo: '' }],
    }))
    const warningSlot = result.find((s) => s.warning)
    expect(warningSlot).toBeDefined()
    expect(warningSlot!.warning).toContain('와파린')
  })

  it('detects DNI warnings for metformin and vitamin B12', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '비타민 B12', [{ nutrientId: 'vitamin_b12', standardName: '비타민 B12', amount: 1000, unit: 'mcg' }]),
      ],
      medications: [{ name: '메트포르민', memo: '당뇨' }],
    }))
    const tipSlot = result.find((s) => s.tip)
    expect(tipSlot).toBeDefined()
    expect(tipSlot!.tip).toContain('B12')
  })

  it('generates tip for supplements with daily servings > 1', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '비타민 C', [{ nutrientId: 'vitamin_c', standardName: '비타민 C', amount: 500, unit: 'mg' }], 2),
      ],
    }))
    const tipSlot = result.find((s) => s.tip)
    expect(tipSlot).toBeDefined()
    expect(tipSlot!.tip).toContain('2회')
  })

  it('separates calcium and iron into different slots (antagonism resolution)', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '칼슘', [{ nutrientId: 'calcium', standardName: '칼슘', amount: 500, unit: 'mg' }]),
        makeSupplement('s2', '철분', [{ nutrientId: 'iron', standardName: '철분', amount: 18, unit: 'mg' }]),
      ],
    }))
    const calciumSlot = result.find((s) => s.items.includes('칼슘'))
    const ironSlot = result.find((s) => s.items.includes('철분'))
    expect(calciumSlot).toBeDefined()
    expect(ironSlot).toBeDefined()
    expect(calciumSlot!.time).not.toBe(ironSlot!.time)
  })

  it('handles multiple supplements in the same slot', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '비타민 A', [{ nutrientId: 'vitamin_a', standardName: '비타민 A', amount: 900, unit: 'mcg' }]),
        makeSupplement('s2', '비타민 D', [{ nutrientId: 'vitamin_d', standardName: '비타민 D', amount: 1000, unit: 'IU' }]),
        makeSupplement('s3', '비타민 E', [{ nutrientId: 'vitamin_e', standardName: '비타민 E', amount: 15, unit: 'mg' }]),
      ],
    }))
    const afterMealSlot = result.find((s) => s.label.includes('식후'))
    expect(afterMealSlot).toBeDefined()
    expect(afterMealSlot!.items.length).toBeGreaterThanOrEqual(3)
  })

  it('does not contain duplicate items across slots', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '유산균', [{ nutrientId: 'probiotics', standardName: '유산균', amount: 1000000, unit: 'CFU' }]),
        makeSupplement('s2', '비타민 C', [{ nutrientId: 'vitamin_c', standardName: '비타민 C', amount: 500, unit: 'mg' }]),
      ],
    }))
    const allItems = result.flatMap((s) => s.items)
    expect(new Set(allItems).size).toBe(allItems.length)
  })

  it('blocks statin+grapefruit combination', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '자몽 추출물', [{ nutrientId: 'grapefruit', standardName: '자몽 추출물', amount: 500, unit: 'mg' }]),
      ],
      medications: [{ name: '스타틴', memo: '고지혈증' }],
    }))
    const blockSlot = result.find((s) => s.warning && s.warning.includes('금지'))
    expect(blockSlot).toBeDefined()
  })

  it('returns empty result for zero-length slots (all items assigned)', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', 'CoQ10', [{ nutrientId: 'coq10', standardName: '코엔자임 Q10', amount: 100, unit: 'mg' }]),
      ],
    }))
    // Should have at least 1 slot with CoQ10
    expect(result.length).toBeGreaterThan(0)
    const coq10Slot = result.find((s) => s.items.includes('CoQ10'))
    expect(coq10Slot).toBeDefined()
  })

  it('handles combined fat-soluble and evening nutrients in one product', () => {
    // Product with both vitamin D (fat-soluble) and calcium (evening) → should go to evening
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '칼슘+비타민D', [
          { nutrientId: 'calcium', standardName: '칼슘', amount: 500, unit: 'mg' },
          { nutrientId: 'vitamin_d', standardName: '비타민 D', amount: 400, unit: 'IU' },
        ]),
      ],
    }))
    const slot = result[0]
    expect(slot.label).toMatch(/저녁|취침/)
  })

  it('handles medication with Korean brand name matching', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '코엔자임 Q10', [{ nutrientId: 'coq10', standardName: '코엔자임 Q10', amount: 100, unit: 'mg' }]),
      ],
      medications: [{ name: '로수바스타틴', memo: '' }],
    }))
    const tipSlot = result.find((s) => s.tip)
    expect(tipSlot).toBeDefined()
    expect(tipSlot!.tip).toContain('코엔자임')
  })

  it('handles antibiotic + probiotics spacing warning', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '유산균', [{ nutrientId: 'probiotics', standardName: '유산균', amount: 1000000, unit: 'CFU' }]),
      ],
      medications: [{ name: '아목시실린', memo: '' }],
    }))
    const warningSlot = result.find((s) => s.warning)
    expect(warningSlot).toBeDefined()
    expect(warningSlot!.warning).toContain('항생제')
  })

  it('handles grapefruit supplement in after-meal slot', () => {
    const result = generateSchedule(makeInput({
      supplements: [
        makeSupplement('s1', '자몽 추출물', [{ nutrientId: 'grapefruit', standardName: '자몽 추출물', amount: 500, unit: 'mg' }]),
      ],
    }))
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].label).toMatch(/식후/)
  })

  it('does not crash with many supplements', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      makeSupplement(`s${i}`, `제품${i}`, [
        { nutrientId: i % 3 === 0 ? 'vitamin_c' : i % 3 === 1 ? 'vitamin_d' : 'calcium', standardName: `성분${i}`, amount: 100, unit: 'mg' },
      ]),
    )
    const result = generateSchedule(makeInput({ supplements: many }))
    expect(result.length).toBeGreaterThan(0)
    // All supplements should appear in at least one slot
    const allItems = result.flatMap((s) => s.items)
    expect(allItems.length).toBeGreaterThanOrEqual(many.length)
  })
})
