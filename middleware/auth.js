const jwt = require('jsonwebtoken')

const authenticate = (req, res, next) => {
  const [scheme, token, ...extra] = (req.headers.authorization || '').split(' ')
  if (scheme !== 'Bearer' || !token || extra.length) {
    return res.status(401).json({ message: 'Authentication required' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (!payload.id) return res.status(401).json({ message: 'Invalid token' })
    req.user = payload
    return next()
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
}

const requireRole = (role) => (req, res, next) => {
  if (!req.user || req.user.role !== role) {
    return res.status(403).json({ message: 'Insufficient permissions' })
  }
  return next()
}

module.exports = authenticate
module.exports.requireRole = requireRole
