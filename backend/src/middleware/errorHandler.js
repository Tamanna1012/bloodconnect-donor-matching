// The single place that turns a thrown/forwarded error into an HTTP
// response. Express recognizes this as error-handling middleware
// specifically because it has 4 parameters (err, req, res, next) -- it
// must be registered LAST in app.js, after every route.
//
// Our services already throw errors with a `.statusCode` attached
// (httpErrors.js's httpError()), so most of the time this is just
// reading that back out. A genuinely unexpected error (a bug, a DB
// outage) has no statusCode, so it falls through to 500 -- and only
// those get logged server-side; a normal 400/403/404 is expected,
// user-facing behavior, not something to alert on.
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500

  if (statusCode === 500) {
    console.error(err)
  }

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Something went wrong. Please try again.' : err.message,
  })
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' })
}
