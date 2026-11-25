const MAX_TRACKED_IPS = 100000

module.exports = ({ windowMs, maxRequests, message }) => {
  const requests = new Map()
  const cleanup = setInterval(() => {
    const now = Date.now()
    for (const [ip, entry] of requests) {
      if (entry.resetAt <= now) requests.delete(ip)
    }
  }, Math.min(windowMs, 5 * 60 * 1000))
  cleanup.unref()

  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    const now = Date.now()
    let entry = requests.get(ip)

    if (!entry || entry.resetAt <= now) {
      if (requests.size >= MAX_TRACKED_IPS) {
        for (const [trackedIp, trackedEntry] of requests) {
          if (trackedEntry.resetAt <= now) requests.delete(trackedIp)
        }
      }
      if (requests.size >= MAX_TRACKED_IPS) {
        return res.status(503).json({ message: 'Request limiting is temporarily unavailable' })
      }
      entry = { count: 0, resetAt: now + windowMs }
      requests.set(ip, entry)
    }

    if (entry.count >= maxRequests) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))))
      return res.status(429).json({ message })
    }

    entry.count += 1
    return next()
  }
}
