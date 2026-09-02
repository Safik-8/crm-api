// crm-api/scratch/verify_settings.js

import prisma from "../src/config/db.js"
import { encryptText, decryptText } from "../src/utils/cryptoUtils.js"
import { settingsCache } from "../src/services/settingsCache.service.js"
import { findOrCreateCompanySettings } from "../src/modules/settings/settings.repository.js"
import { sanitizeSettingsForResponse } from "../src/modules/settings/settings.service.js"

async function runVerification() {
  console.log("=== STARTING TASK 3 SYSTEM SETTINGS VERIFICATION ===")

  try {
    // 1. Test AES-256-GCM Encryption
    const testSecret = "MySecretSmtpPass123!"
    const encrypted = encryptText(testSecret)
    const decrypted = decryptText(encrypted)

    console.log("1. Encryption Test:")
    console.log("   - Plaintext:", testSecret)
    console.log("   - Encrypted format:", encrypted)
    console.log("   - Decrypted result:", decrypted)
    if (decrypted !== testSecret) throw new Error("Encryption/Decryption mismatch!")
    console.log("   ✔ Encryption test PASSED")

    // 2. Test Repository Upsert & Defaults
    const testCompanyId = 1
    const settings = await findOrCreateCompanySettings(testCompanyId)
    console.log("2. Repository Upsert Test:")
    console.log("   - Found/Created Settings ID:", settings.id)
    console.log("   - Default Timezone:", settings.timeZone)
    console.log("   - Default Currency:", settings.currency)
    if (!settings || !settings.companyId) throw new Error("Repository findOrCreate failed!")
    console.log("   ✔ Repository test PASSED")

    // 3. Test Password Masking Safeguard
    const sanitized = sanitizeSettingsForResponse(settings)
    console.log("3. Password Masking Safeguard Test:")
    console.log("   - Sanitized smtpPassword field:", sanitized.smtpPassword)
    if (sanitized.smtpPasswordEncrypted) throw new Error("Encrypted password was not removed in sanitized output!")
    console.log("   ✔ Password masking test PASSED")

    // 4. Test In-Memory Cache Service
    settingsCache.set(testCompanyId, settings)
    const cached = settingsCache.get(testCompanyId)
    console.log("4. In-Memory Tenant Cache Test:")
    console.log("   - Cached Company ID:", cached?.companyId)
    if (!cached || cached.companyId !== testCompanyId) throw new Error("Cache retrieve failed!")
    settingsCache.invalidate(testCompanyId)
    const invalidated = settingsCache.get(testCompanyId)
    if (invalidated) throw new Error("Cache invalidation failed!")
    console.log("   ✔ Cache test PASSED")

    console.log("\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ===")
  } catch (err) {
    console.error("❌ Verification Failed:", err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

runVerification()
