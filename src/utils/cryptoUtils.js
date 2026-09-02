// crm-api/src/utils/cryptoUtils.js

import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12 // 96 bits recommended for GCM
const TAG_LENGTH = 16 // 128 bits auth tag

/**
 * Derives a consistent 32-byte key using SHA-256 hash of ENCRYPTION_KEY or JWT_SECRET.
 */
const getEncryptionKey = () => {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "default_crm_system_settings_secret_key_32bytes!"
  return crypto.createHash("sha256").update(String(secret)).digest()
}

/**
 * Encrypts a plain string (e.g. SMTP password) using AES-256-GCM.
 * Output format: iv_hex:auth_tag_hex:ciphertext_hex
 * @param {string} text - Plain text to encrypt
 * @returns {string|null} Encrypted string or null if text is empty/invalid
 */
export const encryptText = (text) => {
  if (!text || typeof text !== "string") return null
  if (text.startsWith("enc:")) return text // Already encrypted safeguard

  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(text, "utf8", "hex")
    encrypted += cipher.final("hex")

    const authTag = cipher.getAuthTag().toString("hex")

    return `enc:${iv.toString("hex")}:${authTag}:${encrypted}`
  } catch (error) {
    console.error("[CRYPTO_ERROR] Failed to encrypt text:", error.message)
    throw new Error("Encryption failed")
  }
}

/**
 * Decrypts an encrypted string created by encryptText.
 * @param {string} encryptedString - Encrypted string in enc:iv:tag:cipher format
 * @returns {string|null} Decrypted plain text string
 */
export const decryptText = (encryptedString) => {
  if (!encryptedString || typeof encryptedString !== "string") return null
  if (!encryptedString.startsWith("enc:")) return encryptedString // Return as is if not encrypted

  try {
    const parts = encryptedString.split(":")
    if (parts.length !== 4) return encryptedString

    const [, ivHex, tagHex, cipherHex] = parts
    const key = getEncryptionKey()
    const iv = Buffer.from(ivHex, "hex")
    const authTag = Buffer.from(tagHex, "hex")

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(cipherHex, "hex", "utf8")
    decrypted += decipher.final("utf8")

    return decrypted
  } catch (error) {
    console.error("[CRYPTO_ERROR] Failed to decrypt text:", error.message)
    return null
  }
}
