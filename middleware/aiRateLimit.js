const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS = 10
const MAX_TRACKED_KEYS = 50000
const requests = new Map()

const cleanup = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of requests) {
    if (entry.resetAt <= now) requests.delete(key)
  }
}, 5 * 60 * 1000)
cleanup.unref()

module.exports = (req, res, next) => {
  const key = String(req.user?.id || req.ip || 'unknown')
  const now = Date.now()
  let entry = requests.get(key)

  if (!entry || entry.resetAt <= now) {
    if (requests.size >= MAX_TRACKED_KEYS) {
      for (const [trackedKey, trackedEntry] of requests) {
        if (trackedEntry.resetAt <= now) requests.delete(trackedKey)
      }
    }
    if (requests.size >= MAX_TRACKED_KEYS) {
      return res.status(503).json({ message: 'AI request limiting is temporarily unavailable' })
    }
    entry = { count: 0, resetAt: now + WINDOW_MS }
    requests.set(key, entry)
  }

  if (entry.count >= MAX_REQUESTS) {
    res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
    return res.status(429).json({ message: 'AI request limit reached. Please try again later.' })
  }

  entry.count += 1
  return next()
}
