const test = require('node:test')
const assert = require('node:assert/strict')
const { CURRENCY_BY_COUNTRY, formatLegacySalary } = require('../utils/jobSalary')

test('all supported countries have a currency mapping', () => {
  assert.deepEqual(Object.keys(CURRENCY_BY_COUNTRY).sort(), [
    'at', 'au', 'be', 'br', 'ca', 'ch', 'de', 'es', 'fr', 'gb',
    'in', 'it', 'mx', 'nl', 'nz', 'pl', 'sg', 'us', 'za',
  ])
})

test('maps India, UK, USA, EUR markets, and other supported currencies', () => {
  assert.equal(CURRENCY_BY_COUNTRY.in, 'INR')
  assert.equal(CURRENCY_BY_COUNTRY.gb, 'GBP')
  assert.equal(CURRENCY_BY_COUNTRY.us, 'USD')
  for (const country of ['at', 'be', 'de', 'es', 'fr', 'it', 'nl']) {
    assert.equal(CURRENCY_BY_COUNTRY[country], 'EUR')
  }
  assert.equal(CURRENCY_BY_COUNTRY.au, 'AUD')
  assert.equal(CURRENCY_BY_COUNTRY.br, 'BRL')
  assert.equal(CURRENCY_BY_COUNTRY.ca, 'CAD')
  assert.equal(CURRENCY_BY_COUNTRY.ch, 'CHF')
  assert.equal(CURRENCY_BY_COUNTRY.mx, 'MXN')
  assert.equal(CURRENCY_BY_COUNTRY.nz, 'NZD')
  assert.equal(CURRENCY_BY_COUNTRY.pl, 'PLN')
  assert.equal(CURRENCY_BY_COUNTRY.sg, 'SGD')
  assert.equal(CURRENCY_BY_COUNTRY.za, 'ZAR')
})

test('formats both bounds and safely handles either missing bound', () => {
  assert.equal(formatLegacySalary('in', 100000, 200000), '₹100,000 - ₹200,000')
  assert.equal(formatLegacySalary('gb', 50000, 75000), '£50,000 - £75,000')
  assert.equal(formatLegacySalary('us', 80000, 120000), '$80,000 - $120,000')
  assert.equal(formatLegacySalary('de', 60000, 90000), '€60,000 - €90,000')
  assert.equal(formatLegacySalary('au', 70000, null), 'A$70,000+')
  assert.equal(formatLegacySalary('ca', null, 110000), 'Up to CA$110,000')
  assert.equal(formatLegacySalary('sg', null, null), 'Not disclosed')
  assert.equal(formatLegacySalary('in', 0, Number.NaN), 'Not disclosed')
  assert.equal(formatLegacySalary('in', 200000, 100000), 'Not disclosed')
})
