// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { SupplementWorkspace } from './WorkspacePage'

afterEach(cleanup)

describe('SupplementWorkspace', () => {
  it('offers microgram units and keeps typed ingredient amounts intact', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <SupplementWorkspace
        supplements={[]}
        onSupplements={() => undefined}
        onAnalyze={() => undefined}
        sessionEmail="qa@example.com"
      />,
    )

    await user.click(screen.getByRole('button', { name: /수동 성분/ }))

    const amountInput = container.querySelector('tbody input[type="number"]')
    const unitSelect = container.querySelector('tbody select')

    expect(amountInput).toBeInstanceOf(HTMLInputElement)
    expect(unitSelect).toBeInstanceOf(HTMLSelectElement)

    const options = Array.from((unitSelect as HTMLSelectElement).options).map((option) => option.value)
    expect(options).toContain('ug')
    expect(options).toContain('µg')

    expect((amountInput as HTMLInputElement).value).toBe('')
    await user.type(amountInput as HTMLInputElement, '4000')
    expect((amountInput as HTMLInputElement).value).toBe('4000')

    await user.selectOptions(unitSelect as HTMLSelectElement, 'ug')
    expect((unitSelect as HTMLSelectElement).value).toBe('ug')
  })
})
