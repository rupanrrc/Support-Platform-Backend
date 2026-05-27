import crypto from "crypto";

/**
 * @param {string} value
 * @returns {string}
 */
export function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}
