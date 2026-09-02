// crm-api/src/services/settingsCache.service.js

/**
 * Tenant-scoped in-memory cache store for system settings.
 * Key format: `settings:company:${companyId}`
 * Default TTL: 5 minutes (300,000 ms)
 */
class SettingsCacheService {
  constructor() {
    this.cache = new Map()
    this.ttlMs = 5 * 60 * 1000 // 5 minutes
  }

  /**
   * Get cached settings for a company.
   * @param {number} companyId 
   * @returns {Object|null} Cached settings object or null if expired/missing
   */
  get(companyId) {
    if (!companyId) return null
    const key = `settings:company:${companyId}`
    const entry = this.cache.get(key)

    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  /**
   * Set cached settings for a company.
   * @param {number} companyId 
   * @param {Object} settingsData 
   */
  set(companyId, settingsData) {
    if (!companyId || !settingsData) return
    const key = `settings:company:${companyId}`
    this.cache.set(key, {
      data: settingsData,
      expiresAt: Date.now() + this.ttlMs,
    })
  }

  /**
   * Instantly invalidate cache for a company.
   * @param {number} companyId 
   */
  invalidate(companyId) {
    if (!companyId) return
    const key = `settings:company:${companyId}`
    this.cache.delete(key)
  }

  /**
   * Clear all cached settings.
   */
  clearAll() {
    this.cache.clear()
  }
}

export const settingsCache = new SettingsCacheService()
