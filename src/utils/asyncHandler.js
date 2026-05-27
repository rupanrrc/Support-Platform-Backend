/**
 * Wraps async route handlers so rejected promises reach Express error middleware.
 * @template {import("express").RequestHandler} T
 * @param {T} fn
 * @returns {T}
 */
export function asyncHandler(fn) {
  return /** @type {T} */ (
    function asyncHandlerWrapped(req, res, next) {
      Promise.resolve(fn(req, res, next)).catch(next);
    }
  );
}
