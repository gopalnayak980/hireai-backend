const fs = require('node:fs')
const path = require('node:path')

const LOCAL_E2E = Object.freeze({
  frontendUrl: 'http://127.0.0.1:5173',
  backendUrl: 'http://127.0.0.1:5000',
  apiUrl: 'http://127.0.0.1:5000/api',
  mongoUri: 'mongodb://127.0.0.1:27017/hireai_e2e_local',
  databaseName: 'hireai_e2e_local',
  host: '127.0.0.1',
  port: '5000',
})

const fixtureDirectory = path.resolve(__dirname, '../tests/fixtures')

const resolveAdzunaFixture = (fixtureName) => {
  if (typeof fixtureName !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/.test(fixtureName)) {
    throw new Error('HIREAI_E2E_ADZUNA_FIXTURE must be a JSON filename inside the backend tests/fixtures directory')
  }
  const fixturePath = path.resolve(fixtureDirectory, fixtureName)
  if (!fixturePath.startsWith(`${fixtureDirectory}${path.sep}`)) {
    throw new Error('HIREAI_E2E_ADZUNA_FIXTURE must remain inside the backend tests/fixtures directory')
  }
  const realFixtureDirectory = fs.realpathSync(fixtureDirectory)
  const realFixturePath = fs.realpathSync(fixturePath)
  if (!realFixturePath.startsWith(`${realFixtureDirectory}${path.sep}`)) {
    throw new Error('HIREAI_E2E_ADZUNA_FIXTURE must remain inside the backend tests/fixtures directory')
  }
  return realFixturePath
}

const readAdzunaFixture = (fixtureName) => {
  const fixturePath = resolveAdzunaFixture(fixtureName)
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
  if (!fixture || !Array.isArray(fixture.results) || fixture.results.length === 0 ||
      !Number.isFinite(fixture.count) || fixture.count < fixture.results.length) {
    throw new Error('Configured local Adzuna fixture must contain a count and at least one result')
  }
  return fixture
}

const validateLocalE2EEnvironment = (env = process.env) => {
  const exactValues = [
    ['HIREAI_E2E_MODE', 'true'],
    ['HIREAI_E2E_FRONTEND_URL', LOCAL_E2E.frontendUrl],
    ['HIREAI_E2E_BACKEND_URL', LOCAL_E2E.backendUrl],
    ['VITE_API_URL', LOCAL_E2E.apiUrl],
    ['HIREAI_E2E_MONGO_URI', LOCAL_E2E.mongoUri],
    ['MONGO_URI', LOCAL_E2E.mongoUri],
    ['HOST', LOCAL_E2E.host],
    ['PORT', LOCAL_E2E.port],
    ['FRONTEND_URL', LOCAL_E2E.frontendUrl],
    ['FRONTEND_URLS', ''],
    ['TRUST_PROXY', '0'],
    ['HIREAI_E2E_ENABLE_AI', 'false'],
  ]
  for (const [name, expected] of exactValues) {
    if (env[name] !== expected) throw new Error(`${name} must exactly match the local E2E configuration`)
  }
  if (env.NODE_ENV === 'production') throw new Error('Local E2E mode cannot run with NODE_ENV=production')
  if (env.GEMINI_API_KEY || env.ADZUNA_APP_ID || env.ADZUNA_APP_KEY) {
    throw new Error('Local E2E mode must not load external AI or Adzuna credentials')
  }
  if (typeof env.HIREAI_E2E_RUN_ID !== 'string' || !/^[a-f0-9]{16}$/.test(env.HIREAI_E2E_RUN_ID)) {
    throw new Error('HIREAI_E2E_RUN_ID must be a 16-character local run identifier')
  }
  const fixturePath = resolveAdzunaFixture(env.HIREAI_E2E_ADZUNA_FIXTURE)
  readAdzunaFixture(env.HIREAI_E2E_ADZUNA_FIXTURE)
  return { ...LOCAL_E2E, fixturePath, fixtureName: env.HIREAI_E2E_ADZUNA_FIXTURE }
}

module.exports = { LOCAL_E2E, readAdzunaFixture, resolveAdzunaFixture, validateLocalE2EEnvironment }
