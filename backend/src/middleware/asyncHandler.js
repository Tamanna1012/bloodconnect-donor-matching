// Express doesn't await route handlers itself, so a rejected promise
// inside a plain `async function(req, res)` would otherwise be an
// unhandled rejection -- it wouldn't reach our error-handling middleware
// at all. This wrapper catches that rejection and forwards it to
// `next(err)`, which IS how Express routes errors to errorHandler.js.
//
// Wrapping every controller in this removes the need for each one to
// repeat its own try/catch -- the centralized errorHandler.js becomes
// the single place that turns a thrown error into an HTTP response.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
