import rateLimit from 'express-rate-limit'

// Deliberately only on the auth endpoints -- these are the ones an
// attacker would hammer to brute-force a password or spam-create
// accounts. Rate-limiting every route in the app is unnecessary for a
// project this size and would just make normal use (browsing donors,
// refreshing a dashboard) more fragile.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 20 attempts per IP per window
  standardHeaders: true, // sends RateLimit-* response headers
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
})
