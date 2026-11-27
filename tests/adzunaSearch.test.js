const test = require('node:test')
const assert = require('node:assert/strict')
const { searchAdzuna } = require('../utils/adzunaSearch')
const { LOCAL_E2E } = require('../utils/localE2E')

const localEnv = () => ({
  NODE_ENV: 'development',
  HIREAI_E2E_MODE: 'true',
  HIREAI_E2E_FRONTEND_URL: LOCAL_E2E.frontendUrl,
  HIREAI_E2E_BACKEND_URL: LOCAL_E2E.backendUrl,
  HIREAI_E2E_MONGO_URI: LOCAL_E2E.mongoUri,
  VITE_API_URL: LOCAL_E2E.apiUrl,
  MONGO_URI: LOCAL_E2E.mongoUri,
  HOST: LOCAL_E2E.host,
  PORT: LOCAL_E2E.port,
  FRONTEND_URL: LOCAL_E2E.frontendUrl,
  FRONTEND_URLS: '',
  TRUST_PROXY: '0',
  HIREAI_E2E_ENABLE_AI: 'false',
  HIREAI_E2E_ADZUNA_FIXTURE: 'adzuna-search.json',
  HIREAI_E2E_RUN_ID: 'fedcba9876543210',
  GEMINI_API_KEY: '',
  ADZUNA_APP_ID: '',
  ADZUNA_APP_KEY: '',
})

test('E2E Adzuna search uses the configured fixture without HTTP requests', async () => {
  let requestCount = 0
  const result = await searchAdzuna({ country: 'in', page: 1, params: {} }, {
    env: localEnv(),
    httpClient: { get: async () => { requestCount += 1; throw new Error('HTTP must not be called') } },
  })
  assert.equal(requestCount, 0)
  assert.equal(result.data.results.length, 3)
  assert.ok(result.data.results.every((job) => job.id.endsWith('-fedcba9876543210')))
})

test('normal Adzuna searches retain the existing HTTP behavior', async () => {
  const calls = []
  const expectedResponse = { data: { count: 0, results: [] } }
  const result = await searchAdzuna({ country: 'gb', page: 2, params: { what: 'engineer' }, timeout: 4321 }, {
    env: { HIREAI_E2E_MODE: 'false' },
    httpClient: { get: async (...args) => { calls.push(args); return expectedResponse } },
  })
  assert.equal(result, expectedResponse)
  assert.deepEqual(calls, [[
    'https://api.adzuna.com/v1/api/jobs/gb/search/2',
    { params: { what: 'engineer' }, timeout: 4321 },
  ]])
})
