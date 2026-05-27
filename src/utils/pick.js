/**
 * Returns a new object containing only keys present in `keys`.
 * @template {Record<string, unknown>} T
 * @param {T} object
 * @param {string[]} keys
 * @returns {Partial<T>}
 */
export function pick(object, keys) {
  /** @type {Partial<T>} */
  const result = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      result[key] = object[key];
    }
  }
  return result;
}
