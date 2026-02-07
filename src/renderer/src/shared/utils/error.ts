type MaybeRecord = Record<string, unknown>

function asRecord(input: unknown): MaybeRecord | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null
  }
  return input as MaybeRecord
}

function readString(record: MaybeRecord | null, key: string): string | null {
  if (!record) {
    return null
  }
  const value = record[key]
  return typeof value === 'string' ? value : null
}

function readNumber(record: MaybeRecord | null, key: string): number | null {
  if (!record) {
    return null
  }
  const value = record[key]
  return typeof value === 'number' ? value : null
}

function getResponseData(error: unknown): MaybeRecord | null {
  const root = asRecord(error)
  const response = asRecord(root?.response)
  const data = asRecord(response?.data)
  return data
}

export function extractBizCode(error: unknown): number | null {
  const root = asRecord(error)
  const directCode = readNumber(root, 'bizCode')
  if (typeof directCode === 'number') {
    return directCode
  }

  const dataCode = readNumber(getResponseData(error), 'code')
  if (typeof dataCode === 'number') {
    return dataCode
  }

  return null
}

export function extractTraceId(error: unknown): string | null {
  const root = asRecord(error)
  const directTrace = readString(root, 'traceId')
  if (directTrace) {
    return directTrace
  }

  const responseTrace = readString(getResponseData(error), 'trace_id')
  if (responseTrace) {
    return responseTrace
  }

  return null
}

export function normalizeErrorMessage(error: unknown): string {
  const dataMessage = readString(getResponseData(error), 'message')
  if (dataMessage) {
    return dataMessage
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return '发生未知错误'
}
