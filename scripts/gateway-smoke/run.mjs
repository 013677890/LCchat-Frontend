import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import axios from 'axios'

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(CURRENT_DIR, 'fixtures')
const CASES_PATH = path.join(FIXTURES_DIR, 'cases.json')
const ACCOUNTS_EXAMPLE_PATH = path.join(FIXTURES_DIR, 'accounts.example.json')
const ACCOUNTS_LOCAL_PATH = path.join(FIXTURES_DIR, 'accounts.local.json')
const REPORT_PATH = path.join(FIXTURES_DIR, 'last-run-report.json')

function nowIso() {
  return new Date().toISOString()
}

async function readJson(filepath, fallback) {
  try {
    const content = await readFile(filepath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return fallback
  }
}

function getDataCode(payload) {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const value = payload.code
  return typeof value === 'number' ? value : null
}

async function resolveAccessToken(httpClient, accounts) {
  const envToken = process.env.LCCHAT_TEST_ACCESS_TOKEN
  if (envToken) {
    return envToken
  }

  const account = accounts?.login?.account
  const password = accounts?.login?.password
  if (!account || !password) {
    return ''
  }

  try {
    const response = await httpClient.request({
      method: 'POST',
      url: '/api/v1/public/user/login',
      data: {
        account,
        password
      },
      headers: {
        'X-Device-ID': accounts?.deviceId || 'lcchat-smoke-device'
      }
    })

    const businessCode = getDataCode(response.data)
    if (response.status !== 200 || businessCode !== 0) {
      return ''
    }

    const accessToken = response.data?.data?.accessToken
    return typeof accessToken === 'string' ? accessToken : ''
  } catch {
    return ''
  }
}

function matchesStatus(actual, expectedList) {
  if (!Array.isArray(expectedList) || expectedList.length === 0) {
    return true
  }
  return expectedList.includes(actual)
}

function matchesBusinessCode(payload, expectedList) {
  if (!Array.isArray(expectedList) || expectedList.length === 0) {
    return true
  }
  return expectedList.includes(getDataCode(payload))
}

function createResult(caseDef, patch) {
  return {
    id: caseDef.id,
    title: caseDef.title,
    ...patch
  }
}

async function run() {
  const baseURL = process.env.LCCHAT_GATEWAY_BASE_URL || 'http://127.0.0.1:8080'
  const timeoutMs = Number(process.env.LCCHAT_GATEWAY_DEFAULT_TIMEOUT_MS || 5000)
  const cases = await readJson(CASES_PATH, [])
  const accounts =
    (await readJson(ACCOUNTS_LOCAL_PATH, null)) ??
    (await readJson(ACCOUNTS_EXAMPLE_PATH, { deviceId: 'lcchat-smoke-device', login: {} }))

  const httpClient = axios.create({
    baseURL,
    timeout: timeoutMs,
    validateStatus: () => true
  })

  const accessToken = await resolveAccessToken(httpClient, accounts)
  const results = []

  console.log(`[gateway-smoke] ${nowIso()} baseURL=${baseURL}`)
  if (!accessToken) {
    console.log('[gateway-smoke] valid access token not found, bearer_valid cases will be skipped')
  }

  for (const caseDef of cases) {
    const expectTimeout = caseDef?.expect?.timeout === true
    const requiresToken = caseDef?.auth === 'bearer_valid'
    if (requiresToken && !accessToken) {
      results.push(
        createResult(caseDef, {
          status: 'skipped',
          reason: 'missing access token'
        })
      )
      continue
    }

    const headers = {}
    if (requiresToken && accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    const requestConfig = {
      method: caseDef.method || 'GET',
      url: caseDef.path,
      params: caseDef.query || undefined,
      data: caseDef.body || undefined,
      headers,
      timeout: Number(caseDef.timeoutMs || timeoutMs)
    }

    try {
      const response = await httpClient.request(requestConfig)
      const httpOk = matchesStatus(response.status, caseDef?.expect?.httpStatusIn)
      const businessOk = matchesBusinessCode(response.data, caseDef?.expect?.businessCodeIn)
      const timeoutOk = !expectTimeout

      const success = httpOk && businessOk && timeoutOk
      results.push(
        createResult(caseDef, {
          status: success ? 'passed' : 'failed',
          request: requestConfig,
          response: {
            httpStatus: response.status,
            businessCode: getDataCode(response.data),
            message: response.data?.message ?? ''
          },
          checks: {
            httpOk,
            businessOk,
            timeoutOk
          }
        })
      )
    } catch (error) {
      const timeoutTriggered =
        error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '')
      const success = expectTimeout && timeoutTriggered

      results.push(
        createResult(caseDef, {
          status: success ? 'passed' : 'failed',
          request: requestConfig,
          error: {
            code: error?.code || '',
            message: error?.message || ''
          },
          checks: {
            timeoutOk: success
          }
        })
      )
    }
  }

  const summary = {
    startedAt: nowIso(),
    baseURL,
    totals: {
      passed: results.filter((item) => item.status === 'passed').length,
      failed: results.filter((item) => item.status === 'failed').length,
      skipped: results.filter((item) => item.status === 'skipped').length
    },
    results
  }

  await writeFile(REPORT_PATH, JSON.stringify(summary, null, 2), 'utf-8')

  console.log('[gateway-smoke] summary:', summary.totals)
  console.log(`[gateway-smoke] report: ${REPORT_PATH}`)

  if (summary.totals.failed > 0) {
    process.exitCode = 1
  }
}

run().catch((error) => {
  console.error('[gateway-smoke] unhandled error', error)
  process.exitCode = 1
})
