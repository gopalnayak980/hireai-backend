const CURRENCY_BY_COUNTRY = Object.freeze({
  in: 'INR', gb: 'GBP', us: 'USD', at: 'EUR', au: 'AUD', be: 'EUR',
  br: 'BRL', ca: 'CAD', ch: 'CHF', de: 'EUR', es: 'EUR', fr: 'EUR',
  it: 'EUR', mx: 'MXN', nl: 'EUR', nz: 'NZD', pl: 'PLN', sg: 'SGD', za: 'ZAR',
})

const parseSalaryBound = (value) => (
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
)

const formatLegacySalary = (country, minimum, maximum) => {
  const currencyCode = CURRENCY_BY_COUNTRY[country]
  const formatter = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  })
  const min = parseSalaryBound(minimum)
  const max = parseSalaryBound(maximum)

  if (min !== null && max !== null) {
    return max >= min
      ? `${formatter.format(min)} - ${formatter.format(max)}`
      : 'Not disclosed'
  }
  if (min !== null) return `${formatter.format(min)}+`
  if (max !== null) return `Up to ${formatter.format(max)}`
  return 'Not disclosed'
}

module.exports = { CURRENCY_BY_COUNTRY, formatLegacySalary }
