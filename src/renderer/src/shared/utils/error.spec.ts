import { describe, expect, it } from 'vitest'
import { extractBizCode, extractTraceId, normalizeErrorMessage } from './error'

describe('shared/utils/error', () => {
  it('extracts bizCode from custom error object', () => {
    const error = {
      bizCode: 11028
    }

    expect(extractBizCode(error)).toBe(11028)
  })

  it('extracts bizCode from axios-like response payload', () => {
    const error = {
      response: {
        data: {
          code: 11006
        }
      }
    }

    expect(extractBizCode(error)).toBe(11006)
  })

  it('extracts trace id from direct field and response payload', () => {
    expect(extractTraceId({ traceId: 'trace-direct' })).toBe('trace-direct')
    expect(
      extractTraceId({
        response: {
          data: {
            trace_id: 'trace-response'
          }
        }
      })
    ).toBe('trace-response')
  })

  it('normalizes message by priority', () => {
    expect(
      normalizeErrorMessage({
        response: {
          data: {
            message: 'payload message'
          }
        }
      })
    ).toBe('payload message')

    expect(normalizeErrorMessage(new Error('native message'))).toBe('native message')
    expect(normalizeErrorMessage('raw message')).toBe('raw message')
    expect(normalizeErrorMessage({})).toBe('发生未知错误')
  })
})
