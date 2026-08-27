// src/utils/auditSanitizer.js

/**
 * OWASP & NIST Sensitive Data Redaction & Payload Optimization.
 * Recursively redacts credentials, secrets, tokens, PII, and financial data
 * from audit log `oldValue` and `newValue` snapshots.
 */

// Keys to redact automatically (case-insensitive match)
const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'password_hash',
  'token',
  'refreshtoken',
  'refresh_token',
  'accesstoken',
  'access_token',
  'secret',
  'secretkey',
  'secret_key',
  'authorization',
  'auth',
  'otp',
  'pin',
  'creditcard',
  'credit_card',
  'cvv',
  'cookie',
  'sessionid',
  'session_id',
];

/**
 * Checks if a key name is sensitive and should be masked.
 * @param {string} key
 * @returns {boolean}
 */
const isSensitiveKey = (key) => {
  if (!key || typeof key !== 'string') return false;
  const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
  return SENSITIVE_KEYS.some((s) => lowerKey.includes(s.replace(/[-_]/g, '')));
};

/**
 * Computes payload diffs or sanitizes data objects.
 * Redacts sensitive fields while keeping real audit values intact.
 * @param {any} value
 * @param {number} [depth=0]
 * @returns {any} Sanitized value
 */
export const sanitizeAuditPayload = (value, depth = 0) => {
  if (value === null || value === undefined) {
    return null;
  }

  // Prevent stack overflow on deeply nested structures
  if (depth > 8) {
    return '[NESTED_PAYLOAD_TRUNCATED]';
  }

  // Handle Primitive Types
  if (typeof value !== 'object') {
    return value;
  }

  // Handle Date Objects
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle Arrays
  if (Array.isArray(value)) {
    const maxItems = 50;
    const sanitizedArray = value.slice(0, maxItems).map((item) => sanitizeAuditPayload(item, depth + 1));
    if (value.length > maxItems) {
      sanitizedArray.push(`[TRUNCATED: ${value.length - maxItems} MORE ITEMS OMITTED]`);
    }
    return sanitizedArray;
  }

  // Handle Objects
  const sanitizedObj = {};
  for (const [key, val] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      sanitizedObj[key] = '[REDACTED]';
    } else if (val === null || val === undefined) {
      sanitizedObj[key] = null;
    } else if (typeof val === 'object') {
      sanitizedObj[key] = sanitizeAuditPayload(val, depth + 1);
    } else if (typeof val === 'string' && val.length > 5000) {
      // Truncate excessively large strings (e.g. base64 image strings)
      sanitizedObj[key] = `${val.slice(0, 500)}... [STRING_TRUNCATED_${val.length}_CHARS]`;
    } else {
      sanitizedObj[key] = val;
    }
  }

  return sanitizedObj;
};
