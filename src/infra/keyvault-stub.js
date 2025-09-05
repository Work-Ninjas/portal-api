// Stub Azure Key Vault for local F4-B testing
// This provides the same interface as the real keyvault.js but uses local env vars

const { logger } = require('../utils/logger');

// Cache for secrets (5-minute timeout)
const secretsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get secret from environment variables (local testing)
 * @param {string} secretName - Name of the secret
 * @returns {Promise<string>} - Secret value
 */
async function getSecret(secretName) {
  try {
    // Check cache first
    const cached = secretsCache.get(secretName);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      logger.debug('Secret retrieved from cache (STUB)', { secretName });
      return cached.value;
    }

    // For local testing, use environment variables or defaults
    let secretValue;
    
    switch (secretName) {
      case 'API_TOKEN_PEPPER_v1':
        secretValue = process.env.API_TOKEN_PEPPER_v1 || 'local_test_pepper_f4b_2024';
        break;
      case 'DATABASE_URL':
        secretValue = process.env.DATABASE_URL || 'postgresql://localhost:5432/portal_dev';
        break;
      default:
        // Try environment variable with same name
        secretValue = process.env[secretName];
        if (!secretValue) {
          throw new Error(`Secret ${secretName} not found in environment variables`);
        }
    }

    // Cache the secret
    secretsCache.set(secretName, {
      value: secretValue,
      timestamp: Date.now()
    });

    logger.info('Secret retrieved from environment (STUB)', { 
      secretName,
      hasValue: !!secretValue,
      source: 'env_variable'
    });

    return secretValue;

  } catch (error) {
    logger.error('Failed to get secret (STUB)', {
      secretName,
      error: error.message
    });
    throw error;
  }
}

/**
 * Clear secrets cache
 */
function clearCache() {
  secretsCache.clear();
  logger.info('Secrets cache cleared (STUB)');
}

module.exports = {
  getSecret,
  clearCache
};