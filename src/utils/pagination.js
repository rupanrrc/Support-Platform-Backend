/**
 * @param {number} page
 * @param {number} limit
 * @returns {{ skip: number, limit: number, page: number }}
 */
export function getPagination(page = 1, limit = 20) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimitRaw = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20;
  const safeLimit = Math.min(safeLimitRaw, 100);
  const skip = (safePage - 1) * safeLimit;
  return { page: safePage, limit: safeLimit, skip };
}
