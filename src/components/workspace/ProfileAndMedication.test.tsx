// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { useState } from 'react'
import type { Profile } from '../../types'
import { ProfileAndMedication } from './ProfileAndMedication'

const INITIAL_PROFILE: Profile = {
  gender: 'female',
  birthYear: 1998,
  heightCm: 165,
  weightKg: 55,
  pregnancyStatus: 'none',
  lactationStatus: false,
  conditions: [],
  allergies: [],
  dietaryRestrictions: [],
  consentAccepted: false,
}

function renderProfileForm() {
  function ProfileFormHarness() {
    const [profile, setProfile] = useState(INITIAL_PROFILE)
    return (
      <ProfileAndMedication
        profile={profile}
        medications={[]}
        onProfile={setProfile}
        onMedications={() => undefined}
      />
    )
  }

  return render(<ProfileFormHarness />)
}

afterEach(cleanup)

describe('ProfileAndMedication', () => {
  it('replaces the default height without leaving a leading zero', async () => {
    const user = userEvent.setup()
    renderProfileForm()
    const heightInput = screen.getByLabelText('키(cm)')

    await user.clear(heightInput)
    expect(heightInput).toHaveProperty('value', '')
    await user.type(heightInput, '180')

    expect(heightInput).toHaveProperty('value', '180')
  })

  it('replaces the default weight without leaving a leading zero', async () => {
    const user = userEvent.setup()
    renderProfileForm()
    const weightInput = screen.getByLabelText('몸무게(kg)')

    await user.clear(weightInput)
    expect(weightInput).toHaveProperty('value', '')
    await user.type(weightInput, '70')

    expect(weightInput).toHaveProperty('value', '70')
  })
})
