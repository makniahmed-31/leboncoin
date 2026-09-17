import { describe, expect, it } from 'vitest'

import { ApiError } from './api-error'
import { createQueryClient } from './query-client'

function retryPolicy() {
  const options = createQueryClient().getDefaultOptions().queries
  return options?.retry as (failureCount: number, error: unknown) => boolean
}

function delayPolicy() {
  const options = createQueryClient().getDefaultOptions().queries
  return options?.retryDelay as (attempt: number, error: unknown) => number
}

describe('retry policy', () => {
  it('does not retry a client error, which cannot resolve on its own', () => {
    const shouldRetry = retryPolicy()
    expect(shouldRetry(0, new ApiError('VALIDATION_FAILED', 400, 'nope'))).toBe(false)
    expect(shouldRetry(0, new ApiError('CONVERSATION_NOT_FOUND', 404, 'nope'))).toBe(false)
    expect(shouldRetry(0, new ApiError('RATE_LIMITED', 429, 'doucement'))).toBe(false)
  })

  it('retries a server error and a transport failure', () => {
    const shouldRetry = retryPolicy()
    expect(shouldRetry(0, new ApiError('SERVICE_UNAVAILABLE', 503, 'down'))).toBe(true)
    expect(shouldRetry(0, new ApiError('TIMEOUT', 504, 'slow'))).toBe(true)
    expect(shouldRetry(0, new ApiError('NETWORK_ERROR', 0, 'offline'))).toBe(true)
  })

  it('gives up after three attempts', () => {
    const shouldRetry = retryPolicy()
    const error = new ApiError('SERVICE_UNAVAILABLE', 503, 'down')
    expect(shouldRetry(2, error)).toBe(true)
    expect(shouldRetry(3, error)).toBe(false)
  })

  it('retries an unrecognised throw, which is almost always a network fault', () => {
    expect(retryPolicy()(0, new TypeError('Failed to fetch'))).toBe(true)
  })
})

describe('backoff', () => {
  it('grows with each attempt and stays under the ceiling', () => {
    const delay = delayPolicy()
    const first = delay(0, null)
    const later = delay(6, null)

    expect(first).toBeGreaterThanOrEqual(500)
    expect(first).toBeLessThanOrEqual(1000)
    expect(later).toBeLessThanOrEqual(15_000)
    expect(later).toBeGreaterThan(first)
  })

  it('jitters, so clients that failed together do not retry together', () => {
    const delay = delayPolicy()
    const samples = new Set(Array.from({ length: 20 }, () => delay(3, null)))
    expect(samples.size).toBeGreaterThan(1)
  })
})
