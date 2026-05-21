import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ResultSetHeader } from 'mysql2'

vi.mock('./db.js', () => ({
  pool: {
    execute: vi.fn(),
  },
}))

import { pool } from './db.js'
import {
  consumeExternalApiQuota,
  dailyExternalApiLimit,
  DEFAULT_DAILY_EXTERNAL_API_LIMIT,
  EXTERNAL_API_USAGE_BUCKET,
} from './rateLimit.js'

const executeMock = vi.mocked(pool.execute)

function result(affectedRows: number): ResultSetHeader {
  return { affectedRows } as ResultSetHeader
}

describe('consumeExternalApiQuota', () => {
  afterEach(() => {
    executeMock.mockReset()
    delete process.env.DAILY_EXTERNAL_API_LIMIT
  })

  it('uses a shared daily external API bucket and allows calls below the limit', async () => {
    executeMock.mockResolvedValueOnce([result(1), []])

    await expect(consumeExternalApiQuota('firebase-user-1')).resolves.toBe(true)

    const [sql, params] = executeMock.mock.calls[0]
    expect(sql).toContain('app_api_usage')
    expect(sql).toContain('on duplicate key update')
    expect(sql).toContain('call_count < ?')
    expect(params).toEqual(['firebase-user-1', EXTERNAL_API_USAGE_BUCKET, DEFAULT_DAILY_EXTERNAL_API_LIMIT])
  })

  it('blocks calls once the database counter is already at the limit', async () => {
    executeMock.mockResolvedValueOnce([result(0), []])

    await expect(consumeExternalApiQuota('firebase-user-1')).resolves.toBe(false)
  })

  it('falls back to 50 calls per user per day when the env value is invalid', () => {
    process.env.DAILY_EXTERNAL_API_LIMIT = 'invalid'

    expect(dailyExternalApiLimit()).toBe(50)
  })
})
