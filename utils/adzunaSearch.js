const axios = require('axios')
const { readAdzunaFixture, validateLocalE2EEnvironment } = require('./localE2E')

const searchAdzuna = async ({ country, page, params, timeout = 10000 }, dependencies = {}) => {
  const env = dependencies.env || process.env
  if (env.HIREAI_E2E_MODE === 'true') {
    const config = validateLocalE2EEnvironment(env)
    const fixture = readAdzunaFixture(config.fixtureName)
    const results = fixture.results.map((job) => ({
      ...job,
      id: `${job.id}-${env.HIREAI_E2E_RUN_ID}`,
    }))
    return { data: { ...fixture, count: results.length, results } }
  }

  const httpClient = dependencies.httpClient || axios
  return httpClient.get(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`, {
    params,
    timeout,
  })
}

module.exports = { searchAdzuna }
