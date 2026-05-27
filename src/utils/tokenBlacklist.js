/** In-memory refresh-token blacklist (replace with Redis in production if needed). */
const blacklist = new Set();

/**
 * @param {string} token
 */
export function blacklistToken(token) {
  if (!token) return;
  blacklist.add(token);
}

/**
 * @param {string} token
 * @returns {boolean}
 */
export function isTokenBlacklisted(token) {
  return blacklist.has(token);
}
