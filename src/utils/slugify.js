/**
 * Produces a URL-safe slug from arbitrary text (used for team slugs).
 * @param {string} input
 * @returns {string}
 */
export function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
