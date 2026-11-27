const test = require('node:test')
const assert = require('node:assert/strict')
const { LOCAL_E2E, readAdzunaFixture, resolveAdzunaFixture, validateLocalE2EEnvironment } = require('../utils/localE2E')

const validEnvironment = () => ({
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
  HIREAI_E2E_RUN_ID: '0123456789abcdef',
  GEMINI_API_KEY: '',
  ADZUNA_APP_ID: '',
  ADZUNA_APP_KEY: '',
})

test('local E2E backend accepts only the fixed loopback targets', () => {
  const config = validateLocalE2EEnvironment(validEnvironment())
  assert.equal(config.mongoUri, 'mongodb://127.0.0.1:27017/hireai_e2e_local')
  assert.equal(config.host, '127.0.0.1')
  assert.equal(config.fixtureName, 'adzuna-search.json')
})

for (const [name, field, value] of [
  ['hosted frontend', 'HIREAI_E2E_FRONTEND_URL', 'https://hireai.example'],
  ['hosted backend', 'HIREAI_E2E_BACKEND_URL', 'https://api.example'],
  ['production API client URL', 'VITE_API_URL', 'https://api.example/api'],
  ['nonlocal E2E Mongo URI', 'HIREAI_E2E_MONGO_URI', 'mongodb+srv://cluster.example/hireai_e2e_local'],
  ['production Mongo URI', 'MONGO_URI', 'mongodb://db.example/hireai'],
  ['shared hireai database', 'MONGO_URI', 'mongodb://127.0.0.1:27017/hireai'],
  ['non-loopback host binding', 'HOST', '0.0.0.0'],
  ['different port', 'PORT', '5001'],
  ['additional frontend origins', 'FRONTEND_URLS', 'https://hosted.example'],
  ['AI enabled', 'HIREAI_E2E_ENABLE_AI', 'true'],
]) {
  test(`local E2E backend rejects ${name}`, () => {
    const env = validEnvironment()
    env[field] = value
    assert.throws(() => validateLocalE2EEnvironment(env), /must exactly match|cannot run/)
  })
}

test('local E2E backend rejects external service credentials', () => {
  const env = validEnvironment()
  env.ADZUNA_APP_KEY = 'fixture-test-only'
  assert.throws(() => validateLocalE2EEnvironment(env), /must not load external AI or Adzuna credentials/)
})

test('Adzuna fixture paths cannot leave the fixture directory', () => {
  assert.throws(() => resolveAdzunaFixture('../outside.json'), /JSON filename inside/)
})

test('the configured Adzuna fixture has synthetic search results', () => {
  const fixture = readAdzunaFixture('adzuna-search.json')
  assert.equal(fixture.results.length, 3)
  assert.equal(fixture.count, fixture.results.length)
  assert.ok(fixture.results.every((job) => String(job.id).startsWith('hireai-local-e2e-job-')))
})
